import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { createVimeoMedia } from "../../server/vimeo-media.mjs";
import { startLessonGateway } from "../helpers/test-lessons.mjs";
import { testSections } from "../fixtures/test-sections.mjs";

for (const width of [1440, 390]) {
  test(`paid reader embeds the authorized Vimeo player with an origin-only referrer at ${width}px`, async (t) => {
    const app = await startLessonGateway({
      mediaFactory: async (versions) => {
        const { sectionId, contentVersionId } = versions.find(
          (version) => version.accessLevel === "paid",
        );
        return createVimeoMedia({
          entries: [
            {
              id: "video",
              sectionId,
              contentVersionId,
              title: "סרטון סינתטי לבדיקה",
              vimeoId: "123456789",
              captions: "he",
            },
          ],
        });
      },
    });
    t.after(app.close);
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    page.setDefaultTimeout(8000);
    const players = [];
    // Never contact Vimeo from tests; record what the browser would send.
    await page.route("https://player.vimeo.com/**", (route) => {
      players.push(route.request());
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>player</title>",
      });
    });
    const email = `vimeo-${width}@example.test`;
    await page.goto(app.origin + "/account/login.html");
    await page.getByLabel("כתובת אימייל").fill(email);
    await page.getByLabel("סיסמה", { exact: true }).fill("correct-password");
    await page
      .getByRole("button", { name: "כניסה לחשבון", exact: true })
      .click();
    await page.waitForURL(app.origin + "/account/");
    await app.grant(email);
    await page.goto(
      `${app.origin}/account/reader.html?section=${testSections.paid}&access=paid`,
    );
    await page.locator("[data-reading]").waitFor();
    const player = page.locator(".reading-media iframe");
    assert.equal(
      await player.getAttribute("src"),
      "https://player.vimeo.com/video/123456789?dnt=1&texttrack=he",
    );
    assert.equal(await player.getAttribute("title"), "סרטון סינתטי לבדיקה");
    await page.waitForFunction(
      () =>
        document.querySelector(".reading-media iframe")?.contentDocument ===
        null,
    );
    assert.equal(players.length, 1);
    assert.equal(players[0].headers().referer, `${app.origin}/`);
    const box = await player.boundingBox();
    assert.ok(box.width <= width && box.width > 0);
    assert.ok(Math.abs(box.width / box.height - 16 / 9) < 0.02);
    assert.equal(
      await page.locator(".reading-media figcaption").textContent(),
      "סרטון סינתטי לבדיקה",
    );
  });
}
