import assert from "node:assert/strict";
import test from "node:test";
import { createQuizAttemptEditor } from "../../account/quiz-attempt-editor.js";

const draft = (answers = {}, revision = 1) => ({
	id: "attempt-one", topicKey: "topic-one", title: "תרגול בדיקה", status: "draft", revision, answers,
	questions: ["q1", "q2"].map(id => ({ id, prompt: id, options: [{ id: "a", text: "א" }, { id: "b", text: "ב" }] })),
});
function deferred() {
	let resolve, reject;
	const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

test("saving drains edits made during a pending write before submission", async () => {
	const editor = createQuizAttemptEditor();
	editor.load(draft());
	editor.choose("q1", "a");
	const first = deferred();
	const writes = [];
	const request = async (path, body) => {
		writes.push({ path, body });
		if (writes.length === 1) return first.promise;
		if (path.endsWith("/submit")) return { ...draft({ q1: "b", q2: "a" }, 4), status: "submitted", score: 1, passed: false, results: [] };
		return draft(body.answers, 3);
	};
	const saving = editor.save(request);
	editor.choose("q1", "b");
	editor.choose("q2", "a");
	const submitting = editor.submit(request);
	assert.equal(writes.length, 1);
	first.resolve(draft({ q1: "a" }, 2));
	await saving;
	assert.deepEqual(await submitting, { status: "submitted" });
	assert.deepEqual(writes, [
		{ path: "attempts/attempt-one/save", body: { answers: { q1: "a" }, expectedRevision: 1 } },
		{ path: "attempts/attempt-one/save", body: { answers: { q1: "b", q2: "a" }, expectedRevision: 2 } },
		{ path: "attempts/attempt-one/submit", body: { expectedRevision: 3 } },
	]);
	assert.equal(editor.view.editable, false);
	assert.equal(editor.view.unsaved, false);
});

test("incomplete and conflicted attempts cannot submit or silently overwrite answers", async () => {
	const editor = createQuizAttemptEditor();
	editor.load(draft());
	const forbidden = () => { throw new Error("must not send"); };
	assert.deepEqual(await editor.submit(forbidden), { status: "incomplete", questionId: "q1" });
	editor.choose("q1", "a");
	editor.choose("q2", "b");
	await assert.rejects(editor.save(async () => { throw Object.assign(new Error("conflict"), { status: 409 }); }), { status: 409 });
	assert.equal(editor.view.conflict, true);
	editor.choose("q1", "b");
	assert.deepEqual(editor.view.answers, { q1: "a", q2: "b" });
	assert.equal(await editor.save(forbidden), false);
	assert.deepEqual(await editor.submit(forbidden), { status: "blocked" });
	editor.load(draft({ q1: "b" }, 3));
	assert.equal(editor.view.conflict, false);
	assert.equal(editor.view.dirty, false);
});

test("held drafts retain their base revision across failed and repeated restoration", async () => {
	const editor = createQuizAttemptEditor();
	editor.load(draft({ q1: "a" }, 2));
	editor.choose("q1", "b");
	editor.clear({ preserveDraft: true });
	editor.clear({ preserveDraft: true });
	assert.equal(editor.view.attempt, null);
	assert.deepEqual(editor.view.answers, {});
	assert.equal(editor.view.unsaved, true);
	await assert.rejects(editor.restore(async () => { throw new Error("offline"); }), /offline/);
	for (let i = 0; i < 2; i++) {
		editor.clear({ preserveDraft: true });
		assert.equal(await editor.restore(async path => {
			assert.equal(path, "attempts/attempt-one");
			return draft({ q1: "a", q2: "a" }, 3);
		}), "conflict");
		assert.deepEqual(editor.view.answers, { q1: "b" });
		assert.equal(editor.view.conflict, true);
	}
	editor.clear();
	assert.equal(editor.view.unsaved, false);
	assert.equal(await editor.restore(() => { throw new Error("must not restore cleared draft"); }), "none");
});

test("restore accepts an already-saved draft and never restores edits over a submission", async () => {
	for (const submitted of [false, true]) {
		const editor = createQuizAttemptEditor();
		editor.load(draft());
		editor.choose("q1", "b");
		editor.clear({ preserveDraft: true });
		const saved = submitted
			? { ...draft({ q1: "a", q2: "a" }, 3), status: "submitted", score: 2, passed: true, results: [] }
			: draft({ q1: "b" }, 2);
		assert.equal(await editor.restore(async () => saved), submitted ? "submitted" : "saved");
		assert.deepEqual(editor.view.answers, saved.answers);
		assert.equal(editor.view.unsaved, false);
	}
});

test("a failed save keeps choices for retry and a stale save cannot replace a new attempt", async () => {
	const editor = createQuizAttemptEditor();
	editor.load(draft());
	editor.choose("q1", "b");
	await assert.rejects(editor.save(async () => { throw new Error("offline"); }), /offline/);
	assert.equal(editor.view.dirty, true);
	const late = deferred();
	const saving = editor.save(() => late.promise);
	editor.clear({ preserveDraft: true });
	assert.equal(await editor.restore(async () => draft()), "draft");
	assert.deepEqual(editor.view.answers, { q1: "b" });
	editor.choose("q2", "a");
	await editor.save(async (_path, body) => draft(body.answers, 2));
	late.resolve(draft({ q1: "b" }, 2));
	await assert.rejects(saving, { name: "AbortError" });
	assert.deepEqual(editor.view.answers, { q1: "b", q2: "a" });
	assert.equal(editor.view.dirty, false);
});

test("rendering snapshots cannot mutate editor answers or its saved revision", async () => {
	const editor = createQuizAttemptEditor();
	const source = draft({ q1: "a" }, 7);
	editor.load(source);
	source.answers.q1 = "b";
	const view = editor.view;
	view.answers.q1 = "b";
	view.attempt.revision = 99;
	editor.choose("q2", "a");
	await editor.save(async (_path, body) => {
		assert.deepEqual(body, { answers: { q1: "a", q2: "a" }, expectedRevision: 7 });
		return draft(body.answers, 8);
	});
	assert.equal(editor.view.unsaved, false);
});

test("saving an unchanged attempt does not suppress a later edit", async () => {
	const editor = createQuizAttemptEditor();
	editor.load(draft());
	await editor.save(() => { throw new Error("no write needed"); });
	editor.choose("q1", "b");
	await editor.save(async (_path, body) => draft(body.answers, 2));
	assert.equal(editor.view.dirty, false);
	assert.equal(editor.view.attempt.revision, 2);
});

for (const failure of [false, true]) {
	test(`a reverted choice survives a ${failure ? "failed" : "pending"} write and suspension`, async () => {
		const editor = createQuizAttemptEditor();
		editor.load(draft({ q1: "a" }));
		editor.choose("q1", "b");
		const response = deferred();
		const saving = editor.save(() => response.promise);
		editor.choose("q1", "a");
		if (failure) {
			response.reject(Object.assign(new Error("response lost"), { status: 503 }));
			await assert.rejects(saving, { status: 503 });
		}
		assert.equal(editor.view.unsaved, true, "a remote write may still hold the earlier choice");
		editor.clear({ preserveDraft: true });
		assert.equal(editor.view.unsaved, true, "unload protection retains the held draft");
		assert.equal(await editor.restore(async () => draft({ q1: "b" }, 2)), "conflict");
		assert.deepEqual(editor.view.answers, { q1: "a" });
		if (!failure) {
			response.resolve(draft({ q1: "b" }, 2));
			await assert.rejects(saving, { name: "AbortError" });
		}
	});
}
