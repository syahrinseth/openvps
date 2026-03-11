<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CronJobResource;
use App\Models\CronJob;
use App\Models\Server;
use App\Services\ActivityLogService;
use App\Services\ServerConnectionService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CronJobController extends Controller
{
    public function __construct(
        protected ServerConnectionService $connectionService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all cron jobs on a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $cronJobs = $server->cronJobs()
            ->with('webApp')
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(CronJobResource::collection($cronJobs)->response()->getData(true));
    }

    /**
     * Create a new cron job.
     */
    public function store(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $validated = $request->validate([
            'command' => ['required', 'string', 'max:1000'],
            'schedule' => ['required', 'string', 'max:100'],
            'web_app_id' => ['nullable', 'integer', 'exists:web_apps,id'],
            'description' => ['nullable', 'string', 'max:500'],
            'user' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $validated['server_id'] = $server->id;
        $validated['is_active'] = $validated['is_active'] ?? true;
        $validated['user'] = $validated['user'] ?? 'root';

        $cronJob = CronJob::create($validated);

        // Sync cron to server if active
        if ($cronJob->is_active) {
            try {
                $this->syncCronToServer($server);
            } catch (Exception $e) {
                // Log but don't fail - the cron is saved in DB
            }
        }

        $this->activityLog->log(
            'cronjob.created',
            "Cron job created: {$cronJob->command}",
            $request->user(),
            $server,
            $cronJob,
        );

        return response()->json([
            'message' => 'Cron job created successfully.',
            'data' => new CronJobResource($cronJob),
        ], 201);
    }

    /**
     * Show a cron job.
     */
    public function show(Server $server, CronJob $cronJob): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeCronJobBelongsToServer($cronJob, $server);

        $cronJob->load('webApp');

        return response()->json([
            'data' => new CronJobResource($cronJob),
        ]);
    }

    /**
     * Update a cron job.
     */
    public function update(Request $request, Server $server, CronJob $cronJob): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeCronJobBelongsToServer($cronJob, $server);

        $validated = $request->validate([
            'command' => ['sometimes', 'string', 'max:1000'],
            'schedule' => ['sometimes', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'user' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $cronJob->update($validated);

        try {
            $this->syncCronToServer($server);
        } catch (Exception $e) {
            // Log but don't fail
        }

        $this->activityLog->log(
            'cronjob.updated',
            "Cron job updated: {$cronJob->command}",
            $request->user(),
            $server,
            $cronJob,
        );

        return response()->json([
            'message' => 'Cron job updated successfully.',
            'data' => new CronJobResource($cronJob->fresh()),
        ]);
    }

    /**
     * Delete a cron job.
     */
    public function destroy(Request $request, Server $server, CronJob $cronJob): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeCronJobBelongsToServer($cronJob, $server);

        $this->activityLog->log(
            'cronjob.deleted',
            "Cron job deleted: {$cronJob->command}",
            $request->user(),
            $server,
        );

        $cronJob->delete();

        try {
            $this->syncCronToServer($server);
        } catch (Exception $e) {
            // Log but don't fail
        }

        return response()->json([
            'message' => 'Cron job deleted successfully.',
        ]);
    }

    /**
     * Sync all cron jobs to the server's crontab.
     */
    protected function syncCronToServer(Server $server): void
    {
        $cronJobs = $server->cronJobs()->where('is_active', true)->get();

        $crontab = "# Managed by OpenVPS - Do not edit manually\n";
        foreach ($cronJobs as $job) {
            $crontab .= "{$job->schedule} {$job->command}\n";
        }

        $user = $cronJobs->first()?->user ?? 'root';
        $escapedCrontab = addslashes($crontab);
        $command = "echo \"{$escapedCrontab}\" | crontab -u {$user} -";

        $this->connectionService->execute($server, $command);
    }

    protected function authorizeServerAccess(Server $server): void
    {
        if ($server->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to this server.');
        }
    }

    protected function authorizeCronJobBelongsToServer(CronJob $cronJob, Server $server): void
    {
        if ($cronJob->server_id !== $server->id) {
            abort(404, 'Cron job not found on this server.');
        }
    }
}
