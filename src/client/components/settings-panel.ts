import { getStoredKey, importKey, storeKey } from '../crypto/encryption.js';
import { api } from '../services/api.js';
import { logout, registerPasskey } from '../services/auth.js';

class SettingsPanel extends HTMLElement {
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.loadPasskeys();
  }

  private render() {
    const hasKey = !!getStoredKey();

    this.shadow.innerHTML = `
      <link rel="stylesheet" href="/styles/main.css">
      <style>
        :host { display: block; }
        h2 { color: var(--color-text, #1f2937); margin: 0 0 1.5rem; font-size: 1.5rem; }

        .settings-card {
          background: var(--color-surface, #fff);
          border-radius: 0.75rem;
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          margin-bottom: 1rem;
        }
        .settings-card h3 {
          font-size: 1rem;
          color: var(--color-text, #1f2937);
          margin: 0 0 0.75rem;
        }

        label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text, #1f2937);
          margin-bottom: 0.25rem;
        }
        select, input[type="password"] {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--color-border, #d1d5db);
          border-radius: 0.5rem;
          font-size: 1rem;
          background: var(--color-surface, #fff);
          color: var(--color-text, #1f2937);
          box-sizing: border-box;
        }
        select:focus, input:focus {
          outline: none;
          border-color: var(--color-primary, #7c3aed);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-primary {
          background: var(--color-primary, #7c3aed);
          color: #fff;
        }
        .btn-primary:hover { background: var(--color-primary-dark, #6d28d9); }
        .btn-outline {
          background: transparent;
          color: var(--color-primary, #7c3aed);
          border: 2px solid var(--color-primary, #7c3aed);
        }
        .btn-outline:hover { background: rgba(124, 58, 237, 0.05); }
        .btn-danger {
          background: #dc2626;
          color: #fff;
        }
        .btn-danger:hover { background: #b91c1c; }
        .btn-danger-outline {
          background: transparent;
          color: #dc2626;
          border: 2px solid #dc2626;
        }
        .btn-danger-outline:hover { background: rgba(220, 38, 38, 0.05); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-full { width: 100%; justify-content: center; }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.8125rem;
          font-weight: 500;
        }
        .status-badge.active { background: #ecfdf5; color: #065f46; }
        .status-badge.inactive { background: #fef2f2; color: #dc2626; }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .status-badge.active .status-dot { background: #10b981; }
        .status-badge.inactive .status-dot { background: #dc2626; }

        .passkey-list { margin-top: 0.75rem; }
        .passkey-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
          font-size: 0.875rem;
        }
        .passkey-item:last-child { border-bottom: none; }
        .passkey-name { color: var(--color-text, #1f2937); }
        .passkey-delete {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          font-size: 0.8125rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
        }
        .passkey-delete:hover { background: rgba(220, 38, 38, 0.1); }

        .form-row { margin-bottom: 0.75rem; }

        .confirm-dialog {
          display: none;
          background: #fef2f2;
          border: 1px solid #fca5a5;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-top: 0.75rem;
        }
        .confirm-dialog.visible { display: block; }
        .confirm-dialog p {
          margin: 0 0 0.75rem;
          font-size: 0.875rem;
          color: #991b1b;
        }
        .confirm-actions { display: flex; gap: 0.5rem; }

        .message {
          padding: 0.5rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          margin-top: 0.5rem;
          display: none;
        }
        .message.visible { display: block; }
        .message.success { background: #f0fdf4; color: #16a34a; }
        .message.error { background: #fef2f2; color: #dc2626; }

        .section-divider {
          height: 1px;
          background: var(--color-border, #e5e7eb);
          margin: 0.75rem 0;
        }

        .loading-spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>

      <h2>Settings</h2>

      <!-- Encryption Key Status -->
      <div class="settings-card">
        <h3>Encryption Key</h3>
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">
          <span>Status:</span>
          ${hasKey
            ? '<span class="status-badge active"><span class="status-dot"></span>Key Loaded</span>'
            : '<span class="status-badge inactive"><span class="status-dot"></span>Not Loaded</span>'
          }
        </div>
        <div id="key-entry-section" style="${hasKey ? 'display:none' : ''}">
          <div class="form-row">
            <label for="re-enter-key">Re-enter Encryption Key</label>
            <input type="password" id="re-enter-key" placeholder="Paste your encryption key" autocomplete="off" />
          </div>
          <button class="btn btn-primary" id="load-key-btn">Load Key</button>
          <div class="message" id="key-msg"></div>
        </div>
        ${hasKey ? '<button class="btn btn-outline" id="show-key-entry" style="font-size:0.8125rem;">Re-enter Key</button>' : ''}
      </div>

      <!-- Data Retention -->
      <div class="settings-card">
        <h3>Data Retention</h3>
        <div class="form-row">
          <label for="retention-period">Auto-delete entries older than</label>
          <select id="retention-period">
            <option value="30">30 days</option>
            <option value="90" selected>90 days</option>
            <option value="180">180 days</option>
            <option value="365">1 year</option>
            <option value="0">Keep forever</option>
          </select>
        </div>
        <button class="btn btn-primary" id="save-retention-btn">Save</button>
        <div class="message" id="retention-msg"></div>
      </div>

      <!-- Passkeys -->
      <div class="settings-card">
        <h3>Passkeys</h3>
        <p style="font-size:0.8125rem;color:var(--color-text-secondary,#6b7280);margin:0 0 0.75rem;">
          Use passkeys for passwordless sign-in on supported devices.
        </p>
        <button class="btn btn-outline" id="register-passkey-btn">Register New Passkey</button>
        <div class="message" id="passkey-msg"></div>
        <div class="passkey-list" id="passkey-list">
          <p style="font-size:0.8125rem;color:var(--color-text-secondary,#6b7280);">Loading passkeys...</p>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="settings-card" style="border:1px solid #fca5a5;">
        <h3 style="color:#dc2626;">Danger Zone</h3>

        <button class="btn btn-danger-outline btn-full" id="delete-data-btn">Delete All Data</button>
        <div class="confirm-dialog" id="delete-data-confirm">
          <p>This will permanently delete all your health entries. This action cannot be undone.</p>
          <div class="confirm-actions">
            <button class="btn btn-danger" id="confirm-delete-data">Yes, Delete All Data</button>
            <button class="btn btn-outline" id="cancel-delete-data">Cancel</button>
          </div>
        </div>

        <div style="height:0.75rem;"></div>

        <button class="btn btn-danger btn-full" id="delete-account-btn">Delete Account</button>
        <div class="confirm-dialog" id="delete-account-confirm">
          <p>This will permanently delete your account and all associated data. This cannot be undone.</p>
          <div class="confirm-actions">
            <button class="btn btn-danger" id="confirm-delete-account">Yes, Delete My Account</button>
            <button class="btn btn-outline" id="cancel-delete-account">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Logout -->
      <button class="btn btn-outline btn-full" id="logout-btn" style="margin-top:0.5rem;">
        Log Out
      </button>
    `;
  }

  private setupListeners() {
    // Show key entry if already loaded
    const showKeyEntryBtn = this.shadow.querySelector('#show-key-entry');
    if (showKeyEntryBtn) {
      showKeyEntryBtn.addEventListener('click', () => {
        const section = this.shadow.querySelector('#key-entry-section') as HTMLElement;
        section.style.display = '';
        showKeyEntryBtn.remove();
      });
    }

    // Load key
    this.shadow.querySelector('#load-key-btn')?.addEventListener('click', async () => {
      const input = this.shadow.querySelector('#re-enter-key') as HTMLInputElement;
      const msgEl = this.shadow.querySelector('#key-msg') as HTMLElement;
      const keyValue = input.value.trim();

      if (!keyValue) {
        this.showMessage(msgEl, 'Please enter your encryption key.', 'error');
        return;
      }

      try {
        await importKey(keyValue); // Validate the key by attempting import
        storeKey(keyValue);
        this.showMessage(msgEl, 'Encryption key loaded successfully.', 'success');
        input.value = '';
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid encryption key.';
        this.showMessage(msgEl, message, 'error');
      }
    });

    // Save retention
    this.shadow.querySelector('#save-retention-btn')?.addEventListener('click', async () => {
      const select = this.shadow.querySelector('#retention-period') as HTMLSelectElement;
      const msgEl = this.shadow.querySelector('#retention-msg') as HTMLElement;
      try {
        await api.settings.update(Number.parseInt(select.value, 10));
        this.showMessage(msgEl, 'Retention period saved.', 'success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save.';
        this.showMessage(msgEl, message, 'error');
      }
    });

    // Register passkey
    this.shadow.querySelector('#register-passkey-btn')?.addEventListener('click', async () => {
      const btn = this.shadow.querySelector('#register-passkey-btn') as HTMLButtonElement;
      const msgEl = this.shadow.querySelector('#passkey-msg') as HTMLElement;
      try {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Registering...';
        await registerPasskey();
        this.showMessage(msgEl, 'Passkey registered successfully.', 'success');
        this.loadPasskeys();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to register passkey.';
        this.showMessage(msgEl, message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Register New Passkey';
      }
    });

    // Delete all data
    const deleteDataBtn = this.shadow.querySelector('#delete-data-btn') as HTMLElement;
    const deleteDataConfirm = this.shadow.querySelector('#delete-data-confirm') as HTMLElement;
    deleteDataBtn.addEventListener('click', () => deleteDataConfirm.classList.add('visible'));
    this.shadow.querySelector('#cancel-delete-data')?.addEventListener('click', () => deleteDataConfirm.classList.remove('visible'));
    this.shadow.querySelector('#confirm-delete-data')?.addEventListener('click', async () => {
      try {
        await api.metrics.deleteAll();
        deleteDataConfirm.classList.remove('visible');
        deleteDataBtn.textContent = 'All data deleted';
        (deleteDataBtn as HTMLButtonElement).disabled = true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        alert(`Failed to delete data: ${message}`);
      }
    });

    // Delete account
    const deleteAccountBtn = this.shadow.querySelector('#delete-account-btn') as HTMLElement;
    const deleteAccountConfirm = this.shadow.querySelector('#delete-account-confirm') as HTMLElement;
    deleteAccountBtn.addEventListener('click', () => deleteAccountConfirm.classList.add('visible'));
    this.shadow.querySelector('#cancel-delete-account')?.addEventListener('click', () => deleteAccountConfirm.classList.remove('visible'));
    this.shadow.querySelector('#confirm-delete-account')?.addEventListener('click', async () => {
      try {
        await api.auth.deleteAccount();
        logout();
        window.dispatchEvent(new CustomEvent('user-logout'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        alert(`Failed to delete account: ${message}`);
      }
    });

    // Logout
    this.shadow.querySelector('#logout-btn')?.addEventListener('click', () => {
      logout();
      window.dispatchEvent(new CustomEvent('user-logout'));
    });
  }

  private async loadPasskeys() {
    const list = this.shadow.querySelector('#passkey-list') as HTMLElement;
    try {
      const passkeys = await api.passkeys.list();

      if (passkeys.length === 0) {
        list.innerHTML = '<p style="font-size:0.8125rem;color:var(--color-text-secondary,#6b7280);">No passkeys registered.</p>';
        return;
      }

      list.innerHTML = passkeys
        .map(
          (pk) => `
        <div class="passkey-item" data-id="${pk.id}">
          <span class="passkey-name">Passkey ${pk.credential_id.slice(0, 8)} <span style="color:var(--color-text-secondary,#6b7280);font-size:0.75rem;">(${new Date(pk.created_at).toLocaleDateString()})</span></span>
          <button class="passkey-delete" data-id="${pk.id}">Remove</button>
        </div>
      `
        )
        .join('');

      list.querySelectorAll('.passkey-delete').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.id;
          if (!confirm('Remove this passkey?')) return;
          try {
            if (id) await api.passkeys.delete(id);
            this.loadPasskeys();
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            alert(`Failed to remove passkey: ${message}`);
          }
        });
      });
    } catch {
      list.innerHTML = '<p style="font-size:0.8125rem;color:var(--color-text-secondary,#6b7280);">Could not load passkeys.</p>';
    }
  }

  private showMessage(el: HTMLElement, msg: string, type: 'success' | 'error') {
    el.textContent = msg;
    el.className = `message visible ${type}`;
    setTimeout(() => {
      el.classList.remove('visible');
    }, 4000);
  }
}

customElements.define('settings-panel', SettingsPanel);
