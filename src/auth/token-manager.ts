import { sql } from "../db/client";
import { refreshAccessToken } from "./google-oauth";

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

	await sql`
		INSERT INTO oauth_tokens (user_email, access_token, refresh_token, expires_at, updated_at)
		VALUES (${email}, ${tokens.access_token}, ${tokens.refresh_token ?? null}, ${expiresAt}, NOW())
		ON CONFLICT (user_email) DO UPDATE SET
			access_token = ${tokens.access_token},
			refresh_token = COALESCE(${tokens.refresh_token ?? null}, oauth_tokens.refresh_token),
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

	return {
		access_token: rows[0].access_token,
		refresh_token: rows[0].refresh_token,
		expires_at: new Date(rows[0].expires_at),
	};
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
