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
        $data['ssh_port'] = $data['ssh_port'] ?? 22;
        $data['status'] = 'active';
        $data['os_type'] = $data['os_type'] ?? 'linux';
        $data['os_version'] = $data['os_version'] ?? 'unknown';

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

        // ssh_port maps directly to the ssh_port column — no remapping needed
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
     * Test SSH connection using raw credentials (before a server is saved).
     */
    public function testConnectionWithCredentials(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ip_address'      => ['required', 'string'],
            'ssh_port'        => ['required', 'integer', 'min:1', 'max:65535'],
            'ssh_user'        => ['required', 'string'],
            'ssh_private_key' => ['nullable', 'string'],
            'ssh_password'    => ['nullable', 'string'],
        ]);

        $connected = $this->connectionService->testConnectionWithCredentials(
            ipAddress:     $validated['ip_address'],
            port:          $validated['ssh_port'],
            sshUser:       $validated['ssh_user'],
            sshPrivateKey: $validated['ssh_private_key'] ?? null,
            sshPassword:   $validated['ssh_password'] ?? null,
        );

        return response()->json([
            'connected' => $connected,
            'message'   => $connected ? 'Connection successful.' : 'Connection failed.',
        ]);
    }

    /**
     * Test SSH connection to a server.
     */
    public function testConnection(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $connected = $this->connectionService->testConnection($server);

        $server->update(['status' => $connected ? 'active' : 'unreachable']);

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
