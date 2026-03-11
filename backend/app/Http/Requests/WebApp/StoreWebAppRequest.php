<?php

namespace App\Http\Requests\WebApp;

use Illuminate\Foundation\Http\FormRequest;

class StoreWebAppRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'domain' => ['required', 'string', 'max:255'],
            'app_type' => ['required', 'string', 'in:laravel,nodejs,react,static,custom'],
            'git_repository' => ['nullable', 'string', 'max:500'],
            'git_branch' => ['nullable', 'string', 'max:255'],
            'deploy_path' => ['required', 'string', 'max:500'],
            'docker_compose_path' => ['nullable', 'string', 'max:500'],
            'port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'docker_container_name' => ['nullable', 'string', 'max:255'],
            'environment_variables' => ['nullable', 'string'],
            'auto_deploy' => ['sometimes', 'boolean'],
        ];
    }
}
