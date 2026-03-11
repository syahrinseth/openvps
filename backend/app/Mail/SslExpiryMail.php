<?php

namespace App\Mail;

use App\Models\SslCertificate;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SslExpiryMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly SslCertificate $certificate,
        public readonly int $daysRemaining,
        public readonly bool $renewed,
    ) {}

    public function envelope(): Envelope
    {
        $appName = config('app.name', 'OpenVPS');
        $domain = $this->certificate->domain;

        if ($this->renewed) {
            return new Envelope(subject: "✅ [{$appName}] SSL Certificate Renewed: {$domain}");
        }

        $emoji = $this->daysRemaining <= 7 ? '🚨' : '⚠️';
        return new Envelope(subject: "{$emoji} [{$appName}] SSL Certificate Expiring: {$domain} ({$this->daysRemaining} days)");
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.ssl.expiry',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
