<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DatabaseUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'database_id' => $this->database_id,
            'username' => $this->username,
            'host' => $this->host,
            'privileges' => $this->privileges,
            'database' => new DatabaseResource($this->whenLoaded('database')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
