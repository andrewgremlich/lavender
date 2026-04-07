# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## SvelteKit Application

This project was migrated from vanilla web components + Hono to SvelteKit. See `SVELTEKIT_MIGRATION.md` for the full migration history.

Package manager is **pnpm**.

## Build & Development Commands

```bash
pnpm dev                 # Start Vite dev server with SvelteKit
pnpm build               # Production build
pnpm deploy              # Build and deploy to Cloudflare
pnpm preview             # Preview production build locally
pnpm check               # svelte-kit sync + svelte-check type-checking
pnpm lint                # ESLint + Prettier check
pnpm format              # Prettier write
pnpm test                # Run vitest once
pnpm test:watch          # Watch mode
pnpm seed                # Seed local database with sample cycle data
pnpm db:migrate:local    # Apply pending D1 migrations locally
pnpm db:migrate:remote   # Apply pending D1 migrations to remote
```

**Environment setup:** Copy `.dev.vars.example` to `.dev.vars` and set `JWT_SECRET` (32+ chars).

## Architecture (target)

SvelteKit app deployed as a Cloudflare Worker via `@sveltejs/adapter-cloudflare`. D1 and KV bindings accessed through `platform.env`.

### End-to-End Encryption (E2EE)

The core privacy design: **the server never sees plaintext health data**.

- On login/registration, the client derives an AES-256-GCM encryption key from the user's password using PBKDF2 (100k iterations, SHA-256, salted with username)
- All health entries are encrypted client-side before transmission; the server stores opaque blobs + IVs
- The derived encryption key lives only in `sessionStorage` (cleared on tab close, never `localStorage`)
- If the user forgets their password, a recovery-code-wrapped key allows restoration; otherwise data is unrecoverable by design
- A legacy PBKDF2 salt (`lavendar:{username}`, typo preserved) is retained for backward compatibility with existing accounts

### Routing

- `/` — static marketing/landing page
- `/app/*` — authenticated app (redirects to `/auth/login` if not logged in)
- `/auth/login`, `/auth/register`, `/auth/recovery` — auth pages
- `/api/*` — SvelteKit `+server.ts` route handlers (replacing Hono)

### Server code (`$lib/server`)

- Crypto: `hashPassword`, `generateSalt`, `generateId`, `timingSafeEqual`
- Types: `Env`, `UserRow`, `HealthEntryRow`, `UserSettingsRow` (kept server-only to avoid leaking into client bundles)
- `hooks.server.ts` handles auth, KV-backed rate limiting, security headers, CSP nonces

### Client state

Svelte 5 runes (`$state`, `$derived`, `$effect`). Sync engine and IndexedDB services (from legacy `src/client/services`) will be ported to `$lib/services` and bridged into reactive stores. Decryption happens in a reactive layer so components never touch crypto directly.

### Database

Cloudflare D1. Schema managed via migrations in `migrations/` (unchanged from legacy).

### Data Retention

Each entry has an `expires_at` timestamp derived from the user's configurable retention period (default 180 days). Expired entries are cleaned up on every GET to `/api/metrics`. CASCADE deletes on the `users` table prevent orphaned data.

## Health Metrics Tracked

Basal body temperature, cervical mucus (dry/sticky/creamy/watery/eggWhite), bleeding tracking (start/end/flow intensity), and boolean indicators: LH surge, appetite change, mood change, increased sex drive, breast tenderness, mild spotting, heightened smell, cervix changes, fluid retention, cramping. Plus freeform notes.
