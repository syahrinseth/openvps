<?php

namespace App\Services;

use App\Models\WebApp;
use Exception;
use Illuminate\Support\Facades\Log;

class WebAppSetupService
{
    public function __construct(
        protected ServerConnectionService $connection,
        protected LocalDeploymentService $localDeployment,
    ) {}

    /**
     * Initialize a web app on the target server.
     * Branches on server->is_local:
     *  - local  → LocalDeploymentService (no SSH, docker compose on control plane)
     *  - remote → SSH-based setup (existing behaviour)
     *
     * Ref: TRAEFIK_MIGRATION_PLAN.md — Phase 3.5
     */
    public function setup(WebApp $webApp): array
    {
        if ($webApp->server->is_local) {
            return $this->localDeployment->setup($webApp);
        }

        return $this->setupRemote($webApp);
    }

    /**
     * SSH-based setup for remote servers (original implementation).
     */
    protected function setupRemote(WebApp $webApp): array
    {
        $log = '';

        $this->validateInputs($webApp);

        $server  = $webApp->server;
        $deployPath = rtrim($webApp->deploy_path, '/');

        // ── 1. Ensure deploy path exists ──────────────────────────────────
        $log .= $this->ensureDeployPath($webApp, $deployPath);

        // ── 2. Clone or verify repository ────────────────────────────────
        $log .= $this->cloneRepository($webApp, $deployPath);

        // ── 3. Set up .env: load .env.example if env vars not set, write .env
        $log .= $this->setupEnvFile($webApp, $deployPath);

        // ── 4. Generate docker-compose.yml if missing ─────────────────────
        $log .= $this->generateDockerCompose($webApp, $deployPath);

        // ── 5. Generate docker/Dockerfile if missing ──────────────────────
        $log .= $this->generateDockerfile($webApp, $deployPath);

        // ── 6. Mark web app status as stopped (ready to deploy) ───────────
        $webApp->update(['status' => 'stopped']);

        return ['log' => $log];
    }

