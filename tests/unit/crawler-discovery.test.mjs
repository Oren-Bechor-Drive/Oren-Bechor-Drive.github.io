import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const canonicalUrl = "https://oren-bechor-drive.github.io/";

test("llms overview points to real public pages and sections", async () => {
	const overview = await read("llms.txt");
	const pages = new Map([["/", new JSDOM(await read("index.html"))]]);
	try {
		assert.match(overview, /^# .+/);
		const links = [
			...overview.matchAll(/\[[^\]]+\]\((https:\/\/[^)]+)\)/g),
		];
		assert.ok(
			links.length > 0,
			"The overview must lead readers to the source page",
		);
		assert.match(
			overview,
			/\[[^\]]+\]\(https:\/\/oren-bechor-drive\.github\.io\/#faq\)/,
		);
		assert.doesNotMatch(overview, /\/help\//);
		for (const [, href] of links) {
			const url = new URL(href);
			assert.equal(url.origin, new URL(canonicalUrl).origin);
			const page = pages.get(url.pathname);
			assert.ok(page, `Unpublished overview page: ${url.pathname}`);
			if (url.hash)
				assert.ok(
					page.window.document.getElementById(url.hash.slice(1)),
					`Missing section: ${url.hash}`,
				);
		}
	} finally {
		for (const page of pages.values()) page.window.close();
	}
});

test("crawler discovery allows public content and advertises the sitemap", async () => {
	assert.ok(existsSync(new URL("robots.txt", root)), "Missing robots.txt");
	const directives = (await read("robots.txt"))
		.split(/\r?\n/)
		.map((line) => line.split("#", 1)[0].trim())
		.filter(Boolean)
		.map((line) => {
			const separator = line.indexOf(":");
			assert.ok(separator > 0, `Invalid robots directive: ${line}`);
			return [
				line.slice(0, separator).toLowerCase(),
				line.slice(separator + 1).trim(),
			];
		});

	assert.ok(
		directives.some(
			([name, value]) => name === "user-agent" && value === "*",
		),
	);
	assert.ok(
		directives.some(([name, value]) => name === "allow" && value === "/"),
	);
	assert.ok(
		!directives.some(([name, value]) => name === "disallow" && value),
		"Public content must remain crawlable",
	);
	assert.deepEqual(
		directives
			.filter(([name]) => name === "sitemap")
			.map(([, value]) => value),
		[`${canonicalUrl}sitemap.xml`],
	);
});

test("sitemap publishes the homepage at its HTML canonical URL", async () => {
	assert.ok(existsSync(new URL("sitemap.xml", root)), "Missing sitemap.xml");
	const sitemap = new JSDOM(await read("sitemap.xml"), {
		contentType: "application/xml",
	});
	const page = new JSDOM(await read("index.html"));
	try {
		const document = sitemap.window.document;
		assert.equal(document.documentElement.localName, "urlset");
		assert.equal(
			document.documentElement.namespaceURI,
			"http://www.sitemaps.org/schemas/sitemap/0.9",
		);
		assert.deepEqual(
			[...document.querySelectorAll("urlset > url > loc")].map((loc) =>
				loc.textContent.trim(),
			),
			[canonicalUrl],
		);
		assert.equal(document.querySelectorAll("urlset > url").length, 1);
		assert.equal(
			page.window.document.querySelector('link[rel="canonical"]')?.href,
			canonicalUrl,
		);
	} finally {
		sitemap.window.close();
		page.window.close();
	}
});
