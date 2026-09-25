import { subscriptionOffer } from "./subscription-offer.mjs";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const randomToken = () => randomBytes(32).toString("base64url");
const challengeFor = verifier => createHash("sha256").update(verifier).digest("base64url");
function matches(left, right) {
	if (typeof left !== "string" || typeof right !== "string") return false;
	const a = Buffer.from(left), b = Buffer.from(right);
	return a.length === b.length && timingSafeEqual(a, b);
}

// Local development only. No credentials are persisted to disk.
function createSessions({ now = Date.now, limit = 1000 } = {}) {
	const key = randomBytes(32);
	const records = new Map();
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
		create(mode = "anonymous", tokens = null, user = null, learner = null) {
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
		removeUser(id) { for (const record of records.values()) if (record.user?.id === id) remove(record); },
		async run(record, work) {
			const previous = record.pending;
			let release;
			record.pending = new Promise(resolve => { release = resolve; });
			await previous;
			try {
				if (!live(record)) throw Object.assign(new Error("expired"), { status: 401 });
				return await work();
			} finally { release(); }
		},
	};
}

// All session records and provider credentials remain inside this module.
// Public results contain only response snapshots, destinations and cookie changes.
export function createLearnerAccounts({ origin, provider = null, googleEnabled = false, now = Date.now, sessionLimit = 1000 }) {
	const sessions = createSessions({ now, limit: sessionLimit });
	const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
	const verified = user => user?.id && user.email && user.email_confirmed_at && !user.is_anonymous;
	const destination = redirect => ({ redirect });
	// Reset invalidates even anonymous authentication whose identity is still pending.
	let authenticationGeneration = 0;
	function rotate(old, mode, tokens, user, learner) {
		if (old) sessions.remove(old);
		const issued = sessions.create(mode, tokens, user, learner);
		return { record: issued.record, cookie: { token: issued.token, maxAge: Math.floor((issued.record.expires - now()) / 1000) } };
	}
	const summary = record => ({ csrf: record.csrf, available: Boolean(provider), google: Boolean(provider && googleEnabled),
		recovery: record.mode === "recovery", user: record.mode === "authenticated" ? { email: record.user.email, displayName: record.learner.display_name } : null });
	function canIssue(record, generation) {
		if (!sessions.live(record) || generation !== authenticationGeneration) fail(401, "session_expired");
	}
	async function authenticate(tokens) {
		if (!tokens?.access_token || !tokens.refresh_token || !Number.isFinite(tokens.expires_in)) fail(401, "sign_in_failed");
		const user = await provider.identity(tokens.access_token);
		if (!verified(user)) fail(401, "sign_in_failed");
		await provider.provision(user.id);
		const learner = await provider.learner(tokens.access_token);
		if (!learner) fail(401, "sign_in_failed");
		return { user, learner };
	}
	async function current(record) {
		if (record.mode === "anonymous") return;
		try {
			if (record.tokenExpires <= now() + 30_000) {
				const refreshed = await provider.refresh(record.tokens.refresh_token);
				if (!sessions.live(record)) fail(401, "session_expired");
				record.tokens = refreshed;
				record.tokenExpires = now() + refreshed.expires_in * 1000;
			}
			const user = await provider.identity(record.tokens.access_token);
			if (!verified(user) || user.id !== record.user.id) fail(401, "session_expired");
			if (record.mode === "authenticated") {
				const learner = await provider.learner(record.tokens.access_token);
				if (!learner) fail(401, "session_expired");
				record.learner = learner;
			}
			if (!sessions.live(record)) fail(401, "session_expired");
			record.user = user;
		} catch (error) {
			if (error.status >= 500 || error.status === 429) throw error;
			sessions.remove(record);
			fail(401, "session_expired");
		}
	}
	function startFlow(record, kind) {
		const verifier = randomToken(), state = randomToken();
		const flow = { kind, verifier, state, challenge: challengeFor(verifier), expires: now() + 3600_000,
			redirect: `${origin}/api/account/callback?state=${state}` };
		record.flow = flow;
		return flow;
	}
	async function completeCallback(token, { state, code, error }) {
		const record = sessions.get(token);
		const flow = record?.flow;
		if (!flow || flow.expires <= now() || !matches(flow.state, state)) return destination("/account/login.html?status=link-expired");
		return sessions.run(record, async () => {
			const generation = authenticationGeneration;
			if (record.flow !== flow) return destination("/account/login.html?status=link-expired");
			record.flow = null;
			if (!code || code.length > 2048 || error) return destination("/account/login.html?status=link-expired");
			let tokens;
			try {
				tokens = await provider.exchange(code, flow.verifier);
				if (!sessions.live(record)) fail(401, "session_expired");
				if (flow.kind === "recovery") {
					const user = await provider.identity(tokens.access_token);
					if (!verified(user)) fail(401, "sign_in_failed");
					canIssue(record, generation);
					return { ...destination("/account/reset.html"), cookie: rotate(record, "recovery", tokens, user).cookie };
				}
				const { user, learner } = await authenticate(tokens);
				canIssue(record, generation);
				return { ...destination("/account/"), cookie: rotate(record, "authenticated", tokens, user, learner).cookie };
			} catch {
				if (tokens?.access_token) await provider.logout(tokens.access_token).catch(() => {});
				return destination("/account/login.html?status=link-expired");
			}
		});
	}
	async function session(token) {
		const record = sessions.get(token);
		if (record) {
			try {
				return await sessions.run(record, async () => {
					await current(record);
					return { data: summary(record) };
				});
			} catch (error) { if (error.status !== 401) throw error; }
		}
		const issued = rotate(null, "anonymous");
		return { data: summary(issued.record), cookie: issued.cookie };
	}
	async function perform(token, route, body) {
		const record = sessions.get(token);
		if (!record) fail(401, "session_expired");
		return sessions.run(record, async () => {
			if (route === "login") {
				const generation = authenticationGeneration;
				const tokens = await provider.password(body.email, body.password);
				try {
					const { user, learner } = await authenticate(tokens);
					canIssue(record, generation);
					const issued = rotate(record, "authenticated", tokens, user, learner);
					return { data: summary(issued.record), cookie: issued.cookie };
				} catch (error) { await provider.logout(tokens.access_token).catch(() => {}); throw error; }
			}
			if (route === "register" || route === "recover") {
				const flow = startFlow(record, route === "recover" ? "recovery" : "signup");
				try {
					if (route === "register") {
						const result = await provider.signup(body.email, body.password, flow);
						// This application requires verification, even if the project was misconfigured.
						if (result?.access_token) await provider.logout(result.access_token).catch(() => {});
					} else await provider.recover(body.email, flow);
				} catch (error) {
					if (!["user_already_exists", "email_exists", "user_not_found"].includes(error.code)) throw error;
				}
				return { data: { ok: true } };
			}
			if (route === "google") {
				if (!googleEnabled) fail(503, "google_unavailable");
				return { data: { url: provider.google(startFlow(record, "google")) } };
			}
			if (route === "logout") {
				const token = record.tokens?.access_token;
				sessions.remove(record);
				if (token) await provider.logout(token, "local").catch(() => {});
				return { data: { ok: true }, cookie: { token: "", maxAge: 0 } };
			}
			if (route === "reset") {
				if (record.mode !== "recovery") fail(403, "recovery_required");
				await current(record);
				const { access_token: token } = record.tokens;
				const userId = record.user.id;
				await provider.updatePassword(token, body.password);
				sessions.removeUser(userId);
				authenticationGeneration++;
				let otherSessionsSignedOut = true;
				try { await provider.logout(token, "global"); }
				catch { otherSessionsSignedOut = false; }
				return { data: { ok: true, otherSessionsSignedOut }, cookie: { token: "", maxAge: 0 } };
			}
		});
	}
	async function withLearnerSession(token, work) {
		const record = sessions.get(token);
		if (!record || record.mode !== "authenticated") fail(401, "session_expired");
		return sessions.run(record, async () => {
			await current(record);
			const result = await work(record.tokens.access_token, record.csrf);
			if (!sessions.live(record)) fail(401, "session_expired");
			return result;
		});
	}
	const positionData = row => row ? { contentVersionId: row.content_version_id, position: row.position, revision: Number(row.revision) } : null;
	function readSection(token, sectionId, accessLevel) {
		return withLearnerSession(token, async (accessToken, csrf) => {
			const position = positionData(await provider.readPosition(accessToken, sectionId, accessLevel));
			const row = await provider.readSection(accessToken, sectionId, accessLevel);
			if (!row) fail(404, "lesson_unavailable");
			return { data: { lesson: { id: row.id, sectionId: row.section_id, accessLevel: row.access_level,
				revision: row.revision, body: row.body_text }, position, csrf } };
		});
	}
	function saveSectionPosition(token, sectionId, accessLevel, input) {
		return withLearnerSession(token, async accessToken => {
			try {
				return { data: { position: positionData(await provider.savePosition(accessToken, sectionId, accessLevel, input)) } };
			} catch (error) {
				if (error.code === "42501") fail(404, "lesson_unavailable");
				if (error.code !== "40001") throw error;
				return { status: 409, data: { error: "position_conflict",
					position: positionData(await provider.readPosition(accessToken, sectionId, accessLevel)) } };
			}
		});
	}
	return {
		session,
		authorizeMedia(token, { sectionId, contentVersionId }) {
			return withLearnerSession(token, async accessToken => {
				const section = await provider.readSection(accessToken, sectionId, "paid");
				if (!section || section.id !== contentVersionId) fail(404, "learning_unavailable");
			});
		},
		learning(token, operation, ...args) {
			const operations = ["myLearning", "startQuiz", "readAttempt", "saveQuiz", "submitQuiz", "quizHistory", "completeTopic", "readSections"];
			if (!operations.includes(operation)) fail(404, "not_found");
			return withLearnerSession(token, async (accessToken, csrf) => {
				try { return { data: { ...await provider[operation](accessToken, ...args), csrf, ...(operation === "myLearning" ? { subscriptionOffer } : {}) } }; }
				catch (error) {
					if (error.code === "42501") fail(404, "learning_unavailable");
					if (error.code === "22023") fail(400, "invalid_input");
					if (error.code === "40001") fail(409, "quiz_conflict");
					throw error;
				}
			});
		},
		readSection,
		saveSectionPosition,
		acceptsRequest(token, csrf) { return matches(sessions.get(token)?.csrf, csrf); },
		completeCallback,
		perform,
	};
}
