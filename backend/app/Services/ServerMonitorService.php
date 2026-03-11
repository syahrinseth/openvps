<?php

namespace App\Services;

use App\Models\Server;
use App\Models\ServerMetric;
use Exception;
use Illuminate\Support\Facades\Log;

class ServerMonitorService
{
    public function __construct(
        protected ServerConnectionService $connection,
    ) {}

    /**
     * Collect and store server metrics.
     */
    public function collectMetrics(Server $server): ServerMetric
    {
        $metrics = $this->getResourceUsage($server);

        return ServerMetric::create([
            'server_id' => $server->id,
            'cpu_usage' => $metrics['cpu_usage'],
            'memory_usage' => $metrics['memory_usage'],
            'memory_total' => $metrics['memory_total'],
            'disk_usage' => $metrics['disk_usage'],
            'disk_total' => $metrics['disk_total'],
            'network_in' => $metrics['network_in'],
            'network_out' => $metrics['network_out'],
            'load_average_1' => $metrics['load_average_1'],
            'load_average_5' => $metrics['load_average_5'],
            'load_average_15' => $metrics['load_average_15'],
            'recorded_at' => now(),
        ]);
    }

    /**
     * Get the overall server status.
     */
    public function getServerStatus(Server $server): array
    {
        try {
            $uptime = trim($this->connection->execute($server, 'uptime -p 2>/dev/null || uptime'));
            $hostname = trim($this->connection->execute($server, 'hostname'));
            $os = trim($this->connection->execute($server, 'cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\''));
            $kernel = trim($this->connection->execute($server, 'uname -r'));

            return [
                'online' => true,
                'hostname' => $hostname,
                'uptime' => $uptime,
                'os' => $os,
                'kernel' => $kernel,
            ];
        } catch (Exception $e) {
            return [
                'online' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get current resource usage from the server.
     */
    public function getResourceUsage(Server $server): array
    {
        // CPU usage
        $cpuOutput = trim($this->connection->execute(
            $server,
            "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}'"
        ));
        $cpuUsage = is_numeric($cpuOutput) ? (float) $cpuOutput : 0.0;

        // Memory
        $memOutput = $this->connection->execute($server, "free -m | awk 'NR==2{print \$2,\$3}'");
        $memParts = explode(' ', trim($memOutput));
        $memoryTotal = isset($memParts[0]) && is_numeric($memParts[0]) ? (int) $memParts[0] : 0;
        $memoryUsed = isset($memParts[1]) && is_numeric($memParts[1]) ? (int) $memParts[1] : 0;
        $memoryUsage = $memoryTotal > 0 ? round(($memoryUsed / $memoryTotal) * 100, 2) : 0;

        // Disk
        $diskOutput = $this->connection->execute($server, "df -BM / | awk 'NR==2{print \$2,\$3}'");
        $diskParts = explode(' ', trim($diskOutput));
        $diskTotal = isset($diskParts[0]) ? (int) str_replace('M', '', $diskParts[0]) : 0;
        $diskUsed = isset($diskParts[1]) ? (int) str_replace('M', '', $diskParts[1]) : 0;
        $diskUsage = $diskTotal > 0 ? round(($diskUsed / $diskTotal) * 100, 2) : 0;

        // Network (bytes received/sent on primary interface)
        $networkOutput = $this->connection->execute(
            $server,
            "cat /proc/net/dev | awk 'NR>2{if(\$1 !~ /lo/){split(\$1,a,\":\"); print a[1], \$2, \$10}}' | head -1"
        );
        $networkParts = explode(' ', trim($networkOutput));
        $networkIn = isset($networkParts[1]) && is_numeric($networkParts[1]) ? (int) $networkParts[1] : 0;
        $networkOut = isset($networkParts[2]) && is_numeric($networkParts[2]) ? (int) $networkParts[2] : 0;

        // Load averages
        $loadOutput = trim($this->connection->execute($server, "cat /proc/loadavg | awk '{print \$1,\$2,\$3}'"));
        $loadParts = explode(' ', $loadOutput);

        return [
            'cpu_usage' => $cpuUsage,
            'memory_usage' => $memoryUsage,
            'memory_total' => $memoryTotal,
            'disk_usage' => $diskUsage,
            'disk_total' => $diskTotal,
            'network_in' => $networkIn,
            'network_out' => $networkOut,
            'load_average_1' => isset($loadParts[0]) && is_numeric($loadParts[0]) ? (float) $loadParts[0] : 0,
            'load_average_5' => isset($loadParts[1]) && is_numeric($loadParts[1]) ? (float) $loadParts[1] : 0,
            'load_average_15' => isset($loadParts[2]) && is_numeric($loadParts[2]) ? (float) $loadParts[2] : 0,
        ];
    }
}
