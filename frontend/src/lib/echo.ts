import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Make Pusher available globally (required by laravel-echo)
(window as typeof window & { Pusher: typeof Pusher }).Pusher = Pusher;

/**
 * Create a Laravel Echo instance connected to Reverb via WebSocket.
 *
 * In production, Nginx proxies /app path to the Reverb container on port 8080,
 * so we connect via wss:// on port 443 through the standard HTTPS endpoint.
 *
 * Environment variables are injected at build time via Vite:
 *   VITE_REVERB_APP_KEY  – the Reverb app key
 *   VITE_REVERB_HOST     – the server host (e.g. "https://1.2.3.4" or "https://example.com")
 *   VITE_REVERB_PORT     – WebSocket port (443 in production behind Nginx)
 *   VITE_REVERB_SCHEME   – "https" or "http"
 */
function createEcho(): Echo<'pusher'> {
  const appKey   = import.meta.env.VITE_REVERB_APP_KEY   ?? 'openvps-key';
  const rawHost  = import.meta.env.VITE_REVERB_HOST      ?? window.location.origin;
  const port     = Number(import.meta.env.VITE_REVERB_PORT ?? 443);
  const scheme   = import.meta.env.VITE_REVERB_SCHEME    ?? 'https';

  // Strip protocol from host if present (pusher-js wants just the hostname)
  const host = rawHost.replace(/^https?:\/\//, '');

  return new Echo({
    broadcaster: 'reverb',
    key: appKey,
    wsHost: host,
    wsPort: scheme === 'https' ? undefined : port,
    wssPort: scheme === 'https' ? port : undefined,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    // Auth endpoint for private channels — uses the Sanctum token from localStorage
    authEndpoint: '/api/broadcasting/auth',
    auth: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}`,
        Accept: 'application/json',
      },
    },
  });
}

// Singleton — lazily initialized so auth token is available at connection time
let _echo: Echo<'pusher'> | null = null;

export function getEcho(): Echo<'pusher'> {
  if (!_echo) {
    _echo = createEcho();
  }
  return _echo;
}

/**
 * Disconnect and destroy the Echo instance (call on logout).
 */
export function destroyEcho(): void {
  if (_echo) {
    _echo.disconnect();
    _echo = null;
  }
}
