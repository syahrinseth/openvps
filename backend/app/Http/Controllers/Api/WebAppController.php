<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\WebApp\StoreWebAppRequest;
use App\Http\Requests\WebApp\UpdateWebAppRequest;
use App\Http\Resources\DeploymentResource;
use App\Http\Resources\WebAppResource;
use App\Models\Server;
use App\Models\WebApp;
use App\Services\ActivityLogService;
use App\Services\DeploymentService;
use App\Services\LocalDeploymentService;
use App\Services\ServerConnectionService;
use App\Services\WebAppSetupService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use phpseclib3\Crypt\EC;
use Symfony\Component\Process\Process;

class WebAppController extends Controller
{
    public function __construct(
        protected DeploymentService $deploymentService,
        protected ServerConnectionService $connectionService,
        protected LocalDeploymentService $localDeploymentService,
        protected ActivityLogService $activityLog,
        protected WebAppSetupService $setupService,
    ) {}

    /**
     * List all web apps on a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $webApps = $server->webApps()
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(WebAppResource::collection($webApps)->response()->getData(true));
    }

    /**
     * Create a new web app on a server.
     */
    public function store(StoreWebAppRequest $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $data = $request->validated();
        $data['server_id'] = $server->id;
        $data['user_id'] = $request->user()->id;
        $data['status'] = 'stopped';

        $webApp = WebApp::create($data);

        $this->activityLog->log(
            'webapp.created',
            "Web app '{$webApp->name}' was created on server '{$server->name}'",
            $request->user(),
            $server,
            $webApp,
        );

        return response()->json([
            'message' => 'Web app created successfully.',
            'data' => new WebAppResource($webApp),
        ], 201);
    }

    /**
     * Show web app details.
     */
    public function show(Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        $webApp->load(['nginxConfigs', 'sslCertificates', 'deployments' => function ($q) {
            $q->latest()->limit(5);
        }]);

        return response()->json([
            'data' => new WebAppResource($webApp),
        ]);
    }

    /**
     * Update a web app.
     */
    public function update(UpdateWebAppRequest $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        $data = $request->validated();

        // Don't overwrite an existing encrypted token when the field was left blank.
        // The frontend sends git_token only when the user types a new value; an empty
        // (or absent) value here means "keep whatever is stored".
        if (array_key_exists('git_token', $data) && empty($data['git_token'])) {
            unset($data['git_token']);
        }

        // Same protection for the deploy key private key field.
        if (array_key_exists('git_deploy_key', $data) && empty($data['git_deploy_key'])) {
            unset($data['git_deploy_key']);
        }

        $webApp->update($data);

        $this->activityLog->log(
            'webapp.updated',
            "Web app '{$webApp->name}' was updated",
            $request->user(),
            $server,
            $webApp,
        );

        // When the domain changes, the docker-compose.yml Host() label must be
        // rewritten and the container recreated so Traefik starts routing the
        // new domain.  Traefik's ACME resolver will then automatically issue a
        // TLS cert for the new domain.
        //   • Local servers  — rewrite via filesystem, restart via docker compose
        //   • Remote servers — rewrite via SSH, restart via docker compose up -d
        $restartWarning = null;
        if ($webApp->wasChanged('domain') && !empty($webApp->docker_compose_path)) {
            try {
                if ($server->is_local) {
                    $this->localDeploymentService->regenerateDockerCompose($webApp);
                    $this->localDeploymentService->start($webApp);
                } else {
                    $this->setupService->regenerateDockerCompose($webApp);
                    $composeDir  = escapeshellarg(dirname($webApp->docker_compose_path));
                    $composePath = escapeshellarg($webApp->docker_compose_path);
                    $this->connectionService->execute(
                        $server,
                        "cd {$composeDir} && docker compose -f {$composePath} up -d 2>&1"
                    );
                    $webApp->update(['status' => 'running']);
                }
            } catch (Exception $e) {
                Log::error('Failed to apply domain change for web app [{id}]: {error}', [
                    'id'    => $webApp->id,
                    'error' => $e->getMessage(),
                ]);
                $restartWarning = 'Domain saved, but the container could not be restarted automatically. Please restart the app manually.';
            }
        }

        return response()->json(array_filter([
            'message' => 'Web app updated successfully.',
            'data'    => new WebAppResource($webApp->fresh()),
            'warning' => $restartWarning,
        ]));
    }

