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
        protected LocalDeploymentService $localDeployment,
    ) {}

    /**
     * Deploy a web application.
     * Branches on server->is_local — Ref: TRAEFIK_MIGRATION_PLAN.md Phase 3.6
     */
    public function deploy(WebApp $webApp, ?string $commitHash = null): Deployment
    {
        if ($webApp->server->is_local) {
            return $this->localDeployment->deploy($webApp, $commitHash);
        }

        return $this->deployRemote($webApp, $commitHash);
    }

    /**
     * Rollback to a previous deployment.
     * Branches on server->is_local.
     */
    public function rollback(Deployment $deployment): Deployment
    {
        if ($deployment->webApp->server->is_local) {
            return $this->localDeployment->rollback($deployment);
        }

        return $this->rollbackRemote($deployment);
    }

    /**
     * Remote SSH deploy (original implementation).
     */
    protected function deployRemote(WebApp $webApp, ?string $commitHash = null): Deployment
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

        // Track temp key path so we can clean it up on failure
        $deployKeyPath = null;

        try {
            $deployment->update(['status' => 'in_progress']);
            broadcast(new DeploymentUpdated($deployment->fresh()))->toOthers();

            $deployPath = $webApp->deploy_path;
            $branch     = $webApp->git_branch ?? 'main';
            $safeBranch = escapeshellarg($branch);
            $output     = '';

            if (!empty($webApp->git_deploy_key)) {
                // ── SSH deploy key ───────────────────────────────────────────
                $deployKeyPath  = '/tmp/openvps_deploy_key_' . uniqid();
                $safeKeyPath    = escapeshellarg($deployKeyPath);
                $safeEncoded    = escapeshellarg(base64_encode($webApp->git_deploy_key));
                $gitSsh         = escapeshellarg("ssh -i {$deployKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null");
                $sshRemote      = escapeshellarg($this->toSshUrl($webApp->git_repository));

                $this->connection->execute($server,
                    "echo {$safeEncoded} | base64 -d > {$safeKeyPath} && chmod 600 {$safeKeyPath}"
                );

                if ($commitHash) {
                    $safeHash = escapeshellarg($commitHash);
                    $output .= $this->connection->execute($server,
                        "cd {$deployPath} && GIT_SSH_COMMAND={$gitSsh} git fetch {$sshRemote} && git checkout {$safeHash} 2>&1"
                    );
                } else {
                    $output .= $this->connection->execute($server,
                        "cd {$deployPath} && GIT_SSH_COMMAND={$gitSsh} git pull {$sshRemote} {$safeBranch} 2>&1"
                    );
                }

                $this->connection->execute($server, "rm -f {$safeKeyPath} 2>/dev/null || true");
                $deployKeyPath = null; // mark cleaned up
            } else {
                // ── HTTPS — optional PAT injection ───────────────────────────
                $remoteUrl = $webApp->git_repository;
                if (!empty($webApp->git_token)) {
                    $remoteUrl = preg_replace(
                        '#^(https?://)#',
                        '$1' . rawurlencode($webApp->git_token) . '@',
                        $remoteUrl
                    );
                }
                $safeRemote = escapeshellarg($remoteUrl);

                if ($commitHash) {
                    $safeHash = escapeshellarg($commitHash);
                    $output .= $this->connection->execute($server,
                        "cd {$deployPath} && git fetch {$safeRemote} && git checkout {$safeHash} 2>&1"
                    );
                } else {
                    $output .= $this->connection->execute($server,
                        "cd {$deployPath} && git pull {$safeRemote} {$safeBranch} 2>&1"
                    );
                }
            }

            // Write .env file from environment_variables if set
            if (!empty($webApp->environment_variables)) {
                $safeEnvPath    = escapeshellarg("{$deployPath}/.env");
                $safeEnvEncoded = escapeshellarg(base64_encode($webApp->environment_variables));
                $this->connection->execute($server,
                    "echo {$safeEnvEncoded} | base64 -d > {$safeEnvPath}"
                );
                $output .= "\n--- .env written ---\n";
            }

            // Get the current commit info
            $currentHash   = trim($this->connection->execute($server, "cd {$deployPath} && git rev-parse HEAD 2>&1"));
            $commitMessage = trim($this->connection->execute($server, "cd {$deployPath} && git log -1 --pretty=%B 2>&1"));

            // Run deploy script if defined (docker compose up -d for docker-based apps)
            if ($webApp->docker_compose_path) {
                $output .= "\n--- Running docker compose up ---\n";
                $composeDir = dirname($webApp->docker_compose_path);
                $output .= $this->connection->execute($server, "cd {$composeDir} && docker compose up -d --build 2>&1");
            }

            // Post-deploy: run composer install for Laravel apps using the composer Docker image.
            // This mounts the deploy path into a throwaway composer:2 container so we have no
            // dependency on composer being present in the app container itself.
            if ($webApp->app_type === 'laravel' && !empty($deployPath)) {
                try {
                    $safeDeployPath = escapeshellarg($deployPath);
                    $output .= "\n--- composer install ---\n";
                    $output .= $this->connection->execute($server,
                        "docker run --rm -v {$safeDeployPath}:/app -w /app composer:2 install --no-dev --optimize-autoloader --ignore-platform-reqs 2>&1"
                    );
                } catch (Exception $e) {
                    $output .= "\n[WARNING] composer install failed: " . $e->getMessage() . "\n";
                    Log::warning("composer install failed for [{$webApp->name}]", ['error' => $e->getMessage()]);
                }
            }

            $deployment->update([
                'status'         => 'success',
                'commit_hash'    => $currentHash ?: $commitHash,
                'commit_message' => $commitMessage ?: null,
                'output'         => $output,
                'completed_at'   => now(),
            ]);

            $webApp->update(['status' => 'running']);

            $freshDeployment = $deployment->fresh();
            broadcast(new DeploymentUpdated($freshDeployment))->toOthers();

            // Send success email to the triggering user
            $this->sendDeploymentEmail($freshDeployment, 'success');
        } catch (Exception $e) {
            // Clean up temp deploy key if the chain failed mid-way
            if ($deployKeyPath) {
                $this->connection->execute($server, "rm -f " . escapeshellarg($deployKeyPath) . " 2>/dev/null || true");
            }

            Log::error("Deployment failed for web app [{$webApp->name}]", [
                'error' => $e->getMessage(),
            ]);

            $deployment->update([
                'status'       => 'failed',
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
     * Remote SSH rollback (original implementation).
     */
    protected function rollbackRemote(Deployment $deployment): Deployment
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

    /**
     * Convert an HTTPS repository URL to SSH format so that GIT_SSH_COMMAND
     * is honoured by git (git ignores it for HTTPS URLs).
     *
     * https://github.com/user/repo.git  →  git@github.com:user/repo.git
     */
    private function toSshUrl(string $url): string
    {
        if (str_starts_with($url, 'git@') || str_starts_with($url, 'ssh://')) {
            return $url;
        }
        return preg_replace('#^https?://([^/]+)/(.+)$#', 'git@$1:$2', $url);
    }
}
