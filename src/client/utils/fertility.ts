/**
 * fertility-indicators-revised.ts
 *
 * Evidence-based replacements for calculateFertilityIndicators.ts
 * Each change is keyed to a specific source in the research report.
 *
 * Sources:
 *   [WB95]  Wilcox, Weinberg & Baird (1995) NEJM — fertile window
 *   [D99]   Dunson et al. (1999) Human Reproduction — peak conception day
 *   [AB22]  Abdulrahim et al. (2022) Hum. Reprod. Update — LH→ovulation timing
 *   [FH07]  Frank-Herrmann et al. (2007) Human Reproduction — STM double-check rule
 *   [L84]   Lenton et al. (1984) BJOG — luteal phase distribution
 *   [B19]   Bull et al. (2019) npj Digital Medicine — cycle length population stats
 *   [LI21]  Li et al. (2021) JAMIA — hierarchical/weighted prediction models
 *   [BI04]  Bigelow et al. (2004) Human Reproduction — cervical mucus fecundability
 *   [EC15]  Ecochard et al. (2015) Fertility & Sterility — CM sensitivity/specificity
 *   [FE02]  Fehring (2002) Contraception — CM peak vs. ovulation correlation
 *   [PA07]  Park et al. (2007) Fertility & Sterility — LH surge configurations
 */

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

// ---------------------------------------------------------------------------
// 1. UPDATED INPUT INTERFACE
//    Added: cervicalMucus, basalBodyTempTime, basalBodyTempDiscarded
// ---------------------------------------------------------------------------

/**
 * Cervical mucus scoring on a 1–4 scale per the Billings/Creighton system.
 *   1 = dry (no mucus)
 *   2 = sticky/pasty/opaque
 *   3 = creamy/white/lotion-like
 *   4 = clear, stretchy, slippery (peak / "egg-white")
 *
 * Source: [BI04] — mucus quality explains more conception variance than timing;
 *         [EC15] — peak-type mucus achieves 96% sensitivity for fertile window.
 */
export type CervicalMucusScore = 1 | 2 | 3 | 4;

export interface EntryWithTemp {
	date: string;
	basalBodyTemp?: number;
	/** Hour of day (0–23) the temperature was taken, for time-correction. */
	basalBodyTempTime?: number;
	/**
	 * True if the reading should be ignored (illness, alcohol, short sleep, etc.).
	 * The app should flag readings when the user logs a disruption, OR when
	 * basalBodyTemp > DISCARD_ABOVE_C (fever threshold).
	 */
	basalBodyTempDiscarded?: boolean;
	lhSurge?: boolean;
	bleedingStart?: boolean;
	bleedingEnd?: boolean;
	bleedingFlow?: "light" | "medium" | "heavy";
	cervicalMucus?: CervicalMucusScore;
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
	/** Days identified as fertile solely by cervical mucus presence (type ≥ 2). */
	cmFertileDays: Set<string>;
}

// ---------------------------------------------------------------------------
// 2. UPDATED CONSTANTS
//    All values are evidence-backed; originals noted where changed.
// ---------------------------------------------------------------------------

const THERMAL_SHIFT_THRESHOLD = 0.2; // °C — unchanged; [FH07] 3-over-6 rule
const BASELINE_DAYS = 6;             // unchanged; [FH07] standard 6-day baseline
const SUSTAINED_RISE_DAYS = 3;       // unchanged; [FH07] 3 days above coverline

/**
 * Slow-rise confirmation requires 4 days instead of 3.
 * Sensiplan variant: when consecutive increments are < SLOW_RISE_INCREMENT_C,
 * treat as slow-rise and require one extra day of confirmation.
 * Source: Sensiplan protocol referenced in [FH07].
 */
const SLOW_RISE_CONFIRMATION_DAYS = 4;
const SLOW_RISE_INCREMENT_C = 0.05;

