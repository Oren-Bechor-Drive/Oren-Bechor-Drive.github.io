import assert from "node:assert/strict";
import test from "node:test";
import { createReaderPosition } from "../../account/reader-position.js";

const version = "11111111-1111-4111-8111-111111111111";
const positionRow = (changes = {}) => ({ contentVersionId: version, position: 2000, revision: 1, ...changes });
const snapshot = (changes = {}) => ({ contentVersionId: version, savedPosition: positionRow(), csrf: "fixture-csrf", ...changes });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test("an explicit initial zero position is persisted only after the server acknowledges it", async () => {
	const requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: 1 } };
	} });
	const initial = snapshot({ savedPosition: null });
	assert.deepEqual(saver.hydrate(initial), { position: 0, contentChanged: false });
	await saver.flush();
	assert.equal(requests.length, 0, "loading a new section alone does not claim saved progress");
	saver.update(0);
	assert.deepEqual(saver.hydrate(initial), { position: 0, contentChanged: false }, "restoration preserves the explicit pending save");
	await saver.flush();
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[0, 0]]);
	await saver.flush();
	assert.equal(requests.length, 1, "acknowledged zero is not saved repeatedly");
});

test("a missing initial revision cannot masquerade as an acknowledged position", async () => {
	const saver = createReaderPosition({ send: async input => ({ position: {
		contentVersionId: input.contentVersionId, position: input.position, revision: 0,
	} }) });
	saver.hydrate(snapshot({ savedPosition: null }));
	saver.update(0);
	await assert.rejects(saver.flush(), { status: 503 });
});

test("an explicit zero on a new content version retains the old row revision until acknowledged", async () => {
	const requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
	} });
	const freshVersion = snapshot({ savedPosition: positionRow({ contentVersionId: "22222222-2222-4222-8222-222222222222", position: 4500, revision: 3 }) });
	assert.deepEqual(saver.hydrate(freshVersion), { position: 0, contentChanged: true });
	await saver.flush();
	assert.equal(requests.length, 0);
	saver.update(0);
	assert.deepEqual(saver.hydrate(freshVersion), { position: 0, contentChanged: true });
	await saver.flush();
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[0, 3]]);
	saver.hydrate(snapshot({ savedPosition: positionRow({ position: 0, revision: 4 }) }));
	saver.update(0);
	await saver.flush();
	assert.equal(requests.length, 1);
});

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

test("an idempotent acknowledgement ahead of the base revision drains newer queued progress", async () => {
	const first = deferred(), requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		if (requests.length === 1) {
			await first.promise;
			return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: 3 } };
		}
		return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
	} });
	saver.hydrate(snapshot());
	saver.update(3000);
	const pending = saver.flush();
	saver.update(7500);
	first.resolve();
	await pending;
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[3000, 1], [7500, 3]]);
	await saver.flush();
	assert.equal(requests.length, 2);
});

test("an idempotent acknowledgement advances an already restored matching revision", async () => {
	const first = deferred(), requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		if (requests.length === 1) return first.promise;
		return { position: positionRow({ position: input.position, revision: 5 }) };
	} });
	saver.hydrate(snapshot());
	saver.update(3000);
	const pending = saver.flush();
	saver.update(7500);
	assert.deepEqual(saver.hydrate(snapshot({ savedPosition: positionRow({ position: 3000, revision: 2 }) })),
		{ position: 7500, contentChanged: false });
	first.resolve({ position: positionRow({ position: 3000, revision: 4 }) });
	await pending;
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[3000, 1], [7500, 4]]);
	await saver.flush();
	assert.equal(requests.length, 2);
});

test("an older acknowledgement cannot regress a newer restored matching revision", async () => {
	const first = deferred(), requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		if (requests.length === 1) return first.promise;
		return { position: positionRow({ position: input.position, revision: 5 }) };
	} });
	saver.hydrate(snapshot());
	saver.update(3000);
	const pending = saver.flush();
	assert.deepEqual(saver.hydrate(snapshot({ savedPosition: positionRow({ position: 3000, revision: 2 }) })),
		{ position: 3000, contentChanged: false });
	assert.deepEqual(saver.hydrate(snapshot({ savedPosition: positionRow({ position: 3000, revision: 4 }) })),
		{ position: 3000, contentChanged: false });
	first.resolve({ position: positionRow({ position: 3000, revision: 2 }) });
	await pending;
	saver.update(7500);
	await saver.flush();
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[3000, 1], [7500, 4]]);
});

