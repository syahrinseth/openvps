<?php

namespace App\Services;

use App\Models\Server;
use phpseclib3\Net\SSH2;
use phpseclib3\Net\SFTP;
use phpseclib3\Crypt\PublicKeyLoader;
use Exception;
use Illuminate\Support\Facades\Log;

class ServerConnectionService
{
    /**
     * Establish an SSH connection to a server.
     */
    public function connect(Server $server): SSH2
    {
        $ssh = new SSH2($server->ip_address, $server->ssh_port ?? 22);
        $ssh->setTimeout(30);

        $authenticated = false;

        if ($server->ssh_private_key) {
            $key = PublicKeyLoader::load($server->ssh_private_key, $server->ssh_key_passphrase ?? false);
            $authenticated = $ssh->login($server->ssh_user, $key);
        } elseif ($server->ssh_password) {
            $authenticated = $ssh->login($server->ssh_user, $server->ssh_password);
        }

        if (!$authenticated) {
            throw new Exception("Failed to authenticate to server [{$server->name}] at {$server->ip_address}");
        }

        return $ssh;
    }

    /**
     * Execute a command on the server.
     */
    public function execute(Server $server, string $command): string
    {
        $ssh = $this->connect($server);

        $output = $ssh->exec($command);

        if ($ssh->getExitStatus() !== 0) {
            $stderr = $ssh->getStdError();
            Log::warning("Command failed on server [{$server->name}]: {$command}", [
                'exit_status' => $ssh->getExitStatus(),
                'stderr' => $stderr,
                'stdout' => $output,
            ]);
        }

        return $output;
    }

    /**
     * Execute a command on the server and return both output and exit status.
     *
     * @return array{output: string, exit_status: int}
     */
    public function executeWithStatus(Server $server, string $command): array
    {
        $ssh = $this->connect($server);

        $output = $ssh->exec($command);
        $exitStatus = (int) $ssh->getExitStatus();

        if ($exitStatus !== 0) {
            $stderr = $ssh->getStdError();
            Log::warning("Command failed on server [{$server->name}]: {$command}", [
                'exit_status' => $exitStatus,
                'stderr' => $stderr,
                'stdout' => $output,
            ]);
        }

        return [
            'output' => $output,
            'exit_status' => $exitStatus,
        ];
    }

    /**
     * Upload a file to the server.
     */
    public function upload(Server $server, string $localPath, string $remotePath): bool
    {
        $sftp = new SFTP($server->ip_address, $server->ssh_port ?? 22);
        $sftp->setTimeout(30);

        $authenticated = false;

        if ($server->ssh_private_key) {
            $key = PublicKeyLoader::load($server->ssh_private_key, $server->ssh_key_passphrase ?? false);
            $authenticated = $sftp->login($server->ssh_user, $key);
        } elseif ($server->ssh_password) {
            $authenticated = $sftp->login($server->ssh_user, $server->ssh_password);
        }

        if (!$authenticated) {
            throw new Exception("Failed to authenticate SFTP to server [{$server->name}]");
        }

        return $sftp->put($remotePath, $localPath, SFTP::SOURCE_LOCAL_FILE);
    }

    /**
     * Download a file from the server.
     */
    public function download(Server $server, string $remotePath, string $localPath): bool
    {
        $sftp = new SFTP($server->ip_address, $server->ssh_port ?? 22);
        $sftp->setTimeout(30);

        $authenticated = false;

        if ($server->ssh_private_key) {
            $key = PublicKeyLoader::load($server->ssh_private_key, $server->ssh_key_passphrase ?? false);
            $authenticated = $sftp->login($server->ssh_user, $key);
        } elseif ($server->ssh_password) {
            $authenticated = $sftp->login($server->ssh_user, $server->ssh_password);
        }

        if (!$authenticated) {
            throw new Exception("Failed to authenticate SFTP to server [{$server->name}]");
        }

        return $sftp->get($remotePath, $localPath);
    }

    /**
     * Test SSH connection using raw credentials (no saved Server model).
     */
    public function testConnectionWithCredentials(
        string $ipAddress,
        int $port,
        string $sshUser,
        ?string $sshPrivateKey,
        ?string $sshKeyPassphrase,
        ?string $sshPassword,
    ): bool {
        try {
            $ssh = new SSH2($ipAddress, $port);
            $ssh->setTimeout(30);

            $authenticated = false;

            if ($sshPrivateKey) {
                $key = PublicKeyLoader::load($sshPrivateKey, $sshKeyPassphrase ?? false);
                $authenticated = $ssh->login($sshUser, $key);
            } elseif ($sshPassword) {
                $authenticated = $ssh->login($sshUser, $sshPassword);
            }

            if (!$authenticated) {
                return false;
            }

            $output = $ssh->exec('echo "connection_ok"');

            return str_contains(trim($output), 'connection_ok');
        } catch (Exception $e) {
            Log::error("Credential-based connection test failed for {$ipAddress}: {$e->getMessage()}");

            return false;
        }
    }

    /**
     * Test SSH connection to a server.
     */
    public function testConnection(Server $server): bool
    {
        try {
            $ssh = $this->connect($server);
            $output = $ssh->exec('echo "connection_ok"');

            return str_contains(trim($output), 'connection_ok');
        } catch (Exception $e) {
            Log::error("Connection test failed for server [{$server->name}]: {$e->getMessage()}");

            return false;
        }
    }
}
