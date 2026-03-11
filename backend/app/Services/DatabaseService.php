<?php

namespace App\Services;

use App\Models\Backup;
use App\Models\Database_;
use App\Models\DatabaseUser;
use App\Models\Server;
use Exception;
use Illuminate\Support\Facades\Log;

class DatabaseService
{
    public function __construct(
        protected ServerConnectionService $connection,
    ) {}

    /**
     * Create a new database on the server.
     */
    public function createDatabase(Server $server, string $name, string $charset = 'utf8mb4', string $collation = 'utf8mb4_unicode_ci'): Database_
    {
        $command = "sudo mysql -e \"CREATE DATABASE \`{$name}\` CHARACTER SET {$charset} COLLATE {$collation};\" 2>&1";
        $output = $this->connection->execute($server, $command);

        if (str_contains($output, 'ERROR')) {
            throw new Exception("Failed to create database '{$name}': {$output}");
        }

        return Database_::create([
            'server_id' => $server->id,
            'name' => $name,
            'type' => $server->database_server ?? 'mysql',
            'charset' => $charset,
            'collation' => $collation,
            'size_mb' => 0,
        ]);
    }

    /**
     * Drop a database from the server.
     */
    public function dropDatabase(Server $server, Database_ $database): bool
    {
        $command = "sudo mysql -e \"DROP DATABASE IF EXISTS \`{$database->name}\`;\" 2>&1";
        $output = $this->connection->execute($server, $command);

        if (str_contains($output, 'ERROR')) {
            throw new Exception("Failed to drop database '{$database->name}': {$output}");
        }

        $database->delete();

        return true;
    }

    /**
     * Create a database user with optional privileges on a database.
     */
    public function createUser(
        Server $server,
        string $username,
        string $password,
        ?Database_ $database = null,
        array $privileges = ['ALL']
    ): DatabaseUser {
        $host = 'localhost';

        $command = "sudo mysql -e \"CREATE USER '{$username}'@'{$host}' IDENTIFIED BY '{$password}';\" 2>&1";
        $output = $this->connection->execute($server, $command);

        if (str_contains($output, 'ERROR')) {
            throw new Exception("Failed to create database user '{$username}': {$output}");
        }

        $dbUser = DatabaseUser::create([
            'server_id' => $server->id,
            'database_id' => $database?->id,
            'username' => $username,
            'password' => $password,
            'host' => $host,
            'privileges' => $privileges,
        ]);

        if ($database) {
            $this->grantPrivileges($server, $dbUser, $database, $privileges);
        }

        return $dbUser;
    }

    /**
     * Drop a database user.
     */
    public function dropUser(Server $server, DatabaseUser $user): bool
    {
        $command = "sudo mysql -e \"DROP USER IF EXISTS '{$user->username}'@'{$user->host}';\" 2>&1";
        $output = $this->connection->execute($server, $command);

        if (str_contains($output, 'ERROR')) {
            throw new Exception("Failed to drop database user '{$user->username}': {$output}");
        }

        $user->delete();

        return true;
    }

    /**
     * Grant privileges to a user on a database.
     */
    public function grantPrivileges(Server $server, DatabaseUser $user, Database_ $database, array $privileges): bool
    {
        $privString = implode(', ', $privileges);
        $command = "sudo mysql -e \"GRANT {$privString} ON \`{$database->name}\`.* TO '{$user->username}'@'{$user->host}'; FLUSH PRIVILEGES;\" 2>&1";
        $output = $this->connection->execute($server, $command);

        if (str_contains($output, 'ERROR')) {
            throw new Exception("Failed to grant privileges: {$output}");
        }

        $user->update([
            'database_id' => $database->id,
            'privileges' => $privileges,
        ]);

        return true;
    }

    /**
     * Get the size of a database in MB.
     */
    public function getDatabaseSize(Server $server, Database_ $database): float
    {
        $command = "sudo mysql -N -e \"SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) FROM information_schema.TABLES WHERE table_schema = '{$database->name}';\" 2>&1";
        $output = trim($this->connection->execute($server, $command));

        $sizeMb = is_numeric($output) ? (float) $output : 0.0;

        $database->update(['size_mb' => $sizeMb]);

        return $sizeMb;
    }

    /**
     * Create a backup of a database.
     */
    public function backupDatabase(Server $server, Database_ $database): Backup
    {
        $timestamp = now()->format('Y-m-d_His');
        $filename = "{$database->name}_{$timestamp}.sql.gz";
        $remotePath = "/home/{$server->ssh_user}/backups/databases/{$filename}";

        $this->connection->execute($server, "mkdir -p /home/{$server->ssh_user}/backups/databases");

        $command = "sudo mysqldump {$database->name} | gzip > {$remotePath} 2>&1";
        $this->connection->execute($server, $command);

        // Get file size
        $sizeOutput = trim($this->connection->execute($server, "stat -c%s {$remotePath} 2>/dev/null || echo 0"));
        $sizeMb = is_numeric($sizeOutput) ? round((int) $sizeOutput / 1024 / 1024, 2) : 0;

        return Backup::create([
            'server_id' => $server->id,
            'database_id' => $database->id,
            'name' => $filename,
            'type' => 'database',
            'status' => 'completed',
            'disk' => 'server',
            'path' => $remotePath,
            'size_mb' => $sizeMb,
            'started_at' => now(),
            'completed_at' => now(),
        ]);
    }
}
