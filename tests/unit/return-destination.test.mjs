import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAccountReturn } from "../../account/return-destination.js";

const origin = "https://course.example.test";
const reader = "/account/reader.html?section=a524e32d-2640-4d94-a51c-000000000001&access=free";
test("return destinations include only the exact protected paths and reader parameters", () => {
	for (const wanted of ["/account/", "/account/learning.html", reader, reader.replace("free", "paid")]) {
		assert.equal(normalizeAccountReturn(wanted, origin), wanted);
	}
	assert.equal(normalizeAccountReturn("/account/reader.html?access=free&section=a524e32d-2640-4d94-a51c-000000000001", origin), reader);
});
test("unsafe, ambiguous, malformed and overlong destinations fall back to the account page", () => {
	for (const value of [undefined, null, {}, "", "https://evil.test/", "//evil.test/", "/account/\\evil.test",
		"/account/login.html", "/account/learning.html?next=evil", "/account/learning.html#extra", reader + "#extra",
		reader + "&access=paid", reader + "&section=a524e32d-2640-4d94-a51c-000000000001", reader + "&next=/",
		reader.replace("a524e32d-2640-4d94-a51c-000000000001", "-".repeat(36)), "/account/%72eader.html?section=x&access=free",
		"/account/../account/learning.html", "/account/\nlearning.html", reader.replace("free", "other"), "x".repeat(2049)]) {
		assert.equal(normalizeAccountReturn(value, origin), "/account/", String(value));
	}
});
