<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GithubWebhook extends Model
{
    use HasFactory;

    protected $fillable = [
        'server_id',
        'web_app_id',
        'webhook_url',
        'secret',
        'events',
        'is_active',
        'last_delivery_at',
    ];

    protected $hidden = [
        'secret',
    ];

    protected function casts(): array
    {
        return [
            'secret' => 'encrypted',
            'events' => 'array',
            'is_active' => 'boolean',
            'last_delivery_at' => 'datetime',
        ];
    }

    public function server()
    {
        return $this->belongsTo(Server::class);
    }

    public function webApp()
    {
        return $this->belongsTo(WebApp::class);
    }
}
