<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\GithubWebhookResource;
use App\Models\GithubWebhook;
use App\Models\Server;
use App\Services\ActivityLogService;
use App\Services\DeploymentService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GithubWebhookController extends Controller
{
    public function __construct(
        protected DeploymentService $deploymentService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all webhooks on a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $webhooks = $server->githubWebhooks()
            ->with('webApp')
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(GithubWebhookResource::collection($webhooks)->response()->getData(true));
    }

    /**
     * Create a new webhook.
     */
    public function store(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $validated = $request->validate([
            'web_app_id' => ['required', 'integer', 'exists:web_apps,id'],
            'events' => ['sometimes', 'array'],
            'events.*' => ['string', 'in:push,pull_request,release,create,delete'],
        ]);

        $secret = Str::random(40);

        $webhook = GithubWebhook::create([
            'server_id' => $server->id,
            'web_app_id' => $validated['web_app_id'],
            'webhook_url' => route('api.webhooks.handle', ['secret' => $secret]),
            'secret' => $secret,
            'events' => $validated['events'] ?? ['push'],
            'is_active' => true,
        ]);

        $this->activityLog->log(
            'webhook.created',
            'GitHub webhook created',
            $request->user(),
            $server,
            $webhook,
        );

        return response()->json([
            'message' => 'GitHub webhook created successfully.',
            'data' => new GithubWebhookResource($webhook->load('webApp')),
            'secret' => $secret, // Only shown once at creation
        ], 201);
    }

    /**
     * Show webhook details.
     */
    public function show(Server $server, GithubWebhook $githubWebhook): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebhookBelongsToServer($githubWebhook, $server);

        $githubWebhook->load('webApp');

        return response()->json([
            'data' => new GithubWebhookResource($githubWebhook),
        ]);
    }

    /**
     * Update a webhook.
     */
    public function update(Request $request, Server $server, GithubWebhook $githubWebhook): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebhookBelongsToServer($githubWebhook, $server);

        $validated = $request->validate([
            'events' => ['sometimes', 'array'],
            'events.*' => ['string', 'in:push,pull_request,release,create,delete'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $githubWebhook->update($validated);

        $this->activityLog->log(
            'webhook.updated',
            'GitHub webhook updated',
            $request->user(),
            $server,
            $githubWebhook,
        );

        return response()->json([
            'message' => 'GitHub webhook updated successfully.',
            'data' => new GithubWebhookResource($githubWebhook->fresh()->load('webApp')),
        ]);
    }

    /**
     * Delete a webhook.
     */
    public function destroy(Request $request, Server $server, GithubWebhook $githubWebhook): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeWebhookBelongsToServer($githubWebhook, $server);

        $this->activityLog->log(
            'webhook.deleted',
            'GitHub webhook deleted',
            $request->user(),
            $server,
        );

        $githubWebhook->delete();

        return response()->json([
            'message' => 'GitHub webhook deleted successfully.',
        ]);
    }

    /**
     * Handle incoming GitHub webhook (public endpoint).
     */
    public function handleWebhook(Request $request, string $secret): JsonResponse
    {
        $webhook = GithubWebhook::where('secret', $secret)
            ->where('is_active', true)
            ->first();

        if (!$webhook) {
            return response()->json(['message' => 'Invalid webhook.'], 404);
        }

        // Verify GitHub signature
        $signature = $request->header('X-Hub-Signature-256');
        if ($signature) {
            $expectedSignature = 'sha256=' . hash_hmac('sha256', $request->getContent(), $webhook->secret);
            if (!hash_equals($expectedSignature, $signature)) {
                return response()->json(['message' => 'Invalid signature.'], 403);
            }
        }

        $event = $request->header('X-GitHub-Event', 'push');

        if (!in_array($event, $webhook->events ?? ['push'])) {
            return response()->json(['message' => 'Event not configured.'], 200);
        }

        $webhook->update(['last_delivery_at' => now()]);

        if ($event === 'push') {
            $webApp = $webhook->webApp;
            $payload = $request->all();
            $branch = str_replace('refs/heads/', '', $payload['ref'] ?? '');

            if ($branch === ($webApp->git_branch ?? 'main') && $webApp->auto_deploy) {
                try {
                    $commitHash = $payload['after'] ?? null;
                    $this->deploymentService->deploy($webApp, $commitHash);

                    return response()->json([
                        'message' => 'Deployment triggered successfully.',
                    ]);
                } catch (Exception $e) {
                    return response()->json([
                        'message' => 'Deployment failed.',
                        'error' => $e->getMessage(),
                    ], 500);
                }
            }
        }

        return response()->json([
            'message' => 'Webhook received.',
        ]);
    }

    protected function authorizeServerAccess(Server $server): void
    {
        if ($server->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to this server.');
        }
    }

    protected function authorizeWebhookBelongsToServer(GithubWebhook $webhook, Server $server): void
    {
        if ($webhook->server_id !== $server->id) {
            abort(404, 'Webhook not found on this server.');
        }
    }
}
