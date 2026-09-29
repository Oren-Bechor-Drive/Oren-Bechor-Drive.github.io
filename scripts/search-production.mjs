import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectSearchHtml, searchInventory, siteOrigin, sitemapXml } from "./search-discovery.mjs";

export async function checkProduction({ rootDir = process.cwd(), fetchImpl = fetch } = {}) {
	const root = rootDir instanceof URL ? fileURLToPath(rootDir) : rootDir;
	const pages = await searchInventory(root);
	async function get(url, status = 200, type = null) {
		const response = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(30_000), headers: { "Cache-Control": "no-cache" } });
		assert.equal(response.status, status, `${url}: expected ${status}, got ${response.status}`);
		if (type) assert.ok(response.headers.get("content-type")?.includes(type), `${url}: incorrect content type`);
		return response;
	}
	const redirect = await get(siteOrigin.replace("https:", "http:") + "/", 301);
	assert.equal(redirect.headers.get("location"), `${siteOrigin}/`, "HTTP must redirect to the HTTPS homepage");
	for (const file of ["robots.txt", "sitemap.xml"]) {
		const response = await get(`${siteOrigin}/${file}`, 200, file.endsWith(".xml") ? "xml" : "text/plain");
		const expected = file === "sitemap.xml" ? sitemapXml(pages) : await readFile(path.join(root, file), "utf8");
		assert.equal(await response.text(), expected, `${file}: deployed content differs from this revision`);
	}
	const robots = await readFile(path.join(root, "robots.txt"), "utf8");
	assert.match(robots, /User-agent:\s*\*/i, "robots: missing general crawler group");
	assert.doesNotMatch(robots, /^Disallow:\s*\S+/im, "robots: public crawling must stay allowed");
	assert.ok(robots.includes(`Sitemap: ${siteOrigin}/sitemap.xml`), "robots: missing sitemap");
	for (const page of pages) {
		const response = await get(page.url, 200, "text/html");
		const html = await response.text();
		const metadata = inspectSearchHtml(html);
		assert.deepEqual(metadata, page.metadata, `${page.url}: deployed metadata or verification differs from this revision`);
		if (page.indexable) {
			assert.doesNotMatch(response.headers.get("x-robots-tag") || "", /\b(noindex|none)\b/i, `${page.url}: indexing blocked by HTTP header`);
			assert.equal(html, await readFile(path.join(root, page.file), "utf8"), `${page.url}: deployed HTML differs from this revision`);
			for (const name of ["og:image", "twitter:image"]) {
				assert.equal(metadata.sharing[name].length, 1, `${page.url}: missing sharing image`);
				const image = new URL(metadata.sharing[name][0]);
				assert.equal(image.origin, siteOrigin, "Sharing image must use the canonical HTTPS origin");
				await (await get(image.href, 200, "image/")).arrayBuffer();
			}
		}
	}
	for (const missing of ["/search-check-missing-7b970d/", "/search-check-missing-7b970d/nested/page.html"]) {
		const response = await get(`${siteOrigin}${missing}`, 404, "text/html");
		assert.ok(inspectSearchHtml(await response.text()).noindex, "404 response must discourage indexing");
	}
	return { urls: pages.filter(page => page.indexable).map(page => page.url), pages: pages.length };
}

export async function notifyIndexNow({ rootDir = process.cwd(), fetchImpl = fetch } = {}) {
	const result = await checkProduction({ rootDir, fetchImpl });
	const root = rootDir instanceof URL ? fileURLToPath(rootDir) : rootDir;
	const key = (await readFile(path.join(root, "indexnow-key.txt"), "utf8")).trim();
	assert.match(key, /^[a-zA-Z0-9-]{8,128}$/, "Invalid IndexNow key");
	const keyLocation = `${siteOrigin}/indexnow-key.txt`;
	const deployedKey = await fetchImpl(keyLocation, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
	assert.equal(deployedKey.status, 200, "IndexNow key must be deployed before notification");
	assert.equal((await deployedKey.text()).trim(), key, "Deployed IndexNow key differs from this revision");
	assert.ok(result.urls.length > 0 && result.urls.length <= 10_000, "IndexNow requires 1 to 10000 URLs per batch");
	const response = await fetchImpl("https://api.indexnow.org/indexnow", {
		method: "POST",
		headers: { "Content-Type": "application/json; charset=utf-8" },
		body: JSON.stringify({ host: new URL(siteOrigin).host, key, keyLocation, urlList: result.urls }),
		signal: AbortSignal.timeout(30_000),
	});
	assert.ok([200, 202].includes(response.status), `IndexNow returned HTTP ${response.status}`);
	return { ...result, status: response.status, validationPending: response.status === 202 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const notify = process.argv.includes("--notify");
	const result = await (notify ? notifyIndexNow() : checkProduction());
	console.log(JSON.stringify(result, null, 2));
	console.log(notify ? `IndexNow received the URLs${result.validationPending ? "; key validation is pending" : ""}. This does not establish crawling or indexing.` : "Production responses match this revision. Search engine indexing has not been checked.");
}
