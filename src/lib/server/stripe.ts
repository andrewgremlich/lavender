const STRIPE_API = 'https://api.stripe.com/v1';

async function stripeRequest<T>(
	path: string,
	method: string,
	params: Record<string, string>,
	secretKey: string
): Promise<T> {
	const res = await fetch(`${STRIPE_API}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${secretKey}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: method !== 'GET' ? new URLSearchParams(params).toString() : undefined
	});
	const data = (await res.json()) as T & { error?: { message: string } };
	if (!res.ok) {
		throw new Error((data as { error?: { message: string } }).error?.message ?? `Stripe error ${res.status}`);
	}
	return data;
}

export interface CheckoutSessionParams {
	customerId?: string;
	customerEmail?: string;
	clientReferenceId: string;
	priceId: string;
	successUrl: string;
	cancelUrl: string;
}

export async function createCheckoutSession(
	params: CheckoutSessionParams,
	secretKey: string
): Promise<{ url: string; id: string }> {
	const body: Record<string, string> = {
		mode: 'subscription',
		'line_items[0][price]': params.priceId,
		'line_items[0][quantity]': '1',
		client_reference_id: params.clientReferenceId,
		success_url: params.successUrl,
		cancel_url: params.cancelUrl
	};
	if (params.customerId) {
		body.customer = params.customerId;
	} else if (params.customerEmail) {
		body.customer_email = params.customerEmail;
	}
	return stripeRequest('/checkout/sessions', 'POST', body, secretKey);
}

export async function createCustomerPortalSession(
	customerId: string,
	returnUrl: string,
	secretKey: string
): Promise<{ url: string }> {
	return stripeRequest(
		'/billing_portal/sessions',
		'POST',
		{ customer: customerId, return_url: returnUrl },
		secretKey
	);
}

export async function verifyWebhookSignature(
	rawBody: string,
	signatureHeader: string,
	webhookSecret: string
): Promise<boolean> {
	const parts = Object.fromEntries(
		signatureHeader.split(',').map((p) => p.split('=') as [string, string])
	);
	const t = parts['t'];
	const v1 = parts['v1'];
	if (!t || !v1) return false;

	if (Math.abs(Date.now() / 1000 - parseInt(t)) > 300) return false;

	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(webhookSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`));
	const computed = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	return computed === v1;
}
