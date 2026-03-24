export function getLhSurgeLabel(value: number): string {
	if (value <= 0) return "Low";
	if (value < 1) return "Rising";
	if (value < 2) return "High";
	return "Peak";
}

export const INDICATORS = [
	{ key: "appetiteChange", label: "Appetite Change" },
	{ key: "moodChange", label: "Mood Change" },
	{ key: "increasedSexDrive", label: "Increased Sex Drive" },
	{ key: "breastTenderness", label: "Breast Tenderness" },
	{ key: "mildSpotting", label: "Mild Spotting" },
	{ key: "heightenedSmell", label: "Heightened Smell" },
	{ key: "cervixChanges", label: "Cervix Changes" },
	{ key: "fluidRetention", label: "Fluid Retention" },
	{ key: "cramping", label: "Cramping" },
] as const;

export type IndicatorKey = (typeof INDICATORS)[number]["key"];

export function countIndicators(data: Record<string, unknown>): number {
	return INDICATORS.filter((i) => data[i.key] === true).length;
}

export function getActiveIndicatorLabels(
	data: Record<string, unknown>,
): string[] {
	return INDICATORS.filter((i) => data[i.key] === true).map((i) => i.label);
}