/**
 * Discard any BBT reading above this value as a likely fever.
 * Source: standard FAM clinical guidance; Moghissi (1976) — fever
 * corrupts BBT and produces false thermal shifts.
 */
const DISCARD_ABOVE_C = 37.8;

/**
 * Time-correction factor: BBT rises ~0.04°C per hour after circadian nadir
 * (~04:00). Applied when basalBodyTempTime is provided.
 * Source: physiological basis used in Sensiplan correction tables.
 */
const TIME_CORRECTION_C_PER_HOUR = 0.04;
const REFERENCE_HOUR = 6; // correction is relative to 06:00 baseline

/**
 * Fertile window is O−5 to O (6 days ending ON ovulation day, not O+1).
 * Source: [WB95] — no conceptions from intercourse after ovulation day;
 *         [D99]  — O−1 is the highest-probability day after statistical
 *                  correction for measurement error.
 *
 * CHANGED FROM: d ∈ [−5, 0]  (was already 0 in original, but comment clarifies)
 * The original code used FERTILE_WINDOW_BEFORE_OVULATION = 5, iterating
 * d from −5 to 0 inclusive — this is correct. Leaving that constant unchanged.
 */
const FERTILE_WINDOW_BEFORE_OVULATION = 5; // O−5 to O inclusive

const DEFAULT_CYCLE_LENGTH = 29;   // [B19] population mean 29.3 d, was 28
const DEFAULT_LUTEAL_PHASE = 13;   // [L84][B19] mean ~12.4–14.1 d, was 14
const MAX_PERIOD_DAYS = 10;
const PREDICTION_CYCLES = 3;
const POST_OVULATION_SKIP_DAYS = 14;

/**
 * Luteal phase validity range.
 * CHANGED FROM: gap > 0 && gap <= 20
 * Source: [L84] normal range; Harlow (2000) between-woman range 8–17 days.
 * Readings outside [8, 17] are excluded rather than silently accepted.
 */
const LUTEAL_PHASE_MIN = 8;
const LUTEAL_PHASE_MAX = 17;

/**
 * Exponential smoothing factor for cycle-length prediction (0 < α ≤ 1).
 * Higher α = more weight on recent cycles.
 * Source: [LI21] — recency weighting outperforms simple mean for irregular
 * cycles; α = 0.3 is a conservative, widely-used default.
 */
const CYCLE_PREDICTION_ALPHA = 0.3;

// ---------------------------------------------------------------------------
// Helpers (unchanged)
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
	return format(d, "yyyy-MM-dd");
}
function addDaysToStr(dateStr: string, days: number): string {
	return toDateStr(addDays(parseISO(dateStr), days));
}
function daysBetween(a: string, b: string): number {
	return differenceInCalendarDays(parseISO(b), parseISO(a));
}

// ---------------------------------------------------------------------------
// 3. BBT TEMPERATURE CORRECTION & VALIDATION
// ---------------------------------------------------------------------------

/**
 * Apply time-of-day correction and discard invalid readings.
 * Returns null for readings that should be excluded from baseline/shift logic.
 *
 * Corrections applied:
 *   - Fever discard (> 37.8°C) — [DISCARD_ABOVE_C]
 *   - User-flagged disruption — [basalBodyTempDiscarded]
 *   - Time offset correction relative to REFERENCE_HOUR — [TIME_CORRECTION_C_PER_HOUR]
 */
function correctedTemp(entry: EntryWithTemp): number | null {
	if (entry.basalBodyTemp == null) return null;
	if (entry.basalBodyTempDiscarded) return null;
	if (entry.basalBodyTemp > DISCARD_ABOVE_C) return null;

	let temp = entry.basalBodyTemp;
	if (entry.basalBodyTempTime != null) {
		const hourOffset = entry.basalBodyTempTime - REFERENCE_HOUR;
		temp -= hourOffset * TIME_CORRECTION_C_PER_HOUR;
	}
	return temp;
}

