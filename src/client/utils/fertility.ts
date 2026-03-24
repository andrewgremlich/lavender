interface EntryWithTemp {
	date: string;
	basalBodyTemp?: number;
	lhSurge?: number;
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
	cycleVariability: number | null;
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

function detectOvulationDays(entries: EntryWithTemp[]): Set<string> {
	const ovulationDays = new Set<string>();

	// Detect from LH surge (ovulation typically occurs ~1 day after peak)
	for (const entry of entries) {
		if (entry.lhSurge === 2) {
			ovulationDays.add(addDays(entry.date, 1));
		}
	}

	// Detect from BBT thermal shift
	const withTemp = entries.filter((e) => e.basalBodyTemp != null);

	for (let i = BASELINE_DAYS; i < withTemp.length; i++) {
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
			ovulationDays.add(withTemp[i - 1].date);
		}
	}

	// Reconcile overlapping detections (LH + BBT within 2 days = same event)
	const ovDates = [...ovulationDays].sort();
	const reconciled = new Set<string>();
	for (let i = 0; i < ovDates.length; i++) {
		if (i > 0 && daysBetween(ovDates[i - 1], ovDates[i]) <= 2) {
			continue;
		}
		reconciled.add(ovDates[i]);
	}

	return reconciled;
}

function calculateFertileWindow(ovulationDays: Set<string>): Set<string> {
	const fertileWindowDays = new Set<string>();
	for (const ovDate of ovulationDays) {
		for (let d = -FERTILE_WINDOW_BEFORE_OVULATION; d <= 1; d++) {
			fertileWindowDays.add(addDays(ovDate, d));
		}
	}
	return fertileWindowDays;
}

interface PeriodResult {
	periodDays: Set<string>;
	periodStartDates: string[];
}

function identifyPeriodDays(entries: EntryWithTemp[]): PeriodResult {
	const periodDays = new Set<string>();
	const periodStartDates: string[] = [];
	let currentBleedingStart: string | null = null;

	for (const entry of entries) {
		if (entry.bleedingStart) {
			currentBleedingStart = entry.date;
			periodStartDates.push(entry.date);
			periodDays.add(entry.date);
		} else if (entry.bleedingEnd) {
			if (currentBleedingStart) {
				const gap = daysBetween(currentBleedingStart, entry.date);
				for (let d = 0; d <= gap; d++) {
					periodDays.add(addDays(currentBleedingStart, d));
				}
			}
			periodDays.add(entry.date);
			currentBleedingStart = null;
		} else if (currentBleedingStart && entry.bleedingFlow != null) {
			const elapsed = daysBetween(currentBleedingStart, entry.date);
			if (elapsed <= MAX_PERIOD_DAYS) {
				periodDays.add(entry.date);
			} else {
				currentBleedingStart = null;
			}
		}
	}

	// Close any unclosed bleeding range
	if (currentBleedingStart && entries.length > 0) {
		const lastEntry = entries[entries.length - 1];
		const elapsed = daysBetween(currentBleedingStart, lastEntry.date);
		const cap = Math.min(elapsed, MAX_PERIOD_DAYS);
		for (let d = 1; d <= cap; d++) {
			periodDays.add(addDays(currentBleedingStart, d));
		}
	}

	return { periodDays, periodStartDates };
}

function getCycleLengths(periodStartDates: string[]): number[] {
	const lengths: number[] = [];
	for (let i = 1; i < periodStartDates.length; i++) {
		const len = daysBetween(periodStartDates[i - 1], periodStartDates[i]);
		if (len > 18 && len < 45) {
			lengths.push(len);
		}
	}
	return lengths;
}

interface CycleStats {
	averageCycleLength: number | null;
	cycleVariability: number | null;
	lutealPhase: number;
}

function analyzeCycleStats(
	periodStartDates: string[],
	ovulationDays: Set<string>,
): CycleStats {
	const cycleLengths = getCycleLengths(periodStartDates);

	const averageCycleLength =
		cycleLengths.length > 0
			? Math.round(
					cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length,
				)
			: null;

	let cycleVariability: number | null = null;
	if (cycleLengths.length >= 2) {
		const mean =
			cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length;
		const variance =
			cycleLengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) /
			cycleLengths.length;
		cycleVariability = Math.round(Math.sqrt(variance) * 10) / 10;
	}

	// Derive luteal phase from observed ovulation-to-next-period gaps
	let lutealPhase = DEFAULT_LUTEAL_PHASE;
	const sortedOvDates = [...ovulationDays].sort();
	if (sortedOvDates.length > 0 && periodStartDates.length >= 2) {
		const lutealLengths: number[] = [];
		for (const ovDate of sortedOvDates) {
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

	return { averageCycleLength, cycleVariability, lutealPhase };
}

interface PredictionResult {
	predictedPeriodDays: Set<string>;
	predictedOvulationDays: Set<string>;
	predictedFertileDays: Set<string>;
}

function predictFutureCycles(
	periodStartDates: string[],
	cycleLength: number,
	lutealPhase: number,
	cycleVariability: number | null,
): PredictionResult {
	const predictedPeriodDays = new Set<string>();
	const predictedOvulationDays = new Set<string>();
	const predictedFertileDays = new Set<string>();

	if (periodStartDates.length === 0) {
		return { predictedPeriodDays, predictedOvulationDays, predictedFertileDays };
	}

	const lastPeriodStart = periodStartDates[periodStartDates.length - 1];
	const extraDays =
		cycleVariability != null && cycleVariability > 2
			? Math.ceil(cycleVariability)
			: 0;

	for (let cycle = 1; cycle <= PREDICTION_CYCLES; cycle++) {
		const offset = cycleLength * cycle;

		const nextPeriodStart = addDays(lastPeriodStart, offset);
		for (let d = 0; d < 5; d++) {
			predictedPeriodDays.add(addDays(nextPeriodStart, d));
		}

		const predictedOvDay = addDays(lastPeriodStart, offset - lutealPhase);
		predictedOvulationDays.add(predictedOvDay);

		for (
			let d = -(FERTILE_WINDOW_BEFORE_OVULATION + extraDays);
			d <= 1 + extraDays;
			d++
		) {
			predictedFertileDays.add(addDays(predictedOvDay, d));
		}
	}

	return { predictedPeriodDays, predictedOvulationDays, predictedFertileDays };
}

export function calculateFertilityIndicators(
	entries: EntryWithTemp[],
): FertilityIndicators {
	const ovulationDays = detectOvulationDays(entries);
	const fertileWindowDays = calculateFertileWindow(ovulationDays);
	const { periodDays, periodStartDates } = identifyPeriodDays(entries);
	const { averageCycleLength, cycleVariability, lutealPhase } =
		analyzeCycleStats(periodStartDates, ovulationDays);
	const { predictedPeriodDays, predictedOvulationDays, predictedFertileDays } =
		predictFutureCycles(
			periodStartDates,
			averageCycleLength ?? DEFAULT_CYCLE_LENGTH,
			lutealPhase,
			cycleVariability,
		);

	return {
		ovulationDays,
		fertileWindowDays,
		periodDays,
		predictedPeriodDays,
		predictedOvulationDays,
		predictedFertileDays,
		averageCycleLength,
		cycleVariability,
	};
}
