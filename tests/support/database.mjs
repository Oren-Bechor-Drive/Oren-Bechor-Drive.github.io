import EmbeddedPostgres from "embedded-postgres";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFixtureRecovery } from "./database-recovery.mjs";

const root = new URL("../../", import.meta.url);
const ownedDatabases = new WeakMap();

// Fixture adapters receive a capability for this exact database, never connection settings.
export async function withOwnedDatabase(database, operation) {
	const owned = ownedDatabases.get(database);
	if (!owned) throw new Error("Database operation requires a startDatabase-owned fixture");
	if (owned.closed()) throw new Error("Database fixture is closed");
	const client = await owned.connect();
	try {
		const address = (await client.query("select host(inet_server_addr()) as address")).rows[0].address;
		if (address !== "127.0.0.1") throw new Error("Database operation requires an owned loopback database");
		return await operation(client, structuredClone(owned.manifest));
	} finally { await client.end(); }
}

async function availablePort() {
	const server = createServer();
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const { port } = server.address();
	await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	return port;
}

// A disposable native Postgres process. This helper never connects to a remote URL.
export async function startDatabase() {
	if (arguments.length) throw new Error("startDatabase accepts no arguments or external configuration");
	const directory = await mkdtemp(path.join(tmpdir(), "oren-database-test-"));
	const logs = [];
	const connections = new Set();
	let postgres, closed = false, closing;
	async function connect() {
		if (closed) throw new Error("Database fixture is closed");
		const client = postgres.getPgClient("postgres", "127.0.0.1");
		await client.connect();
		connections.add(client);
		client.once("end", () => connections.delete(client));
		return client;
	}
	async function close() {
		if (closing) return closing;
		closed = true;
		closing = (async () => {
			await Promise.allSettled([...connections].map((client) => client.end()));
			try { await postgres?.stop(); }
			finally { await rm(directory, { recursive: true, force: true }); }
		})();
		return closing;
	}
	try {
		postgres = new EmbeddedPostgres({
			databaseDir: path.join(directory, "data"),
			user: "postgres", password: randomBytes(24).toString("hex"),
			port: await availablePort(), persistent: false,
			postgresFlags: ["-h", "127.0.0.1", "-k", directory],
			onLog: (message) => logs.push(String(message)),
			onError: (message) => logs.push(String(message)),
		});
		await postgres.initialise();
		await postgres.start();
		const admin = await connect();
		const bootstrap = await readFile(new URL("supabase/tests/database/auth-bootstrap.sql", root), "utf8");
		await admin.query(bootstrap);
		const migrationDirectory = new URL("supabase/migrations/", root);
		const migrations = [];
		for (const file of (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort()) {
			const sql = await readFile(new URL(file, migrationDirectory), "utf8");
			await admin.query(sql);
			migrations.push({ file, sha256: createHash("sha256").update(sql).digest("hex") });
		}
		const database = { admin, connect, close };
		ownedDatabases.set(database, { connect, closed: () => closed,
			manifest: { migrations, bootstrapSha256: createHash("sha256").update(bootstrap).digest("hex") } });
		Object.assign(database, await createFixtureRecovery(database));
		return database;
	} catch (error) {
		await close().catch(() => {});
		throw new Error(`${error.message ?? error}\n${logs.slice(-12).join("")}`, { cause: error });
	}
}

export async function actAs(client, userId, sessionId, role = "authenticated") {
	if (!["authenticated", "anon", "service_role"].includes(role)) throw new Error("Invalid fixture role");
	await client.query(`set local role ${role}`);
	await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({
		sub: userId, session_id: sessionId, role,
	})]);
}
