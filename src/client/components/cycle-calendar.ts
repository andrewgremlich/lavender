import type { FertilityIndicators } from "../utils/fertility";

interface CycleCalendarData {
	fertility: FertilityIndicators;
	currentMonth: Date;
}

export class CycleCalendar extends HTMLElement {
	private shadow: ShadowRoot;
	private currentMonth: Date = new Date();
	private fertility: FertilityIndicators = {
		ovulationDays: new Set(),
		fertileWindowDays: new Set(),
		periodDays: new Set(),
		predictedPeriodDays: new Set(),
		predictedOvulationDays: new Set(),
		predictedFertileDays: new Set(),
		averageCycleLength: null,
		cycleVariability: null,
	};

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.render();
	}

	public setData(data: CycleCalendarData) {
		this.fertility = data.fertility;
		this.currentMonth = data.currentMonth;
		this.render();
	}

	private render() {
		const year = this.currentMonth.getFullYear();
		const month = this.currentMonth.getMonth();

		const monthName = this.currentMonth.toLocaleString("default", {
			month: "long",
			year: "numeric",
		});

		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();

		const todayStr = new Date().toISOString().split("T")[0];

		const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

		let calendarCells = dayNames
			.map((d) => `<div class="day-header">${d}</div>`)
			.join("");

		// Empty cells before first day
		for (let i = 0; i < firstDay; i++) {
			calendarCells += '<div class="day-cell empty"></div>';
		}

		for (let day = 1; day <= daysInMonth; day++) {
			const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
			const classes = this.getDayClasses(dateStr, todayStr);
			const dots = this.getDayDots(dateStr);

			const tooltip = this.getDayTooltip(dateStr);
			calendarCells += `<div class="day-cell ${classes.join(" ")}"${tooltip ? ` data-tooltip="${tooltip}"` : ""}>
				<span class="day-number">${day}</span>
				${dots ? `<div class="day-dots">${dots}</div>` : ""}
			</div>`;
		}

		const variabilityNote =
			this.fertility.cycleVariability != null && this.fertility.cycleVariability > 2
				? ` (±${this.fertility.cycleVariability} days)`
				: "";
		const cycleInfo = this.fertility.averageCycleLength
			? `<div class="cycle-info">Average cycle: ${this.fertility.averageCycleLength} days${variabilityNote}</div>`
			: "";

		this.shadow.innerHTML = `
			<link rel="stylesheet" href="/styles/main.css">
			<link rel="stylesheet" href="/styles/cycle-calendar.css">
			<div class="calendar-card">
				<div class="calendar-header">
					<button class="nav-btn" id="prev-month">&larr;</button>
					<h3>${monthName}</h3>
					<button class="nav-btn" id="next-month">&rarr;</button>
				</div>
				<div class="calendar-grid">
					${calendarCells}
				</div>
				<div class="calendar-legend">
					<div class="legend-item">
						<span class="legend-swatch" style="background:#fee2e2"></span> Period
					</div>
					<div class="legend-item">
						<span class="legend-swatch" style="background:#ecfdf5"></span> Fertile
					</div>
					<div class="legend-item">
						<span class="legend-swatch" style="background:#ede9fe"></span> Ovulation
					</div>
					<div class="legend-item">
						<span class="legend-swatch striped" style="background:repeating-linear-gradient(45deg,#fee2e2,#fee2e2 3px,#fecaca 3px,#fecaca 6px)"></span> Predicted
					</div>
				</div>
				${cycleInfo}
			</div>
		`;

		this.shadow.querySelector("#prev-month")?.addEventListener("click", () => {
			this.currentMonth = new Date(year, month - 1, 1);
			this.render();
		});

		this.shadow.querySelector("#next-month")?.addEventListener("click", () => {
			this.currentMonth = new Date(year, month + 1, 1);
			this.render();
		});
	}

	private getDayClasses(dateStr: string, todayStr: string): string[] {
		const classes: string[] = [];

		if (dateStr === todayStr) classes.push("today");

		// Actual data takes priority over predictions
		if (this.fertility.periodDays.has(dateStr)) {
			classes.push("period");
		} else if (this.fertility.ovulationDays.has(dateStr)) {
			classes.push("ovulation");
		} else if (this.fertility.fertileWindowDays.has(dateStr)) {
			classes.push("fertile");
		} else if (this.fertility.predictedPeriodDays.has(dateStr)) {
			classes.push("predicted-period");
		} else if (this.fertility.predictedOvulationDays.has(dateStr)) {
			classes.push("predicted-ovulation");
		} else if (this.fertility.predictedFertileDays.has(dateStr)) {
			classes.push("predicted-fertile");
		}

		return classes;
	}

	private getDayTooltip(dateStr: string): string {
		const labels: string[] = [];
		const f = this.fertility;

		if (f.periodDays.has(dateStr)) labels.push("Period");
		else if (f.predictedPeriodDays.has(dateStr)) labels.push("Predicted Period");

		if (f.ovulationDays.has(dateStr)) labels.push("Ovulation");
		else if (f.predictedOvulationDays.has(dateStr)) labels.push("Predicted Ovulation");

		if (f.fertileWindowDays.has(dateStr)) labels.push("Fertile Window");
		else if (f.predictedFertileDays.has(dateStr)) labels.push("Predicted Fertile");

		if (labels.length === 0) return "";
		return labels.join("\n");
	}

	private getDayDots(dateStr: string): string {
		const dots: string[] = [];

		if (
			this.fertility.periodDays.has(dateStr) ||
			this.fertility.predictedPeriodDays.has(dateStr)
		) {
			dots.push('<span class="dot period-dot"></span>');
		}
		if (
			this.fertility.ovulationDays.has(dateStr) ||
			this.fertility.predictedOvulationDays.has(dateStr)
		) {
			dots.push('<span class="dot ovulation-dot"></span>');
		}
		if (
			this.fertility.fertileWindowDays.has(dateStr) ||
			this.fertility.predictedFertileDays.has(dateStr)
		) {
			dots.push('<span class="dot fertile-dot"></span>');
		}

		return dots.join("");
	}
}

customElements.define("cycle-calendar", CycleCalendar);
