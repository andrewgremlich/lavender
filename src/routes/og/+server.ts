import type { RequestHandler } from './$types';

const FREE_TIER_LIMIT = 100;

function buildSvg(spotsLabel: string): string {
	// Escape XML special chars in the label
	const safeLabel = spotsLabel
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

	// Estimate pill width: ~14px per char + 48px padding, clamped to [320, 680]
	const pillWidth = Math.min(680, Math.max(320, safeLabel.length * 14 + 48));
	const pillX = 80;
	const pillCenterX = pillX + pillWidth / 2;

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <!-- Background -->
  <rect width="1200" height="630" fill="#faf5ff"/>
  <!-- Left accent bar -->
  <rect x="0" y="0" width="12" height="630" fill="#936bf2"/>

  <!-- App name -->
  <text x="80" y="210"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif"
        font-size="100" font-weight="700" fill="#936bf2">Lavender</text>

  <!-- Subtitle -->
  <text x="80" y="285"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif"
        font-size="38" font-weight="400" fill="#1e1b4b">Private Fertility Tracker</text>

  <!-- Tagline -->
  <text x="80" y="345"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif"
        font-size="26" fill="#6b7280">Your health data, encrypted before it leaves your device.</text>

  <!-- Spots pill background -->
  <rect x="${pillX}" y="400" width="${pillWidth}" height="64" rx="32" fill="#936bf2"/>

  <!-- Spots label -->
  <text x="${pillCenterX}" y="440" text-anchor="middle" dominant-baseline="middle"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif"
        font-size="24" font-weight="600" fill="#ffffff">${safeLabel}</text>

  <!-- Domain -->
  <text x="1120" y="600" text-anchor="end"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif"
        font-size="22" fill="#9ca3af">lavender.app</text>
</svg>`;
}

export const GET: RequestHandler = async (event) => {
	let spotsRemaining = FREE_TIER_LIMIT;

	try {
		const db = event.platform?.env.lavender_db;
		if (db) {
			const row = await db
				.prepare("SELECT COUNT(*) as count FROM users WHERE role NOT IN ('demo','banned')")
				.first<{ count: number }>();
			spotsRemaining = Math.max(0, FREE_TIER_LIMIT - (row?.count ?? 0));
		}
	} catch {
		// Fallback: show full spots available
	}

	const label =
		spotsRemaining > 0
			? `${spotsRemaining} free sync spot${spotsRemaining === 1 ? '' : 's'} remaining`
			: 'Free tier full — join the waitlist';

	return new Response(buildSvg(label), {
		headers: {
			'Content-Type': 'image/svg+xml',
			'Cache-Control': 'public, max-age=300, s-maxage=300',
		},
	});
};