test("unrelated or invalid acknowledgements cannot advance the saved revision", async () => {
	for (const changed of [{ revision: -1 }, { revision: 0 }, { revision: 1 }, { revision: 2.5 },
		{ revision: Number.MAX_SAFE_INTEGER + 1 }, { revision: "3" },
		{ contentVersionId: "22222222-2222-4222-8222-222222222222" }, { position: 9000 }]) {
		const requests = [];
		const saver = createReaderPosition({ send: async input => {
			requests.push(input);
			return { position: positionRow({ position: input.position, revision: 3, ...changed }) };
		} });
		saver.hydrate(snapshot({ savedPosition: positionRow({ revision: 2 }) }));
		saver.update(3000);
		await assert.rejects(saver.flush(), { status: 503 });
		await assert.rejects(saver.flush(), { status: 503 });
		assert.deepEqual(requests.map(({ expectedRevision }) => expectedRevision), [2, 2]);
	}
});

test("hydration selects opaque saved fields without retaining or forwarding the supplied row", async () => {
	const row = positionRow({ body: "private lesson text", title: "private lesson title", csrf: "row-csrf" });
	let request;
	const saver = createReaderPosition({ send: async input => {
		request = input;
		return { position: positionRow({ position: input.position, revision: 2 }) };
	} });
	assert.deepEqual(saver.hydrate(snapshot({ savedPosition: row })), { position: 2000, contentChanged: false });
	Object.assign(row, { contentVersionId: "different-version", position: 9000, revision: 99 });
	saver.update(3000);
	await saver.flush();
	assert.deepEqual(request, { contentVersionId: version, position: 3000, expectedRevision: 1, csrf: "fixture-csrf" });
});

test("a fresh authorized snapshot preserves unsaved position only at a matching revision", async () => {
	const requests = [];
	const saver = createReaderPosition({ send: async input => { requests.push(input); return { position: { ...input, revision: input.expectedRevision + 1 } }; } });
	saver.hydrate(snapshot());
	saver.update(7500);
	assert.deepEqual(saver.hydrate(snapshot()), { position: 7500, contentChanged: false });
	await saver.flush();
	assert.equal(requests[0].csrf, "fixture-csrf");
	saver.update(8000);
	assert.throws(() => saver.hydrate(snapshot({ savedPosition: positionRow({ position: 4000, revision: 3 }) })), { status: 409 });
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
	assert.deepEqual(saver.hydrate(snapshot({ savedPosition: positionRow({ position: 3000, revision: 2 }) })), { position: 7500, contentChanged: false });
	first.resolve();
	await pending;
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[3000, 1], [7500, 2]]);
});

test("restoration preserves a reverted position while the earlier write is still in flight", async () => {
	const first = deferred(), requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		if (requests.length === 1) await first.promise;
		return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
	} });
	saver.hydrate(snapshot());
	saver.update(3000);
	const pending = saver.flush();
	saver.update(2000);
	const restored = saver.hydrate(snapshot({ savedPosition: positionRow({ position: 3000, revision: 2 }) }));
	first.resolve();
	await pending;
	assert.deepEqual(restored, { position: 2000, contentChanged: false });
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[3000, 1], [2000, 2]]);
});

test("a reverted position remains pending after the earlier write loses its response", async () => {
	const first = deferred(), requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		if (requests.length === 1) return first.promise;
		return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
	} });
	saver.hydrate(snapshot());
	saver.update(3000);
	const pending = saver.flush();
	saver.update(2000);
	const rejected = assert.rejects(pending, { status: 503 });
	first.reject(Object.assign(new Error("response lost"), { status: 503 }));
	await rejected;
	await saver.flush();
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[3000, 1], [2000, 1]]);
});

for (const status of [401, 404, 409, 429, 503]) {
	test(`restoring an unacknowledged write does not silently retry its late failure ${status}`, async () => {
		const first = deferred(), requests = [];
		const saver = createReaderPosition({ send: async input => {
			requests.push(input);
			if (requests.length === 1) return first.promise;
			return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
		} });
		saver.hydrate(snapshot());
		saver.update(7500);
		const pending = saver.flush();
		assert.deepEqual(saver.hydrate(snapshot()), { position: 7500, contentChanged: false });
		const rejected = assert.rejects(pending, { status });
		first.reject(Object.assign(new Error("late failure"), { status }));
		await rejected;
		assert.equal(requests.length, 1);
		if ([401, 404, 409].includes(status)) {
			await assert.rejects(saver.flush(), { status });
			assert.equal(requests.length, 1);
		} else {
			await saver.flush();
			assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[7500, 1], [7500, 1]]);
		}
	});
}

