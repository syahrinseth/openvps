<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebAppResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'user_id' => $this->user_id,
            'name' => $this->name,
            'domain' => $this->domain,
            'app_type' => $this->app_type,
            'root_directory' => $this->root_directory,
            'web_directory' => $this->web_directory,
            'php_version' => $this->php_version,
            'repository_url' => $this->repository_url,
            'repository_branch' => $this->repository_branch,
            'auto_deploy' => $this->auto_deploy,
            'status' => $this->status,
            'server' => new ServerResource($this->whenLoaded('server')),
            'deployments' => DeploymentResource::collection($this->whenLoaded('deployments')),
            'nginx_configs' => NginxConfigResource::collection($this->whenLoaded('nginxConfigs')),
            'ssl_certificates' => SslCertificateResource::collection($this->whenLoaded('sslCertificates')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
