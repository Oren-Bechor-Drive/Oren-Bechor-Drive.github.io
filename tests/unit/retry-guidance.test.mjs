import assert from "node:assert/strict";
import test from "node:test";
import { readRetryAfter, retryGuidance } from "../../account/retry-guidance.js";

test("retry headers accept only positive bounded integer seconds", () => {
	for (const seconds of [1, 60, 840, 900, 86400]) assert.equal(readRetryAfter(String(seconds)), seconds);
	for (const invalid of [null, undefined, 60, "", "0", "01", " 60", "60 ", "-1", "1.5", "1e3", "86401", "Thu, 08 Oct 2026 12:00:00 GMT"]) assert.equal(readRetryAfter(invalid), null);
});

test("known cooldowns say the actual seconds while unknown cooldowns keep generic guidance", () => {
	assert.equal(retryGuidance(840), "בוצעו בקשות רבות. אפשר לנסות שוב בעוד 840 שניות.");
	assert.equal(retryGuidance(null), "בוצעו בקשות רבות. המתינו מעט ונסו שוב.");
});
