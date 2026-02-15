import postgres from "postgres";
import { config } from "../src/config";
import { initializeDatabase } from "../src/db/schema";

async function ensureDatabase() {
	const url = new URL(config.databaseUrl);
	const dbName = url.pathname.slice(1);
	url.pathname = "/postgres";

	const adminSql = postgres(url.toString());
	try {
		const result = await adminSql`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
		if (result.length === 0) {
			await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
			console.log(`Database "${dbName}" created.`);
		} else {
			console.log(`Database "${dbName}" already exists.`);
		}
	} finally {
		await adminSql.end();
	}
}

async function main() {
	await ensureDatabase();

	const sql = postgres(config.databaseUrl);
	console.log("Setting up tables...");
	await initializeDatabase(sql);
	console.log("Database setup complete.");
	await sql.end();
}

main().catch((err) => {
	console.error("Database setup failed:", err);
	process.exit(1);
});
