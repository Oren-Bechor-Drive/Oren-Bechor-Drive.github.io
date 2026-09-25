import { createHmac, randomBytes } from "node:crypto";
const randomToken = () => randomBytes(32).toString("base64url");

// Local development only. No credentials are persisted to disk.
export function createMemorySessions({ now = Date.now, limit = 1000 } = {}) {
	const key = randomBytes(32);
	const records = new Map();
	let authenticationGeneration = 0;
	const hash = token => createHmac("sha256", key).update(token).digest("hex");
	function remove(record) {
		record.active = false;
		record.tokens = null;
		record.flow = null;
		record.user = null;
		record.learner = null;
		records.delete(record.storageKey);
	}
	function live(record) {
		if (!record?.active) return false;
		if (record.expires <= now()) { remove(record); return false; }
		return true;
	}
	return {
		generation() { return authenticationGeneration; },
		beginReset(record) { return record.user.id; },
		finishReset(record, userId) {
			for (const session of records.values()) if (session.user?.id === userId) remove(session);
			authenticationGeneration++;
		},
		rotate(old, mode = "anonymous", tokens = null, user = null, learner = null) {
			if (old) {
				if (!live(old) || old.generation !== authenticationGeneration) throw Object.assign(new Error("expired"), { status: 401 });
				remove(old);
			}
			for (const record of records.values()) live(record);
			if (records.size >= limit) throw Object.assign(new Error("capacity"), { status: 503 });
			const token = randomToken();
			const record = { active: true, storageKey: hash(token), csrf: randomToken(), mode, tokens, user, learner,
				expires: now() + (mode === "recovery" ? 600_000 : mode === "authenticated" ? 43_200_000 : 3600_000),
				tokenExpires: now() + (tokens?.expires_in ?? 0) * 1000, pending: Promise.resolve(), flow: null };
			records.set(record.storageKey, record);
			return { token, record };
		},
		get(token) {
			if (!/^[\w-]{43}$/.test(token ?? "")) return null;
			const record = records.get(hash(token));
			return live(record) ? record : null;
		},
		live, remove,
		async run(record, work) {
			const previous = record.pending;
			let release;
			record.pending = new Promise(resolve => { release = resolve; });
			await previous;
			try {
				if (!live(record)) throw Object.assign(new Error("expired"), { status: 401 });
				record.generation = authenticationGeneration;
				return await work();
			} finally { release(); }
		},
	};
}
