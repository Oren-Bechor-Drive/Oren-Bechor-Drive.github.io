import assert from "node:assert/strict";
import test from "node:test";
import { createAdmission } from "../../server/admission.mjs";
import { createLearnerAccounts } from "../../server/learner-accounts.mjs";
import { accountProvider } from "../helpers/account-gateway.mjs";
const origin = "https://course.example.test";
const settings = { REGISTRATION_MODE: "pilot", PILOT_EMAILS: "owner@example.test" };
const credentials = email => ({ email, password:"correct-password" });

test("pilot rejects a verified outsider before learner provisioning and suppresses account email", async () => {
 const provider = accountProvider();
 const accounts = createLearnerAccounts({ origin, provider, admit:createAdmission(settings) });
 const anonymous = await accounts.session();
 const token = anonymous.cookie.token;
 await assert.rejects(accounts.perform(token,"login",credentials("outsider@example.test")), { status:401 });
 assert.equal(provider.calls.some(([name]) => name === "provision"),false);
 assert.equal(provider.tokens.size,0);
 for (const route of ["register","recover"]) assert.deepEqual((await accounts.perform(token,route,credentials("outsider@example.test"))).data,{ok:true});
 assert.equal(provider.calls.some(([name]) => name === "signup" || name === "recover"),false);
 const signed = await accounts.perform(token,"login",credentials("owner@example.test"));
 assert.equal(signed.data.user.email,"owner@example.test");
});

test("admission checks provider identity instead of submitted email", async () => {
 const provider = accountProvider({ createSessionUser: () => ({ id:"outsider",email:"outsider@example.test",email_confirmed_at:"2026-01-01" }) });
 const accounts = createLearnerAccounts({ origin, provider, admit:createAdmission(settings) });
 const anonymous = await accounts.session();
 await assert.rejects(accounts.perform(anonymous.cookie.token,"login",credentials("owner@example.test")), { status:401 });
 assert.equal(provider.calls.some(([name]) => name === "provision"),false);
});

test("Google and recovery callbacks enforce the same tester restriction", async () => {
 for (const route of ["google","recover"]) {
  const provider = accountProvider();
  const accounts = createLearnerAccounts({ origin, provider, googleEnabled:true, admit:createAdmission(settings) });
  const anonymous = await accounts.session();
  await accounts.perform(anonymous.cookie.token,route,credentials("owner@example.test"));
  const call = provider.calls.find(([name]) => name === route);
  const flow = call.at(-1);
  const result = await accounts.completeCallback(anonymous.cookie.token,{state:flow.state,code:"valid-code"});
  assert.equal(result.redirect,"/account/login.html?status=link-expired");
  assert.equal(result.cookie,undefined);
  assert.equal(provider.tokens.size,0);
 }
});

test("closing admission revokes an existing learner session on its next read", async () => {
 let admit = createAdmission(settings);
 const provider = accountProvider();
 const accounts = createLearnerAccounts({ origin,provider,admit:email => admit(email) });
 const anonymous = await accounts.session();
 const signed = await accounts.perform(anonymous.cookie.token,"login",credentials("owner@example.test"));
 admit = createAdmission({ REGISTRATION_MODE:"closed" });
 const current = await accounts.session(signed.cookie.token);
 assert.equal(current.data.user,null);
 assert.notEqual(current.cookie.token,signed.cookie.token);
});
