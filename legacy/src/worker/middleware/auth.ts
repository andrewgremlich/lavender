import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { jwt } from "hono/jwt";
import type { Env } from "../types.js";

export function authMiddleware() {
	return async (c: Context<{ Bindings: Env }>, next: Next) => {
		const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET, alg: "HS256" });
		return jwtMiddleware(c, next);
	};
}

export function getUserId(c: Context): string {
	const payload = c.get("jwtPayload") as { sub?: string } | undefined;

	if (!payload?.sub) {
		throw new HTTPException(401, { message: "Unauthorized" });
	}

	return payload.sub;
}
