import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import { initTopicExplorer } from "../../js/topic-explorer.js";

function setup(t, { reducedMotion = true, mobile = false } = {}) {
	const dom = new JSDOM(
		`<!doctype html><div data-topic-explorer tabindex="-1"><div class="topic-rail">
    <button class="topic-card" data-active="true" aria-expanded="true">נושא ראשון</button>
    <button class="topic-card" data-active="false" aria-expanded="false">נושא שני</button>
    <button class="topic-card" data-active="false" aria-expanded="false">נושא שלישי</button>
    </div><div data-topic-summaries><section><h3><a href="first/">נושא ראשון</a></h3><p>תיאור ראשון</p></section><section><h3><a href="second/">נושא שני</a></h3><p>תיאור שני</p></section><section><h3><a href="third/">נושא שלישי</a></h3><p>תיאור שלישי</p></section></div>
    <div data-topic-panel hidden><h3 data-topic-panel-title>ישן</h3><p data-topic-panel-description>ישן</p></div>
  </div>`,
		{ pretendToBeVisual: true },
	);
	t.after(() => dom.window.close());
	const mediaQueries = new Map();
	dom.window.matchMedia = query => {
		const media = new dom.window.EventTarget();
		media.matches = query.includes("reduced-motion") ? reducedMotion : mobile;
		mediaQueries.set(query, media);
		return media;
	};
	const root = dom.window.document.querySelector("[data-topic-explorer]");
	initTopicExplorer(root);
	return {
		dom,
		root,
		cards: [...root.querySelectorAll(".topic-card")],
		setMobile(matches) {
			const media = mediaQueries.get("(max-width: 639px)");
			media.matches = matches;
			media.dispatchEvent(new dom.window.Event("change"));
		},
	};
}

test("initialization reconciles the panel with the active topic", (t) => {
	const { root } = setup(t);
	assert.equal(
		root.querySelector("[data-topic-panel-title]").textContent,
		"נושא ראשון",
	);
	assert.equal(
		root.querySelector("[data-topic-panel-description]").textContent,
		"תיאור ראשון",
	);
});

test("selection updates one complete selected-state invariant", (t) => {
	const { dom, root, cards } = setup(t);
	cards[1].dispatchEvent(
		new dom.window.MouseEvent("click", { bubbles: true }),
	);
	assert.deepEqual(
		cards.map((card) => card.dataset.active),
		["false", "true", "false"],
	);
	assert.deepEqual(
		cards.map((card) => card.getAttribute("aria-selected")),
		["false", "true", "false"],
	);
	assert.equal(
		root.querySelector("[data-topic-panel-title]").textContent,
		"נושא שני",
	);
	assert.equal(
		root.querySelector("[data-topic-panel-description]").textContent,
		"תיאור שני",
	);
});

test("RTL arrows, Home, and End move focus in display order", (t) => {
	const { dom, cards } = setup(t);
	cards[0].focus();
	cards[0].dispatchEvent(
		new dom.window.KeyboardEvent("keydown", {
			key: "ArrowLeft",
			bubbles: true,
		}),
	);
	assert.equal(dom.window.document.activeElement, cards[1]);
	cards[1].dispatchEvent(
		new dom.window.KeyboardEvent("keydown", {
			key: "ArrowRight",
			bubbles: true,
		}),
	);
	assert.equal(dom.window.document.activeElement, cards[0]);
	cards[0].dispatchEvent(
		new dom.window.KeyboardEvent("keydown", { key: "End", bubbles: true }),
	);
	assert.equal(dom.window.document.activeElement, cards[2]);
	cards[2].dispatchEvent(
		new dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true }),
	);
	assert.equal(dom.window.document.activeElement, cards[0]);
});

test("missing panel hooks fail at the module interface", (t) => {
	const dom = new JSDOM(
		'<div data-topic-explorer tabindex="-1"><div class="topic-rail"><button class="topic-card">נושא</button></div>',
	);
	t.after(() => dom.window.close());
	const root = dom.window.document.querySelector("[data-topic-explorer]");
	assert.throws(
		() => initTopicExplorer(root),
		/missing required topic panel/i,
	);
});

