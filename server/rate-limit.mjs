import { createHmac } from "node:crypto";

export function createDatabaseRateLimit({ url, serviceKey, secret, scope, limit, windowSeconds, fetchImpl = fetch }) {
	const address = new URL(url);
	const key = Buffer.from(secret ?? "", "base64");
	if (address.origin !== url || address.protocol !== "https:" || key.length !== 32 || key.toString("base64") !== secret
		|| !serviceKey || !["requests", "mutations"].includes(scope) || !Number.isInteger(limit) || limit < 1 || limit > 10000
		|| !Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400) throw new Error("Invalid persistent rate-limit configuration.");
	return async clientAddress => {
		if (typeof clientAddress !== "string" || !clientAddress || clientAddress.length > 100) return false;
		const bucketKey = createHmac("sha256", key).update(`rate:${scope}\0${clientAddress}`).digest("hex");
		try {
			const response = await fetchImpl(`${url}/rest/v1/rpc/gateway_rate_limit`, {
				method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
				headers: { apikey: serviceKey, "Content-Type": "application/json", ...(serviceKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceKey}` }) },
				body: JSON.stringify({ p_bucket_key: bucketKey, p_limit: limit, p_window_seconds: windowSeconds }),
			});
			if (!response.ok) { await response.body?.cancel(); throw new Error(); }
			const allowed = await response.json();
			if (typeof allowed !== "boolean") throw new Error();
			return allowed;
		} catch { throw Object.assign(new Error("unavailable"), { status: 503, code: "unavailable" }); }
	};
}
