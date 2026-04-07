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
- Options: `jsPDF` library, or render HTML and use `window.print()` with print-specific CSS
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

### 10. Multi-language (i18n)
- Extract all user-facing strings into translation files (JSON per locale)
- Lightweight i18n utility (simple key lookup with fallback)
- Language selector in settings, preference stored in `localStorage`
- Start with English + 1-2 additional languages
- Touches every component, so best done after other features stabilize

---

## Phase 5: Marketing & Growth

### 12. Landing Page SEO & "Why Privacy Matters"
- Rebuild the `/` route as a proper marketing landing page with SEO meta tags (title, description, Open Graph, Twitter Card, canonical URL, structured data via JSON-LD)
- Add a "Why Privacy Matters" section — static copy explaining E2EE as the key differentiator vs other fertility trackers
- Dynamic Open Graph image generated via Cloudflare Worker showing live spots-remaining count for compelling social shares
- Server-side render the page via `+page.server.ts` `load` function for SEO

### 13. Live User Count & Free Tier
- Use the existing `users` table for user count (`SELECT COUNT(*) FROM users`) — no new table needed
- Landing page displays a live user count with a "free spots remaining" counter (first 100 users get cross-device sync free; after that it's paywalled)
- Create `GET /api/subscribers` endpoint returning current user count (public)

### 14. User Roles & Admin Panel
- Add a `role` column to the `users` table (`TEXT NOT NULL DEFAULT 'user'`, values: `user` | `admin`) via migration
- Admin panel at `/app/admin` — accessible only to users with `role = 'admin'`
  - CRUD management for community posts (edit, delete, change type)
  - View and manage user list
  - Server-side role check in `+page.server.ts` load function; redirect non-admins

### 15. Community Posts (Feature Requests & Q&A)
- Add a unified `community_posts` table in D1 (`id`, `user_id`, `type` (`feature_request` | `question`), `title`, `description`, `votes`, `created_at`) — single table for both feature requests and Q&A
- Add a `community_post_votes` junction table (`user_id`, `post_id`, unique constraint) to enforce one vote per user
- Voting requires authentication (only registered users can vote)
- Reading/listing posts is public (no auth required)
- Create `GET /api/community-posts` endpoint returning posts filterable by `type`, sorted by votes (public)
- Create `POST /api/community-posts` endpoint for submitting new posts (auth required)
- Create `POST /api/community-posts/[id]/vote` endpoint for upvoting (auth required, one vote per user)

### 16. Changelog
- Add `changelog` as a `community_posts` type — admin-only posting
- Display a "What's New" feed on the landing page showing recent updates
- Publish an RSS feed (`/feed.xml`) of changelog entries for SEO and power users

### 17. Referral System
- Add a `referral_code` column to the `users` table (unique, auto-generated on registration)
- Add a `referred_by` column to track who invited whom
- Registration accepts an optional referral code via query param (`/auth/register?ref=CODE`)
- Incentive: referrer and invitee both get free cross-device sync (even after the 100-user threshold)
- Admin panel shows referral stats

### 18. Social Proof / Testimonials
- Add `testimonial` as a `community_posts` type
- Users can submit testimonials (auth required); admin approves before they appear on the landing page
- Add an `approved` boolean column to `community_posts` (default `false`, only admin can set `true`)
- Landing page displays approved testimonials in a rotating or grid layout

### 19. Public Roadmap View
- Dedicated section on the landing page (or `/roadmap` route) showing feature requests from `community_posts`
- Display vote counts, status (e.g. `planned`, `in_progress`, `shipped`), and allow logged-in users to vote
- Add a `status` column to `community_posts` (`TEXT NOT NULL DEFAULT 'open'`, values: `open` | `planned` | `in_progress` | `shipped`)
- Admin can update status from the admin panel