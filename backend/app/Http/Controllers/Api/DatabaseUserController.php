<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Database\StoreDatabaseUserRequest;
use App\Http\Resources\DatabaseUserResource;
use App\Models\Database_;
use App\Models\DatabaseUser;
use App\Models\Server;
use App\Services\ActivityLogService;
use App\Services\DatabaseService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DatabaseUserController extends Controller
{
    public function __construct(
        protected DatabaseService $databaseService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all database users on a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $users = $server->databaseUsers()
            ->with('database')
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(DatabaseUserResource::collection($users)->response()->getData(true));
    }

    /**
     * Create a new database user.
     */
    public function store(StoreDatabaseUserRequest $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        try {
            $database = $request->database_id
                ? Database_::findOrFail($request->database_id)
                : null;

            $dbUser = $this->databaseService->createUser(
                $server,
                $request->username,
                $request->password,
                $database,
                $request->input('privileges', ['ALL']),
            );

            $this->activityLog->log(
                'database_user.created',
                "Database user '{$request->username}' was created on server '{$server->name}'",
                $request->user(),
                $server,
                $dbUser,
            );

            return response()->json([
                'message' => 'Database user created successfully.',
                'database_user' => new DatabaseUserResource($dbUser),
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to create database user.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show database user details.
     */
    public function show(Server $server, DatabaseUser $databaseUser): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeUserBelongsToServer($databaseUser, $server);

        $databaseUser->load('database');

        return response()->json([
            'database_user' => new DatabaseUserResource($databaseUser),
        ]);
    }

    /**
     * Update a database user (e.g., change privileges).
     */
    public function update(Request $request, Server $server, DatabaseUser $databaseUser): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeUserBelongsToServer($databaseUser, $server);

        $validated = $request->validate([
            'database_id' => ['nullable', 'integer', 'exists:databases,id'],
            'privileges' => ['sometimes', 'array'],
            'privileges.*' => ['string', 'in:ALL,SELECT,INSERT,UPDATE,DELETE,CREATE,DROP,ALTER,INDEX,REFERENCES'],
        ]);

        try {
            if (isset($validated['database_id']) && isset($validated['privileges'])) {
                $database = Database_::findOrFail($validated['database_id']);
                $this->databaseService->grantPrivileges($server, $databaseUser, $database, $validated['privileges']);
            }

            $databaseUser->update($validated);

            $this->activityLog->log(
                'database_user.updated',
                "Database user '{$databaseUser->username}' was updated",
                $request->user(),
                $server,
                $databaseUser,
            );

            return response()->json([
                'message' => 'Database user updated successfully.',
                'database_user' => new DatabaseUserResource($databaseUser->fresh()->load('database')),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to update database user.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Drop a database user.
     */
    public function destroy(Request $request, Server $server, DatabaseUser $databaseUser): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeUserBelongsToServer($databaseUser, $server);

        try {
            $this->databaseService->dropUser($server, $databaseUser);

            $this->activityLog->log(
                'database_user.deleted',
                "Database user '{$databaseUser->username}' was dropped from server '{$server->name}'",
                $request->user(),
                $server,
            );

            return response()->json([
                'message' => 'Database user dropped successfully.',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to drop database user.',
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

    protected function authorizeUserBelongsToServer(DatabaseUser $dbUser, Server $server): void
    {
        if ($dbUser->server_id !== $server->id) {
            abort(404, 'Database user not found on this server.');
        }
    }
}
