# Security Notes

Known attack vectors and mitigations for Lavender. Updated as issues are found and fixed.

---

## Closed

### Entry spam per user
- **Risk:** A registered user could flood `POST /api/metrics` with entries.
- **Mitigation:** Server-side cap of 365 entries per user (1/day × max retention policy). Returns 429 when exceeded.
- **File:** `src/routes/api/metrics/+server.ts`

### Duplicate entries per day
- **Risk:** Client could submit multiple entries for the same date, inflating DB storage.
- **Mitigation:** `entryForDate()` in the entries store detects duplicates before submission and prompts the user to edit the existing entry instead.
- **File:** `src/lib/client/entries.svelte.ts`, `src/routes/app/entry/+page.svelte`

### Demo account writes
- **Risk:** Anyone can log in as the demo user (password is public by design) and write entries.
- **Mitigation:** All writes (POST/DELETE) to `/api/metrics` and PUT/DELETE to `/api/metrics/[id]` for `role='demo'` users are no-ops — they return synthetic success but never touch D1.
- **File:** `src/routes/api/metrics/+server.ts`, `src/routes/api/metrics/[id]/+server.ts`

### Oversized payloads
- **Risk:** Client sends a very large encrypted blob to bloat the DB.
- **Mitigation:** `encryptedData` capped at 100KB, `iv` capped at 100 bytes per entry (on both POST and PUT). Returns 413 if exceeded.
- **File:** `src/routes/api/metrics/+server.ts`, `src/routes/api/metrics/[id]/+server.ts`

### Demo account privilege escalation
- **Risk:** Demo user attempts to change password or delete account.
- **Mitigation:** `requireNonDemoUser()` on the password and account-delete endpoints returns 403 for `role='demo'`. `requireAdmin()` separately gates `/api/admin/*`.
- **File:** `src/lib/server/auth.ts`

### Seed script as attack surface
- **Risk:** Old seed scripts used the HTTP API (register → login → POST entries), meaning the login endpoint was needed and the password was sent over the wire.
- **Mitigation:** Seed scripts now write directly to D1 via `wrangler d1 execute`. No HTTP API involved.
- **Files:** `scripts/seed.ts`, `scripts/seed-demo.ts`

### Registration bot spam (CAPTCHA)
- **Risk:** Unlimited automated account creation.
- **Mitigation:** Cloudflare Turnstile verification on `POST /api/auth/register` when `TURNSTILE_SECRET_KEY` is set. Verification runs server-side against the Turnstile siteverify endpoint with the client IP.
- **Files:** `src/routes/api/auth/register/+server.ts`, `src/lib/server/turnstile.ts`

---

## Open

Severity scale:
- **Critical** — remotely exploitable, broad impact, no meaningful mitigation
- **High** — exploitable with conditions, meaningful damage
- **Medium** — limited impact or requires chained conditions
- **Low** — hardening / defense-in-depth

### ~~Authenticated request rate~~ — **Medium**
- **Risk:** Authenticated requests (valid JWT) are fully exempt from rate limiting (`hooks.server.ts:37-40`). A user could POST 365 entries as fast as the server accepts, consuming significant compute in one burst even though the DB cap prevents bloat.
- **Rationale:** Cost risk on Workers compute, not data risk. Storage is bounded by the 365-entry cap.
- **Mitigation available:** Apply a softer rate limit (e.g. 300 req/15min) even for authenticated users, using the same KV sliding window pattern as the existing limiter.

### No email / identity verification — **Low** (by-design)
- **Risk:** By design (E2EE, no PII). Means there is no account recovery path beyond the recovery code, and no way to contact a user if their account is abused.
- **Rationale:** Intentional privacy trade-off, not a vulnerability — a documented constraint.
- **Note:** This is an intentional privacy trade-off. Recovery codes cover the legitimate lost-password case. Document clearly in user-facing copy.

