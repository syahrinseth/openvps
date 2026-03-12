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
        Schema::create('ssl_certificates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->onDelete('cascade');
            $table->foreignId('web_app_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('nginx_config_id')->nullable()->constrained()->onDelete('set null');
            $table->string('domain');
            $table->enum('type', ['letsencrypt', 'custom', 'self_signed']);
            $table->string('certificate_path');
            $table->string('private_key_path');
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('auto_renew')->default(true);
            $table->enum('status', ['active', 'expired', 'pending', 'revoked'])->default('pending');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ssl_certificates');
    }
};
