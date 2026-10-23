import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

for (const width of [1440, 390]) {
  for (const mode of ["enhanced", "disabled", "blocked"]) {
    test(`welcome links open public reading and practice at ${width}px with ${mode} JavaScript`, async (t) => {
      const browser = await chromium.launch();
      t.after(() => browser.close());
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        javaScriptEnabled: mode !== "disabled",
        reducedMotion: "reduce",
      });
      await page.route("**/*", (route) =>
        mode === "blocked" &&
        new URL(route.request().url()).pathname === "/js/script.js"
          ? route.abort()
          : serveRoadMedia(route),
      );
      await page.goto("http://gallery.test/");
      const steps = page.locator(".learning-steps");
      assert.deepEqual(await steps.locator("li").allTextContents(), [
        "רואים מצב אמיתי מהכביש",
        "מבינים איזה חוק חל",
        "לומדים מהי הפעולה הבטוחה",
      ]);
      assert.equal(
        await steps.locator("a, button, [tabindex]").count(),
        0,
        "learning steps are ordinary text in every page mode",
      );
      if (width < 769 && mode === "enhanced")
        await page.locator("[data-menu-toggle]").click();
      const navigation = page.locator(".nav-action");
      await navigation.click();
      await page.waitForURL("http://gallery.test/course/");
      await page.locator("#learning-foundations").click();
      await page.waitForURL("http://gallery.test/course/learning-foundations/");
      assert.ok((await page.locator(".lesson-section").count()) > 0);
      await page.locator(".lesson-quiz-link").click();
      await page.waitForURL(
        "http://gallery.test/course/learning-foundations/quiz/",
      );
      assert.ok((await page.locator(".quiz-question").count()) > 0);
      await page.goto("http://gallery.test/");
      assert.equal(await page.locator("#start p").count(), 0);
      await page.locator("#start .button").click();
      await page.waitForURL("http://gallery.test/course/");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    });
  }
}
