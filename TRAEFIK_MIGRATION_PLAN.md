# Traefik Migration Plan — OpenVPS Local Hosting

## Overview

This plan migrates the OpenVPS control plane from `openvps-nginx` + `openvps-certbot`
to **Traefik** as the main reverse proxy, and introduces a **local deployment mode** that
allows websites to be hosted on the same machine as the OpenVPS panel — each as its own
Docker Compose stack, automatically routed and SSL-terminated by Traefik.

---

## Background & Problem

- `openvps-nginx` owns ports 80/443 on the control plane server.
- It has a single `server_name server.syahrinseth.com` block — any other domain
  (e.g. `syahrinseth.com`) falls back to this block and gets incorrectly redirected.
- The `syahrinseth.com` portfolio container (`syahrin-seth-nginx`) runs on port 8080
  but `openvps-nginx` has no knowledge of it.
- Each new locally-hosted website requires manually writing nginx vhost configs —
  error-prone and unscalable.

---

## Target Architecture

```
Internet  :80 / :443
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Traefik  (replaces openvps-nginx + certbot)    │
│  - Docker provider: auto-discovers containers   │
│  - Routes by Host() label                       │
│  - Let's Encrypt ACME (HTTP-01) for SSL         │
│  - HTTP → HTTPS redirect built-in               │
└──────────────────┬──────────────────────────────┘
                   │  docker network: traefik-public
        ┌──────────┼──────────────┬────────────────┐
        ▼          ▼              ▼                ▼
   OpenVPS    syahrinseth.com  site-2.com      site-N.com
   Panel      (Docker Compose) (Docker Compose)  ...
 (backend, reverb,
  mysql, redis, etc.)
```

### Two Deployment Modes

| Mode     | Target Server          | Routing         | SSL            | How deployed       |
|----------|------------------------|-----------------|----------------|--------------------|
| `local`  | Same machine as panel  | Traefik labels  | Traefik ACME   | `docker compose` locally |
| `remote` | External VPS via SSH   | nginx vhost     | Certbot (SSH)  | SSH + `docker compose` |

---

## Affected Files

### New Files to Create

| File | Purpose |
|------|---------|
| `docker/traefik/traefik.yml` | Traefik static config (entrypoints, Docker provider, ACME) |
| `docker/traefik/dynamic/middlewares.yml` | Security headers, rate limiting middlewares |
| `backend/resources/stubs/docker-compose/local/react.yml` | React stub with Traefik labels |
| `backend/resources/stubs/docker-compose/local/laravel.yml` | Laravel stub with Traefik labels |
| `backend/resources/stubs/docker-compose/local/nodejs.yml` | Node.js stub with Traefik labels |
| `backend/resources/stubs/docker-compose/local/static.yml` | Static stub with Traefik labels |
| `backend/resources/stubs/docker-compose/local/custom.yml` | Custom stub with Traefik labels |
| `backend/app/Services/LocalDeploymentService.php` | Handles `docker compose` locally (no SSH) |

### Files to Modify

| File | Change |
|------|--------|
| `docker-compose.yml` | Replace `nginx`+`certbot` services with `traefik`; add `traefik-public` network; add Traefik labels to `backend` and `reverb` |
| `docker/nginx/default.conf` | Remove (no longer used by control plane; NginxService still uses it as a template for remote servers) |
| `backend/app/Models/Server.php` | Add `is_local` boolean attribute; add `deployment_mode` accessor |
| `backend/database/migrations/` | New migration: add `is_local` column to `servers` table |
| `backend/app/Services/WebAppSetupService.php` | Branch on `server->is_local`: use local stubs + docker compose locally |
| `backend/app/Services/DeploymentService.php` | Branch on `server->is_local`: run `docker compose` locally instead of over SSH |
| `/var/www/syahrinseth.com/docker-compose.yml` | Add Traefik labels; remove port 8080; join `traefik-public` network |

---

## Implementation Phases

---

### Phase 1 — Traefik Control Plane Setup
**Goal:** Replace `openvps-nginx` + `openvps-certbot` with Traefik. The OpenVPS panel
(`server.syahrinseth.com`) continues to work identically.

#### Step 1.1 — Create `docker/traefik/traefik.yml`
```yaml
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"

providers:
  docker:
    exposedByDefault: false
    network: traefik-public
  file:
    directory: /etc/traefik/dynamic
    watch: true

certificatesResolvers:
  letsencrypt:
    acme:
      email: ${ACME_EMAIL}
      storage: /etc/traefik/acme/acme.json
      httpChallenge:
        entryPoint: web
```

#### Step 1.2 — Create `docker/traefik/dynamic/middlewares.yml`
Defines reusable middlewares:
- `secure-headers`: security response headers (X-Frame-Options, CSP, etc.)
- `rate-limit`: global rate limiting

#### Step 1.3 — Update `docker-compose.yml`
- **Remove** `nginx` service (openvps-nginx)
- **Remove** `certbot` service (openvps-certbot)
- **Add** `traefik` service:
  - Image: `traefik:v3.2`
  - Ports: `80:80`, `443:443`
  - Volumes: Docker socket, `traefik.yml`, `dynamic/` dir, `acme/` volume
  - Networks: `traefik-public`, `openvps-network`
  - Labels: Traefik dashboard route on `traefik.server.syahrinseth.com` (secured)
