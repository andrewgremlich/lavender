# Lavender Feature Roadmap

Lavender is a privacy-first fertility tracker with strong E2EE, cycle predictions, and a SvelteKit UI deployed on Cloudflare Workers. This roadmap covers planned features across three areas: analytics/insights, export/interoperability, and UX/engagement — phased by complexity and dependency.

---

## Phase 1: Quick Wins (low complexity, high value)

### 1. CSV Export ✅
- Add a "Download CSV" button next to existing JSON export
- Decrypt entries client-side (already done for JSON export), then serialize to CSV columns matching `HealthEntryData` fields
- Pure frontend change

### 2. Symptom Heatmap ❌ 

I don't know if this would be valuable.

- Grid visualization — X axis = cycle day (1–35), Y axis = each symptom
- Color intensity = frequency across all recorded cycles
- Reuse existing decrypted entry data and cycle detection from fertility utils
- Could use Chart.js matrix plugin or a custom canvas/HTML table

### 3. Prediction Accuracy Tracking ✅
- Compare past predictions against observed actuals (period start dates, ovulation dates)
- Calculate accuracy % and trend over time
- Pure client-side — predictions are already generated, just need retroactive comparison against recorded data

---

## Phase 2: Medium Complexity

### 4. Cycle Comparison View ✅
- Align multiple cycles by ovulation day (Day 0), overlay BBT curves and symptom indicators
- Chart.js multi-dataset line chart with cycle selector
- Builds on existing cycle segmentation logic

### 5. Luteal Phase Trends ✅
- Extract luteal phase length per cycle (ovulation to next period start)
- Plot over time as a trend line
- Flag if consistently <10 days or shortening (potential hormonal concern)

### 6. PDF Reports ✅
- Generate a printable cycle summary (last 1–3 cycles) with BBT chart, key dates, symptom summary
- Implemented using `@libpdf/core` (not `jsPDF` as originally scoped)
- PDF generated entirely client-side from decrypted data (preserves E2EE)

---

## Phase 3: Higher Complexity

### 7. Push Notifications (PWA)
- Request notification permission in settings
- Store push subscription in D1 (new `push_subscriptions` table)
- Add a scheduled worker (Cloudflare Cron Trigger) to send daily morning reminders
- Requires Web Push API + VAPID keys in env vars

### 8. Onboarding Tutorial
- Step-by-step walkthrough on first login (check flag in `localStorage`)
- Highlight: data entry form, chart interpretation, settings
- Tooltip/modal approach with sequential steps using a custom overlay component

### 9. Import from Other Apps
- Accept CSV/JSON uploads, parse into `HealthEntryData` format, encrypt and POST to API
- Start with generic CSV import, then add app-specific mappings for Clue, Flo, Natural Cycles

---

## Phase 4: Large Effort

