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
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebAppController extends Controller
{
    public function __construct(
        protected DeploymentService $deploymentService,
        protected ServerConnectionService $connectionService,
        protected ActivityLogService $activityLog,
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
        $data['repository_url'] = $data['git_repository'] ?? null;
        $data['repository_branch'] = $data['git_branch'] ?? 'main';
        $data['root_directory'] = $data['deploy_path'] ?? "/var/www/{$data['domain']}";
        $data['status'] = 'pending';
        unset($data['git_repository'], $data['git_branch'], $data['deploy_path']);

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

        if (isset($data['git_repository'])) {
            $data['repository_url'] = $data['git_repository'];
            unset($data['git_repository']);
        }
        if (isset($data['git_branch'])) {
            $data['repository_branch'] = $data['git_branch'];
            unset($data['git_branch']);
        }
        if (isset($data['deploy_path'])) {
            $data['root_directory'] = $data['deploy_path'];
            unset($data['deploy_path']);
        }

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
     * Restart a web app's process on the server.
     */
    public function restart(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        try {
            $appType = $webApp->app_type;
            $command = match ($appType) {
                'nodejs' => "pm2 restart {$webApp->name} 2>&1",
                'python' => "sudo systemctl restart {$webApp->name} 2>&1",
                'php', 'laravel' => "sudo systemctl restart php-fpm 2>&1",
                default => "sudo systemctl restart {$webApp->name} 2>&1",
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
