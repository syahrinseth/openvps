<?php

namespace App\Http\Requests\Server;

use Illuminate\Foundation\Http\FormRequest;

class StoreServerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'hostname' => ['required', 'string', 'max:255'],
            'ip_address' => ['required', 'ip'],
            'ssh_port' => ['sometimes', 'integer', 'min:1', 'max:65535'],
            'ssh_user' => ['required', 'string', 'max:255'],
            'ssh_private_key' => ['nullable', 'string'],
            'ssh_password' => ['nullable', 'string'],
            'provider' => ['nullable', 'string', 'max:255'],
            'region' => ['nullable', 'string', 'max:255'],
            'plan' => ['nullable', 'string', 'max:255'],
            'os' => ['nullable', 'string', 'max:255'],
            'php_version' => ['nullable', 'string', 'max:10'],
            'web_server' => ['nullable', 'string', 'in:nginx,apache'],
            'database_server' => ['nullable', 'string', 'in:mysql,mariadb,postgresql'],
        ];
    }

    public function messages(): array
    {
        return [
            'ip_address.ip' => 'Please provide a valid IP address.',
            'ssh_port.min' => 'SSH port must be between 1 and 65535.',
        ];
    }
}
