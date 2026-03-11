<?php

namespace App\Services;

use App\Models\Deployment;
use App\Models\WebApp;
use Exception;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class DeploymentService
{
    public function __construct(
        protected ServerConnectionService $connection,
    ) {}

    /**
     * Deploy a web application.
     */
    public function deploy(WebApp $webApp, ?string $commitHash = null): Deployment
    {
        $server = $webApp->server;

        $deployment = Deployment::create([
            'web_app_id' => $webApp->id,
            'user_id' => Auth::id(),
            'server_id' => $server->id,
            'commit_hash' => $commitHash,
            'branch' => $webApp->repository_branch ?? 'main',
            'status' => 'pending',
            'started_at' => now(),
        ]);

        try {
            $deployment->update(['status' => 'in_progress']);

            $deployPath = $webApp->root_directory;
            $repoUrl = $webApp->repository_url;
            $branch = $webApp->repository_branch ?? 'main';
            $output = '';

            // Pull latest code
            if ($commitHash) {
                $output .= $this->connection->execute($server, "cd {$deployPath} && git fetch origin && git checkout {$commitHash} 2>&1");
            } else {
                $output .= $this->connection->execute($server, "cd {$deployPath} && git pull origin {$branch} 2>&1");
            }

            // Get the current commit info
            $currentHash = trim($this->connection->execute($server, "cd {$deployPath} && git rev-parse HEAD 2>&1"));
            $commitMessage = trim($this->connection->execute($server, "cd {$deployPath} && git log -1 --pretty=%B 2>&1"));

            // Run deploy script if defined
            if ($webApp->deploy_script) {
                $output .= "\n--- Running deploy script ---\n";
                $output .= $this->connection->execute($server, "cd {$deployPath} && {$webApp->deploy_script} 2>&1");
            }

            $deployment->update([
                'status' => 'success',
                'commit_hash' => $currentHash ?: $commitHash,
                'commit_message' => $commitMessage ?: null,
                'output' => $output,
                'completed_at' => now(),
            ]);

            $webApp->update(['status' => 'active']);
        } catch (Exception $e) {
            Log::error("Deployment failed for web app [{$webApp->name}]", [
                'error' => $e->getMessage(),
            ]);

            $deployment->update([
                'status' => 'failed',
                'error_output' => $e->getMessage(),
                'completed_at' => now(),
            ]);

            throw $e;
        }

        return $deployment->fresh();
    }

    /**
     * Rollback to a previous deployment.
     */
    public function rollback(Deployment $deployment): Deployment
    {
        $webApp = $deployment->webApp;
        $server = $webApp->server;

        if (!$deployment->commit_hash) {
            throw new Exception('Cannot rollback: no commit hash found for the deployment.');
        }

        $rollbackDeployment = Deployment::create([
            'web_app_id' => $webApp->id,
            'user_id' => Auth::id(),
            'server_id' => $server->id,
            'commit_hash' => $deployment->commit_hash,
            'commit_message' => "Rollback to {$deployment->commit_hash}",
            'branch' => $deployment->branch,
            'status' => 'in_progress',
            'started_at' => now(),
        ]);

        try {
            $deployPath = $webApp->root_directory;
            $output = $this->connection->execute(
                $server,
                "cd {$deployPath} && git checkout {$deployment->commit_hash} 2>&1"
            );

            // Re-run deploy script
            if ($webApp->deploy_script) {
                $output .= "\n--- Running deploy script ---\n";
                $output .= $this->connection->execute($server, "cd {$deployPath} && {$webApp->deploy_script} 2>&1");
            }

            $rollbackDeployment->update([
                'status' => 'success',
                'output' => $output,
                'completed_at' => now(),
            ]);

            $deployment->update(['rolled_back_at' => now()]);
        } catch (Exception $e) {
            $rollbackDeployment->update([
                'status' => 'failed',
                'error_output' => $e->getMessage(),
                'completed_at' => now(),
            ]);

            throw $e;
        }

        return $rollbackDeployment->fresh();
    }

    /**
     * Get the deployment log output.
     */
    public function getDeploymentLog(Deployment $deployment): string
    {
        $log = '';

        if ($deployment->output) {
            $log .= $deployment->output;
        }

        if ($deployment->error_output) {
            $log .= "\n--- ERRORS ---\n" . $deployment->error_output;
        }

        return $log;
    }
}
