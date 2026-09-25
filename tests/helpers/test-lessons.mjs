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
	async function asLearner(token, query, values = [], save = false) {
		const user = await provider.identity(token);
		return connected(async client => {
			await client.query("begin");
			try {
				await actAs(client, user.id, sessions.get(token));
				const rows = (await client.query(query, values)).rows;
				await client.query(save ? "commit" : "rollback");
				return rows;
			} catch (error) { await client.query("rollback"); throw error; }
		});
	}
	provider.provision = id => connected(client => client.query("select public.provision_learner($1)", [id]));
	provider.learner = async token => (await asLearner(token, "select id,display_name from public.learners"))[0] ?? null;
	provider.readSection = async (token, id, level) => (await asLearner(token, "select * from public.read_section($1,$2)", [id, level]))[0] ?? null;
	provider.readPosition = async (token, id, level) => (await asLearner(token,
		"select content_version_id,position,revision from public.section_progress where section_id=$1 and access_level=$2", [id, level]))[0] ?? null;
	provider.savePosition = async (token, id, level, input) => (await asLearner(token,
		"select * from public.save_my_position($1,$2,$3,$4,$5)", [id, level, input.contentVersionId, input.position, input.expectedRevision], true))[0];
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
			async expire(email, elapsedDays = 0) {
				if (!Number.isSafeInteger(elapsedDays) || elapsedDays < 0) throw new Error("Supply nonnegative elapsed days");
				const id = await existingIdentity(email);
				// Move only this fixture's period. Database statement time still enforces access.
				const result = await connected(client => client.query(`
					update public.entitlements
					set starts_at = least(starts_at, statement_timestamp() - ($2 * interval '1 day') - interval '1 second'),
						ends_at = statement_timestamp() - ($2 * interval '1 day')
					where source = 'development' and source_reference = $1 and revoked_at is null
				`, [`test-lessons:${id}`, elapsedDays]));
				if (result.rowCount !== 1) throw new Error(`No unrevoked test grant for ${email}`);
			},
			close,
		};
	} catch (error) { await close(); throw error; }
}
