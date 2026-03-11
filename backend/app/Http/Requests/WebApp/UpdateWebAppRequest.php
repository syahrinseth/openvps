<?php

namespace App\Http\Requests\WebApp;

use Illuminate\Foundation\Http\FormRequest;

class UpdateWebAppRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'domain' => ['sometimes', 'string', 'max:255'],
            'app_type' => ['sometimes', 'string', 'in:php,nodejs,python,static,laravel'],
            'git_repository' => ['nullable', 'string', 'max:500'],
            'git_branch' => ['nullable', 'string', 'max:255'],
            'deploy_path' => ['nullable', 'string', 'max:500'],
            'port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'php_version' => ['nullable', 'string', 'max:10'],
            'deploy_script' => ['nullable', 'string'],
            'environment_variables' => ['nullable', 'string'],
            'auto_deploy' => ['sometimes', 'boolean'],
        ];
    }
}
