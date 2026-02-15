import { Elysia, t } from "elysia";
import { randomUUID } from "crypto";
import { exchangeCode, getAuthUrl, getUserInfo } from "../auth/google-oauth";
import { createSession, deleteSession, getSession, saveTokens } from "../auth/token-manager";
import { config } from "../config";
import { createRateLimiter } from "../auth/rate-limiter";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
const passwordLimiter = createRateLimiter(5, 60_000);
const APP_COOKIE_MAX_AGE = 30 * 60; // 비밀번호 확인 후 30분 내 OAuth 진행

export const authRoutes = new Elysia({ prefix: "/auth" })
	.post(
		"/verify-password",
		({ body, cookie, set, request }) => {
			const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
				|| request.headers.get("x-real-ip")
				|| "unknown";
			if (!passwordLimiter(ip)) {
				set.status = 429;
				return { error: "Too many attempts. Try again later." };
			}

			if (body.password !== config.appPassword) {
				set.status = 403;
				return { error: "Invalid password" };
			}

			cookie.app_verified.set({
				value: "true",
				httpOnly: true,
				secure: config.isSecure,
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

		const state = randomUUID();
		cookie.oauth_state.set({
			value: state,
			httpOnly: true,
			secure: config.isSecure,
			sameSite: "lax",
			path: "/",
			maxAge: 600,
		});

		set.status = 302;
		set.headers["location"] = getAuthUrl(state);
	})
	.get("/callback", async ({ query, cookie, set }) => {
		const code = query.code;
		if (!code) {
			set.status = 400;
			return { error: "Missing authorization code" };
		}

		const state = query.state;
		const storedState = cookie.oauth_state?.value as string | undefined;
		if (!state || !storedState || state !== storedState) {
			set.status = 403;
			return { error: "Invalid OAuth state" };
		}
		cookie.oauth_state.remove();

		const tokens = await exchangeCode(code);
		const userInfo = await getUserInfo(tokens.access_token);

		await saveTokens(userInfo.email, tokens);
		const sessionId = await createSession(userInfo.email);

		cookie.session_id.set({
			value: sessionId,
			httpOnly: true,
			secure: config.isSecure,
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
