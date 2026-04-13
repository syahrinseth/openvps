# OpenVPS Development Plan

## Context

OpenVPS is a self-hosted server/web app management panel with a Laravel backend and React/Vite/TypeScript frontend.

- **Frontend:** `/opt/openvps/frontend` — built with `npm run build`, served as static files by nginx container `openvps-panel-nginx` from `frontend/dist`
- **Backend:** `/opt/openvps/backend` — Laravel, runs in Docker container `openvps-backend`. Restart with `docker restart openvps-backend openvps-queue`
- **Migrations:** `docker exec openvps-backend php artisan migrate --force`

---

## Phase 1 — Bug Fixes (Backend)

### 1.1 `UpdateWebAppRequest` — git_token wipe bug

**File:** `backend/app/Http/Requests/WebApp/UpdateWebAppRequest.php`

**Problem:** If the user leaves the git_token field blank on the edit form, the empty string is sent in the request and overwrites the encrypted token stored in the database.

**Fix:** In the `prepareForValidation` or after-validation step, remove `git_token` from the validated data when it is an empty string. This ensures a blank field means "keep existing token" rather than "clear token".

---

### 1.2 `WebAppController::setup` — Silent failures

**File:** `backend/app/Http/Controllers/Api/WebAppController.php`

**Problem:** On setup failure, the controller returns `200 OK` with body `{ success: false, message: "..." }`. React Query's `onError` callback never fires, so setup errors are silently swallowed in the UI.

**Fix:** Return a proper HTTP `500` (or `422`) on failure so React Query detects it as an error and fires the `onError` handler.

---

### 1.3 `WebAppController` start/stop/restart — Shell injection risk

**File:** `backend/app/Http/Controllers/Api/WebAppController.php`

**Problem:** `docker_compose_path` is interpolated directly into SSH command strings without `escapeshellarg()`, allowing path values containing spaces or special characters to break the command or enable injection.

**Fix:** Wrap `docker_compose_path` (and any other user-controlled values) with `escapeshellarg()` before embedding in SSH commands for remote start/stop/restart.

---

### 1.4 `WebAppSetupService::generateDockerCompose` — Heredoc raw content bug

**File:** `backend/app/Services/WebAppSetupService.php`

**Problem:** `$safeContent` is computed via `escapeshellarg()` but the heredoc embeds the raw `$content` variable instead. Compose file content containing single quotes will break the SSH command.

**Fix:** Replace `$content` with `$safeContent` inside the heredoc write command.

---

## Phase 2 — Deployments Tab

### 2.1 Verify `DeploymentResource` fields

**File:** `backend/app/Http/Resources/DeploymentResource.php`

Confirm which fields are exposed (e.g. `id`, `status`, `commit_hash`, `created_at`, `output`, `error_output`) and ensure the TypeScript `Deployment` interface in `frontend/src/types/index.ts` matches.

**Known issue:** `Deployment` type has a `log: string | null` field which may not match the backend columns `output` / `error_output`.

---

### 2.2 Build deployment history list

**File:** `frontend/src/pages/webapps/WebAppDetailPage.tsx`

**Current state:** Deployments tab is a stub with only a link to `/deployments`.

**Goal:** Render an inline deployment history table/list showing:
- Status badge (success / failed / running)
- Commit hash (short, monospace)
- Branch
- Triggered-at timestamp (relative)
- Expand/collapse to show deployment log output

Use existing `useWebAppDeployments` hook (or create one if absent) backed by `GET /api/web-apps/{id}/deployments`.

---

## Phase 3 — Environment Variables Tab

### 3.1 Review `environment_variables` storage

**File:** `backend/app/Models/WebApp.php`

`environment_variables` is cast as `encrypted` — determine if it is stored as a JSON object (key-value pairs) or a raw `.env`-style string. This informs the UI design.

---

### 3.2 Build key-value editor UI

**File:** `frontend/src/pages/webapps/WebAppDetailPage.tsx`

**Current state:** Environment tab shows "coming soon".

**Goal:** Render a key-value editor that:
- Loads the current `environment_variables` from the web app detail response
- Allows adding, editing, and deleting key-value pairs
- Saves via the existing `PATCH /api/web-apps/{id}` endpoint (passing `environment_variables`)
- Shows a save button; confirms success/error with a toast

---

## Phase 4 — Logs Tab

### 4.1 Review log endpoints

**File:** `backend/app/Http/Controllers/Api/WebAppController.php` and `routes/api.php`

Determine if a `/logs` or similar endpoint exists. If not, the most practical approach is to surface the most recent deployment's `output` + `error_output` as the log content.

---

### 4.2 Build log viewer

**File:** `frontend/src/pages/webapps/WebAppDetailPage.tsx`

**Current state:** Logs tab shows "coming soon".

**Goal:** Render a scrollable, monospace log viewer that:
- Displays the most recent deployment log (output + error output)
- Shows a "no logs yet" message if no deployments exist
- Has a Refresh button to re-fetch
- If a `/logs` API endpoint exists, poll it every few seconds when a deployment is in progress

---

## Completion Checklist

- [ ] Phase 1.1 — git_token wipe bug fixed
- [ ] Phase 1.2 — setup returns proper HTTP error status
- [ ] Phase 1.3 — shell escape docker_compose_path
- [ ] Phase 1.4 — heredoc uses $safeContent
- [ ] Phase 2.1 — DeploymentResource fields verified, TS type updated
- [ ] Phase 2.2 — Deployments tab shows history inline
- [ ] Phase 3.1 — environment_variables format confirmed
- [ ] Phase 3.2 — Environment Variables tab with key-value editor
- [ ] Phase 4.1 — Log endpoints reviewed
- [ ] Phase 4.2 — Logs tab with log viewer
- [ ] Frontend rebuilt (`npm run build`)
- [ ] Backend restarted (`docker restart openvps-backend openvps-queue`)
