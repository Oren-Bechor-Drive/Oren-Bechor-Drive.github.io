import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const root = new URL("../../", import.meta.url);

test("404 page offers an index-safe Hebrew recovery path from any URL depth", async () => {
	const html = await readFile(new URL("404.html", root), "utf8");
	const dom = new JSDOM(html, {
		url: "https://oren-bechor-drive.github.io/missing/deep/page",
	});

	try {
		const { document } = dom.window;
		assert.equal(document.documentElement.lang, "he");
		assert.equal(document.documentElement.dir, "rtl");
		assert.equal(document.querySelectorAll("main").length, 1);
		assert.equal(document.querySelectorAll("h1").length, 1);
		assert.equal(
			document.querySelectorAll("main > .error-message").length,
			1,
			"the recovery message is the only main content",
		);
		assert.equal(document.querySelector("main")?.children.length, 1);
		assert.equal(document.querySelector("header"), null);
		assert.equal(document.querySelector("footer"), null);
		assert.equal(document.querySelector(".learning-preview"), null);
		assert.match(
			document.querySelector('meta[name="robots"]')?.content ?? "",
			/(?:^|,)\s*noindex(?:\s*,|$)/,
		);

		const recoveryTargets = [
			...document.querySelectorAll("[data-recovery-action]"),
		].map((link) => link.getAttribute("href"));
		assert.deepEqual(recoveryTargets, ["/", "/course/"]);

		for (const element of document.querySelectorAll(
			'link[href], script[src], img[src], a[href]',
		)) {
			const reference =
				element.getAttribute("href") ?? element.getAttribute("src");
			assert.ok(
				reference.startsWith("/") ||
					reference.startsWith("#") ||
					/^[a-z][a-z\d+.-]*:/i.test(reference),
				`reference must survive a nested 404 URL: ${reference}`,
			);
		}
	} finally {
		dom.window.close();
	}
});

test("404 page is omitted from the public sitemap", async () => {
	const sitemap = await readFile(new URL("sitemap.xml", root), "utf8");
	assert.doesNotMatch(sitemap, /(?:^|\/)404\.html(?:<|$)/);
});
