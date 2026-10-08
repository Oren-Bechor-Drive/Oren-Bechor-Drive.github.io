import assert from "node:assert/strict";
import test from "node:test";
import { createReaderPosition } from "../../account/reader-position.js";

const version = "11111111-1111-4111-8111-111111111111";
const snapshot = (changes = {}) => ({ contentVersionId: version, position: 2000, revision: 1, csrf: "fixture-csrf", ...changes });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test("flush drains a newer position after an in-flight save using its acknowledged revision", async () => {
	const first = deferred(), requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		if (requests.length === 1) await first.promise;
		return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
	} });
	saver.hydrate(snapshot());
	saver.update(3000);
	const pending = saver.flush();
	saver.update(7500);
	assert.equal(saver.flush(), pending);
	first.resolve();
	await pending;
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[3000, 1], [7500, 2]]);
	await saver.flush();
	assert.equal(requests.length, 2);
});

test("a fresh authorized snapshot preserves unsaved position only at a matching revision", async () => {
	const requests = [];
	const saver = createReaderPosition({ send: async input => { requests.push(input); return { position: { ...input, revision: input.expectedRevision + 1 } }; } });
	saver.hydrate(snapshot());
	saver.update(7500);
	assert.equal(saver.hydrate(snapshot()), 7500);
	await saver.flush();
	assert.equal(requests[0].csrf, "fixture-csrf");
	saver.update(8000);
	assert.throws(() => saver.hydrate(snapshot({ position: 4000, revision: 3 })), { status: 409 });
	await assert.rejects(saver.flush(), { status: 409 });
	assert.equal(requests.length, 1);
});

test("restore recognizes an authorized snapshot of its in-flight write without losing a newer position", async () => {
	const first = deferred(), requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		if (requests.length === 1) await first.promise;
		return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
	} });
	saver.hydrate(snapshot());
	saver.update(3000);
	const pending = saver.flush();
	saver.update(7500);
	assert.equal(saver.hydrate(snapshot({ position: 3000, revision: 2 })), 7500);
	first.resolve();
	await pending;
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[3000, 1], [7500, 2]]);
});

test("an obsolete save failure does not poison a freshly authorized view", async () => {
	const old = deferred();
	const saver = createReaderPosition({ send: () => old.promise });
	saver.hydrate(snapshot());
	saver.update(7500);
	const pending = saver.flush();
	saver.hydrate(snapshot({ position: 7500, revision: 2 }));
	old.reject(Object.assign(new Error(), { status: 503 }));
	await pending;
	await saver.flush();
});

test("changed content and explicit clearing discard pending local position", async () => {
	const requests = [];
	const saver = createReaderPosition({ send: async input => { requests.push(input); return { position: { ...input, revision: input.expectedRevision + 1 } }; } });
	saver.hydrate(snapshot());
	saver.update(7500);
	assert.equal(saver.hydrate(snapshot({ contentVersionId: "22222222-2222-4222-8222-222222222222", position: 0, revision: 0 })), 0);
	await saver.flush();
	assert.equal(requests.length, 0);
	saver.update(4000);
	saver.clear();
	await saver.flush();
	assert.equal(requests.length, 0);
});

test("a rotated session never replays the previous session's unsaved position", async () => {
	let requests = 0;
	const saver = createReaderPosition({ send: async () => { requests++; } });
	saver.hydrate(snapshot());
	saver.update(7500);
	assert.equal(saver.hydrate(snapshot({ csrf: "different-session" })), 2000);
	await saver.flush();
	assert.equal(requests, 0);
});

for (const status of [401, 404, 409]) {
	test(`save denial ${status} cannot be silently retried or treated as persisted`, async () => {
		let requests = 0;
		const saver = createReaderPosition({ send: async () => { requests++; throw Object.assign(new Error(), { status }); } });
		saver.hydrate(snapshot());
		saver.update(7500);
		await assert.rejects(saver.flush(), { status });
		await assert.rejects(saver.flush(), { status });
		assert.equal(requests, 1);
		await saver.settled();
	});
}
