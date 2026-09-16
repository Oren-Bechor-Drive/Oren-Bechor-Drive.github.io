import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

for (const malformed of [false, true]) {
	test(`page navigation works with ${malformed ? "malformed" : "valid"} topic markup`, async (t) => {
		const html = await readFile(
			new URL("../index.html", import.meta.url),
			"utf8",
		);
		const dom = new JSDOM(html, {
			pretendToBeVisual: true,
			url: "http://localhost/",
		});
		t.after(() => dom.window.close());
		globalThis.window = dom.window;
		globalThis.document = dom.window.document;
		t.after(() => {
			delete globalThis.window;
			delete globalThis.document;
		});
		dom.window.matchMedia = () => ({
			matches: true,
			addEventListener() {},
			removeEventListener() {},
		});
		dom.window.fetch = async () => ({ status: 404 });
		const document = dom.window.document;
		const road = document.querySelector("[data-road-carousel]");
		assert.ok(road, "Page must include the road carousel");
		assert.equal(document.querySelector("[data-road-toggle]"), null);
		assert.equal(road.querySelectorAll(".road-carousel-group").length, 1);
		road.focus();
		assert.notEqual(
			document.activeElement,
			road,
			"The carousel must not capture focus",
		);
		const originalCars = [...road.querySelectorAll(".road-car > img")];
		assert.ok(
			originalCars.every((image) => !image.draggable),
			"Car images must not start native drag interactions",
		);
		if (malformed) document.querySelector("[data-topic-panel-title]").remove();
		const entry = document.querySelector('script[type="module"][src]');
		assert.ok(entry, "HTML must load a module entry");
		const entryUrl = new URL(
			`../${entry.getAttribute("src")}`,
			import.meta.url,
		);
		entryUrl.searchParams.set("case", String(malformed));
		const warning = t.mock.method(console, "warn", () => {});
		const loading = import(entryUrl.href);
		if (malformed)
			await assert.rejects(loading, /Missing required topic panel/);
		else await loading;

		const toggle = document.querySelector("[data-menu-toggle]");
		const menu = document.querySelector("[data-menu]");
		toggle.click();
		assert.equal(menu.dataset.open, "true");
		document.dispatchEvent(
			new dom.window.KeyboardEvent("keydown", { key: "Escape" }),
		);
		assert.equal(menu.dataset.open, "false");
		assert.equal(document.activeElement, toggle);
		toggle.click();
		menu.querySelector("a").click();
		assert.equal(menu.dataset.open, "false");

		document.querySelector("[data-topics-link]").click();
		await new Promise((resolve) => dom.window.requestAnimationFrame(resolve));
		assert.equal(document.activeElement, document.querySelector("#about"));
		assert.equal(warning.mock.callCount(), 1, "the fixture's unavailable gallery reports one warning");
		assert.match(warning.mock.calls[0].arguments[0], /Student gallery could not refresh/);
		assert.match(warning.mock.calls[0].arguments[1].message, /photo 1: HTTP 404/);
		if (!malformed) {
			const card = document.querySelectorAll(".topic-card")[1];
			card.click();
			assert.equal(
				document.querySelector("[data-topic-panel-title]").textContent,
				card.textContent.trim(),
			);
		}
	});
}
