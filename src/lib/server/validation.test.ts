import { describe, expect, it } from 'vitest';
import { validatePassword, validateUsername } from './validation';

describe('validatePassword', () => {
	it('rejects passwords shorter than 12 characters', () => {
		expect(validatePassword('Short1!')).toBe('Password must be at least 12 characters');
	});

	it('rejects passwords without a digit', () => {
		expect(validatePassword('NoDigitsHere!!')).toBe('Password must contain at least one number');
	});

	it('rejects passwords without a special character', () => {
		expect(validatePassword('NoSpecial1234')).toBe(
			'Password must contain at least one special character'
		);
	});

	it('accepts a valid password', () => {
		expect(validatePassword('ValidPass1!xx')).toBeNull();
	});

	it('accepts edge case: exactly 12 characters', () => {
		expect(validatePassword('Abcdefghij1!')).toBeNull();
	});
});

describe('validateUsername', () => {
	it('rejects usernames shorter than 3 characters', () => {
		expect(validateUsername('ab')).toBe('Username must be 3-50 characters');
	});

	it('rejects usernames longer than 50 characters', () => {
		expect(validateUsername('a'.repeat(51))).toBe('Username must be 3-50 characters');
	});

	it('accepts a valid username', () => {
		expect(validateUsername('alice')).toBeNull();
	});

	it('accepts edge cases: 3 and 50 characters', () => {
		expect(validateUsername('abc')).toBeNull();
		expect(validateUsername('a'.repeat(50))).toBeNull();
	});
});
