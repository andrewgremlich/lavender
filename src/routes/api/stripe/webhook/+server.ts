import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlatform } from '$lib/server/db';
import { verifyWebhookSignature } from '$lib/server/stripe';
import type { SubscriptionStatus } from '$lib/types';

function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
	switch (stripeStatus) {
		case 'active':
		case 'trialing':
			return 'active';
		case 'past_due':
			return 'past_due';
		default:
			return 'canceled';
	}
}

export const POST: RequestHandler = async (event) => {
	const { db, env } = getPlatform(event);
	const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
	if (!webhookSecret) {
		return json({ error: 'Webhook not configured' }, { status: 500 });
	}

	const rawBody = await event.request.text();
	const sigHeader = event.request.headers.get('stripe-signature') ?? '';

	const valid = await verifyWebhookSignature(rawBody, sigHeader, webhookSecret);
	if (!valid) {
		return json({ error: 'Invalid signature' }, { status: 400 });
	}

	const stripeEvent = JSON.parse(rawBody) as { type: string; data: { object: Record<string, unknown> } };

	switch (stripeEvent.type) {
		case 'checkout.session.completed': {
			const session = stripeEvent.data.object as {
				customer?: string;
				client_reference_id?: string;
				subscription?: string;
			};
			if (session.customer && session.client_reference_id) {
				await db
					.prepare(
						"UPDATE users SET stripe_customer_id = ?, subscription_status = 'active' WHERE id = ?"
					)
					.bind(session.customer, session.client_reference_id)
					.run();
			}
			break;
		}
		case 'customer.subscription.updated': {
			const sub = stripeEvent.data.object as { customer: string; status: string };
			const newStatus = mapStripeStatus(sub.status);
			await db
				.prepare('UPDATE users SET subscription_status = ? WHERE stripe_customer_id = ?')
				.bind(newStatus, sub.customer)
				.run();
			break;
		}
		case 'customer.subscription.deleted': {
			const sub = stripeEvent.data.object as { customer: string };
			await db
				.prepare("UPDATE users SET subscription_status = 'canceled' WHERE stripe_customer_id = ?")
				.bind(sub.customer)
				.run();
			break;
		}
		case 'invoice.payment_failed': {
			const invoice = stripeEvent.data.object as { customer: string };
			await db
				.prepare("UPDATE users SET subscription_status = 'past_due' WHERE stripe_customer_id = ?")
				.bind(invoice.customer)
				.run();
			break;
		}
	}

	return json({ received: true });
};
