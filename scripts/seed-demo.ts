/**
 * Seed script for the demo/guest account.
 * Creates (or re-seeds) the `demo` user with realistic cycle data so visitors
 * can explore the app without registering.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts
 *   Requires the dev server running at http://localhost:5173
 *
 * After running this script, set the demo user's role in D1:
 *   Local:  wrangler d1 execute lavender-db --local --command "UPDATE users SET role='demo' WHERE username='demo';"
 *   Remote: wrangler d1 execute lavender-db --remote --command "UPDATE users SET role='demo' WHERE username='demo';"
 *
 * The DEMO_PASSWORD here must match the DEMO_PASSWORD environment variable
 * set in .dev.vars (local) or via `wrangler secret put DEMO_PASSWORD` (remote).
 */

const API_BASE = "http://localhost:5173/api";
const USERNAME = "demo";
// This password is intentionally public — the demo user's data is not private.
// Must match DEMO_PASSWORD in .dev.vars / Cloudflare secrets.
const PASSWORD = "lavender-demo-2026!";

// ── Crypto helpers (mirrors src/client/crypto/encryption.ts) ────────────────

async function deriveKeyFromPassword(
	password: string,
	username: string,
): Promise<string> {
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey(
		"raw",
		enc.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: enc.encode(`lavender:${username}`),
			iterations: 100000,
			hash: "SHA-256",
		},
		baseKey,
		256,
	);
	return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function importKey(base64Key: string): Promise<CryptoKey> {
	const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

async function encrypt(
	data: string,
	key: CryptoKey,
): Promise<{ encrypted: string; iv: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(data);
	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoded,
	);
	return {
		encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
		iv: btoa(String.fromCharCode(...iv)),
	};
}

// ── API helpers ─────────────────────────────────────────────────────────────

async function request<T>(
	path: string,
	options: RequestInit & { token?: string } = {},
): Promise<T> {
	const { token, ...fetchOptions } = options;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...((fetchOptions.headers as Record<string, string>) || {}),
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	const response = await fetch(`${API_BASE}${path}`, {
		...fetchOptions,
		headers,
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`HTTP ${response.status}: ${body}`);
	}
	return response.json() as Promise<T>;
}

// ── Date helpers ────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
	const d = new Date(`${dateStr}T00:00:00`);
	d.setDate(d.getDate() + days);
	return d.toISOString().split("T")[0];
}

function todayStr(): string {
	return new Date().toISOString().split("T")[0];
}

// ── Cycle data generation ───────────────────────────────────────────────────

type MucusType = "dry" | "sticky" | "creamy" | "watery" | "eggWhite";
type FlowType = "light" | "medium" | "heavy";

interface HealthEntry {
	date: string;
	basalBodyTemp?: number;
	cervicalMucus?: MucusType;
	lhSurge?: 0 | 1 | 2;
	appetiteChange?: boolean;
	moodChange?: boolean;
	increasedSexDrive?: boolean;
	breastTenderness?: boolean;
	mildSpotting?: boolean;
	heightenedSmell?: boolean;
	cervixChanges?: boolean;
	fluidRetention?: boolean;
	cramping?: boolean;
	bleedingStart?: boolean;
	bleedingEnd?: boolean;
	bleedingFlow?: FlowType;
	notes?: string;
}

function jitter(base: number, range: number): number {
	return Math.round((base + (Math.random() - 0.5) * range) * 100) / 100;
}

