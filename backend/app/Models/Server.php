<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Server extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'hostname',
        'ip_address',
        'ssh_port',
        'ssh_user',
        'ssh_private_key',
        'ssh_key_passphrase',
        'ssh_password',
        'os_type',
        'os_version',
        'status',
        'is_local',
        'provider',
        'notes',
        'last_connected_at',
    ];

    protected $hidden = [
        'ssh_private_key',
        'ssh_key_passphrase',
        'ssh_password',
    ];

    protected function casts(): array
    {
        return [
            'status' => 'string',
            'is_local' => 'boolean',
            'ssh_private_key' => 'encrypted',
            'ssh_key_passphrase' => 'encrypted',
            'ssh_password' => 'encrypted',
        ];
    }

    /**
     * Returns 'local' for the control plane server, 'remote' for SSH-managed servers.
     * Ref: TRAEFIK_MIGRATION_PLAN.md — Phase 3.2
     */
    public function getDeploymentModeAttribute(): string
    {
        return $this->is_local ? 'local' : 'remote';
    }

    /**
     * Local servers do not require SSH credentials.
     */
    public function requiresSshCredentials(): bool
    {
        return !$this->is_local;
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function webApps()
    {
        return $this->hasMany(WebApp::class);
    }

    public function nginxConfigs()
    {
        return $this->hasMany(NginxConfig::class);
    }

    public function sslCertificates()
    {
        return $this->hasMany(SslCertificate::class);
    }

    public function databases()
    {
        return $this->hasMany(Database_::class);
    }

    public function databaseUsers()
    {
        return $this->hasMany(DatabaseUser::class);
    }

    public function firewallRules()
    {
        return $this->hasMany(FirewallRule::class);
    }

    public function githubWebhooks()
    {
        return $this->hasMany(GithubWebhook::class);
    }

    public function deployments()
    {
        return $this->hasMany(Deployment::class);
    }

    public function serverMetrics()
    {
        return $this->hasMany(ServerMetric::class);
    }

    public function backups()
    {
        return $this->hasMany(Backup::class);
    }

    public function cronJobs()
    {
        return $this->hasMany(CronJob::class);
    }

    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class);
    }
}
