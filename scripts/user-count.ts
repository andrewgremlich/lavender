/**
 * Query the number of users in the production database.
 *
 * Usage: npx wrangler d1 execute lavender-db --remote --command "SELECT COUNT(*) as user_count FROM users;"
 *
 * Or run this script:
 *   npx tsx scripts/user-count.ts
 */

import { execSync } from "node:child_process";

function main() {
	console.log("Querying user count from production database...\n");

	const result = execSync(
		'npx wrangler d1 execute lavender-db --remote --command "SELECT COUNT(*) as user_count FROM users;" --json',
		{ encoding: "utf-8" },
	);

	const parsed = JSON.parse(result);
	const rows = parsed[0]?.results;

	if (rows && rows.length > 0) {
		console.log(`Total users: ${rows[0].user_count}`);
	} else {
		console.log("No results returned.");
	}
}

main();
