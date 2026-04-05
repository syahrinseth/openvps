<?php

namespace App\Services;

use App\Mail\SslExpiryMail;
use App\Models\NginxConfig;
use App\Models\Server;
use App\Models\SslCertificate;
use App\Models\User;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SslService
{
    public function __construct(
        protected ServerConnectionService $connection,
        protected NginxService $nginx,
    ) {}

    /**
     * Request a new Let's Encrypt SSL certificate for a domain.
     */
    public function requestCertificate(Server $server, string $domain): SslCertificate
    {
        if ($server->is_local) {
            throw new Exception(
                'SslService::requestCertificate() cannot be used for local servers. ' .
                'SSL for locally-hosted sites is managed by Traefik via ACME automatically.'
            );
        }

        $adminEmail = config('ssl.admin_email', 'admin@example.com');

        // Check that certbot is installed on the remote server
        $this->verifyCertbotInstalled($server);

        // Prepare the shared ACME webroot and nginx snippet (no nginx restart needed)
        $this->prepareAcmeWebroot($server, $domain);

        // Run certbot using the webroot method — nginx stays running throughout
        $result = $this->connection->executeWithStatus(
            $server,
            "sudo certbot certonly --webroot -w /var/www/letsencrypt -d {$domain} --non-interactive --agree-tos --email {$adminEmail} 2>&1"
        );

        $output = $result['output'];
        $exitStatus = $result['exit_status'];

        // Check exit status first — most reliable indicator
        if ($exitStatus !== 0) {
            Log::error("Certbot failed for {$domain} (exit {$exitStatus})", ['output' => $output]);
            throw new Exception("Certbot failed for {$domain}: {$output}");
        }

        // Verify certificate files actually exist on the server
        $this->verifyCertificateFiles($server, $domain);

        // Create the database record
        $certificate = SslCertificate::create([
            'server_id'        => $server->id,
            'domain'           => $domain,
            'type'             => 'letsencrypt',
            'status'           => 'active',
            'certificate_path' => "/etc/letsencrypt/live/{$domain}/fullchain.pem",
            'private_key_path' => "/etc/letsencrypt/live/{$domain}/privkey.pem",
            'chain_path'       => "/etc/letsencrypt/live/{$domain}/chain.pem",
            'auto_renew'       => true,
            'issued_at'        => now(),
            'expires_at'       => now()->addDays(90),
        ]);

        // Automatically configure nginx for SSL if a config exists for this domain
        $this->configureNginxForSsl($server, $domain, $certificate);

        return $certificate;
    }

    /**
     * Renew an existing SSL certificate.
     */
    public function renewCertificate(Server $server, SslCertificate $cert): bool
    {
        $result = $this->connection->executeWithStatus(
            $server,
            "sudo certbot renew --cert-name {$cert->domain} --non-interactive 2>&1"
        );

        $output = $result['output'];
        $exitStatus = $result['exit_status'];

        if ($exitStatus !== 0) {
            Log::error("SSL renewal failed for {$cert->domain} (exit {$exitStatus})", ['output' => $output]);

            return false;
        }

        $cert->update([
            'issued_at'  => now(),
            'expires_at' => now()->addDays(90),
            'status'     => 'active',
        ]);

        $this->nginx->reloadNginx($server);

        // Notify server owner about successful renewal
        $this->notifyAdmins($cert->fresh(), 0, true);

        return true;
    }

    /**
     * Revoke an SSL certificate.
     */
    public function revokeCertificate(Server $server, SslCertificate $cert): bool
    {
        $this->connection->execute(
            $server,
            "sudo certbot revoke --cert-name {$cert->domain} --non-interactive --delete-after-revoke 2>&1"
        );

        $cert->update(['status' => 'revoked']);

        return true;
    }

    /**
     * Check how many days until a certificate expires.
     */
    public function checkExpiration(SslCertificate $cert): int
    {
        if (!$cert->expires_at) {
            return 0;
        }

        return (int) now()->diffInDays($cert->expires_at, false);
    }

    /**
     * Auto-renew all certificates nearing expiration on a server.
     */
    public function autoRenewAll(Server $server): array
    {
        $results = [];

        $certificates = $server->sslCertificates()
            ->where('auto_renew', true)
            ->where('status', 'active')
            ->get();

        foreach ($certificates as $cert) {
            $daysUntilExpiry = $this->checkExpiration($cert);

            // Send expiry warnings (even if auto-renew is enabled, notify at 30 days for visibility)
            if ($daysUntilExpiry <= 30 && $daysUntilExpiry > 7) {
                $this->notifyAdmins($cert, $daysUntilExpiry, false);
            }

            if ($daysUntilExpiry <= 30) {
                try {
                    $renewed = $this->renewCertificate($server, $cert);
                    $results[] = [
                        'domain'         => $cert->domain,
                        'renewed'        => $renewed,
                        'days_remaining' => $daysUntilExpiry,
                    ];
                } catch (Exception $e) {
                    // Renewal failed — notify urgently if close to expiry
                    if ($daysUntilExpiry <= 7) {
                        $this->notifyAdmins($cert, $daysUntilExpiry, false);
                    }

                    $results[] = [
                        'domain'  => $cert->domain,
                        'renewed' => false,
                        'error'   => $e->getMessage(),
                    ];
                }
            }
        }

        return $results;
    }

    /**
     * Prepare the shared ACME webroot directory and nginx snippet on the managed server.
     *
     * Creates /var/www/letsencrypt as the fixed webroot for all certbot --webroot requests,
     * installs /etc/nginx/snippets/letsencrypt.conf to serve ACME challenges for every
     * domain without restarting nginx, and injects the snippet include into the domain's
     * site config if it is not already present.
     */
    protected function prepareAcmeWebroot(Server $server, string $domain): void
    {
        try {
            // 1. Create the shared ACME challenge directory
            $this->connection->execute(
                $server,
                'sudo mkdir -p /var/www/letsencrypt/.well-known/acme-challenge && ' .
                'sudo chmod -R 755 /var/www/letsencrypt'
            );

            // 2. Write the nginx ACME snippet (idempotent — safe to run on every request)
            $snippetContent = implode("\n", [
                'location ^~ /.well-known/acme-challenge/ {',
                '    root /var/www/letsencrypt;',
                '    allow all;',
                '}',
            ]);

            $this->connection->execute(
                $server,
                "echo '{$snippetContent}' | sudo tee /etc/nginx/snippets/letsencrypt.conf > /dev/null"
            );

            // 3. Inject the snippet include into the domain's nginx site config if missing
            $siteConfig = "/etc/nginx/sites-available/{$domain}";
            $includeDir  = "/etc/nginx/sites-available";

            $checkResult = $this->connection->executeWithStatus(
                $server,
                "test -f {$siteConfig} && echo 'exists' || echo 'missing'"
            );

            if (str_contains($checkResult['output'], 'exists')) {
                // Only inject if not already present
                $alreadyIncluded = $this->connection->executeWithStatus(
                    $server,
                    "grep -q 'letsencrypt.conf' {$siteConfig} && echo 'yes' || echo 'no'"
                );

                if (str_contains($alreadyIncluded['output'], 'no')) {
                    // Insert the include line inside the first server {} block, after the server_name line
                    $this->connection->execute(
                        $server,
                        "sudo sed -i '/server_name/a\\    include /etc/nginx/snippets/letsencrypt.conf;' {$siteConfig}"
                    );
                }
            } else {
                // No site config for this domain yet — create a minimal HTTP-only config
                // solely to serve ACME challenges so certbot can validate the domain
                $tempConfig = implode("\n", [
                    'server {',
                    '    listen 80;',
                    '    listen [::]:80;',
                    "    server_name {$domain};",
                    '    include /etc/nginx/snippets/letsencrypt.conf;',
                    '    location / { return 404; }',
                    '}',
                ]);

                $this->connection->execute(
                    $server,
                    "echo '{$tempConfig}' | sudo tee {$siteConfig} > /dev/null && " .
                    "sudo ln -sf {$siteConfig} /etc/nginx/sites-enabled/{$domain}"
                );
            }

            // 4. Reload nginx to pick up the snippet — no restart, no downtime
            $this->nginx->reloadNginx($server);

            Log::info("ACME webroot prepared for {$domain} on server {$server->name}.");
        } catch (Exception $e) {
            // Non-fatal — log and attempt certbot anyway; it may still work
            Log::warning("Failed to prepare ACME webroot for {$domain}: {$e->getMessage()}");
        }
    }

    /**
     * Assert that certbot is installed on the server.
     *
     * @throws Exception
     */
    protected function verifyCertbotInstalled(Server $server): void
    {
        $result = $this->connection->executeWithStatus($server, 'which certbot 2>&1');

        if ($result['exit_status'] !== 0 || trim($result['output']) === '') {
            throw new Exception(
                'certbot is not installed on this server. ' .
                'Please install it first: sudo apt install certbot python3-certbot-nginx'
            );
        }
    }

    /**
     * Assert that the expected certificate files exist on the server after issuance.
     *
     * @throws Exception
     */
    protected function verifyCertificateFiles(Server $server, string $domain): void
    {
        $check = "test -f /etc/letsencrypt/live/{$domain}/fullchain.pem && " .
                 "test -f /etc/letsencrypt/live/{$domain}/privkey.pem && " .
                 "echo 'ok'";

        $result = $this->connection->executeWithStatus($server, $check);

        if ($result['exit_status'] !== 0 || !str_contains($result['output'], 'ok')) {
            throw new Exception(
                "Certificate files not found for {$domain} after certbot ran. " .
                'The certificate may not have been issued correctly.'
            );
        }
    }

    /**
     * Automatically update or create an nginx SSL config for the domain after issuance.
     */
    protected function configureNginxForSsl(Server $server, string $domain, SslCertificate $certificate): void
    {
        try {
            /** @var NginxConfig|null $nginxConfig */
            $nginxConfig = NginxConfig::where('server_id', $server->id)
                ->where('domain', $domain)
                ->first();

            if (!$nginxConfig) {
                // No existing nginx config — nothing to update; user should configure nginx separately
                Log::info("No nginx config found for {$domain} on server {$server->name}; skipping SSL nginx update.");

                return;
            }

            $port = $nginxConfig->listen_port;
            $configContent = $this->nginx->generateConfig($domain, $port, ssl: true);

            $remotePath = "/etc/nginx/sites-available/{$domain}";
            $tempPath = storage_path("app/nginx/{$domain}.conf");

            if (!is_dir(dirname($tempPath))) {
                mkdir(dirname($tempPath), 0755, true);
            }

            file_put_contents($tempPath, $configContent);
            $this->connection->upload($server, $tempPath, $remotePath);
            unlink($tempPath);

            // Test config and reload nginx
            if (!$this->nginx->testConfig($server)) {
                Log::error("Nginx SSL config for {$domain} failed syntax test — not reloading.");

                return;
            }

            $this->nginx->reloadNginx($server);

            // Update the NginxConfig record and link it to the certificate
            $nginxConfig->update([
                'is_ssl'       => true,
                'config_content' => $configContent,
            ]);

            $certificate->update(['nginx_config_id' => $nginxConfig->id]);

            Log::info("Nginx SSL configured for {$domain} on server {$server->name}.");
        } catch (Exception $e) {
            // Nginx config failure is non-fatal — the cert was issued, log and continue
            Log::warning("Failed to auto-configure nginx SSL for {$domain}: {$e->getMessage()}");
        }
    }

    /**
     * Send SSL expiry / renewal notifications to all admin users.
     */
    protected function notifyAdmins(SslCertificate $cert, int $daysRemaining, bool $renewed): void
    {
        try {
            $admins = User::role('admin')->get();

            foreach ($admins as $admin) {
                Mail::to($admin->email)->queue(new SslExpiryMail($cert, $daysRemaining, $renewed));
            }
        } catch (Exception $e) {
            Log::warning('Failed to send SSL expiry email', ['error' => $e->getMessage()]);
        }
    }
}
