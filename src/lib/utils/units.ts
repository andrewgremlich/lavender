export type UnitSystem = 'metric' | 'us';

const KEY = 'lavender_units';

export function getUnitSystem(): UnitSystem {
	return (localStorage.getItem(KEY) as UnitSystem) ?? 'us';
}

export function setUnitSystem(system: UnitSystem): void {
	localStorage.setItem(KEY, system);
}

export function celsiusToFahrenheit(c: number): number {
	return (c * 9) / 5 + 32;
}

export function fahrenheitToCelsius(f: number): number {
	return ((f - 32) * 5) / 9;
}
