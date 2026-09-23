import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const root = new URL("../../", import.meta.url);

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
	const directory = await mkdtemp(path.join(tmpdir(), "oren-database-test-"));
	const logs = [];
	const postgres = new EmbeddedPostgres({
		databaseDir: path.join(directory, "data"),
		user: "postgres", password: randomBytes(24).toString("hex"),
		port: await availablePort(), persistent: false,
		postgresFlags: ["-h", "127.0.0.1", "-k", directory],
		onLog: (message) => logs.push(String(message)),
		onError: (message) => logs.push(String(message)),
	});
	const connections = new Set();
	async function connect() {
		const client = postgres.getPgClient();
		await client.connect();
		connections.add(client);
		client.once("end", () => connections.delete(client));
		return client;
	}
	async function close() {
		await Promise.allSettled([...connections].map((client) => client.end()));
		try { await postgres.stop(); }
		finally { await rm(directory, { recursive: true, force: true }); }
	}
	try {
		await postgres.initialise();
		await postgres.start();
		const admin = await connect();
		await admin.query(await readFile(new URL("supabase/tests/database/auth-bootstrap.sql", root), "utf8"));
		const migrationDirectory = new URL("supabase/migrations/", root);
		for (const file of (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort()) {
			await admin.query(await readFile(new URL(file, migrationDirectory), "utf8"));
		}
		return { admin, connect, close };
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
