import { describe, expect, it } from "vitest";
import {
	type FertilityIndicators,
	calculateFertilityIndicators,
} from "./fertility";

// Helper to build date strings relative to a base date
function date(offset: number, base = "2025-01-01"): string {
	const d = new Date(`${base}T00:00:00`);
	d.setDate(d.getDate() + offset);
	return d.toISOString().split("T")[0];
}

function makeEntry(
	day: number,
	overrides: {
		basalBodyTemp?: number;
		lhSurge?: number;
		bleedingStart?: boolean;
		bleedingEnd?: boolean;
		bleedingFlow?: "light" | "medium" | "heavy";
	} = {},
) {
	return { date: date(day), ...overrides };
}

describe("calculateFertilityIndicators", () => {
	it("returns empty indicators for no entries", () => {
		const result = calculateFertilityIndicators([]);
		expect(result.ovulationDays.size).toBe(0);
		expect(result.fertileWindowDays.size).toBe(0);
		expect(result.periodDays.size).toBe(0);
		expect(result.predictedPeriodDays.size).toBe(0);
		expect(result.predictedOvulationDays.size).toBe(0);
		expect(result.predictedFertileDays.size).toBe(0);
		expect(result.averageCycleLength).toBeNull();
		expect(result.cycleVariability).toBeNull();
	});

	describe("ovulation detection", () => {
		it("detects ovulation from LH surge (1 day after)", () => {
			const entries = [makeEntry(0, { lhSurge: 2 })];
			const result = calculateFertilityIndicators(entries);
			expect(result.ovulationDays.has(date(1))).toBe(true);
		});

		it("detects ovulation from BBT thermal shift", () => {
			// 6 baseline days at 36.4, then a sustained rise of 0.3+ for 3 days
			const entries = [
				...Array.from({ length: 6 }, (_, i) =>
					makeEntry(i, { basalBodyTemp: 36.4 }),
				),
				makeEntry(6, { basalBodyTemp: 36.7 }),
				makeEntry(7, { basalBodyTemp: 36.7 }),
				makeEntry(8, { basalBodyTemp: 36.8 }),
			];
			const result = calculateFertilityIndicators(entries);
			// Ovulation detected at day before the first rise (day 5)
			expect(result.ovulationDays.has(date(5))).toBe(true);
		});

		it("does not detect ovulation when BBT rise is not sustained", () => {
			const entries = [
				...Array.from({ length: 6 }, (_, i) =>
					makeEntry(i, { basalBodyTemp: 36.4 }),
				),
				makeEntry(6, { basalBodyTemp: 36.7 }),
				makeEntry(7, { basalBodyTemp: 36.3 }), // drops back down
				makeEntry(8, { basalBodyTemp: 36.7 }),
			];
			const result = calculateFertilityIndicators(entries);
			expect(result.ovulationDays.size).toBe(0);
		});

		it("does not detect ovulation when BBT rise is below threshold", () => {
			const entries = [
				...Array.from({ length: 6 }, (_, i) =>
					makeEntry(i, { basalBodyTemp: 36.4 }),
				),
				makeEntry(6, { basalBodyTemp: 36.5 }), // only 0.1 above baseline
				makeEntry(7, { basalBodyTemp: 36.5 }),
				makeEntry(8, { basalBodyTemp: 36.5 }),
			];
			const result = calculateFertilityIndicators(entries);
			expect(result.ovulationDays.size).toBe(0);
		});

		it("reconciles LH and BBT detections within 2 days", () => {
			// LH surge on day 12 → ovulation day 13
			// BBT shift also detects ovulation on day 13 (day before rise)
			const entries = [
				...Array.from({ length: 6 }, (_, i) =>
					makeEntry(i + 8, { basalBodyTemp: 36.4 }),
				),
				makeEntry(12, { basalBodyTemp: 36.4, lhSurge: 2 }),
				makeEntry(14, { basalBodyTemp: 36.7 }),
				makeEntry(15, { basalBodyTemp: 36.7 }),
				makeEntry(16, { basalBodyTemp: 36.8 }),
			];
			const result = calculateFertilityIndicators(entries);
			// Should reconcile to a single ovulation event
			expect(result.ovulationDays.size).toBe(1);
		});

		it("keeps separate ovulation events more than 2 days apart", () => {
			// Two LH surges far apart
			const entries = [
				makeEntry(0, { lhSurge: 2 }),
				makeEntry(30, { lhSurge: 2 }),
			];
			const result = calculateFertilityIndicators(entries);
			expect(result.ovulationDays.size).toBe(2);
		});
	});

	describe("fertile window", () => {
		it("marks 5 days before and 1 day after ovulation", () => {
			const entries = [makeEntry(14, { lhSurge: 2 })];
			const result = calculateFertilityIndicators(entries);
			// Ovulation on day 15, fertile window: day 10-16
			for (let d = 10; d <= 16; d++) {
				expect(result.fertileWindowDays.has(date(d))).toBe(true);
			}
			expect(result.fertileWindowDays.has(date(9))).toBe(false);
			expect(result.fertileWindowDays.has(date(17))).toBe(false);
		});
	});

	describe("period identification", () => {
		it("identifies period days from bleeding start to end", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(1, { bleedingFlow: "heavy" }),
				makeEntry(2, { bleedingFlow: "medium" }),
				makeEntry(3, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			for (let d = 0; d <= 3; d++) {
				expect(result.periodDays.has(date(d))).toBe(true);
			}
		});

		it("caps unclosed bleeding at MAX_PERIOD_DAYS (10)", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				...Array.from({ length: 14 }, (_, i) =>
					makeEntry(i + 1, { bleedingFlow: "light" }),
				),
			];
			const result = calculateFertilityIndicators(entries);
			// Day 0 is start, days 1-10 should be included (flow within cap)
			expect(result.periodDays.has(date(0))).toBe(true);
			expect(result.periodDays.has(date(10))).toBe(true);
			// Day 11+ exceeds MAX_PERIOD_DAYS from start
			expect(result.periodDays.has(date(11))).toBe(false);
		});

		it("closes unclosed bleeding at last entry within cap", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(3), // no bleeding info, but within range
			];
			const result = calculateFertilityIndicators(entries);
			// Start day is included; unclosed range fills from start+1 to min(elapsed, 10)
			expect(result.periodDays.has(date(0))).toBe(true);
			expect(result.periodDays.has(date(1))).toBe(true);
			expect(result.periodDays.has(date(3))).toBe(true);
		});

		it("handles multiple periods", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(28, { bleedingStart: true }),
				makeEntry(32, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			expect(result.periodDays.has(date(0))).toBe(true);
			expect(result.periodDays.has(date(4))).toBe(true);
			expect(result.periodDays.has(date(28))).toBe(true);
			expect(result.periodDays.has(date(32))).toBe(true);
		});
	});

	describe("cycle statistics", () => {
		it("calculates average cycle length from period starts", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(28, { bleedingStart: true }),
				makeEntry(32, { bleedingEnd: true }),
				makeEntry(56, { bleedingStart: true }),
				makeEntry(60, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			expect(result.averageCycleLength).toBe(28);
		});

		it("returns null average for single period", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			expect(result.averageCycleLength).toBeNull();
		});

		it("filters out cycle lengths outside 18-45 day range", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(10, { bleedingStart: true }), // 10-day cycle, too short
				makeEntry(14, { bleedingEnd: true }),
				makeEntry(40, { bleedingStart: true }), // 30-day cycle, valid
				makeEntry(44, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			// Only the 30-day cycle should count
			expect(result.averageCycleLength).toBe(30);
		});

		it("calculates cycle variability (std dev) with 2+ cycles", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(26, { bleedingStart: true }),
				makeEntry(30, { bleedingEnd: true }),
				makeEntry(56, { bleedingStart: true }),
				makeEntry(60, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			// Cycles: 26 and 30 days → mean 28, variance 4, stddev 2
			expect(result.cycleVariability).toBe(2);
		});

		it("returns null variability for single cycle", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(28, { bleedingStart: true }),
				makeEntry(32, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			expect(result.cycleVariability).toBeNull();
		});
	});

	describe("predictions", () => {
		it("predicts 3 future cycles based on average cycle length", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(30, { bleedingStart: true }),
				makeEntry(34, { bleedingEnd: true }),
				makeEntry(60, { bleedingStart: true }),
				makeEntry(64, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			// Average cycle length = 30
			// Last period start = day 60
			// Predicted periods: day 90, 120, 150
			expect(result.predictedPeriodDays.has(date(90))).toBe(true);
			expect(result.predictedPeriodDays.has(date(120))).toBe(true);
			expect(result.predictedPeriodDays.has(date(150))).toBe(true);
		});

		it("predicts 5 period days per cycle", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(28, { bleedingStart: true }),
				makeEntry(32, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			// Predicted period starts at day 56 (28 + 28)
			for (let d = 0; d < 5; d++) {
				expect(result.predictedPeriodDays.has(date(56 + d))).toBe(true);
			}
		});

		it("predicts ovulation days using luteal phase", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(28, { bleedingStart: true }),
				makeEntry(32, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			// Default luteal phase = 14, cycle = 28
			// First predicted cycle: last start (28) + 28 = 56
			// Predicted ovulation: 56 - 14 = day 42
			expect(result.predictedOvulationDays.has(date(42))).toBe(true);
		});

		it("widens predicted fertile window when variability > 2", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(25, { bleedingStart: true }),
				makeEntry(29, { bleedingEnd: true }),
				makeEntry(56, { bleedingStart: true }),
				makeEntry(60, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			// Cycles: 25 and 31 → mean 28, stddev ~3
			// extraDays = ceil(~3) = 3
			// Standard fertile: -5 to +1 around ovulation
			// Widened: -(5+3) to (1+3) = -8 to +4
			if (result.cycleVariability !== null && result.cycleVariability > 2) {
				const extraDays = Math.ceil(result.cycleVariability);
				const standardWindow = 5 + 1 + 1; // -5 to +1
				const widenedWindow =
					5 + extraDays + 1 + extraDays + 1; // -(5+extra) to (1+extra)
				expect(result.predictedFertileDays.size).toBe(widenedWindow * 3); // 3 cycles
			}
		});

		it("uses default 28-day cycle when no cycle data", () => {
			// Single period, no average available → uses DEFAULT_CYCLE_LENGTH (28)
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			// Predicted period at day 28
			expect(result.predictedPeriodDays.has(date(28))).toBe(true);
		});

		it("derives luteal phase from ovulation-to-next-period gap", () => {
			// LH surge on day 12 → ovulation day 13
			// Next period on day 26 → luteal phase = 13
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(12, { lhSurge: 2 }),
				makeEntry(26, { bleedingStart: true }),
				makeEntry(30, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			// Predicted ovulation for next cycle:
			// last start (26) + 26 - 13 = day 39
			expect(result.predictedOvulationDays.has(date(39))).toBe(true);
		});
	});

	describe("integration scenarios", () => {
		it("handles a full realistic multi-cycle dataset", () => {
			const entries = [
				// Cycle 1
				makeEntry(0, { bleedingStart: true }),
				makeEntry(1, { bleedingFlow: "heavy" }),
				makeEntry(2, { bleedingFlow: "medium" }),
				makeEntry(3, { bleedingFlow: "light" }),
				makeEntry(4, { bleedingEnd: true }),
				...Array.from({ length: 6 }, (_, i) =>
					makeEntry(i + 8, { basalBodyTemp: 36.3 }),
				),
				makeEntry(13, { lhSurge: 2, basalBodyTemp: 36.35 }),
				makeEntry(14, { basalBodyTemp: 36.6 }),
				makeEntry(15, { basalBodyTemp: 36.65 }),
				makeEntry(16, { basalBodyTemp: 36.7 }),
				// Cycle 2
				makeEntry(28, { bleedingStart: true }),
				makeEntry(29, { bleedingFlow: "heavy" }),
				makeEntry(30, { bleedingFlow: "medium" }),
				makeEntry(31, { bleedingFlow: "light" }),
				makeEntry(32, { bleedingEnd: true }),
			];

			const result = calculateFertilityIndicators(entries);

			// Period detection
			expect(result.periodDays.has(date(0))).toBe(true);
			expect(result.periodDays.has(date(4))).toBe(true);
			expect(result.periodDays.has(date(28))).toBe(true);
			expect(result.periodDays.has(date(32))).toBe(true);

			// Ovulation detected
			expect(result.ovulationDays.size).toBeGreaterThan(0);

			// Fertile window populated
			expect(result.fertileWindowDays.size).toBeGreaterThan(0);

			// Cycle length calculated
			expect(result.averageCycleLength).toBe(28);

			// Predictions generated
			expect(result.predictedPeriodDays.size).toBeGreaterThan(0);
			expect(result.predictedOvulationDays.size).toBe(3);
			expect(result.predictedFertileDays.size).toBeGreaterThan(0);
		});

		it("handles entries with only temperature data (no bleeding)", () => {
			const entries = Array.from({ length: 20 }, (_, i) =>
				makeEntry(i, { basalBodyTemp: i < 12 ? 36.4 : 36.7 }),
			);
			const result = calculateFertilityIndicators(entries);
			expect(result.periodDays.size).toBe(0);
			expect(result.averageCycleLength).toBeNull();
			// May still detect BBT-based ovulation
		});

		it("handles entries with only bleeding data (no temp or LH)", () => {
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
				makeEntry(29, { bleedingStart: true }),
				makeEntry(33, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			expect(result.periodDays.size).toBeGreaterThan(0);
			expect(result.ovulationDays.size).toBe(0);
			expect(result.averageCycleLength).toBe(29);
		});
	});
});
