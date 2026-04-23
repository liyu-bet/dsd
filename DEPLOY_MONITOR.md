# Deploy monitor app after security hardening

## What changed
- Server monitoring still uses a push agent over HTTPS.
- Admin auth now uses a signed session cookie instead of a static `auth=1` cookie.
- Stored site and Cloudflare passwords are now encrypted before being saved to PostgreSQL.
- API list endpoints no longer return raw passwords to the browser.
- The worker still handles background server/site checks and offline detection.

## Required deploy steps

### 1) Update environment variables
Set these in the web service and the worker service:

```bash
DATABASE_URL=...
ADMIN_PASSWORD=...
APP_URL=https://your-domain-or-subdomain
AUTH_COOKIE_SECRET=generate-a-long-random-string
DATA_ENCRYPTION_KEY=generate-another-long-random-string
SITE_CHECK_BATCH_SIZE=10
SITE_CHECK_INTERVAL_MS=60000
SERVER_CHECK_INTERVAL_MS=60000
SITE_INITIAL_DELAY_MS=10000
SERVER_INITIAL_DELAY_MS=15000
SITE_JOB_LOCK_TTL_SEC=1800
SERVER_JOB_LOCK_TTL_SEC=120
SERVER_HEARTBEAT_TTL_SEC=180
MONITOR_INTERNAL_SECRET=generate-a-long-random-string
```

Recommendations:
- use different values for `AUTH_COOKIE_SECRET`, `DATA_ENCRYPTION_KEY`, and `MONITOR_INTERNAL_SECRET`
- each secret should be at least 32 random characters
- do not rotate `DATA_ENCRYPTION_KEY` unless you plan to re-save encrypted passwords

### 2) Install dependencies
```bash
npm install
```

### 3) Apply Prisma migrations
```bash
npm run db:deploy
```

### 4) Deploy the web service
```bash
npm run start
```

### 5) Deploy a second service as worker
Use the same repository/archive, but start it with:

```bash
npm run worker:start
```

## Important behaviour after this update
- Existing plaintext passwords in the database are still readable by the app code, but they are hidden from the UI/API now.
- Passwords will become encrypted automatically the next time you edit and save the site or Cloudflare record.
- The dashboard no longer exposes stored passwords in lists.
- If `AUTH_COOKIE_SECRET`, `DATA_ENCRYPTION_KEY`, or `MONITOR_INTERNAL_SECRET` are too short or missing, auth/encryption will fail by design.

## Notes
- `APP_URL` must point to the public web service URL so the agent can post heartbeats.
- The dashboard auto-refresh only reloads data from PostgreSQL.
- Manual server refresh recalculates online/offline states from the latest heartbeat.
- Background monitoring depends on the worker service.
- No inbound port needs to be opened on the monitored server.
