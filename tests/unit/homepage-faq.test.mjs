import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("homepage FAQ answers course questions and current availability with native disclosures", async () => {
	const dom = new JSDOM(await read("index.html"));
	try {
		const { document } = dom.window;
		const faq = document.querySelector("#faq");
		assert.ok(faq, "homepage must expose the FAQ anchor");
		assert.equal(faq.getAttribute("aria-labelledby"), "faq-title");
		assert.equal(faq.querySelector("h2#faq-title")?.textContent.trim(), "שאלות נפוצות");
		assert.deepEqual(
			[...faq.querySelectorAll("details")].map((item) =>
				item.querySelector(":scope > summary")?.textContent.trim(),
			),
			[
				"למי מיועד הקורס?",
				"האם הקורס מחליף שיעורי נהיגה?",
				"איך לומדים בקורס?",
				"מה כוללים הסרטונים?",
				"איך עובדים שאלוני התרגול?",
				"מתי הקורס המלא יהיה זמין?",
			],
		);
		assert.equal(faq.querySelectorAll("details").length, 6);
		assert.equal(faq.querySelectorAll("summary").length, 6);
		assert.equal(faq.querySelectorAll("button").length, 0);
		assert.equal(faq.querySelectorAll("[role]").length, 0);

		assert.equal(faq.querySelector('.faq-item:last-child a').getAttribute("href"), "course/");
		assert.match(faq.querySelector('.faq-item:last-child').textContent, /מועד פתיחה עדיין לא פורסם/);

		const copy = faq.textContent.replace(/\s+/g, " ");
		for (const fact of [
			/למי שלומדים נהיגה.*למי שרוצים להבין טוב יותר/,
			/משלים את שיעורי הנהיגה.*אינו מחליף את מורה הנהיגה/,
			/לבחור כל נושא.*בכל סדר.*בקצב שלכם/,
			/סרטונים.*מצבי נהיגה אמיתיים.*לצפות שוב.*בקצב שלכם/,
			/שאלות רב-ברירה.*לבדוק.*הבנתם/,
		]) {
			assert.match(copy, fact);
		}
		assert.doesNotMatch(
			copy,
			/ממלאי מקום|ללא ציון|אינן נשמרות|תשלום|חשבון|JavaScript/,
		);
		assert.match(faq.querySelector(".faq-availability").textContent, /הסרטונים וההרשמה לקורס המלא עדיין אינם זמינים/);
		assert.ok(
			document.head.querySelector('link[rel="stylesheet"][href="css/faq.css"]'),
			"homepage must load the FAQ stylesheet",
		);
	} finally {
		dom.window.close();
	}
});

test("retired help route and footer link are absent", async () => {
	const dom = new JSDOM(await read("index.html"));
	try {
		assert.equal(existsSync(new URL("help/index.html", root)), false);
		assert.equal(existsSync(new URL("css/help.css", root)), false);
		assert.equal(dom.window.document.querySelector('a[href="help/"]'), null);
	} finally {
		dom.window.close();
	}
});
