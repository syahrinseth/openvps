<?php

namespace App\Services;

use App\Models\Server;
use App\Models\SslCertificate;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\Log;

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
        // Use certbot to obtain the certificate
        $output = $this->connection->execute(
            $server,
            "sudo certbot certonly --nginx -d {$domain} --non-interactive --agree-tos --email admin@{$domain} 2>&1"
        );

        if (str_contains($output, 'Congratulations') || str_contains($output, 'Successfully received certificate')) {
            return SslCertificate::create([
                'server_id' => $server->id,
                'domain' => $domain,
                'type' => 'letsencrypt',
                'status' => 'active',
                'certificate_path' => "/etc/letsencrypt/live/{$domain}/fullchain.pem",
                'private_key_path' => "/etc/letsencrypt/live/{$domain}/privkey.pem",
                'chain_path' => "/etc/letsencrypt/live/{$domain}/chain.pem",
                'auto_renew' => true,
                'issued_at' => now(),
                'expires_at' => now()->addDays(90),
            ]);
        }

        Log::error("SSL certificate request failed for {$domain}", ['output' => $output]);
        throw new Exception("Failed to obtain SSL certificate for {$domain}: {$output}");
    }

    /**
     * Renew an existing SSL certificate.
     */
    public function renewCertificate(Server $server, SslCertificate $cert): bool
    {
        $output = $this->connection->execute(
            $server,
            "sudo certbot renew --cert-name {$cert->domain} --non-interactive 2>&1"
        );

        if (str_contains($output, 'success') || str_contains($output, 'renewed')) {
            $cert->update([
                'issued_at' => now(),
                'expires_at' => now()->addDays(90),
                'status' => 'active',
            ]);

            $this->nginx->reloadNginx($server);

            return true;
        }

        Log::error("SSL renewal failed for {$cert->domain}", ['output' => $output]);

        return false;
    }

    /**
     * Revoke an SSL certificate.
     */
    public function revokeCertificate(Server $server, SslCertificate $cert): bool
    {
        $output = $this->connection->execute(
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

            if ($daysUntilExpiry <= 30) {
                try {
                    $renewed = $this->renewCertificate($server, $cert);
                    $results[] = [
                        'domain' => $cert->domain,
                        'renewed' => $renewed,
                        'days_remaining' => $daysUntilExpiry,
                    ];
                } catch (Exception $e) {
                    $results[] = [
                        'domain' => $cert->domain,
                        'renewed' => false,
                        'error' => $e->getMessage(),
                    ];
                }
            }
        }

        return $results;
    }
}
