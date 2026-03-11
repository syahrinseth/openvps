<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'server_id' => $this->server_id,
            'loggable_type' => $this->loggable_type,
            'loggable_id' => $this->loggable_id,
            'action' => $this->action,
            'description' => $this->description,
            'properties' => $this->properties,
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'user' => new UserResource($this->whenLoaded('user')),
            'server' => new ServerResource($this->whenLoaded('server')),
            'created_at' => $this->created_at,
        ];
    }
}
