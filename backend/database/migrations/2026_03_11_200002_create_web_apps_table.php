<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('web_apps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('domain');
            $table->enum('app_type', ['laravel', 'nodejs', 'react', 'static', 'custom']);
            $table->string('git_repository')->nullable();
            $table->string('git_branch')->default('main');
            $table->string('deploy_path');
            $table->string('docker_compose_path')->nullable();
            $table->integer('port')->nullable();
            $table->enum('status', ['running', 'stopped', 'deploying', 'failed', 'maintenance'])->default('stopped');
            $table->boolean('auto_deploy')->default(false);
            $table->longText('environment_variables')->nullable();
            $table->string('docker_container_name')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('web_apps');
    }
};
