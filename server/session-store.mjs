import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomUUID } from "node:crypto";

const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const randomToken = () => randomBytes(32).toString("base64url");

// Credentials and PKCE state are encrypted before leaving this process. The
// database owns liveness, operation leases and atomic replacement/revocation.
export function createSupabaseSessions({ url, serviceKey, secret, fetchImpl = fetch, now = Date.now, limit = 1000 }) {
	if (typeof secret !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(secret) || Buffer.from(secret, "base64").length !== 32) throw new Error("SESSION_SECRET must be a base64-encoded 32-byte random secret");
	if (!Number.isSafeInteger(limit) || limit < 2 || limit > 10000) throw new Error("Session capacity must be between 2 and 10000");
	const base = new URL(url).origin;
	const master = Buffer.from(secret, "base64");
	const encryptionKey = Buffer.from(hkdfSync("sha256", master, "oren-gateway", "session-encryption-v1", 32));
	const lookupKey = Buffer.from(hkdfSync("sha256", master, "oren-gateway", "session-lookup-v1", 32));
	const hash = (kind, value) => createHmac("sha256", lookupKey).update(`${kind}:${value}`).digest("hex");
	function seal(record) {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
		cipher.setAAD(Buffer.from(record.storageKey));
		const { csrf, mode, tokens, user, learner, expires, tokenExpires, flow } = record;
		const encrypted = Buffer.concat([cipher.update(JSON.stringify({ csrf, mode, tokens, user, learner, expires, tokenExpires, flow })), cipher.final()]);
		return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
	}
	function open(storageKey, value) {
		try {
			const bytes = Buffer.from(value.payload, "base64");
			const decipher = createDecipheriv("aes-256-gcm", encryptionKey, bytes.subarray(0, 12));
			decipher.setAAD(Buffer.from(storageKey));
			decipher.setAuthTag(bytes.subarray(12, 28));
			const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
			return { ...data, storageKey, active: true };
		} catch { fail(503, "session_storage_unavailable"); }
	}
	async function rpc(action, key = null, lease = null, data = {}) {
		const headers = { apikey: serviceKey, "content-type": "application/json" };
		if (!serviceKey.startsWith("sb_secret_")) headers.authorization = `Bearer ${serviceKey}`;
		let response, result;
		try {
			response = await fetchImpl(`${base}/rest/v1/rpc/gateway_session`, { method: "POST", headers, redirect: "error", signal: AbortSignal.timeout(5000),
				body: JSON.stringify({ p_action: action, p_key: key, p_lease: lease, p_data: data }) });
			result = await response.json();
		} catch { fail(503, "session_storage_unavailable"); }
		if (!response.ok) fail(503, "session_storage_unavailable");
		if (result?.status === "expired") fail(401, "session_expired");
		if (result?.status === "capacity" || result?.status === "reset_pending") fail(503, "session_storage_unavailable");
		return result;
	}
	function issue(mode = "anonymous", tokens = null, user = null, learner = null) {
		const token = randomToken();
		return { token, record: { active: true, storageKey: hash("session", token), csrf: randomToken(), mode, tokens, user, learner,
			expires: now() + (mode === "recovery" ? 600_000 : mode === "authenticated" ? 43_200_000 : 3600_000),
			tokenExpires: now() + (tokens?.expires_in ?? 0) * 1000, flow: null } };
	}
	const encoded = record => ({ payload: seal(record), expires: new Date(record.expires).toISOString(), mode: record.mode,
		user_key: record.user ? hash("user", record.user.id) : null });
	const sessions = {
		async generation() { return (await rpc("generation")).generation; },
		async rotate(old, mode, tokens, user, learner) {
			const issued = issue(mode, tokens, user, learner);
			if (!old) await rpc("create", issued.record.storageKey, null, { ...encoded(issued.record), limit });
			else {
				if (!old.active || old.cancelled || !old.lease) fail(401, "session_expired");
				// Publish replacement only when run() commits under the same lease.
				old.replacement = issued.record;
			}
			return issued;
		},
		async get(token) {
			if (!/^[\w-]{43}$/.test(token ?? "")) return null;
			const key = hash("session", token);
			const result = await rpc("get", key);
			return result ? open(key, result) : null;
		},
		async live(record) {
			if (!record?.active || record.cancelled) return false;
			const result = await rpc("live", record.storageKey, record.lease);
			return result.live;
		},
		async remove(record) {
			record.active = false;
			await rpc("remove", record.storageKey, record.lease);
		},
		async beginReset(record) {
			await rpc("begin_reset", record.storageKey, record.lease, { user_key: hash("user", record.user.id) });
		},
		async finishReset(record) {
			// A completed external password update must revoke even if its lease
			// expired while the provider was processing it. It cannot issue data.
			await rpc("finish_reset", record.storageKey, record.lease, { user_key: hash("user", record.user.id) });
			record.active = false;
		},
		async run(record, work) {
			const lease = randomUUID();
			const waitUntil = performance.now() + 2000;
			let acquired;
			do {
				acquired = await rpc("acquire", record.storageKey, lease);
				if (acquired.status !== "busy") break;
				if (performance.now() >= waitUntil) fail(503, "session_busy");
				await new Promise(resolve => setTimeout(resolve, 25));
			} while (true);
			Object.assign(record, open(record.storageKey, acquired), { lease, generation: acquired.generation });
			let timer, result, failure;
			try {
				result = await Promise.race([work(), new Promise((_, reject) => {
					timer = setTimeout(() => { record.cancelled = true; reject(Object.assign(new Error("session_operation_timeout"), { status: 503 })); }, 25000);
				})]);
			} catch (error) { failure = error; }
			finally { clearTimeout(timer); }
			if (record.cancelled) {
				await sessions.remove(record).catch(() => {});
				throw failure;
			}
			if (record.active) {
				const replacement = !failure && record.replacement;
				const data = replacement ? { ...encoded(replacement), key: replacement.storageKey, generation: record.generation } : encoded(record);
				await rpc(replacement ? "rotate" : "save", record.storageKey, lease, data);
			}
			if (failure) throw failure;
			return result;
		},
	};
	return sessions;
}
