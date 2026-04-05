<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->longText('ssh_key_passphrase')->nullable()->after('ssh_private_key');
        });
    }

    public function down(): void
    {
        Schema::table('servers', function (Blueprint $table) {
            $table->dropColumn('ssh_key_passphrase');
        });
    }
};
