const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedTypes = new Set(["video/mp4", "video/webm", "image/png", "image/jpeg", "image/webp"]);
const privateHeaders = { "Cache-Control": "private, no-store", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff" };

// Pure shared policy. Adapters own filenames, source metadata and stream lifetimes.
// Registry membership never replaces the gateway's learner/version authorization.
export function createMediaPolicy(entries, validFile) {
	if (!Array.isArray(entries)) throw new Error("Private media entries must be an array.");
	const registry = new Map();
	for (const input of entries) {
		if (!input || typeof input.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(input.id) || registry.has(input.id)
			|| typeof input.sectionId !== "string" || !uuid.test(input.sectionId) || typeof input.contentVersionId !== "string" || !uuid.test(input.contentVersionId)
			|| !allowedTypes.has(input.type) || typeof input.title !== "string" || !input.title.trim() || input.title.length > 300
			|| typeof input.file !== "string" || !validFile(input.file)) throw new Error("Invalid private media descriptor.");
		const { id, sectionId, contentVersionId, type, title, file } = input;
		registry.set(id, Object.freeze({ id, sectionId, contentVersionId, type, title, file }));
	}
	return {
		lookup: id => registry.get(id),
		forSection(sectionId, contentVersionId) {
			return [...registry.values()].filter(entry => entry.sectionId === sectionId && entry.contentVersionId === contentVersionId)
				.map(({ id, title, type }) => ({ id, title, type, url: `/api/media/${id}` }));
		},
		request(entry, { method, range }) {
			if (!entry || registry.get(entry.id) !== entry || !["GET", "HEAD"].includes(method)) throw new Error("Invalid media delivery request.");
			const match = typeof range === "string" && range.length <= 200 && /^bytes=(\d+)-(\d*)$|^bytes=-(\d+)$/.exec(range);
			return {
				rangeHeader: match ? range : undefined,
				response(size) {
					if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Invalid media size.");
					let start = 0, end = size - 1, status = 200;
					if (range !== undefined) {
						status = 416;
						if (match) {
							start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[3]));
							end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
							if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end && start < size && (match[1] || Number(match[3]) !== 0)) status = 206;
						}
					}
					if (status === 416) return { status, headers: { ...privateHeaders, "Content-Range": `bytes */${size}` }, sendBody: false };
					const length = end - start + 1;
					return { status, start, end, length, sendBody: method === "GET", headers: {
						...privateHeaders, "Content-Type": entry.type, "Content-Length": length, "Accept-Ranges": "bytes",
						"Content-Disposition": "inline", "Cross-Origin-Resource-Policy": "same-origin",
						...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
					} };
				},
			};
		},
	};
}
