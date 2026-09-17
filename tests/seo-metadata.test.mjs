import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";
import { inspectImage } from "../scripts/road-media-integrity.mjs";

const siteUrl = "https://oren-bechor.github.io/";
const document = new JSDOM(
	await readFile(new URL("../index.html", import.meta.url), "utf8"),
	{ url: siteUrl },
).window.document;

function meta(key) {
	const nodes = document.head.querySelectorAll(`meta[name="${key}"], meta[property="${key}"]`);
	assert.equal(nodes.length, 1, `${key} must have one unambiguous value`);
	assert.ok(nodes[0].content.trim(), `${key} must not be empty`);
	return nodes[0].content;
}

test("search and share metadata agree on the public page and Hebrew description", () => {
	const canonical = document.head.querySelectorAll('link[rel="canonical"]');
	assert.equal(canonical.length, 1);
	assert.equal(canonical[0].href, siteUrl);
	assert.equal(meta("og:url"), siteUrl);
	assert.equal(meta("og:type"), "website");
	assert.equal(meta("og:locale"), "he_IL");
	assert.equal(meta("og:title"), document.title);
	assert.equal(meta("twitter:title"), document.title);
	assert.equal(meta("og:description"), meta("description"));
	assert.equal(meta("twitter:description"), meta("description"));
	assert.match(document.title, /\p{Script=Hebrew}/u);
	assert.match(meta("description"), /\p{Script=Hebrew}/u);
});

test("share image URLs resolve to a supplied image with accurate dimensions and MIME type", async () => {
	const imageUrl = new URL(meta("og:image"));
	assert.equal(imageUrl.origin, new URL(siteUrl).origin);
	assert.equal(meta("twitter:image"), imageUrl.href);
	assert.equal(meta("twitter:image:alt"), meta("og:image:alt"));
	assert.match(meta("og:image:alt"), /\p{Script=Hebrew}/u);
	assert.equal(meta("twitter:card"), "summary");
	const bytes = await readFile(new URL(`..${imageUrl.pathname}`, import.meta.url));
	const image = inspectImage(bytes);
	assert.equal(Number(meta("og:image:width")), image.width);
	assert.equal(Number(meta("og:image:height")), image.height);
	assert.equal(meta("og:image:type"), `image/${image.format === "jpg" ? "jpeg" : image.format}`);
});

test("structured data links the page, website, course and visible instructor", () => {
	const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
	assert.equal(scripts.length, 1, "structured data must be available in baseline HTML");
	const data = JSON.parse(scripts[0].textContent);
	assert.equal(data["@context"], "https://schema.org");
	const entities = new Map(data["@graph"].map(entity => [entity["@id"], entity]));
	assert.equal(entities.size, data["@graph"].length, "entity IDs must be unique");
	const byType = type => {
		const matches = [...entities.values()].filter(entity => entity["@type"] === type);
		assert.equal(matches.length, 1, `missing or ambiguous ${type}`);
		return matches[0];
	};
	const site = byType("WebSite");
	const page = byType("WebPage");
	const course = byType("Course");
	const person = byType("Person");
	assert.equal(site.url, siteUrl);
	assert.equal(page.url, siteUrl);
	assert.equal(page.name, document.title);
	assert.equal(page.description, meta("description"));
	assert.equal(site.name, meta("og:site_name"));
	assert.equal(entities.get(page.isPartOf["@id"]), site);
	assert.equal(entities.get(page.mainEntity["@id"]), course);
	assert.equal(entities.get(course.provider["@id"]), person);
	assert.equal(person.image, meta("og:image"));
	assert.ok(document.querySelector("#instructor").textContent.includes(person.name));
	for (const entity of [site, page, course]) {
		assert.equal(entity.inLanguage, document.documentElement.lang);
	}
	for (const entity of entities.values()) {
		assert.ok(entity.name.trim());
		assert.equal(new URL(entity["@id"]).origin, new URL(siteUrl).origin);
		const url = new URL(entity.url);
		assert.equal(url.origin, new URL(siteUrl).origin);
		assert.equal(url.pathname, "/");
		if (url.hash) assert.ok(document.getElementById(url.hash.slice(1)), `${entity.url} must resolve to visible content`);
	}
});
