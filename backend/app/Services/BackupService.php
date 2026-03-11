<?php

namespace App\Services;

use App\Models\Backup;
use App\Models\Database_;
use App\Models\Server;
use App\Models\WebApp;
use Exception;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Log;

class BackupService
{
    public function __construct(
        protected ServerConnectionService $connection,
        protected DatabaseService $databaseService,
    ) {}

    /**
     * Create a backup on the server.
     */
    public function createBackup(Server $server, string $type, ?WebApp $webApp = null, ?Database_ $database = null): Backup
    {
        $timestamp = now()->format('Y-m-d_His');
        $backupDir = "/home/{$server->ssh_user}/backups";

        $this->connection->execute($server, "mkdir -p {$backupDir}/{$type}s");

        if ($type === 'database' && $database) {
            return $this->databaseService->backupDatabase($server, $database);
        }

        if ($type === 'application' && $webApp) {
            return $this->backupApplication($server, $webApp, $timestamp, $backupDir);
        }

        if ($type === 'full') {
            return $this->backupFull($server, $timestamp, $backupDir);
        }

        throw new Exception("Invalid backup type: {$type}");
    }

    /**
     * Restore a backup.
     */
    public function restoreBackup(Backup $backup): bool
    {
        $server = $backup->server;

        if ($backup->type === 'database' && $backup->database) {
            $dbName = $backup->database->name;
            $output = $this->connection->execute(
                $server,
                "zcat {$backup->path} | sudo mysql {$dbName} 2>&1"
            );

            return !str_contains($output, 'ERROR');
        }

        if ($backup->type === 'application' && $backup->webApp) {
            $deployPath = $backup->webApp->root_directory;
            $output = $this->connection->execute(
                $server,
                "cd {$deployPath} && tar -xzf {$backup->path} 2>&1"
            );

            return !str_contains($output, 'Error');
        }

        throw new Exception("Unsupported restore type: {$backup->type}");
    }

    /**
     * Delete a backup from the server and database.
     */
    public function deleteBackup(Backup $backup): bool
    {
        $server = $backup->server;

        $this->connection->execute($server, "rm -f {$backup->path} 2>&1");
        $backup->delete();

        return true;
    }

    /**
     * List all backups for a server.
     */
    public function listBackups(Server $server): Collection
    {
        return $server->backups()->orderBy('created_at', 'desc')->get();
    }

    /**
     * Backup an application's files.
     */
    protected function backupApplication(Server $server, WebApp $webApp, string $timestamp, string $backupDir): Backup
    {
        $filename = "{$webApp->name}_{$timestamp}.tar.gz";
        $remotePath = "{$backupDir}/applications/{$filename}";
        $deployPath = $webApp->root_directory;

        $this->connection->execute($server, "mkdir -p {$backupDir}/applications");
        $this->connection->execute($server, "tar -czf {$remotePath} -C {$deployPath} . 2>&1");

        $sizeOutput = trim($this->connection->execute($server, "stat -c%s {$remotePath} 2>/dev/null || echo 0"));
        $sizeMb = is_numeric($sizeOutput) ? round((int) $sizeOutput / 1024 / 1024, 2) : 0;

        return Backup::create([
            'server_id' => $server->id,
            'web_app_id' => $webApp->id,
            'name' => $filename,
            'type' => 'application',
            'status' => 'completed',
            'disk' => 'server',
            'path' => $remotePath,
            'size_mb' => $sizeMb,
            'started_at' => now(),
            'completed_at' => now(),
        ]);
    }

    /**
     * Create a full server backup.
     */
    protected function backupFull(Server $server, string $timestamp, string $backupDir): Backup
    {
        $filename = "full_backup_{$timestamp}.tar.gz";
        $remotePath = "{$backupDir}/fulls/{$filename}";

        $this->connection->execute($server, "mkdir -p {$backupDir}/fulls");
        $this->connection->execute(
            $server,
            "sudo tar -czf {$remotePath} --exclude='/proc' --exclude='/sys' --exclude='/dev' --exclude='/tmp' --exclude='/run' --exclude='/mnt' /home /etc/nginx /var/www 2>&1"
        );

        $sizeOutput = trim($this->connection->execute($server, "stat -c%s {$remotePath} 2>/dev/null || echo 0"));
        $sizeMb = is_numeric($sizeOutput) ? round((int) $sizeOutput / 1024 / 1024, 2) : 0;

        return Backup::create([
            'server_id' => $server->id,
            'name' => $filename,
            'type' => 'full',
            'status' => 'completed',
            'disk' => 'server',
            'path' => $remotePath,
            'size_mb' => $sizeMb,
            'started_at' => now(),
            'completed_at' => now(),
        ]);
    }
}
