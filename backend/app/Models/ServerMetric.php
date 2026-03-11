<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServerMetric extends Model
{
    use HasFactory;

    protected $fillable = [
        'server_id',
        'cpu_usage',
        'memory_usage',
        'memory_total',
        'disk_usage',
        'disk_total',
        'network_in',
        'network_out',
        'load_average_1',
        'load_average_5',
        'load_average_15',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'recorded_at' => 'datetime',
            'cpu_usage' => 'decimal:2',
            'memory_usage' => 'decimal:2',
            'disk_usage' => 'decimal:2',
        ];
    }

    public function server()
    {
        return $this->belongsTo(Server::class);
    }
}
