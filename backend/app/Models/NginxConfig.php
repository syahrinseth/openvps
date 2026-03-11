<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NginxConfig extends Model
{
    use HasFactory;

    protected $fillable = [
        'server_id',
        'web_app_id',
        'domain',
        'config_content',
        'is_active',
        'is_ssl',
        'listen_port',
        'root_path',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_ssl' => 'boolean',
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

    public function sslCertificates()
    {
        return $this->hasMany(SslCertificate::class);
    }
}
