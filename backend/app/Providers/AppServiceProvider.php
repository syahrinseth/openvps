<?php

namespace App\Providers;

use App\Models\WebApp;
use App\Observers\WebAppObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        WebApp::observe(WebAppObserver::class);
    }
}