test("a superseded selection never appears while the latest transition is pending", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const { dom, root, cards } = setup(t, { reducedMotion: false });
	cards[1].dispatchEvent(
		new dom.window.MouseEvent("click", { bubbles: true, detail: 1 }),
	);
	t.mock.timers.tick(60);
	cards[2].dispatchEvent(
		new dom.window.MouseEvent("click", { bubbles: true, detail: 1 }),
	);
	t.mock.timers.tick(50);
	assert.equal(
		root.querySelector("[data-topic-panel-title]").textContent,
		"נושא ראשון",
	);
	assert.equal(
		root.querySelector("[data-topic-panel]").dataset.updating,
		"true",
	);
	t.mock.timers.tick(60);
	assert.equal(
		root.querySelector("[data-topic-panel-title]").textContent,
		"נושא שלישי",
	);
	assert.equal(
		root.querySelector("[data-topic-panel-description]").textContent,
		"תיאור שלישי",
	);
	assert.equal(
		root.querySelector("[data-topic-panel]").dataset.updating,
		"false",
	);
});

test("desktop tabs expose one roving tab stop and identify their controlled panel", t => {
 const { root, cards } = setup(t);
 const panel = root.querySelector("[data-topic-panel]");
 assert.equal(root.querySelector(".topic-rail").getAttribute("role"), "tablist");
 assert.equal(panel.getAttribute("role"), "tabpanel");
 assert.equal(panel.getAttribute("aria-live"), null);
 assert.equal(panel.getAttribute("aria-labelledby"), cards[0].id);
 assert.deepEqual(cards.map(card => card.tabIndex), [0, -1, -1]);
 for (const card of cards) {
  assert.equal(card.getAttribute("role"), "tab");
  assert.equal(card.getAttribute("aria-controls"), panel.id);
  assert.equal(card.getAttribute("aria-expanded"), null);
 }
 cards[2].click();
 assert.deepEqual(cards.map(card => card.tabIndex), [-1, -1, 0]);
 assert.equal(panel.getAttribute("aria-labelledby"), cards[2].id);
});

test("mobile keeps every baseline description visible without inactive topic controls", t => {
 const { root, cards } = setup(t, { mobile: true });
 assert.equal(root.querySelector("[data-topic-summaries]").hidden, false);
 assert.equal(root.querySelectorAll("[data-topic-summaries] p").length, cards.length);
 assert.equal(root.querySelector(".topic-rail").hidden, true);
 assert.equal(root.querySelector("[data-topic-panel]").hidden, true);
 assert.equal(root.querySelector(".topic-select, [role=listbox]"), null);
});

test("presentation changes keep the focused topic visible and selected", t => {
	const { dom, root, cards, setMobile } = setup(t, { mobile: true });
	const links = [...root.querySelectorAll("[data-topic-summaries] h3 a")];
	links[2].focus();
	setMobile(false);
	assert.equal(dom.window.document.activeElement, cards[2]);
	assert.equal(root.querySelector("[data-topic-panel-title]").textContent, "נושא שלישי");
	assert.equal(cards[2].getAttribute("aria-selected"), "true");
	setMobile(true);
	assert.equal(dom.window.document.activeElement, links[2]);
	assert.equal(root.querySelector("[data-topic-summaries]").hidden, false);
	setMobile(false);
	root.querySelector("[data-topic-panel]").focus();
	setMobile(true);
	assert.equal(dom.window.document.activeElement, links[2]);
});

test("presentation changes preserve unrelated focus and the selected topic", t => {
	const { dom, root, cards, setMobile } = setup(t);
	cards[1].click();
	const unrelated = dom.window.document.createElement("button");
	dom.window.document.body.append(unrelated);
	unrelated.focus();
	for (const mobile of [true, false]) {
		setMobile(mobile);
		assert.equal(dom.window.document.activeElement, unrelated);
		assert.equal(cards[1].getAttribute("aria-selected"), "true");
		assert.equal(root.querySelector("[data-topic-panel-title]").textContent, "נושא שני");
	}
});
