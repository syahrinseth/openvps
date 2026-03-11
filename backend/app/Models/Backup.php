<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Backup extends Model
{
    use HasFactory;

    protected $fillable = [
        'server_id',
        'web_app_id',
        'database_id',
        'name',
        'type',
        'status',
        'disk',
        'path',
        'size_mb',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => 'string',
            'status' => 'string',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
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

    public function database()
    {
        return $this->belongsTo(Database_::class, 'database_id');
    }
}
