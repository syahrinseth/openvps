<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Create permissions
        $permissions = [
            // Server permissions
            'servers.view', 'servers.create', 'servers.update', 'servers.delete', 'servers.connect',
            // Web app permissions
            'webapps.view', 'webapps.create', 'webapps.update', 'webapps.delete', 'webapps.deploy',
            // Nginx permissions
            'nginx.view', 'nginx.create', 'nginx.update', 'nginx.delete', 'nginx.reload',
            // SSL permissions
            'ssl.view', 'ssl.create', 'ssl.renew', 'ssl.revoke',
            // Database permissions
            'databases.view', 'databases.create', 'databases.delete', 'databases.backup',
            'database_users.view', 'database_users.create', 'database_users.update', 'database_users.delete',
            // Firewall permissions
            'firewall.view', 'firewall.create', 'firewall.update', 'firewall.delete',
            // GitHub permissions
            'github.view', 'github.create', 'github.update', 'github.delete',
            // Deployment permissions
            'deployments.view', 'deployments.create', 'deployments.rollback',
            // Backup permissions
            'backups.view', 'backups.create', 'backups.restore', 'backups.delete',
            // Monitoring permissions
            'metrics.view', 'metrics.collect',
            // User management permissions
            'users.view', 'users.create', 'users.update', 'users.delete', 'users.assign_roles',
            // Cron job permissions
            'cronjobs.view', 'cronjobs.create', 'cronjobs.update', 'cronjobs.delete',
            // Notification permissions
            'notifications.view', 'notifications.manage',
        ];

        foreach ($permissions as $permission) {
            Permission::create(['name' => $permission, 'guard_name' => 'api']);
        }

        // Create Admin role - has all permissions
        $adminRole = Role::create(['name' => 'admin', 'guard_name' => 'api']);
        $adminRole->givePermissionTo(Permission::all());

        // Create Server Manager role
        $managerRole = Role::create(['name' => 'server-manager', 'guard_name' => 'api']);
        $managerRole->givePermissionTo([
            'servers.view', 'servers.connect',
            'webapps.view', 'webapps.create', 'webapps.update', 'webapps.deploy',
            'nginx.view', 'nginx.create', 'nginx.update', 'nginx.reload',
            'ssl.view', 'ssl.create', 'ssl.renew',
            'databases.view', 'databases.create', 'databases.backup',
            'database_users.view', 'database_users.create', 'database_users.update',
            'firewall.view', 'firewall.create', 'firewall.update',
            'github.view', 'github.create', 'github.update',
            'deployments.view', 'deployments.create', 'deployments.rollback',
            'backups.view', 'backups.create', 'backups.restore',
            'metrics.view', 'metrics.collect',
            'cronjobs.view', 'cronjobs.create', 'cronjobs.update',
            'notifications.view',
        ]);

        // Create Developer role
        $developerRole = Role::create(['name' => 'developer', 'guard_name' => 'api']);
        $developerRole->givePermissionTo([
            'servers.view',
            'webapps.view', 'webapps.deploy',
            'nginx.view',
            'ssl.view',
            'databases.view',
            'database_users.view',
            'firewall.view',
            'github.view',
            'deployments.view', 'deployments.create',
            'backups.view',
            'metrics.view',
            'cronjobs.view',
            'notifications.view',
        ]);
    }
}
