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

## Suggested Migration Order
1. Scaffold SvelteKit project with `@sveltejs/adapter-cloudflare`
2. Migrate API routes (replace Hono `+server.ts` files) and server-side crypto/types
3. Set up `hooks.server.ts` (auth, rate limiting, security headers, CSP nonces)
4. Migrate auth flow (login/register/recovery pages, auth stores)
5. Migrate app components (dashboard, entry form, settings, analytics, nav)
6. Wire up reactive stores (sync engine bridge, decryption layer)
7. PWA/service worker (`@vite-pwa/sveltekit`)
8. Testing (Vitest components, Playwright e2e)
9. Linting migration (Biome → ESLint)
