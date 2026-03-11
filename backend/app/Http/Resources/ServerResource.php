<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'name' => $this->name,
            'hostname' => $this->hostname,
            'ip_address' => $this->ip_address,
            'ssh_port' => $this->ssh_port,
            'ssh_user' => $this->ssh_user,
            'provider' => $this->provider,
            'os_type' => $this->os_type,
            'os_version' => $this->os_version,
            'status' => $this->status,
            'notes' => $this->notes,
            'last_connected_at' => $this->last_connected_at,
            'web_apps' => WebAppResource::collection($this->whenLoaded('webApps')),
            'web_apps_count' => $this->when($this->web_apps_count !== null, $this->web_apps_count),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
