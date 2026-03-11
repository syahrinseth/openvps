<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deployment {{ ucfirst($status) }}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6f8; margin: 0; padding: 0; }
        .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header { padding: 32px 40px; background: {{ $status === 'success' ? '#16a34a' : '#dc2626' }}; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .header p { margin: 6px 0 0; font-size: 14px; opacity: 0.85; }
        .body { padding: 32px 40px; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .label { color: #6b7280; font-weight: 500; }
        .value { color: #111827; font-weight: 600; text-align: right; max-width: 60%; word-break: break-all; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background: {{ $status === 'success' ? '#dcfce7' : '#fee2e2' }}; color: {{ $status === 'success' ? '#15803d' : '#dc2626' }}; }
        .log-section { margin-top: 24px; }
        .log-section h3 { font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px; }
        .log-box { background: #111827; border-radius: 6px; padding: 16px; }
        .log-box pre { margin: 0; font-family: 'Courier New', monospace; font-size: 12px; color: #d1d5db; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow: auto; }
        .footer { padding: 20px 40px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="header">
        @if($status === 'success')
            <h1>✅ Deployment Successful</h1>
        @else
            <h1>❌ Deployment Failed</h1>
        @endif
        <p>{{ config('app.name', 'OpenVPS') }} — {{ now()->format('M j, Y H:i') }} UTC</p>
    </div>

    <div class="body">
        <div class="detail-row">
            <span class="label">Application</span>
            <span class="value">{{ $deployment->webApp?->name ?? "App #{$deployment->web_app_id}" }}</span>
        </div>
        <div class="detail-row">
            <span class="label">Status</span>
            <span class="value"><span class="badge">{{ ucfirst($status) }}</span></span>
        </div>
        @if($deployment->branch)
        <div class="detail-row">
            <span class="label">Branch</span>
            <span class="value">{{ $deployment->branch }}</span>
        </div>
        @endif
        @if($deployment->commit_hash)
        <div class="detail-row">
            <span class="label">Commit</span>
            <span class="value"><code>{{ substr($deployment->commit_hash, 0, 7) }}</code></span>
        </div>
        @endif
        @if($deployment->commit_message)
        <div class="detail-row">
            <span class="label">Message</span>
            <span class="value">{{ $deployment->commit_message }}</span>
        </div>
        @endif
        @if($deployment->started_at)
        <div class="detail-row">
            <span class="label">Started</span>
            <span class="value">{{ $deployment->started_at->format('H:i:s') }} UTC</span>
        </div>
        @endif
        @if($deployment->completed_at && $deployment->started_at)
        <div class="detail-row">
            <span class="label">Duration</span>
            <span class="value">
                @php
                    $seconds = $deployment->started_at->diffInSeconds($deployment->completed_at);
                    $mins = intdiv($seconds, 60);
                    $secs = $seconds % 60;
                    echo $mins > 0 ? "{$mins}m {$secs}s" : "{$secs}s";
                @endphp
            </span>
        </div>
        @endif

        @php
            $log = '';
            if ($deployment->output) $log .= $deployment->output;
            if ($deployment->error_output) $log .= "\n--- ERRORS ---\n" . $deployment->error_output;
        @endphp

        @if($log)
        <div class="log-section">
            <h3>Deployment Log</h3>
            <div class="log-box">
                <pre>{{ $log }}</pre>
            </div>
        </div>
        @endif
    </div>

    <div class="footer">
        This is an automated message from {{ config('app.name', 'OpenVPS') }}.
        You received this because you triggered a deployment.
    </div>
</div>
</body>
</html>
