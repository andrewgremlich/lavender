import { describe, it, expect } from 'vitest';
import { requireUser, requireNonDemoUser, requireAdmin } from './auth';
import type { RequestEvent } from '@sveltejs/kit';

function makeEvent(user?: { userId: string; username: string; role: 'user' | 'demo' | 'admin' }) {
	return { locals: { user } } as unknown as RequestEvent;
}

describe('requireUser', () => {
	it('returns the user when authenticated', () => {
		const user = { userId: 'u1', username: 'alice', role: 'user' as const };
		const result = requireUser(makeEvent(user));
		expect(result).toEqual(user);
	});

	it('returns 401 when no user is present', async () => {
		const result = requireUser(makeEvent());
		expect(result).toBeInstanceOf(Response);
		const res = result as Response;
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: 'Unauthorized' });
	});
});

describe('requireNonDemoUser', () => {
	it('returns the user for regular users', () => {
		const user = { userId: 'u1', username: 'alice', role: 'user' as const };
		const result = requireNonDemoUser(makeEvent(user));
		expect(result).toEqual(user);
	});

	it('returns 403 for demo users', async () => {
		const user = { userId: 'demo', username: 'demo', role: 'demo' as const };
		const result = requireNonDemoUser(makeEvent(user));
		expect(result).toBeInstanceOf(Response);
		const res = result as Response;
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'Not available for guest accounts' });
	});

	it('returns 401 when not authenticated', async () => {
		const result = requireNonDemoUser(makeEvent());
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(401);
	});
});

describe('requireAdmin', () => {
	it('returns the user for admin users', () => {
		const user = { userId: 'a1', username: 'admin', role: 'admin' as const };
		const result = requireAdmin(makeEvent(user));
		expect(result).toEqual(user);
	});

	it('returns 403 for regular users', async () => {
		const user = { userId: 'u1', username: 'alice', role: 'user' as const };
		const result = requireAdmin(makeEvent(user));
		expect(result).toBeInstanceOf(Response);
		const res = result as Response;
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'Forbidden' });
	});

	it('returns 403 for demo users', async () => {
		const user = { userId: 'demo', username: 'demo', role: 'demo' as const };
		const result = requireAdmin(makeEvent(user));
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(403);
	});

	it('returns 401 when not authenticated', async () => {
		const result = requireAdmin(makeEvent());
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(401);
	});
});
