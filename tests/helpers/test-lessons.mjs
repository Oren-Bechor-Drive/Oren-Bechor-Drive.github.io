import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { accountProvider, startAccountGateway } from "./account-gateway.mjs";
import { startDatabase, actAs } from "../support/database.mjs";

// Owns deterministic Auth and its disposable PostgreSQL roles, RLS and learner RPCs.
export async function startLessonGateway() {
	const database = await startDatabase();
	const identities = new Map();
	const sessions = new Map();
	let app;
	let closing;
	function close() {
		closing ??= (async () => {
			try { await app?.close(); }
			finally { await database.close(); }
		})();
		return closing;
	}
	async function connected(action) {
		const client = await database.connect();
		try { return await action(client); }
		finally { await client.end(); }
	}
	function identityFor(email) {
		if (!identities.has(email)) {
			// Register the promise before awaiting so simultaneous logins reuse one user.
			const identity = connected(async client => {
				const id = randomUUID();
				await client.query("insert into auth.users(id,email_confirmed_at,is_anonymous) values ($1,now(),false)", [id]);
				return id;
			}).catch(error => { identities.delete(email); throw error; });
			identities.set(email, identity);
		}
		return identities.get(email);
	}
	function existingIdentity(email) {
		if (!identities.has(email)) throw new Error(`No signed-in test learner for ${email}`);
		return identities.get(email);
	}
	const provider = accountProvider({
		async createSessionUser(email, token) {
			const id = await identityFor(email);
			const sessionId = randomUUID();
			await connected(client => client.query("insert into auth.sessions(id,user_id) values ($1,$2)", [sessionId, id]));
			sessions.set(token, sessionId);
			return { id, email, email_confirmed_at: "2026-01-01", is_anonymous: false };
		},
	});
	async function asLearner(token, query, values = []) {
		const user = await provider.identity(token);
		return connected(async client => {
			await client.query("begin");
			try {
				await actAs(client, user.id, sessions.get(token));
				return (await client.query(query, values)).rows;
			} finally { await client.query("rollback"); }
		});
	}
	provider.provision = id => connected(client => client.query("select public.provision_learner($1)", [id]));
	provider.learner = async token => (await asLearner(token, "select id,display_name from public.learners"))[0] ?? null;
	provider.readSection = async (token, id, level) => (await asLearner(token, "select * from public.read_section($1,$2)", [id, level]))[0] ?? null;
	try {
		const seed = await readFile(new URL("../../supabase/development/test-lessons.sql", import.meta.url), "utf8");
		const grant = await readFile(new URL("../../supabase/development/grant-test-access.sql", import.meta.url), "utf8");
		await connected(client => client.query(seed));
		app = await startAccountGateway({ provider });
		return {
			origin: app.origin,
			async grant(email, until = new Date(Date.now() + 3_600_000).toISOString()) {
				const id = await existingIdentity(email);
				await connected(async client => {
					try {
						await client.query("select set_config('oren.test_auth_user_id',$1,false),set_config('oren.test_access_until',$2,false)", [id, until]);
						await client.query(grant);
					} catch (error) { await client.query("rollback"); throw error; }
				});
			},
			async revoke(email) {
				const id = await existingIdentity(email);
				await connected(client => client.query("update public.entitlements set revoked_at=now() where source_reference=$1", [`test-lessons:${id}`]));
			},
			close,
		};
	} catch (error) { await close(); throw error; }
}
