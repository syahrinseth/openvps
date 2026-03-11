<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FirewallRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'server_id',
        'name',
        'rule_type',
        'direction',
        'protocol',
        'port',
        'from_ip',
        'to_ip',
        'is_active',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'rule_type' => 'string',
            'direction' => 'string',
            'protocol' => 'string',
            'is_active' => 'boolean',
        ];
    }

    public function server()
    {
        return $this->belongsTo(Server::class);
    }
}
