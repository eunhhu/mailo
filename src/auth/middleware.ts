import { Elysia } from "elysia";
import { getSession, getValidAccessToken } from "./token-manager";

export const authMiddleware = new Elysia({ name: "auth-middleware" }).derive(
	{ as: "scoped" },
	async ({ cookie, set }) => {
		const sessionId = cookie.session_id?.value as string | undefined;

		if (!sessionId) {
			set.status = 401;
			throw new Error("Unauthorized");
		}

		const session = await getSession(sessionId);
		if (!session) {
			set.status = 401;
			throw new Error("Session expired");
		}

		const accessToken = await getValidAccessToken(session.user_email);
		if (!accessToken) {
			set.status = 401;
			throw new Error("Invalid access token");
		}

		return {
			user: {
				email: session.user_email,
				accessToken,
				sessionId: session.id,
			},
		};
	},
);
