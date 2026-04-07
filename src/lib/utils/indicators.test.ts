import { describe, expect, it } from 'vitest';
import { countIndicators, getActiveIndicatorLabels, INDICATORS } from './indicators';

describe('countIndicators', () => {
	it('returns 0 for empty data', () => {
		expect(countIndicators({})).toBe(0);
	});

	it('counts only recognized indicator keys set to true', () => {
		expect(countIndicators({ cramping: true, moodChange: true, unrelated: true })).toBe(2);
	});

	it('ignores falsy values', () => {
		expect(countIndicators({ cramping: false, moodChange: 0, breastTenderness: null })).toBe(0);
	});
});

describe('getActiveIndicatorLabels', () => {
	it('returns empty array for no active indicators', () => {
		expect(getActiveIndicatorLabels({})).toEqual([]);
	});

	it('returns labels for active indicators in definition order', () => {
		const labels = getActiveIndicatorLabels({ cramping: true, appetiteChange: true });
		expect(labels).toEqual(['Appetite Change', 'Cramping']);
	});
});

describe('INDICATORS', () => {
	it('has 9 indicators', () => {
		expect(INDICATORS).toHaveLength(9);
	});

	it('each indicator has a key and label', () => {
		for (const ind of INDICATORS) {
			expect(ind.key).toBeTruthy();
			expect(ind.label).toBeTruthy();
		}
	});
});
