// Reader-owned opaque progress. Rendering and authorization remain with the page.
export function createReaderPosition({ send }) {
	let state, active, inFlight;
	function hydrate(input) {
		const old = state;
		const same = old && old.contentVersionId === input.contentVersionId && old.csrf === input.csrf;
		const dirty = same && old.latest !== old.saved;
		const unchanged = same && old.revision === input.revision && old.saved === input.position;
		const observedWrite = same && inFlight
			&& old.contentVersionId === inFlight.input.contentVersionId && old.csrf === inFlight.input.csrf
			&& old.revision === inFlight.input.expectedRevision
			&& input.revision === inFlight.input.expectedRevision + 1 && input.position === inFlight.input.position;
		state = { ...input, saved: input.position, latest: dirty ? old.latest : input.position };
		if (dirty && (!unchanged && !observedWrite || old.error)) {
			state.error = Object.assign(new Error("position_conflict"), { status: 409 });
			throw state.error;
		}
		return state.latest;
	}
	async function drain() {
		while (state) {
			if (state.error) throw state.error;
			if (state.latest === state.saved) return;
			const owner = state;
			const input = { contentVersionId: owner.contentVersionId, position: owner.latest,
				expectedRevision: owner.revision, csrf: owner.csrf };
			inFlight = { owner, input };
			try {
				const { position } = await send(input);
				if (!position || position.contentVersionId !== input.contentVersionId || position.position !== input.position
					|| !Number.isSafeInteger(position.revision) || ![input.expectedRevision, input.expectedRevision + 1].includes(position.revision)) {
					throw Object.assign(new Error("unavailable"), { status: 503 });
				}
				// A fresh GET can acknowledge this write before its transport reply arrives.
				if (state && state.contentVersionId === input.contentVersionId && state.csrf === input.csrf && !state.error
					&& (state === owner || state.revision === input.expectedRevision
						|| state.revision === position.revision && state.saved === position.position)) {
					state.saved = position.position;
					state.revision = position.revision;
				}
			} catch (error) {
				if (state === owner) {
					if ([401, 404, 409].includes(error.status)) state.error = error;
					throw error;
				}
			} finally { inFlight = undefined; }
		}
	}
	return {
		hydrate,
		update(position) {
			if (!Number.isInteger(position) || position < 0 || position > 10000) throw new Error("Invalid reading position");
			if (state && !state.error) state.latest = position;
		},
		flush() {
			if (!active) active = drain().finally(() => { active = undefined; });
			return active;
		},
		async settled() { await active?.catch(() => {}); },
		clear() { state = undefined; },
	};
}
