import { describe, expect, it } from "vitest";
import {
	type CervicalMucusScore,
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
		basalBodyTempTime?: number;
		basalBodyTempDiscarded?: boolean;
		lhSurge?: 0 | 1 | 2 | boolean;
		bleedingStart?: boolean;
		bleedingEnd?: boolean;
		bleedingFlow?: "light" | "medium" | "heavy";
		cervicalMucus?: CervicalMucusScore;
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

		it("detects ovulation from light LH surge value", () => {
			const entries = [makeEntry(0, { lhSurge: 1 })];
			const result = calculateFertilityIndicators(entries);
			expect(result.ovulationDays.has(date(1))).toBe(true);
		});

		it("backward compat: boolean true treated as positive (2)", () => {
			const entries = [makeEntry(0, { lhSurge: true })];
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
		it("marks 5 days before through ovulation day (6-day window)", () => {
			const entries = [makeEntry(14, { lhSurge: 2 })];
			const result = calculateFertilityIndicators(entries);
			// LH surge day 14 → ovulation candidates day 15 and 16
			// Reconciliation collapses to day 15 (first in cluster)
			// Fertile window: O-5 to O = days 10-15
			for (let d = 10; d <= 15; d++) {
				expect(result.fertileWindowDays.has(date(d))).toBe(true);
			}
			expect(result.fertileWindowDays.has(date(9))).toBe(false);
			expect(result.fertileWindowDays.has(date(16))).toBe(false);
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
			// Cycles: 26 and 30 days → mean 28, sample variance 8, stddev √8 ≈ 2.8
			expect(result.cycleVariability).toBe(2.8);
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
			// Default luteal phase = 13, cycle = 28 (single cycle via EMA)
			// First predicted cycle: last start (28) + 28 = 56
			// Predicted ovulation: 56 - 13 = day 43
			expect(result.predictedOvulationDays.has(date(43))).toBe(true);
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
			// Cycles: 25 and 31 → stddev ~4.2
			// extraDays = ceil(~4.2) = 5
			// Predicted fertile window: -(5+extra) to 0 = -(10) to 0 = 11 days per cycle
			expect(result.cycleVariability).not.toBeNull();
			if (result.cycleVariability !== null && result.cycleVariability > 2) {
				const extraDays = Math.ceil(result.cycleVariability);
				const widenedWindow = 5 + extraDays + 1; // -(5+extra) to 0 inclusive
				expect(result.predictedFertileDays.size).toBe(widenedWindow * 3); // 3 cycles
			}
		});

		it("uses default 29-day cycle when no cycle data", () => {
			// Single period, no average available → uses DEFAULT_CYCLE_LENGTH (29)
			const entries = [
				makeEntry(0, { bleedingStart: true }),
				makeEntry(4, { bleedingEnd: true }),
			];
			const result = calculateFertilityIndicators(entries);
			// Predicted period at day 29
			expect(result.predictedPeriodDays.has(date(29))).toBe(true);
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