- **Add** to `backend` service: Traefik labels for `server.syahrinseth.com`
  - Route `/api`, `/sanctum`, `/broadcasting`, `/app` (WebSocket), `/` (frontend SPA)
  - PHP-FPM handled by backend container (same as today but via Traefik → nginx → PHP-FPM,
    or restructure: Traefik → backend nginx sidecar)
  - SSL via `letsencrypt` certresolver
- **Add** `traefik-public` external network definition
- **Keep** `openvps-network` internal network for MySQL, Redis inter-service comms
- **Add** env var `ACME_EMAIL` to `.env.example`

> **Note on PHP-FPM:** Traefik speaks HTTP, not FastCGI. The current setup uses
> nginx as a FastCGI proxy to PHP-FPM. Two options:
> - **Option A (Recommended):** Keep a lightweight `nginx` sidecar container
>   (no external ports) that handles FastCGI → PHP-FPM, and Traefik proxies HTTP to it.
>   This is the cleanest change — only routing changes, nginx config stays.
> - **Option B:** Add a PHP built-in server or FrankenPHP as an HTTP server.
>   More invasive, skip for now.
>
> **Decision: Option A** — rename the nginx service to `panel-nginx`, remove its
> public port bindings, and add Traefik labels to it instead.

#### Step 1.4 — Update `docker/nginx/default.conf`
Remove the `server_name server.syahrinseth.com` hard-coded references — this config
will now be used by the `panel-nginx` sidecar which Traefik proxies to. Traefik
handles the domain matching. The nginx config becomes a pure upstream server:
- Listen on 80 (no SSL — Traefik terminates TLS)
- Remove all `ssl_certificate` directives
- Remove the HTTP→HTTPS redirect block (Traefik handles it)
- Keep FastCGI, WebSocket proxy, static asset, and SPA routing logic

#### Step 1.5 — Provision acme.json and migrate SSL cert
- Create `docker/traefik/acme/` directory with correct permissions (`chmod 600 acme.json`)
- The existing Let's Encrypt cert at `docker/nginx/ssl/live/server.syahrinseth.com/`
  can be imported into `acme.json` to avoid re-issuance rate limits.
- Add `docker/traefik/acme/acme.json` to `.gitignore`

**Validation:** `curl -sI https://server.syahrinseth.com` → 200 OK with valid SSL.

---

### Phase 2 — Fix `syahrinseth.com` (Immediate Bug Fix)
**Goal:** `syahrinseth.com` correctly serves the portfolio, no redirect to subdomain.

#### Step 2.1 — Update `/var/www/syahrinseth.com/docker-compose.yml`
- Remove `ports: - "8080:80"` (no host port binding needed)
- Add to `nginx` service:
  ```yaml
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.syahrinseth.rule=Host(`syahrinseth.com`) || Host(`www.syahrinseth.com`)"
    - "traefik.http.routers.syahrinseth.entrypoints=websecure"
    - "traefik.http.routers.syahrinseth.tls.certresolver=letsencrypt"
    - "traefik.http.services.syahrinseth.loadbalancer.server.port=80"
  networks:
    - traefik-public
    - default
  ```
- Add `traefik-public` as an external network at the bottom of the file

#### Step 2.2 — Restart the container
```bash
docker compose down && docker compose up -d
```

**Validation:** `curl -sI https://syahrinseth.com` → 200 OK, no redirect to `server.syahrinseth.com`.

---

### Phase 3 — Local Deployment Mode in OpenVPS
**Goal:** OpenVPS can deploy websites onto the same server it runs on, with Traefik
auto-routing them by domain.

#### Step 3.1 — Database Migration
New migration: `add_is_local_to_servers_table`
```php
$table->boolean('is_local')->default(false)->after('status');
```

#### Step 3.2 — Update `Server` Model
- Add `is_local` to `$fillable`
- Add accessor `getDeploymentModeAttribute()` → returns `'local'` or `'remote'`
- Local server does not need `ip_address`, `ssh_user`, `ssh_private_key` etc.

#### Step 3.3 — Create Local Docker Compose Stubs
Directory: `backend/resources/stubs/docker-compose/local/`

Each stub connects to `traefik-public` external network and uses Traefik labels
instead of host port bindings. Key differences from remote stubs:

- No `ports:` directives on the public-facing container
- Add `labels:` block with Traefik routing rules
- Add `traefik-public` external network
- Use `{{DOMAIN}}` and `{{APP_NAME}}` placeholders

Example — `local/react.yml`:
```yaml
services:
  build:
    image: node:20-alpine
    container_name: {{APP_NAME}}-build
    working_dir: /app
    volumes:
      - .:/app
    command: sh -c "npm install && npm run build"
    networks:
      - internal

  nginx:
    image: nginx:alpine
    container_name: {{APP_NAME}}-nginx
    volumes:
      - ./dist:/usr/share/nginx/html:ro
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.{{APP_NAME}}.rule=Host(`{{DOMAIN}}`)"
      - "traefik.http.routers.{{APP_NAME}}.entrypoints=websecure"
      - "traefik.http.routers.{{APP_NAME}}.tls.certresolver=letsencrypt"
      - "traefik.http.services.{{APP_NAME}}.loadbalancer.server.port=80"
    networks:
      - internal
      - traefik-public
    restart: unless-stopped

networks:
  internal:
    driver: bridge
  traefik-public:
    external: true
```

