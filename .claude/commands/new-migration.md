Scaffold a new D1 migration file.

$ARGUMENTS should be a short description of the migration (e.g. "add push subscriptions table").

Steps:
1. List existing files in `migrations/` to determine the next sequence number (format: `NNNN_slug.sql`).
2. Convert the description to a lowercase kebab-case slug.
3. Create the new file at `migrations/NNNN_slug.sql` with a comment header and empty SQL body for the user to fill in.
4. Show the created file path and remind the user to run `/migrate` when ready.
