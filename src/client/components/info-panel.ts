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
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        :host { display: block; }
        h2 { color: var(--color-text, #1f2937); margin: 0 0 1.5rem; font-size: 1.5rem; }
        h3 { color: var(--color-primary, #7c3aed); margin: 0 0 0.5rem; font-size: 1rem; }
        .card {
          background: var(--color-surface, #fff);
          border-radius: 0.75rem;
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          margin-bottom: 1rem;
        }
        p {
          margin: 0 0 0.75rem;
          font-size: 0.9375rem;
          line-height: 1.6;
          color: var(--color-text, #1f2937);
        }
        p:last-child { margin-bottom: 0; }
        ul {
          margin: 0.5rem 0 0.75rem 1.25rem;
          padding: 0;
          font-size: 0.9375rem;
          line-height: 1.6;
          color: var(--color-text, #1f2937);
        }
        ul:last-child { margin-bottom: 0; }
        .highlight {
          background: rgba(124, 58, 237, 0.07);
          border-left: 3px solid var(--color-primary, #7c3aed);
          border-radius: 0 0.5rem 0.5rem 0;
          padding: 0.75rem 1rem;
          margin: 0.75rem 0 0;
          font-size: 0.875rem;
          color: var(--color-text, #1f2937);
          line-height: 1.6;
        }
        .highlight:last-child { margin-bottom: 0; }
      </style>

      <h2>About Lavendar</h2>

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
