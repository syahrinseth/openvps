<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GithubWebhookResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'web_app_id' => $this->web_app_id,
            'repository' => $this->whenLoaded('webApp', fn () => $this->webApp?->repository_url),
            'branch' => $this->whenLoaded('webApp', fn () => $this->webApp?->repository_branch),
            'webhook_url' => $this->webhook_url,
            'events' => $this->events,
            'is_active' => $this->is_active,
            'last_delivery_at' => $this->last_delivery_at,
            'web_app' => new WebAppResource($this->whenLoaded('webApp')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
