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
     *  3. Load .env.example into environment_variables if not set, write .env
     *  4. Generate docker-compose.yml from a local stub if not present
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
        $log .= $this->setupEnvFile($webApp, $deployPath);
        $log .= $this->generateDockerCompose($webApp, $deployPath);
        $log .= $this->generateDockerfile($webApp, $deployPath);

        $webApp->update(['status' => 'stopped']);

        return ['log' => $log];
    }

    /**
     * Deploy a locally-hosted web app (git pull + write .env + docker compose up -d --build).
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

            // Determine auth mode and pull latest code
            if (!empty($webApp->git_deploy_key)) {
                // Deploy key auth — write temp key for git operations
                $sshRemote = $this->toSshUrl($webApp->git_repository); // HTTPS → git@HOST:PATH
                $keyPath = tempnam(sys_get_temp_dir(), 'deploy_key_');
                try {
                    $encoded  = base64_encode($webApp->git_deploy_key);
                    $writeCmd = "echo {$encoded} | base64 -d > " . escapeshellarg($keyPath) . " && chmod 600 " . escapeshellarg($keyPath);
                    shell_exec($writeCmd);

                    $sshCmd = "ssh -i {$keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null";
                    $env    = ['GIT_SSH_COMMAND' => $sshCmd] + $_ENV;

                    if ($commitHash) {
                        $output .= $this->runWithEnv(['git', 'fetch', $sshRemote], $deployPath, $env);
                        $output .= $this->runWithEnv(['git', 'checkout', $commitHash], $deployPath, $env);
                    } else {
                        $output .= $this->runWithEnv(['git', 'pull', $sshRemote, $branch], $deployPath, $env);
                    }
                } finally {
                    if (file_exists($keyPath)) {
                        @unlink($keyPath);
                    }
                }
            } else {
                // PAT or public auth
                $remoteUrl = $webApp->git_repository;
                if (!empty($webApp->git_token)) {
                    $remoteUrl = preg_replace('#^(https?://)#', '$1' . rawurlencode($webApp->git_token) . '@', $remoteUrl);
                }

                if ($commitHash) {
                    $output .= $this->run(['git', 'fetch', $remoteUrl], $deployPath);
                    $output .= $this->run(['git', 'checkout', $commitHash], $deployPath);
                } else {
                    $output .= $this->run(['git', 'pull', $remoteUrl, $branch], $deployPath);
                }
            }

            // Write .env file from environment_variables if set
            if (!empty($webApp->environment_variables)) {
                file_put_contents("{$deployPath}/.env", $webApp->environment_variables);
                $output .= "\n--- .env written ---\n";
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

                // Post-deploy: run composer install for Laravel apps using the composer Docker image.
                // This mounts the deploy path into a throwaway composer:2 container so we have no
                // dependency on composer being present in the app container itself.
                if ($webApp->app_type === 'laravel') {
                    try {
                        $output .= "\n--- composer install ---\n";
                        $output .= $this->run(
                            ['docker', 'run', '--rm', '-v', "{$deployPath}:/app", '-w', '/app', 'composer:2', 'install', '--no-dev', '--optimize-autoloader', '--ignore-platform-reqs'],
                            $composeDir
                        );
                    } catch (Exception $e) {
                        $output .= "\n[WARNING] composer install failed: " . $e->getMessage() . "\n";
                        Log::warning("composer install failed for [{$webApp->name}]", ['error' => $e->getMessage()]);
                    }
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
     * If environment_variables is not set on the web app, read .env.example
     * from the deploy path and store it as the default. Then write .env to disk.
     */
    private function setupEnvFile(WebApp $webApp, string $deployPath): string
    {
        $log            = "==> Setting up .env file...\n";
        $envPath        = "{$deployPath}/.env";
        $envExamplePath = "{$deployPath}/.env.example";

        // Auto-populate from .env.example if environment_variables not set yet
        if (empty($webApp->environment_variables) && file_exists($envExamplePath)) {
            $exampleContent = file_get_contents($envExamplePath);
            if (!empty(trim($exampleContent))) {
                $webApp->update(['environment_variables' => $exampleContent]);
                $log .= "    Loaded .env.example as default environment variables.\n";
            }
        }

        // Write .env if we have content
        if (!empty($webApp->environment_variables)) {
            file_put_contents($envPath, $webApp->environment_variables);
            $log .= "    .env file written to {$envPath}.\n";
        } else {
            $log .= "    No environment variables set — .env not written.\n";
        }

        return $log;
    }

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

    /**
     * Run a local process with a custom environment and return combined stdout+stderr output.
     *
     * @param  string[]             $command
     * @param  array<string,string> $env
     * @throws Exception on non-zero exit code
     */
    private function runWithEnv(array $command, string $cwd, array $env): string
    {
        $process = new Process($command, $cwd, $env, null, self::PROCESS_TIMEOUT);
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

        if (!empty($webApp->git_deploy_key)) {
            // Deploy key auth
            $output = $this->cloneWithDeployKey($webApp, $deployPath, $branch);
        } elseif (!empty($webApp->git_token)) {
            // PAT auth — inject token into HTTPS URL
            $cloneUrl = preg_replace('#^(https?://)#', '$1' . rawurlencode($webApp->git_token) . '@', $repo);
            $output   = $this->run(
                ['git', 'clone', '--branch', $branch, '--single-branch', $cloneUrl, $deployPath],
                sys_get_temp_dir()
            );
        } else {
            // Public clone
            $output = $this->run(
                ['git', 'clone', '--branch', $branch, '--single-branch', $repo, $deployPath],
                sys_get_temp_dir()
            );
        }

        if (!is_dir("{$deployPath}/.git")) {
            throw new Exception("Git clone failed for [{$repo}].\nOutput: {$output}");
        }

        $log .= "    Repository cloned successfully.\n";
        return $log;
    }

    private function cloneWithDeployKey(WebApp $webApp, string $deployPath, string $branch): string
    {
        $repo    = $this->toSshUrl($webApp->git_repository); // HTTPS → git@HOST:PATH
        $keyPath = tempnam(sys_get_temp_dir(), 'deploy_key_');
        try {
            // Write key safely via base64
            $encoded = base64_encode($webApp->git_deploy_key);
            $writeCmd = "echo {$encoded} | base64 -d > " . escapeshellarg($keyPath) . " && chmod 600 " . escapeshellarg($keyPath);
            shell_exec($writeCmd);

            $sshCmd  = "ssh -i {$keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null";
            $env     = ['GIT_SSH_COMMAND' => $sshCmd] + $_ENV;
            $process = new \Symfony\Component\Process\Process(
                ['git', 'clone', '--branch', $branch, '--single-branch', $repo, $deployPath],
                sys_get_temp_dir(),
                $env,
                null,
                self::PROCESS_TIMEOUT
            );
            $process->run();
            $output = $process->getOutput() . $process->getErrorOutput();

            if (!$process->isSuccessful()) {
                throw new Exception(
                    "git clone (deploy key) failed (exit {$process->getExitCode()}):\n{$output}"
                );
            }

            return $output;
        } finally {
            if (file_exists($keyPath)) {
                @unlink($keyPath);
            }
        }
    }

    private function generateDockerfile(WebApp $webApp, string $deployPath): string
    {
        $appType      = $webApp->app_type ?? 'custom';
        $stubPath     = resource_path("stubs/dockerfile/{$appType}");
        $dockerDir    = "{$deployPath}/docker";
        $dockerfilePath = "{$dockerDir}/Dockerfile";
        $log          = "==> Checking for docker/Dockerfile at: {$dockerfilePath}\n";

        // Only generate if a stub exists for this app type
        if (!file_exists($stubPath)) {
            $log .= "    No Dockerfile stub for app type '{$appType}' — skipping.\n";
            return $log;
        }

        if (file_exists($dockerfilePath)) {
            $log .= "    docker/Dockerfile already exists — skipping generation.\n";
            return $log;
        }

        if (!is_dir($dockerDir) && !mkdir($dockerDir, 0755, true) && !is_dir($dockerDir)) {
            throw new Exception("Failed to create docker directory at [{$dockerDir}].");
        }

        $content = file_get_contents($stubPath);
        file_put_contents($dockerfilePath, $content);

        if (!file_exists($dockerfilePath)) {
            throw new Exception("Failed to generate docker/Dockerfile at [{$dockerfilePath}].");
        }

        $log .= "    docker/Dockerfile generated at {$dockerfilePath}.\n";
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

    /**
     * Regenerate the docker-compose.yml from the current app config, overwriting
     * any existing file.  Unlike generateDockerCompose(), this method does NOT skip
     * when the file already exists — it is intended for config changes such as a
     * domain update that must be reflected in the Traefik Host() label.
     *
     * Returns a log string describing what was done.
     */
    public function regenerateDockerCompose(WebApp $webApp): string
    {
        $composePath = $webApp->docker_compose_path;

        if (empty($composePath)) {
            return "==> Skipping compose regeneration: no docker_compose_path set yet.\n";
        }

        $log        = "==> Regenerating docker-compose.yml at: {$composePath}\n";
        $deployPath = dirname($composePath);
        $content    = $this->buildDockerComposeContent($webApp, $deployPath);

        file_put_contents($composePath, $content);

        if (!file_exists($composePath)) {
            throw new Exception("Failed to write docker-compose.yml at [{$composePath}].");
        }

        $log .= "    docker-compose.yml regenerated with domain [{$webApp->domain}].\n";
        return $log;
    }

    protected function buildDockerComposeContent(WebApp $webApp, string $deployPath): string
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

    /**
     * Convert an HTTPS repository URL to SSH format so that GIT_SSH_COMMAND
     * is honoured by git (git ignores GIT_SSH_COMMAND for HTTPS URLs).
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
