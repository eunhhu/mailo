import { Elysia, t } from "elysia";
import { exchangeCode, getAuthUrl, getUserInfo } from "../auth/google-oauth";
import { createSession, deleteSession, getSession, saveTokens } from "../auth/token-manager";
import { config } from "../config";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
const APP_COOKIE_MAX_AGE = 30 * 60; // 비밀번호 확인 후 30분 내 OAuth 진행

export const authRoutes = new Elysia({ prefix: "/auth" })
	.post(
		"/verify-password",
		({ body, cookie, set }) => {
			if (body.password !== config.appPassword) {
				set.status = 403;
				return { error: "Invalid password" };
			}

			cookie.app_verified.set({
				value: "true",
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/",
				maxAge: APP_COOKIE_MAX_AGE,
			});

			return { success: true };
		},
		{
			body: t.Object({
				password: t.String(),
			}),
		},
	)
	.get("/login", ({ cookie, set }) => {
		if (cookie.app_verified?.value !== "true") {
			set.status = 403;
			return { error: "Password verification required" };
		}

		set.status = 302;
		set.headers["location"] = getAuthUrl();
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

		cookie.app_verified.remove();

		set.status = 302;
		set.headers["location"] = config.baseUrl;
	})
	.post("/logout", async ({ cookie }) => {
		const sessionId = cookie.session_id?.value as string | undefined;
		if (sessionId) {
			await deleteSession(sessionId);
		}

		cookie.session_id.remove();

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
