import assert from "node:assert/strict";
import test from "node:test";
import { accountProvider } from "../helpers/account-gateway.mjs";

test("the deterministic provider creates session identity before issuing login, callback and refresh tokens", async () => {
	const created = new Map();
	const provider = accountProvider({
		async createSessionUser(email, token) {
			if (email === "failed@example.test") throw new Error("session creation failed");
			const user = { id: "stable-user-id", email, email_confirmed_at: "2026-01-01", is_anonymous: false };
			created.set(token, user);
			return user;
		},
	});
	await assert.rejects(provider.password("failed@example.test", "correct-password"), /session creation failed/);
	assert.equal(provider.tokens.size, 0);
	const password = await provider.password("learner@example.test", "correct-password");
	const callback = await provider.exchange("valid-code", "verifier");
	const refresh = await provider.refresh(password.refresh_token);
	assert.equal(new Set([password, callback, refresh].map(data => data.access_token)).size, 3);
	for (const data of [password, callback, refresh]) {
		assert.equal(data.user.id, "stable-user-id");
		assert.deepEqual(await provider.identity(data.access_token), created.get(data.access_token));
	}
});