    /**
     * If environment_variables is not set on the web app, read .env.example
     * from the deploy path on the remote server and store it as the default.
     * Then write .env to the remote server.
     */
    protected function setupEnvFile(WebApp $webApp, string $deployPath): string
    {
        $log            = "==> Setting up .env file...\n";
        $server         = $webApp->server;
        $envPath        = escapeshellarg("{$deployPath}/.env");
        $envExamplePath = escapeshellarg("{$deployPath}/.env.example");

        // Auto-populate from .env.example if environment_variables not set yet
        if (empty($webApp->environment_variables)) {
            $result = $this->connection->executeWithStatus(
                $server,
                "cat {$envExamplePath} 2>/dev/null"
            );
            $exampleContent = $result['output'] ?? '';
            if (!empty(trim($exampleContent))) {
                $webApp->update(['environment_variables' => $exampleContent]);
                $log .= "    Loaded .env.example as default environment variables.\n";
            }
        }

        // Write .env if we have content
        if (!empty($webApp->environment_variables)) {
            $safeEncoded = escapeshellarg(base64_encode($webApp->environment_variables));
            $this->connection->execute($server,
                "echo {$safeEncoded} | base64 -d > {$envPath}"
            );
            $log .= "    .env file written to {$deployPath}/.env.\n";
        } else {
            $log .= "    No environment variables set — .env not written.\n";
        }

        return $log;
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

        // Check if the deploy path is non-empty (git clone will refuse to clone into it)
        $empty = $this->connection->execute(
            $server,
            "find " . escapeshellarg($deployPath) . " -mindepth 1 -maxdepth 1 | head -1"
        );

        if (trim($empty) !== '') {
            throw new Exception(
                "Deploy path [{$deployPath}] already exists and is not empty. " .
                "Please specify an empty directory (e.g. " . rtrim($deployPath, '/') . "/" . basename($repo, '.git') . "/)."
            );
        }

        $token      = $webApp->git_token;
        $deployKey  = $webApp->git_deploy_key;
        $isPrivate  = $this->isPrivateRepo($repo);

        if (!empty($deployKey)) {
            // Per-webapp SSH deploy key takes highest priority (SSH-format URL required)
            $output = $this->cloneWithDeployKey($server, $repo, $branch, $deployPath, $deployKey);
        } elseif (!empty($token)) {
            // HTTPS PAT-based clone
            $output = $this->cloneWithToken($server, $repo, $branch, $deployPath, $token);
        } elseif ($isPrivate && !empty($server->ssh_private_key)) {
            // Fall back to server-level SSH key for ssh:// or git@ URLs
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
     * Clone a private repo using a per-webapp SSH deploy key.
     * The private key is written to a temp file via base64 (safe for all key content),
     * used for the clone, then immediately deleted.
     * If the repo URL is HTTPS it is automatically converted to SSH format so that
     * GIT_SSH_COMMAND is actually honoured by git.
     */
    protected function cloneWithDeployKey($server, string $repo, string $branch, string $deployPath, string $deployKey): string
    {
        $repo           = $this->toSshUrl($repo);   // HTTPS → git@HOST:PATH
        $keyPath        = '/tmp/openvps_deploy_key_' . uniqid();
        $safeKeyPath    = escapeshellarg($keyPath);
        $safeBranch     = escapeshellarg($branch);
        $safeRepo       = escapeshellarg($repo);
        $safeDeployPath = escapeshellarg($deployPath);
        $safeEncoded    = escapeshellarg(base64_encode($deployKey));

        $script = implode(' && ', [
            "echo {$safeEncoded} | base64 -d > {$safeKeyPath}",
            "chmod 600 {$safeKeyPath}",
            "GIT_SSH_COMMAND=" . escapeshellarg("ssh -i {$keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null") .
                " git clone --branch {$safeBranch} --single-branch {$safeRepo} {$safeDeployPath} 2>&1",
            "rm -f {$safeKeyPath}",
        ]);

        $output = $this->connection->execute($server, $script);

        // Best-effort cleanup in case the chain failed mid-way
        $this->connection->execute($server, "rm -f {$safeKeyPath} 2>/dev/null || true");

        return $output;
    }

    /**
     * Clone a private repo via HTTPS using a personal access token.
     * Injects the token into the URL: https://<token>@github.com/user/repo.git
     */
    protected function cloneWithToken($server, string $repo, string $branch, string $deployPath, string $token): string
    {
        $repoWithToken  = $this->injectTokenIntoUrl($repo, $token);
        $safeRepo       = escapeshellarg($repoWithToken);
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
     * Inject a PAT into an HTTPS repo URL.
     * https://github.com/u/r.git  →  https://<token>@github.com/u/r.git
     */
    protected function injectTokenIntoUrl(string $repo, string $token): string
    {
        return preg_replace('#^(https?://)#', '$1' . rawurlencode($token) . '@', $repo);
    }

    /**
     * Generate docker/Dockerfile on the remote server from a local stub template,
     * if a stub exists for the app type and the file does not already exist.
     */
    protected function generateDockerfile(WebApp $webApp, string $deployPath): string
    {
        $appType        = $webApp->app_type ?? 'custom';
        $stubPath       = resource_path("stubs/dockerfile/{$appType}");
        $dockerfilePath = "{$deployPath}/docker/Dockerfile";
        $log            = "==> Checking for docker/Dockerfile at: {$dockerfilePath}\n";

        // Only generate if a stub exists for this app type
        if (!file_exists($stubPath)) {
            $log .= "    No Dockerfile stub for app type '{$appType}' — skipping.\n";
            return $log;
        }

        $server = $webApp->server;
        $safeDockerfilePath = escapeshellarg($dockerfilePath);

        // Check if Dockerfile already exists on remote
        $check = $this->connection->executeWithStatus(
            $server,
            "test -f {$safeDockerfilePath} && echo 'EXISTS' || echo 'MISSING'"
        );

        if (strpos($check['output'] ?? '', 'EXISTS') !== false) {
            $log .= "    docker/Dockerfile already exists — skipping generation.\n";
            return $log;
        }

        // Ensure docker/ directory exists on remote
        $safeDockerDir = escapeshellarg("{$deployPath}/docker");
        $this->connection->execute($server, "mkdir -p {$safeDockerDir}");

        // Write Dockerfile to remote via base64
        $content     = file_get_contents($stubPath);
        $safeEncoded = escapeshellarg(base64_encode($content));
        $writeOutput = $this->connection->execute(
            $server,
            "echo {$safeEncoded} | base64 -d > {$safeDockerfilePath}"
        );

        // Verify
        $verify = $this->connection->executeWithStatus(
            $server,
            "test -f {$safeDockerfilePath} && echo 'OK' || echo 'FAIL'"
        );

        if (strpos($verify['output'] ?? '', 'OK') === false) {
            throw new \Exception("Failed to generate docker/Dockerfile at [{$dockerfilePath}]. Output: {$writeOutput}");
        }

        $log .= "    docker/Dockerfile generated at {$dockerfilePath}.\n";
        return $log;
    }

    /**
     * Regenerate the docker-compose.yml on the remote server from the current
     * app config, overwriting any existing file via SSH.  Unlike
     * generateDockerCompose(), this method does NOT skip when the file already
     * exists — it is intended for config changes such as a domain update that
     * must be reflected in the Traefik Host() label.
     *
     * Returns a log string describing what was done.
     */
    public function regenerateDockerCompose(WebApp $webApp): string
    {
        $composePath = $webApp->docker_compose_path;

        if (empty($composePath)) {
            return "==> Skipping compose regeneration: no docker_compose_path set yet.\n";
        }

        $server     = $webApp->server;
        $deployPath = dirname($composePath);
        $log        = "==> Regenerating docker-compose.yml at: {$composePath}\n";
        $content    = $this->buildDockerComposeContent($webApp, $deployPath);

        $safeComposePath = escapeshellarg($composePath);
        $safeEncoded     = escapeshellarg(base64_encode($content));

        $this->connection->execute(
            $server,
            "echo {$safeEncoded} | base64 -d > {$safeComposePath}"
        );

        $verify = $this->connection->execute(
            $server,
            "test -f {$safeComposePath} && echo 'OK' || echo 'FAIL'"
        );

        if (strpos($verify, 'OK') === false) {
            throw new Exception("Failed to write docker-compose.yml at [{$composePath}].");
        }

        $log .= "    docker-compose.yml regenerated with domain [{$webApp->domain}].\n";
        return $log;
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

        // Write the generated file to the remote server safely via base64 to avoid
        // heredoc delimiter collisions or special-character issues in the content.
        $safeComposePath = escapeshellarg($composePath);
        $safeEncoded     = escapeshellarg(base64_encode($content));

        $writeOutput = $this->connection->execute(
            $server,
            "echo {$safeEncoded} | base64 -d > {$safeComposePath}"
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
        $domain  = $webApp->domain ?? '';

        return str_replace(
            ['{{APP_NAME}}', '{{PORT}}', '{{APP_KEY}}', '{{DOMAIN}}'],
            [$appName, $port, 'base64:' . base64_encode(random_bytes(32)), $domain],
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

    /**
     * Convert an HTTPS repository URL to SSH format so that GIT_SSH_COMMAND
     * is honoured. HTTPS URLs are silently ignored by git when an SSH command
     * is injected, so this conversion is required for deploy-key clones.
     *
     * https://github.com/user/repo.git  →  git@github.com:user/repo.git
     * https://gitlab.com/user/repo.git  →  git@gitlab.com:user/repo.git
     *
     * SSH URLs (git@… or ssh://…) are returned unchanged.
     */
    protected function toSshUrl(string $url): string
    {
        if (str_starts_with($url, 'git@') || str_starts_with($url, 'ssh://')) {
            return $url;
        }
        // https://HOST/PATH  →  git@HOST:PATH
        return preg_replace('#^https?://([^/]+)/(.+)$#', 'git@$1:$2', $url);
    }
}
