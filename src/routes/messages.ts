import { Elysia, t } from "elysia";
import { authMiddleware } from "../auth/middleware";
import { getMessage, listMessages, sendMessage } from "../gmail/client";

export const messageRoutes = new Elysia({ prefix: "/api/messages" })
	.use(authMiddleware)
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
			const result = await sendMessage(
				user.accessToken,
				user.email,
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
	);
