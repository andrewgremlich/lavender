export async function verifyTurnstile(
	token: string,
	secret: string,
	ip: string
): Promise<{ success: boolean; 'error-codes'?: string[] }> {
	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ secret, response: token, remoteip: ip })
	});
	return res.json();
}
