function required(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

export const config = {
	databaseUrl: required("DATABASE_URL"),
	appPassword: required("APP_PASSWORD"),
	google: {
		clientId: required("GOOGLE_CLIENT_ID"),
		clientSecret: required("GOOGLE_CLIENT_SECRET"),
		redirectUri: required("GOOGLE_REDIRECT_URI"),
	},
	sessionSecret: required("SESSION_SECRET"),
	port: Number(process.env.PORT || "8380"),
	host: process.env.HOST || "0.0.0.0",
	baseUrl: required("BASE_URL"),
};