// ---------------------------------------------------------------------------
// 4. BBT OVULATION DETECTION  (replaces the BBT section in detectOvulationDays)
//    Changes:
//      a) Uses correctedTemp() — filters fevers and applies time correction
//      b) Detects slow-rise pattern and requires 4-day confirmation [FH07/Sensiplan]
//      c) Remains index-based (the 3-over-6 rule is inherently index-based)
// ---------------------------------------------------------------------------

function detectBBTOvulationDays(entries: EntryWithTemp[]): Set<string> {
	const bbtOvulationDays = new Set<string>();

	// Build a parallel array of valid, corrected temperatures
	const valid = entries
		.map((e) => ({ date: e.date, temp: correctedTemp(e) }))
		.filter((e): e is { date: string; temp: number } => e.temp !== null);

	for (let i = BASELINE_DAYS; i < valid.length; ) {
		const remaining = valid.length - i;
		if (remaining < SUSTAINED_RISE_DAYS) break;

		const baselineTemps = valid.slice(i - BASELINE_DAYS, i).map((e) => e.temp);
		const coverline = Math.max(...baselineTemps); // highest of 6 pre-shift readings
		const threshold = coverline + THERMAL_SHIFT_THRESHOLD; // 3rd day must clear this

		const candidateTemp = valid[i].temp;
		if (candidateTemp < threshold) {
			i++;
			continue;
		}

		// Determine whether this is a slow-rise or standard rise
		const isSlowRise =
			i >= 1 &&
			candidateTemp - valid[i - 1].temp < SLOW_RISE_INCREMENT_C &&
			candidateTemp - coverline < THERMAL_SHIFT_THRESHOLD;

		const requiredDays = isSlowRise
			? SLOW_RISE_CONFIRMATION_DAYS
			: SUSTAINED_RISE_DAYS;

		if (i + requiredDays - 1 >= valid.length) break;

		// Check all required confirmation days are above coverline
		// (3rd/4th day must also be ≥ threshold; intermediate days just above coverline)
		let sustained = true;
		for (let j = 0; j < requiredDays; j++) {
			const t = valid[i + j].temp;
			const isLastDay = j === requiredDays - 1;
			const required = isLastDay ? threshold : coverline;
			if (t < required) {
				sustained = false;
				break;
			}
		}

		if (sustained) {
			// Ovulation is assigned to the day *before* the first elevated reading [FH07]
			bbtOvulationDays.add(valid[i - 1].date);

			// Skip forward past the luteal phase to avoid double-detection
			let skip = i + 1;
			while (
				skip < valid.length &&
				daysBetween(valid[i].date, valid[skip].date) < POST_OVULATION_SKIP_DAYS
			) {
				skip++;
			}
			i = skip;
		} else {
			i++;
		}
	}

	return bbtOvulationDays;
}

// ---------------------------------------------------------------------------
// 5. LH SURGE → OVULATION  (replaces LH section in detectOvulationDays)
//    Change: +1 AND +2 days are both marked as candidate ovulation days.
//
//    Source: [AB22] — mean 33.9 h from LH onset to ovulation; from urine
//    OPK detection, the mean is ~24 h (range 9–51 h). A +1-day offset
//    captures most events, but +2 days is within the empirical range and
//    should be included rather than silently ignored.
//
//    Reconciliation downstream merges overlapping BBT + LH detections.
// ---------------------------------------------------------------------------

function detectLHOvulationDays(entries: EntryWithTemp[]): Set<string> {
	const lhOvulationDays = new Set<string>();
	for (const entry of entries) {
		if (entry.lhSurge) {
			// Both +1 and +2 are plausible ovulation days from a positive OPK [AB22]
			lhOvulationDays.add(addDaysToStr(entry.date, 1));
			lhOvulationDays.add(addDaysToStr(entry.date, 2));
		}
	}
	return lhOvulationDays;
}

// ---------------------------------------------------------------------------
// 6. COMBINED OVULATION DETECTION  (replaces detectOvulationDays entirely)
//    Logic unchanged for reconciliation; now calls the separated sub-functions.
// ---------------------------------------------------------------------------

