<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('web_apps', function (Blueprint $table) {
            // Private key — stored encrypted at rest via Laravel's 'encrypted' cast.
            // Never exposed in API responses; only has_git_deploy_key (bool) is surfaced.
            $table->longText('git_deploy_key')->nullable()->after('git_token');

            // Public key — safe to display so the user can add it to GitHub Deploy keys.
            $table->text('git_deploy_key_public')->nullable()->after('git_deploy_key');
        });
    }

    public function down(): void
    {
        Schema::table('web_apps', function (Blueprint $table) {
            $table->dropColumn(['git_deploy_key', 'git_deploy_key_public']);
        });
    }
};
