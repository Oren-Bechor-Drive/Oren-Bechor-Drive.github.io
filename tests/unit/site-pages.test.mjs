import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readSitePages } from "../../scripts/site-pages.mjs";

test("authored-page resolution shares directory precedence and preserves explicit file identity", async (t) => {
	const workspace = await mkdtemp(path.join(os.tmpdir(), "site-pages-"));
	t.after(() => rm(workspace, { recursive: true, force: true }));
	const root = path.join(workspace, "site");
	await mkdir(root);
	await writeFile(path.join(workspace, "outside.html"), "outside the site");
	for (const file of [
		"index.htm", "topic/index.html", "topic/index.htm", "other/index.htm",
		"docs/example.html", "assets/logo.svg", "space here.html", "..notes.html",
	]) {
		await mkdir(path.dirname(path.join(root, file)), { recursive: true });
		await writeFile(path.join(root, file), "fixture");
	}
	const site = await readSitePages(root);
	assert.deepEqual(site.pages, [
		"index.htm", "other/index.htm", "space here.html", "topic/index.htm", "topic/index.html",
	]);
	for (const [reference, expected] of [
		["", "index.htm"],
		["topic", "topic/index.html"],
		["topic/", "topic/index.html"],
		["topic/index.htm", "topic/index.htm"],
		["other/", "other/index.htm"],
		["other", "other/index.htm"],
		["other/../topic/", "topic/index.html"],
		["space here.html", "space here.html"],
		["..notes.html", "..notes.html"],
		["assets/logo.svg", "assets/logo.svg"],
		["docs/example.html", "docs/example.html"],
		["topic/index.html/", null],
		["missing/", null],
		["other/index.html", null],
		["../outside.html", null],
	]) {
		assert.deepEqual(await site.resolveFile(reference), {
			file: expected,
			requested: reference || "index.html",
		}, reference);
	}
});