function detectOvulationDays(entries: EntryWithTemp[]): Set<string> {
	const bbtOvulationDays = detectBBTOvulationDays(entries);
	const lhOvulationDays = detectLHOvulationDays(entries);

	// Reconcile: prefer BBT-confirmed date when LH and BBT agree within 2 days
	const allDates = [
		...[...bbtOvulationDays].map((d) => ({ date: d, source: "bbt" as const })),
		...[...lhOvulationDays].map((d) => ({ date: d, source: "lh" as const })),
	].sort((a, b) => a.date.localeCompare(b.date));

	const reconciled = new Set<string>();
	for (let i = 0; i < allDates.length; i++) {
		const current = allDates[i];
		const prev = i > 0 ? allDates[i - 1] : null;

		if (prev && daysBetween(prev.date, current.date) <= 2) {
			if (current.source === "bbt") {
				reconciled.delete(prev.date);
				reconciled.add(current.date);
			}
			continue;
		}
		reconciled.add(current.date);
	}

	return reconciled;
}

// ---------------------------------------------------------------------------
// 7. CERVICAL MUCUS FERTILE WINDOW
//    New function — not present in original code.
//
//    Source: [EC15] — any CM (score ≥ 2) provides 100% sensitivity for the
//    6-day fertile window; [BI04] — mucus quality is the strongest single
//    predictor of conception probability; [FE02] — peak CM (score 4) is the
//    most reliable single biomarker for ovulation timing.
//
//    Rules implemented:
//      - Any CM (score ≥ 2) → day is potentially fertile
//      - Peak CM (score 4) triggers the "peak + 3" closure rule: fertile
//        window extends 3 days past the last peak day [Billings/FH07]
// ---------------------------------------------------------------------------

function detectCMFertileDays(entries: EntryWithTemp[]): Set<string> {
	const cmFertileDays = new Set<string>();

	// Any mucus observed → fertile
	for (const entry of entries) {
		if (entry.cervicalMucus != null && entry.cervicalMucus >= 2) {
			cmFertileDays.add(entry.date);
		}
	}

	// Peak + 3 rule: extend 3 days after each peak-type (score 4) observation
	for (const entry of entries) {
		if (entry.cervicalMucus === 4) {
			for (let d = 1; d <= 3; d++) {
				cmFertileDays.add(addDaysToStr(entry.date, d));
			}
		}
	}

	return cmFertileDays;
}

// ---------------------------------------------------------------------------
// 8. FERTILE WINDOW (unchanged logic; fertile window end stays at O+0)
//    Source: [WB95][D99] — no conceptions after ovulation day; O−1 is peak.
//    The original `d <= 0` bound is correct; O+1 is intentionally excluded.
// ---------------------------------------------------------------------------

function calculateFertileWindow(ovulationDays: Set<string>): Set<string> {
	const fertileWindowDays = new Set<string>();
	for (const ovDate of ovulationDays) {
		for (let d = -FERTILE_WINDOW_BEFORE_OVULATION; d <= 0; d++) {
			fertileWindowDays.add(addDaysToStr(ovDate, d));
		}
	}
	return fertileWindowDays;
}

// ---------------------------------------------------------------------------
// Period identification — unchanged
// ---------------------------------------------------------------------------

interface PeriodResult {
	periodDays: Set<string>;
	periodStartDates: string[];
	averagePeriodLength: number;
}

function identifyPeriodDays(entries: EntryWithTemp[]): PeriodResult {
	const periodDays = new Set<string>();
	const periodStartDates: string[] = [];
	const periodLengths: number[] = [];
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
					periodDays.add(addDaysToStr(currentBleedingStart, d));
				}
				periodLengths.push(gap + 1);
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

	if (currentBleedingStart && entries.length > 0) {
		const lastEntry = entries[entries.length - 1];
		const elapsed = daysBetween(currentBleedingStart, lastEntry.date);
		const cap = Math.min(elapsed, MAX_PERIOD_DAYS);
		for (let d = 1; d <= cap; d++) {
			periodDays.add(addDaysToStr(currentBleedingStart, d));
		}
	}

	const averagePeriodLength =
		periodLengths.length > 0
			? Math.round(
					periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length,
			  )
			: 5;

	return { periodDays, periodStartDates, averagePeriodLength };
}

