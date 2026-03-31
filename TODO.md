# TODO

## Features

- [x] **Password change with data re-encryption** — Implemented in settings panel. Client fetches all entries, decrypts with old key, re-encrypts with new key, and sends re-encrypted blobs + new password to `PUT /api/auth/password` which updates everything atomically via D1 batch.
