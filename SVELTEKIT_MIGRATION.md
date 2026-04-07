# SvelteKit Migration Plan

Convert Lavender from vanilla web components + Hono backend to a SvelteKit application.

## Routing & Pages
- Move the application to the `/app` route.
- Use SvelteKit file-based routing (no hash router).
- Auth routes are separate pages: `/auth/login`, `/auth/register`, `/auth/recovery`. The `/app` layout redirects to `/auth/login` if the user isn't logged in.
- Fill in a base `/` route as a simple static marketing/landing page.

## Backend Migration
- Fully replace Hono with SvelteKit `+server.ts` route handlers under `/api`. Remove Hono as a dependency entirely.
- Migrate `src/worker/crypto.ts` (server-side `generateId`, `generateSalt`, `hashPassword`, `timingSafeEqual`) to `$lib/server/crypto.ts`.
- Reimplement auth middleware, rate limiting, and security headers as SvelteKit hooks (`hooks.server.ts`). Ensure D1 bindings are accessible via `platform.env`.
- Update CSP to use nonces for SvelteKit's inline hydration scripts (current strict `script-src 'self'` will break hydration without this).

## Deployment
- Use `@sveltejs/adapter-cloudflare` for deployment. D1 bindings accessed via `platform.env`.
- The frontend and backend are still deployed with Cloudflare (Pages) and D1.

## Svelte 5 & State Management
- Use modern Svelte 5 practices (runes: `$state`, `$derived`, `$effect`).
- Replace all custom DOM events and imperative state with Svelte 5 runes and shared stores for auth state, sync status, and decrypted entries.
- Create a reactive decryption layer (derived store or context) so components receive decrypted entries without managing crypto directly.

## Components & Styling
- To share the theme, default to local components, and if possible use CSS custom properties.
- Componentize as much as possible. I want components reusable, like buttons or text.
- Make CSS local to the component (Svelte scoped styles, no shadow DOM).

## Services & Utilities
- Keep sync engine and IndexedDB services as-is in `$lib/services`, but bridge their events into reactive stores.
- Move utility modules to `$lib/utils` as-is. Do not rewrite fertility calculation logic.
- Move shared types (`src/shared/types.ts`) to `$lib/types.ts`. Move server-only types (`Env`, `UserRow`, `HealthEntryRow`, `UserSettingsRow`) to `$lib/server/types.ts` to avoid leaking into client bundles.
- Migrate path aliases from `@shared/*`, `@client/*`, `@worker/*` to SvelteKit's `$lib` structure.

## Chart.js
- Manage Chart.js instances with `onMount`/`onDestroy` or a Svelte action. Keep Chart.js.

## PWA & Service Worker
- Instead of the custom Vite plugin (`vite-sw-plugin.ts`), use `@vite-pwa/sveltekit`. Ensure offline-first caching and background sync still work.

## Testing & Tooling
- Keep Vitest for unit tests. Add component testing with `@testing-library/svelte`.
- Add Playwright for e2e.
- Migrate from Biome to eslint-plugin-svelte. ESLint should also handle formatting.

## Migration Order & Progress

Phases are committed incrementally. The legacy codebase lives under `legacy/` for reference and will be deleted in the final cleanup phase.

- [x] **Phase 1 — Scaffold SvelteKit + tooling swap**
  - SvelteKit 2.56 with `@sveltejs/adapter-cloudflare` 7.x, Svelte 5.55, Vite 5.4
  - Moved existing `src/`, `index.html`, `vite.config.ts`, `vite-sw-plugin.ts`, `biome.json`, `tsconfig.json`, `vitest.config.ts` to `legacy/` (git renames, history preserved)
  - Route stubs: `/` (landing placeholder), `/app`, `/auth/{login,register,recovery}`
  - Replaced Biome with ESLint 9 flat config + `eslint-plugin-svelte` + Prettier (linting migration done early per user preference)
  - Vitest config includes `legacy/src/**/*.test.ts` so the 28 fertility tests remain green throughout the migration
  - `wrangler.toml`: `main` → `.svelte-kit/cloudflare/_worker.js`, added `assets.directory` and `nodejs_compat` flag, D1 binding `lavender_db` unchanged
  - TypeScript downgraded 6.0.2 → 5.9 and Vite 8 → 5.4 to match SvelteKit ecosystem
  - `check`, `lint`, `test`, and `build` all green
