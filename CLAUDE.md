# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## SvelteKit Application

SvelteKit app deployed on Cloudflare Workers. Migration from vanilla web components + Hono is complete — see `SVELTEKIT_MIGRATION.md` for history.

Package manager is **pnpm**.

## Build & Development Commands

```bash
pnpm dev                 # Start Vite dev server with SvelteKit
pnpm build               # Production build
pnpm deploy              # Run tests, build, and deploy to Cloudflare
pnpm preview             # Preview production build locally
pnpm check               # svelte-kit sync + svelte-check type-checking
pnpm lint                # ESLint + Prettier check
pnpm format              # Prettier write
pnpm test                # Run vitest once (59 unit/component tests)
pnpm test:watch          # Watch mode
pnpm test:e2e            # Run Playwright e2e tests (requires preview server)
pnpm seed                # Seed local database with sample cycle data
pnpm db:user-count       # Print current user count from D1
pnpm db:migrate:local    # Apply pending D1 migrations locally
pnpm db:migrate:remote   # Apply pending D1 migrations to remote
```

**Environment setup:** Copy `.dev.vars.example` to `.dev.vars` and set `JWT_SECRET` (32+ chars).

## Architecture

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
- `/api/*` — SvelteKit `+server.ts` route handlers
- `/info` — help/info page

### Server code (`$lib/server`)

- `crypto.ts`: `hashPassword`, `generateSalt`, `generateId`, `timingSafeEqual`
- `types.ts`: `UserRow`, `HealthEntryRow`, `UserSettingsRow` (kept server-only to avoid leaking into client bundles)
- `jwt.ts`: hand-rolled HS256 using Web Crypto (no external JWT library)
- `db.ts`: `getPlatform(event)` helper that extracts D1 + JWT secret
- `validation.ts`: password complexity and username validation
- `hooks.server.ts`: auth (`event.locals.user`), KV-backed rate limiting, security headers. CSP uses **hash mode** (not nonce — incompatible with Cloudflare adapter's SPA prerendering)

### Client state

Svelte 5 runes (`$state`, `$derived`, `$effect`).

- `$lib/client/auth.svelte.ts` — reactive auth store (login/register/logout, JWT in sessionStorage)
- `$lib/client/entries.svelte.ts` — reactive entries store; handles decryption and one-time legacy key migration. Components never touch crypto or IDB directly.
- `$lib/client/sync.svelte.ts` — reactive sync status from the sync engine
- `$lib/client/crypto.ts` — PBKDF2 key derivation, AES-GCM encrypt/decrypt, recovery code wrap/unwrap
- `$lib/services/` — sync engine, IndexedDB wrapper, in-memory metrics store (event-driven, bridged into reactive stores)

### Database

Cloudflare D1. Schema managed via migrations in `migrations/`.

Tables: `users`, `user_settings`, `health_entries`. User settings include `data_retention_days` (default 180) and `default_date_range` (default `'30'`, the dashboard date range selector default).

Rate limiting uses a KV namespace (`RATE_LIMIT_KV`): 20 requests per 15-minute sliding window per IP, applied to `/api/*` only.

### Data Retention

Each entry has an `expires_at` timestamp derived from the user's configurable retention period (default 180 days). Expired entries are cleaned up on every GET to `/api/metrics`. CASCADE deletes on the `users` table prevent orphaned data.

## Health Metrics Tracked

Basal body temperature, cervical mucus (dry/sticky/creamy/watery/eggWhite), bleeding tracking (start/end/flow intensity), and boolean indicators: LH surge, appetite change, mood change, increased sex drive, breast tenderness, mild spotting, heightened smell, cervix changes, fluid retention, cramping. Plus freeform notes.
