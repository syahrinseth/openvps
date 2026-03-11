<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Firewall\StoreFirewallRuleRequest;
use App\Http\Resources\FirewallRuleResource;
use App\Models\FirewallRule;
use App\Models\Server;
use App\Services\ActivityLogService;
use App\Services\FirewallService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FirewallController extends Controller
{
    public function __construct(
        protected FirewallService $firewallService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all firewall rules on a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $rules = $server->firewallRules()
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(FirewallRuleResource::collection($rules)->response()->getData(true));
    }

    /**
     * Add a firewall rule.
     */
    public function store(StoreFirewallRuleRequest $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        try {
            $rule = $this->firewallService->addRule($server, $request->validated());

            $this->activityLog->log(
                'firewall.rule_added',
                "Firewall rule added: {$rule->rule_type} port {$rule->port}",
                $request->user(),
                $server,
                $rule,
            );

            return response()->json([
                'message' => 'Firewall rule added successfully.',
                'data' => new FirewallRuleResource($rule),
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to add firewall rule.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show a firewall rule.
     */
    public function show(Server $server, FirewallRule $firewallRule): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeRuleBelongsToServer($firewallRule, $server);

        return response()->json([
            'data' => new FirewallRuleResource($firewallRule),
        ]);
    }

    /**
     * Update a firewall rule.
     */
    public function update(Request $request, Server $server, FirewallRule $firewallRule): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeRuleBelongsToServer($firewallRule, $server);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $firewallRule->update($validated);

        $this->activityLog->log(
            'firewall.rule_updated',
            "Firewall rule updated: {$firewallRule->rule_type} port {$firewallRule->port}",
            $request->user(),
            $server,
            $firewallRule,
        );

        return response()->json([
            'message' => 'Firewall rule updated successfully.',
            'data' => new FirewallRuleResource($firewallRule->fresh()),
        ]);
    }

    /**
     * Remove a firewall rule.
     */
    public function destroy(Request $request, Server $server, FirewallRule $firewallRule): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeRuleBelongsToServer($firewallRule, $server);

        try {
            $this->firewallService->removeRule($server, $firewallRule);

            $this->activityLog->log(
                'firewall.rule_removed',
                "Firewall rule removed: {$firewallRule->rule_type} port {$firewallRule->port}",
                $request->user(),
                $server,
            );

            return response()->json([
                'message' => 'Firewall rule removed successfully.',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to remove firewall rule.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get firewall status.
     */
    public function status(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        try {
            $status = $this->firewallService->getStatus($server);

            return response()->json([
                'status' => $status,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to get firewall status.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Sync firewall rules with the server.
     */
    public function sync(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        try {
            $this->firewallService->syncRules($server);

            $this->activityLog->log(
                'firewall.synced',
                'Firewall rules synced with server',
                $request->user(),
                $server,
            );

            return response()->json([
                'message' => 'Firewall rules synced successfully.',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to sync firewall rules.',
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

    protected function authorizeRuleBelongsToServer(FirewallRule $rule, Server $server): void
    {
        if ($rule->server_id !== $server->id) {
            abort(404, 'Firewall rule not found on this server.');
        }
    }
}
