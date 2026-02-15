import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { sql } from "../db/client";
import { config } from "../config";
import { refreshAccessToken } from "./google-oauth";

function deriveKey(secret: string): Buffer {
	return createHash("sha256").update(secret).digest();
}

function encrypt(text: string, secret: string): string {
	const key = deriveKey(secret);
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(data: string, secret: string): string {
	const key = deriveKey(secret);
	const buf = Buffer.from(data, "base64");
	const iv = buf.subarray(0, 12);
	const tag = buf.subarray(12, 28);
	const encrypted = buf.subarray(28);
	const decipher = createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAuthTag(tag);
	return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}

interface StoredTokens {
	access_token: string;
	refresh_token: string | null;
	expires_at: Date;
}

export async function saveTokens(
	email: string,
	tokens: { access_token: string; refresh_token?: string; expires_in: number },
): Promise<void> {
	const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
	const secret = config.sessionSecret;
	const encAccessToken = encrypt(tokens.access_token, secret);
	const encRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token, secret) : null;

	await sql`
		INSERT INTO oauth_tokens (user_email, access_token, refresh_token, expires_at, updated_at)
		VALUES (${email}, ${encAccessToken}, ${encRefreshToken}, ${expiresAt}, NOW())
		ON CONFLICT (user_email) DO UPDATE SET
			access_token = ${encAccessToken},
			refresh_token = COALESCE(${encRefreshToken}, oauth_tokens.refresh_token),
			expires_at = ${expiresAt},
			updated_at = NOW()
	`;
}

export async function getTokens(email: string): Promise<StoredTokens | null> {
	const rows = await sql`
		SELECT access_token, refresh_token, expires_at
		FROM oauth_tokens
		WHERE user_email = ${email}
	`;

	if (rows.length === 0) return null;

	const secret = config.sessionSecret;
	try {
		return {
			access_token: decrypt(rows[0].access_token, secret),
			refresh_token: rows[0].refresh_token ? decrypt(rows[0].refresh_token, secret) : null,
			expires_at: new Date(rows[0].expires_at),
		};
	} catch {
		// 토큰 복호화 실패 - SESSION_SECRET 변경 등으로 기존 토큰이 무효화됨
		await sql`DELETE FROM oauth_tokens WHERE user_email = ${email}`;
		return null;
	}
}

export async function getValidAccessToken(email: string): Promise<string | null> {
	const tokens = await getTokens(email);
	if (!tokens) return null;

	const bufferMs = 60 * 1000;
	if (tokens.expires_at.getTime() - bufferMs > Date.now()) {
		return tokens.access_token;
	}

	if (!tokens.refresh_token) return null;

	const refreshed = await refreshAccessToken(tokens.refresh_token);
	await saveTokens(email, refreshed);
	return refreshed.access_token;
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(email: string): Promise<string> {
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

	const rows = await sql`
		INSERT INTO sessions (user_email, expires_at)
		VALUES (${email}, ${expiresAt})
		RETURNING id
	`;

	return rows[0].id;
}

interface Session {
	id: string;
	user_email: string;
	expires_at: Date;
}

export async function getSession(sessionId: string): Promise<Session | null> {
	const rows = await sql`
		SELECT id, user_email, expires_at
		FROM sessions
		WHERE id = ${sessionId}
	`;

	if (rows.length === 0) return null;

	const session: Session = {
		id: rows[0].id,
		user_email: rows[0].user_email,
		expires_at: new Date(rows[0].expires_at),
	};

	if (session.expires_at.getTime() < Date.now()) {
		await deleteSession(sessionId);
		return null;
	}

	return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
	await sql`
		DELETE FROM sessions WHERE id = ${sessionId}
	`;
}
