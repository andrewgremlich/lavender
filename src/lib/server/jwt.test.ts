import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from './jwt';

const SECRET = 'test-secret-that-is-long-enough';

function futureExp(seconds = 3600): number {
	return Math.floor(Date.now() / 1000) + seconds;
}

describe('signJwt / verifyJwt', () => {
	it('signs and verifies a valid token', async () => {
		const payload = { sub: 'user-1', username: 'alice', exp: futureExp() };
		const token = await signJwt(payload, SECRET);
		const result = await verifyJwt(token, SECRET);
		expect(result).not.toBeNull();
		expect(result!.sub).toBe('user-1');
		expect(result!.username).toBe('alice');
	});

	it('rejects a token signed with a different secret', async () => {
		const token = await signJwt({ sub: 'u', username: 'u', exp: futureExp() }, SECRET);
		const result = await verifyJwt(token, 'wrong-secret');
		expect(result).toBeNull();
	});

	it('rejects an expired token', async () => {
		const pastExp = Math.floor(Date.now() / 1000) - 60;
		const token = await signJwt({ sub: 'u', username: 'u', exp: pastExp }, SECRET);
		const result = await verifyJwt(token, SECRET);
		expect(result).toBeNull();
	});

	it('rejects a malformed token', async () => {
		expect(await verifyJwt('not.a.jwt', SECRET)).toBeNull();
		expect(await verifyJwt('', SECRET)).toBeNull();
		expect(await verifyJwt('a.b', SECRET)).toBeNull();
	});

	it('rejects a token with tampered payload', async () => {
		const token = await signJwt({ sub: 'u', username: 'u', exp: futureExp() }, SECRET);
		const parts = token.split('.');
		// Tamper with the payload
		const tamperedPayload = btoa(
			JSON.stringify({ sub: 'admin', username: 'admin', exp: futureExp() })
		)
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
		expect(await verifyJwt(tampered, SECRET)).toBeNull();
	});

	it('produces a three-part dot-separated string', async () => {
		const token = await signJwt({ sub: 'u', username: 'u', exp: futureExp() }, SECRET);
		expect(token.split('.')).toHaveLength(3);
	});
});
