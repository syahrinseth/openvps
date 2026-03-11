<?php

use App\Models\Server;
use App\Services\ServerMonitorService;
use App\Services\SslService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Collect server metrics every 5 minutes
Schedule::call(function () {
    $monitor = app(ServerMonitorService::class);
    Server::all()->each(function (Server $server) use ($monitor) {
        try {
            $monitor->collectMetrics($server);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Metric collection failed for server {$server->id}: {$e->getMessage()}");
        }
    });
})->everyFiveMinutes()->name('collect-server-metrics')->withoutOverlapping();

// Auto-renew SSL certificates daily at 3am
Schedule::call(function () {
    $sslService = app(SslService::class);
    Server::all()->each(function (Server $server) use ($sslService) {
        try {
            $sslService->autoRenewAll($server);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("SSL auto-renew failed for server {$server->id}: {$e->getMessage()}");
        }
    });
})->dailyAt('03:00')->name('ssl-auto-renew')->withoutOverlapping();
