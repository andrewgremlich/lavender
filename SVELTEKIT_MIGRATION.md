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
- [ ] **Phase 4 — Auth flow**
  - `/auth/login`, `/auth/register`, `/auth/recovery` pages
  - Auth stores using Svelte 5 runes
  - `/app` layout redirect when unauthenticated
- [ ] **Phase 5 — App pages & components**
  - Dashboard, entry form, settings, analytics, nav, info, calendar, entry card
  - Componentize reusable primitives opportunistically as duplication emerges (not up front)
  - Component-scoped CSS using Svelte scoped styles (no shadow DOM); shared theme via CSS custom properties
- [ ] **Phase 6 — Reactive stores**
  - Port sync engine and IndexedDB services to `$lib/services`
  - Bridge their events into reactive runes/stores
  - Reactive decryption layer so components never touch crypto directly
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
