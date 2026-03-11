<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DatabaseUser extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'server_id',
        'database_id',
        'username',
        'password',
        'host',
        'privileges',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'encrypted',
            'privileges' => 'array',
        ];
    }

    public function server()
    {
        return $this->belongsTo(Server::class);
    }

    public function database()
    {
        return $this->belongsTo(Database_::class, 'database_id');
    }
}
