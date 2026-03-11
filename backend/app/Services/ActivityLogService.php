<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Server;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class ActivityLogService
{
    /**
     * Log an activity.
     */
    public function log(
        string $action,
        string $description,
        ?User $user = null,
        ?Server $server = null,
        ?Model $loggable = null,
        ?array $properties = null,
    ): ActivityLog {
        return ActivityLog::create([
            'user_id' => $user?->id,
            'server_id' => $server?->id,
            'loggable_type' => $loggable ? get_class($loggable) : null,
            'loggable_id' => $loggable?->getKey(),
            'action' => $action,
            'description' => $description,
            'properties' => $properties,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }
}
