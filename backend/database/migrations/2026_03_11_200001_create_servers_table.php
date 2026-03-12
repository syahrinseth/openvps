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
        Schema::create('servers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('hostname');
            $table->string('ip_address');
            $table->integer('ssh_port')->default(22);
            $table->string('ssh_user');
            $table->longText('ssh_private_key');
            $table->string('ssh_password')->nullable();
            $table->string('os_type');
            $table->string('os_version');
            $table->enum('status', ['active', 'inactive', 'unreachable'])->default('active');
            $table->string('provider');
            $table->text('notes')->nullable();
            $table->timestamp('last_connected_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('servers');
    }
};