### ~~Missing `role` in JWT for non-login auth endpoints~~ — **Low**
- **Risk:** The login endpoint (`src/routes/api/auth/login/+server.ts:40`) and demo-login endpoint (`src/routes/api/auth/demo-login/+server.ts:36`) include `role` in the JWT, but the register, password-change, and account-recovery endpoints do not. `hooks.server.ts:24` defaults a missing role to `'user'`. A demo user who changes their password or recovers their account would be treated as a regular user (bypassing `requireNonDemoUser()` guards) until they log in again. Note: in practice, the password-change endpoint is guarded by `requireNonDemoUser` so the demo path can't reach the token issuance there, but the register and recover endpoints still emit role-less JWTs and should include the correct role for defense in depth.
- **Rationale:** Partially mitigated: `requireNonDemoUser` guards password change; demo users can't register. Residual risk is defense-in-depth only.
- **Files:** `src/routes/api/auth/register/+server.ts:89-92`, `src/routes/api/auth/password/+server.ts:65-72`, `src/routes/api/auth/recover/+server.ts:103-110`

### ~~JWT and encryption key stored in localStorage~~ — **High**
- **Risk:** Both the JWT token (`api.ts:14`) and the AES-256 encryption key (`crypto.ts:85`) are stored in `localStorage`. Any same-origin XSS vulnerability would expose both the session token and the key needed to decrypt all health data. `localStorage` persists across tabs and browser restarts, widening the exposure window.
- **Rationale:** Any same-origin XSS yields full plaintext health-data access plus a valid session. CSP + no third-party scripts is the only wall; `style-src 'unsafe-inline'` widens the XSS surface.
- **Note:** The codebase comment acknowledges this trade-off (sessionStorage and localStorage are equally accessible to same-origin JS). The real mitigation is the CSP policy preventing script injection. However, moving to `sessionStorage` or memory-only storage would limit persistence if a key were ever extracted.
- **Files:** `src/lib/client/api.ts:10-18`, `src/lib/client/crypto.ts:81-107`

### ~~Plaintext health data in sessionStorage during edit~~ — **Medium**
- **Risk:** When a user clicks "Edit" on an entry, the full decrypted entry object (temperature, cycle data, notes) is written to `sessionStorage` as JSON and read on the edit page. This data remains readable until the tab is closed. Any XSS attack during this window can read plaintext health data without needing the encryption key.
- **Rationale:** Requires XSS during an edit window — narrower than the localStorage exposure, but the data is already decrypted, so no key is needed to read it.
- **Mitigation available:** Store only the entry ID in sessionStorage and re-decrypt on the edit page.
- **Files:** `src/lib/components/display/EntryCard.svelte:132`, `src/routes/app/entry/+page.svelte:83`

### ~~No validation on re-encrypted entries array~~ — **Medium**
- **Risk:** The password-change and account-recovery endpoints accept an unbounded `reEncryptedEntries` array. A malicious client could send thousands of entries with arbitrary IDs, causing excessive D1 batch statements. Entry IDs are not validated for format, and `encryptedData`/`iv` fields in the array have no size cap (unlike the main POST endpoint which enforces 100 KB).
- **Rationale:** Authenticated-only. Worst case is oversized D1 batch on password change; bounded by rotation frequency but the missing inner-field size caps are sloppy.
- **Fix:** Array capped at 365; each entry ID validated against `[a-zA-Z0-9_-]{1,64}`; `encryptedData` ≤ 128 KB; `iv` ≤ 64 bytes. Applied to both endpoints.
- **Files:** `src/routes/api/auth/password/+server.ts`, `src/routes/api/auth/recover/+server.ts`

