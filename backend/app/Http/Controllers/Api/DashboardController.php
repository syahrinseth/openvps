<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityLogResource;
use App\Http\Resources\DeploymentResource;
use App\Http\Resources\ServerMetricResource;
use App\Models\ActivityLog;
use App\Models\Deployment;
use App\Models\ServerMetric;
use App\Models\SslCertificate;
use App\Models\WebApp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Get dashboard stats for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $serverIds = $user->servers()->pluck('id');

        $serversCount = $user->servers()->count();
        $activeServers = $user->servers()->where('status', 'active')->count();
        $webAppsCount = WebApp::whereIn('server_id', $serverIds)->count();

        $sslExpiringSoon = SslCertificate::whereIn('server_id', $serverIds)
            ->where('status', 'active')
            ->where('expires_at', '<=', now()->addDays(30))
            ->where('expires_at', '>', now())
            ->count();

        $recentDeployments = Deployment::whereIn('server_id', $serverIds)
            ->latest()
            ->limit(5)
            ->get();

        $recentActivity = ActivityLog::where(function ($query) use ($user, $serverIds) {
            $query->where('user_id', $user->id)
                ->orWhereIn('server_id', $serverIds);
        })
            ->latest()
            ->limit(10)
            ->get();

        $serverMetrics = ServerMetric::whereIn('server_id', $serverIds)
            ->latest('recorded_at')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => [
                'servers_count' => $serversCount,
                'web_apps_count' => $webAppsCount,
                'active_servers' => $activeServers,
                'ssl_expiring_soon' => $sslExpiringSoon,
                'recent_deployments' => DeploymentResource::collection($recentDeployments),
                'recent_activity' => ActivityLogResource::collection($recentActivity),
                'server_metrics' => ServerMetricResource::collection($serverMetrics),
            ],
        ]);
    }
}
