<?php

namespace App\Services;

use App\Models\WebApp;
use Exception;
use Illuminate\Support\Facades\Log;

class WebAppSetupService
{
    public function __construct(
        protected ServerConnectionService $connection,
    ) {}

    /**
     * Initialize a web app on the remote server:
     *  1. Ensure deploy_path exists
     *  2. Clone the git repository (public or private)
     *  3. Generate docker-compose.yml if one is not already present
     *
     * @throws Exception with a user-friendly message on failure
     */
    public function setup(WebApp $webApp): array
    {
        $log = '';

        $this->validateInputs($webApp);

        $server  = $webApp->server;
        $deployPath = rtrim($webApp->deploy_path, '/');

        // ── 1. Ensure deploy path exists ──────────────────────────────────
        $log .= $this->ensureDeployPath($webApp, $deployPath);

        // ── 2. Clone or verify repository ────────────────────────────────
        $log .= $this->cloneRepository($webApp, $deployPath);

        // ── 3. Generate docker-compose.yml if missing ─────────────────────
        $log .= $this->generateDockerCompose($webApp, $deployPath);

        // ── 4. Mark web app status as stopped (ready to deploy) ───────────
        $webApp->update(['status' => 'stopped']);

        return ['log' => $log];
    }

    /**
     * Validate that minimum required fields are set before attempting setup.
     */
    protected function validateInputs(WebApp $webApp): void
    {
        if (empty($webApp->git_repository)) {
            throw new Exception(
                'Git repository URL is required. Please edit the web app and provide a valid Git URL before running setup.'
            );
        }

        if (empty($webApp->deploy_path)) {
            throw new Exception(
                'Deploy path is required. Please edit the web app and provide a deploy path before running setup.'
            );
        }
    }

    /**
     * Create the deploy directory on the remote server if it does not exist.
     */
    protected function ensureDeployPath(WebApp $webApp, string $deployPath): string
    {
        $log = "==> Creating deploy directory: {$deployPath}\n";

        $output = $this->connection->execute(
            $webApp->server,
            "mkdir -p " . escapeshellarg($deployPath) . " 2>&1 && echo 'OK'"
        );

        if (strpos($output, 'OK') === false) {
            throw new Exception("Failed to create deploy directory [{$deployPath}]: {$output}");
        }

        $log .= "    Directory ready.\n";
        return $log;
    }

    /**
     * Clone the git repository into deploy_path.
     * Handles both public (HTTPS) and private (SSH key) repositories.
     * If the directory already contains a git repo, skip cloning.
     */
    protected function cloneRepository(WebApp $webApp, string $deployPath): string
    {
        $server = $webApp->server;
        $repo   = $webApp->git_repository;
        $branch = $webApp->git_branch ?? 'main';
        $log    = "==> Cloning repository: {$repo} (branch: {$branch})\n";

        // Check if a git repo already exists in the deploy path
        $check = $this->connection->execute(
            $server,
            "test -d " . escapeshellarg("{$deployPath}/.git") . " && echo 'EXISTS' || echo 'MISSING'"
        );

        if (strpos($check, 'EXISTS') !== false) {
            $log .= "    Repository already cloned — skipping clone.\n";
            return $log;
        }

        $isPrivate = $this->isPrivateRepo($repo);

        if ($isPrivate && !empty($server->ssh_private_key)) {
            $output = $this->clonePrivateRepo($server, $repo, $branch, $deployPath);
        } else {
            $output = $this->clonePublicRepo($server, $repo, $branch, $deployPath);
        }

        $log .= $output;

        // Verify clone succeeded
        $verify = $this->connection->execute(
            $server,
            "test -d " . escapeshellarg("{$deployPath}/.git") . " && echo 'OK' || echo 'FAIL'"
        );

        if (strpos($verify, 'OK') === false) {
            throw new Exception(
                "Git clone failed for repository [{$repo}]. " .
                "Please verify the URL is correct and the server has access to the repository.\n" .
                "Output: {$output}"
            );
        }

        $log .= "    Repository cloned successfully.\n";
        return $log;
    }

    /**
     * Clone a public repo via HTTPS.
     */
    protected function clonePublicRepo($server, string $repo, string $branch, string $deployPath): string
    {
        $safeRepo       = escapeshellarg($repo);
        $safeBranch     = escapeshellarg($branch);
        $safeDeployPath = escapeshellarg($deployPath);

        return $this->connection->execute(
            $server,
            "GIT_TERMINAL_PROMPT=0 git clone --branch {$safeBranch} --single-branch {$safeRepo} {$safeDeployPath} 2>&1"
        );
    }