### ~~No length validation on recovery/encryption fields at registration~~ — **Medium**
- **Risk:** The `wrappedEncryptionKey`, `wrappedEncryptionKeyIv`, `recoveryCodeHash`, and `recoveryCodeSalt` fields accepted during registration have no size limits. A client could send megabyte-sized strings that get stored directly in D1. The same fields on `recovery-setup` and the rotated versions on `recover` are also unvalidated.
- **Rationale:** Unauthenticated endpoint — a registration bot (post-Turnstile) could store megabyte blobs per account. Amplified by the missing registration IP cap.
- **Fix:** `wrappedEncryptionKey` ≤ 1 KB, IV ≤ 64 bytes, hash/salt ≤ 512 bytes enforced at `register`, `recovery-setup`, and `recover`.
- **Files:** `src/routes/api/auth/register/+server.ts`, `src/routes/api/auth/recovery-setup/+server.ts`, `src/routes/api/auth/recover/+server.ts`

### ~~User enumeration via recovery endpoint error messages~~ — **Medium**
- **Risk:** `recovery-start` returns "No recovery code found for this account" (404) when the user exists but has no recovery code, and a different error for an invalid code (401). This lets an attacker probe which usernames are registered.
- **Rationale:** Distinct 404 vs 401 reveals username existence, enabling targeted password/recovery-code attacks against known users. Cheap to fix.
- **Fix:** Both `recovery-start` and `recover` now return a uniform `"Invalid username or recovery code"` 401 for all failure cases.
- **File:** `src/routes/api/auth/recovery-start/+server.ts`, `src/routes/api/auth/recover/+server.ts`

### ~~No token revocation on password change~~ — **Fixed**
- **Fix:** `token_epoch` column added to `users` table (migration `0006_add-token-epoch.sql`). Incremented on password change and recovery. `hooks.server.ts` validates JWT epoch matches DB value; stale tokens are rejected immediately.
- **Files:** `migrations/0006_add-token-epoch.sql`, `src/hooks.server.ts`, `src/routes/api/auth/password/+server.ts`, `src/routes/api/auth/recover/+server.ts`

### ~~No per-endpoint rate limiting on auth flows~~ — **High**
- **Risk:** The global rate limit (100 req / 15 min per IP) applies uniformly to all unauthenticated `/api/*` routes. Login, recovery-start, and demo-login should have stricter limits (e.g. 10 req / 15 min for login/recovery-start) to prevent credential brute-forcing and recovery code guessing.
- **Rationale:** ~6.6 guesses/min per IP across a shared bucket — fine for 128-bit recovery codes but too loose for weak passwords, especially with proxy rotation.
- **Mitigation available:** Add endpoint-specific rate-limit keys in the existing KV sliding-window pattern (e.g. `rl:login:{ip}` with a lower threshold).
- **Files:** `src/hooks.server.ts:32-85`

### ~~Registration IP cap~~ — **Medium**
- **Risk:** Turnstile addresses bot registration but does not prevent a determined attacker with human-solved CAPTCHAs (or bypasses) from creating many accounts per IP. Each account carries up to ~36 MB of storage quota (365 × 100 KB).
- **Rationale:** Storage-exhaustion attack, not data-exposure. Turnstile already handles the bulk bot case.
- **Mitigation available:** Add a small IP cap (e.g. 3 registrations per IP per 24 h) in the existing `RATE_LIMIT_KV` namespace, stored as hashed IP counters. Complements Turnstile.

### ~~Hardcoded salt for recovery code wrapping key~~ — **Low**
- **Risk:** The PBKDF2 wrapping key for recovery codes uses a fixed salt (`'lavender-recovery'`) for all users. This means two users with the same recovery code produce the same wrapping key. While recovery codes have 128 bits of entropy (making collision unlikely), a per-user random salt stored server-side would be more robust.
- **Rationale:** Collision requires two users to pick the same 128-bit code — astronomically unlikely. Pure hardening.
- **File:** `src/lib/client/crypto.ts:147`

