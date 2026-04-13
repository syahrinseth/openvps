<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('web_apps', function (Blueprint $table) {
            $table->longText('git_token')->nullable()->after('git_branch');
        });
    }

    public function down(): void
    {
        Schema::table('web_apps', function (Blueprint $table) {
            $table->dropColumn('git_token');
        });
    }
};
