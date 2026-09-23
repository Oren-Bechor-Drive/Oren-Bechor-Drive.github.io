// Run manually with an owned, mode-0600 JSON fixture outside the repository.
// The operator owns fixture setup, phase changes, and finally-block SQL cleanup.
// This script never prints passwords or tokens and never uses a service-role key.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const [fixturePath, phase] = process.argv.slice(2);
assert.ok(fixturePath && ["initial", "expired", "renewed", "revoked"].includes(phase), "Supply fixture JSON path and phase");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const { url, key, sectionId } = fixture;
assert.equal(new URL(url).protocol, "https:");
let checks = 0;
async function request(path, { actor, method = "GET", body, headers = {} } = {}) {
	const response = await fetch(`${url}${path}`, {
		method,
		headers: { apikey: key, ...(actor ? {Authorization: `Bearer ${fixture[actor].token}`} : {}), "Content-Type":"application/json", ...headers },
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(15000),
	});
	return { status: response.status, data: await response.json().catch(()=>null) };
}
function check(condition, message) { assert.ok(condition,message); checks++; }
async function levels(actor) {
	const result = await request(`/rest/v1/section_versions?select=access_level&section_id=eq.${sectionId}&order=access_level`, {actor});
	check(result.status === 200, "Content request succeeded");
	return result.data.map((row)=>row.access_level);
}
async function progress(actor) {
	const result = await request(`/rest/v1/section_progress?section_id=eq.${sectionId}`, {actor});
	check(result.status === 200, "Progress request succeeded");
	return result.data;
}
async function save(position, expectedRevision) {
	return request("/rest/v1/rpc/save_my_position", {actor:"paid",method:"POST",body:{p_section_id:sectionId,p_access_level:"paid",p_content_version_id:fixture.paidVersion,p_position:position,p_expected_revision:expectedRevision}});
}
if (phase === "initial") {
	for (const actor of ["free","paid"]) {
		const login = await request("/auth/v1/token?grant_type=password",{method:"POST",body:{email:fixture[actor].email,password:fixture[actor].password}});
		check(login.status === 200 && typeof login.data.access_token === "string", `Synthetic ${actor} password sign-in succeeded (HTTP ${login.status}, ${login.data?.code ?? "no code"})`);
		fixture[actor].token = login.data.access_token;
	}
	await writeFile(fixturePath,JSON.stringify(fixture),{mode:0o600});
	check([401,403].includes((await request("/rest/v1/section_versions?select=body_text")).status),"Signed-out direct reads denied");
	assert.deepEqual(await levels("free"),["free"]);
	assert.deepEqual(await levels("paid"),["free","paid"]);
	const nested = await request(`/rest/v1/learning_sections?id=eq.${sectionId}&select=id,section_versions(access_level,body_text)`,{actor:"free"});
	check(nested.status===200 && nested.data[0].section_versions.length===1 && nested.data[0].section_versions[0].access_level==="free","Joined requests cannot expose paid text");
	const rpc = await request("/rest/v1/rpc/read_section",{actor:"free",method:"POST",body:{p_section_id:sectionId,p_access_level:"paid"}});
	check(rpc.status===200 && rpc.data.length===0,"Free RPC returns no paid body");
	const hidden = await request("/rest/v1/learner_identities",{actor:"paid",headers:{"Accept-Profile":"private"}});
	check(hidden.status===406 && hidden.data.code==="PGRST106","Private schema is not exposed");
	const provision = await request("/rest/v1/rpc/provision_learner",{actor:"paid",method:"POST",body:{p_auth_user_id:fixture.free.id}});
	check([401,403,404].includes(provision.status),"Learners cannot provision accounts");
	const state = await request(`/rest/v1/learners?id=eq.${fixture.paid.learnerId}`,{actor:"paid",method:"PATCH",body:{state:"active"}});
	check(state.status===403,"Learners cannot edit lifecycle state");
	const grant = await request(`/rest/v1/entitlements?learner_id=eq.${fixture.paid.learnerId}`,{actor:"paid",method:"PATCH",body:{ends_at:"2099-01-01T00:00:00Z"}});
	check(grant.status===403,"Learners cannot extend entitlements");
	const saved = await save(4200,0);
	check(saved.status===200,"Paid progress saved");
	const retry = await save(4200,0);
	assert.deepEqual(retry.data,saved.data);
	check((await progress("free")).length===0,"Another learner cannot read paid learner's progress");
	check((await progress("paid"))[0].position===4200,"Own progress is readable");
} else if (phase === "expired") {
	assert.deepEqual(await levels("paid"),["free"]);
	check((await progress("paid"))[0].position===4200,"Expiry retained progress");
	check((await save(4300,1)).status===403,"Expired paid save denied");
} else if (phase === "renewed") {
	assert.deepEqual(await levels("paid"),["free","paid"]);
	check((await progress("paid"))[0].position===4200,"Renewal preserved position");
	check((await save(4300,1)).status===200,"Renewal permits progress updates");
} else {
	// Reuse the same still-unexpired JWT after its auth.sessions row is removed.
	const content = await request(`/rest/v1/section_versions?section_id=eq.${sectionId}`,{actor:"paid"});
	check([401,403].includes(content.status) || (content.status===200 && content.data.length===0),"Revoked session cannot read content with old token");
	const saved = await request("/rest/v1/section_progress",{actor:"paid"});
	check([401,403].includes(saved.status) || (saved.status===200 && saved.data.length===0),"Revoked session cannot read progress");
	check([401,403].includes((await save(4400,2)).status),"Revoked session cannot save progress");
}
console.log(JSON.stringify({phase,checks,status:"passed"}));