- [x] **Phase 2 — API routes + server crypto/types**
  - Ported `/api/auth/{register,login,password,recovery-setup,recovery-start,recover,account}`, `/api/metrics`, `/api/metrics/[id]`, `/api/settings`, and `/api/health` from Hono to SvelteKit `+server.ts`
  - `$lib/server/crypto.ts` (PBKDF2 password hashing, salt/id generation, timing-safe equal) — direct port from legacy
  - `$lib/server/types.ts` — `UserRow`, `HealthEntryRow`, `UserSettingsRow`. The legacy `Env` interface was dropped in favor of SvelteKit's typed `App.Platform`
  - `$lib/server/jwt.ts` — hand-rolled HS256 using Web Crypto (no external JWT library, keeping the "no crypto deps" principle). Header is pinned to `{alg:"HS256",typ:"JWT"}` and checked on verify so tampered alg fields can't bypass verification
  - `$lib/server/db.ts` — `getPlatform(event)` helper that extracts D1 + JWT secret and returns 500 if misconfigured
  - `$lib/server/auth.ts` — temporary `requireAuth(event, jwtSecret)` helper; will be replaced by `event.locals.user` populated in `hooks.server.ts` in Phase 3
  - `$lib/server/validation.ts` — password complexity and username validation extracted from legacy auth routes
  - `$lib/types.ts` — client-safe shared types (`HealthEntryData`, `EncryptedEntry`, `UserSettings`, `AuthResponse`, `ApiError`)
  - **Dropped**: `/api/cleanup` endpoint. It required auth but allowed any authenticated user to delete expired entries across all users' data, with no known client caller. Per-user expiry already happens on every `GET /api/metrics`. If a global cleanup job is needed later, it should be a Cloudflare cron trigger, not an HTTP endpoint.
  - **Deferred to Phase 3**: CORS, security headers, rate limiting, and hoisting auth into hooks
- [x] **Phase 3 — `hooks.server.ts`**
  - `handleAuth` verifies `Authorization: Bearer <jwt>` and populates `event.locals.user`. Protected `+server.ts` routes now use `requireUser(event)` (synchronous, reads `event.locals.user`) instead of `requireAuth(event, jwtSecret)`. The helper still returns a 401 `Response` on failure — kept the same shape so migration of the route handlers stayed mechanical.
  - `handleSecurityHeaders` sets `X-Frame-Options`, `X-Content-Type-Options`, HSTS, `Referrer-Policy`. CSP is delegated to SvelteKit's built-in `kit.csp` config, not set manually.
  - **CSP mode: `hash`, not `nonce`.** `nonce` mode is incompatible with prerendering, and the Cloudflare adapter's SPA fallback page (`not_found_handling = "single-page-application"`) is prerendered — `nonce` mode breaks the build with "Cannot use prerendering if config.kit.csp.mode === 'nonce'". `hash` mode gives equivalent protection for inline hydration scripts with no runtime cost.
  - `handleRateLimit` replaces the legacy in-memory Map with a KV-backed sliding window: 20 requests per 15 minutes per `cf-connecting-ip`, applied only to `/api/*`. State is a JSON blob `{count, reset}` with `expirationTtl` set to the remaining window. If `RATE_LIMIT_KV` isn't bound (e.g. running under `vite preview` without workerd), limiting is skipped rather than failing closed.
  - `wrangler.toml` has a placeholder KV id. **Before `pnpm deploy`**, run `wrangler kv namespace create RATE_LIMIT_KV` and substitute the real id.
  - **Dropped**: the `/api/cleanup` route wasn't ported in Phase 2, and the legacy global JWT-secret-length check is now centralized in `getPlatform()`.
- [x] **Phase 4 — Auth flow**
  - `$lib/client/crypto.ts` — direct port of legacy `encryption.ts` (PBKDF2 key derivation, AES-GCM encrypt/decrypt, recovery code wrap/unwrap, sessionStorage helpers). Legacy `lavendar` salt prefix preserved.
  - `$lib/client/api.ts` — fetch wrapper with auto-attached bearer token. Only the auth subset is ported for Phase 4; metrics/settings clients land with Phase 5/6.
  - `$lib/client/auth.svelte.ts` — reactive auth store using Svelte 5 runes. Exposes `auth.loggedIn`, `auth.username`, and `register/login/recover/setupRecovery/logout`. Reads initial state from the JWT in sessionStorage on module load, expiring tokens client-side so the `/app` layout can redirect without waiting for an API 401. UI never touches sessionStorage or crypto directly.
  - `/auth/login`, `/auth/register`, `/auth/recovery` pages built with runes (`$state`, `$derived`, `$effect`). Register and recovery both surface the recovery code in a post-success screen gated by an acknowledgement checkbox. Recovery page has two modes: unauthenticated recover-with-code, and `?setup=1` for logged-in legacy accounts without a recovery code.
  - `/app/+layout.svelte` client-side redirect to `/auth/login` when `!auth.loggedIn`. The server already rejects unauthenticated `/api/*` calls via `hooks.server.ts`, so the layout only guards navigation.
  - Pages use scoped styles with inline colors for now — componentization of reusable primitives (button, input, etc.) is deferred to Phase 5 per the "not up front" rule.
