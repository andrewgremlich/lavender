# Lavender Feature Roadmap

Lavender is a privacy-first fertility tracker with strong E2EE, cycle predictions, and web component UI. This roadmap covers planned features across three areas: analytics/insights, export/interoperability, and UX/engagement — phased by complexity and dependency.

---

## Phase 1: Quick Wins (low complexity, high value)

### 1. CSV Export ✅
- Add a "Download CSV" button next to existing JSON export
- Decrypt entries client-side (already done for JSON export), then serialize to CSV columns matching `HealthEntryData` fields
- Pure frontend change

### 2. Symptom Heatmap ❌ 

I don't know if this would be valuable.

- Grid visualization — X axis = cycle day (1–35), Y axis = each symptom
- Color intensity = frequency across all recorded cycles
- Reuse existing decrypted entry data and cycle detection from fertility utils
- Could use Chart.js matrix plugin or a custom canvas/HTML table

### 3. Prediction Accuracy Tracking ✅
- Compare past predictions against observed actuals (period start dates, ovulation dates)
- Calculate accuracy % and trend over time
- Pure client-side — predictions are already generated, just need retroactive comparison against recorded data

---

## Phase 2: Medium Complexity

### 4. Cycle Comparison View ✅
- Align multiple cycles by ovulation day (Day 0), overlay BBT curves and symptom indicators
- Chart.js multi-dataset line chart with cycle selector
- Builds on existing cycle segmentation logic

### 5. Luteal Phase Trends ✅
- Extract luteal phase length per cycle (ovulation to next period start)
- Plot over time as a trend line
- Flag if consistently <10 days or shortening (potential hormonal concern)

### 6. PDF Reports ✅
- Generate a printable cycle summary (last 1–3 cycles) with BBT chart, key dates, symptom summary
- Options: `jsPDF` library, or render HTML and use `window.print()` with print-specific CSS
- PDF generated entirely client-side from decrypted data (preserves E2EE)

---

## Phase 3: Higher Complexity

### 7. Push Notifications (PWA)
- Request notification permission in settings
- Store push subscription in D1 (new `push_subscriptions` table)
- Add a scheduled worker (Cloudflare Cron Trigger) to send daily morning reminders
- Requires Web Push API + VAPID keys in env vars

### 8. Onboarding Tutorial
- Step-by-step walkthrough on first login (check flag in `localStorage`)
- Highlight: data entry form, chart interpretation, settings
- Tooltip/modal approach with sequential steps using a custom overlay component

### 9. Import from Other Apps
- Accept CSV/JSON uploads, parse into `HealthEntryData` format, encrypt and POST to API
- Start with generic CSV import, then add app-specific mappings for Clue, Flo, Natural Cycles

---

## Phase 4: Large Effort

### 10. Multi-language (i18n)
- Extract all user-facing strings into translation files (JSON per locale)
- Lightweight i18n utility (simple key lookup with fallback)
- Language selector in settings, preference stored in `localStorage`
- Start with English + 1-2 additional languages
- Touches every component, so best done after other features stabilize

---

## Suggested Implementation Order

1. CSV Export (simplest, immediate value)
2. Symptom Heatmap (already planned, high insight value)
3. Luteal Phase Trends (reuses existing calculations)
4. Prediction Accuracy (reuses existing predictions)
5. Cycle Comparison (medium complexity, strong analytics)
6. PDF Reports (doctor visit utility)
7. Onboarding Tutorial (UX polish)
8. Push Notifications (requires backend changes + VAPID setup)
9. Import from Apps (format research needed)
10. i18n (touches everything, do last)
