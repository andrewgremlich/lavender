import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireNonDemoUser } from '$lib/server/auth';
import { getPlatform } from '$lib/server/db';
import { createCheckoutSession } from '$lib/server/stripe';
import type { SubscriptionStatus } from '$lib/types';

export const POST: RequestHandler = async (event) => {
	const { db, env } = getPlatform(event);
	const authResult = requireNonDemoUser(event);
	if (authResult instanceof Response) return authResult;
	const { userId, username } = authResult;

	if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
		return json({ error: 'Billing not configured' }, { status: 503 });
	}

	const userRow = await db
		.prepare('SELECT stripe_customer_id, subscription_status FROM users WHERE id = ?')
		.bind(userId)
		.first<{ stripe_customer_id: string | null; subscription_status: SubscriptionStatus }>();

	if (userRow?.subscription_status === 'active') {
		return json({ error: 'Already subscribed' }, { status: 400 });
	}

	const origin = new URL(event.request.url).origin;
	const session = await createCheckoutSession(
		{
			customerId: userRow?.stripe_customer_id ?? undefined,
			customerEmail: userRow?.stripe_customer_id ? undefined : username,
			clientReferenceId: userId,
			priceId: env.STRIPE_PRICE_ID,
			successUrl: `${origin}/app/settings?checkout=success`,
			cancelUrl: `${origin}/app/settings?checkout=canceled`
		},
		env.STRIPE_SECRET_KEY
	);

	return json({ url: session.url });
};
