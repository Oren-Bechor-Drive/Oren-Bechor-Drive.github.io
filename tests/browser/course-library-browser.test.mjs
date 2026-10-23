import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";
import { readLearningContent } from "../../scripts/learning-content.mjs";

const { lessons, issues } = await readLearningContent(process.cwd());

const topicIds = [
  "learning-foundations",
  "signs-and-speed",
  "roads-and-lanes",
  "right-of-way",
  "priority-hierarchy",
  "roundabouts",
  "overtaking",
  "trip-planning",
  "driving-test",
  "licensing-and-points",
];

const modes = ["enhanced", "disabled", "blocked module"];

async function openLibrary(browser, mode, width) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    javaScriptEnabled: mode !== "disabled",
    reducedMotion: "reduce",
  });
  await page.route("**/*", (route) =>
    mode === "blocked module" && route.request().url().endsWith(".js")
      ? route.abort()
      : serveRoadMedia(route),
  );
  await page.goto("http://gallery.test/course/");
  return page;
}

// Groups rendered tiles into rows by their top edge, reading each row right to left.
const gridRows = (page) =>
  page.locator(".topic-grid a").evaluateAll((links) => {
    const rows = [];
    for (const link of links) {
      const box = link.getBoundingClientRect();
      let row = rows.find((candidate) => Math.abs(candidate.top - box.top) < 2);
      if (!row) rows.push((row = { top: box.top, tiles: [] }));
      row.tiles.push({
        id: link.id,
        left: box.left,
        right: box.right,
        width: box.width,
      });
    }
    return {
      rows: rows.map((row) => row.tiles),
      grid: (({ left, right }) => ({ left, right }))(
        document.querySelector(".topic-grid").getBoundingClientRect(),
      ),
    };
  });

test("library learning content has contextual validation diagnostics", () =>
  assert.deepEqual(issues, []));

test("course library links every welcome-page topic in order without search", async () => {
  const read = async (path) =>
    new JSDOM(await readFile(new URL(`../../${path}`, import.meta.url), "utf8"))
      .window.document;
  const visibleText = (element) =>
    element.textContent.replace(/\s+/g, " ").trim();
  const welcome = await read("index.html");
  const course = await read("course/index.html");
  const welcomeTopics = [
    ...welcome.querySelectorAll("[data-topic-summaries] h3 a"),
  ].map((link) => [visibleText(link), link.getAttribute("href")]);
  const links = [...course.querySelectorAll(".topic-grid > li > a")];
  assert.deepEqual(
    links.map((link) => [
      visibleText(link),
      `course/${link.getAttribute("href")}`,
    ]),
    welcomeTopics,
  );
  assert.deepEqual(
    links.map((link) => link.getAttribute("href")),
    topicIds.map((id) => `${id}/`),
  );
  assert.deepEqual(
    links.map((link) => link.id),
    topicIds,
    "topic pages return to their own library tile",
  );
  for (const link of links)
    assert.equal(link.children.length, 0, "tiles show only the topic title");
  for (const selector of [
    "form",
    "[role='search']",
    "input",
    "details",
    "[role='tablist']",
    "[role='status']",
    'script[src*="course-library"]',
  ])
    assert.equal(course.querySelector(selector), null, selector);
  assert.equal(course.documentElement.lang, "he");
  assert.equal(course.documentElement.dir, "rtl");
  assert.equal(course.querySelector('meta[name="robots"]').content, "noindex");
  assert.match(
    course.querySelector(".course-preview-note").textContent,
    /עדיין אינם זמינים/,
  );
});

test("each topic page keeps its library outline", async () => {
  for (const id of topicIds) {
    const document = new JSDOM(
      await readFile(
        new URL(`../../course/${id}/index.html`, import.meta.url),
        "utf8",
      ),
    ).window.document;
    const outline = document.querySelector(".lesson-intro > .lesson-outline");
    assert.equal(
      outline.querySelector("h2").textContent.trim(),
      "מה נלמד בנושא?",
    );
    assert.ok(outline.querySelectorAll("ul > li").length > 0, id);
  }
});

test("course headers link to the public library and retain the account fallback", async () => {
  for (const file of [
    "course/index.html",
    ...lessons.map((lesson) => lesson.file),
  ]) {
    const document = new JSDOM(
      await readFile(new URL(`../../${file}`, import.meta.url), "utf8"),
    ).window.document;
    const header = document.querySelector(".course-header");
    assert.equal(header.querySelectorAll("a").length, 2);
    assert.equal(
      header.querySelector(".course-library-link").textContent.trim(),
      "נושאי הלימוד",
    );
    assert.equal(
      new URL(
        header.querySelector("a").getAttribute("href"),
        `https://site.test/${file}`,
      ).pathname,
      "/index.html",
    );
    const profile = header.querySelector(".course-profile");
    assert.equal(profile.tagName, "BUTTON");
    assert.equal(profile.disabled, true);
    assert.equal(profile.getAttribute("aria-label"), "הפרופיל עדיין אינו זמין");
    assert.ok(
      profile.querySelector(".course-profile-icon[aria-hidden='true']"),
    );
  }
});

