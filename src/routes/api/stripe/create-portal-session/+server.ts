import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireNonDemoUser } from '$lib/server/auth';
import { getPlatform } from '$lib/server/db';
import { createCustomerPortalSession } from '$lib/server/stripe';

export const POST: RequestHandler = async (event) => {
	const { db, env } = getPlatform(event);
	const authResult = requireNonDemoUser(event);
	if (authResult instanceof Response) return authResult;
	const { userId } = authResult;

	if (!env.STRIPE_SECRET_KEY) {
		return json({ error: 'Billing not configured' }, { status: 503 });
	}

	const userRow = await db
		.prepare('SELECT stripe_customer_id FROM users WHERE id = ?')
		.bind(userId)
		.first<{ stripe_customer_id: string | null }>();

	if (!userRow?.stripe_customer_id) {
		return json({ error: 'No active subscription' }, { status: 400 });
	}

	const origin = new URL(event.request.url).origin;
	const session = await createCustomerPortalSession(
		userRow.stripe_customer_id,
		`${origin}/app/settings`,
		env.STRIPE_SECRET_KEY
	);

	return json({ url: session.url });
};
