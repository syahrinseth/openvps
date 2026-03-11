<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServerMetricResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'cpu_usage' => $this->cpu_usage,
            'memory_usage' => $this->memory_usage,
            'memory_total' => $this->memory_total,
            'disk_usage' => $this->disk_usage,
            'disk_total' => $this->disk_total,
            'network_in' => $this->network_in,
            'network_out' => $this->network_out,
            'load_average_1' => $this->load_average_1,
            'load_average_5' => $this->load_average_5,
            'load_average_15' => $this->load_average_15,
            'recorded_at' => $this->recorded_at,
            'created_at' => $this->created_at,
        ];
    }
}
