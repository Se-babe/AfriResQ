# AfriResQ

Intelligent community emergency coordination for low-resource African communities.

Report → classify → match nearby verified responders → notify → resolve.

This is a working pilot: a Node.js API with SQLite, a React web app, and a Flutter Android app you can open in Android Studio.

## Quick start

You need Node.js 18+.

```bash
cd backend && npm install && npm run seed && npm start
```

API: [http://localhost:4001](http://localhost:4001) (`PORT` in `backend/.env`, default 4001).

In another terminal:

```bash
cd frontend && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` and `/ws` to the API on port 4001 (4000 is often taken locally).

### Demo accounts (after seed)

| Role        | Phone         | Password          |
|-------------|---------------|-------------------|
| Admin       | +256700000001 | AdminPass123!     |
| Coordinator | +256700000002 | CoordPass123!     |
| Citizen     | +256700000099 | CitizenPass123!   |
| Responders  | +256700000010 … 15 | ResponderPass123! |

Walk through a full case: sign in as the citizen, report a **medical** emergency in Kampala (allow location, or use the landmark field). Sign in as responder `+256700000010`, set **Available**, share location if needed, accept the case, mark it in progress, then resolved. Watch the coordinator dashboard update live.

```bash
cd backend && npm test
```

This runs both the unit tests (classification/geo/matching) and a supertest-driven API integration suite (`tests/api.test.js`) covering registration, login lockout, refresh-token rotation, the full report → classify → match → accept → resolve pipeline, responder verification, and push subscription validation. A GitHub Actions workflow (`.github/workflows/ci.yml`) runs this plus the frontend build on every push/PR.

## What the app does

- **Citizens** report in three steps (type, optional description, submit). GPS is used when allowed; otherwise a landmark. Anonymous reports need only a phone number. If the network drops, the report is queued on the device and sent when connectivity returns.
- **Classification** assigns severity and a 0–100 priority score with explainable keyword reasons.
- **Matching** searches verified, available responders in widening radii (3 → 8 → 20 → 50 km) and ranks them by distance, skill, rating, and caseload.
- **Responders** toggle availability, share live location, accept or decline, and progress cases.
- **Coordinators** get a live map dashboard, analytics (time to notify/accept, match success), responder verification, rematch/escalation, and a full audit trail per emergency.
- **PWA**: installable, with an app-shell cache for low connectivity.

AfriResQ does not replace police, fire, ambulance, or hospitals. It is a coordination layer beside them.

## Real notification delivery

Notifications are no longer simulated-only. Two real transports are wired in, each optional and independently configured — with no credentials set, everything falls back to the original console-logged simulation, so a fresh clone still runs with zero external accounts:

- **Web Push** (`backend/src/services/providers/push.js`) — real browser/OS notifications over the standard VAPID protocol, no paid service required. Generate a keypair once with `npx web-push generate-vapid-keys` (run from `backend/`) and put the values in `backend/.env`. Responders opt in from the "Enable push alerts" button on the Responder console; the service worker (`frontend/public/sw.js`) shows the notification even when the tab isn't open.
- **SMS** (`backend/src/services/providers/sms.js`) — via [Africa's Talking](https://africastalking.com) (a free sandbox account is enough to test). Set `AT_USERNAME` / `AT_API_KEY` (and optionally `AT_SENDER_ID`) in `backend/.env`. High/critical-severity alerts go out over SMS in addition to push, since a responder's phone may have connectivity for SMS but not push.

## Security

- **Refresh tokens**: access tokens are short-lived (`JWT_EXPIRES_IN`, default 15 minutes); a hashed, single-use, rotating refresh token (`REFRESH_TOKEN_TTL_DAYS`, default 30 days) keeps sessions alive without a long-lived access token. The frontend refreshes silently on a 401. `POST /api/auth/logout` revokes the current refresh token.
- **Login brute-force protection**: 5 failed attempts on a phone number locks it out for 15 minutes; `/api/auth/login`, `/register`, and `/refresh` are also rate-limited per IP.
- **Security headers** via `helmet`, and CORS restricted to `CORS_ORIGIN` (comma-separated) once set — blank/unset stays permissive for local dev.
- The server refuses to boot with the default `JWT_SECRET` when `NODE_ENV=production`.

## Production

```bash
cd frontend && npm run build
cd ../backend && npm start
```

The API serves `frontend/dist` when that folder exists, so a single process on port 4000 hosts both UI and API.

Or:

```bash
docker compose up --build
```

Then open [http://localhost:4000](http://localhost:4000).

Set `JWT_SECRET` to a long random value before any real deployment — the server now refuses to start with the default secret when `NODE_ENV=production`. See `backend/.env.example` for the full list of variables, including the optional push/SMS provider credentials above.

## Deploy the API (Render)

This backend is a Node server with SQLite, so deploy it on **Render**, not Vercel (Vercel is for static/frontend apps).

1. Push this repo to GitHub (already configured as `https://github.com/Se-babe/AfriResQ.git`).
2. On [Render](https://dashboard.render.com): **New → Blueprint**, connect `Se-babe/AfriResQ`, and apply `render.yaml`.
   Or **New → Web Service**, connect the repo, and set:
   - **Root Directory:** `backend`
   - **Build:** `npm install`
   - **Start:** `npm start`
   - **Environment:** `NODE_ENV=production` and a long random `JWT_SECRET`
3. For a **real (non-demo) deployment**, set `ADMIN_NAME`, `ADMIN_PHONE`, `ADMIN_PASSWORD` (and optionally `ADMIN_EMAIL`) in the service's Environment tab before the first deploy, and run `npm run bootstrap` once (Render's `initialDeployHook` in `render.yaml` already does this) instead of `npm run seed` — this creates one real admin/coordinator login instead of the public demo accounts. Everyone else should register their own account from the app; responders need an admin/coordinator to verify them from the dashboard before they can be matched.
   For real push notifications, also set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (generate with `npx web-push generate-vapid-keys` from `backend/`).
4. After deploy, the API URL looks like `https://afriresq-api.onrender.com`.
5. In the Android app landing screen, set **API URL** to that origin (no `/api` suffix) and tap **Save API URL**.

Free Render instances sleep after idle time; the first request after sleep can take ~30s. The free tier's disk is not guaranteed to persist across redeploys/restarts — for a real test where losing data matters, upgrade to a paid instance and attach a persistent disk. Health check: `GET /api/health`.

## Project layout

```
backend/     Express API, SQLite, classification & matching engines
frontend/    Vite + React client (citizen, responder, coordinator)
mobile/      Flutter Android app — open this folder in Android Studio
docs/        SRS, SDD, and original project brief
```

## Android app (Android Studio)

```
File → Open → /home/ssebabe/Desktop/AfriResQ/mobile
```

Install the Flutter and Dart plugins if Android Studio asks. The emulator default API is `http://10.0.2.2:4001`. Details in `mobile/README.md`.