### Deterministic encryption key salt (username-based) — **Low** (by-design)
- **Risk:** The PBKDF2 salt for deriving the AES encryption key is `lavender:{username}` (or `lavendar:{username}` for legacy accounts). This is deterministic — if two users pick the same password, they derive the same key. A per-user random salt stored alongside the password hash would prevent this, but would require the server to return the salt on login (which the current flow doesn't do).
- **Rationale:** Documented E2EE constraint — salt must be derivable client-side pre-login. Usernames are unique so impact is theoretical.
- **Note:** Acceptable trade-off given E2EE constraints (the salt must be derivable client-side without a server round-trip before login completes). Document as a known limitation.
- **File:** `src/lib/client/crypto.ts:11,25,40`

### ~~CSP allows `unsafe-inline` for styles~~ — **Medium**
- **Risk:** The CSP `style-src` directive includes `'unsafe-inline'`, which weakens protection against style-based injection attacks (CSS exfiltration, UI redressing).
- **Rationale:** Enables CSS exfiltration and UI redressing given any HTML-injection point. Multiplies the consequence of XSS-adjacent bugs.
- **Note:** Svelte's scoped styles require either `unsafe-inline` or nonce/hash injection. SvelteKit's `csp.mode: 'hash'` should handle script hashes but may not cover all generated styles. Investigate whether `unsafe-inline` can be removed for `style-src`.
- **File:** `svelte.config.js:23`

### SQL string interpolation in seed scripts — **Low** (accepted)
- **Risk:** Seed scripts (`seed.ts`, `seed-demo.ts`) use template-literal interpolation to build SQL queries passed to `wrangler d1 execute --command`. While the values are internally generated (not user input), this pattern is fragile — a generated value containing a single quote would break the SQL or cause unintended behavior.
- **Rationale:** Scripts run locally on self-generated data. Not an attack surface unless the dev environment is already compromised. All interpolated values are hardcoded constants or crypto-generated UUIDs/base64; base64 output is additionally escaped with `replace(/'/g, "''")`. Accepted as-is.
- **Files:** `scripts/seed.ts`, `scripts/seed-demo.ts`

### ~~Missing security headers~~ — **Low**
- **Fix:** Added `Permissions-Policy` (disables camera/mic/geolocation/payment), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, and `preload` to HSTS.
- **File:** `src/hooks.server.ts`

### ~~Community posts: no validation on title/description length or rate~~ — **Medium**
- **Risk:** `POST /api/community-posts` accepts unbounded `title` and `description` strings, and has no per-user rate limit beyond the global IP cap (which authenticated users bypass entirely). A single authenticated user could flood the community board with arbitrarily large posts.
- **Rationale:** Authenticated-only, but every user has a free, uncapped write path to a public table. Storage exhaustion + UX damage from spam posts.
- **Mitigation available:** Cap title (e.g. 200 chars) and description (e.g. 5 KB) server-side; add a per-user post cap (e.g. 10/day) in KV.
- **Files:** `src/routes/api/community-posts/+server.ts`

---

## Prioritized Fix Queue

Order chosen so each step closes the biggest remaining gap.

1. ~~**Per-endpoint rate limits on login/recovery-start** (High, ~30 min)~~
2. ~~**Token epoch / revocation on password change** (High, ~1–2 h)~~
3. ~~**Move JWT + encryption key to `sessionStorage` or in-memory** (High, wider refactor — changes session-survival UX)~~
4. ~~**Collapse recovery-start error messages** (Medium, trivial)~~
5. ~~**Drop `unsafe-inline` from style-src** (Medium, needs testing with SvelteKit CSP hash mode)~~
6. ~~**Community post length + per-user rate cap** (Medium, ~30 min)~~
7. ~~**Field length caps on register/recover/recovery-setup** (Medium, ~30 min)~~
8. ~~**Cap + validate `reEncryptedEntries`** (Medium, ~30 min)~~
9. ~~**Registration IP cap in KV** (Medium, ~1 h)~~
10. Remaining Low-rated items as hardening passes.

---

## E2EE Compatibility Notes

The following common anti-spam measures are **incompatible** with the E2EE + no-PII design and should not be added:

- Email verification (requires storing an email)
- SMS / phone verification (requires a phone number)
- Email-based password recovery (replaced by recovery codes)

Any future anti-abuse measure should store only derived or ephemeral data (IP hashes, counters, tokens) — never plaintext contact information.
