<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ServerMetricResource;
use App\Models\Server;
use App\Services\ActivityLogService;
use App\Services\ServerMonitorService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServerMetricController extends Controller
{
    public function __construct(
        protected ServerMonitorService $monitorService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * Get metrics for a server with optional date range filter.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $query = $server->serverMetrics()->latest('recorded_at');

        if ($request->has('from')) {
            $query->where('recorded_at', '>=', $request->input('from'));
        }

        if ($request->has('to')) {
            $query->where('recorded_at', '<=', $request->input('to'));
        }

        $metrics = $query->paginate($request->input('per_page', 50));

        return response()->json(ServerMetricResource::collection($metrics)->response()->getData(true));
    }

    /**
     * Get the latest metrics for a server.
     */
    public function latest(Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $metric = $server->serverMetrics()
            ->latest('recorded_at')
            ->first();

        if (!$metric) {
            return response()->json([
                'message' => 'No metrics found for this server.',
                'data' => null,
            ]);
        }

        return response()->json([
            'data' => new ServerMetricResource($metric),
        ]);
    }

    /**
     * Trigger metric collection for a server.
     */
    public function collect(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        try {
            $metric = $this->monitorService->collectMetrics($server);
            $status = $this->monitorService->getServerStatus($server);

            return response()->json([
                'message' => 'Metrics collected successfully.',
                'data' => new ServerMetricResource($metric),
                'status' => $status,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to collect metrics.',
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
}
