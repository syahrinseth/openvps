<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Backup;
use App\Models\Deployment;
use App\Models\Server;
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

        $serverCount = $user->servers()->count();
        $activeServerCount = $user->servers()->where('status', 'active')->count();
        $appCount = WebApp::whereIn('server_id', $serverIds)->count();
        $activeAppCount = WebApp::whereIn('server_id', $serverIds)->where('status', 'active')->count();

        $recentDeployments = Deployment::whereIn('server_id', $serverIds)
            ->latest()
            ->limit(5)
            ->get();

        $failedDeployments = Deployment::whereIn('server_id', $serverIds)
            ->where('status', 'failed')
            ->where('created_at', '>=', now()->subDays(7))
            ->count();

        $backupCount = Backup::whereIn('server_id', $serverIds)->count();

        $unreadNotifications = $user->notifications()
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'stats' => [
                'total_servers' => $serverCount,
                'active_servers' => $activeServerCount,
                'total_apps' => $appCount,
                'active_apps' => $activeAppCount,
                'failed_deployments_7d' => $failedDeployments,
                'total_backups' => $backupCount,
                'unread_notifications' => $unreadNotifications,
            ],
            'recent_deployments' => $recentDeployments->map(fn ($d) => [
                'id' => $d->id,
                'web_app_id' => $d->web_app_id,
                'status' => $d->status,
                'commit_hash' => $d->commit_hash,
                'branch' => $d->branch,
                'created_at' => $d->created_at,
            ]),
        ]);
    }
}
