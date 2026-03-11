<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FirewallRuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'name' => $this->name,
            'rule_type' => $this->rule_type,
            'direction' => $this->direction,
            'protocol' => $this->protocol,
            'port' => $this->port,
            'from_ip' => $this->from_ip,
            'to_ip' => $this->to_ip,
            'is_active' => $this->is_active,
            'description' => $this->description,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
