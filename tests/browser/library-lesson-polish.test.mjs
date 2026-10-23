import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { readLearningContent } from "../../scripts/learning-content.mjs";
import { serveRoadMedia } from "../helpers/road-media.mjs";

const content = await readLearningContent(process.cwd());
const normalized = (element) => element.textContent.replace(/\s+/g, " ").trim();

test("reading sections use compact notes, usable checks and accurate contents labels", async () => {
  for (const lesson of content.lessons) {
    const document = new JSDOM(await readFile(lesson.file, "utf8")).window
      .document;
    assert.equal(
      document.querySelector(".lesson-content").hasAttribute("aria-label"),
      false,
    );
    assert.equal(
      document.querySelector(".lesson-quiz-link").closest(".lesson-section"),
      null,
    );
    assert.equal(
      document.querySelector(".lesson-end a:last-child").textContent.trim(),
      "לכל הנושאים",
    );
    const sections = [...document.querySelectorAll(".lesson-section")];
    assert.equal(
      Boolean(document.querySelector(".lesson-contents")),
      sections.length > 1,
    );
    for (const section of sections) {
      const notes = [
        ...section.querySelectorAll(".video-placeholder, .image-placeholder"),
      ];
      assert.ok(
        notes.length <= 1,
        `${lesson.file}#${section.id} has one media note at most`,
      );
      for (const note of notes) {
        assert.equal(note.getAttribute("role"), "note");
        assert.equal(note.closest("li"), null);
        assert.ok(normalized(note).length < 105);
      }
      assert.equal(section.querySelectorAll(".lesson-scenario").length, 1);
      assert.equal(
        section.querySelectorAll("details.lesson-self-check").length,
        1,
      );
      if (sections.length > 1) {
        assert.equal(
          normalized(
            document.querySelector(`.lesson-contents a[href="#${section.id}"]`),
          ),
          normalized(section.querySelector("h2")),
        );
        assert.equal(
          section.querySelector(".lesson-return-contents").getAttribute("href"),
          "#contents",
        );
      }
    }
  }
  const foundations = new JSDOM(
    await readFile("course/learning-foundations/index.html", "utf8"),
  ).window.document;
  assert.equal(
    foundations.querySelectorAll(".lesson-definitions dt").length,
    8,
  );
  const hierarchy = new JSDOM(
    await readFile("course/priority-hierarchy/index.html", "utf8"),
  ).window.document;
  assert.equal(hierarchy.querySelectorAll("ol.priority-list > li").length, 4);
});

test("reading contents, checks and endings work on phones and with reduced motion", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const javaScriptEnabled of [true, false]) {
    const page = await browser.newPage({
      viewport: { width: 320, height: 900 },
      reducedMotion: "reduce",
      javaScriptEnabled,
    });
    await page.route("**/*", serveRoadMedia);
    await page.goto("http://gallery.test/course/right-of-way/");
    assert.deepEqual(
      await page
        .locator(".lesson-section")
        .first()
        .evaluate((node) => ({
          padding: getComputedStyle(node).paddingInlineStart,
          shellMargin: document.querySelector("main").getBoundingClientRect()
            .left,
        })),
      { padding: "16px", shellMargin: 16 },
    );
    const contents = await page
      .locator(".lesson-contents ul")
      .evaluate((node) => getComputedStyle(node).gridTemplateColumns);
    assert.equal(contents.split(" ").length, 1);
    await page.locator('.lesson-contents a[href="#right-turn"]').click();
    await page.locator("#right-turn .lesson-self-check summary").click();
    assert.equal(
      await page.locator("#right-turn .lesson-self-check p").isVisible(),
      true,
    );
    await page.locator("#right-turn .lesson-return-contents").click();
    assert.equal(new URL(page.url()).hash, "#contents");
    assert.equal(await page.locator(".lesson-quiz-link").isVisible(), true);
    assert.equal(
      await page.locator(".lesson-next").getAttribute("href"),
      "../priority-hierarchy/",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.close();
  }
});

test("lessons print all reading and self-check text without navigation or media notes", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.route("**/*", serveRoadMedia);
  await page.goto("http://gallery.test/course/right-of-way/");
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".lesson-section:visible").count(), 4);
  assert.equal(await page.locator(".lesson-self-check p:visible").count(), 4);
  assert.equal(await page.locator(".lesson-contents").isVisible(), false);
  assert.equal(await page.locator(".course-header").isVisible(), false);
  assert.equal(
    await page
      .locator(".video-placeholder:visible, .image-placeholder:visible")
      .count(),
    0,
  );
});
