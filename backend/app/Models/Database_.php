<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Database_ extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The table associated with the model.
     */
    protected $table = 'databases';

    protected $fillable = [
        'server_id',
        'name',
        'type',
        'charset',
        'collation',
        'size_mb',
    ];

    protected function casts(): array
    {
        return [
            'size_mb' => 'decimal:2',
        ];
    }

    public function server()
    {
        return $this->belongsTo(Server::class);
    }

    public function databaseUsers()
    {
        return $this->hasMany(DatabaseUser::class, 'database_id');
    }

    public function backups()
    {
        return $this->hasMany(Backup::class, 'database_id');
    }
}
