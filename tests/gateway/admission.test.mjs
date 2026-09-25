import assert from "node:assert/strict";
import test from "node:test";
import { createAdmission } from "../../server/admission.mjs";

test("hosted registration is closed unless explicitly configured", () => {
 const admit = createAdmission({});
 assert.equal(admit("owner@example.test"), false);
 assert.equal(createAdmission({ REGISTRATION_MODE: "closed", PILOT_EMAILS: "owner@example.test" })("owner@example.test"), false);
});

test("pilot admits only one or two configured testers, without a timer", () => {
 const admit = createAdmission({ REGISTRATION_MODE: "pilot", PILOT_EMAILS: "Owner@example.test, oren@example.test" });
 assert.equal(admit("owner@example.test"), true);
 assert.equal(admit("OREN@example.test"), true);
 for (const email of ["other@example.test", "owner@example.test.evil", null, "", " owner@example.test "]) assert.equal(admit(email), false);
 for (const PILOT_EMAILS of ["", "bad-address", "a@example.test,b@example.test,c@example.test", "a@example.test,a@example.test"]) {
  assert.throws(() => createAdmission({ REGISTRATION_MODE: "pilot", PILOT_EMAILS }));
 }
});

test("public opening is explicit and requires both registration methods", () => {
 assert.throws(() => createAdmission({ REGISTRATION_MODE: "typo" }));
 assert.throws(() => createAdmission({ REGISTRATION_MODE: "public" }));
 const admit = createAdmission({ REGISTRATION_MODE: "public", GOOGLE_AUTH_ENABLED: "true" });
 assert.equal(admit("learner@example.test"), true);
 assert.equal(admit(null), false);
});
