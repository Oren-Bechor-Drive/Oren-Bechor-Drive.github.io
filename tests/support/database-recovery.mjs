import { createHash } from "node:crypto";
import { withOwnedDatabase } from "./database.mjs";

const format = "oren-local-fixture-data";
const version = 1;
const initialized = new WeakSet();
const quote = value => `"${value.replaceAll('"', '""')}"`;
const relationName = relation => `${quote(relation.schema)}.${quote(relation.name)}`;
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function catalog(client) {
	const relations = (await client.query(`
		select n.nspname as schema, c.relname as name,
			json_agg(json_build_object('name', a.attname, 'type', pg_catalog.format_type(a.atttypid,a.atttypmod),
				'nullable', not a.attnotnull, 'default', pg_catalog.pg_get_expr(d.adbin,d.adrelid),
				'identity', a.attidentity, 'generated', a.attgenerated) order by a.attnum) as columns
		from pg_catalog.pg_class c
		join pg_catalog.pg_namespace n on n.oid=c.relnamespace
		join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
		left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
		where n.nspname in ('auth','public','private') and c.relkind='r'
		group by n.nspname,c.relname order by n.nspname,c.relname`)).rows;
	const foreignKeys = (await client.query(`
		select fk.conname as name, child_ns.nspname as "childSchema", child.relname as "childTable",
			parent_ns.nspname as "parentSchema", parent.relname as "parentTable", fk.confmatchtype as match,
			json_agg(json_build_object('child', ca.attname, 'parent', pa.attname,
				'operatorSchema', op_ns.nspname, 'operator', op.oprname) order by position.i) as pairs
		from pg_catalog.pg_constraint fk
		join pg_catalog.pg_class child on child.oid=fk.conrelid
		join pg_catalog.pg_namespace child_ns on child_ns.oid=child.relnamespace
		join pg_catalog.pg_class parent on parent.oid=fk.confrelid
		join pg_catalog.pg_namespace parent_ns on parent_ns.oid=parent.relnamespace
		cross join lateral generate_subscripts(fk.conkey,1) position(i)
		join pg_catalog.pg_attribute ca on ca.attrelid=child.oid and ca.attnum=fk.conkey[position.i]
		join pg_catalog.pg_attribute pa on pa.attrelid=parent.oid and pa.attnum=fk.confkey[position.i]
		join pg_catalog.pg_operator op on op.oid=fk.conpfeqop[position.i]
		join pg_catalog.pg_namespace op_ns on op_ns.oid=op.oprnamespace
		where fk.contype='f' and child_ns.nspname in ('auth','public','private')
		group by fk.oid,child_ns.nspname,child.relname,parent_ns.nspname,parent.relname
		order by child_ns.nspname,child.relname,fk.conname`)).rows;
	if (!relations.length || relations.some(relation => relation.columns.some(column => column.identity || column.generated))) {
		throw new Error("Unsupported fixture schema manifest");
	}
	for (const fk of foreignKeys) {
		if (!['s','f'].includes(fk.match) || !relations.some(relation => relation.schema === fk.parentSchema && relation.name === fk.parentTable)) {
			throw new Error("Unsupported fixture foreign key manifest");
		}
	}
	return { relations, foreignKeys };
}

