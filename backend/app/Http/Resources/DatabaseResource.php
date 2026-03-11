<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DatabaseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'name' => $this->name,
            'type' => $this->type,
            'charset' => $this->charset,
            'collation' => $this->collation,
            'size_mb' => $this->size_mb,
            'server' => new ServerResource($this->whenLoaded('server')),
            'database_users' => DatabaseUserResource::collection($this->whenLoaded('databaseUsers')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
