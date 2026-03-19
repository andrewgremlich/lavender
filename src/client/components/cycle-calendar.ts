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

			calendarCells += `<div class="day-cell ${classes.join(" ")}">
				<span class="day-number">${day}</span>
				${dots ? `<div class="day-dots">${dots}</div>` : ""}
			</div>`;
		}

		const cycleInfo = this.fertility.averageCycleLength
			? `<div class="cycle-info">Average cycle: ${this.fertility.averageCycleLength} days</div>`
			: "";

		this.shadow.innerHTML = `
			<link rel="stylesheet" href="/styles/main.css">
			<style>
				:host { display: block; }
				.calendar-card {
					background: var(--color-surface, #fff);
					border-radius: 0.75rem;
					padding: 1rem;
					box-shadow: 0 1px 3px rgba(0,0,0,0.1);
				}
				.calendar-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					margin-bottom: 0.75rem;
				}
				.calendar-header h3 {
					margin: 0;
					font-size: 1rem;
					color: var(--color-text, #1f2937);
				}
				.nav-btn {
					background: none;
					border: 1px solid var(--color-border, #d1d5db);
					border-radius: 0.375rem;
					padding: 0.25rem 0.625rem;
					cursor: pointer;
					font-size: 1rem;
					color: var(--color-text, #6b7280);
					transition: all 0.2s;
				}
				.nav-btn:hover {
					border-color: var(--color-primary, #7c3aed);
					color: var(--color-primary, #7c3aed);
				}
				.calendar-grid {
					display: grid;
					grid-template-columns: repeat(7, 1fr);
					gap: 2px;
				}
				.day-header {
					text-align: center;
					font-size: 0.6875rem;
					font-weight: 600;
					color: var(--color-text, #9ca3af);
					padding: 0.25rem 0;
					text-transform: uppercase;
				}
				.day-cell {
					position: relative;
					text-align: center;
					padding: 0.375rem 0.125rem;
					border-radius: 0.375rem;
					min-height: 2.25rem;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					gap: 2px;
				}
				.day-cell.empty { visibility: hidden; }
				.day-number {
					font-size: 0.8125rem;
					color: var(--color-text, #374151);
					line-height: 1;
				}
				.day-cell.today .day-number {
					font-weight: 700;
					color: var(--color-primary, #7c3aed);
				}
				.day-cell.today {
					outline: 2px solid var(--color-primary, #7c3aed);
					outline-offset: -2px;
				}
				.day-cell.period {
					background: #fee2e2;
				}
				.day-cell.period .day-number { color: #991b1b; }
				.day-cell.predicted-period {
					background: repeating-linear-gradient(
						45deg,
						#fee2e2,
						#fee2e2 3px,
						#fecaca 3px,
						#fecaca 6px
					);
				}
				.day-cell.predicted-period .day-number { color: #991b1b; }
				.day-cell.fertile {
					background: #ecfdf5;
				}
				.day-cell.fertile .day-number { color: #065f46; }
				.day-cell.predicted-fertile {
					background: repeating-linear-gradient(
						45deg,
						#ecfdf5,
						#ecfdf5 3px,
						#d1fae5 3px,
						#d1fae5 6px
					);
				}
				.day-cell.predicted-fertile .day-number { color: #065f46; }
				.day-cell.ovulation {
					background: #ede9fe;
				}
				.day-cell.ovulation .day-number { color: #6d28d9; font-weight: 700; }
				.day-cell.predicted-ovulation {
					background: repeating-linear-gradient(
						45deg,
						#ede9fe,
						#ede9fe 3px,
						#ddd6fe 3px,
						#ddd6fe 6px
					);
				}
				.day-cell.predicted-ovulation .day-number { color: #6d28d9; font-weight: 700; }
				.day-dots {
					display: flex;
					gap: 2px;
					justify-content: center;
				}
				.dot {
					width: 4px;
					height: 4px;
					border-radius: 50%;
				}
				.dot.period-dot { background: #ef4444; }
				.dot.fertile-dot { background: #10b981; }
				.dot.ovulation-dot { background: #7c3aed; }

				.calendar-legend {
					display: flex;
					flex-wrap: wrap;
					gap: 0.625rem;
					margin-top: 0.75rem;
					padding-top: 0.75rem;
					border-top: 1px solid var(--color-border, #e5e7eb);
				}
				.legend-item {
					display: flex;
					align-items: center;
					gap: 0.25rem;
					font-size: 0.6875rem;
					color: var(--color-text, #6b7280);
				}
				.legend-swatch {
					width: 12px;
					height: 12px;
					border-radius: 2px;
					flex-shrink: 0;
				}
				.legend-swatch.striped {
					background-size: 6px 6px;
				}
				.cycle-info {
					margin-top: 0.5rem;
					font-size: 0.75rem;
					color: var(--color-text, #6b7280);
					text-align: center;
				}
			</style>
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
