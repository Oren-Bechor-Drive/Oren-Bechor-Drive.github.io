// Reader-owned opaque progress. Rendering and authorization remain with the page.
export function createReaderPosition({ send }) {
	let state, active, inFlight;
	function hydrate({ contentVersionId, csrf, savedPosition }) {
		const old = state;
		const contentChanged = Boolean(savedPosition && savedPosition.contentVersionId !== contentVersionId);
		const acknowledged = Boolean(savedPosition && !contentChanged);
		const input = { contentVersionId, csrf, position: acknowledged ? savedPosition.position : 0,
			revision: savedPosition?.revision ?? 0 };
		const same = old && old.contentVersionId === input.contentVersionId && old.csrf === input.csrf;
		const dirty = same && (old.latest !== old.saved || old.pendingInitial);
		const unchanged = same && old.revision === input.revision && old.saved === input.position && old.acknowledged === acknowledged;
		const observedWrite = same && acknowledged && inFlight
			&& old.contentVersionId === inFlight.input.contentVersionId && old.csrf === inFlight.input.csrf
			&& old.revision === inFlight.input.expectedRevision
			&& input.revision === inFlight.input.expectedRevision + 1 && input.position === inFlight.input.position;
		state = { contentVersionId, csrf, revision: input.revision, acknowledged,
			saved: input.position, latest: dirty ? old.latest : input.position,
			pendingInitial: Boolean(dirty && old.pendingInitial && !acknowledged) };
		if (dirty && (!unchanged && !observedWrite || old.error)) {
			state.error = Object.assign(new Error("position_conflict"), { status: 409 });
			throw state.error;
		}
		return { position: state.latest, contentChanged };
	}
	async function drain() {
		while (state) {
			if (state.error) throw state.error;
			if (state.latest === state.saved && !state.pendingInitial) return;
			const owner = state;
			const input = { contentVersionId: owner.contentVersionId, position: owner.latest,
				expectedRevision: owner.revision, csrf: owner.csrf };
			inFlight = { owner, input };
			try {
				const { position } = await send(input);
				// An idempotent write can acknowledge the same position after other writes.
				if (!position || position.contentVersionId !== input.contentVersionId || position.position !== input.position
					|| !Number.isSafeInteger(position.revision) || position.revision < 1 || position.revision < input.expectedRevision) {
					throw Object.assign(new Error("unavailable"), { status: 503 });
				}
				// A fresh GET can acknowledge this write before its transport reply arrives.
				if (state && state.contentVersionId === input.contentVersionId && state.csrf === input.csrf && !state.error
					&& (state === owner || state.revision === input.expectedRevision
						|| state.revision === position.revision && state.saved === position.position)) {
					state.saved = position.position;
					state.revision = position.revision;
					state.acknowledged = true;
					state.pendingInitial = false;
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
			if (state && !state.error) {
				state.latest = position;
				if (!state.acknowledged) state.pendingInitial = true;
			}
		},
		flush() {
			if (!active) active = drain().finally(() => { active = undefined; });
			return active;
		},
		clear() { state = undefined; },
	};
}
