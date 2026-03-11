<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SslCertificate extends Model
{
    use HasFactory;

    protected $fillable = [
        'server_id',
        'web_app_id',
        'nginx_config_id',
        'domain',
        'type',
        'status',
        'certificate_path',
        'private_key_path',
        'chain_path',
        'auto_renew',
        'issued_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => 'string',
            'status' => 'string',
            'auto_renew' => 'boolean',
            'issued_at' => 'datetime',
            'expires_at' => 'datetime',
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

    public function nginxConfig()
    {
        return $this->belongsTo(NginxConfig::class);
    }
}
