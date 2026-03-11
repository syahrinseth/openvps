<?php

namespace App\Http\Requests\Firewall;

use Illuminate\Foundation\Http\FormRequest;

class StoreFirewallRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['nullable', 'string', 'max:255'],
            'rule_type' => ['required', 'string', 'in:allow,deny'],
            'direction' => ['required', 'string', 'in:in,out'],
            'protocol' => ['required', 'string', 'in:tcp,udp,both'],
            'port' => ['required', 'string', 'max:20'],
            'from_ip' => ['nullable', 'string', 'max:45'],
            'to_ip' => ['nullable', 'string', 'max:45'],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }
}