function generateCycle(startDate: string, cycleLength: number): HealthEntry[] {
	const entries: HealthEntry[] = [];
	const ovulationDay = cycleLength - 14;

	for (let day = 0; day < cycleLength; day++) {
		const date = addDays(startDate, day);
		const cycleDay = day + 1;
		const entry: HealthEntry = { date };

		if (cycleDay <= ovulationDay) {
			entry.basalBodyTemp = jitter(36.175, 0.15);
		} else if (cycleDay === ovulationDay + 1) {
			entry.basalBodyTemp = jitter(36.6, 0.1);
		} else {
			entry.basalBodyTemp = jitter(36.725, 0.15);
		}

		if (cycleDay === 1) {
			entry.bleedingStart = true;
			entry.bleedingFlow = "medium";
			entry.cramping = true;
			entry.moodChange = true;
			entry.notes = "Period started.";
		} else if (cycleDay === 2) {
			entry.bleedingFlow = "heavy";
			entry.cramping = true;
		} else if (cycleDay === 3) {
			entry.bleedingFlow = "heavy";
		} else if (cycleDay === 4) {
			entry.bleedingFlow = "medium";
		} else if (cycleDay === 5) {
			entry.bleedingEnd = true;
			entry.bleedingFlow = "light";
		}

		if (cycleDay <= 5) {
			// skip
		} else if (cycleDay <= 8) {
			entry.cervicalMucus = "dry";
		} else if (cycleDay <= 10) {
			entry.cervicalMucus = "sticky";
		} else if (cycleDay <= 12) {
			entry.cervicalMucus = "creamy";
		} else if (cycleDay <= ovulationDay + 1) {
			entry.cervicalMucus = cycleDay === ovulationDay ? "eggWhite" : "watery";
		} else if (cycleDay <= ovulationDay + 3) {
			entry.cervicalMucus = "creamy";
		} else if (cycleDay <= ovulationDay + 5) {
			entry.cervicalMucus = "sticky";
		} else {
			entry.cervicalMucus = "dry";
		}

		if (cycleDay >= ovulationDay - 3 && cycleDay <= ovulationDay + 1) {
			entry.increasedSexDrive = true;
			entry.cervixChanges = true;
		}
		if (cycleDay >= ovulationDay - 2 && cycleDay <= ovulationDay) {
			entry.heightenedSmell = true;
		}
		if (cycleDay === ovulationDay - 2) {
			entry.lhSurge = 1;
			entry.notes = "Faint LH line appearing.";
		}
		if (cycleDay === ovulationDay - 1) {
			entry.lhSurge = 2;
			entry.notes = "Positive OPK - strong LH surge.";
		}
		if (cycleDay === ovulationDay) {
			entry.lhSurge = 2;
			entry.notes = "Positive OPK - peak LH surge detected.";
		}
		if (cycleDay === ovulationDay + 1) {
			entry.lhSurge = 1;
			entry.mildSpotting = true;
			entry.notes = "LH declining. Mild ovulation spotting observed.";
		}

		if (cycleDay >= ovulationDay + 5 && cycleDay <= ovulationDay + 10) {
			entry.breastTenderness = true;
		}
		if (cycleDay >= ovulationDay + 7 && cycleDay <= ovulationDay + 12) {
			entry.fluidRetention = true;
		}
		if (cycleDay >= cycleLength - 3) {
			entry.moodChange = true;
			entry.appetiteChange = true;
			entry.cramping = true;
			if (!entry.notes) entry.notes = "PMS symptoms.";
		}

		entries.push(entry);
	}

	return entries;
}

function generateAllEntries(): HealthEntry[] {
	const today = todayStr();
	const cycleLengths = [28, 26, 30, 27, 32, 29];
	const totalDays = cycleLengths.reduce((a, b) => a + b, 0);
	const startDate = addDays(today, -(totalDays - 5));

	const allEntries: HealthEntry[] = [];
	let currentStart = startDate;

	for (const len of cycleLengths) {
		allEntries.push(...generateCycle(currentStart, len));
		currentStart = addDays(currentStart, len);
	}

	return allEntries.filter((e) => e.date <= today);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
	console.log("Seeding Lavender demo account...\n");

	// 1. Register or login
	let token: string;
	try {
		const res = await request<{ token: string }>("/auth/register", {
			method: "POST",
			body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
		});
		token = res.token;
		console.log(`Created demo user "${USERNAME}"`);
	} catch {
		const res = await request<{ token: string }>("/auth/login", {
			method: "POST",
			body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
		});
		token = res.token;
		console.log(`Logged in as "${USERNAME}" (already exists)`);
	}

	// 2. Clear existing entries
	try {
		await request("/metrics", { method: "DELETE", token });
		console.log("Cleared existing entries.");
	} catch {
		// No entries to clear
	}

	// 3. Derive encryption key and import it
	const base64Key = await deriveKeyFromPassword(PASSWORD, USERNAME);
	const cryptoKey = await importKey(base64Key);

	// 4. Generate and upload entries
	const entries = generateAllEntries();
	console.log(`\nGenerating ${entries.length} entries across ~6 cycles...\n`);

	let count = 0;
	for (const entry of entries) {
		const { encrypted, iv } = await encrypt(JSON.stringify(entry), cryptoKey);
		await request("/metrics", {
			method: "POST",
			body: JSON.stringify({ encryptedData: encrypted, iv }),
			token,
		});
		count++;
		if (count % 10 === 0) {
			process.stdout.write(`  ${count}/${entries.length} entries created\r`);
		}
	}

	console.log(`  ${count}/${entries.length} entries created.`);
	console.log("\nDemo seed complete!");
	console.log("\nNext step — set the demo role in D1:");
	console.log(
		`  Local:  wrangler d1 execute lavender-db --local --command "UPDATE users SET role='demo' WHERE username='demo';"`,
	);
	console.log(
		`  Remote: wrangler d1 execute lavender-db --remote --command "UPDATE users SET role='demo' WHERE username='demo';"`,
	);
}

main().catch((err) => {
	console.error("Demo seed failed:", err);
	process.exit(1);
});