test("an obsolete save failure does not poison a freshly authorized view", async () => {
	const old = deferred();
	const saver = createReaderPosition({ send: () => old.promise });
	saver.hydrate(snapshot());
	saver.update(7500);
	const pending = saver.flush();
	saver.hydrate(snapshot({ savedPosition: positionRow({ position: 7500, revision: 2 }) }));
	old.reject(Object.assign(new Error(), { status: 503 }));
	await pending;
	await saver.flush();
});

for (const status of [401, 404, 409, 503]) {
	test(`explicit clearing rejects old failure ownership at the same authorized revision ${status}`, async () => {
		const response = deferred(), requests = [];
		const saver = createReaderPosition({ send: input => { requests.push(input); return response.promise; } });
		saver.hydrate(snapshot());
		saver.update(7500);
		const pending = saver.flush();
		saver.clear();
		assert.deepEqual(saver.hydrate(snapshot()), { position: 2000, contentChanged: false });
		response.reject(Object.assign(new Error("obsolete failure"), { status }));
		await pending;
		await saver.flush();
		assert.equal(requests.length, 1);
	});
}

test("explicit clearing prevents an old acknowledgement from creating an unrequested write", async () => {
	const first = deferred(), requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		if (requests.length === 1) await first.promise;
		return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
	} });
	saver.hydrate(snapshot());
	saver.update(7500);
	const pending = saver.flush();
	saver.clear();
	saver.hydrate(snapshot());
	first.resolve();
	await pending;
	await saver.flush();
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[7500, 1]]);
});

test("an observed write from a cleared queue cannot reconcile a newer pending position", async () => {
	const first = deferred();
	const saver = createReaderPosition({ send: async input => {
		await first.promise;
		return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
	} });
	saver.hydrate(snapshot());
	saver.update(7500);
	const pending = saver.flush();
	saver.clear();
	saver.hydrate(snapshot());
	saver.update(8000);
	assert.throws(() => saver.hydrate(snapshot({ savedPosition: positionRow({ position: 7500, revision: 2 }) })), { status: 409 });
	const rejected = assert.rejects(pending, { status: 409 });
	first.resolve();
	await rejected;
});

test("repeated restores recognize the same pending acknowledgement and preserve the newest position", async () => {
	const first = deferred(), requests = [];
	const saver = createReaderPosition({ send: async input => {
		requests.push(input);
		if (requests.length === 1) await first.promise;
		return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
	} });
	saver.hydrate(snapshot());
	saver.update(7500);
	const pending = saver.flush();
	assert.deepEqual(saver.hydrate(snapshot()), { position: 7500, contentChanged: false });
	saver.update(8000);
	assert.deepEqual(saver.hydrate(snapshot()), { position: 8000, contentChanged: false });
	assert.deepEqual(saver.hydrate(snapshot({ savedPosition: positionRow({ position: 7500, revision: 2 }) })), { position: 8000, contentChanged: false });
	first.resolve();
	await pending;
	assert.deepEqual(requests.map(({ position, expectedRevision }) => [position, expectedRevision]), [[7500, 1], [8000, 2]]);
	assert.deepEqual(saver.hydrate(snapshot({ savedPosition: positionRow({ position: 8000, revision: 3 }) })), { position: 8000, contentChanged: false });
});

test("repeated restoration still rejects a different position or revision from another writer", async () => {
	for (const changed of [{ position: 6000, revision: 2 }, { position: 7500, revision: 3 }]) {
		const first = deferred();
		const saver = createReaderPosition({ send: async input => {
			await first.promise;
			return { position: { contentVersionId: input.contentVersionId, position: input.position, revision: input.expectedRevision + 1 } };
		} });
		saver.hydrate(snapshot());
		saver.update(7500);
		const pending = saver.flush();
		assert.deepEqual(saver.hydrate(snapshot()), { position: 7500, contentChanged: false });
		saver.update(8000);
		assert.throws(() => saver.hydrate(snapshot({ savedPosition: positionRow(changed) })), { status: 409 });
		const rejected = assert.rejects(pending, { status: 409 });
		first.resolve();
		await rejected;
	}
});

test("changed content and explicit clearing discard pending local position", async () => {
	const requests = [];
	const saver = createReaderPosition({ send: async input => { requests.push(input); return { position: { ...input, revision: input.expectedRevision + 1 } }; } });
	saver.hydrate(snapshot());
	saver.update(7500);
	assert.deepEqual(saver.hydrate(snapshot({ contentVersionId: "22222222-2222-4222-8222-222222222222" })), { position: 0, contentChanged: true });
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
	assert.deepEqual(saver.hydrate(snapshot({ csrf: "different-session" })), { position: 2000, contentChanged: false });
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
	});
}
