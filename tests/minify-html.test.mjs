import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { JSDOM } from "jsdom";

const run = promisify(execFile);

test("HTML minification preserves word boundaries, literal whitespace, SVG and metadata", async (t) => {
	const cwd = await mkdtemp(path.join(os.tmpdir(), "minify-page-"));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	const original = `<!doctype html>
<html lang="he" dir="rtl">
	<head>
		<title>קורס נהיגה נכונה</title>
		<script type="module" src="js/script.js"></script>
	</head>
	<body>
		<p><span>נהיגה</span>
			<strong>נכונה</strong> עם אורן</p>
		<pre>one  two\n\tthree</pre>
		<textarea>one  two\nthree</textarea>
		<img src="icon.png" alt="" data-road-media="car" />
		<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M 0 0 L 10 10" /></svg>
	</body>
</html>`;
	await writeFile(path.join(cwd, "index.html"), original);
	const minify = () => run(process.execPath, [fileURLToPath(new URL("../scripts/minify-html.mjs", import.meta.url))], { cwd });
	await minify();
	const result = await readFile(path.join(cwd, "index.html"), "utf8");
	assert.ok(Buffer.byteLength(result) < Buffer.byteLength(original));
	const before = new JSDOM(original);
	const after = new JSDOM(result);
	t.after(() => { before.window.close(); after.window.close(); });
	for (const selector of ["pre", "textarea", "title", "script", "img", "svg"])
		assert.equal(after.window.document.querySelector(selector).outerHTML, before.window.document.querySelector(selector).outerHTML);
	assert.equal(after.window.document.querySelector("p").textContent.trim(), "נהיגה נכונה עם אורן");
	assert.equal(after.window.document.documentElement.lang, "he");
	assert.equal(after.window.document.documentElement.dir, "rtl");
	await minify();
	assert.equal(await readFile(path.join(cwd, "index.html"), "utf8"), result);
});
