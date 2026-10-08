import assert from "node:assert/strict";
import test from "node:test";
import { inspectPassword } from "../../account/password-policy.js";

test("new passwords enforce Unicode character and UTF-8 byte limits without composition or normalization", () => {
	for (const [password, length, error] of [
		["", 0, "required"], ["abcdefghijk", 11, "too_short"],
		["😀".repeat(6), 6, "too_short"], ["😀".repeat(6) + "abcde", 11, "too_short"],
		["abcdefghijkl", 12, null], ["1".repeat(12), 12, null], [" ".repeat(12), 12, null],
		["a".repeat(72), 72, null], ["a".repeat(73), 73, "too_long"],
		["א".repeat(36), 36, null], ["א".repeat(37), 37, "too_long"],
		["😀".repeat(18), 18, null], ["😀".repeat(19), 19, "too_long"],
		["a\u0301".repeat(6), 12, null], ["a\u0301".repeat(24), 48, null], ["a\u0301".repeat(25), 50, "too_long"],
		["א".repeat(34) + "aaaa", 38, null], ["א".repeat(34) + "aaaaa", 39, "too_long"],
	]) assert.deepEqual(inspectPassword(password), { length, error }, JSON.stringify(password));
});

test("existing passwords retain the independent 1-128 Unicode character policy", () => {
	for (const [password, length, error] of [
		["", 0, "required"], ["a", 1, null], [" ", 1, null], ["😀", 1, null],
		["א".repeat(37), 37, null], ["😀".repeat(128), 128, null],
		["a\u0301".repeat(64), 128, null], ["😀".repeat(129), 129, "too_long"],
	]) assert.deepEqual(inspectPassword(password, { existing: true }), { length, error }, JSON.stringify(password));
});
