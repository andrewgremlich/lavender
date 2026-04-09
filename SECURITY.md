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
- **Mitigation:** All writes (POST/PUT/DELETE) to `/api/metrics` for `role='demo'` users are no-ops — they return success but never touch D1.
- **File:** `src/routes/api/metrics/+server.ts`, `src/routes/api/metrics/[id]/+server.ts`

### Oversized payloads
- **Risk:** Client sends a very large encrypted blob to bloat the DB.
- **Mitigation:** `encryptedData` capped at 100KB, `iv` capped at 100 bytes per entry. Returns 413 if exceeded.
- **File:** `src/routes/api/metrics/+server.ts`

### Demo account privilege escalation
- **Risk:** Demo user attempts to change password or delete account.
- **Mitigation:** `requireNonDemoUser()` on the password and account delete endpoints returns 403 for `role='demo'`.
- **File:** `src/lib/server/auth.ts`

### Seed script as attack surface
- **Risk:** Old seed scripts used the HTTP API (register → login → POST entries), meaning the login endpoint was needed and the password was sent over the wire.
- **Mitigation:** Seed scripts now write directly to D1 via `wrangler d1 execute`. No HTTP API involved.
- **Files:** `scripts/seed.ts`, `scripts/seed-demo.ts`

---

## Open

### Registration spam
- **Risk:** No limit on how many accounts can be created. An attacker can register thousands of accounts (each with up to 365 × 100KB = ~36MB quota) using proxies to bypass the 100 req/15min IP rate limit. At scale this could exhaust D1 storage.
- **Mitigations available (not yet implemented):**
  - **IP cap in KV** — e.g. 3 registrations per IP per 24h. Uses the existing `RATE_LIMIT_KV` namespace, no PII stored. Simplest fix.
  - **Invite/referral codes** — already on the roadmap (step 18). Only people with a code can register.
  - **Cloudflare Turnstile** — CAPTCHA alternative that works at the edge with no PII. Free tier. Natural fit since the app already runs on Cloudflare Workers.
  - **Proof-of-work** — client solves a computational puzzle before registration. No PII, no third party, raises bulk registration cost significantly.
- **Recommended:** IP cap in KV now; Turnstile closer to public launch.

### Authenticated request rate
- **Risk:** Authenticated requests (valid JWT) are fully exempt from rate limiting. A user could POST 365 entries as fast as the server accepts, consuming significant compute in one burst even though the DB cap prevents bloat.
- **Mitigation available:** Apply a softer rate limit (e.g. 300 req/15min) even for authenticated users, using the same KV sliding window pattern as the existing limiter.

### No email / identity verification
- **Risk:** By design (E2EE, no PII). Means there is no account recovery path beyond the recovery code, and no way to contact a user if their account is abused.
- **Note:** This is an intentional privacy trade-off. Recovery codes cover the legitimate lost-password case. Document clearly in user-facing copy.

### Missing `role` in JWT for non-login auth endpoints
- **Risk:** The login endpoint includes `role: user.role` in the JWT, but the register, password-change, and account-recovery endpoints do not. `hooks.server.ts` defaults a missing role to `'user'`. A demo user who changes their password or recovers their account would be treated as a regular user (bypassing `requireNonDemoUser()` guards) until they log in again.
- **Files:** `src/routes/api/auth/register/+server.ts:76`, `src/routes/api/auth/password/+server.ts:65-71`, `src/routes/api/auth/recover/+server.ts:103-110`

### JWT and encryption key stored in localStorage
- **Risk:** Both the JWT token (`api.ts:14`) and the AES-256 encryption key (`crypto.ts:85`) are stored in `localStorage`. Any same-origin XSS vulnerability would expose both the session token and the key needed to decrypt all health data. `localStorage` persists across tabs and browser restarts, widening the exposure window.
- **Note:** The codebase comment acknowledges this trade-off (sessionStorage and localStorage are equally accessible to same-origin JS). The real mitigation is the CSP policy preventing script injection. However, moving to `sessionStorage` or memory-only storage would limit persistence if a key were ever extracted.
- **Files:** `src/lib/client/api.ts:10-14`, `src/lib/client/crypto.ts:81-107`

### Plaintext health data in sessionStorage during edit
- **Risk:** When a user edits an entry, the full decrypted entry object (temperature, cycle data, notes) is written to `sessionStorage` as JSON. This data remains readable until the tab is closed. Any XSS attack during this window can read plaintext health data without needing the encryption key.
- **Mitigation available:** Store only the entry ID in sessionStorage and re-decrypt on the edit page.
- **Files:** `src/lib/components/EntryCard.svelte:119`, `src/routes/app/entry/+page.svelte:198`

### No validation on re-encrypted entries array
- **Risk:** The password-change and account-recovery endpoints accept an unbounded `reEncryptedEntries` array. A malicious client could send thousands of entries with arbitrary IDs, causing excessive D1 batch statements. Entry IDs are not validated for format, and `encryptedData`/`iv` fields in the array have no size cap (unlike the main POST endpoint which enforces 100 KB).
- **Mitigation available:** Cap the array at 365 (matching the entry-per-user limit), validate ID format, and enforce the same size limits on `encryptedData`/`iv`.
- **Files:** `src/routes/api/auth/password/+server.ts:51-61`, `src/routes/api/auth/recover/+server.ts:89-99`

