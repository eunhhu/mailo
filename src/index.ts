import { join } from "node:path";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { config } from "./config";
import { sql } from "./db/client";
import { initializeDatabase } from "./db/schema";
import { authRoutes } from "./routes/auth";
import { messageRoutes } from "./routes/messages";

await initializeDatabase(sql);

const DIST_DIR = join(process.cwd(), "frontend", "dist");

const app = new Elysia()
	.use(
		cors({
			origin: config.baseUrl,
			credentials: true,
		}),
	)
	.use(authRoutes)
	.use(messageRoutes)
	.get("/assets/*", ({ params }) => {
		return Bun.file(join(DIST_DIR, "assets", params["*"]));
	})
	.get("/*", () => Bun.file(join(DIST_DIR, "index.html")))
	.onError(({ error, set }) => {
		const message = "message" in error ? error.message : String(error);
		if (
			message === "Unauthorized" ||
			message === "Session expired" ||
			message === "Invalid access token"
		) {
			set.status = 401;
			return { error: message };
		}
		console.error("Server error:", error);
		set.status = 500;
		return { error: "Internal server error" };
	})
	.listen({
		port: config.port,
		hostname: config.host,
	});

console.log(`Mailo server running at http://${config.host}:${config.port}`);

export type App = typeof app;
