<?php

namespace App\Services;

use App\Events\DeploymentUpdated;
use App\Mail\DeploymentMail;
use App\Models\Deployment;
use App\Models\User;
use App\Models\WebApp;
use Exception;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

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
            'branch' => $webApp->git_branch ?? 'main',
            'status' => 'pending',
            'started_at' => now(),
        ]);

        // Notify: deployment started
        broadcast(new DeploymentUpdated($deployment))->toOthers();

        try {
            $deployment->update(['status' => 'in_progress']);
            broadcast(new DeploymentUpdated($deployment->fresh()))->toOthers();

            $deployPath = $webApp->deploy_path;
            $branch = $webApp->git_branch ?? 'main';
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

            // Run deploy script if defined (docker compose up -d for docker-based apps)
            if ($webApp->docker_compose_path) {
                $output .= "\n--- Running docker compose up ---\n";
                $composeDir = dirname($webApp->docker_compose_path);
                $output .= $this->connection->execute($server, "cd {$composeDir} && docker compose up -d --build 2>&1");
            }

            $deployment->update([
                'status' => 'success',
                'commit_hash' => $currentHash ?: $commitHash,
                'commit_message' => $commitMessage ?: null,
                'output' => $output,
                'completed_at' => now(),
            ]);

            $webApp->update(['status' => 'running']);

            $freshDeployment = $deployment->fresh();
            broadcast(new DeploymentUpdated($freshDeployment))->toOthers();

            // Send success email to the triggering user
            $this->sendDeploymentEmail($freshDeployment, 'success');
        } catch (Exception $e) {
            Log::error("Deployment failed for web app [{$webApp->name}]", [
                'error' => $e->getMessage(),
            ]);

            $deployment->update([
                'status' => 'failed',
                'error_output' => $e->getMessage(),
                'completed_at' => now(),
            ]);

            $freshDeployment = $deployment->fresh();
            broadcast(new DeploymentUpdated($freshDeployment))->toOthers();

            // Send failure email
            $this->sendDeploymentEmail($freshDeployment, 'failed');

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

        broadcast(new DeploymentUpdated($rollbackDeployment))->toOthers();

        try {
            $deployPath = $webApp->deploy_path;
            $output = $this->connection->execute(
                $server,
                "cd {$deployPath} && git checkout {$deployment->commit_hash} 2>&1"
            );

            // Re-run docker compose if applicable
            if ($webApp->docker_compose_path) {
                $output .= "\n--- Running docker compose up ---\n";
                $composeDir = dirname($webApp->docker_compose_path);
                $output .= $this->connection->execute($server, "cd {$composeDir} && docker compose up -d --build 2>&1");
            }

            $rollbackDeployment->update([
                'status' => 'success',
                'output' => $output,
                'completed_at' => now(),
            ]);

            $deployment->update(['rolled_back_at' => now()]);

            $freshRollback = $rollbackDeployment->fresh();
            broadcast(new DeploymentUpdated($freshRollback))->toOthers();

            $this->sendDeploymentEmail($freshRollback, 'success');
        } catch (Exception $e) {
            $rollbackDeployment->update([
                'status' => 'failed',
                'error_output' => $e->getMessage(),
                'completed_at' => now(),
            ]);

            $freshRollback = $rollbackDeployment->fresh();
            broadcast(new DeploymentUpdated($freshRollback))->toOthers();

            $this->sendDeploymentEmail($freshRollback, 'failed');

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

    /**
     * Send a deployment status email to the user who triggered the deployment.
     */
    protected function sendDeploymentEmail(Deployment $deployment, string $status): void
    {
        try {
            if (!$deployment->user_id) {
                return;
            }

            $user = User::find($deployment->user_id);
            if (!$user) {
                return;
            }

            Mail::to($user->email)->queue(new DeploymentMail($deployment, $status));
        } catch (Exception $e) {
            Log::warning('Failed to send deployment email', ['error' => $e->getMessage()]);
        }
    }
}
