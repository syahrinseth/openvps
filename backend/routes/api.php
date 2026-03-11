<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ServerController;
use App\Http\Controllers\Api\WebAppController;
use App\Http\Controllers\Api\NginxController;
use App\Http\Controllers\Api\SslCertificateController;
use App\Http\Controllers\Api\DatabaseController;
use App\Http\Controllers\Api\DatabaseUserController;
use App\Http\Controllers\Api\FirewallController;
use App\Http\Controllers\Api\GithubWebhookController;
use App\Http\Controllers\Api\DeploymentController;
use App\Http\Controllers\Api\ServerMetricController;
use App\Http\Controllers\Api\BackupController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\CronJobController;

// Public routes
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// GitHub webhook handler (public - validated by secret)
Route::post('/webhooks/github/{secret}', [GithubWebhookController::class, 'handleWebhook']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user', [AuthController::class, 'user']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Servers
    Route::apiResource('servers', ServerController::class);
    Route::post('/servers/{server}/test-connection', [ServerController::class, 'testConnection']);

    // Server nested resources
    Route::prefix('servers/{server}')->group(function () {
        // Web Apps
        Route::apiResource('web-apps', WebAppController::class);
        Route::post('/web-apps/{web_app}/deploy', [WebAppController::class, 'deploy']);
        Route::post('/web-apps/{web_app}/restart', [WebAppController::class, 'restart']);

        // Nginx
        Route::apiResource('nginx', NginxController::class);
        Route::post('/nginx-reload', [NginxController::class, 'reload']);
        Route::post('/nginx-test', [NginxController::class, 'test']);

        // SSL Certificates
        Route::apiResource('ssl-certificates', SslCertificateController::class)->except(['update']);
        Route::post('/ssl-certificates/{ssl_certificate}/renew', [SslCertificateController::class, 'renew']);

        // Databases
        Route::apiResource('databases', DatabaseController::class)->except(['update']);
        Route::post('/databases/{database}/backup', [DatabaseController::class, 'backup']);

        // Database Users
        Route::apiResource('database-users', DatabaseUserController::class);

        // Firewall
        Route::apiResource('firewall-rules', FirewallController::class);
        Route::get('/firewall-status', [FirewallController::class, 'status']);
        Route::post('/firewall-sync', [FirewallController::class, 'sync']);

        // GitHub Webhooks
        Route::apiResource('github-webhooks', GithubWebhookController::class);

        // Deployments
        Route::get('/deployments', [DeploymentController::class, 'serverIndex']);
        Route::get('/web-apps/{web_app}/deployments', [DeploymentController::class, 'index']);
        Route::get('/web-apps/{web_app}/deployments/{deployment}', [DeploymentController::class, 'show']);
        Route::post('/web-apps/{web_app}/deployments/{deployment}/rollback', [DeploymentController::class, 'rollback']);

        // Server Metrics
        Route::get('/metrics', [ServerMetricController::class, 'index']);
        Route::get('/metrics/latest', [ServerMetricController::class, 'latest']);
        Route::post('/metrics/collect', [ServerMetricController::class, 'collect']);

        // Backups
        Route::apiResource('backups', BackupController::class)->except(['update']);
        Route::post('/backups/{backup}/restore', [BackupController::class, 'restore']);

        // Cron Jobs
        Route::apiResource('cron-jobs', CronJobController::class);
    });

    // Activity Logs
    Route::get('/activity-logs', [ActivityLogController::class, 'index']);
    Route::get('/activity-logs/{activityLog}', [ActivityLogController::class, 'show']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);

    // User Management (admin only)
    Route::middleware('role:admin')->group(function () {
        Route::apiResource('users', UserManagementController::class);
        Route::post('/users/{user}/assign-role', [UserManagementController::class, 'assignRole']);
    });
});
