<?php

namespace App\Mail;

use App\Models\Deployment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DeploymentMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Deployment $deployment,
        public readonly string $status,
    ) {}

    public function envelope(): Envelope
    {
        $appName = config('app.name', 'OpenVPS');
        $webAppName = $this->deployment->webApp?->name ?? "App #{$this->deployment->web_app_id}";
        $emoji = $this->status === 'success' ? '✅' : '❌';
        $statusLabel = ucfirst($this->status);

        return new Envelope(
            subject: "{$emoji} [{$appName}] Deployment {$statusLabel}: {$webAppName}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.deployment.status',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
