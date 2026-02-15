import { config } from "../config";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
	"https://www.googleapis.com/auth/gmail.modify",
	"https://www.googleapis.com/auth/gmail.send",
	"https://www.googleapis.com/auth/userinfo.email",
];

export function getAuthUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: config.google.clientId,
		redirect_uri: config.google.redirectUri,
		response_type: "code",
		scope: SCOPES.join(" "),
		access_type: "offline",
		prompt: "consent",
		state,
	});
	return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	token_type: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
	const res = await fetch(GOOGLE_TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: config.google.clientId,
			client_secret: config.google.clientSecret,
			redirect_uri: config.google.redirectUri,
			grant_type: "authorization_code",
		}),
	});

	if (!res.ok) {
		const error = await res.text();
		throw new Error(`Token exchange failed: ${error}`);
	}

	return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
	const res = await fetch(GOOGLE_TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			refresh_token: refreshToken,
			client_id: config.google.clientId,
			client_secret: config.google.clientSecret,
			grant_type: "refresh_token",
		}),
	});

	if (!res.ok) {
		const error = await res.text();
		throw new Error(`Token refresh failed: ${error}`);
	}

	return res.json();
}

export async function getUserInfo(accessToken: string): Promise<{ email: string }> {
	const res = await fetch(GOOGLE_USERINFO_URL, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!res.ok) {
		throw new Error("Failed to get user info");
	}

	return res.json();
}