### No length validation on recovery/encryption fields at registration
- **Risk:** The `wrappedEncryptionKey`, `wrappedEncryptionKeyIv`, `recoveryCodeHash`, and `recoveryCodeSalt` fields accepted during registration have no size limits. A client could send megabyte-sized strings that get stored directly in D1.
- **Mitigation available:** Cap each field (e.g. `wrappedEncryptionKey` at 1 KB, `recoveryCodeHash` at 512 bytes, etc.).
- **File:** `src/routes/api/auth/register/+server.ts:49-70`

### User enumeration via recovery endpoint error messages
- **Risk:** `recovery-start` returns "No recovery code found for this account" (404) when the user exists but has no recovery code, and a different error for an invalid code (401). This lets an attacker probe which usernames are registered.
- **Mitigation available:** Return a generic "Invalid username or recovery code" (401) for all failure cases.
- **File:** `src/routes/api/auth/recovery-start/+server.ts:27-39`

### No token revocation on password change
- **Risk:** After a password change or account recovery, a new JWT is issued but old tokens remain valid for up to 24 hours. If a token was stolen before the password change, the attacker retains access.
- **Mitigation available:** Store a `token_epoch` (integer) on the user row; increment it on password change. Include the epoch in the JWT and reject tokens with a stale epoch. Lightweight alternative to a full revocation list.
- **Files:** `src/routes/api/auth/password/+server.ts`, `src/routes/api/auth/recover/+server.ts`, `src/lib/server/jwt.ts`

### No per-endpoint rate limiting on auth flows
- **Risk:** The global rate limit (100 req / 15 min per IP) applies uniformly to all unauthenticated API routes. Login and recovery-start should have stricter limits (e.g. 10 req / 15 min) to prevent credential brute-forcing and recovery code guessing.
- **Mitigation available:** Add endpoint-specific rate-limit keys in the existing KV sliding-window pattern (e.g. `rl:login:{ip}` with a lower threshold).
- **Files:** `src/hooks.server.ts:32-85`

### Hardcoded salt for recovery code wrapping key
- **Risk:** The PBKDF2 wrapping key for recovery codes uses a fixed salt (`'lavender-recovery'`) for all users. This means two users with the same recovery code produce the same wrapping key. While recovery codes have 128 bits of entropy (making collision unlikely), a per-user random salt stored server-side would be more robust.
- **File:** `src/lib/client/crypto.ts:147`

### Deterministic encryption key salt (username-based)
- **Risk:** The PBKDF2 salt for deriving the AES encryption key is `lavender:{username}` (or `lavendar:{username}` for legacy accounts). This is deterministic — if two users pick the same password, they derive the same key. A per-user random salt stored alongside the password hash would prevent this, but would require the server to return the salt on login (which the current flow doesn't do).
- **Note:** Acceptable trade-off given E2EE constraints (the salt must be derivable client-side without a server round-trip before login completes). Document as a known limitation.
- **File:** `src/lib/client/crypto.ts:11,28-40`

### CSP allows `unsafe-inline` for styles
- **Risk:** The CSP `style-src` directive includes `'unsafe-inline'`, which weakens protection against style-based injection attacks (CSS exfiltration, UI redressing).
- **Note:** Svelte's scoped styles require either `unsafe-inline` or nonce/hash injection. SvelteKit's `csp.mode: 'hash'` should handle script hashes but may not cover all generated styles. Investigate whether `unsafe-inline` can be removed for `style-src`.
- **File:** `svelte.config.js:23`

### SQL string interpolation in seed scripts
- **Risk:** Seed scripts (`seed.ts`, `seed-demo.ts`) use template-literal interpolation to build SQL queries passed to `wrangler d1 execute --command`. While the values are internally generated (not user input), this pattern is fragile — a generated value containing a single quote would break the SQL or cause unintended behavior.
- **Mitigation available:** Escape values or switch to JSON-based batch execution.
- **Files:** `scripts/seed.ts:288-331`, `scripts/seed-demo.ts:291-340`

### Missing security headers
- **Risk:** Several recommended security headers are absent:
  - `Permissions-Policy` — prevents access to browser features (camera, microphone, geolocation) that this app doesn't use.
  - `Cross-Origin-Opener-Policy: same-origin` — isolates the browsing context from cross-origin popups.
  - `Cross-Origin-Embedder-Policy: require-corp` — enables cross-origin isolation.
  - HSTS is present but missing the `preload` directive.
- **File:** `src/hooks.server.ts:87-94`

---

## E2EE Compatibility Notes

The following common anti-spam measures are **incompatible** with the E2EE + no-PII design and should not be added:

- Email verification (requires storing an email)
- SMS / phone verification (requires a phone number)
- Email-based password recovery (replaced by recovery codes)

Any future anti-abuse measure should store only derived or ephemeral data (IP hashes, counters, tokens) — never plaintext contact information.
