import type { Sql } from "postgres";

export async function initializeDatabase(sql: Sql) {
	await sql`
		CREATE TABLE IF NOT EXISTS oauth_tokens (
			id SERIAL PRIMARY KEY,
			user_email TEXT NOT NULL UNIQUE,
			access_token TEXT NOT NULL,
			refresh_token TEXT,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

	await sql`
		CREATE TABLE IF NOT EXISTS sessions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_email TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			expires_at TIMESTAMPTZ NOT NULL
		)
	`;

	await sql`
		CREATE INDEX IF NOT EXISTS idx_sessions_user_email ON sessions (user_email)
	`;

	await sql`
		CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_email ON oauth_tokens (user_email)
	`;
}
