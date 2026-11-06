import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { serveRoadMedia } from "../helpers/road-media.mjs";

async function openSubscription(browser, options) {
  const page = await browser.newPage({ reducedMotion: "reduce", ...options });
  await page.route("**/*", serveRoadMedia);
  await page.goto("http://gallery.test/account/subscribe.html");
  return page;
}

test("subscription page places the plan beside the benefits and stacks it on phones", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const [width, javaScriptEnabled] of [
    [1440, true],
    [390, true],
    [320, false],
  ]) {
    const page = await openSubscription(browser, {
      viewport: { width, height: 844 },
      javaScriptEnabled,
    });
    const layout = await page.evaluate(() => {
      const box = (selector) =>
        document.querySelector(selector).getBoundingClientRect();
      const intro = box(".subscribe-intro");
      const plan = box(".subscribe-plan");
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        beside: plan.right <= intro.left && Math.abs(plan.top - intro.top) <= 1,
        below: plan.top >= intro.bottom,
      };
    });
    assert.equal(layout.overflow, false, `${width}px has no horizontal scroll`);
    if (width >= 860)
      assert.equal(layout.beside, true, "plan sits left of the benefits");
    else assert.equal(layout.below, true, "plan follows the benefits");
    assert.equal(await page.locator(".subscribe-benefits li").count(), 6);
    assert.equal(await page.locator(".subscribe-action").isDisabled(), true);
    await page.close();
  }
});

test("subscription page keyboard order skips the unavailable action and shows focus", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await openSubscription(browser, {
    viewport: { width: 1440, height: 900 },
  });
  const order = [];
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press("Tab");
    order.push(
      await page.evaluate(() => ({
        href: document.activeElement.getAttribute("href"),
        outline: getComputedStyle(document.activeElement).outlineStyle,
      })),
    );
  }
  assert.deepEqual(
    order.map((item) => item.href),
    ["#main", "../index.html", "../index.html", null],
    "skip link, back link and brand, then focus leaves the page",
  );
  for (const item of order.slice(0, 3)) assert.equal(item.outline, "solid");
});
