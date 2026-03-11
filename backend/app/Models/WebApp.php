<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WebApp extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'server_id',
        'user_id',
        'name',
        'domain',
        'app_type',
        'git_repository',
        'git_branch',
        'deploy_path',
        'docker_compose_path',
        'port',
        'docker_container_name',
        'environment_variables',
        'auto_deploy',
        'status',
    ];

    protected $hidden = [
        'environment_variables',
    ];

    protected function casts(): array
    {
        return [
            'status' => 'string',
            'app_type' => 'string',
            'port' => 'integer',
            'auto_deploy' => 'boolean',
            'environment_variables' => 'encrypted',
        ];
    }

    public function server()
    {
        return $this->belongsTo(Server::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function nginxConfigs()
    {
        return $this->hasMany(NginxConfig::class);
    }

    public function sslCertificates()
    {
        return $this->hasMany(SslCertificate::class);
    }

    public function deployments()
    {
        return $this->hasMany(Deployment::class);
    }

    public function githubWebhooks()
    {
        return $this->hasMany(GithubWebhook::class);
    }

    public function backups()
    {
        return $this->hasMany(Backup::class);
    }

    public function cronJobs()
    {
        return $this->hasMany(CronJob::class);
    }
}
