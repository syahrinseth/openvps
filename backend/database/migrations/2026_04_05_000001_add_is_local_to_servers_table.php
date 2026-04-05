<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Ref: TRAEFIK_MIGRATION_PLAN.md — Phase 3.1
// Adds is_local flag to distinguish the control plane server from SSH-managed remote servers.
// When is_local = true, deployments run via local docker compose instead of SSH.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->boolean('is_local')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->dropColumn('is_local');
        });
    }
};
