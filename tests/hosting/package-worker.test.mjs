import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm } from "node:fs/promises";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { packageWorkerAssets } from "../../scripts/package-worker.mjs";

async function fixture(t) {
	const directory = await mkdtemp(path.join(tmpdir(), "oren-package-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = path.join(directory, "source"), output = path.join(directory, "public");
	await mkdir(root);
	async function file(relative, contents = relative) {
		await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
		await writeFile(path.join(root, relative), contents);
	}
	return { root, output, file };
}

test("packages only public file types and directories, preserving bytes", async t => {
	const { root, output, file } = await fixture(t);
	for (const relative of ["index.html", "404.html", "robots.txt", "sitemap.xml", "indexnow-key.txt", "llms.txt", "site.webmanifest", "account/login/index.html", "assets/fonts/site.woff2", "assets/image.png", "css/main.css", "js/main.js", "course/topic/index.html"]) await file(relative);
	for (const relative of [".env", "private-key.txt", "server/secrets.js", "tests/fixture.html", "docs/private.txt", "supabase/schema.sql", "package.json", "assets/private.json", "assets/source.psd", "assets/.secret.txt", "js/main.js.map", "course/.hidden/index.html"]) await file(relative, "SECRET");
	const result = await packageWorkerAssets({ root, output });
	assert.equal(result.files.length, 13);
	assert.equal(await readFile(path.join(output, "indexnow-key.txt"), "utf8"), "indexnow-key.txt");
	await assert.rejects(readFile(path.join(output, "private-key.txt")), { code: "ENOENT" });
	assert.equal(await readFile(path.join(output, "assets/image.png"), "utf8"), "assets/image.png");
	assert.deepEqual((await readdir(output)).sort(), ["404.html", "_headers", "account", "assets", "course", "css", "index.html", "indexnow-key.txt", "js", "llms.txt", "robots.txt", "site.webmanifest", "sitemap.xml"]);
	await assert.rejects(readFile(path.join(output, "assets/private.json")), { code: "ENOENT" });
	await file("js/new.js");
	await rm(path.join(root, "assets/image.png"));
	await packageWorkerAssets({ root, output });
	await assert.rejects(readFile(path.join(output, "assets/image.png")), { code: "ENOENT" });
});

test("rejects symlinks inside public trees without replacing a good package", async t => {
	const { root, output, file } = await fixture(t);
	await file("index.html");
	await file("assets/good.svg");
	await packageWorkerAssets({ root, output });
	await symlink(path.join(root, "index.html"), path.join(root, "assets/leak.html"));
	await assert.rejects(packageWorkerAssets({ root, output }), /symlink/i);
	assert.equal(await readFile(path.join(output, "index.html"), "utf8"), "index.html");
});

test("refuses outputs that overwrite repository source, metadata or public inputs", async t => {
	const { root, file } = await fixture(t);
	await file("index.html");
	for (const relative of ["server/keep.mjs", "docs/keep.md", "tests/keep.mjs", ".git/config", ".worker/keep.txt"]) await file(relative, "keep");
	for (const output of [root, path.dirname(root), ...["assets/release", "server", "docs", "tests", ".git", ".worker"].map(relative => path.join(root, relative))]) {
		await assert.rejects(packageWorkerAssets({ root, output }), /output/i);
	}
	for (const relative of ["server/keep.mjs", "docs/keep.md", "tests/keep.mjs", ".git/config", ".worker/keep.txt"]) assert.equal(await readFile(path.join(root, relative), "utf8"), "keep");
	assert.equal(await readFile(path.join(root, "index.html"), "utf8"), "index.html");
});


test("default output belongs to the supplied source tree and supports repeat packaging", async t => {
	const { root, file } = await fixture(t);
	await file("index.html");
	const output = path.join(root, ".worker/public");
	assert.equal((await packageWorkerAssets({ root })).output, output);
	await file("index.html", "updated");
	await packageWorkerAssets({ root });
	assert.equal(await readFile(path.join(output, "index.html"), "utf8"), "updated");
});

function failRename(t, reject) {
	const rename = fs.rename;
	t.mock.method(fs, "rename", async (source, destination) => {
		if (reject(source, destination)) throw Object.assign(new Error("Injected rename failure"), { code: "EIO" });
		return rename(source, destination);
	});
	syncBuiltinESMExports();
	t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
}

test("a failed replacement restores the previous package and permits retry", async t => {
	const { root, output, file } = await fixture(t);
	await file("index.html", "previous");
	await file("js/obsolete.js", "previous script");
	await packageWorkerAssets({ root, output });
	await file("index.html", "replacement");
	await rm(path.join(root, "js/obsolete.js"));
	let failed = false;
	failRename(t, (source, destination) => {
		if (!failed && destination === output && path.basename(source) !== "previous") {
			failed = true;
			return true;
		}
		return false;
	});
	await assert.rejects(packageWorkerAssets({ root, output }), { code: "EIO" });
	assert.equal(await readFile(path.join(output, "index.html"), "utf8"), "previous");
	assert.equal(await readFile(path.join(output, "js/obsolete.js"), "utf8"), "previous script");
	assert.deepEqual((await readdir(path.dirname(output))).sort(), ["public", "source"]);
	await packageWorkerAssets({ root, output });
	assert.equal(await readFile(path.join(output, "index.html"), "utf8"), "replacement");
	await assert.rejects(readFile(path.join(output, "js/obsolete.js")), { code: "ENOENT" });
});

test("failed installation and restoration retain both trees for explicit recovery", async t => {
	const { root, output, file } = await fixture(t);
	await file("index.html", "previous");
	await packageWorkerAssets({ root, output });
	await file("index.html", "replacement");
	failRename(t, (_source, destination) => destination === output);
	let failure;
	try { await packageWorkerAssets({ root, output }); } catch (error) { failure = error; }
	assert.ok(failure instanceof AggregateError);
	assert.equal(failure.errors.length, 2);
	assert.equal(path.dirname(failure.recoveryDirectory), path.dirname(output));
	assert.match(failure.message, /restor/i);
	assert.equal(await readFile(path.join(failure.recoveryDirectory, "previous/index.html"), "utf8"), "previous");
	assert.equal(await readFile(path.join(failure.recoveryDirectory, "prepared/index.html"), "utf8"), "replacement");
	await assert.rejects(readFile(path.join(output, "index.html")), { code: "ENOENT" });
	t.mock.restoreAll();
	syncBuiltinESMExports();
	await fs.rename(path.join(failure.recoveryDirectory, "previous"), output);
	await rm(failure.recoveryDirectory, { recursive: true });
	await packageWorkerAssets({ root, output });
	assert.equal(await readFile(path.join(output, "index.html"), "utf8"), "replacement");
});

test("failed first installation leaves no partial output or temporary tree", async t => {
	const { root, output, file } = await fixture(t);
	await file("index.html");
	failRename(t, (_source, destination) => destination === output);
	await assert.rejects(packageWorkerAssets({ root, output }), { code: "EIO" });
	await assert.rejects(readFile(path.join(output, "index.html")), { code: "ENOENT" });
	assert.deepEqual(await readdir(path.dirname(output)), ["source"]);
});

test("a failed backup move leaves the previous package in place", async t => {
	const { root, output, file } = await fixture(t);
	await file("index.html", "previous");
	await packageWorkerAssets({ root, output });
	await file("index.html", "replacement");
	failRename(t, source => source === output);
	await assert.rejects(packageWorkerAssets({ root, output }), { code: "EIO" });
	assert.equal(await readFile(path.join(output, "index.html"), "utf8"), "previous");
	assert.deepEqual((await readdir(path.dirname(output))).sort(), ["public", "source"]);
});
