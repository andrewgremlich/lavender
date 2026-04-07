Apply D1 database migrations. Ask the user whether to target local or remote:

- **Local** (`pnpm db:migrate:local`): safe for development, applies to the local Wrangler D1 state
- **Remote** (`pnpm db:migrate:remote`): applies to the production D1 database — confirm explicitly before running

Show the files in `migrations/` first so the user knows what will be applied, then run the chosen command.
