import { Elysia } from "elysia";
import { exchangeCode, getAuthUrl, getUserInfo } from "../auth/google-oauth";
import { createSession, deleteSession, getSession, saveTokens } from "../auth/token-manager";
import { config } from "../config";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export const authRoutes = new Elysia({ prefix: "/auth" })
	.get("/login", ({ set }) => {
		set.redirect = getAuthUrl();
	})
	.get("/callback", async ({ query, cookie, set }) => {
		const code = query.code;
		if (!code) {
			set.status = 400;
			return { error: "Missing authorization code" };
		}

		const tokens = await exchangeCode(code);
		const userInfo = await getUserInfo(tokens.access_token);

		await saveTokens(userInfo.email, tokens);
		const sessionId = await createSession(userInfo.email);

		cookie.session_id.set({
			value: sessionId,
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
			maxAge: COOKIE_MAX_AGE,
		});

		set.redirect = config.baseUrl;
	})
	.post("/logout", async ({ cookie, set }) => {
		const sessionId = cookie.session_id?.value as string | undefined;
		if (sessionId) {
			await deleteSession(sessionId);
		}

		cookie.session_id.remove();

		set.status = 200;
		return { success: true };
	})
	.get("/me", async ({ cookie, set }) => {
		const sessionId = cookie.session_id?.value as string | undefined;
		if (!sessionId) {
			set.status = 401;
			return { error: "Not authenticated" };
		}

		const session = await getSession(sessionId);
		if (!session) {
			set.status = 401;
			return { error: "Session expired" };
		}

		return { email: session.user_email };
	});
