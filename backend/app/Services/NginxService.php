<?php

namespace App\Services;

use App\Models\NginxConfig;
use App\Models\Server;
use App\Models\WebApp;
use Exception;
use Illuminate\Support\Facades\Log;

class NginxService
{
    public function __construct(
        protected ServerConnectionService $connection,
    ) {}

    /**
     * Create a virtual host configuration.
     * Only applicable to remote SSH-managed servers — Ref: TRAEFIK_MIGRATION_PLAN.md Phase 4
     */
    public function createVirtualHost(Server $server, WebApp $webApp, string $domain, int $port): NginxConfig
    {
        if ($server->is_local) {
            throw new Exception(
                "Cannot create an Nginx virtual host for a local server. " .
                "Local servers use Traefik Docker labels for routing."
            );
        }
        $configContent = $this->generateConfig($domain, $port);

        $remotePath = "/etc/nginx/sites-available/{$domain}";
        $tempPath = storage_path("app/nginx/{$domain}.conf");

        if (!is_dir(dirname($tempPath))) {
            mkdir(dirname($tempPath), 0755, true);
        }

        file_put_contents($tempPath, $configContent);

        $this->connection->upload($server, $tempPath, $remotePath);
        unlink($tempPath);

        // Enable the site
        $this->connection->execute($server, "ln -sf {$remotePath} /etc/nginx/sites-enabled/{$domain}");

        // Test and reload
        if (!$this->testConfig($server)) {
            // Remove the broken config
            $this->connection->execute($server, "rm -f /etc/nginx/sites-enabled/{$domain} {$remotePath}");
            throw new Exception("Generated nginx config for {$domain} is invalid.");
        }

        $this->reloadNginx($server);

        return NginxConfig::create([
            'server_id' => $server->id,
            'web_app_id' => $webApp->id,
            'domain' => $domain,
            'config_content' => $configContent,
            'is_active' => true,
            'is_ssl' => false,
            'listen_port' => $port,
            'root_path' => $webApp->root_directory,
        ]);
    }

    /**
     * Remove a virtual host configuration.
     */
    public function removeVirtualHost(Server $server, NginxConfig $config): bool
    {
        $domain = $config->domain;

        $this->connection->execute($server, "rm -f /etc/nginx/sites-enabled/{$domain}");
        $this->connection->execute($server, "rm -f /etc/nginx/sites-available/{$domain}");
        $this->reloadNginx($server);

        $config->delete();

        return true;
    }

    /**
     * Enable a site.
     */
    public function enableSite(Server $server, NginxConfig $config): bool
    {
        $domain = $config->domain;

        $this->connection->execute(
            $server,
            "ln -sf /etc/nginx/sites-available/{$domain} /etc/nginx/sites-enabled/{$domain}"
        );

        if (!$this->testConfig($server)) {
            $this->connection->execute($server, "rm -f /etc/nginx/sites-enabled/{$domain}");

            return false;
        }

        $this->reloadNginx($server);
        $config->update(['is_active' => true]);

        return true;
    }

    /**
     * Disable a site.
     */
    public function disableSite(Server $server, NginxConfig $config): bool
    {
        $domain = $config->domain;

        $this->connection->execute($server, "rm -f /etc/nginx/sites-enabled/{$domain}");
        $this->reloadNginx($server);
        $config->update(['is_active' => false]);

        return true;
    }

    /**
     * Reload nginx configuration.
     */
    public function reloadNginx(Server $server): bool
    {
        $output = $this->connection->execute($server, 'sudo systemctl reload nginx 2>&1');

        return !str_contains($output, 'Failed');
    }

    /**
     * Test nginx configuration syntax.
     */
    public function testConfig(Server $server): bool
    {
        $output = $this->connection->execute($server, 'sudo nginx -t 2>&1');

        return str_contains($output, 'syntax is ok') && str_contains($output, 'test is successful');
    }

    /**
     * Generate nginx config content for a domain and upstream port.
     */
    public function generateConfig(string $domain, int $port, bool $ssl = false): string
    {
        $config = "server {\n";

        if ($ssl) {
            $config .= "    listen 443 ssl http2;\n";
            $config .= "    listen [::]:443 ssl http2;\n";
            $config .= "\n";
            $config .= "    ssl_certificate /etc/letsencrypt/live/{$domain}/fullchain.pem;\n";
            $config .= "    ssl_certificate_key /etc/letsencrypt/live/{$domain}/privkey.pem;\n";
            $config .= "    ssl_protocols TLSv1.2 TLSv1.3;\n";
            $config .= "    ssl_ciphers HIGH:!aNULL:!MD5;\n";
            $config .= "    ssl_prefer_server_ciphers on;\n";
        } else {
            $config .= "    listen 80;\n";
            $config .= "    listen [::]:80;\n";
        }

        $config .= "\n";
        $config .= "    server_name {$domain};\n";
        $config .= "\n";
        $config .= "    access_log /var/log/nginx/{$domain}-access.log;\n";
        $config .= "    error_log /var/log/nginx/{$domain}-error.log;\n";
        $config .= "\n";
        $config .= "    location / {\n";
        $config .= "        proxy_pass http://127.0.0.1:{$port};\n";
        $config .= "        proxy_http_version 1.1;\n";
        $config .= "        proxy_set_header Upgrade \$http_upgrade;\n";
        $config .= "        proxy_set_header Connection 'upgrade';\n";
        $config .= "        proxy_set_header Host \$host;\n";
        $config .= "        proxy_set_header X-Real-IP \$remote_addr;\n";
        $config .= "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n";
        $config .= "        proxy_set_header X-Forwarded-Proto \$scheme;\n";
        $config .= "        proxy_cache_bypass \$http_upgrade;\n";
        $config .= "    }\n";
        $config .= "}\n";

        if ($ssl) {
            $config .= "\n";
            $config .= "server {\n";
            $config .= "    listen 80;\n";
            $config .= "    listen [::]:80;\n";
            $config .= "    server_name {$domain};\n";
            $config .= "    return 301 https://\$host\$request_uri;\n";
            $config .= "}\n";
        }

        return $config;
    }
}