for (const mode of modes) {
  test(
    `topic grid uses rows of 4, 4 and 2 on desktop and 2 per row on mobile with ${mode} JavaScript`,
    { timeout: 20_000 },
    async (t) => {
      const browser = await chromium.launch();
      t.after(() => browser.close());
      for (const [width, counts] of [
        [1440, [4, 4, 2]],
        [1024, [4, 4, 2]],
        [768, [4, 4, 2]],
        [767, [2, 2, 2, 2, 2]],
        [390, [2, 2, 2, 2, 2]],
        [320, [2, 2, 2, 2, 2]],
      ]) {
        const page = await openLibrary(browser, mode, width);
        const { rows, grid } = await gridRows(page);
        assert.deepEqual(
          rows.map((row) => row.length),
          counts,
          `row counts at ${width}px`,
        );
        const tiles = rows.flat();
        assert.deepEqual(
          tiles.map((tile) => tile.id),
          topicIds,
          `DOM order fills rows at ${width}px`,
        );
        for (const row of rows)
          for (let index = 1; index < row.length; index++)
            assert.ok(
              row[index].right < row[index - 1].left,
              `topics read right to left at ${width}px`,
            );
        assert.ok(
          Math.abs(tiles[0].right - grid.right) < 1,
          `first topic sits top-right at ${width}px`,
        );
        for (const tile of tiles)
          assert.ok(
            Math.abs(tile.width - tiles[0].width) < 1,
            `${tile.id} matches the tile width at ${width}px`,
          );
        const last = rows.at(-1);
        assert.ok(
          Math.abs(
            grid.right - last[0].right - (last.at(-1).left - grid.left),
          ) < 1,
          `last row is centered at ${width}px`,
        );
        if (counts.at(-1) === 2 && counts[0] === 4)
          for (const [tile, [outer, inner]] of [
            [last[0], [rows[0][0], rows[0][1]]],
            [last[1], [rows[0][3], rows[0][2]]],
          ])
            assert.ok(
              Math.abs(
                (tile.left + tile.right) / 2 -
                  (Math.min(outer.left, inner.left) +
                    Math.max(outer.right, inner.right)) /
                    2,
              ) < 1,
              `${tile.id} sits under the gap between ${outer.id} and ${inner.id} at ${width}px`,
            );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `no horizontal overflow at ${width}px`,
        );
        await page.close();
      }
    },
  );

  test(
    `learner can open each learning page and return to its tile with ${mode} JavaScript`,
    { timeout: 30_000 },
    async (t) => {
      const browser = await chromium.launch();
      t.after(() => browser.close());
      for (const width of [1440, 390, 320]) {
        const page = await openLibrary(browser, mode, width);
        await page
          .getByRole("link", { name: "זכויות קדימה ופניות", exact: true })
          .click();
        assert.equal(new URL(page.url()).pathname, "/course/right-of-way/");
        assert.equal(
          await page.locator("h1").innerText(),
          "זכויות קדימה ופניות",
        );
        for (const lesson of lessons) {
          await page.goto(`http://gallery.test/${lesson.file}`);
          for (const { id } of lesson.sections.length > 1
            ? [...lesson.sections].reverse()
            : []) {
            await page.locator(`.lesson-contents a[href="#${id}"]`).click();
            assert.equal(new URL(page.url()).hash, `#${id}`);
            const top = await page
              .locator(`#${id}`)
              .evaluate((element) => element.getBoundingClientRect().top);
            assert.ok(
              top >= 0 && top < 200,
              `${id} is reachable independently at ${width}px`,
            );
          }
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
          );
          assert.equal(
            await page
              .locator(".course-brand img")
              .evaluate((image) => image.complete && image.naturalWidth > 0),
            true,
          );
          await page
            .getByRole("link", {
              name: "לכל הנושאים",
              exact: true,
            })
            .click();
          const returned = new URL(page.url());
          assert.equal(returned.pathname, "/course/");
          assert.equal(
            await page
              .locator(`.topic-grid a${returned.hash}`)
              .evaluate((link) => {
                const { top, bottom } = link.getBoundingClientRect();
                return top >= 0 && bottom <= innerHeight;
              }),
            true,
            `${lesson.file} returns to its visible library tile at ${width}px`,
          );
        }
        await page.locator(".course-brand").click();
        assert.equal(new URL(page.url()).pathname, "/index.html");
        await page.close();
      }
    },
  );
}
