import { describe, expect, it } from 'vitest';
import { celsiusToFahrenheit, fahrenheitToCelsius } from './units';

describe('celsiusToFahrenheit', () => {
	it('converts 0°C to 32°F', () => {
		expect(celsiusToFahrenheit(0)).toBe(32);
	});

	it('converts 100°C to 212°F', () => {
		expect(celsiusToFahrenheit(100)).toBe(212);
	});

	it('converts 36.6°C to ~97.88°F', () => {
		expect(celsiusToFahrenheit(36.6)).toBeCloseTo(97.88, 1);
	});
});

describe('fahrenheitToCelsius', () => {
	it('converts 32°F to 0°C', () => {
		expect(fahrenheitToCelsius(32)).toBe(0);
	});

	it('converts 212°F to 100°C', () => {
		expect(fahrenheitToCelsius(212)).toBe(100);
	});

	it('round-trips correctly', () => {
		const original = 36.6;
		expect(fahrenheitToCelsius(celsiusToFahrenheit(original))).toBeCloseTo(original, 10);
	});
});
