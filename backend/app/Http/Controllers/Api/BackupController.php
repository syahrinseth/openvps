<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BackupResource;
use App\Models\Backup;
use App\Models\Database_;
use App\Models\Server;
use App\Models\WebApp;
use App\Services\ActivityLogService;
use App\Services\BackupService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BackupController extends Controller
{
    public function __construct(
        protected BackupService $backupService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all backups on a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $backups = $server->backups()
            ->with(['webApp', 'database'])
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(BackupResource::collection($backups)->response()->getData(true));
    }

    /**
     * Create a new backup.
     */
    public function store(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:database,application,full'],
            'web_app_id' => ['nullable', 'integer', 'exists:web_apps,id'],
            'database_id' => ['nullable', 'integer', 'exists:databases,id'],
        ]);

        try {
            $webApp = isset($validated['web_app_id'])
                ? WebApp::findOrFail($validated['web_app_id'])
                : null;
            $database = isset($validated['database_id'])
                ? Database_::findOrFail($validated['database_id'])
                : null;

            $backup = $this->backupService->createBackup(
                $server,
                $validated['type'],
                $webApp,
                $database,
            );

            $this->activityLog->log(
                'backup.created',
                "Backup '{$backup->name}' was created on server '{$server->name}'",
                $request->user(),
                $server,
                $backup,
            );

            return response()->json([
                'message' => 'Backup created successfully.',
                'backup' => new BackupResource($backup),
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to create backup.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show backup details.
     */
    public function show(Server $server, Backup $backup): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeBackupBelongsToServer($backup, $server);

        $backup->load(['webApp', 'database']);

        return response()->json([
            'backup' => new BackupResource($backup),
        ]);
    }

    /**
     * Delete a backup.
     */
    public function destroy(Request $request, Server $server, Backup $backup): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeBackupBelongsToServer($backup, $server);

        try {
            $this->backupService->deleteBackup($backup);

            $this->activityLog->log(
                'backup.deleted',
                "Backup '{$backup->name}' was deleted from server '{$server->name}'",
                $request->user(),
                $server,
            );

            return response()->json([
                'message' => 'Backup deleted successfully.',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to delete backup.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Restore a backup.
     */
    public function restore(Request $request, Server $server, Backup $backup): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeBackupBelongsToServer($backup, $server);

        try {
            $restored = $this->backupService->restoreBackup($backup);

            $this->activityLog->log(
                'backup.restored',
                "Backup '{$backup->name}' was restored on server '{$server->name}'",
                $request->user(),
                $server,
                $backup,
            );

            return response()->json([
                'message' => $restored ? 'Backup restored successfully.' : 'Backup restore failed.',
                'restored' => $restored,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to restore backup.',
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

    protected function authorizeBackupBelongsToServer(Backup $backup, Server $server): void
    {
        if ($backup->server_id !== $server->id) {
            abort(404, 'Backup not found on this server.');
        }
    }
}
