export type UnitSystem = "metric" | "us";

const KEY = "lavendar_units";

export function getUnitSystem(): UnitSystem {
	return (localStorage.getItem(KEY) as UnitSystem) ?? "metric";
}

export function setUnitSystem(system: UnitSystem): void {
	localStorage.setItem(KEY, system);
}
