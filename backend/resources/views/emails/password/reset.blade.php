<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6f8; margin: 0; padding: 0; }
        .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header { padding: 32px 40px; background: #2563eb; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .header p { margin: 6px 0 0; font-size: 14px; opacity: 0.85; }
        .body { padding: 32px 40px; }
        .body p { font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 16px; }
        .btn-wrap { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; padding: 14px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; letter-spacing: 0.01em; }
        .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
        .fallback { font-size: 13px; color: #6b7280; word-break: break-all; }
        .fallback a { color: #2563eb; }
        .expiry-note { font-size: 13px; color: #6b7280; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-top: 8px; }
        .footer { padding: 20px 40px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="header">
        <h1>Reset Your Password</h1>
        <p>{{ config('app.name', 'OpenVPS') }} — {{ now()->format('M j, Y H:i') }} UTC</p>
    </div>

    <div class="body">
        <p>Hi {{ $userName }},</p>
        <p>
            We received a request to reset the password for your account.
            Click the button below to choose a new password.
        </p>

        <div class="btn-wrap">
            <a href="{{ $resetUrl }}" class="btn">Reset Password</a>
        </div>

        <div class="expiry-note">
            This link expires in <strong>60 minutes</strong>. If you did not request a password reset,
            you can safely ignore this email — your password will not change.
        </div>

        <hr class="divider">

        <p class="fallback">
            If the button above does not work, copy and paste the following link into your browser:<br>
            <a href="{{ $resetUrl }}">{{ $resetUrl }}</a>
        </p>
    </div>

    <div class="footer">
        This is an automated message from {{ config('app.name', 'OpenVPS') }}.
        You received this because a password reset was requested for your account.
    </div>
</div>
</body>
</html>
