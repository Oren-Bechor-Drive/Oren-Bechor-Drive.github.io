import assert from "node:assert/strict";
import test from "node:test";
import { readLearningContent } from "../../scripts/learning-content.mjs";

test("authored learning content has valid section, quiz and return relationships", async () => {
	const { issues } = await readLearningContent(process.cwd());
	assert.deepEqual(issues, [], issues.join("\n"));
});