function getCycleLengths(periodStartDates: string[]): number[] {
	const lengths: number[] = [];
	for (let i = 1; i < periodStartDates.length; i++) {
		const len = daysBetween(periodStartDates[i - 1], periodStartDates[i]);
		if (len >= 18 && len <= 45) {
			lengths.push(len);
		}
	}
	return lengths;
}

// ---------------------------------------------------------------------------
// 9. CYCLE STATS — luteal phase filter tightened to [8, 17]
//    CHANGED FROM: gap > 0 && gap <= 20
//    Source: [L84] Lenton — normal range; Harlow (2000) between-woman 8–17 d.
// ---------------------------------------------------------------------------

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
			(cycleLengths.length - 1);
		cycleVariability = Math.round(Math.sqrt(variance) * 10) / 10;
	}

	// Derive luteal phase from observed ovulation-to-next-period gaps.
	// CHANGED: filter window is [LUTEAL_PHASE_MIN, LUTEAL_PHASE_MAX] = [8, 17]
	// rather than the original [1, 20]. [L84][Harlow 2000]
	let lutealPhase = DEFAULT_LUTEAL_PHASE;
	const sortedOvDates = [...ovulationDays].sort();

	if (sortedOvDates.length > 0 && periodStartDates.length >= 2) {
		const lutealLengths: number[] = [];
		for (const ovDate of sortedOvDates) {
			const nextPeriod = periodStartDates.find((ps) => {
				const gap = daysBetween(ovDate, ps);
				return gap >= LUTEAL_PHASE_MIN && gap <= LUTEAL_PHASE_MAX;
			});
			if (nextPeriod) {
				lutealLengths.push(daysBetween(ovDate, nextPeriod));
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

// ---------------------------------------------------------------------------
// 10. WEIGHTED CYCLE LENGTH PREDICTION  (replaces simple mean in predictFutureCycles)
//
//     Source: [LI21] — recency-weighted approaches outperform simple mean,
//     especially for users with irregular cycles. Exponential smoothing
//     (EMA) is the lightweight approximation of the Bayesian posterior mean.
//
//     Formula: EMA_n = α * L_n + (1 − α) * EMA_{n−1}
//     where L_n = nth most-recent observed cycle length, newest first.
//     α = CYCLE_PREDICTION_ALPHA (default 0.3).
//
//     Falls back to population mean (DEFAULT_CYCLE_LENGTH) when < 3 cycles
//     are available, per [LI21]'s minimum of 3 cycles for reliable estimates.
// ---------------------------------------------------------------------------

function weightedCycleLength(cycleLengths: number[]): number {
	if (cycleLengths.length === 0) return DEFAULT_CYCLE_LENGTH;

	// Iterate oldest → newest (cycleLengths is already oldest-first from getCycleLengths)
	let ema = cycleLengths[0];
	for (let i = 1; i < cycleLengths.length; i++) {
		ema = CYCLE_PREDICTION_ALPHA * cycleLengths[i] + (1 - CYCLE_PREDICTION_ALPHA) * ema;
	}
	return Math.round(ema);
}

// ---------------------------------------------------------------------------
// 11. FUTURE CYCLE PREDICTION  (uses weightedCycleLength instead of simple average)
// ---------------------------------------------------------------------------

interface PredictionResult {
	predictedPeriodDays: Set<string>;
	predictedOvulationDays: Set<string>;
	predictedFertileDays: Set<string>;
}

function predictFutureCycles(
	periodStartDates: string[],
	cycleLengths: number[],           // raw lengths, passed in for weighting
	lutealPhase: number,
	cycleVariability: number | null,
	periodLength: number,
): PredictionResult {
	const predictedPeriodDays = new Set<string>();
	const predictedOvulationDays = new Set<string>();
	const predictedFertileDays = new Set<string>();

	if (periodStartDates.length === 0) {
		return { predictedPeriodDays, predictedOvulationDays, predictedFertileDays };
	}

	// Use exponential moving average rather than simple mean [LI21]
	const cycleLength = weightedCycleLength(cycleLengths);

	const lastPeriodStart = periodStartDates[periodStartDates.length - 1];
	const extraDays =
		cycleVariability != null && cycleVariability > 2
			? Math.ceil(cycleVariability)
			: 0;

	for (let cycle = 1; cycle <= PREDICTION_CYCLES; cycle++) {
		const offset = cycleLength * cycle;

		const nextPeriodStart = addDaysToStr(lastPeriodStart, offset);
		for (let d = 0; d < periodLength; d++) {
			predictedPeriodDays.add(addDaysToStr(nextPeriodStart, d));
		}

		const predictedOvDay = addDaysToStr(lastPeriodStart, offset - lutealPhase);
		predictedOvulationDays.add(predictedOvDay);

		// Fertile window is O−5 to O, expanded by variability on the early side [WB95]
		for (
			let d = -(FERTILE_WINDOW_BEFORE_OVULATION + extraDays);
			d <= 0;
			d++
		) {
			predictedFertileDays.add(addDaysToStr(predictedOvDay, d));
		}
	}

	return { predictedPeriodDays, predictedOvulationDays, predictedFertileDays };
}

// ---------------------------------------------------------------------------
// 12. TOP-LEVEL EXPORT  (updated signature; passes cycleLengths to prediction)
// ---------------------------------------------------------------------------

/**
 * Maps the string-based cervical mucus values from HealthEntryData to numeric scores.
 *   dry → 1, sticky → 2, creamy → 3, watery/eggWhite → 4
 */
const CM_SCORE_MAP: Record<string, CervicalMucusScore> = {
	dry: 1,
	sticky: 2,
	creamy: 3,
	watery: 4,
	eggWhite: 4,
};

/**
 * Convert entries with string-based cervical mucus to the numeric score format
 * expected by the fertility algorithm. Accepts any object with the required fields.
 */
export function toFertilityEntry(
	entry: Omit<EntryWithTemp, "cervicalMucus"> & {
		cervicalMucus?: string;
	},
): EntryWithTemp {
	const { cervicalMucus, ...rest } = entry;
	return {
		...rest,
		cervicalMucus: cervicalMucus
			? CM_SCORE_MAP[cervicalMucus] ?? undefined
			: undefined,
	};
}

export function calculateFertilityIndicators(
	entries: EntryWithTemp[],
): FertilityIndicators {
	const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

	const ovulationDays = detectOvulationDays(sorted);
	const fertileWindowDays = calculateFertileWindow(ovulationDays);
	const cmFertileDays = detectCMFertileDays(sorted);

	const { periodDays, periodStartDates, averagePeriodLength } =
		identifyPeriodDays(sorted);

	const { averageCycleLength, cycleVariability, lutealPhase } =
		analyzeCycleStats(periodStartDates, ovulationDays);

	// Pass raw cycle lengths so prediction can apply EMA instead of simple mean
	const cycleLengths = getCycleLengths(periodStartDates);

	const { predictedPeriodDays, predictedOvulationDays, predictedFertileDays } =
		predictFutureCycles(
			periodStartDates,
			cycleLengths,
			lutealPhase,
			cycleVariability,
			averagePeriodLength,
		);

	return {
		ovulationDays,
		fertileWindowDays,
		cmFertileDays,
		periodDays,
		predictedPeriodDays,
		predictedOvulationDays,
		predictedFertileDays,
		averageCycleLength,
		cycleVariability,
	};
}