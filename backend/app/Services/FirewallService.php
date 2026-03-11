<?php

namespace App\Services;

use App\Models\FirewallRule;
use App\Models\Server;
use Exception;
use Illuminate\Support\Facades\Log;

class FirewallService
{
    public function __construct(
        protected ServerConnectionService $connection,
    ) {}

    /**
     * Add a firewall rule to the server.
     */
    public function addRule(Server $server, array $data): FirewallRule
    {
        $command = $this->buildUfwCommand($data);
        $output = $this->connection->execute($server, "sudo {$command} 2>&1");

        if (str_contains($output, 'ERROR') || str_contains($output, 'Error')) {
            throw new Exception("Failed to add firewall rule: {$output}");
        }

        return FirewallRule::create([
            'server_id' => $server->id,
            'name' => $data['name'] ?? $data['description'] ?? 'Rule',
            'rule_type' => $data['rule_type'],
            'direction' => $data['direction'] ?? 'in',
            'protocol' => $data['protocol'] ?? 'tcp',
            'port' => $data['port'],
            'from_ip' => $data['from_ip'] ?? null,
            'to_ip' => $data['to_ip'] ?? null,
            'is_active' => true,
            'description' => $data['description'] ?? null,
        ]);
    }

    /**
     * Remove a firewall rule from the server.
     */
    public function removeRule(Server $server, FirewallRule $rule): bool
    {
        $command = $this->buildUfwDeleteCommand($rule);
        $output = $this->connection->execute($server, "sudo {$command} 2>&1");

        $rule->delete();

        return true;
    }

    /**
     * Enable the firewall on the server.
     */
    public function enableFirewall(Server $server): bool
    {
        $output = $this->connection->execute($server, 'sudo ufw --force enable 2>&1');

        return str_contains($output, 'active') || str_contains($output, 'enabled');
    }

    /**
     * Disable the firewall on the server.
     */
    public function disableFirewall(Server $server): bool
    {
        $output = $this->connection->execute($server, 'sudo ufw disable 2>&1');

        return str_contains($output, 'disabled') || str_contains($output, 'stopped');
    }

    /**
     * Get the current firewall status.
     */
    public function getStatus(Server $server): array
    {
        $output = $this->connection->execute($server, 'sudo ufw status verbose 2>&1');

        $active = str_contains($output, 'Status: active');

        return [
            'active' => $active,
            'raw_output' => $output,
        ];
    }

    /**
     * Sync database rules with actual UFW rules on the server.
     */
    public function syncRules(Server $server): bool
    {
        // Reset UFW and re-apply all rules from the database
        $this->connection->execute($server, 'sudo ufw --force reset 2>&1');

        // Set default policies
        $this->connection->execute($server, 'sudo ufw default deny incoming 2>&1');
        $this->connection->execute($server, 'sudo ufw default allow outgoing 2>&1');

        // Re-apply all active rules from the database
        $rules = $server->firewallRules()->where('is_active', true)->get();

        foreach ($rules as $rule) {
            $command = $this->buildUfwCommand($rule->toArray());
            $this->connection->execute($server, "sudo {$command} 2>&1");
        }

        // Re-enable the firewall
        $this->connection->execute($server, 'sudo ufw --force enable 2>&1');

        return true;
    }

    /**
     * Build a UFW command from rule data.
     */
    protected function buildUfwCommand(array $data): string
    {
        $action = $data['rule_type'] === 'allow' ? 'allow' : 'deny';
        $direction = $data['direction'] ?? 'in';
        $protocol = $data['protocol'] ?? 'tcp';
        $port = $data['port'];

        $command = "ufw {$action}";

        if ($direction === 'in' && !empty($data['from_ip'])) {
            $command .= " from {$data['from_ip']}";
        }

        if ($direction === 'out' && !empty($data['to_ip'])) {
            $command .= " to {$data['to_ip']}";
        }

        $command .= " proto {$protocol} port {$port}";

        return $command;
    }

    /**
     * Build a UFW delete command from a rule.
     */
    protected function buildUfwDeleteCommand(FirewallRule $rule): string
    {
        $action = $rule->rule_type === 'allow' ? 'allow' : 'deny';
        $protocol = $rule->protocol ?? 'tcp';
        $port = $rule->port;

        $command = "ufw delete {$action}";

        if ($rule->direction === 'in' && $rule->from_ip) {
            $command .= " from {$rule->from_ip}";
        }

        if ($rule->direction === 'out' && $rule->to_ip) {
            $command .= " to {$rule->to_ip}";
        }

        $command .= " proto {$protocol} port {$port}";

        return $command;
    }
}
