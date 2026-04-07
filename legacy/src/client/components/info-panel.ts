class InfoPanel extends HTMLElement {
	private shadow: ShadowRoot;

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: "open" });
	}

	connectedCallback() {
		this.render();
	}

	private render() {
		this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <link rel="stylesheet" href="/styles/info-panel.css">

      <h2>About Lavender</h2>

      <div class="card">
        <h3>How Fertility Indicators Are Calculated</h3>
        <p>
          All fertility calculations happen locally on your device after your
          data is decrypted. The server never performs these calculations and
          never sees your health data.
        </p>

        <h4>Ovulation Detection</h4>
        <p>
          Ovulation is detected using two methods, then reconciled:
        </p>
        <ul>
          <li>
            <strong>LH surge:</strong> When you log a positive LH test, ovulation
            is estimated 1–2 days after the surge. Research shows ovulation
            occurs 9–51 hours after urine LH detection (mean ~24 hours), so both
            windows are considered.
          </li>
          <li>
            <strong>Basal body temperature (BBT):</strong> Uses the "3-over-6"
            rule. After 6 days of baseline temperatures, a thermal shift is
            detected when 3 consecutive readings exceed the highest of the
            previous 6 by at least 0.2 °C. For gradual rises (increments under
            0.05 °C), a 4th confirmation day is required. Readings above
            37.8 °C are automatically discarded as likely fever, and a
            time-of-day correction is applied when measurement time is logged.
            Ovulation is placed on the day before the first elevated reading.
          </li>
        </ul>
        <p>
          When both methods detect ovulation within the same 2-day window, the
          BBT-confirmed date is used because it retrospectively confirms that
          ovulation occurred, while LH only predicts it.
        </p>

        <h4>Fertile Window</h4>
        <p>
          The fertile window spans the 5 days before ovulation through ovulation
          day itself (6 days total). Sperm can survive up to 5 days in the
          reproductive tract, and the egg is viable for about 24 hours after
          release.
        </p>

        <h4>Cervical Mucus</h4>
        <p>
          Cervical mucus observations provide an independent fertility signal.
          Any mucus rated sticky or above (score 2–4) marks that day as
          potentially fertile. Peak-type mucus (clear, stretchy, egg-white)
          triggers the "peak + 3" rule: the fertile window extends 3 additional
          days after the last peak observation. Mucus-based fertility is shown
          separately from BBT/LH-confirmed indicators.
        </p>

        <h4>Cycle and Period Tracking</h4>
        <p>
          Your cycle length is calculated from the gaps between period start
          dates. Cycles shorter than 18 days or longer than 45 days are excluded
          as outliers. The luteal phase (ovulation to next period) is derived
          from your observed data when available, defaulting to 13 days
          otherwise.
        </p>

        <h4>Predictions</h4>
        <p>
          Future cycles are predicted using a recency-weighted average of your
          observed cycle lengths, giving more importance to recent cycles.
          Predicted ovulation is calculated by subtracting your observed luteal
          phase from the expected cycle length. If your cycles are irregular
          (variability greater than 2 days), the predicted fertile window is
          widened on the early side to account for uncertainty. Predictions are
          generated for the next 3 cycles using your observed average period
          duration.
        </p>

        <div class="highlight">
          These calculations are informational estimates based on your logged data.
          They are not medical advice and should not be used as a sole method of
          contraception or conception planning.
        </div>
      </div>

      <div class="card">
        <h3>End-to-End Encrypted Health Data</h3>
        <p>
          Your health data is private by design. Every entry you log is encrypted
          on your device before it is sent to the server — the server only ever
          stores an unreadable ciphertext blob. No one, including the people who
          run this service, can read your data.
        </p>
        <p>
          Encryption uses AES-256-GCM, and your encryption key is derived from
          your password using PBKDF2 (100,000 iterations, SHA-256). The key never
          leaves your device.
        </p>
        <div class="highlight">
          If you forget your password, your data cannot be recovered. There is no
          password reset that could expose your health records — that is intentional.
        </div>
      </div>

      <div class="card">
        <h3>Data Retention</h3>
        <p>
          Each health entry has an expiry date calculated from your retention
          period setting. When you fetch your data, any entries older than your
          retention window are automatically deleted from the server.
        </p>
        <ul>
          <li>Default retention period: 180 days (6 months)</li>
          <li>Configurable to 6, 9, or 12 months</li>
          <li>Changing the retention period recalculates expiry dates on all existing entries</li>
          <li>Deleting your account permanently removes all data immediately</li>
        </ul>
        <div class="highlight">
          Because data is encrypted, the server cannot selectively read or export
          your entries — only you can decrypt them with your password.
        </div>
      </div>
    `;
	}
}

customElements.define("info-panel", InfoPanel);
