<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CronJobResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'web_app_id' => $this->web_app_id,
            'command' => $this->command,
            'schedule' => $this->schedule,
            'user' => $this->user,
            'description' => $this->description,
            'is_active' => $this->is_active,
            'last_run_at' => $this->last_run_at,
            'next_run_at' => $this->next_run_at,
            'web_app' => new WebAppResource($this->whenLoaded('webApp')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
