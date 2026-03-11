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
            'port' => $this->port,
            'ssh_user' => $this->ssh_user,
            'provider' => $this->provider,
            'region' => $this->region,
            'plan' => $this->plan,
            'os' => $this->os,
            'status' => $this->status,
            'php_version' => $this->php_version,
            'web_server' => $this->web_server,
            'database_server' => $this->database_server,
            'web_apps' => WebAppResource::collection($this->whenLoaded('webApps')),
            'web_apps_count' => $this->when($this->web_apps_count !== null, $this->web_apps_count),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
