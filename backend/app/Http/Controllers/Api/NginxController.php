<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Nginx\StoreNginxConfigRequest;
use App\Http\Resources\NginxConfigResource;
use App\Models\NginxConfig;
use App\Models\Server;
use App\Models\WebApp;
use App\Services\ActivityLogService;
use App\Services\NginxService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NginxController extends Controller
{
    public function __construct(
        protected NginxService $nginxService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all nginx configs on a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $configs = $server->nginxConfigs()
            ->with('webApp')
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(NginxConfigResource::collection($configs)->response()->getData(true));
    }

    /**
     * Create a new nginx config.
     */
    public function store(StoreNginxConfigRequest $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        try {
            $webApp = $request->web_app_id
                ? WebApp::findOrFail($request->web_app_id)
                : null;

            if ($request->config_content) {
                // Use custom config content
                $config = NginxConfig::create([
                    'server_id' => $server->id,
                    'web_app_id' => $request->web_app_id,
                    'domain' => $request->domain,
                    'config_content' => $request->config_content,
                    'is_active' => true,
                    'is_ssl' => false,
                    'listen_port' => $request->upstream_port,
                    'root_path' => $webApp?->root_directory,
                ]);
            } else {
                $config = $this->nginxService->createVirtualHost(
                    $server,
                    $webApp ?? new WebApp(['root_directory' => "/var/www/{$request->domain}"]),
                    $request->domain,
                    $request->upstream_port,
                );
            }

            $this->activityLog->log(
                'nginx.created',
                "Nginx config for '{$request->domain}' was created",
                $request->user(),
                $server,
                $config,
            );

            return response()->json([
                'message' => 'Nginx config created successfully.',
                'data' => new NginxConfigResource($config),
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to create nginx config.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show a nginx config.
     */
    public function show(Server $server, NginxConfig $nginxConfig): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeConfigBelongsToServer($nginxConfig, $server);

        $nginxConfig->load(['webApp', 'sslCertificates']);

        return response()->json([
            'data' => new NginxConfigResource($nginxConfig),
        ]);
    }

    /**
     * Update a nginx config.
     */
    public function update(Request $request, Server $server, NginxConfig $nginxConfig): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeConfigBelongsToServer($nginxConfig, $server);

        $validated = $request->validate([
            'config_content' => ['sometimes', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $nginxConfig->update($validated);

        $this->activityLog->log(
            'nginx.updated',
            "Nginx config for '{$nginxConfig->domain}' was updated",
            $request->user(),
            $server,
            $nginxConfig,
        );

        return response()->json([
            'message' => 'Nginx config updated successfully.',
            'data' => new NginxConfigResource($nginxConfig->fresh()),
        ]);
    }

    /**
     * Remove a nginx config.
     */
    public function destroy(Request $request, Server $server, NginxConfig $nginxConfig): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeConfigBelongsToServer($nginxConfig, $server);

        try {
            $this->nginxService->removeVirtualHost($server, $nginxConfig);

            $this->activityLog->log(
                'nginx.deleted',
                "Nginx config for '{$nginxConfig->domain}' was removed",
                $request->user(),
                $server,
            );

            return response()->json([
                'message' => 'Nginx config removed successfully.',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to remove nginx config.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reload nginx on the server.
     */
    public function reload(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        try {
            $success = $this->nginxService->reloadNginx($server);

            return response()->json([
                'message' => $success ? 'Nginx reloaded successfully.' : 'Failed to reload nginx.',
                'success' => $success,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to reload nginx.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Test nginx config on the server.
     */
    public function test(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        try {
            $valid = $this->nginxService->testConfig($server);

            return response()->json([
                'valid' => $valid,
                'message' => $valid ? 'Nginx configuration is valid.' : 'Nginx configuration has errors.',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to test nginx config.',
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

    protected function authorizeConfigBelongsToServer(NginxConfig $config, Server $server): void
    {
        if ($config->server_id !== $server->id) {
            abort(404, 'Nginx config not found on this server.');
        }
    }
}
