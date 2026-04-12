import type { PageServerLoad } from './$types';

const FREE_TIER_LIMIT = 100;
const PRODUCTION_ORIGIN = 'https://lavender.app';

export const load: PageServerLoad = async (event) => {
	let userCount = 0;

	try {
		const db = event.platform?.env.lavender_db;
		if (db) {
			const row = await db
				.prepare("SELECT COUNT(*) as count FROM users WHERE role NOT IN ('demo','banned')")
				.first<{ count: number }>();
			userCount = row?.count ?? 0;
		}
	} catch {
		// Graceful fallback for local dev without wrangler
	}

	return {
		userCount,
		spotsRemaining: Math.max(0, FREE_TIER_LIMIT - userCount),
		origin: PRODUCTION_ORIGIN,
	};
};
