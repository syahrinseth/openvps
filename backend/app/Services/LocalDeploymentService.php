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
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

/**
 * Handles deployments for locally-hosted web apps (server->is_local = true).
 * Runs docker compose commands directly on the control plane host instead of
 * over SSH. Traefik discovers containers automatically via Docker labels.
 *
 * Ref: TRAEFIK_MIGRATION_PLAN.md — Phase 3.4
 */
class LocalDeploymentService
{
    private const PROCESS_TIMEOUT = 300; // 5 minutes

    /**
     * Initialize a local web app:
     *  1. Ensure deploy_path exists on the local host
     *  2. Clone the git repository
     *  3. Generate docker-compose.yml from a local stub if not present
     */
    public function setup(WebApp $webApp): array
    {
        $log = '';

        if (empty($webApp->git_repository)) {
            throw new Exception('Git repository URL is required before running setup.');
        }

        if (empty($webApp->deploy_path)) {
            throw new Exception('Deploy path is required before running setup.');
        }

        $deployPath = rtrim($webApp->deploy_path, '/');

        $log .= $this->ensureDeployPath($deployPath);
        $log .= $this->cloneRepository($webApp, $deployPath);
        $log .= $this->generateDockerCompose($webApp, $deployPath);

        $webApp->update(['status' => 'stopped']);

        return ['log' => $log];
    }

