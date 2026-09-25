import { createStorageMedia } from "../../../server/storage-media.mjs";
import { createWorker } from "../../../server/worker-adapter.mjs";
const user = { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "learner@example.test", email_confirmed_at: "2026-01-01", is_anonymous: false };
const contentVersionId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let state = { sentChunks: 0, cancelled: false };
const media = createStorageMedia({ url: "https://example.supabase.co", secretKey: "sb_secret_fixture", bucket: "private", entries: [{ id: "stream", sectionId: user.id, contentVersionId, file: "private.mp4", type: "video/mp4", title: "וידאו" }],
	async fetcher(url, options) {
		const current = state = { sentChunks: 0, cancelled: false };
		options.signal.addEventListener("abort", () => { current.cancelled = true; });
		if (options.headers.range) return new Response(new Uint8Array([0, 1, 2, 3]), { status: 206, headers: { "content-type": "video/mp4", "content-length": "4", "content-range": "bytes 0-3/8388608" } });
		return new Response(new ReadableStream({
			async pull(controller) {
				await new Promise(resolve => setTimeout(resolve, 20));
				controller.enqueue(new Uint8Array(65536));
				if (++current.sentChunks === 128) controller.close();
			},
			cancel() { current.cancelled = true; },
		}), { headers: { "content-type": "video/mp4", "content-length": "8388608" } });
	},
});
const provider = {
	async password() { return { access_token: "access-secret", refresh_token: "refresh-secret", expires_in: 3600 }; },
	async identity() { return user; },
	async provision() {},
	async learner() { return { display_name: "לומד" }; },
	async logout() {},
	async readSection() { return { id: contentVersionId }; },
	async myLearning() { return { ...state }; },
};
let worker;
export default { async fetch(request, env, ctx) {
	worker ??= createWorker({ gatewayOptions: { origin: "https://course.example.test", provider, media, authLimit: 2 } });
	const response = await worker.fetch(request, env, ctx);
	response.headers.set("x-test-worker", "1");
	return response;
} };
