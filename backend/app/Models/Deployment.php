<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Deployment extends Model
{
    use HasFactory;

    protected $fillable = [
        'web_app_id',
        'user_id',
        'server_id',
        'commit_hash',
        'commit_message',
        'branch',
        'status',
        'output',
        'error_output',
        'started_at',
        'completed_at',
        'rolled_back_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => 'string',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'rolled_back_at' => 'datetime',
        ];
    }

    public function webApp()
    {
        return $this->belongsTo(WebApp::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function server()
    {
        return $this->belongsTo(Server::class);
    }
}
