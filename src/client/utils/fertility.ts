interface EntryWithTemp {
	date: string;
	basalBodyTemp?: number;
	lhSurge?: boolean;
	bleedingStart?: boolean;
	bleedingEnd?: boolean;
	bleedingFlow?: "light" | "medium" | "heavy";
}

export interface FertilityIndicators {
	ovulationDays: Set<string>;
	fertileWindowDays: Set<string>;
	periodDays: Set<string>;
	predictedPeriodDays: Set<string>;
	predictedOvulationDays: Set<string>;
	predictedFertileDays: Set<string>;
	averageCycleLength: number | null;
}

const THERMAL_SHIFT_THRESHOLD = 0.2; // °C above baseline
const BASELINE_DAYS = 6;
const SUSTAINED_RISE_DAYS = 3;
const FERTILE_WINDOW_BEFORE_OVULATION = 5;
const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_LUTEAL_PHASE = 14;
const MAX_PERIOD_DAYS = 10; // safety cap for unclosed bleeding ranges
const PREDICTION_CYCLES = 3; // number of future cycles to predict

function toDateStr(d: Date): string {
	return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
	const d = new Date(`${dateStr}T00:00:00`);
	d.setDate(d.getDate() + days);
	return toDateStr(d);
}

function daysBetween(a: string, b: string): number {
	const da = new Date(`${a}T00:00:00`);
	const db = new Date(`${b}T00:00:00`);
	return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Detects ovulation days, fertile windows, period days, and predictions
 * from a sorted array of entries.
 *
 * Period tracking: identifies bleeding ranges from bleedingStart/bleedingEnd markers.
 * Cycle prediction: uses average cycle length from period start dates to predict
 * next period, ovulation (~14 days before next period), and fertile window.
 */
export function calculateFertilityIndicators(
	entries: EntryWithTemp[],
): FertilityIndicators {
	const ovulationDays = new Set<string>();
	const fertileWindowDays = new Set<string>();
	const periodDays = new Set<string>();
	const predictedPeriodDays = new Set<string>();
	const predictedOvulationDays = new Set<string>();
	const predictedFertileDays = new Set<string>();

	// Detect ovulation from LH surge (ovulation typically occurs ~1 day after surge)
	for (const entry of entries) {
		if (entry.lhSurge) {
			ovulationDays.add(addDays(entry.date, 1));
		}
	}

	// Detect ovulation from BBT thermal shift
	const withTemp = entries.filter((e) => e.basalBodyTemp != null);

	for (let i = BASELINE_DAYS; i < withTemp.length; i++) {
		// Need enough days ahead to verify sustained rise
		if (i + SUSTAINED_RISE_DAYS - 1 >= withTemp.length) break;

		const baselineTemps = withTemp
			.slice(i - BASELINE_DAYS, i)
			.map((e) => e.basalBodyTemp as number);
		const baselineMean =
			baselineTemps.reduce((sum, t) => sum + t, 0) / baselineTemps.length;

		const threshold = baselineMean + THERMAL_SHIFT_THRESHOLD;
		const currentTemp = withTemp[i].basalBodyTemp as number;
		if (currentTemp < threshold) continue;

		let sustained = true;
		for (let j = 1; j < SUSTAINED_RISE_DAYS; j++) {
			if ((withTemp[i + j].basalBodyTemp as number) < threshold) {
				sustained = false;
				break;
			}
		}

		if (sustained) {
			const ovulationDate = withTemp[i - 1].date;
			ovulationDays.add(ovulationDate);
		}
	}

	// Reconcile overlapping ovulation detections (LH + BBT within 2 days = same event)
	const ovDates = [...ovulationDays].sort();
	const reconciledOvulation = new Set<string>();
	for (let i = 0; i < ovDates.length; i++) {
		if (
			i > 0 &&
			daysBetween(ovDates[i - 1], ovDates[i]) <= 2
		) {
			// Skip duplicate — keep the earlier detection already added
			continue;
		}
		reconciledOvulation.add(ovDates[i]);
	}
	ovulationDays.clear();
	for (const d of reconciledOvulation) ovulationDays.add(d);

	// Calculate fertile windows around each ovulation day
	for (const ovDate of ovulationDays) {
		for (let d = -FERTILE_WINDOW_BEFORE_OVULATION; d <= 1; d++) {
			fertileWindowDays.add(addDays(ovDate, d));
		}
	}

	// Identify period (bleeding) ranges
	const periodStartDates: string[] = [];
	let currentBleedingStart: string | null = null;

	for (const entry of entries) {
		if (entry.bleedingStart) {
			currentBleedingStart = entry.date;
			periodStartDates.push(entry.date);
			periodDays.add(entry.date);
		} else if (entry.bleedingEnd) {
			// Mark the end day and fill in between
			if (currentBleedingStart) {
				const gap = daysBetween(currentBleedingStart, entry.date);
				for (let d = 0; d <= gap; d++) {
					periodDays.add(addDays(currentBleedingStart, d));
				}
			}
			periodDays.add(entry.date);
			currentBleedingStart = null;
		} else if (currentBleedingStart && entry.bleedingFlow != null) {
			// Cap unclosed bleeding ranges to prevent runaway period marking
			const elapsed = daysBetween(currentBleedingStart, entry.date);
			if (elapsed <= MAX_PERIOD_DAYS) {
				periodDays.add(entry.date);
			} else {
				currentBleedingStart = null;
			}
		}
	}

	// Close any unclosed bleeding range (no bleedingEnd marker logged)
	if (currentBleedingStart) {
		const lastEntry = entries[entries.length - 1];
		const elapsed = daysBetween(currentBleedingStart, lastEntry.date);
		const cap = Math.min(elapsed, MAX_PERIOD_DAYS);
		for (let d = 1; d <= cap; d++) {
			periodDays.add(addDays(currentBleedingStart, d));
		}
		currentBleedingStart = null;
	}

	// Calculate average cycle length from period start dates
	let averageCycleLength: number | null = null;

	if (periodStartDates.length >= 2) {
		const cycleLengths: number[] = [];
		for (let i = 1; i < periodStartDates.length; i++) {
			const len = daysBetween(periodStartDates[i - 1], periodStartDates[i]);
			if (len > 18 && len < 45) {
				cycleLengths.push(len);
			}
		}
		if (cycleLengths.length > 0) {
			averageCycleLength = Math.round(
				cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length,
			);
		}
	}

	// Derive luteal phase from observed ovulation-to-next-period gaps when possible
	let lutealPhase = DEFAULT_LUTEAL_PHASE;
	const sortedOvDates = [...ovulationDays].sort();
	if (sortedOvDates.length > 0 && periodStartDates.length >= 2) {
		const lutealLengths: number[] = [];
		for (const ovDate of sortedOvDates) {
			// Find the next period start after this ovulation
			const nextPeriod = periodStartDates.find(
				(ps) => daysBetween(ovDate, ps) > 0,
			);
			if (nextPeriod) {
				const len = daysBetween(ovDate, nextPeriod);
				if (len >= 8 && len <= 18) {
					lutealLengths.push(len);
				}
			}
		}
		if (lutealLengths.length > 0) {
			lutealPhase = Math.round(
				lutealLengths.reduce((a, b) => a + b, 0) / lutealLengths.length,
			);
		}
	}

	// Predict future cycles based on last period start
	const cycleLen = averageCycleLength ?? DEFAULT_CYCLE_LENGTH;
	if (periodStartDates.length > 0) {
		const lastPeriodStart = periodStartDates[periodStartDates.length - 1];

		for (let cycle = 1; cycle <= PREDICTION_CYCLES; cycle++) {
			const offset = cycleLen * cycle;

			// Predict period start
			const nextPeriodStart = addDays(lastPeriodStart, offset);
			for (let d = 0; d < 5; d++) {
				predictedPeriodDays.add(addDays(nextPeriodStart, d));
			}

			// Predict ovulation (cycle length minus luteal phase before next period)
			const predictedOvDay = addDays(lastPeriodStart, offset - lutealPhase);
			predictedOvulationDays.add(predictedOvDay);

			// Predict fertile window
			for (let d = -FERTILE_WINDOW_BEFORE_OVULATION; d <= 1; d++) {
				predictedFertileDays.add(addDays(predictedOvDay, d));
			}
		}
	}

	return {
		ovulationDays,
		fertileWindowDays,
		periodDays,
		predictedPeriodDays,
		predictedOvulationDays,
		predictedFertileDays,
		averageCycleLength,
	};
}
