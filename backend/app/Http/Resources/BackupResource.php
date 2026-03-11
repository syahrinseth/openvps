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
            'type' => $this->type,
            'status' => $this->status,
            'file_path' => $this->path,
            'file_size' => $this->size_mb,
            'notes' => $this->name,
            'started_at' => $this->started_at,
            'completed_at' => $this->completed_at,
            'web_app' => new WebAppResource($this->whenLoaded('webApp')),
            'database' => new DatabaseResource($this->whenLoaded('database')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
