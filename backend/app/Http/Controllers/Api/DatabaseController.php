<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Database\StoreDatabaseRequest;
use App\Http\Resources\BackupResource;
use App\Http\Resources\DatabaseResource;
use App\Models\Database_;
use App\Models\Server;
use App\Services\ActivityLogService;
use App\Services\DatabaseService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DatabaseController extends Controller
{
    public function __construct(
        protected DatabaseService $databaseService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all databases on a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $databases = $server->databases()
            ->with('databaseUsers')
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(DatabaseResource::collection($databases)->response()->getData(true));
    }

    /**
     * Create a new database.
     */
    public function store(StoreDatabaseRequest $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        try {
            $database = $this->databaseService->createDatabase(
                $server,
                $request->name,
                $request->input('charset', 'utf8mb4'),
                $request->input('collation', 'utf8mb4_unicode_ci'),
            );

            $this->activityLog->log(
                'database.created',
                "Database '{$request->name}' was created on server '{$server->name}'",
                $request->user(),
                $server,
                $database,
            );

            return response()->json([
                'message' => 'Database created successfully.',
                'database' => new DatabaseResource($database),
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to create database.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show database details.
     */
    public function show(Server $server, Database_ $database): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeDatabaseBelongsToServer($database, $server);

        $database->load('databaseUsers');

        return response()->json([
            'database' => new DatabaseResource($database),
        ]);
    }

    /**
     * Drop a database.
     */
    public function destroy(Request $request, Server $server, Database_ $database): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeDatabaseBelongsToServer($database, $server);

        try {
            $this->databaseService->dropDatabase($server, $database);

            $this->activityLog->log(
                'database.deleted',
                "Database '{$database->name}' was dropped from server '{$server->name}'",
                $request->user(),
                $server,
            );

            return response()->json([
                'message' => 'Database dropped successfully.',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to drop database.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Backup a database.
     */
    public function backup(Request $request, Server $server, Database_ $database): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeDatabaseBelongsToServer($database, $server);

        try {
            $backup = $this->databaseService->backupDatabase($server, $database);

            $this->activityLog->log(
                'database.backup',
                "Database '{$database->name}' was backed up",
                $request->user(),
                $server,
                $backup,
            );

            return response()->json([
                'message' => 'Database backup created successfully.',
                'backup' => new BackupResource($backup),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to backup database.',
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

    protected function authorizeDatabaseBelongsToServer(Database_ $database, Server $server): void
    {
        if ($database->server_id !== $server->id) {
            abort(404, 'Database not found on this server.');
        }
    }
}
