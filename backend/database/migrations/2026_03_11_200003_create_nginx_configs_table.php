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
        Schema::create('nginx_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->onDelete('cascade');
            $table->foreignId('web_app_id')->nullable()->constrained()->onDelete('set null');
            $table->string('domain');
            $table->longText('config_content');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_ssl')->default(false);
            $table->integer('upstream_port')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('nginx_configs');
    }
};