- [x] **Phase 5 — App pages & components**
  - `src/app.css` holds the theme (CSS custom properties + resets), imported once from `src/routes/+layout.svelte`. All per-component styling lives in Svelte scoped `<style>` blocks — no shadow DOM, no global class dependencies.
  - `$lib/utils/{fertility,indicators,units}.ts` — direct copy from legacy. `icons.ts` was dropped; replaced by a single `$lib/components/Icon.svelte` wrapper that renders Lucide `IconNode`s as inline SVGs (one component handles all icon names used across the app).
  - `$lib/services/{db,metrics-store,sync-engine}.ts` — direct ports from legacy. The services remain event-driven (window `sync-status-change` / `sync-complete`) and are consumed by the reactive wrapper in `$lib/client/entries.svelte.ts`. Phase 6 will replace the event bridge with direct subscriptions.
  - `$lib/client/entries.svelte.ts` — reactive entries store (Svelte 5 runes). Handles decryption with the current key and a one-time legacy-key migration. Exposes `entries`, `fertility` (derived from `calculateFertilityIndicators`), `loading`, `error`, and `load/saveEntry/deleteEntry/clear`. Components never touch crypto or IDB directly.
  - `$lib/client/api.ts` extended with `metricsApi` (CRUD + deleteAll) and `settingsApi`, and `authApi.changePassword` / `authApi.deleteAccount` for settings flows.
  - `$lib/components/`: `NavBar.svelte`, `Icon.svelte`, `EntryCard.svelte`, `CycleCalendar.svelte`, `MetricChart.svelte`. The chart wrapper manages its Chart.js instance with an `$effect` (rebuild on prop change) + `onDestroy` (teardown). Same pattern used inline on the analytics page for its three tab charts.
  - `/app/+layout.svelte` mounts the NavBar, initializes the sync engine + entries store listener when logged in, and redirects to `/auth/login` otherwise.
  - Routes: `/app` (dashboard with MetricChart + CycleCalendar + recent EntryCards), `/app/entry` (log/edit form — edit state passed via sessionStorage from EntryCard, cleared on unmount), `/app/analytics` (comparison/luteal/accuracy tabs), `/app/settings` (units, retention, JSON/CSV export, password change, delete data, delete account, logout), `/app/info`.
  - **Dropped**: legacy PDF report export. It opened a `window.print()` popup with inline HTML — that pattern is unreliable under CSP and worth revisiting as a server-rendered endpoint later. JSON + CSV exports remain.
  - **Dropped**: `renderIcons` DOM-querying helper. All icon rendering now goes through `<Icon name="..." />`.
  - `check`, `lint`, `test` (28 legacy fertility tests), and `build` all green.
- [x] **Phase 6 — Reactive stores**
  - Services were already ported to `$lib/services/{db,metrics-store,sync-engine}.ts` in Phase 5 to unblock the UI work. Phase 6 focused on the bridge.
  - `sync-engine.ts` now exposes a direct subscription API — `onStatusChange(cb)` and `onSyncComplete(cb)` each return an unsubscribe function — replacing the `window.dispatchEvent('sync-status-change' | 'sync-complete')` bridge. `syncEngine.init()` is idempotent so remounting the `/app` layout doesn't double-register the `online` / service-worker listeners.
  - `$lib/client/sync.svelte.ts` — reactive wrapper (Svelte 5 runes). A module-load `onStatusChange` subscription pushes into `$state`, and `NavBar` reads `sync.status` directly. No more window event listeners in the component.
  - `$lib/client/entries.svelte.ts` — `startSyncListener` now calls `onSyncComplete` instead of `window.addEventListener('sync-complete', …)`; `stopSyncListener` invokes the unsubscribe handle the engine returned. The reactive decryption layer (entries + derived fertility) from Phase 5 is unchanged — components still consume `entriesStore.entries` and `entriesStore.fertility` without touching crypto or IDB.
  - `check`, `lint`, `test` (28 fertility tests), and `build` all green.
- [ ] **Phase 7 — PWA**
  - `@vite-pwa/sveltekit` replacing custom `vite-sw-plugin.ts`
  - Preserve offline-first caching and background sync
- [ ] **Phase 8 — Testing**
  - Component tests with `@testing-library/svelte`
  - Playwright e2e
- [ ] **Phase 9 — Final cleanup**
  - Delete `legacy/`
  - Remove any remaining legacy assets (`public/sw-template.js`, legacy `public/styles/*`)
  - Final dependency audit
