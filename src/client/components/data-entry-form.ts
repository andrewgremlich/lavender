import { api } from '../services/api.js';
import { encrypt, getStoredKey, importKey } from '../crypto/encryption.js';
import { navigate } from '../router.js';

interface HealthEntryData {
  date: string;
  basalBodyTemp?: number;
  cervicalMucus?: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggWhite';
  lhSurge?: boolean;
  ovulationDay?: boolean;
  fertileWindow?: boolean;
  notes?: string;
}

type TempUnit = 'C' | 'F';

class DataEntryForm extends HTMLElement {
  private shadow: ShadowRoot;
  private tempUnit: TempUnit = 'C';

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  private getTodayDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  private celsiusToFahrenheit(c: number): number {
    return Math.round((c * 9 / 5 + 32) * 100) / 100;
  }

  private fahrenheitToCelsius(f: number): number {
    return Math.round(((f - 32) * 5 / 9) * 100) / 100;
  }

  private render() {
    const today = this.getTodayDate();
    const tempMin = this.tempUnit === 'C' ? '35' : '95';
    const tempMax = this.tempUnit === 'C' ? '42' : '107.6';
    const tempPlaceholder = this.tempUnit === 'C' ? '36.50' : '97.70';
    const tempLabel = this.tempUnit === 'C' ? 'Basal Body Temperature (\u00b0C)' : 'Basal Body Temperature (\u00b0F)';

    this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <style>
        :host { display: block; }
        h2 { color: var(--color-text, #1f2937); margin: 0 0 1.5rem; font-size: 1.5rem; }
        .form-card {
          background: var(--color-surface, #fff);
          border-radius: 0.75rem;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .form-group { margin-bottom: 1.25rem; }
        label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text, #1f2937);
          margin-bottom: 0.375rem;
        }
        input[type="date"],
        input[type="number"],
        select,
        textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--color-border, #d1d5db);
          border-radius: 0.5rem;
          font-size: 1rem;
          background: var(--color-surface, #fff);
          color: var(--color-text, #1f2937);
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: var(--color-primary, #7c3aed);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        textarea { resize: vertical; min-height: 80px; font-family: inherit; }

        .temp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.375rem; }
        .temp-header label { margin-bottom: 0; }
        .unit-toggle {
          display: flex;
          border: 1px solid var(--color-primary, #7c3aed);
          border-radius: 0.375rem;
          overflow: hidden;
        }
        .unit-toggle button {
          padding: 0.25rem 0.625rem;
          border: none;
          background: transparent;
          color: var(--color-primary, #7c3aed);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .unit-toggle button.active {
          background: var(--color-primary, #7c3aed);
          color: #fff;
        }

        .mucus-options {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 0.5rem;
        }
        .mucus-option {
          position: relative;
        }
        .mucus-option input { position: absolute; opacity: 0; width: 0; height: 0; }
        .mucus-option label {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.625rem 0.5rem;
          border: 2px solid var(--color-border, #d1d5db);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          font-weight: normal;
          font-size: 0.8125rem;
        }
        .mucus-option input:checked + label {
          border-color: var(--color-primary, #7c3aed);
          background: rgba(124, 58, 237, 0.05);
        }
        .mucus-option .mucus-icon { font-size: 1.25rem; margin-bottom: 0.25rem; }
        .mucus-option .mucus-name { font-weight: 600; font-size: 0.75rem; }

        .toggle-group {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .toggle-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .toggle-switch {
          position: relative;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
        }
        .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .toggle-slider {
          position: absolute;
          inset: 0;
          background: var(--color-border, #d1d5db);
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .toggle-slider::before {
          content: '';
          position: absolute;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          top: 3px;
          left: 3px;
          transition: transform 0.2s;
        }
        .toggle-switch input:checked + .toggle-slider {
          background: var(--color-primary, #7c3aed);
        }
        .toggle-switch input:checked + .toggle-slider::before {
          transform: translateX(20px);
        }
        .toggle-label {
          font-size: 0.875rem;
          color: var(--color-text, #1f2937);
          font-weight: 500;
        }

        .btn-submit {
          width: 100%;
          padding: 0.875rem;
          background: var(--color-primary, #7c3aed);
          color: #fff;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 0.5rem;
          transition: background 0.2s;
        }
        .btn-submit:hover { background: var(--color-primary-dark, #6d28d9); }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .message {
          padding: 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          margin-bottom: 1rem;
          display: none;
        }
        .message.visible { display: block; }
        .message.error { background: #fef2f2; color: #dc2626; }
        .message.success { background: #f0fdf4; color: #16a34a; }

        .success-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1rem;
        }
        .success-actions button {
          flex: 1;
          padding: 0.625rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-add-another {
          background: var(--color-primary, #7c3aed);
          color: #fff;
          border: none;
        }
        .btn-add-another:hover { background: var(--color-primary-dark, #6d28d9); }
        .btn-view-chart {
          background: transparent;
          color: var(--color-primary, #7c3aed);
          border: 2px solid var(--color-primary, #7c3aed);
        }
        .btn-view-chart:hover { background: rgba(124, 58, 237, 0.05); }

        .loading-spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin-right: 0.5rem;
          vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <h2>Log Health Data</h2>
      <div class="form-card">
        <div class="message error" id="error-msg"></div>
        <div class="message success" id="success-msg">
          Entry saved successfully!
          <div class="success-actions">
            <button type="button" class="btn-add-another" id="add-another-btn">Add Another</button>
            <button type="button" class="btn-view-chart" id="view-chart-btn">View Chart</button>
          </div>
        </div>
        <form id="entry-form">
          <div class="form-group">
            <label for="entry-date">Date</label>
            <input type="date" id="entry-date" value="${today}" required />
          </div>

          <div class="form-group">
            <div class="temp-header">
              <label for="bbt">${tempLabel}</label>
              <div class="unit-toggle">
                <button type="button" data-unit="C" class="${this.tempUnit === 'C' ? 'active' : ''}">°C</button>
                <button type="button" data-unit="F" class="${this.tempUnit === 'F' ? 'active' : ''}">°F</button>
              </div>
            </div>
            <input type="number" id="bbt" step="0.01" min="${tempMin}" max="${tempMax}" placeholder="${tempPlaceholder}" />
          </div>

          <div class="form-group">
            <label>Cervical Mucus</label>
            <div class="mucus-options">
              <div class="mucus-option">
                <input type="radio" name="cervical-mucus" id="cm-dry" value="dry" />
                <label for="cm-dry">
                  <span class="mucus-icon">&#9711;</span>
                  <span class="mucus-name">Dry</span>
                </label>
              </div>
              <div class="mucus-option">
                <input type="radio" name="cervical-mucus" id="cm-sticky" value="sticky" />
                <label for="cm-sticky">
                  <span class="mucus-icon">&#9679;</span>
                  <span class="mucus-name">Sticky</span>
                </label>
              </div>
              <div class="mucus-option">
                <input type="radio" name="cervical-mucus" id="cm-creamy" value="creamy" />
                <label for="cm-creamy">
                  <span class="mucus-icon">&#9684;</span>
                  <span class="mucus-name">Creamy</span>
                </label>
              </div>
              <div class="mucus-option">
                <input type="radio" name="cervical-mucus" id="cm-watery" value="watery" />
                <label for="cm-watery">
                  <span class="mucus-icon">&#9676;</span>
                  <span class="mucus-name">Watery</span>
                </label>
              </div>
              <div class="mucus-option">
                <input type="radio" name="cervical-mucus" id="cm-eggwhite" value="eggWhite" />
                <label for="cm-eggwhite">
                  <span class="mucus-icon">&#10741;</span>
                  <span class="mucus-name">Egg White</span>
                </label>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Indicators</label>
            <div class="toggle-group">
              <div class="toggle-item">
                <div class="toggle-switch">
                  <input type="checkbox" id="lh-surge" />
                  <span class="toggle-slider"></span>
                </div>
                <span class="toggle-label">LH Surge</span>
              </div>
              <div class="toggle-item">
                <div class="toggle-switch">
                  <input type="checkbox" id="ovulation-day" />
                  <span class="toggle-slider"></span>
                </div>
                <span class="toggle-label">Ovulation Day</span>
              </div>
              <div class="toggle-item">
                <div class="toggle-switch">
                  <input type="checkbox" id="fertile-window" />
                  <span class="toggle-slider"></span>
                </div>
                <span class="toggle-label">Fertile Window</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="notes">Notes</label>
            <textarea id="notes" placeholder="Any additional observations..."></textarea>
          </div>

          <button type="submit" class="btn-submit" id="submit-btn">Save Entry</button>
        </form>
      </div>
    `;
  }

  private setupListeners() {
    const form = this.shadow.querySelector('#entry-form') as HTMLFormElement;
    const successMsg = this.shadow.querySelector('#success-msg') as HTMLElement;
    const addAnotherBtn = this.shadow.querySelector('#add-another-btn') as HTMLButtonElement;
    const viewChartBtn = this.shadow.querySelector('#view-chart-btn') as HTMLButtonElement;

    // Temperature unit toggle
    const unitBtns = this.shadow.querySelectorAll('.unit-toggle button');
    unitBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const newUnit = (btn as HTMLElement).dataset.unit as TempUnit;
        if (newUnit === this.tempUnit) return;

        const bbtInput = this.shadow.querySelector('#bbt') as HTMLInputElement;
        const currentVal = Number.parseFloat(bbtInput.value);

        this.tempUnit = newUnit;

        // Convert existing value
        if (!Number.isNaN(currentVal)) {
          if (newUnit === 'F') {
            bbtInput.value = this.celsiusToFahrenheit(currentVal).toString();
          } else {
            bbtInput.value = this.fahrenheitToCelsius(currentVal).toString();
          }
        }

        // Update constraints
        if (newUnit === 'C') {
          bbtInput.min = '35';
          bbtInput.max = '42';
          bbtInput.placeholder = '36.50';
        } else {
          bbtInput.min = '95';
          bbtInput.max = '107.6';
          bbtInput.placeholder = '97.70';
        }

        // Update active state
        unitBtns.forEach((b) => {
          b.classList.remove('active');
        });
        btn.classList.add('active');

        // Update label
        const label = this.shadow.querySelector('.temp-header label') as HTMLElement;
        label.textContent = newUnit === 'C'
          ? 'Basal Body Temperature (\u00b0C)'
          : 'Basal Body Temperature (\u00b0F)';
      });
    });

    form.addEventListener('submit', async (e: Event) => {
      e.preventDefault();
      this.clearMessages();

      const submitBtn = this.shadow.querySelector('#submit-btn') as HTMLButtonElement;

      const date = (this.shadow.querySelector('#entry-date') as HTMLInputElement).value;
      const bbtRaw = (this.shadow.querySelector('#bbt') as HTMLInputElement).value;
      const mucusEl = this.shadow.querySelector('input[name="cervical-mucus"]:checked') as HTMLInputElement | null;
      const lhSurge = (this.shadow.querySelector('#lh-surge') as HTMLInputElement).checked;
      const ovulationDay = (this.shadow.querySelector('#ovulation-day') as HTMLInputElement).checked;
      const fertileWindow = (this.shadow.querySelector('#fertile-window') as HTMLInputElement).checked;
      const notes = (this.shadow.querySelector('#notes') as HTMLTextAreaElement).value.trim();

      if (!date) {
        this.showError('Please select a date.');
        return;
      }

      // Build entry data (always store temp in Celsius)
      const entry: HealthEntryData = { date };

      if (bbtRaw) {
        let tempC = Number.parseFloat(bbtRaw);
        if (this.tempUnit === 'F') {
          tempC = this.fahrenheitToCelsius(tempC);
        }
        entry.basalBodyTemp = tempC;
      }

      if (mucusEl) {
        entry.cervicalMucus = mucusEl.value as HealthEntryData['cervicalMucus'];
      }

      if (lhSurge) entry.lhSurge = true;
      if (ovulationDay) entry.ovulationDay = true;
      if (fertileWindow) entry.fertileWindow = true;
      if (notes) entry.notes = notes;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span>Encrypting & saving...';

        const storedKey = getStoredKey();
        if (!storedKey) {
          this.showError('Encryption key not found. Please log in again.');
          return;
        }

        const cryptoKey = await importKey(storedKey);
        const { encrypted, iv } = await encrypt(JSON.stringify(entry), cryptoKey);
        await api.metrics.create(encrypted, iv);

        form.style.display = 'none';
        successMsg.classList.add('visible');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save entry. Please try again.';
        this.showError(message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Entry';
      }
    });

    addAnotherBtn.addEventListener('click', () => {
      form.reset();
      (this.shadow.querySelector('#entry-date') as HTMLInputElement).value = this.getTodayDate();
      form.style.display = '';
      successMsg.classList.remove('visible');
    });

    viewChartBtn.addEventListener('click', () => {
      navigate('/');
    });
  }

  private showError(msg: string) {
    const errorEl = this.shadow.querySelector('#error-msg') as HTMLElement;
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
  }

  private clearMessages() {
    const errorEl = this.shadow.querySelector('#error-msg') as HTMLElement;
    const successEl = this.shadow.querySelector('#success-msg') as HTMLElement;
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
    successEl.classList.remove('visible');
  }
}

customElements.define('data-entry-form', DataEntryForm);
