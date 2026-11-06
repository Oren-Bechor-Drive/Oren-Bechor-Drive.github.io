import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";
import { subscriptionOffer } from "../../server/subscription-offer.mjs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const text = (element) => element.textContent.replace(/\s+/g, " ").trim();

test("subscription page shows the trial offer without a price or payment collection", async () => {
  const { document } = new JSDOM(await read("account/subscribe.html")).window;
  assert.equal(document.documentElement.lang, "he");
  assert.equal(document.documentElement.dir, "rtl");
  assert.equal(
    document.querySelector('meta[name="robots"]').content,
    "noindex",
  );
  assert.equal(document.querySelectorAll("h1").length, 1);

  // The owner asked on 2026-11-06 not to publish a price yet.
  const copy = text(document.body);
  assert.doesNotMatch(copy, /₪|ש"ח|ILS/);
  assert.ok(!copy.includes(String(subscriptionOffer.monthlyAmountMinor / 100)));
  assert.equal(
    text(document.querySelector(".subscribe-badge")),
    `${subscriptionOffer.trialDays} ימי ניסיון`,
  );

  const action = document.querySelector(".subscribe-action");
  assert.equal(action.tagName, "BUTTON");
  assert.equal(action.disabled, !subscriptionOffer.checkoutAvailable);
  const status = document.getElementById(
    action.getAttribute("aria-describedby"),
  );
  assert.match(text(status), /עדיין לא נפתחה/);

  assert.equal(
    document.querySelector("form, input, select, textarea, iframe"),
    null,
  );
  assert.equal(document.querySelector('a[href*="course/"]'), null);
  assert.equal(
    document.querySelector(".account-back").getAttribute("href"),
    "../index.html",
  );
});

test("account pages point to the subscription page instead of free practice", async () => {
  const pages = (await readdir(new URL("account/", root))).filter((name) =>
    name.endsWith(".html"),
  );
  for (const name of pages) {
    const html = await read(`account/${name}`);
    assert.doesNotMatch(html, /ולתרגול החינמי|href="\.\.\/course\//, name);
  }
  const { document } = new JSDOM(await read("account/learning.html")).window;
  assert.ok(document.querySelector('a[href="subscribe.html"]'));
});
