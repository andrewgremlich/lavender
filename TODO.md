# TODO

## Features

- [x] **Password change with data re-encryption** — Implemented in settings panel. Client fetches all entries, decrypts with old key, re-encrypts with new key, and sends re-encrypted blobs + new password to `PUT /api/auth/password` which updates everything atomically via D1 batch.

## Security Hardening

### Critical
- [x] 1. Protect `/api/cleanup` endpoint with authentication
- [x] 2. Fix timing attack vulnerability in login password comparison
- [x] 3. Use constant-time comparison for password change verification
- [x] 4. Add rate limiting on auth endpoints (register, login, password change)
- [x] 5. Add JWT token expiration

### High
- [x] 6. Restrict CORS to same-origin only
- [x] 7. Add security headers (X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, CSP)
- [x] 8. Add global error handler to prevent stack trace leakage
- [x] 9. Add input size validation on encrypted payloads
- [x] 10. Add max cap on dataRetentionDays setting
- [x] 11. Fix auth error message consistency ("User not found" leaks info)

### Medium
- [x] 12. Add try-catch around JWT parsing in settings-panel.ts
- [x] 13. Validate JWT_SECRET strength on startup
- [x] 14. Add error handling in getUserId middleware (return 401 instead of throwing)
