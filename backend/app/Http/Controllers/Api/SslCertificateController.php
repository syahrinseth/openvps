<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SslCertificateResource;
use App\Models\Server;
use App\Models\SslCertificate;
use App\Services\ActivityLogService;
use App\Services\SslService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SslCertificateController extends Controller
{
    public function __construct(
        protected SslService $sslService,
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all SSL certificates on a server.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $certificates = $server->sslCertificates()
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(SslCertificateResource::collection($certificates)->response()->getData(true));
    }

    /**
     * Request a new SSL certificate.
     */
    public function store(Request $request, Server $server): JsonResponse
    {
        $this->authorizeServerAccess($server);

        $validated = $request->validate([
            'domain' => [
                'required',
                'string',
                'max:255',
                // RFC-1123 hostname: labels separated by dots, each label 1–63 chars, letters/digits/hyphens,
                // cannot start or end with a hyphen, TLD must be at least 2 alphabetic chars.
                'regex:/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/',
            ],
            'web_app_id'      => ['nullable', 'integer', 'exists:web_apps,id'],
            'nginx_config_id' => ['nullable', 'integer', 'exists:nginx_configs,id'],
        ], [
            'domain.regex' => 'The domain must be a valid hostname (e.g. example.com or sub.example.com).',
        ]);

        try {
            $certificate = $this->sslService->requestCertificate($server, $validated['domain']);

            if (!empty($validated['web_app_id'])) {
                $certificate->update(['web_app_id' => $validated['web_app_id']]);
            }
            if (!empty($validated['nginx_config_id'])) {
                $certificate->update(['nginx_config_id' => $validated['nginx_config_id']]);
            }

            try {
                $this->activityLog->log(
                    'ssl.created',
                    "SSL certificate for '{$validated['domain']}' was requested",
                    $request->user(),
                    $server,
                    $certificate,
                );
            } catch (Exception $e) {
                // Activity logging is non-critical — log and continue
                \Illuminate\Support\Facades\Log::warning('Failed to write SSL activity log', [
                    'error' => $e->getMessage(),
                ]);
            }

            return response()->json([
                'message' => 'SSL certificate requested successfully.',
                'data'    => new SslCertificateResource($certificate),
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to request SSL certificate.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show SSL certificate details.
     */
    public function show(Server $server, SslCertificate $sslCertificate): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeCertBelongsToServer($sslCertificate, $server);

        $daysRemaining = $this->sslService->checkExpiration($sslCertificate);

        return response()->json([
            'data'                 => new SslCertificateResource($sslCertificate),
            'days_until_expiration' => $daysRemaining,
        ]);
    }

    /**
     * Revoke an SSL certificate.
     */
    public function destroy(Request $request, Server $server, SslCertificate $sslCertificate): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeCertBelongsToServer($sslCertificate, $server);

        try {
            $this->sslService->revokeCertificate($server, $sslCertificate);

            try {
                $this->activityLog->log(
                    'ssl.revoked',
                    "SSL certificate for '{$sslCertificate->domain}' was revoked",
                    $request->user(),
                    $server,
                    $sslCertificate,
                );
            } catch (Exception $e) {
                \Illuminate\Support\Facades\Log::warning('Failed to write SSL revoke activity log', [
                    'error' => $e->getMessage(),
                ]);
            }

            return response()->json([
                'message' => 'SSL certificate revoked successfully.',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to revoke SSL certificate.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Renew an SSL certificate.
     */
    public function renew(Request $request, Server $server, SslCertificate $sslCertificate): JsonResponse
    {
        $this->authorizeServerAccess($server);
        $this->authorizeCertBelongsToServer($sslCertificate, $server);

        try {
            $renewed = $this->sslService->renewCertificate($server, $sslCertificate);

            try {
                $this->activityLog->log(
                    'ssl.renewed',
                    "SSL certificate for '{$sslCertificate->domain}' was renewed",
                    $request->user(),
                    $server,
                    $sslCertificate,
                );
            } catch (Exception $e) {
                \Illuminate\Support\Facades\Log::warning('Failed to write SSL renew activity log', [
                    'error' => $e->getMessage(),
                ]);
            }

            return response()->json([
                'message' => $renewed ? 'SSL certificate renewed successfully.' : 'SSL certificate renewal failed.',
                'renewed' => $renewed,
                'data'    => new SslCertificateResource($sslCertificate->fresh()),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to renew SSL certificate.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    protected function authorizeServerAccess(Server $server): void
    {
        if ($server->user_id !== auth()->id()) {
            abort(403, 'Unauthorized access to this server.');
        }
    }

    protected function authorizeCertBelongsToServer(SslCertificate $cert, Server $server): void
    {
        if ($cert->server_id !== $server->id) {
            abort(404, 'SSL certificate not found on this server.');
        }
    }
}
