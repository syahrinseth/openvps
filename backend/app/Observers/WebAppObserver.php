<?php

namespace App\Observers;

use App\Models\WebApp;
use Illuminate\Support\Facades\Log;

class WebAppObserver
{
    /**
     * Handle the WebApp "created" event.
     * We don't auto-setup here — the user triggers setup manually.
     * We only set the initial status.
     */
    public function created(WebApp $webApp): void
    {
        if (empty($webApp->status)) {
            $webApp->updateQuietly(['status' => 'stopped']);
        }
    }

    /**
     * Handle the WebApp "deleted" event.
     * Log the deletion for audit purposes.
     */
    public function deleted(WebApp $webApp): void
    {
        Log::info("WebApp [{$webApp->name}] (ID: {$webApp->id}) was deleted.");
    }
}
