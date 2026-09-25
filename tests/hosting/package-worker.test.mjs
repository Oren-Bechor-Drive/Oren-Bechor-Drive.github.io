import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm } from "node:fs/promises";
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
	for (const relative of ["index.html", "404.html", "robots.txt", "sitemap.xml", "llms.txt", "site.webmanifest", "account/login/index.html", "assets/fonts/site.woff2", "assets/image.png", "css/main.css", "js/main.js", "course/topic/index.html"]) await file(relative);
	for (const relative of [".env", "server/secrets.js", "tests/fixture.html", "docs/private.txt", "supabase/schema.sql", "package.json", "assets/private.json", "assets/source.psd", "assets/.secret.txt", "js/main.js.map", "course/.hidden/index.html"]) await file(relative, "SECRET");
	const result = await packageWorkerAssets({ root, output });
	assert.equal(result.files.length, 12);
	assert.equal(await readFile(path.join(output, "assets/image.png"), "utf8"), "assets/image.png");
	assert.deepEqual((await readdir(output)).sort(), ["404.html", "_headers", "account", "assets", "course", "css", "index.html", "js", "llms.txt", "robots.txt", "site.webmanifest", "sitemap.xml"]);
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