    /**
     * Deploy a locally-hosted web app (git pull + docker compose up -d --build).
     */
    public function deploy(WebApp $webApp, ?string $commitHash = null): Deployment
    {
        $server = $webApp->server;

        $deployment = Deployment::create([
            'web_app_id'  => $webApp->id,
            'user_id'     => Auth::id(),
            'server_id'   => $server->id,
            'commit_hash' => $commitHash,
            'branch'      => $webApp->git_branch ?? 'main',
            'status'      => 'pending',
            'started_at'  => now(),
        ]);

        broadcast(new DeploymentUpdated($deployment))->toOthers();

        try {
            $deployment->update(['status' => 'in_progress']);
            broadcast(new DeploymentUpdated($deployment->fresh()))->toOthers();

            $deployPath = $webApp->deploy_path;
            $branch     = $webApp->git_branch ?? 'main';
            $output     = '';

            // Pull latest code
            if ($commitHash) {
                $output .= $this->run(['git', 'fetch', 'origin'], $deployPath);
                $output .= $this->run(['git', 'checkout', $commitHash], $deployPath);
            } else {
                $output .= $this->run(['git', 'pull', 'origin', $branch], $deployPath);
            }

            // Capture current commit info
            $currentHash   = trim($this->run(['git', 'rev-parse', 'HEAD'], $deployPath));
            $commitMessage = trim($this->run(['git', 'log', '-1', '--pretty=%B'], $deployPath));

            // Run docker compose
            if ($webApp->docker_compose_path) {
                $output     .= "\n--- Running docker compose up ---\n";
                $composeDir  = dirname($webApp->docker_compose_path);
                $output     .= $this->run(
                    ['docker', 'compose', '-f', $webApp->docker_compose_path, 'up', '-d', '--build'],
                    $composeDir
                );
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
            $this->sendDeploymentEmail($freshDeployment, 'success');
        } catch (Exception $e) {
            Log::error("Local deployment failed for web app [{$webApp->name}]", [
                'error' => $e->getMessage(),
            ]);

            $deployment->update([
                'status'       => 'failed',
                'error_output' => $e->getMessage(),
                'completed_at' => now(),
            ]);

            $freshDeployment = $deployment->fresh();
            broadcast(new DeploymentUpdated($freshDeployment))->toOthers();
            $this->sendDeploymentEmail($freshDeployment, 'failed');

            throw $e;
        }

        return $deployment->fresh();
    }

    /**
     * Rollback a locally-hosted web app to a previous commit.
     */
    public function rollback(Deployment $deployment): Deployment
    {
        $webApp = $deployment->webApp;
        $server = $webApp->server;

        if (!$deployment->commit_hash) {
            throw new Exception('Cannot rollback: no commit hash found for the deployment.');
        }

        $rollbackDeployment = Deployment::create([
            'web_app_id'     => $webApp->id,
            'user_id'        => Auth::id(),
            'server_id'      => $server->id,
            'commit_hash'    => $deployment->commit_hash,
            'commit_message' => "Rollback to {$deployment->commit_hash}",
            'branch'         => $deployment->branch,
            'status'         => 'in_progress',
            'started_at'     => now(),
        ]);

        broadcast(new DeploymentUpdated($rollbackDeployment))->toOthers();

        try {
            $deployPath = $webApp->deploy_path;
            $output     = $this->run(['git', 'checkout', $deployment->commit_hash], $deployPath);

            if ($webApp->docker_compose_path) {
                $output     .= "\n--- Running docker compose up ---\n";
                $composeDir  = dirname($webApp->docker_compose_path);
                $output     .= $this->run(
                    ['docker', 'compose', '-f', $webApp->docker_compose_path, 'up', '-d', '--build'],
                    $composeDir
                );
            }

            $rollbackDeployment->update([
                'status'       => 'success',
                'output'       => $output,
                'completed_at' => now(),
            ]);

            $deployment->update(['rolled_back_at' => now()]);

            $freshRollback = $rollbackDeployment->fresh();
            broadcast(new DeploymentUpdated($freshRollback))->toOthers();
            $this->sendDeploymentEmail($freshRollback, 'success');
        } catch (Exception $e) {
            $rollbackDeployment->update([
                'status'       => 'failed',
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
     * Start a locally-hosted web app (docker compose up -d).
     */
    public function start(WebApp $webApp): string
    {
        $composeFile = $webApp->docker_compose_path;
        $output = $this->run(
            ['docker', 'compose', '-f', $composeFile, 'up', '-d'],
            dirname($composeFile)
        );
        $webApp->update(['status' => 'running']);
        return $output;
    }

    /**
     * Stop a locally-hosted web app (docker compose down).
     */
    public function stop(WebApp $webApp): string
    {
        $composeFile = $webApp->docker_compose_path;
        $output = $this->run(
            ['docker', 'compose', '-f', $composeFile, 'down'],
            dirname($composeFile)
        );
        $webApp->update(['status' => 'stopped']);
        return $output;
    }

    /**
     * Restart a locally-hosted web app (docker compose restart).
     */
    public function restart(WebApp $webApp): string
    {
        $composeFile = $webApp->docker_compose_path;
        return $this->run(
            ['docker', 'compose', '-f', $composeFile, 'restart'],
            dirname($composeFile)
        );
    }

    // ── Private helpers ────────────────────────────────────────────────────

    /**
     * Run a local process and return combined stdout+stderr output.
     *
     * @param  string[]  $command
     * @throws Exception on non-zero exit code
     */
    private function run(array $command, string $cwd): string
    {
        $process = new Process($command, $cwd, timeout: self::PROCESS_TIMEOUT);
        $process->run();

        $output = $process->getOutput() . $process->getErrorOutput();

        if (!$process->isSuccessful()) {
            throw new Exception(
                "Command [" . implode(' ', $command) . "] failed (exit {$process->getExitCode()}):\n{$output}"
            );
        }

        return $output;
    }

    private function ensureDeployPath(string $deployPath): string
    {
        $log = "==> Creating local deploy directory: {$deployPath}\n";

        if (!is_dir($deployPath) && !mkdir($deployPath, 0755, true) && !is_dir($deployPath)) {
            throw new Exception("Failed to create local deploy directory [{$deployPath}].");
        }

        $log .= "    Directory ready.\n";
        return $log;
    }

    private function cloneRepository(WebApp $webApp, string $deployPath): string
    {
        $repo   = $webApp->git_repository;
        $branch = $webApp->git_branch ?? 'main';
        $log    = "==> Cloning repository: {$repo} (branch: {$branch})\n";

        if (is_dir("{$deployPath}/.git")) {
            $log .= "    Repository already cloned — skipping clone.\n";
            return $log;
        }

        $files = array_diff(scandir($deployPath), ['.', '..']);
        if (!empty($files)) {
            throw new Exception(
                "Deploy path [{$deployPath}] already exists and is not empty. " .
                "Please specify an empty directory."
            );
        }

        $output = $this->run(
            ['git', 'clone', '--branch', $branch, '--single-branch', $repo, $deployPath],
            sys_get_temp_dir()
        );

        if (!is_dir("{$deployPath}/.git")) {
            throw new Exception("Git clone failed for [{$repo}].\nOutput: {$output}");
        }

        $log .= "    Repository cloned successfully.\n";
        return $log;
    }

    private function generateDockerCompose(WebApp $webApp, string $deployPath): string
    {
        $composePath = $webApp->docker_compose_path ?: "{$deployPath}/docker-compose.yml";
        $log         = "==> Checking for docker-compose.yml at: {$composePath}\n";

        if (file_exists($composePath)) {
            $log .= "    docker-compose.yml already exists — skipping generation.\n";
            if (empty($webApp->docker_compose_path)) {
                $webApp->update(['docker_compose_path' => $composePath]);
            }
            return $log;
        }

        $log    .= "    Generating docker-compose.yml from local stub ({$webApp->app_type})...\n";
        $content = $this->buildDockerComposeContent($webApp, $deployPath);

        file_put_contents($composePath, $content);

        if (!file_exists($composePath)) {
            throw new Exception("Failed to generate docker-compose.yml at [{$composePath}].");
        }

        $webApp->update(['docker_compose_path' => $composePath]);
        $log .= "    docker-compose.yml generated at {$composePath}.\n";
        return $log;
    }

    private function buildDockerComposeContent(WebApp $webApp, string $deployPath): string
    {
        $appType  = $webApp->app_type ?? 'custom';
        $stubPath = resource_path("stubs/docker-compose/local/{$appType}.yml");

        if (!file_exists($stubPath)) {
            $stubPath = resource_path('stubs/docker-compose/local/custom.yml');
        }

        $stub    = file_get_contents($stubPath);
        $appName = preg_replace('/[^a-z0-9-]/', '-', strtolower($webApp->name));
        $domain  = $webApp->domain ?? '';

        return str_replace(
            ['{{APP_NAME}}', '{{DOMAIN}}', '{{APP_KEY}}', '{{INTERNAL_PORT}}'],
            [$appName, $domain, 'base64:' . base64_encode(random_bytes(32)), '8080'],
            $stub
        );
    }

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
