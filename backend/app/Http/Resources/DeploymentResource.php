<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeploymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'web_app_id' => $this->web_app_id,
            'user_id' => $this->user_id,
            'server_id' => $this->server_id,
            'commit_hash' => $this->commit_hash,
            'commit_message' => $this->commit_message,
            'branch' => $this->branch,
            'status' => $this->status,
            'log' => $this->output,
            'error_output' => $this->error_output,
            'started_at' => $this->started_at,
            'completed_at' => $this->completed_at,
            'rolled_back_at' => $this->rolled_back_at,
            'web_app' => new WebAppResource($this->whenLoaded('webApp')),
            'user' => new UserResource($this->whenLoaded('user')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
