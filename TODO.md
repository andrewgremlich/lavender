# TODO

## Features

- [ ] **Password change requires data re-encryption** — If a password-change feature is added, the client must fetch all existing health entries, decrypt them with the old derived key, re-encrypt with the new derived key, and PATCH them back before the password change is committed server-side. The AES-256-GCM key is derived from the password via PBKDF2 (`src/client/crypto/encryption.ts`), so a different password produces a different key and makes existing ciphertext unreadable.
