<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSL Certificate {{ $renewed ? 'Renewed' : 'Expiry Notice' }}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6f8; margin: 0; padding: 0; }
        .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header-success { padding: 32px 40px; background: #16a34a; color: #ffffff; }
        .header-warning { padding: 32px 40px; background: #d97706; color: #ffffff; }
        .header-danger  { padding: 32px 40px; background: #dc2626; color: #ffffff; }
        .header-success h1, .header-warning h1, .header-danger h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .header-success p, .header-warning p, .header-danger p { margin: 6px 0 0; font-size: 14px; opacity: 0.85; }
        .body { padding: 32px 40px; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .label { color: #6b7280; font-weight: 500; }
        .value { color: #111827; font-weight: 600; text-align: right; }
        .message-box { margin-top: 24px; padding: 16px; border-radius: 6px; background: #fef9c3; border: 1px solid #fde68a; font-size: 14px; color: #713f12; }
        .footer { padding: 20px 40px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
    </style>
</head>
<body>
<div class="wrapper">
    @if($renewed)
        <div class="header-success">
            <h1>✅ SSL Certificate Renewed</h1>
            <p>{{ config('app.name', 'OpenVPS') }} — {{ now()->format('M j, Y H:i') }} UTC</p>
        </div>
    @elseif($daysRemaining <= 7)
        <div class="header-danger">
            <h1>🚨 SSL Certificate Expiring Very Soon</h1>
            <p>{{ config('app.name', 'OpenVPS') }} — {{ now()->format('M j, Y H:i') }} UTC</p>
        </div>
    @else
        <div class="header-warning">
            <h1>⚠️ SSL Certificate Expiry Notice</h1>
            <p>{{ config('app.name', 'OpenVPS') }} — {{ now()->format('M j, Y H:i') }} UTC</p>
        </div>
    @endif

    <div class="body">
        <div class="detail-row">
            <span class="label">Domain</span>
            <span class="value">{{ $certificate->domain }}</span>
        </div>
        <div class="detail-row">
            <span class="label">Type</span>
            <span class="value">{{ ucfirst($certificate->type) }}</span>
        </div>
        @if($certificate->expires_at)
        <div class="detail-row">
            <span class="label">Expires At</span>
            <span class="value">{{ $certificate->expires_at->format('M j, Y') }}</span>
        </div>
        @endif
        <div class="detail-row">
            <span class="label">Days Remaining</span>
            <span class="value">{{ $daysRemaining }} days</span>
        </div>
        <div class="detail-row">
            <span class="label">Auto-Renew</span>
            <span class="value">{{ $certificate->auto_renew ? 'Enabled' : 'Disabled' }}</span>
        </div>

        @if($renewed)
            <div class="message-box" style="background: #dcfce7; border-color: #bbf7d0; color: #166534;">
                The SSL certificate for <strong>{{ $certificate->domain }}</strong> has been automatically renewed.
                It is now valid for another 90 days. No action is required.
            </div>
        @elseif(!$certificate->auto_renew)
            <div class="message-box">
                <strong>Action Required:</strong> The SSL certificate for <strong>{{ $certificate->domain }}</strong>
                expires in {{ $daysRemaining }} days and auto-renew is <strong>disabled</strong>.
                Please renew the certificate manually via OpenVPS before it expires.
            </div>
        @else
            <div class="message-box">
                The SSL certificate for <strong>{{ $certificate->domain }}</strong> will expire in {{ $daysRemaining }} days.
                Auto-renewal will be attempted automatically. If renewal fails, you will receive another notification.
            </div>
        @endif
    </div>

    <div class="footer">
        This is an automated message from {{ config('app.name', 'OpenVPS') }}.
    </div>
</div>
</body>
</html>
