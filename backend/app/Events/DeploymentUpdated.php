<?php

namespace App\Events;

use App\Models\Deployment;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DeploymentUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly Deployment $deployment,
    ) {}

    /**
     * Get the channels the event should broadcast on.
     * Channel: private-server.{server_id}.deployments
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("server.{$this->deployment->server_id}.deployments"),
        ];
    }

    /**
     * The event name used on the frontend.
     */
    public function broadcastAs(): string
    {
        return 'DeploymentUpdated';
    }

    /**
     * Data sent to the frontend.
     */
    public function broadcastWith(): array
    {
        $deployment = $this->deployment;

        $log = '';
        if ($deployment->output) {
            $log .= $deployment->output;
        }
        if ($deployment->error_output) {
            $log .= "\n--- ERRORS ---\n" . $deployment->error_output;
        }

        return [
            'deployment' => [
                'id'             => $deployment->id,
                'web_app_id'     => $deployment->web_app_id,
                'server_id'      => $deployment->server_id,
                'status'         => $deployment->status,
                'commit_hash'    => $deployment->commit_hash,
                'commit_message' => $deployment->commit_message,
                'branch'         => $deployment->branch,
                'log'            => $log ?: null,
                'started_at'     => $deployment->started_at?->toIso8601String(),
                'completed_at'   => $deployment->completed_at?->toIso8601String(),
            ],
        ];
    }
}
