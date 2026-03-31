import { Hono } from "hono";
import { sign } from "hono/jwt";
import { generateId, generateSalt, hashPassword } from "../crypto.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";
import type { Env, UserRow } from "../types.js";

const auth = new Hono<{ Bindings: Env }>();

auth.post("/register", async (c) => {
	const { username, password } = await c.req.json<{
		username: string;
		password: string;
	}>();

	if (!username || !password) {
		return c.json({ error: "Username and password required" }, 400);
	}
	if (username.length < 3 || username.length > 50) {
		return c.json({ error: "Username must be 3-50 characters" }, 400);
	}
	if (password.length < 12) {
		return c.json({ error: "Password must be at least 12 characters" }, 400);
	}
	if (!/\d/.test(password)) {
		return c.json({ error: "Password must contain at least one number" }, 400);
	}
	if (!/[^a-zA-Z0-9]/.test(password)) {
		return c.json(
			{ error: "Password must contain at least one special character" },
			400,
		);
	}

	const existing = await c.env.lavender_db
		.prepare("SELECT id FROM users WHERE username = ?")
		.bind(username)
		.first();
	if (existing) {
		return c.json({ error: "Username already taken" }, 409);
	}

	const id = generateId();
	const salt = generateSalt();
	const passwordHash = await hashPassword(password, salt);

	await c.env.lavender_db
		.prepare(
			"INSERT INTO users (id, username, password_hash, salt) VALUES (?, ?, ?, ?)",
		)
		.bind(id, username, passwordHash, salt)
		.run();

	// Create default settings
	await c.env.lavender_db
		.prepare("INSERT INTO user_settings (user_id) VALUES (?)")
		.bind(id)
		.run();

	const token = await sign({ sub: id, username }, c.env.JWT_SECRET);
	return c.json({ token, username }, 201);
});

auth.post("/login", async (c) => {
	const { username, password } = await c.req.json<{
		username: string;
		password: string;
	}>();

	if (!username || !password) {
		return c.json({ error: "Username and password required" }, 400);
	}

	const user = await c.env.lavender_db
		.prepare("SELECT * FROM users WHERE username = ?")
		.bind(username)
		.first<UserRow>();

	if (!user) {
		return c.json({ error: "Invalid credentials" }, 401);
	}

	const passwordHash = await hashPassword(password, user.salt);
	if (passwordHash !== user.password_hash) {
		return c.json({ error: "Invalid credentials" }, 401);
	}

	const token = await sign({ sub: user.id, username }, c.env.JWT_SECRET);
	return c.json({ token, username });
});

auth.put("/password", authMiddleware(), async (c) => {
	const userId = getUserId(c);
	const { oldPassword, newPassword, reEncryptedEntries } = await c.req.json<{
		oldPassword: string;
		newPassword: string;
		reEncryptedEntries: Array<{
			id: string;
			encryptedData: string;
			iv: string;
		}>;
	}>();

	if (!oldPassword || !newPassword) {
		return c.json({ error: "Old and new passwords required" }, 400);
	}
	if (newPassword.length < 12) {
		return c.json({ error: "Password must be at least 12 characters" }, 400);
	}
	if (!/\d/.test(newPassword)) {
		return c.json({ error: "Password must contain at least one number" }, 400);
	}
	if (!/[^a-zA-Z0-9]/.test(newPassword)) {
		return c.json(
			{ error: "Password must contain at least one special character" },
			400,
		);
	}

	const user = await c.env.lavender_db
		.prepare("SELECT * FROM users WHERE id = ?")
		.bind(userId)
		.first<UserRow>();

	if (!user) {
		return c.json({ error: "User not found" }, 404);
	}

	const oldHash = await hashPassword(oldPassword, user.salt);
	if (oldHash !== user.password_hash) {
		return c.json({ error: "Current password is incorrect" }, 401);
	}

	const newSalt = generateSalt();
	const newHash = await hashPassword(newPassword, newSalt);

	// Update password and re-encrypted entries atomically in a batch
	const statements = [
		c.env.lavender_db
			.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?")
			.bind(newHash, newSalt, userId),
	];

	if (reEncryptedEntries?.length) {
		for (const entry of reEncryptedEntries) {
			statements.push(
				c.env.lavender_db
					.prepare(
						"UPDATE health_entries SET encrypted_data = ?, iv = ? WHERE id = ? AND user_id = ?",
					)
					.bind(entry.encryptedData, entry.iv, entry.id, userId),
			);
		}
	}

	await c.env.lavender_db.batch(statements);

	// Return new token so the client stays authenticated
	const token = await sign(
		{ sub: user.id, username: user.username },
		c.env.JWT_SECRET,
	);
	return c.json({ token, username: user.username });
});

auth.delete("/account", authMiddleware(), async (c) => {
	const userId = getUserId(c);

	// CASCADE will handle related records
	await c.env.lavender_db
		.prepare("DELETE FROM users WHERE id = ?")
		.bind(userId)
		.run();

	return c.json({ message: "Account deleted" });
});

export { auth };
