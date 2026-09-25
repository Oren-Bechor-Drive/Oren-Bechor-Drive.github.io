// One page lifetime owns requests and their completion effects. Page modules own
// rendering and editing policy; suspended pages cannot accept old work.
export function createProtectedPage({ clear, restore, window: events = window, document: visibility = document }) {
	let lifetime = new AbortController();
	let suspended = visibility.hidden;
	let restoring = false;
	function invalidate(preserveState) {
		lifetime.abort();
		lifetime = new AbortController();
		clear({ preserveState });
	}
	function suspend() {
		suspended = true;
		invalidate(true);
	}
	function resume() {
		if (visibility.hidden || restoring) return;
		restoring = true;
		queueMicrotask(() => {
			restoring = false;
			if (visibility.hidden) return;
			suspended = false;
			// Also invalidate work when the browser restores without a visibility event.
			invalidate(true);
			restore();
		});
	}
	events.addEventListener("pagehide", suspend);
	events.addEventListener("pageshow", event => { if (event.persisted) resume(); });
	visibility.addEventListener("visibilitychange", () => { if (visibility.hidden) suspend(); else resume(); });
	return {
		reset({ preserveState = false } = {}) { invalidate(preserveState); },
		async run(work, { error = () => {}, finish = () => {} } = {}) {
			if (suspended || visibility.hidden) return;
			const owner = lifetime;
			const current = () => owner === lifetime && !owner.signal.aborted && !visibility.hidden;
			const check = () => { if (!current()) throw new DOMException("Obsolete operation", "AbortError"); };
			const request = async (path, { body, csrf } = {}) => {
				check();
				const response = await fetch(path, { credentials: "same-origin", cache: "no-store",
					signal: AbortSignal.any([owner.signal, AbortSignal.timeout(10000)]),
					...(body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify(body) }) });
				const data = await response.json();
				check();
				if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
				return data;
			};
			try { await work({ request, commit: action => { if (current()) action(); } }); }
			catch (failure) { if (current()) error(failure); }
			finally { if (current()) finish(); }
		},
	};
}
