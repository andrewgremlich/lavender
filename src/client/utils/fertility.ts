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

	// Detect ovulation from LH surge
	for (const entry of entries) {
		if (entry.lhSurge) {
			ovulationDays.add(entry.date);
		}
	}

	// Detect ovulation from BBT thermal shift
	const withTemp = entries.filter((e) => e.basalBodyTemp != null);

	for (let i = BASELINE_DAYS; i < withTemp.length; i++) {
		const baselineTemps = withTemp
			.slice(i - BASELINE_DAYS, i)
			.map((e) => e.basalBodyTemp as number);
		const baselineMean =
			baselineTemps.reduce((sum, t) => sum + t, 0) / baselineTemps.length;

		const currentTemp = withTemp[i].basalBodyTemp as number;
		if (currentTemp < baselineMean + THERMAL_SHIFT_THRESHOLD) continue;

		let sustained = true;
		for (let j = 1; j < SUSTAINED_RISE_DAYS && i + j < withTemp.length; j++) {
			if (
				(withTemp[i + j].basalBodyTemp as number) <
				baselineMean + THERMAL_SHIFT_THRESHOLD
			) {
				sustained = false;
				break;
			}
		}

		if (sustained && i + SUSTAINED_RISE_DAYS - 1 < withTemp.length) {
			const ovulationDate = withTemp[i - 1].date;
			ovulationDays.add(ovulationDate);
		}
	}

	// Calculate fertile windows around each ovulation day
	for (const ovDate of ovulationDays) {
		const ov = new Date(`${ovDate}T00:00:00`);
		for (let d = -FERTILE_WINDOW_BEFORE_OVULATION; d <= 1; d++) {
			const day = new Date(ov);
			day.setDate(day.getDate() + d);
			fertileWindowDays.add(toDateStr(day));
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
		} else if (
			currentBleedingStart &&
			(entry.bleedingFlow != null)
		) {
			// If there's a flow recorded while bleeding is ongoing, mark it
			periodDays.add(entry.date);
		}
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

	// Predict next cycle based on last period start
	const cycleLen = averageCycleLength ?? DEFAULT_CYCLE_LENGTH;
	if (periodStartDates.length > 0) {
		const lastPeriodStart = periodStartDates[periodStartDates.length - 1];

		// Predict next period start
		const nextPeriodStart = addDays(lastPeriodStart, cycleLen);
		// Predict ~5 days of period
		for (let d = 0; d < 5; d++) {
			predictedPeriodDays.add(addDays(nextPeriodStart, d));
		}

		// Predict ovulation (~luteal phase days before next period)
		const predictedOvDay = addDays(
			lastPeriodStart,
			cycleLen - DEFAULT_LUTEAL_PHASE,
		);
		predictedOvulationDays.add(predictedOvDay);

		// Predict fertile window (5 days before ovulation + 1 day after)
		for (let d = -FERTILE_WINDOW_BEFORE_OVULATION; d <= 1; d++) {
			predictedFertileDays.add(addDays(predictedOvDay, d));
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