Similar patterns apply to `local/laravel.yml`, `local/nodejs.yml`,
`local/static.yml`, `local/custom.yml`.

#### Step 3.4 — Create `LocalDeploymentService`
Handles deployments when `server->is_local === true`:
- `setup()`: runs `mkdir -p`, `git clone`, generates docker-compose from local stub
- `deploy()`: runs `git pull` + `docker compose up -d --build` **on the local machine**
  (not over SSH) using PHP's `exec()` or Symfony Process
- `start()`, `stop()`, `restart()`: equivalent `docker compose` local commands
- Broadcasts `DeploymentUpdated` events same as `DeploymentService`

#### Step 3.5 — Update `WebAppSetupService`
```php
public function setup(Server $server, WebApp $webApp): void
{
    if ($server->is_local) {
        $this->localDeploymentService->setup($server, $webApp);
    } else {
        // existing SSH-based setup...
    }
}
```

#### Step 3.6 — Update `DeploymentService`
```php
public function deploy(WebApp $webApp, ...): Deployment
{
    if ($webApp->server->is_local) {
        return $this->localDeploymentService->deploy($webApp, ...);
    }
    // existing SSH deploy...
}
```

#### Step 3.7 — Update `WebAppController`
`start()`, `stop()`, `restart()` actions branch on `server->is_local`.

#### Step 3.8 — Frontend: Mark a Server as Local
In the "Add Server" form, add a toggle: **"This is the local OpenVPS server"**.
When enabled, hide SSH credential fields (not needed for local mode).

---

### Phase 4 — NginxService & SslService Cleanup (Remote Servers)
**Goal:** Ensure remote server management is unaffected; clean up dead code.

- `NginxService` — no changes needed; remains for remote SSH-managed servers only.
- `SslService` — no changes needed; Certbot over SSH remains for remote servers only.
- Remove `certbot` from `docker-compose.yml` (done in Phase 1).
- Update `SslService` comments to clarify it is remote-only.
- Add guard in `NginxService::createVirtualHost()`: throw if `server->is_local`.
- Add guard in `SslService::requestCertificate()`: throw if `server->is_local`.

---

## Environment Variables to Add

```env
# .env.example additions
ACME_EMAIL=admin@example.com          # Let's Encrypt registration email
TRAEFIK_DASHBOARD_DOMAIN=traefik.server.example.com  # optional, for dashboard
TRAEFIK_DASHBOARD_USER=admin          # basic auth for dashboard
TRAEFIK_DASHBOARD_PASSWORD_HASH=...   # htpasswd hash
```

---

## Files to Add to `.gitignore`

```
docker/traefik/acme/acme.json    # contains private keys for SSL certs
```

---

## Rollback Plan

If Traefik causes issues:
1. `docker compose stop traefik`
2. Restore `nginx` and `certbot` services in `docker-compose.yml`
3. `docker compose up -d nginx certbot`
4. The old `docker/nginx/default.conf` and SSL certs under `docker/nginx/ssl/`
   are not deleted during this migration — keep them until Phase 1 is fully validated.

---

## Implementation Order (Recommended)

- [ ] **Phase 1** — Traefik control plane setup (replaces nginx + certbot)
  - [ ] 1.1 Create `docker/traefik/traefik.yml`
  - [ ] 1.2 Create `docker/traefik/dynamic/middlewares.yml`
  - [ ] 1.3 Update `docker-compose.yml` (add traefik, rename nginx → panel-nginx, remove certbot)
  - [ ] 1.4 Update `docker/nginx/default.conf` (remove SSL + redirect, pure upstream)
  - [ ] 1.5 Set up `acme.json`, migrate existing cert
- [ ] **Phase 2** — Fix `syahrinseth.com` redirect bug
  - [ ] 2.1 Update `/var/www/syahrinseth.com/docker-compose.yml` with Traefik labels
  - [ ] 2.2 Restart container and validate
- [ ] **Phase 3** — Local deployment mode
  - [ ] 3.1 Migration: `add_is_local_to_servers_table`
  - [ ] 3.2 Update `Server` model
  - [ ] 3.3 Create `backend/resources/stubs/docker-compose/local/*.yml` (5 files)
  - [ ] 3.4 Create `backend/app/Services/LocalDeploymentService.php`
  - [ ] 3.5 Update `WebAppSetupService`
  - [ ] 3.6 Update `DeploymentService`
  - [ ] 3.7 Update `WebAppController`
  - [ ] 3.8 Update frontend "Add Server" form
- [ ] **Phase 4** — NginxService / SslService cleanup
  - [ ] 4.1 Add `is_local` guards to `NginxService` and `SslService`
  - [ ] 4.2 Update inline comments