async function rows(client, relation) {
	// Return PostgreSQL's JSON text unchanged. Parsing a row in JavaScript would
	// round bigint values before they ever reached the restore connection.
	return (await client.query(`select pg_catalog.row_to_json(row)::text as row_text from ${relationName(relation)} row`))
		.rows.map(row => row.row_text).sort();
}
async function transaction(client, sql, operation) {
	await client.query(sql);
	try {
		await client.query("set local timezone='UTC'; set local datestyle='ISO, YMD'");
		const result = await operation();
		await client.query("commit");
		return result;
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
}

async function verifyForeignKeys(client, foreignKeys) {
	for (const fk of foreignKeys) {
		const child = relationName({ schema: fk.childSchema, name: fk.childTable });
		const parent = relationName({ schema: fk.parentSchema, name: fk.parentTable });
		const notNull = fk.pairs.map(pair => `child.${quote(pair.child)} is not null`).join(" and ");
		const anyNotNull = fk.pairs.map(pair => `child.${quote(pair.child)} is not null`).join(" or ");
		const join = fk.pairs.map(pair => {
			if (!/^[~!@#%^&|`?+*/<>=:-]+$/.test(pair.operator)) throw new Error("Unsupported foreign key operator");
			return `parent.${quote(pair.parent)} operator(${quote(pair.operatorSchema)}.${pair.operator}) child.${quote(pair.child)}`;
		}).join(" and ");
		const orphan = `not exists (select 1 from ${parent} parent where ${join})`;
		// MATCH SIMPLE exempts any null. MATCH FULL exempts all-null only and
		// rejects a partially null composite key even when other values match.
		const invalid = fk.match === "s" ? `(${notNull}) and ${orphan}` : `(${anyNotNull}) and (not (${notNull}) or ${orphan})`;
		if ((await client.query(`select 1 from ${child} child where ${invalid} limit 1`)).rowCount) {
			throw new Error(`Foreign key validation failed: ${fk.childSchema}.${fk.childTable}.${fk.name}`);
		}
	}
}

// startDatabase is the only registration owner. Calling this with a URL, client,
// clone or closed fixture fails the ownership check before touching a database.
export async function createFixtureRecovery(database) {
	if (!database || typeof database !== "object") throw new Error("Recovery requires a startDatabase-owned fixture");
	if (initialized.has(database)) throw new Error("Fixture recovery is already initialized");
	initialized.add(database);
	const initial = await withOwnedDatabase(database, (client, migrationManifest) => transaction(client,
		"begin isolation level repeatable read read only", async () => {
			const schema = await catalog(client);
			const baseline = [];
			for (const relation of schema.relations) baseline.push(await rows(client, relation));
			return { schema, baseline, migrationManifest: structuredClone(migrationManifest) };
		}));
	return {
		async dumpData() {
			return withOwnedDatabase(database, client => transaction(client,
				"begin isolation level repeatable read read only", async () => {
					const schema = await catalog(client);
					if (!equal(schema, initial.schema)) throw new Error("Fixture schema manifest changed");
					const relations = [];
					for (const relation of schema.relations) relations.push({ ...relation, rows: await rows(client, relation) });
					return new TextEncoder().encode(JSON.stringify({ format, version, ...initial.migrationManifest,
						schemaSha256: hash(schema), foreignKeys: schema.foreignKeys, relations }));
				}));
		},
		async restoreData(bytes) {
			return withOwnedDatabase(database, client => transaction(client, "begin", async () => {
				if (!(bytes instanceof Uint8Array)) throw new Error("Fixture archive must be bytes");
				const archive = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
				if (archive.format !== format || archive.version !== version) throw new Error("Unsupported fixture archive format");
				if (!equal(archive.migrations, initial.migrationManifest.migrations) || archive.bootstrapSha256 !== initial.migrationManifest.bootstrapSha256) {
					throw new Error("Fixture migration manifest mismatch");
				}
				const schema = await catalog(client);
				if (!equal(schema, initial.schema)) throw new Error("Target schema manifest mismatch");
				const archivedSchema = { relations: archive.relations?.map(({ schema, name, columns }) => ({ schema, name, columns })), foreignKeys: archive.foreignKeys };
				if (!equal(archivedSchema, schema) || archive.schemaSha256 !== hash(schema)) throw new Error("Archive schema manifest mismatch");
				await client.query(`lock table ${schema.relations.map(relationName).join(",")} in access exclusive mode`);
				for (let index = 0; index < schema.relations.length; index++) {
					if (!equal(await rows(client, schema.relations[index]), initial.baseline[index])) throw new Error("Target must be an empty migrated fixture");
				}
				await client.query("set local session_replication_role=replica");
				await client.query(`truncate ${schema.relations.map(relationName).join(",")}`);
				for (let index = 0; index < schema.relations.length; index++) {
					const relation = schema.relations[index], archivedRows = archive.relations[index].rows;
					if (!Array.isArray(archivedRows)) throw new Error("Invalid fixture archive rows");
					const columns = relation.columns.map(column => column.name).sort();
					for (const text of archivedRows) {
						if (typeof text !== "string") throw new Error("Fixture row must be unchanged PostgreSQL JSON text");
						const keys = (await client.query("select array_agg(key order by key collate \"C\") as keys from jsonb_object_keys($1::jsonb) key", [text])).rows[0].keys;
						if (!equal(keys, columns)) throw new Error(`Row column manifest mismatch: ${relation.schema}.${relation.name}`);
						await client.query(`insert into ${relationName(relation)} (${relation.columns.map(column => quote(column.name)).join(",")})
							select ${relation.columns.map(column => quote(column.name)).join(",")} from pg_catalog.jsonb_populate_record(null::${relationName(relation)},$1::jsonb)`, [text]);
					}
				}
				await verifyForeignKeys(client, schema.foreignKeys);
			}));
		},
	};
}
