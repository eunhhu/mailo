import { Elysia, t } from "elysia";
import { config } from "../config";
import { authMiddleware } from "../auth/middleware";
import { createRateLimiter } from "../auth/rate-limiter";
import { getMessage, listMessages, sendMessage, modifyMessage, trashMessage, untrashMessage, permanentDeleteMessage } from "../gmail/client";

const apiLimiter = createRateLimiter(60, 60_000);

export const messageRoutes = new Elysia({ prefix: "/api/messages" })
	.use(authMiddleware)
	.onBeforeHandle(({ user, set }) => {
		if (!apiLimiter(user.sessionId)) {
			set.status = 429;
			return { error: "Too many requests. Try again later." };
		}
	})
	.get("/", async ({ user, query }) => {
		const messages = await listMessages(
			user.accessToken,
			query.q || undefined,
			query.maxResults ? Number(query.maxResults) : undefined,
		);
		return { messages };
	})
	.get("/:id", async ({ user, params }) => {
		const message = await getMessage(user.accessToken, params.id);
		return { message };
	})
	.post(
		"/send",
		async ({ user, body }) => {
			const from = config.mailFrom || user.email;
			const result = await sendMessage(
				user.accessToken,
				from,
				body.to,
				body.subject,
				body.body,
			);
			return { success: true, ...result };
		},
		{
			body: t.Object({
				to: t.String(),
				subject: t.String(),
				body: t.String(),
			}),
		},
	)
	.post("/:id/archive", async ({ user, params }) => {
		await modifyMessage(user.accessToken, params.id, [], ["INBOX"]);
		return { success: true };
	})
	.post("/:id/trash", async ({ user, params }) => {
		await trashMessage(user.accessToken, params.id);
		return { success: true };
	})
	.post("/:id/untrash", async ({ user, params }) => {
		await untrashMessage(user.accessToken, params.id);
		return { success: true };
	})
	.post("/:id/read", async ({ user, params }) => {
		await modifyMessage(user.accessToken, params.id, [], ["UNREAD"]);
		return { success: true };
	})
	.post("/:id/unread", async ({ user, params }) => {
		await modifyMessage(user.accessToken, params.id, ["UNREAD"], []);
		return { success: true };
	})
	.post("/:id/star", async ({ user, params }) => {
		await modifyMessage(user.accessToken, params.id, ["STARRED"], []);
		return { success: true };
	})
	.post("/:id/unstar", async ({ user, params }) => {
		await modifyMessage(user.accessToken, params.id, [], ["STARRED"]);
		return { success: true };
	})
	.post("/:id/spam", async ({ user, params }) => {
		await modifyMessage(user.accessToken, params.id, ["SPAM"], ["INBOX"]);
		return { success: true };
	})
	.post("/:id/unspam", async ({ user, params }) => {
		await modifyMessage(user.accessToken, params.id, ["INBOX"], ["SPAM"]);
		return { success: true };
	})
	.post("/:id/move-to-inbox", async ({ user, params }) => {
		await modifyMessage(user.accessToken, params.id, ["INBOX"], []);
		return { success: true };
	})
	.post("/:id/delete", async ({ user, params }) => {
		await permanentDeleteMessage(user.accessToken, params.id);
		return { success: true };
	});