    /**
     * Delete a web app.
     */
    public function destroy(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        $this->activityLog->log(
            'webapp.deleted',
            "Web app '{$webApp->name}' was deleted from server '{$server->name}'",
            $request->user(),
            $server,
            $webApp,
        );

        $webApp->delete();

        return response()->json([
            'message' => 'Web app deleted successfully.',
        ]);
    }

    /**
     * Trigger a deployment for a web app.
     */
    public function deploy(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        try {
            $deployment = $this->deploymentService->deploy($webApp, $request->input('commit_hash'));

            $this->activityLog->log(
                'webapp.deployed',
                "Web app '{$webApp->name}' was deployed",
                $request->user(),
                $server,
                $deployment,
            );

            return response()->json([
                'message' => 'Deployment started successfully.',
                'data' => new DeploymentResource($deployment),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Deployment failed.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Start a web app's process on the server.
     * Branches on server->is_local — Ref: TRAEFIK_MIGRATION_PLAN.md Phase 3.7
     */
    public function start(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        try {
            if ($server->is_local) {
                $output = $this->localDeploymentService->start($webApp);
            } else {
                $safePath = escapeshellarg($webApp->docker_compose_path);
                $command = "docker compose -f {$safePath} up -d 2>&1";
                $output = $this->connectionService->execute($server, $command);
                $webApp->update(['status' => 'running']);
            }

            $this->activityLog->log(
                'webapp.started',
                "Web app '{$webApp->name}' was started",
                $request->user(),
                $server,
                $webApp,
            );

            return response()->json([
                'message' => 'Web app started successfully.',
                'output' => $output,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to start web app.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Stop a web app's process on the server.
     * Branches on server->is_local.
     */
    public function stop(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        try {
            if ($server->is_local) {
                $output = $this->localDeploymentService->stop($webApp);
            } else {
                $safePath = escapeshellarg($webApp->docker_compose_path);
                $command = "docker compose -f {$safePath} down 2>&1";
                $output = $this->connectionService->execute($server, $command);
                $webApp->update(['status' => 'stopped']);
            }

            $this->activityLog->log(
                'webapp.stopped',
                "Web app '{$webApp->name}' was stopped",
                $request->user(),
                $server,
                $webApp,
            );

            return response()->json([
                'message' => 'Web app stopped successfully.',
                'output' => $output,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to stop web app.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Restart a web app's process on the server.
     * Branches on server->is_local.
     */
    public function restart(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        try {
            if ($server->is_local) {
                $output = $this->localDeploymentService->restart($webApp);
            } else {
                $safePath = escapeshellarg($webApp->docker_compose_path);
                $command = "docker compose -f {$safePath} restart 2>&1";
                $output = $this->connectionService->execute($server, $command);
            }

            $this->activityLog->log(
                'webapp.restarted',
                "Web app '{$webApp->name}' was restarted",
                $request->user(),
                $server,
                $webApp,
            );

            return response()->json([
                'message' => 'Web app restarted successfully.',
                'output' => $output,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to restart web app.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate an Ed25519 SSH deploy key pair for a web app.
     * The private key is stored encrypted; only the public key is returned.
     * The user copies the public key to GitHub → repo → Settings → Deploy keys.
     */
    public function generateDeployKey(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        try {
            // Generate an Ed25519 key pair using phpseclib3 (no shell exec needed)
            $key = EC::createKey('Ed25519');

            $comment    = 'openvps-' . preg_replace('/[^a-z0-9-]/', '-', strtolower($webApp->name));
            $privateKey = $key->toString('OpenSSH');
            $publicKey  = $key->getPublicKey()->toString('OpenSSH', ['comment' => $comment]);

            $webApp->update([
                'git_deploy_key'        => $privateKey,
                'git_deploy_key_public' => $publicKey,
            ]);

            $this->activityLog->log(
                'webapp.deploy_key_generated',
                "Deploy key generated for web app '{$webApp->name}'",
                $request->user(),
                $server,
                $webApp,
            );

            return response()->json([
                'message' => 'Deploy key generated successfully.',
                'data'    => new WebAppResource($webApp->fresh()),
            ]);
        } catch (Exception $e) {
            Log::error("Failed to generate deploy key for [{$webApp->name}]: {$e->getMessage()}");

            return response()->json([
                'message' => 'Failed to generate deploy key: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Initialize setup for a web app:
     *  - Clone the git repository to deploy_path
     *  - Load .env.example → environment_variables if not set
     *  - Write .env to deploy path
     *  - Generate docker-compose.yml if not present
     */
    public function setup(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        $webApp->update(['status' => 'deploying']);

        try {
            $result = $this->setupService->setup($webApp);

            $this->activityLog->log(
                'webapp.setup',
                "Web app '{$webApp->name}' was initialized on server '{$server->name}'",
                $request->user(),
                $server,
                $webApp,
            );

            return response()->json([
                'message' => 'Web app setup completed successfully.',
                'log'     => $result['log'],
                'data'    => new WebAppResource($webApp->fresh()),
            ]);
        } catch (Exception $e) {
            $webApp->update(['status' => 'failed']);

            Log::error("Web app setup failed for [{$webApp->name}] on server [{$server->name}]: {$e->getMessage()}", [
                'web_app_id' => $webApp->id,
                'server_id'  => $server->id,
                'ip_address' => $server->ip_address,
                'exception'  => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Setup failed: ' . $e->getMessage(),
                'data'    => new WebAppResource($webApp->fresh()),
            ], 500);
        }
    }

    /**
     * Return the raw content of .env.example from the web app's deploy path.
     * Used by the frontend "Load from .env.example" button.
     */
    public function getEnvExample(Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        $deployPath     = rtrim($webApp->deploy_path, '/');
        $envExamplePath = "{$deployPath}/.env.example";

        try {
            if ($server->is_local) {
                if (!file_exists($envExamplePath)) {
                    return response()->json([
                        'content' => null,
                        'message' => '.env.example not found at ' . $envExamplePath,
                    ], 404);
                }
                $content = file_get_contents($envExamplePath);
            } else {
                $result = $this->connectionService->executeWithStatus(
                    $server,
                    "cat " . escapeshellarg($envExamplePath) . " 2>&1"
                );
                if ($result['exit_status'] !== 0) {
                    return response()->json([
                        'content' => null,
                        'message' => '.env.example not found at ' . $envExamplePath,
                    ], 404);
                }
                $content = $result['output'];
            }

            return response()->json(['content' => $content]);
        } catch (Exception $e) {
            return response()->json([
                'content' => null,
                'message' => 'Failed to read .env.example: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Run an arbitrary shell script in the web app's deploy path.
     * Returns output and exit code — never throws on non-zero exit (caller decides).
     * Timeout: 5 minutes.
     */
    public function runScript(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        $validated = $request->validate([
            'script' => ['required', 'string', 'max:10000'],
        ]);

        $script     = $validated['script'];
        $deployPath = rtrim($webApp->deploy_path, '/');

        try {
            if ($server->is_local) {
                $process = new Process(
                    ['/bin/sh', '-c', $script],
                    $deployPath,
                    null,
                    null,
                    300 // 5 minutes
                );
                $process->run();
                $output   = $process->getOutput() . $process->getErrorOutput();
                $exitCode = $process->getExitCode() ?? -1;
            } else {
                $safeDeployPath = escapeshellarg($deployPath);
                $command        = "cd {$safeDeployPath} && " . $script . " 2>&1";
                $result         = $this->connectionService->executeWithStatus($server, $command);
                $output         = $result['output'];
                $exitCode       = $result['exit_status'];
            }

            $this->activityLog->log(
                'webapp.script_run',
                "Script run on web app '{$webApp->name}' (exit {$exitCode})",
                $request->user(),
                $server,
                $webApp,
            );

            return response()->json([
                'output'    => $output,
                'exit_code' => $exitCode,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'output'    => $e->getMessage(),
                'exit_code' => -1,
            ], 500);
        }
    }

    protected function authorizeServerAccess(Server $server): void
    {
        if ($server->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to this server.');
        }
    }

    protected function authorizeWebAppBelongsToServer(WebApp $webApp, Server $server): void
    {
        if ($webApp->server_id !== $server->id) {
            abort(404, 'Web app not found on this server.');
        }
    }
}
