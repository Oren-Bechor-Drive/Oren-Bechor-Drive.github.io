import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inlineStyles } from "../scripts/inline-styles.mjs";

test("inlining preserves cascade order, rebases asset URLs and detects stale CSS", async (t) => {
	const rootDir = await mkdtemp(path.join(os.tmpdir(), "inline-styles-"));
	t.after(() => rm(rootDir, { recursive: true, force: true }));
	await mkdir(path.join(rootDir, "css"));
	const files = {
		"base": 'body { color: red; } .font { src: url("https://fonts.gstatic.com/font.woff2"); }',
		"components": 'body { color: blue; } .icon { background: url(/root.svg); filter: url(#filter); }',
		"welcome": '.road { background: url("../assets/images/road.jpg?v=2#part"); }',
		"responsive": '@media (max-width: 768px) { body { color: green; } }',
	};
	for (const [name, css] of Object.entries(files))
		await writeFile(path.join(rootDir, `css/${name}.css`), css);
	const htmlPath = path.join(rootDir, "index.html");
	await writeFile(htmlPath, '<html lang="he" dir="rtl"><head><style data-site-styles></style></head><body>תוכן</body></html>');
	await assert.rejects(inlineStyles({ rootDir, check: true }), /stale/);
	await inlineStyles({ rootDir });
	const html = await readFile(htmlPath, "utf8");
	assert.ok(html.indexOf("color: red") < html.indexOf("color: blue"));
	assert.ok(html.indexOf("color: blue") < html.indexOf("color: green"));
	assert.ok(html.includes('url("assets/images/road.jpg?v=2#part")'));
	assert.ok(html.includes('url("https://fonts.gstatic.com/font.woff2")'));
	assert.ok(html.includes("url(/root.svg)"));
	assert.ok(html.includes("url(#filter)"));
	assert.ok(html.includes("<body>תוכן</body>"));
	await inlineStyles({ rootDir, check: true });
	await inlineStyles({ rootDir });
	assert.equal(await readFile(htmlPath, "utf8"), html);
	await writeFile(path.join(rootDir, "css/base.css"), "body { color: black; }");
	await assert.rejects(inlineStyles({ rootDir, check: true }), /stale/);
	assert.equal(await readFile(htmlPath, "utf8"), html, "checking must not change the page");
});
