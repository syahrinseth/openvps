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
            'name'            => ['required', 'string', 'max:255'],
            'hostname'        => ['required', 'string', 'max:255'],
            'ip_address'      => ['required', 'ip'],
            'ssh_port'        => ['sometimes', 'integer', 'min:1', 'max:65535'],
            'ssh_user'        => ['required', 'string', 'max:255'],
            'ssh_private_key'    => ['nullable', 'string'],
            'ssh_key_passphrase' => ['nullable', 'string'],
            'ssh_password'       => ['nullable', 'string'],
            'provider'        => ['required', 'string', 'max:255'],
            'notes'           => ['nullable', 'string'],
            'os_type'         => ['nullable', 'string', 'max:255'],
            'os_version'      => ['nullable', 'string', 'max:255'],
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
