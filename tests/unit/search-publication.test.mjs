import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";
import { searchInventory, sitemapXml } from "../../scripts/search-discovery.mjs";
import { checkProduction, notifyIndexNow } from "../../scripts/search-production.mjs";

const origin = "https://oren-bechor-drive.github.io";
const root = new URL("../../", import.meta.url);

test("ownership verification is present in the initial homepage head", async () => {
	const dom = new JSDOM(await readFile(new URL("index.html", root), "utf8"));
	try {
		const tags = dom.window.document.head.querySelectorAll('meta[name="google-site-verification"]');
		assert.equal(tags.length, 1);
		assert.match(tags[0].content, /^[A-Za-z0-9_-]{20,}$/);
	} finally { dom.window.close(); }
});

test("sitemap generation excludes previews, redirects and errors and rejects invalid canonicals", async (t) => {
	const dir = await mkdtemp(path.join(os.tmpdir(), "search-publication-"));
	t.after(() => rm(dir, { recursive: true, force: true }));
	const page = (head) => `<html lang="he" dir="rtl"><head><title>כותרת</title><meta name="description" content="תיאור">${head}</head><body><h1>כותרת</h1></body></html>`;
	await mkdir(path.join(dir, "course"));
	await writeFile(path.join(dir, "index.html"), page(`<link rel="canonical" href="${origin}/">`));
	await writeFile(path.join(dir, "course/index.html"), page('<meta name="robots" content="noindex">'));
	await writeFile(path.join(dir, "404.html"), page('<meta name="robots" content="noindex">'));
	await writeFile(path.join(dir, "old.html"), page('<meta http-equiv="refresh" content="0;url=/">'));
	assert.deepEqual((await searchInventory(dir)).filter(p => p.indexable).map(p => p.url), [`${origin}/`]);
	assert.match(sitemapXml(await searchInventory(dir)), /<loc>https:\/\/oren-bechor-drive.github.io\/<\/loc>/);
	await writeFile(path.join(dir, "reindex.html"), page(`<link rel="canonical" href="${origin}/reindex.html">`));
	assert.deepEqual((await searchInventory(dir)).filter(p => p.indexable).map(p => p.url), [`${origin}/`, `${origin}/reindex.html`]);
	for (const canonical of ["", `${origin}/#faq`, "https://example.com/", `${origin}/wrong/`, `${origin}/?page=1`]) {
		await writeFile(path.join(dir, "index.html"), page(canonical ? `<link rel="canonical" href="${canonical}">` : ""));
		await assert.rejects(searchInventory(dir), /index.html.*canonical/i);
	}
});

test("checked-in sitemap matches the indexable HTML inventory", async () => {
	const pages = await searchInventory(root);
	assert.deepEqual(pages.filter(p => p.indexable).map(p => p.url), [`${origin}/`]);
	assert.equal(await readFile(new URL("sitemap.xml", root), "utf8"), sitemapXml(pages));
});

// HTTP is the external seam. Responses use the actual publication files; tests
// mutate a deployed response to prove the gate prevents submitting stale/private URLs.
async function deployedFetch(url, options = {}) {
	const parsed = new URL(url);
	if (parsed.protocol === "http:") return new Response(null, { status: 301, headers: { location: `${origin}/` } });
	let file = parsed.pathname.slice(1) || "index.html";
	if (file.endsWith("/")) file += "index.html";
	let status = 200;
	let body;
	try { body = await readFile(new URL(file, root)); }
	catch { body = await readFile(new URL("404.html", root)); status = 404; }
	return new Response(body, { status, headers: { "content-type": file.endsWith(".html") ? "text/html" : file.endsWith(".xml") ? "application/xml" : file.endsWith(".jpg") ? "image/jpeg" : "text/plain" } });
}

test("production gate verifies deployed HTML, verification values, crawler files, previews and real 404s", async () => {
	const result = await checkProduction({ rootDir: root, fetchImpl: deployedFetch });
	assert.deepEqual(result.urls, [`${origin}/`]);
	for (const [target, mutation] of [
		["/", (body) => body.replace(/<meta name="google-site-verification"[^>]+>/, "")],
		["/", (body) => body.replace("</head>", '<meta name="robots" content="noindex"></head>')],
		["/course/", (body) => body.replace(/noindex/g, "index")],
		["/sitemap.xml", (body) => body.replace(`${origin}/</loc>`, `${origin}/course/</loc>`)],
		["/robots.txt", () => "User-agent: *\nDisallow: /"],
	]) {
		await assert.rejects(checkProduction({ rootDir: root, fetchImpl: async (url, options) => {
			const r = await deployedFetch(url, options);
			return new URL(url).pathname === target ? new Response(mutation(await r.text()), { status: r.status, headers: r.headers }) : r;
		} }), /deployed|index|sitemap|robots|verification/i);
	}
	await assert.rejects(checkProduction({ rootDir: root, fetchImpl: async (url, options) => {
		const r = await deployedFetch(url, options);
		return r.status === 404 ? new Response(await r.text(), { headers: r.headers }) : r;
	} }), /404/);
});

test("IndexNow sends only verified sitemap URLs and distinguishes receipt from pending validation", async () => {
	for (const status of [200, 202, 403, 429]) {
		const requests = [];
		const run = () => notifyIndexNow({ rootDir: root, fetchImpl: async (url, options) => {
			if (url === "https://api.indexnow.org/indexnow") {
				requests.push(JSON.parse(options.body));
				assert.equal(options.method, "POST");
				return new Response(null, { status });
			}
			return deployedFetch(url, options);
		} });
		if (status < 300) {
			const result = await run();
			assert.equal(result.status, status);
			assert.equal(result.validationPending, status === 202);
		} else await assert.rejects(run, new RegExp(String(status)));
		assert.equal(requests.length, 1);
		assert.deepEqual(requests[0].urlList, [`${origin}/`]);
		assert.equal(requests[0].host, "oren-bechor-drive.github.io");
		assert.equal(requests[0].keyLocation, `${origin}/indexnow-key.txt`);
	}
	let submitted = false;
	await assert.rejects(notifyIndexNow({ rootDir: root, fetchImpl: async (url, options) => {
		if (url === "https://api.indexnow.org/indexnow") submitted = true;
		if (url === `${origin}/indexnow-key.txt`) return new Response("stale-key");
		return deployedFetch(url, options);
	} }), /key/);
	assert.equal(submitted, false);
});
