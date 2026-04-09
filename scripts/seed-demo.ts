/**
 * Seed script for the demo/guest account.
 *
 * Bypasses the HTTP API entirely — encrypts entries locally, then writes
 * directly to D1 via `wrangler d1 execute`. No login endpoint is used, so
 * the demo password is never sent over the wire and no JWT is issued.
 *
 * Usage:
 *   pnpm seed:demo           # seeds local D1
 *   pnpm seed:demo --remote  # seeds remote D1
 *
 * Prerequisites:
 *   - Migrations applied (pnpm db:migrate:local or :remote)
 *   - DEMO_PASSWORD in .dev.vars (local) or set via `wrangler secret put DEMO_PASSWORD` (remote)
 *   - The password used here must match that env var exactly
 */

import { execSync } from "node:child_process";

const USERNAME = "demo";
// Intentionally public — demo data is not private.
// Must match DEMO_PASSWORD in .dev.vars / Cloudflare secrets.
const PASSWORD = "lavender-demo-2026!";
const DB_NAME = "lavender-db";
const RETENTION_DAYS = 180;

const isRemote = process.argv.includes("--remote");
const wranglerFlag = isRemote ? "--remote" : "--local";

// ── Crypto helpers ───────────────────────────────────────────────────────────

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
		["encrypt"],
	);
}

async function encryptEntry(
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

async function hashPassword(password: string, salt: string): Promise<string> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
		key,
		256,
	);
	return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function generateSalt(): string {
	return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

// ── D1 helpers ───────────────────────────────────────────────────────────────

function d1(sql: string) {
	execSync(
		`wrangler d1 execute ${DB_NAME} ${wranglerFlag} --command ${JSON.stringify(sql)}`,
		{ stdio: "inherit" },
	);
}

function d1Query<T>(sql: string): T[] {
	const result = execSync(
		`wrangler d1 execute ${DB_NAME} ${wranglerFlag} --json --command ${JSON.stringify(sql)}`,
	);
	const parsed = JSON.parse(result.toString()) as Array<{ results: T[] }>;
	return parsed[0]?.results ?? [];
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
	const d = new Date(`${dateStr}T00:00:00`);
	d.setDate(d.getDate() + days);
	return d.toISOString().split("T")[0];
}

function todayStr(): string {
	return new Date().toISOString().split("T")[0];
}

function expiresAt(days = RETENTION_DAYS): string {
	return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

// ── Cycle data generation ────────────────────────────────────────────────────

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
			// skip during period
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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log(`Seeding demo account (${isRemote ? "remote" : "local"})...\n`);

	// 1. Upsert the demo user row directly in D1.
	const existing = d1Query<{ id: string }>(
		`SELECT id FROM users WHERE username = 'demo'`,
	);

	let userId: string;
	const salt = generateSalt();
	const passwordHash = await hashPassword(PASSWORD, salt);

	if (existing.length > 0) {
		userId = existing[0].id;
		// Update password hash + salt in case PASSWORD changed, reset role.
		d1(
			`UPDATE users SET password_hash = '${passwordHash}', salt = '${salt}', role = 'demo' WHERE id = '${userId}'`,
		);
		console.log(`Updated existing demo user (id: ${userId})`);
	} else {
		userId = crypto.randomUUID();
		d1(
			`INSERT INTO users (id, username, password_hash, salt, role) VALUES ('${userId}', 'demo', '${passwordHash}', '${salt}', 'demo')`,
		);
		// Ensure user_settings row exists.
		d1(
			`INSERT OR IGNORE INTO user_settings (user_id) VALUES ('${userId}')`,
		);
		console.log(`Created demo user (id: ${userId})`);
	}

	// 2. Clear existing entries for this user.
	d1(`DELETE FROM health_entries WHERE user_id = '${userId}'`);
	console.log("Cleared existing demo entries.");

	// 3. Derive encryption key.
	const base64Key = await deriveKeyFromPassword(PASSWORD, USERNAME);
	const cryptoKey = await importKey(base64Key);

	// 4. Encrypt and insert entries in batches.
	const entries = generateAllEntries();
	console.log(`\nEncrypting and inserting ${entries.length} entries...\n`);

	// Build INSERT statements in batches of 20 to stay within wrangler limits.
	const BATCH = 20;
	let count = 0;

	for (let i = 0; i < entries.length; i += BATCH) {
		const batch = entries.slice(i, i + BATCH);
		const values: string[] = [];

		for (const entry of batch) {
			const { encrypted, iv } = await encryptEntry(JSON.stringify(entry), cryptoKey);
			const id = crypto.randomUUID();
			const createdAt = new Date().toISOString();
			const exp = expiresAt();
			// Escape single quotes in base64 output (none expected, but be safe).
			const safeEncrypted = encrypted.replace(/'/g, "''");
			const safeIv = iv.replace(/'/g, "''");
			values.push(
				`('${id}', '${userId}', '${safeEncrypted}', '${safeIv}', '${createdAt}', '${exp}')`,
			);
		}

		d1(
			`INSERT INTO health_entries (id, user_id, encrypted_data, iv, created_at, expires_at) VALUES ${values.join(", ")}`,
		);

		count += batch.length;
		process.stdout.write(`  ${count}/${entries.length} entries inserted\r`);
	}

	console.log(`\n  ${count}/${entries.length} entries inserted.`);
	console.log("\nDemo seed complete!");
	console.log(`\nDemo credentials (for reference):`);
	console.log(`  Username: ${USERNAME}`);
	console.log(`  Password: ${PASSWORD}  (must match DEMO_PASSWORD env var)`);
}

main().catch((err) => {
	console.error("Demo seed failed:", err);
	process.exit(1);
});
