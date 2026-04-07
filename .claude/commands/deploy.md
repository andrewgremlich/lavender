Deploy the Lavender app to Cloudflare.

The deploy script (`pnpm deploy`) runs tests, builds, and deploys in one step. Before running it:

1. Confirm with the user that they want to deploy to production.
2. Run `git status` and show any uncommitted changes — warn if there are any.
3. Show the most recent commit so the user knows what's being deployed.
4. If the user confirms, run `pnpm deploy` and report the outcome.
