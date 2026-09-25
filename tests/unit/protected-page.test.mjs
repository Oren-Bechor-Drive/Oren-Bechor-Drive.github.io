import assert from "node:assert/strict";
import test from "node:test";
import { createProtectedPage } from "../../account/protected-page.js";

function fixture() {
	const events = new EventTarget();
	const visibility = new EventTarget();
	visibility.hidden = false;
	const cleared = [];
	let restored = 0;
	const page = createProtectedPage({ clear: options => cleared.push(options), restore: () => { restored++; }, window: events, document: visibility });
	return { page, events, visibility, cleared, restored: () => restored };
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test("reset rejects a received response before parsing finishes and suppresses stale error/finalization", async () => {
	const f = fixture();
	const body = deferred();
	const entered = deferred();
	const original = globalThis.fetch;
	let signal;
	globalThis.fetch = async (_url, options) => { signal = options.signal; entered.resolve(); return { ok: true, json: () => body.promise }; };
	try {
		const changes = [];
		const pending = f.page.run(async ({ request }) => { changes.push(await request("/api/sections")); }, { error: () => changes.push("error"), finish: () => changes.push("finish") });
		await entered.promise;
		f.page.reset();
		assert.equal(signal.aborted, true);
		body.resolve({ private: "obsolete" });
		await pending;
		assert.deepEqual(changes, []);
	} finally { globalThis.fetch = original; }
});

test("late failures cannot replace a new operation's result", async () => {
	const f = fixture();
	const late = deferred();
	const changes = [];
	const old = f.page.run(() => late.promise, { error: () => changes.push("old error"), finish: () => changes.push("old finish") });
	f.page.reset();
	await f.page.run(async () => { changes.push("current"); }, { finish: () => changes.push("current finish") });
	late.reject(new Error("late"));
	await old;
	assert.deepEqual(changes, ["current", "current finish"]);
});

test("suspension clears private rendering, refuses hidden work, then restores once", async () => {
	const f = fixture();
	f.visibility.hidden = true;
	f.visibility.dispatchEvent(new Event("visibilitychange"));
	f.events.dispatchEvent(new Event("pagehide"));
	assert.ok(f.cleared.every(item => item.preserveState));
	let ran = false;
	await f.page.run(() => { ran = true; });
	assert.equal(ran, false);
	f.visibility.hidden = false;
	f.visibility.dispatchEvent(new Event("visibilitychange"));
	f.events.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
	await Promise.resolve();
	assert.equal(f.restored(), 1);
});

test("active failures report normally and invalidating from error prevents finalization", async () => {
	const f = fixture();
	const changes = [];
	await f.page.run(async () => { throw Object.assign(new Error("denied"), { status: 401 }); }, {
		error: error => { changes.push(error.status); f.page.reset(); }, finish: () => changes.push("stale finish") });
	assert.deepEqual(changes, [401]);
});

test("deferred rendering and requests from an invalidated operation cannot touch a restored page", async () => {
	const f = fixture();
	let old;
	await f.page.run(async scope => { old = scope; });
	f.page.reset();
	let rendered = false;
	old.commit(() => { rendered = true; });
	assert.equal(rendered, false);
	await assert.rejects(old.request("/must-not-fetch"), { name: "AbortError" });
	await f.page.run(async ({ commit }) => commit(() => { rendered = true; }));
	assert.equal(rendered, true);
});
