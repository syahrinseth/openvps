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
use App\Services\ServerConnectionService;
use App\Services\WebAppSetupService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebAppController extends Controller
{
    public function __construct(
        protected DeploymentService $deploymentService,
        protected ServerConnectionService $connectionService,
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

        $webApp->update($data);

        $this->activityLog->log(
            'webapp.updated',
            "Web app '{$webApp->name}' was updated",
            $request->user(),
            $server,
            $webApp,
        );

        return response()->json([
            'message' => 'Web app updated successfully.',
            'data' => new WebAppResource($webApp->fresh()),
        ]);
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
     */
    public function start(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        try {
            $command = "docker compose -f {$webApp->docker_compose_path} up -d 2>&1";
            $output = $this->connectionService->execute($server, $command);

            $webApp->update(['status' => 'running']);

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
     */
    public function stop(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        try {
            $command = "docker compose -f {$webApp->docker_compose_path} down 2>&1";
            $output = $this->connectionService->execute($server, $command);

            $webApp->update(['status' => 'stopped']);

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
     */
    public function restart(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        try {
            $appType = $webApp->app_type;
            $containerName = $webApp->docker_container_name ?? $webApp->name;
            $command = match ($appType) {
                'nodejs' => "docker compose -f {$webApp->docker_compose_path} restart 2>&1",
                'laravel', 'react', 'static', 'custom' => "docker compose -f {$webApp->docker_compose_path} restart 2>&1",
                default => "docker restart {$containerName} 2>&1",
            };

            $output = $this->connectionService->execute($server, $command);

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
     * Initialize setup for a web app:
     *  - Clone the git repository to deploy_path
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

            return response()->json([
                'message' => 'Web app setup failed.',
                'error'   => $e->getMessage(),
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
