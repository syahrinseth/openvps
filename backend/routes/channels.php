<?php

use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

// Private channel for deployment updates per server.
// Only users who own (or have access to) the server may subscribe.
Broadcast::channel('server.{serverId}.deployments', function ($user, int $serverId) {
    $server = \App\Models\Server::find($serverId);

    if (! $server) {
        return false;
    }

    // Admin can subscribe to any server's channel
    if ($user->hasRole('admin')) {
        return true;
    }

    // Server owner can subscribe
    return (int) $user->id === (int) $server->user_id;
});

// Private channel for per-user notifications.
Broadcast::channel('App.Models.User.{id}', function ($user, int $id) {
    return (int) $user->id === $id;
});