    /**
     * Clone a private repo using the server's SSH private key.
     * Writes the key to a temp file, clones, then removes the temp file.
     */
    protected function clonePrivateRepo($server, string $repo, string $branch, string $deployPath): string
    {
        $keyPath        = '/tmp/openvps_git_key_' . uniqid();
        $safeKeyPath    = escapeshellarg($keyPath);
        $safeRepo       = escapeshellarg($repo);
        $safeBranch     = escapeshellarg($branch);
        $safeDeployPath = escapeshellarg($deployPath);

        // Escape the raw private key for use in a shell heredoc
        $privateKey = $server->ssh_private_key;

        // Write key, clone, then clean up — all in one SSH session to avoid orphaned keys
        $script = implode(' && ', [
            // Write private key
            "echo " . escapeshellarg($privateKey) . " > {$safeKeyPath}",
            "chmod 600 {$safeKeyPath}",
            // Clone using that key
            "GIT_SSH_COMMAND=" . escapeshellarg("ssh -i {$keyPath} -o StrictHostKeyChecking=no") .
                " git clone --branch {$safeBranch} --single-branch {$safeRepo} {$safeDeployPath} 2>&1",
            // Remove temp key regardless
            "rm -f {$safeKeyPath}",
        ]);

        $output = $this->connection->execute($server, $script);

        // Best-effort cleanup if the chain failed mid-way
        $this->connection->execute($server, "rm -f {$safeKeyPath} 2>/dev/null || true");

        return $output;
    }

    /**
     * Determine whether a repository URL is likely private (SSH format).
     * SSH URLs look like: git@github.com:user/repo.git
     * HTTPS URLs starting with https:// are treated as public.
     */
    protected function isPrivateRepo(string $repo): bool
    {
        return str_starts_with($repo, 'git@') || str_starts_with($repo, 'ssh://');
    }

    /**
     * Generate a docker-compose.yml from the appropriate stub template
     * if one does not already exist in the deploy_path.
     */
    protected function generateDockerCompose(WebApp $webApp, string $deployPath): string
    {
        $server  = $webApp->server;
        $composePath = $webApp->docker_compose_path ?: "{$deployPath}/docker-compose.yml";
        $log     = "==> Checking for docker-compose.yml at: {$composePath}\n";

        // Check if a docker-compose.yml already exists
        $check = $this->connection->execute(
            $server,
            "test -f " . escapeshellarg($composePath) . " && echo 'EXISTS' || echo 'MISSING'"
        );

        if (strpos($check, 'EXISTS') !== false) {
            $log .= "    docker-compose.yml already exists — skipping generation.\n";

            // Ensure the docker_compose_path is saved on the model
            if (empty($webApp->docker_compose_path)) {
                $webApp->update(['docker_compose_path' => $composePath]);
            }

            return $log;
        }

        $log .= "    Generating docker-compose.yml from template ({$webApp->app_type})...\n";

        $content = $this->buildDockerComposeContent($webApp, $deployPath);

        // Write the generated file to the remote server
        $safeComposePath = escapeshellarg($composePath);
        $safeContent     = escapeshellarg($content);

        $writeOutput = $this->connection->execute(
            $server,
            "cat > {$safeComposePath} << 'OPENVPS_EOF'\n{$content}\nOPENVPS_EOF"
        );

        // Verify the file was created
        $verify = $this->connection->execute(
            $server,
            "test -f {$safeComposePath} && echo 'OK' || echo 'FAIL'"
        );

        if (strpos($verify, 'OK') === false) {
            throw new Exception("Failed to generate docker-compose.yml at [{$composePath}]. Output: {$writeOutput}");
        }

        // Save the path back to the model
        $webApp->update(['docker_compose_path' => $composePath]);

        $log .= "    docker-compose.yml generated at {$composePath}.\n";
        return $log;
    }

    /**
     * Load the appropriate stub and substitute {{PLACEHOLDERS}}.
     */
    protected function buildDockerComposeContent(WebApp $webApp, string $deployPath): string
    {
        $appType = $webApp->app_type ?? 'custom';
        $stubPath = resource_path("stubs/docker-compose/{$appType}.yml");

        if (!file_exists($stubPath)) {
            $stubPath = resource_path('stubs/docker-compose/custom.yml');
        }

        $stub = file_get_contents($stubPath);

        $port    = $webApp->port ?? $this->defaultPort($appType);
        $appName = preg_replace('/[^a-z0-9-]/', '-', strtolower($webApp->name));

        return str_replace(
            ['{{APP_NAME}}', '{{PORT}}', '{{APP_KEY}}'],
            [$appName, $port, 'base64:' . base64_encode(random_bytes(32))],
            $stub
        );
    }

    /**
     * Return a sensible default port for each app type.
     */
    protected function defaultPort(string $appType): int
    {
        return match ($appType) {
            'laravel' => 8000,
            'nodejs'  => 3000,
            'react'   => 8080,
            'static'  => 8080,
            default   => 8080,
        };
    }
}
