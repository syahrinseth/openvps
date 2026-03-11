<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityLogResource;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    /**
     * List activity logs for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = ActivityLog::with(['user', 'server'])
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->orWhereIn('server_id', $user->servers()->pluck('id'));
            });

        if ($request->filled('server_id')) {
            $query->where('server_id', $request->input('server_id'));
        }

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->input('to'));
        }

        $logs = $query->latest()
            ->paginate($request->input('per_page', 20));

        return response()->json(ActivityLogResource::collection($logs)->response()->getData(true));
    }

    /**
     * Show a single activity log entry.
     */
    public function show(Request $request, ActivityLog $activityLog): JsonResponse
    {
        $user = $request->user();

        // Ensure the user can see this log
        $userServerIds = $user->servers()->pluck('id')->toArray();
        if ($activityLog->user_id !== $user->id && !in_array($activityLog->server_id, $userServerIds)) {
            abort(403, 'Unauthorized access to this activity log.');
        }

        $activityLog->load(['user', 'server']);

        return response()->json([
            'data' => new ActivityLogResource($activityLog),
        ]);
    }
}
