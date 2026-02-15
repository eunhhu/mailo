interface RateLimitEntry {
	count: number;
	resetAt: number;
}

export function createRateLimiter(maxRequests: number, windowMs: number) {
	const store = new Map<string, RateLimitEntry>();

	const timer = setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (entry.resetAt <= now) store.delete(key);
		}
	}, windowMs);
	if (typeof timer === "object" && "unref" in timer) timer.unref();

	return function check(key: string): boolean {
		const now = Date.now();
		const entry = store.get(key);
		if (!entry || entry.resetAt <= now) {
			store.set(key, { count: 1, resetAt: now + windowMs });
			return true;
		}
		entry.count++;
		return entry.count <= maxRequests;
	};
}
