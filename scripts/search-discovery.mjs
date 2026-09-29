import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { discoverSitePages } from "./site-pages.mjs";

export const siteOrigin = "https://oren-bechor-drive.github.io";

export function inspectSearchHtml(html) {
	const dom = new JSDOM(html);
	try {
		const document = dom.window.document;
		const meta = (name) => [...document.head.querySelectorAll(`meta[name="${name}"], meta[property="${name}"]`)].map(node => node.content);
		const robots = ["robots", "googlebot", "bingbot"].flatMap(meta).join(",");
		return {
			title: document.title,
			description: meta("description"),
			canonical: [...document.head.querySelectorAll('link[rel="canonical"]')].map(node => node.getAttribute("href")),
			noindex: /\b(noindex|none)\b/i.test(robots),
			redirect: !!document.head.querySelector('meta[http-equiv="refresh" i]'),
			verification: Object.fromEntries(["google-site-verification", "msvalidate.01"].map(name => [name, meta(name)])),
			sharing: Object.fromEntries(["og:title", "og:description", "og:url", "og:image", "twitter:card", "twitter:title", "twitter:description", "twitter:image"].map(name => [name, meta(name)])),
		};
	} finally { dom.window.close(); }
}

export async function searchInventory(rootDir) {
	const root = rootDir instanceof URL ? fileURLToPath(rootDir) : rootDir;
	const pages = [];
	for (const file of await discoverSitePages(root)) {
		const html = await readFile(path.join(root, file), "utf8");
		const metadata = inspectSearchHtml(html);
		assert.ok(metadata.title.trim(), `${file}: missing title`);
		assert.ok(metadata.description.length === 1 && metadata.description[0].trim(), `${file}: missing or duplicate description`);
		const url = `${siteOrigin}/${file.replace(/(^|\/)index\.html?$/i, "$1")}`;
		const indexable = !metadata.noindex && !metadata.redirect && file !== "404.html";
		if (indexable) assert.deepEqual(metadata.canonical, [url], `${file}: canonical must match its absolute public URL without queries or fragments`);
		pages.push({ file, url, indexable, metadata });
	}
	return pages;
}

export function sitemapXml(pages) {
	const urls = pages.filter(page => page.indexable).map(page => page.url).sort();
	const escape = value => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
	return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(url => `  <url>\n    <loc>${escape(url)}</loc>\n  </url>\n`).join("") + "</urlset>\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const xml = sitemapXml(await searchInventory(process.cwd()));
	if (process.argv.includes("--check")) {
		assert.equal(await readFile("sitemap.xml", "utf8"), xml, "Run npm run generate:sitemap and commit sitemap.xml");
		console.log("Sitemap matches the canonical, indexable HTML pages.");
	} else {
		await writeFile("sitemap.xml", xml);
		console.log("Generated sitemap.xml from canonical, indexable HTML pages.");
	}
}
