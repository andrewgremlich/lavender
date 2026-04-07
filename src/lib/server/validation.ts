/**
 * Password complexity rules (matches legacy behavior):
 *   - 12+ characters
 *   - at least one digit
 *   - at least one special character (non-alphanumeric)
 *
 * Returns an error message or null if the password is valid.
 */
export function validatePassword(password: string): string | null {
	if (password.length < 12) {
		return 'Password must be at least 12 characters';
	}
	if (!/\d/.test(password)) {
		return 'Password must contain at least one number';
	}
	if (!/[^a-zA-Z0-9]/.test(password)) {
		return 'Password must contain at least one special character';
	}
	return null;
}

export function validateUsername(username: string): string | null {
	if (username.length < 3 || username.length > 50) {
		return 'Username must be 3-50 characters';
	}
	return null;
}
