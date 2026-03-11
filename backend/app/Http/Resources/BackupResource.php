<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BackupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'web_app_id' => $this->web_app_id,
            'database_id' => $this->database_id,
            'name' => $this->name,
            'type' => $this->type,
            'status' => $this->status,
            'disk' => $this->disk,
            'path' => $this->path,
            'size_mb' => $this->size_mb,
            'started_at' => $this->started_at,
            'completed_at' => $this->completed_at,
            'web_app' => new WebAppResource($this->whenLoaded('webApp')),
            'database' => new DatabaseResource($this->whenLoaded('database')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
