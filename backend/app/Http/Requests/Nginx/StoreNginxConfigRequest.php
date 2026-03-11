<?php

namespace App\Http\Requests\Nginx;

use Illuminate\Foundation\Http\FormRequest;

class StoreNginxConfigRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'domain' => ['required', 'string', 'max:255'],
            'web_app_id' => ['nullable', 'integer', 'exists:web_apps,id'],
            'upstream_port' => ['required', 'integer', 'min:1', 'max:65535'],
            'config_content' => ['nullable', 'string'],
        ];
    }
}
