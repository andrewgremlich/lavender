Run the Playwright e2e tests.

These require the preview server to be running. Steps:
1. Start `pnpm preview` in the background.
2. Run `pnpm test:e2e`.
3. Report results and stop the preview server.

The e2e tests cover: landing page content, sign-in navigation, and unauthenticated `/app` redirect to login.