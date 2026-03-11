<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SslCertificateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'web_app_id' => $this->web_app_id,
            'nginx_config_id' => $this->nginx_config_id,
            'domain' => $this->domain,
            'type' => $this->type,
            'status' => $this->status,
            'auto_renew' => $this->auto_renew,
            'issued_at' => $this->issued_at,
            'expires_at' => $this->expires_at,
            'web_app' => new WebAppResource($this->whenLoaded('webApp')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
