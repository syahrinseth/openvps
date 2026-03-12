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
        Schema::create('server_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->onDelete('cascade');
            $table->decimal('cpu_usage', 5, 2);
            $table->decimal('memory_usage', 5, 2);
            $table->bigInteger('memory_total');
            $table->decimal('disk_usage', 5, 2);
            $table->bigInteger('disk_total');
            $table->bigInteger('network_in');
            $table->bigInteger('network_out');
            $table->decimal('load_average_1', 5, 2);
            $table->decimal('load_average_5', 5, 2);
            $table->decimal('load_average_15', 5, 2);
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['server_id', 'recorded_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('server_metrics');
    }
};
