interface EntryWithTemp {
	date: string;
	basalBodyTemp?: number;
	lhSurge?: boolean;
}

export interface FertilityIndicators {
	ovulationDays: Set<string>;
	fertileWindowDays: Set<string>;
}

const THERMAL_SHIFT_THRESHOLD = 0.2; // °C above baseline
const BASELINE_DAYS = 6;
const SUSTAINED_RISE_DAYS = 3;
const FERTILE_WINDOW_BEFORE_OVULATION = 5;

/**
 * Detects ovulation days and fertile windows from a sorted array of entries.
 *
 * Ovulation is detected by:
 * 1. LH surge — the day with an LH surge is marked as ovulation
 * 2. BBT thermal shift — when temp rises ≥0.2°C above the mean of the
 *    prior 6 low temps and stays elevated for 3+ consecutive days,
 *    ovulation is estimated as the day before the first rise.
 *
 * Fertile window: 5 days before ovulation through 1 day after.
 */
export function calculateFertilityIndicators(
	entries: EntryWithTemp[],
): FertilityIndicators {
	const ovulationDays = new Set<string>();
	const fertileWindowDays = new Set<string>();

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

		// Check if the rise is sustained for enough consecutive days
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

		if (
			sustained &&
			i + SUSTAINED_RISE_DAYS - 1 < withTemp.length
		) {
			// Ovulation is estimated as the day before the shift
			const ovulationDate = withTemp[i - 1].date;
			ovulationDays.add(ovulationDate);
		}
	}

	// Calculate fertile windows around each ovulation day
	for (const ovDate of ovulationDays) {
		const ov = new Date(`${ovDate}T00:00:00`);
		for (
			let d = -FERTILE_WINDOW_BEFORE_OVULATION;
			d <= 1;
			d++
		) {
			const day = new Date(ov);
			day.setDate(day.getDate() + d);
			fertileWindowDays.add(day.toISOString().split("T")[0]);
		}
	}

	return { ovulationDays, fertileWindowDays };
}
