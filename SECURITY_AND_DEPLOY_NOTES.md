# Security and deploy notes

## What was fixed in this archive
- removed real database credentials from `.env.example`
- replaced the old `auth=1` cookie with a signed session cookie
- added encrypted storage for saved passwords via `DATA_ENCRYPTION_KEY`
- stopped returning raw site and Cloudflare passwords in list APIs
- updated the UI so stored passwords stay hidden
- removed obsolete legacy SSH metrics files that were no longer used
- removed `tsconfig.tsbuildinfo` from the archive

## New environment variables
Add these in Railway or your hosting panel:

```bash
AUTH_COOKIE_SECRET=long-random-string
DATA_ENCRYPTION_KEY=another-long-random-string
```

You can keep `MONITOR_INTERNAL_SECRET`, but do not reuse short values.

## About old passwords already stored in the DB
Old rows that were saved before this patch may still be plaintext in PostgreSQL.
They are now hidden from the UI/API.

They will be re-saved in encrypted form when you edit and save the record again.

## Validation status
- project-level TypeScript check was run locally
- the only remaining local TypeScript error is Prisma client generation, because this environment cannot download Prisma engines from the internet
- in a normal deploy environment, `prisma generate` / `npm install` should resolve that part automatically
