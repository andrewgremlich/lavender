# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev              # Start Vite dev server (HMR + worker in workerd via @cloudflare/vite-plugin)
npm run build            # Production build (client + worker)
npm run deploy           # Build and deploy to Cloudflare Workers
npm run preview          # Preview production build locally
npm run check            # Type-check and run biome both client and worker code
npm run seed             # Seed local database with sample cycle data
npm run db:migrate:local # Initialize/migrate local D1 database
npm run db:migrate:remote # Initialize/migrate remote D1 database
```

**Environment setup:** Copy `.dev.vars.example` to `.dev.vars` and set `JWT_SECRET` (32+ chars).

## Architecture

This is a **single Cloudflare Worker** serving both a Hono API backend and a Vite-built static frontend. The `@cloudflare/vite-plugin` handles both environments during dev and build.

### End-to-End Encryption (E2EE)

The core privacy design: **the server never sees plaintext health data**.

- On registration, the client generates an AES-256-GCM key (Web Crypto API) and shows it to the user to save externally
- All health entries are encrypted client-side before transmission; the server stores opaque blobs + IVs
- The encryption key lives only in `sessionStorage` (cleared on tab close, never `localStorage`)
- If the user loses their key, their data is unrecoverable by design

### Backend (`src/worker/`)

- **Framework:** Hono with JWT auth middleware
- **Database:** Cloudflare D1 (SQLite). Schema in `src/worker/db/schema.sql`
- **Password hashing:** PBKDF2 via Web Crypto API (100k iterations, SHA-256) — no external crypto libs
- **API routes** mounted under `/api/*`:
  - `/api/auth` — register, login, account deletion
  - `/api/metrics` — CRUD for encrypted health entries (auto-expires stale data on read)
  - `/api/settings` — data retention period config (changing retention recalculates all expiry dates)
- **Env bindings** defined in `src/worker/types.ts`: `DB` (D1), `JWT_SECRET`

### Frontend (`src/client/`)

- **No framework** — plain TypeScript Web Components with Shadow DOM
- **Routing:** Hash-based router (`src/client/router.ts`). Routes: `/` (chart dashboard), `/entry` (data form), `/settings`, `/info`
- **Styling:** Mobile-first CSS with custom properties. Lavender/purple theme. Dark mode via `prefers-color-scheme`. Breakpoints at 768px and 1024px.
- **Charts:** Chart.js for BBT line charts with fertility markers
- **Auth:** Password-based authentication

### Shared Types (`src/shared/types.ts`)

Interfaces shared between client and worker: `HealthEntryData`, `EncryptedEntry`, `UserSettings`, `AuthResponse`.

### Data Flow

1. User enters health data → client encrypts with AES-256-GCM → POST encrypted blob to `/api/metrics`
2. Server stores `encrypted_data` + `iv` + `expires_at` in D1 — never decrypts
3. Client fetches all entries → decrypts locally → renders Chart.js visualizations

### Data Retention

Each entry has an `expires_at` timestamp derived from the user's configurable retention period (default 365 days). Expired entries are cleaned up on every GET to `/api/metrics`. CASCADE deletes on the `users` table prevent orphaned data.

## TypeScript Configuration

Single `tsconfig.json` covers both client and worker code with DOM and DOM.Iterable libs. Uses `@shared/*`, `@client/*`, and `@worker/*` path aliases.

## Health Metrics Tracked

Basal body temperature, cervical mucus (dry/sticky/creamy/watery/eggWhite), bleeding tracking (start/end/flow intensity), and boolean indicators: LH surge, appetite change, mood change, increased sex drive, breast tenderness, mild spotting, heightened smell, cervix changes, fluid retention, cramping. Plus freeform notes.