### 10. Multi-language (i18n) ✅
- Used [`svelte-i18n`](https://github.com/kaisermann/svelte-i18n) — Svelte-native, store-based, works with Svelte 5
- ~300 strings extracted into `src/lib/i18n/{en,es,fr}.json`; locales lazy-loaded via `register()`
- `src/lib/i18n/index.ts` handles init, locale detection (localStorage → browser language → English fallback), and `storeLocale`/`getStoredLocale` helpers
- `setupI18n()` called once in the root `+layout.svelte`
- Language selector card added to Settings page; `locale.set()` updates the UI immediately without a page reload
- All components and routes updated to use `$_('key')` — NavBar, EntryCard, RangeSelector, ExportSection, ImportSection, ChangePasswordSection, DangerZoneSection, and all auth/app routes

---

## Phase 5: Marketing & Growth

### 12. Demo / Guest Account ✅

Allow visitors to explore the full app without registering. The demo account is a real user account (so all existing UI paths work unchanged) but writes are ephemeral.

**Implementation:**
- `migrations/0004_add-role.sql` — adds `role TEXT NOT NULL DEFAULT 'user'` to `users` table (values: `'user'` | `'demo'` | `'admin'`)
- `src/lib/server/auth.ts` — added `requireNonDemoUser()` helper that returns 403 for demo-role users
- `src/routes/api/auth/demo-login/+server.ts` — dedicated endpoint: validates demo user against `DEMO_PASSWORD` env var, issues a JWT with `role: 'demo'`
- `src/routes/api/auth/login/+server.ts` — `role` is now included in the JWT payload and login response
- `src/hooks.server.ts` — reads `role` from JWT into `event.locals.user`
- `src/routes/api/metrics/+server.ts` and `src/routes/api/metrics/[id]/+server.ts` — all writes (POST/PUT/DELETE) are no-ops for demo users: succeed with 200/201 but never touch D1
- `src/routes/api/auth/password/+server.ts` and `src/routes/api/auth/account/+server.ts` — use `requireNonDemoUser`, returning 403
- `src/lib/client/auth.svelte.ts` — added `auth.role`, `auth.isDemo`, and `auth.demoLogin()` (derives encryption key from the public demo password so seeded entries decrypt correctly)
- `src/lib/client/api.ts` — added `authApi.demoLogin()`
- `src/lib/components/PasswordGate.svelte` — bypasses the 24h re-verification gate for demo users
- `src/routes/+page.svelte` — "Try it out" outline button alongside "Sign in"; calls `auth.demoLogin()` on click
- `src/routes/app/+layout.svelte` — sticky demo banner: "You're exploring as a guest. [Create an account] to save your data."
- `src/routes/app/settings/+page.svelte` — hides `ChangePasswordSection` and `DangerZoneSection` for demo users, shows a placeholder card instead
- `scripts/seed-demo.ts` — seeds the demo user with 6 realistic cycles of data; prints the wrangler command to set `role='demo'` after seeding
- `package.json` — added `pnpm seed:demo` script
- `.dev.vars.example` — documents `JWT_SECRET` and `DEMO_PASSWORD` (value: `lavender-demo-2026!`)

**To activate:**
1. `pnpm db:migrate:local` (or `:remote`)
2. Add `DEMO_PASSWORD=lavender-demo-2026!` to `.dev.vars`
3. `pnpm seed:demo`
4. `wrangler d1 execute lavender-db --local --command "UPDATE users SET role='demo' WHERE username='demo';"`

### 13. Landing Page SEO & "Why Privacy Matters"
- Rebuild the `/` route as a proper marketing landing page with SEO meta tags (title, description, Open Graph, Twitter Card, canonical URL, structured data via JSON-LD)
- Add a "Why Privacy Matters" section — static copy explaining E2EE as the key differentiator vs other fertility trackers
- Add a disclosure of what data is stored and why, and if it's encrypted or not. Provide examples of cipher text with the encryption method.
- Dynamic Open Graph image generated via Cloudflare Worker showing live spots-remaining count for compelling social shares
- Server-side render the page via `+page.server.ts` `load` function for SEO

### 14. Live User Count & Free Tier
- Use the existing `users` table for user count (`SELECT COUNT(*) FROM users`) — no new table needed
- Landing page displays a live user count with a "free spots remaining" counter (first 100 users get cross-device sync free; after that it's paywalled)
- Create `GET /api/subscribers` endpoint returning current user count (public)

### 15. User Roles & Admin Panel ✅

- `role` column already present from step 12 migration (`'user' | 'demo' | 'admin'`); extended with `'banned'`
- `src/lib/types.ts` — `Role = 'user' | 'demo' | 'admin' | 'banned'`
- `src/app.d.ts` — `App.Locals.user.role` updated to include `'banned'`
- `src/lib/server/auth.ts` — `requireUser()` returns 403 for banned accounts; all downstream guards inherit this
- `src/routes/api/auth/login/+server.ts` — rejects banned users before issuing a JWT
- `src/routes/api/admin/users/+server.ts` — `GET` returns all users (id, username, role, created_at); admin only
- `src/routes/api/admin/users/[id]/+server.ts` — `DELETE` removes user; `PATCH` updates role; both guard against self-targeting
- `src/lib/client/api.ts` — `adminApi` with `getUsers`, `deleteUser`, `setUserRole`; `AdminUser` interface
- `src/routes/app/admin/+page.svelte` — user table with ban/unban, promote/demote, delete; client-side role guard redirects non-admins to `/app`; community posts section stubbed pending step 16
- `src/lib/components/layout/NavBar.svelte` — Admin nav link visible only when `auth.role === 'admin'`
- No migration needed — ban encoded as `role = 'banned'` in existing TEXT column

### 16. Community Posts (Feature Requests & Q&A)
- Feature requests are features already labeled and will be upvoted. I would control the feature request list.
- Q&A is asking users what list of features would they want. Like A., B., C. features.
- Add a unified `community_posts` table in D1 (`id`, `user_id`, `type` (`feature_request` | `question`), `title`, `description`, `votes`, `created_at`) — single table for both feature requests and Q&A
- Add a `community_post_votes` junction table (`user_id`, `post_id`, unique constraint) to enforce one vote per user
- Voting requires authentication (only registered users can vote)
- Reading/listing posts is public (no auth required)
- Create `GET /api/community-posts` endpoint returning posts filterable by `type`, sorted by votes (public)
- Create `POST /api/community-posts` endpoint for submitting new posts (auth required)
- Create `POST /api/community-posts/[id]/vote` endpoint for upvoting (auth required, one vote per user)

### 17. Changelog
- Add `changelog` as a `community_posts` type — admin-only posting
- Display a "What's New" feed on the landing page showing recent updates
- Publish an RSS feed (`/feed.xml`) of changelog entries for SEO and power users

### 18. Referral System
- Add a `referral_code` column to the `users` table (unique, auto-generated on registration)
- Add a `referred_by` column to track who invited whom
- Registration accepts an optional referral code via query param (`/auth/register?ref=CODE`)
- Incentive: referrer and invitee both get free cross-device sync (even after the 100-user threshold)
- Admin panel shows referral stats

### 19. Social Proof / Testimonials
- Add `testimonial` as a `community_posts` type
- Users can submit testimonials (auth required); admin approves before they appear on the landing page
- Add an `approved` boolean column to `community_posts` (default `false`, only admin can set `true`)
- Landing page displays approved testimonials in a rotating or grid layout

### 20. Public Roadmap View
- Dedicated section on the landing page (or `/roadmap` route) showing feature requests from `community_posts`
- Display vote counts, status (e.g. `planned`, `in_progress`, `shipped`), and allow logged-in users to vote
- Add a `status` column to `community_posts` (`TEXT NOT NULL DEFAULT 'open'`, values: `open` | `planned` | `in_progress` | `shipped`)
- Admin can update status from the admin panel