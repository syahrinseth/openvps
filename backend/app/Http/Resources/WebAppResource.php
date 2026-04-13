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
            'git_repository' => $this->git_repository,
            'git_branch' => $this->git_branch ?? 'main',
            'has_git_token' => !empty($this->git_token),
            'has_git_deploy_key' => !empty($this->git_deploy_key),
            'git_deploy_key_public' => $this->git_deploy_key_public,
            'deploy_path' => $this->deploy_path,
            'docker_compose_path' => $this->docker_compose_path,
            'port' => $this->port,
            'docker_container_name' => $this->docker_container_name,
            'auto_deploy' => $this->auto_deploy,
            'environment_variables' => $this->environment_variables,
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
