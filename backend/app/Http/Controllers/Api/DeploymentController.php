<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DeploymentResource;
use App\Models\Deployment;
use App\Models\Server;
use App\Models\WebApp;
use App\Services\ActivityLogService;
use App\Services\DeploymentService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeploymentController extends Controller
{
    public function __construct(
        protected DeploymentService $deploymentService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all deployments across all web apps on a server.
     */
    public function serverIndex(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $deployments = Deployment::where('server_id', $server->id)
            ->with(['user', 'webApp'])
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(DeploymentResource::collection($deployments)->response()->getData(true));
    }

    /**
     * List deployments for a web app.
     */
    public function index(Request $request, Server $server, WebApp $webApp): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);

        $deployments = $webApp->deployments()
            ->with('user')
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(DeploymentResource::collection($deployments)->response()->getData(true));
    }

    /**
     * Show deployment details.
     */
    public function show(Server $server, WebApp $webApp, Deployment $deployment): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);
        $this->authorizeDeploymentBelongsToWebApp($deployment, $webApp);

        $deployment->load(['user', 'webApp']);

        return response()->json([
            'data' => new DeploymentResource($deployment),
        ]);
    }

    /**
     * Rollback to a specific deployment.
     */
    public function rollback(Request $request, Server $server, WebApp $webApp, Deployment $deployment): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebAppBelongsToServer($webApp, $server);
        $this->authorizeDeploymentBelongsToWebApp($deployment, $webApp);

        try {
            $rollbackDeployment = $this->deploymentService->rollback($deployment);

            $this->activityLog->log(
                'deployment.rollback',
                "Deployment rolled back to commit {$deployment->commit_hash} for '{$webApp->name}'",
                $request->user(),
                $server,
                $rollbackDeployment,
            );

            return response()->json([
                'message' => 'Rollback completed successfully.',
                'data' => new DeploymentResource($rollbackDeployment),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Rollback failed.',
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

    protected function authorizeDeploymentBelongsToWebApp(Deployment $deployment, WebApp $webApp): void
    {
        if ($deployment->web_app_id !== $webApp->id) {
            abort(404, 'Deployment not found for this web app.');
        }
    }
}
