// Protected Quiz attempt policy. Requests are supplied by the page's authorized
// lifetime; the editor owns answer snapshots and revision transitions, not DOM.
export function createQuizAttemptEditor() {
	let current = null;
	let heldDraft = null;
	let generation = 0;
	const sameAnswers = (left, right) => Object.keys(left).length === Object.keys(right).length &&
		Object.entries(left).every(([key, value]) => right[key] === value);
	const dirty = state => state?.dirty ?? false;
	const obsolete = () => new DOMException("Obsolete Quiz attempt", "AbortError");
	function check(state) {
		if (current !== state) throw obsolete();
	}
	function load(data) {
		generation++;
		current = {
			attempt: structuredClone(data), answers: { ...data.answers }, baseRevision: data.revision,
			dirty: false, conflict: false, saving: null, submitting: null,
		};
		heldDraft = null;
	}
	function editable() {
		return Boolean(current?.attempt.status === "draft" && !current.conflict && !current.submitting);
	}
	function clear({ preserveDraft = false } = {}) {
		if (!preserveDraft) heldDraft = null;
		else if (dirty(current) && current.attempt.status === "draft") {
			heldDraft = { id: current.attempt.id, revision: current.baseRevision, answers: { ...current.answers } };
		}
		current = null;
		generation++;
	}
	async function restore(request) {
		if (!heldDraft) return "none";
		const draft = heldDraft;
		const owner = generation;
		const saved = await request(`attempts/${draft.id}`);
		if (owner !== generation) throw obsolete();
		load(saved);
		if (saved.status === "submitted") return "submitted";
		if (sameAnswers(saved.answers, draft.answers)) return "saved";
		current.answers = { ...draft.answers };
		current.dirty = true;
		current.baseRevision = draft.revision;
		current.conflict = saved.revision !== draft.revision;
		return current.conflict ? "conflict" : "draft";
	}
	function save(request) {
		const state = current;
		if (!state || state.attempt.status !== "draft" || state.conflict) return Promise.resolve(false);
		if (state.saving) return state.saving;
		if (!dirty(state)) return Promise.resolve(true);
		state.saving = (async () => {
			try {
				while (dirty(state)) {
					const answers = { ...state.answers };
					const saved = await request(`attempts/${state.attempt.id}/save`, {
						answers, expectedRevision: state.attempt.revision,
					});
					check(state);
					state.attempt = structuredClone(saved);
					state.baseRevision = saved.revision;
					state.dirty = !sameAnswers(answers, state.answers);
				}
				return true;
			} catch (error) {
				if (current === state && error.status === 409) state.conflict = true;
				throw error;
			} finally {
				state.saving = null;
			}
		})();
		return state.saving;
	}
	function submit(request) {
		const state = current;
		if (!state || state.attempt.status !== "draft" || state.conflict) return Promise.resolve({ status: "blocked" });
		if (state.submitting) return state.submitting;
		const missing = state.attempt.questions.find(question => !state.answers[question.id]);
		if (missing) return Promise.resolve({ status: "incomplete", questionId: missing.id });
		state.submitting = (async () => {
			try {
				if (!await save(request)) return { status: "blocked" };
				check(state);
				const submitted = await request(`attempts/${state.attempt.id}/submit`, { expectedRevision: state.attempt.revision });
				check(state);
				load(submitted);
				return { status: "submitted" };
			} catch (error) {
				if (current === state && error.status === 409) state.conflict = true;
				throw error;
			} finally {
				state.submitting = null;
			}
		})();
		return state.submitting;
	}
	return {
		load, clear, restore, save, submit,
		choose(questionId, optionId) {
			if (!editable()) return;
			const question = current.attempt.questions.find(question => question.id === questionId);
			if (!question?.options.some(option => option.id === optionId)) return;
			current.answers[questionId] = optionId;
			// Even a revert must be saved: an earlier write may still commit.
			current.dirty = true;
		},
		get view() {
			return {
				attempt: current ? structuredClone(current.attempt) : null,
				answers: { ...current?.answers }, dirty: dirty(current), conflict: current?.conflict ?? false,
				editable: editable(), unsaved: dirty(current) || Boolean(heldDraft),
			};
		},
	};
}
