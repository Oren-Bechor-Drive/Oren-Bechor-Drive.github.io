import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import { initTopicExplorer } from "../js/topic-explorer.js";

function setup({ reducedMotion = true } = {}) {
	const dom = new JSDOM(
		`<!doctype html><div data-topic-explorer>
    <button class="topic-card" data-active="true" aria-expanded="true" data-topic-description="תיאור ראשון">נושא ראשון</button>
    <button class="topic-card" data-active="false" aria-expanded="false" data-topic-description="תיאור שני">נושא שני</button>
    <button class="topic-card" data-active="false" aria-expanded="false" data-topic-description="תיאור שלישי">נושא שלישי</button>
    <div data-topic-panel><h3 data-topic-panel-title>ישן</h3><p data-topic-panel-description>ישן</p></div>
  </div>`,
		{ pretendToBeVisual: true },
	);
	dom.window.matchMedia = () => ({ matches: reducedMotion });
	const root = dom.window.document.querySelector("[data-topic-explorer]");
	initTopicExplorer(root);
	return { dom, root, cards: [...root.querySelectorAll(".topic-card")] };
}

test("initialization reconciles the panel with the active topic", () => {
	const { root } = setup();
	assert.equal(
		root.querySelector("[data-topic-panel-title]").textContent,
		"נושא ראשון",
	);
	assert.equal(
		root.querySelector("[data-topic-panel-description]").textContent,
		"תיאור ראשון",
	);
});

test("selection updates one complete selected-state invariant", () => {
	const { dom, root, cards } = setup();
	cards[1].dispatchEvent(
		new dom.window.MouseEvent("click", { bubbles: true }),
	);
	assert.deepEqual(
		cards.map((card) => card.dataset.active),
		["false", "true", "false"],
	);
	assert.deepEqual(
		cards.map((card) => card.getAttribute("aria-expanded")),
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

test("RTL arrows, Home, and End move focus in display order", () => {
	const { dom, cards } = setup();
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

test("missing panel hooks fail at the module interface", () => {
	const dom = new JSDOM(
		'<div data-topic-explorer><button class="topic-card">נושא</button></div>',
	);
	const root = dom.window.document.querySelector("[data-topic-explorer]");
	assert.throws(
		() => initTopicExplorer(root),
		/missing required topic panel/i,
	);
});

test("a superseded selection never appears while the latest transition is pending", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const { dom, root, cards } = setup({ reducedMotion: false });
	t.after(() => dom.window.close());
	cards[1].dispatchEvent(
		new dom.window.MouseEvent("click", { bubbles: true }),
	);
	t.mock.timers.tick(60);
	cards[2].dispatchEvent(
		new dom.window.MouseEvent("click", { bubbles: true }),
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


test("dropdown includes every topic and starts with the active selection", () => {
	const { root, cards } = setup();
	const dropdown = root.querySelector(".topic-select");
	const options = [...root.querySelectorAll('[role="option"]')];
	assert.equal(dropdown.textContent, cards[0].textContent.trim());
	assert.deepEqual(options.map(option => option.textContent), cards.map(card => card.textContent.trim()));
	assert.equal(dropdown.getAttribute("aria-expanded"), "false");
	assert.equal(root.querySelector('[role="listbox"]').hidden, true);
});

test("dropdown selection updates the preview and desktop card selection", () => {
	const { root, cards } = setup();
	const dropdown = root.querySelector(".topic-select");
	dropdown.click();
	root.querySelectorAll('[role="option"]')[2].click();
	assert.equal(root.querySelector("[data-topic-panel-title]").textContent, "נושא שלישי");
	assert.deepEqual(cards.map(card => card.dataset.active), ["false", "false", "true"]);
	assert.equal(dropdown.getAttribute("aria-expanded"), "false");
	assert.equal(root.ownerDocument.activeElement, dropdown);
	cards[1].click();
	assert.equal(dropdown.textContent, "נושא שני");
});

test("dropdown keyboard navigation and dismissal keep open state accurate", () => {
	const { dom, root } = setup();
	const dropdown = root.querySelector(".topic-select");
	const options = [...root.querySelectorAll('[role="option"]')];
	const key = (name) => dom.window.document.activeElement.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: name, bubbles: true }));
	dropdown.focus();
	key("ArrowDown");
	assert.equal(dropdown.getAttribute("aria-expanded"), "true");
	assert.equal(dom.window.document.activeElement, options[0]);
	key("ArrowDown");
	assert.equal(dom.window.document.activeElement, options[1]);
	key("End");
	assert.equal(dom.window.document.activeElement, options[2]);
	key("Home");
	assert.equal(dom.window.document.activeElement, options[0]);
	key("Escape");
	assert.equal(dropdown.getAttribute("aria-expanded"), "false");
	assert.equal(dom.window.document.activeElement, dropdown);
	dropdown.click();
	dom.window.document.body.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true }));
	assert.equal(dropdown.getAttribute("aria-expanded"), "false");
	dropdown.click();
	root.querySelector(".topic-card").focus();
	assert.equal(dropdown.getAttribute("aria-expanded"), "false");
});
