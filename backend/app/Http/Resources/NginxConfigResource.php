<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NginxConfigResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'web_app_id' => $this->web_app_id,
            'domain' => $this->domain,
            'config_content' => $this->config_content,
            'is_active' => $this->is_active,
            'is_ssl' => $this->is_ssl,
            'listen_port' => $this->listen_port,
            'root_path' => $this->root_path,
            'web_app' => new WebAppResource($this->whenLoaded('webApp')),
            'ssl_certificates' => SslCertificateResource::collection($this->whenLoaded('sslCertificates')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
