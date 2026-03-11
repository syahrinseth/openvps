<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Server\StoreServerRequest;
use App\Http\Requests\Server\UpdateServerRequest;
use App\Http\Resources\ServerResource;
use App\Models\Server;
use App\Services\ActivityLogService;
use App\Services\ServerConnectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServerController extends Controller
{
    public function __construct(
        protected ServerConnectionService $connectionService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all servers belonging to the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $servers = $request->user()
            ->servers()
            ->withCount('webApps')
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(ServerResource::collection($servers)->response()->getData(true));
    }

    /**
     * Store a new server.
     */
    public function store(StoreServerRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['user_id'] = $request->user()->id;
        $data['port'] = $data['ssh_port'] ?? 22;
        $data['status'] = 'active';
        unset($data['ssh_port']);

        $server = Server::create($data);

        $this->activityLog->log(
            'server.created',
            "Server '{$server->name}' was created",
            $request->user(),
            $server,
            $server,
        );

        return response()->json([
            'message' => 'Server created successfully.',
            'data' => new ServerResource($server),
        ], 201);
    }

    /**
     * Show a server's details.
     */
    public function show(Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $server->loadCount('webApps');

        return response()->json([
            'data' => new ServerResource($server),
        ]);
    }

    /**
     * Update a server.
     */
    public function update(UpdateServerRequest $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $data = $request->validated();

        if (isset($data['ssh_port'])) {
            $data['port'] = $data['ssh_port'];
            unset($data['ssh_port']);
        }

        $server->update($data);

        $this->activityLog->log(
            'server.updated',
            "Server '{$server->name}' was updated",
            $request->user(),
            $server,
            $server,
        );

        return response()->json([
            'message' => 'Server updated successfully.',
            'data' => new ServerResource($server->fresh()),
        ]);
    }

    /**
     * Delete a server.
     */
    public function destroy(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $this->activityLog->log(
            'server.deleted',
            "Server '{$server->name}' was deleted",
            $request->user(),
            $server,
            $server,
        );

        $server->delete();

        return response()->json([
            'message' => 'Server deleted successfully.',
        ]);
    }

    /**
     * Test SSH connection to a server.
     */
    public function testConnection(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $connected = $this->connectionService->testConnection($server);

        $server->update(['status' => $connected ? 'active' : 'disconnected']);

        return response()->json([
            'connected' => $connected,
            'message' => $connected ? 'Connection successful.' : 'Connection failed.',
        ]);
    }

    /**
     * Ensure the authenticated user owns the server.
     */
    protected function authorizeServerAccess(Server $server): void
    {
        if ($server->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to this server.');
        }
    }
}
