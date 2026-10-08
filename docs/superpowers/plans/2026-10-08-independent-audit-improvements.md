# Independent Website Improvements Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task by task. Subagent execution is available when explicitly requested. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the audit improvements that can be researched, built, documented and verified locally without new business decisions, instructor approval, real assets or hosted-service changes.

**Architecture:** Keep the static Hebrew preview, browser account shells, Node gateway and hosted Worker in their current ownership boundaries. Fix existing contracts before adding operational tooling. Database changes are new migrations tested against disposable PostgreSQL; editorial drafts and synthetic private media stay outside published website output.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node's test runner, JSDOM, Playwright Chromium/Firefox/WebKit, embedded PostgreSQL 17.6, Supabase RPCs and the existing Wrangler Worker package. Keep the pinned dependency versions unless a demonstrated compatibility problem requires a separate change.

**Spec:** [Website missing-pieces audit](../../reviews/website-missing-pieces-2026-10-08.md), checked against checkout `b6fabef`. Read the audit with this plan. Existing product decisions take precedence over speculative improvements.

## Implementation progress

Local work started on 2026-10-08 in `t3/audit-missing-website-pieces`.

| Task | Completed evidence |
| --- | --- |
| 1 | `4bda41f`: scope, ten-day retention and safe hosted-fixture boundaries. Final dated evidence is recorded in the readiness report. |
| 2 | `0fe5a7f`, `c9a3b43`, `fc0df6e`, `bc49088`: suspension queue, repeated restoration and acknowledged initial/republished zero positions. Final focused suite: 47 passed; collaborative desktop/mobile checks passed. |
| 3 | `820a9f5`, `62dabe3`: shared normalized return allowlist, encrypted durable synthetic Google flow and uppercase UUID normalization. Live Google remains disabled. |
| 4 | `b7ce402`, `94fe5d5`, `27e6582`: actual cooldown contract, server/database/browser consumers and malformed-address rejection. |
| 5 | `4bb1e27`, `d1d459a`: 81 neutral topic / 59 explanation references, faithful generation and corrected actual-navigation assertions. |
| 6 | `7dcc8df`: private Hebrew native captions and bounded plaintext transcripts with authorization/lifetime isolation; owned synthetic media verification. |
| 7 | `831e787`: immutable withdrawal, explicit empty replacement, preserved submitted evidence and operator runbook. |
| 8 | `f6c7a92`, `99bc340`: privacy-safe diagnostics and actual startup/failure/shutdown assertions. Cloud logging policy unchanged. |
| 9 | `66574f1`, `831e787`, `91c899a`: owned archive/restore and reliable CLI exit. Final rehearsal: 11/11 checks. |
| 10 | `1183479`: unpublished instructor/owner packets, 81 mappings, 39 draft groups and 28 media briefs. All await approval; 42 unverified mappings remain held. |
| 11 | `c99bc9a`, `0189723`: 44 focused engine/accessibility checks, current reader desktop/mobile verification and explicit unperformed human/device follow-up. |
| 12 | `2084f28`: repeatable local benchmark. Final clean-checkout run: 28 scenarios, 200 successes, zero unexpected errors, five deliberate throttles. |
| 13 | `91c899a`, `0189723`: local-only checker and documented commands. Final full suite: 837/837; pilot: 9/9; source/links/media/search/package audits pass. |

All autonomous deliverables are complete. See the [final local readiness report](../../reviews/local-readiness-2026-10-08.md) for checkpoint `bc49088`, actual measurements, review corrections and remaining external gates.

Execution adjustment for Task 2: fresh authorization runs immediately while the opaque save queue settles independently. Exact own acknowledgements are reconciled across repeated restorations; other revisions or positions require reload. The reader also supplies current-version acknowledgement separately from the previous progress row's concurrency revision, so an explicit zero is really saved for initial and republished versions.

## Global Constraints

- Write all visitor-facing website copy in Hebrew and preserve right-to-left layout and reading order. Communicate with the user in English.
- Use ASCII punctuation in project-authored text, including Hebrew. Preserve supplied reference documents, font files and third-party license text.
- Keep the checked-in frontend in plain HTML, CSS and JavaScript, directly servable without a build.
- Follow [DESIGN.md](../../../DESIGN.md), [CONTEXT.md](../../../CONTEXT.md), [PRODUCT.md](../../../PRODUCT.md) and [Architecture](../../ARCHITECTURE.md). Read the relevant account, protected-learning and hosting guides before each affected task.
- Preserve semantic HTML, keyboard access, visible keyboard focus, pointer/touch focus behavior, mobile layout, reduced motion and the public baseline with JavaScript disabled or blocked.
- Keep protected content, private answer keys, media files, credentials and provider tokens outside public files and Worker static output. Preserve the public-file allowlist, origin/CSRF checks, server authorization and private-response cache controls.
- Public practice questions and answer keys remain public. Practice results do not grant saved progress or completion.
- Billing remains disabled. Preserve closed hosted admission, disabled Google configuration, intentional course `noindex` and the owner's gallery-motion decision.
- Do not deploy, apply hosted migrations, change provider settings, send messages, create issues, purchase services or export real learner data as part of this plan.
- Do not invent contact details, instructor approval, privacy/deletion rules, media rights or live verification evidence.
- Use disposable local databases and owned synthetic fixtures. Never apply the test Auth bootstrap to hosted Supabase. Never edit an already checked-in migration to introduce new behavior.
- Each runtime task ends with focused tests and a reviewable commit. Coordinate edits to shared files and create migrations sequentially. Run the full suite at the final checkpoint, and earlier when a task's change crosses several boundaries.

## Execution order and completion boundary

| Phase | Tasks | Independently complete result |
| --- | --- | --- |
| A: Correct current behavior | 1-5 | Accurate documentation, reading-position recovery, Google return destinations, honest retry guidance and honest quiz review links. |
| B: Protect future instruction | 6-7 | Authorized caption/transcript delivery and withdrawal of unsafe protected quiz drafts, verified with synthetic content. |
| C: Prepare operations | 8-9 | Safe local diagnostics and a repeatable export/restore rehearsal. |
| D: Prepare the remaining evidence | 10-12 | Instructor/owner review materials, broader automated accessibility/browser evidence and measured local performance. |
| E: Close the local readiness loop | 13 | Reproducible local pilot checks and a final readiness report with hosted dependencies still explicit. |

Tasks 2, 3 and 5 are independent of one another. Task 4 changes the account request/error contract and should be integrated before Task 6 changes the reader further. Task 7 must preserve the newest learning-summary migration. Task 9 runs after both database migrations from Tasks 4 and 7. Task 10 uses Task 5's link classification. Task 11 verifies Tasks 2-7; Task 12 measures the resulting application; Task 13 closes all phases.

This plan is complete when these local deliverables pass their acceptance checks. It does not make the course teaching-complete or establish that a hosted service is ready for public accounts.

## Task 1: Reconcile current scope and unsafe verification instructions

**Files:** Modify [README.md](../../../README.md), [database verification guide](../../../supabase/tests/README.md), [protected learning](../../protected-learning.md) and [Operations](../../OPERATIONS.md). Preserve dated historical verification entries.

**Interfaces:** Consumes the current migrations and audit. Produces a consistent distinction between implemented local features, unverified hosted behavior and owner-dependent future work; no runtime interface changes.

- [x] Read the current Todo entries and compare each backend/auth/progress item with implemented source and tests. Split mixed entries into local implementation and hosted verification. Keep billing, actual publication and policy decisions outstanding.
- [x] Replace the current 31-day retention claim with the implemented ten-day cleanup boundary, including renewal-before-deadline versus renewal-after-cleanup behavior. Keep account deletion separate from learning-data cleanup.
- [x] Correct the hosted smoke cleanup instructions: entitlement deletion is forbidden by the current retention trigger, and immutable content cannot be casually deleted. Mark the old four-phase evidence as foundation-only history. Require an explicitly authorized disposable development project and a verified fixture teardown before rerunning a newer hosted exercise. Do not add a production trigger bypass.
- [x] Recheck every referenced command, file and heading. Add a dated local-evidence entry only after the final suite in Task 13, using that run's actual counts.
- [x] Run `git diff --check`. Commit only these documentation changes with message `docs: distinguish local learning from hosted readiness`.

**Acceptance:** A reader cannot mistake implemented local accounts for deployed accounts or follow the obsolete delete-entitlements cleanup sequence. Documentation-only work does not require rerunning application tests.

## Task 2: Preserve pending reading position across suspension

**Files:** Modify `account/reader.js`, `account/protected-page.js`, `tests/unit/protected-page.test.mjs`, `tests/browser/test-lesson-lifetime.test.mjs`, `tests/browser/section-reader.test.mjs` and `docs/protected-learning.md`. Create `account/reader-position.js` and `tests/unit/reader-position.test.mjs` as a reader-owned save coordinator, not a general persistence framework.

**Interfaces:**

- Extend `createProtectedPage({ clear, restore, beforeSuspend = () => {}, window, document })`. `beforeSuspend()` runs synchronously once per suspension, before request invalidation and DOM clearing. The learning screen's existing consumer continues using the default.
- Export `createReaderPosition({ send })`. `send({ contentVersionId, position, expectedRevision, csrf })` returns `Promise<{ position: { contentVersionId, position, revision } }>` through the existing authorized position API.
- Return `hydrate({ contentVersionId, position, revision, csrf, acknowledged })`, `update(position)`, `flush(): Promise<void>`, `settled(): Promise<void>` and `clear()`. The coordinator owns only opaque position/revision/version/CSRF values, its serial save queue and failure state. It owns no instructional text, media or DOM.
- `hydrate` consumes a fresh authorized snapshot. Retain a newer local position only if the content version matches and the server revision still equals the coordinator's last acknowledged revision. A conflicting revision requires reload; do not overwrite another device's progress.

- [x] Add a regression to the existing lifetime fixture for scroll followed immediately by hide, before the 600 ms timer fires:

```js
const r = await reader(t, 390); // Existing in-file lifetime fixture.
await r.open();
await r.reading.waitFor({ state: "visible" });
await scrollToFraction(r.page, 0.75);
const saved = r.page.waitForResponse(response =>
  response.url().endsWith("/position") && response.request().method() === "POST");
await hide(r.page);
await cleared(r);
await saved;
assert.ok(Math.abs(r.position.position - 7500) < 120);
await restore(r.page);
await restoredNear(r.page, 0.75);
```

Add deterministic coordinator tests for an earlier save in flight, repeated hide events, conflicting revisions, changed versions and denial after logout/revocation.

- [x] Run `node --test tests/unit/protected-page.test.mjs tests/browser/test-lesson-lifetime.test.mjs` and confirm the new pre-debounce regression fails on current behavior.
- [x] Implement the coordinator and suspension hook. Snapshot `currentPosition()` before clearing the body; cancel the debounce timer; enqueue the latest value. Serialize writes so a later value uses the earlier response's revision rather than the same stale revision.

```js
const sendPosition = async input => {
  const response = await fetch(`${endpoint}/position`, {
    method: "POST", credentials: "same-origin", cache: "no-store",
    keepalive: true, signal: AbortSignal.timeout(10000),
    headers: { "content-type": "application/json", "x-csrf-token": input.csrf },
    body: JSON.stringify({ contentVersionId: input.contentVersionId,
      position: input.position, expectedRevision: input.expectedRevision }),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
  return data;
};
```

Use this small keepalive request for ordinary saves as well, so an already-issued write can finish during suspension. Keep its transport separate from the aborted rendering lifetime. Replies can update the coordinator's opaque revision; every UI effect remains guarded by `lifetime.run`/`commit`.

- [x] On restoration, immediately reauthorize and read the section/position while outstanding opaque writes settle within their existing timeout. Reconcile an exact observed own acknowledgement without waiting for its transport reply. Clear coordinator state on 401/404, content-version changes and ordinary reset. Surface 409 through the existing reload path. Do not use localStorage, IndexedDB or `sendBeacon`, which cannot carry the required CSRF header.
- [x] Run `node --test tests/unit/reader-position.test.mjs tests/unit/protected-page.test.mjs tests/browser/test-lesson-lifetime.test.mjs tests/browser/section-reader.test.mjs tests/gateway/reading-position.test.mjs`. Verify the real disposable gateway journey at desktop/mobile sizes, immediate private-DOM clearing and late-response isolation.
- [x] Document best-effort suspension flushing: server acknowledgement establishes persistence; offline exits and forced browser termination cannot be guaranteed. Commit with message `fix: flush pending reader position on suspension`.

**Acceptance:** The reproduced 20%-to-75% loss is fixed when the save reaches the server. Concurrent saves, access loss and stale responses do not restore private DOM or silently overwrite newer server progress.

## Task 3: Carry a safe return destination through Google sign-in

**Files:** Create `account/return-destination.js` and `tests/unit/return-destination.test.mjs`. Modify `account/account.js`, `server/gateway.mjs`, `server/learner-accounts.mjs`, `tests/gateway/session.test.mjs`, `tests/gateway/learner-accounts.test.mjs`, `tests/database/gateway-sessions.test.mjs`, `tests/browser/account-browser.test.mjs` and `docs/local-accounts.md`.

**Interfaces:** Export `normalizeAccountReturn(value, origin): string`, shared by the browser and server. Accept `/account/`, `/account/learning.html` with no query, and `/account/reader.html` with exactly one canonical UUID `section` and one `access=free|paid`. Return `/account/` for every other input. Add optional `returnTo` to the Google POST body and store the normalized path in the encrypted server-held flow.

- [x] Add pure allowlist tests and a synthetic Google callback test:

```js
const origin = "https://course.example.test";
const wanted = "/account/reader.html?section=a524e32d-2640-4d94-a51c-000000000001&access=free";
assert.equal(normalizeAccountReturn(wanted, origin), wanted);
for (const value of ["https://evil.test/", "//evil.test/", "/account/reader.html?section=x&access=paid",
  wanted + "&access=paid", wanted + "#extra", "/account/\\evil.test"]) {
  assert.equal(normalizeAccountReturn(value, origin), "/account/");
}
const accounts = createLearnerAccounts({ origin, provider: accountProvider(), googleEnabled: true });
const anonymous = await accounts.session();
const begun = await accounts.perform(anonymous.cookie.token, "google", { returnTo: wanted });
const state = new URL(begun.data.url).searchParams.get("state");
const completed = await accounts.completeCallback(anonymous.cookie.token, { state, code: "valid-code" });
assert.equal(completed.redirect, wanted);
```

This uses the existing deterministic provider's `url` result, state parameter and `valid-code` exchange. Cover duplicate parameters, encoded separators, backslashes, hashes, control characters, overlong values, expired/replayed callbacks and destinations from another origin.

- [x] Run the focused unit/gateway test and confirm the callback currently lands on `/account/`.
- [x] Extract the existing browser allowlist into the pure module, strengthen UUID validation and use it for password login too. Extend the gateway's Google field allowlist to `["returnTo"]`; reject a non-string or value longer than 2048 characters. Preserve empty-body compatibility.
- [x] Store and revalidate the path only in the Google flow:

```js
flow.returnTo = normalizeAccountReturn(body.returnTo, origin);
// After state validation, code exchange, admission and session rotation:
const redirect = flow.kind === "google"
  ? normalizeAccountReturn(flow.returnTo, origin) : "/account/";
```

Keep recovery's `/account/reset.html` destination and signup behavior unchanged. Verify the existing durable session serializer retains `returnTo` encrypted across gateway reconstruction; no new provider redirect URL or browser token is needed.

- [x] Run `node --test tests/unit/return-destination.test.mjs tests/gateway/learner-accounts.test.mjs tests/gateway/session.test.mjs tests/database/gateway-sessions.test.mjs tests/browser/account-browser.test.mjs`, then `npm run check:links`. Commit with message `fix: restore protected destination after Google sign-in`.

**Acceptance:** A locally simulated Google flow returns to the requested protected section. Malicious inputs fall back safely. This does not enable or verify live Google OAuth.

## Task 4: Return and display the actual rate-limit cooldown

**Files:** Modify `server/gateway.mjs`, `server/rate-limit.mjs`, `server/production.mjs`, `server/learner-accounts.mjs`, `account/account.js`, `account/protected-page.js`, `account/learning.js`, `account/reader.js`, `tests/gateway/rate-limit.test.mjs`, `tests/gateway/session.test.mjs`, `tests/gateway/mutation-admission.test.mjs`, `tests/gateway/production.test.mjs`, `tests/gateway/verification.test.mjs`, `tests/database/gateway-rate-limits.test.mjs` and `tests/browser/account-feedback-browser.test.mjs`. Create `account/retry-guidance.js` and `tests/unit/retry-guidance.test.mjs`. Generate a new migration named `gateway_rate_limit_decisions` with the pinned CLI.

**Interfaces:**

- Both local and database limiters return `{ allowed: boolean, retryAfterSeconds: number }`; allowed decisions use zero and denied bucket decisions use the remaining positive whole seconds.
- New service-only RPC `public.gateway_rate_limit_decision(p_bucket_key text, p_limit integer, p_window_seconds integer) returns jsonb` delegates to a private definer with empty search path. Keep the old boolean RPC as a compatibility wrapper over the same single counter transaction, so existing hosted callers remain compatible after a future authorized migration.
- Export `readRetryAfter(value): number | null` and `retryGuidance(seconds): string`. The browser helper accepts an integer header from 1 through 86400; a missing/invalid value produces generic Hebrew waiting guidance. All account consumers share this actual second consumer requirement.

- [x] Strengthen the injected-clock gateway test: deny a mutation at a 900-second window, assert `Retry-After: 900`, advance 60 seconds, assert the next header is `840`, then permit the request at expiry. Assert a database decision has the same contract and never leaks the bucket/address.

```js
const decision = (await client.query(
  "select public.gateway_rate_limit_decision($1, 1, 900) as decision",
  ["7".padStart(64, "0")],
)).rows[0].decision;
assert.deepEqual(decision, { allowed: true, retryAfterSeconds: 0 });
const denied = (await client.query(
  "select public.gateway_rate_limit_decision($1, 1, 900) as decision",
  ["7".padStart(64, "0")],
)).rows[0].decision;
assert.equal(denied.allowed, false);
assert.ok(denied.retryAfterSeconds >= 899 && denied.retryAfterSeconds <= 900);
```

The database test uses a service-role connection from the existing disposable fixture. Include concurrent old/new RPC consumers, anon/authenticated denial, expired windows, global capacity and malformed RPC responses.

- [x] Run the focused gateway/database files and observe the new assertions fail before changing the contract.
- [x] Run `npx --no-install supabase migration new gateway_rate_limit_decisions`. Add the decision RPC using the existing advisory lock, table, limits and sweeper. Compute `greatest(1, ceil(extract(epoch from expires_at - clock_timestamp())))::integer` after acquiring the lock. At global capacity, report the earliest bucket expiry; reject invalid client addresses as 400 and database/network failures as 503 rather than fabricating a retry window.
- [x] Update every JavaScript limiter consumer and injected fixture from boolean to decision. Use `graft callers createDatabaseRateLimit --depth all` and exhaustive limiter searches during execution before deleting the old JavaScript contract. Keep the SQL compatibility wrapper because it has a real older deployed caller boundary.
- [x] Propagate `retryAfterSeconds` on known 429 errors and set the response header only when its value is valid. For early verification-email resend, use the remaining `nextResendAt` interval without changing that policy. A provider-originated 429 without known retry metadata gets generic waiting guidance and no invented 60-second header. Preserve known metadata when parsing account and protected-page errors; replace hard-coded one-minute reader/learning messages with:

```js
export function retryGuidance(seconds) {
  return seconds === null
    ? "בוצעו בקשות רבות. המתינו מעט ונסו שוב."
    : `בוצעו בקשות רבות. אפשר לנסות שוב בעוד ${seconds} שניות.`;
}
```

Keep inputs and current draft state intact. Do not automatically resubmit credentials or change the separate verification-email resend cooldown.

- [x] Run `node --test tests/unit/retry-guidance.test.mjs tests/gateway/rate-limit.test.mjs tests/gateway/session.test.mjs tests/gateway/mutation-admission.test.mjs tests/gateway/production.test.mjs tests/gateway/verification.test.mjs tests/database/gateway-rate-limits.test.mjs tests/browser/account-feedback-browser.test.mjs`, then `npm test`. Commit with message `fix: report remaining rate-limit cooldown`.

**Acceptance:** Retry guidance agrees with both local and persistent windows. Database failure remains an unavailable response. The migration is checked in and tested locally, not applied to Supabase.

## Task 5: Stop labeling missing teaching as a question explanation

**Files:** Modify `docs/reference/theory-quiz-content.json`, `scripts/publish-theory-quizzes.mjs`, `tests/unit/theory-quiz-publisher.test.mjs`, `tests/unit/theory-quiz-publication.test.mjs`, `tests/browser/quiz-review-browser.test.mjs` and the ten publisher-owned `course/<topic>/quiz/index.html` regions. Update `docs/reference/design-teaching-coverage.md` and README's maintenance instructions. Topic IDs come from the reviewed source; no new pages or topic anchors are needed.

**Interfaces:** Add `lessonReferenceKind: "explanation" | "topic"` to every reviewed question. It records link intent, not instructor approval. Existing section/topic fields remain the editorial teaching-placement destination. A topic reference renders `../#topic` and the neutral label `חזרה לנושא הלימוד`; an explanation reference retains the existing validated section destination and `חזרה להסבר בנושא`.

- [x] In the publisher's existing temp-tree fixture, set question `0988` to `lessonReferenceKind: "topic"`, publish and assert its review link points to `../#topic` with the neutral label. Also assert an explanation reference to another topic still reaches its section:

```js
const f = await fixture(t); // Existing publisher test fixture.
f.bank.questions.find(q => q.officialId === "0988").lessonReferenceKind = "topic";
await f.write(contentFile, JSON.stringify(f.bank, null, 2) + "\n");
await (await publisher())(f.root);
const dom = new JSDOM(await f.read("course/trip-planning/quiz/index.html"));
const link = dom.window.document.querySelector("#question-0988 [data-quiz-lesson-link]");
assert.equal(link.getAttribute("href"), "../#topic");
assert.equal(link.textContent, "חזרה לנושא הלימוד");
dom.window.close();
```

- [x] Run `node --test tests/unit/theory-quiz-publisher.test.mjs` and confirm the new link-intent test fails.
- [x] Transcribe the existing editorial assessment without reclassifying driving rules: all 56 Gap and 25 Partial questions get `topic`; the 48 Covered and 11 Elsewhere questions retain `explanation`. Require a valid kind, and still validate existing section destinations for editorial integrity. Missing or unknown values fail with the source file and question ID.
- [x] Render only the link's destination/label according to the kind:

```js
const topicReference = question.lessonReferenceKind === "topic";
const href = topicReference ? "../#topic" : `${lessonHref}#${question.lessonSectionId}`;
const label = topicReference ? "חזרה לנושא הלימוד" : "חזרה להסבר בנושא";
```

Do not alter questions, keys, explanations, provenance, adaptations or original diagrams. Update the coverage document's heading and notes to distinguish assessed placement from the new neutral public navigation.

- [x] Run `node scripts/publish-theory-quizzes.mjs`, then `node scripts/publish-theory-quizzes.mjs --check`. Run `node --test tests/unit/theory-quiz-publisher.test.mjs tests/unit/theory-quiz-publication.test.mjs tests/browser/quiz-review-browser.test.mjs`, `npm run check:links` and `npm run check:media`. Check one enhanced mistake-review path and its JavaScript-disabled native disclosure. Commit with message `fix: distinguish topic links from explanation links`.

**Acceptance:** Q0988 no longer claims the obstruction section explains engine braking. All 81 incomplete placements have honest navigation; existing accurate cross-topic links remain useful. This does not fill or approve the missing teaching.

## Task 6: Deliver private captions and transcripts with video

**Files:** Modify `server/media-policy.mjs`, `server/private-media.mjs`, `server/storage-media.mjs`, `account/reader.js`, `account/learning.css`, `tests/gateway/media-contract.test.mjs`, `tests/gateway/private-media.test.mjs`, `tests/gateway/storage-media.test.mjs`, `tests/hosting/worker.test.mjs`, `docs/hosting.md` and `docs/protected-learning.md`. Create `tests/browser/private-media-accessibility.test.mjs`; keep its generated VTT/text/video fixtures in owned temporary storage, outside public assets.

**Interfaces:**

- Extend private registry types with `text/vtt` and `text/plain; charset=utf-8`.
- A video registry entry may reference `captions: [{ id, language: "he", label }]` and `transcript: { id, language: "he", label }`. Each referenced registry entry must exist, have the expected text type and belong to the exact same section/content version. A sidecar cannot attach to an image or be treated as a root image/video descriptor.
- `forSection(sectionId, contentVersionId)` continues returning root media descriptors; videos additionally expose same-origin caption/transcript descriptors with `/api/media/<id>` URLs. `lookup(id)` includes sidecars so the existing learner/version authorization protects every text request too.
- Reject duplicate references, mismatched versions, unsupported language tags, overlong labels, orphan sidecars and unknown sidecar fields during registry construction.

- [x] Add a manifest contract regression using one synthetic video, a Hebrew VTT file and a UTF-8 transcript. Assert descriptors nest correctly; unauthenticated, expired, revoked, wrong-learner and superseded-version requests cannot fetch either sidecar. Assert authorized responses use the precise type, `nosniff` and `private, no-store`.
- [x] Run `node --test tests/gateway/media-contract.test.mjs tests/gateway/private-media.test.mjs` and confirm text sidecars are currently rejected.
- [x] Add sidecar validation/delivery in the shared policy and both file/Storage adapters without exposing filenames or bucket details. Preserve HEAD, range handling, upstream cancellation and bounded delivery; a reader transcript must be limited to 256 KiB of UTF-8 text and aborted on suspension.
- [x] Render native caption tracks and an on-demand transcript disclosure:

```js
for (const item of descriptor.captions ?? []) {
  const track = document.createElement("track");
  track.kind = "captions";
  track.srclang = item.language;
  track.label = item.label;
  track.src = item.url;
  track.default = item.language === "he";
  video.append(track);
}
// The authorized transcript fetch inserts plaintext with textContent.
// Native disclosure label: "תמלול הסרטון".
```

Use the current reader lifetime for transcript fetches. Read bounded bytes, decode UTF-8 and insert `textContent`, never `innerHTML`. Clearing private media must pause videos, remove track/video sources, close disclosures and remove transcript text. A denied sidecar follows the reader's existing access-loss path.

- [x] Add browser assertions for Hebrew track selection, keyboard disclosure operation, escaped hostile transcript text, revoked access and no late transcript repopulation. Use the current design tokens/focus rules; add no media marketing claims or fabricated instructional videos.
- [x] Run the affected gateway/browser/Worker tests and `npm test`. Verify desktop/mobile and reduced-motion reader behavior. Confirm the packaged public output contains none of the fixture files. Commit with message `feat: support authorized video captions and transcripts`.

**Acceptance:** Accessible alternatives can be delivered privately when real approved media arrives. Actual captions, transcripts, rights and instructor approval remain asset dependencies. The [W3C caption guidance](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html) supports using synchronized captions; a transcript is an additional reading alternative.

## Task 7: Add a trusted protected-quiz withdrawal operation

**Files:** Generate a new migration named `protected_quiz_withdrawal`. Modify `server/learner-accounts.mjs`, `server/gateway.mjs`, `account/learning.js`, `account/quiz-attempt-editor.js`, `tests/database/protected-learning.test.mjs`, `tests/gateway/protected-learning.test.mjs`, `tests/unit/quiz-attempt-editor.test.mjs`, `tests/browser/protected-learning.test.mjs`, `docs/protected-learning.md` and `docs/OPERATIONS.md`. Keep `server/supabase.mjs` as the existing stateless RPC transport; the account boundary owns SQLSTATE-to-product error mapping.

**Interfaces:**

- New private table `private.quiz_version_withdrawals(version_id uuid primary key, withdrawn_at timestamptz not null, reason_reference text not null)` references immutable quiz versions, has RLS and no browser/table grants.
- Service-only `public.withdraw_quiz_version(p_version_id uuid, p_reason_reference text) returns jsonb` delegates to a private definer; return `{ versionId, withdrawnAt }`. Repeated withdrawal returns the original record and does not change history.
- Add `withdrawn_at` to `public.quiz_attempts` and replace the one-draft index predicate with `submitted_at is null and withdrawn_at is null`. A withdrawn attempt can never also be submitted.
- An owned withdrawn draft reads as `{ id, topicKey, revision, status: "withdrawn" }`, without questions, answer keys or explanations. Save/submit on it uses SQLSTATE `P4100`, mapped only for that code to HTTP 410 `{ error: "quiz_withdrawn" }`. Submitted attempts keep their original contract/results.

- [x] Add database tests that publish a synthetic version, start two learners' drafts and submit a third learner's passing attempt. Withdraw the version; assert unfinished reads contain no questions, save/submit are denied, and submitted history/completion are byte-for-byte unchanged. Repeated withdrawal is idempotent; anon/authenticated cannot call the trusted RPC.

```sql
set local role service_role;
select public.withdraw_quiz_version($1, 'synthetic-withdrawal-review');
-- A learner transaction against the withdrawn unfinished attempt must fail:
select public.save_my_quiz($2, '{"q1":"a"}'::jsonb, 0);
-- Expected SQLSTATE P4100, with no grade or completion written.
```

Use existing fixture IDs and `actAs` for separate service/learner transactions. Also test a corrected current version, no corrected version, old normal drafts after ordinary publication, stale revisions and access revocation.

- [x] Run the focused database suite and confirm no withdrawal operation exists yet.
- [x] Run `npx --no-install supabase migration new protected_quiz_withdrawal`. Introduce the state and replace only current RPC definitions affected by withdrawal. Start from the latest `my_learning`, grading threshold and history definitions, preserving `latestAttempt`, original question counts and `hadPaidAccess`.
- [x] Establish the concurrency rule in SQL: learner operations keep their existing learner/attempt locks, then acquire a shared quiz-version lock before testing withdrawal and exposing or grading an unfinished version. The trusted withdrawal takes an exclusive lock on that version and touches no learner rows. Acquire multiple version locks in UUID order if restart examines both old and current versions. This avoids an operator taking a learner lock after a version lock.

```sql
-- Learner operation, after its existing ownership/learner checks:
perform 1 from private.quiz_versions where id = v_attempt.version_id for share;
-- Now inspect private.quiz_version_withdrawals before returning draft questions
-- or validating/saving/grading answers. The lock lasts through commit.
```

A concurrent submission either commits before withdrawal or observes withdrawal and fails. Test both schedules with two connections and barriers; do not rely on a timing sleep.

- [x] In `start_my_quiz`, mark a learner's old withdrawn draft `withdrawn_at` under the learner lock. On an explicit start action, create a new draft only if the current version is not withdrawn. Keep withdrawn records subject to existing retention; do not invent a new retention policy. Filter withdrawn current versions from the active catalog. Preserve ordinary immutable-version resume behavior.
- [x] In `createLearnerAccounts.learning`, map `error.code === "P4100"` to `fail(410, "quiz_withdrawn")` before rethrowing other provider errors. Add that product code to the gateway's safe error allowlist. Clear unsafe questions/editing controls and preserved editor draft state on withdrawal. Show Hebrew feedback `גרסת התרגול אינה זמינה עוד. חזרו ללמידה ובחרו גרסה מעודכנת.` with an explicit return/reload action. Never automatically copy answers into the replacement version.
- [x] Run the database, gateway, editor and protected browser tests, then `npm test`. Add an operator runbook with exact version ID, reason/review reference, publication order, verification and scope of admission closure. Withdrawal itself requires no approval claim; publishing replacement instruction still does. Commit with message `feat: withdraw unsafe protected quiz drafts`.

**Acceptance:** Operators have a locally proven emergency withdrawal path. Affected unfinished instruction stops; unrelated drafts, submitted history and completion remain intact. No hosted quiz is withdrawn by this implementation task.

## Task 8: Add privacy-safe diagnostics without changing cloud logging policy

**Files:** Create `server/diagnostics.mjs` and `tests/gateway/diagnostics.test.mjs`. Modify `server/production.mjs`, `server/worker.mjs`, `server/gateway.mjs`, `server/start.mjs`, `tests/gateway/production.test.mjs`, `tests/hosting/worker.test.mjs`, `docs/hosting.md` and `docs/OPERATIONS.md`.

**Interfaces:** Export `createDiagnostics({ write, now = Date.now }): { emit(event): void }`. Whitelist `category` (`configuration`, `dependency`, `unexpected`), `operation` (`startup`, `account`, `learning`, `position`, `media`, `rate_limit`), integer HTTP `status` and optional configuration `field`/`reason`. Allowed fields are `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `GOOGLE_AUTH_ENABLED`, `PRIVATE_MEDIA_BUCKET` and `PRIVATE_MEDIA_ENTRIES`; reason is `missing` or `invalid`. An internally computed positive integer `count` may summarize repeated events. Accept no arbitrary message, request URL, user/section ID, cookie, body, stack or provider payload.

- [x] Add a redaction test against deliberately sensitive input:

```js
const lines = [];
const diagnostics = createDiagnostics({ write: line => lines.push(line) });
diagnostics.emit({ category: "configuration", operation: "startup", status: 503,
  field: "APP_ORIGIN", reason: "missing", token: "do-not-log", message: "private learner text" });
assert.deepEqual(JSON.parse(lines[0]), { category: "configuration", operation: "startup",
  status: 503, field: "APP_ORIGIN", reason: "missing" });
assert.doesNotMatch(lines.join("\n"), /do-not-log|private learner text/);
```

- [x] Run `node --test tests/gateway/diagnostics.test.mjs` and confirm the module is absent.
- [x] Add structured configuration errors to `createProductionGatewayOptions`, carrying only approved field/reason values. In the Worker initialization catch, emit one safe configuration event per environment before retaining the current unavailable-API fallback. Add a reporter injection at the gateway's error boundary; use coarse route classes, never raw paths/query strings. Make reporter failure nonfatal.

```js
catch (error) {
  diagnostics.emit({ category: "configuration", operation: "startup", status: 503,
    field: error.configurationField, reason: error.configurationReason });
  worker = createWorker();
}
```

- [x] Exercise failed Auth, database, rate-store and media dependencies locally. Assert the learner still receives generic safe errors and the public homepage still works. Emit the first event, then suppress repeated events with the same category/operation/field/reason for 60 seconds. The next event after that window includes the accumulated count and resets the counter. Bound this map by the finite allowlists and test the behavior with an injected clock; no account-identifying correlation IDs are needed.
- [x] Document which signals are emitted locally, which cloud log collection remains disabled, and which alert/responder choices still require an owner. Leave `wrangler.jsonc` observability unchanged. Add incident verification steps that probe account/learning/media behavior rather than treating a 200 homepage as backend health.
- [x] Run `node --test tests/gateway/diagnostics.test.mjs tests/gateway/production.test.mjs tests/hosting/worker.test.mjs` and commit with message `feat: report safe gateway diagnostic categories`.

**Acceptance:** Local failures expose a useful category/configuration field without private data. Hosted alert delivery and retention are not claimed or silently enabled.

## Task 9: Rehearse export and restoration in disposable databases

**Files:** Extend `tests/support/database.mjs`; create `tests/support/database-recovery.mjs`, `tests/database/recovery.test.mjs`, `scripts/rehearse-local-recovery.mjs` and `docs/local-recovery.md`. Add `rehearse:recovery` to `package.json`; link the runbook from `docs/OPERATIONS.md` and `docs/hosting.md`.

**Interfaces:** Add fixture-owned `dumpData(): Promise<Uint8Array>` and `restoreData(bytes): Promise<void>` operations through the recovery helper. They are attached only to a database instance created by `startDatabase`, never to a URL, environment-supplied credentials or destination path. Use a versioned fixture archive containing migration filenames/hashes, an allowed relation/column manifest and unchanged PostgreSQL-generated JSON row text. Export `rehearseLocalRecovery(): Promise<RecoveryReport>` from `scripts/rehearse-local-recovery.mjs`. `RecoveryReport` is `{ scope: "local", checks: Array<{ name: string, passed: boolean }>, migrations: string[], durationMs: number }`; it contains neither archive bytes nor credentials.

- [x] Seed synthetic identities, grants, positions, quiz versions, submitted attempts, completions, withdrawal records and retention deadlines in source fixture A. Restore into empty, independently initialized fixture B. Assert current access decisions and learner isolation, identical history/completion, withdrawn-draft denial and stored-position revisions through actual RPCs.
- [x] Add a negative case: corrupt the owned dump and assert restoration fails atomically. Confirm both databases, dump files and connections are removed even after an assertion failure.
- [x] Run `node --test tests/database/recovery.test.mjs` and confirm no recovery helper exists yet.
- [x] Implement a fixture-specific logical archive with the existing `pg` connection. The pinned embedded package contains only `postgres`, `pg_ctl` and `initdb`, so this task must not depend on nonexistent dump/restore utilities. In a read-only repeatable-read transaction, discover ordinary tables in the fixture's `auth`, `public` and `private` schemas, record their columns and export `row_to_json(row)::text` without converting large integers through JavaScript numbers.

```sql
begin isolation level repeatable read read only;
select pg_catalog.row_to_json(row)::text as row_text from public.quiz_attempts row;
-- Export each relation from the verified catalog manifest within this snapshot.
commit;
```

The archive stores row strings as strings; restore passes each string as a bound `$1::jsonb` value to `jsonb_populate_record(NULL::<verified relation>, $1::jsonb)`. Quote relation/column identifiers from the target's independently discovered manifest, reject unknown relations/columns and require identical migration hashes. Restore into the empty migrated target in one local-admin transaction, using `set local session_replication_role = replica` only within that owned fixture transaction to avoid circular-FK/fixture-trigger ordering. Reject nonempty targets and reset the transaction on any failure. Before commit, enumerate every fixture FK from `pg_constraint` and run a child-to-parent anti-join for its column pairs, following its null/match semantics; reject any orphan row. Add a corrupted-archive test that omits a referenced learner and proves this check rolls back. Restore normal trigger behavior at commit, then verify the behavioral authorization assertions.

- [x] Include a separate synthetic private-media copy/hash check; database backups do not contain Storage object bytes. Exercise session restoration with a fixture-generated stable encryption key, then separately verify key rotation/invalidated sessions require fresh sign-in. Keep the key and ciphertext out of reports. Supabase documents the object-storage limitation in [Database Backups](https://supabase.com/docs/guides/platform/backups).
- [x] Add the command `npm run rehearse:recovery`, with loopback-only behavior and a JSON summary. Run it and `node --test tests/database/recovery.test.mjs tests/database/gateway-sessions.test.mjs`. Record that the archive rehearses application state against source-controlled migrations; it is not a complete Supabase backup or proof of a provider's dump format. Commit with message `test: rehearse local learner data restoration`.

**Acceptance:** Recovery can be repeated and checked locally. A real backup destination, schedule, retention, encryption-key custody and authorized hosted restoration remain decisions outside this task.

## Task 10: Prepare instructor and owner review materials

**Files:** Create `docs/reference/teaching-review-packet-2026-10-08.md`, `docs/reference/teaching-drafts-2026-10-08.md` and `docs/reference/media-production-briefs-2026-10-08.md`. Create `docs/launch-inputs.md`. Link the packet from `docs/OPERATIONS.md`. Reuse the existing coverage/source/media inventories instead of creating another approval registry.

**Interfaces:** Consumes the 140-question maintenance source, existing coverage draft, supplied PDF, release media scope and Task 5's link intent. Produces unpublished review drafts keyed by the existing official question IDs, topic IDs and section anchors; exact-revision approval remains the existing Operations record.

- [x] Build the review packet for all 81 Gap/Partial questions. Group related missing propositions into proposed lesson changes, retain every question ID, and record the existing section, source evidence, answer-critical condition, proposed passage reference and `awaiting instructor review` state. Preserve all 11 Elsewhere links without treating navigation as new teaching approval.
- [x] Independently research each time-sensitive teaching proposition against supplied material and current primary Israeli government/Ministry sources. Record access dates, publication/effective dates where available and source conflicts. Where a source cannot be verified, record `source unverified` and exclude that passage from the ready-for-approval group. Do not present an answer explanation as Ministry-authored text.
- [x] Draft concise Hebrew lesson additions and matching scenarios/self-checks in the unpublished draft document. Start from the already reviewed question's course-authored explanation, then check its conditions against the primary evidence. Keep each proposed addition linked to the questions it would prepare the learner to answer. Do not edit public lessons or change question selection in this task.
- [x] Prepare the 16 video storyboards and 12 image/diagram briefs from the existing paid-release scope and 19 current media notes. Each brief records lesson placement, learning purpose, shots/diagram elements, needed source rights, Hebrew caption/transcript needs, approval state and delivery destination. Describe missing sign visuals first. Preserve supplied original artwork and student-photo bytes.
- [x] Build an owner-input sheet covering the real contact/report destination, support responder, approved privacy/terms and deletion rules, provider/admin availability, target origin, SMTP/Google settings, approved free content, backup destination, alert responder and the three-day pilot. Distinguish an absent supplied value from an unverified external setting.
- [x] Add a data inventory for current identity/profile/session/grant/progress/attempt/completion/media records: source, storage boundary, existing cleanup behavior, export/deletion dependencies and documented policy questions. Draft the request/operator workflow without selecting new retention durations or exposing a nonfunctional public form.
- [x] Verify IDs/counts against the reviewed source and every local/external citation. Confirm the files are outside the Worker/static allowlist and marked as drafts. Run `git diff --check`. Commit with message `docs: prepare teaching media and launch review packets`.

**Acceptance:** Oren and the owner receive concrete reviewable passages, production briefs and decisions to supply. All material remains unpublished and unapproved; nobody must infer missing inputs from a broad backlog.

## Task 11: Expand protected browser and automated accessibility evidence

**Files:** Modify `tests/browser/cross-browser-smoke.test.mjs` and `tests/browser/design-accessibility.test.mjs`; create `tests/browser/protected-accessibility.test.mjs`. Reuse `tests/browser/reader-journey-helpers.mjs`, `tests/helpers/test-lessons.mjs` and the caption fixture from Task 6. Update `docs/manual-test-lessons.md` and `docs/reviews/site-quality-2026-09-22.md` with a dated follow-up, preserving historical findings.

**Interfaces:** Consume the final reader/Google/retry/withdrawal/media contracts. Produce automated evidence across Chromium, Firefox and WebKit, plus a distinct unperformed human-check list. Add helper exports only for a demonstrated second test consumer.

- [x] Add focused Firefox/WebKit journeys for password login, allowed section return, reading-position restore, private-DOM clearing, paid-access revocation and withdrawn quiz handling. Keep the existing public smoke coverage and actual real-database fixture; do not emulate Google/provider production behavior.
- [x] Add assertions for native role/name relationships, feedback focus, keyboard radio/disclosure interaction, pointer/touch ring suppression and keyboard ring visibility. Check Hebrew reading order and 320 CSS-pixel reflow, 200% text sizing and forced-colors contrast/boundaries. Reuse existing tested cases rather than duplicating the homepage suite.

```js
await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
await page.setViewportSize({ width: 320, height: 844 });
assert.equal(await page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
await page.keyboard.press("Tab");
assert.equal(await page.locator(":focus").count(), 1);
```

Pair these structural assertions with actual protected control interactions; a focused element alone does not prove usable focus styling.

- [x] Run the new tests against current/final behavior and fix confirmed defects within the relevant task's ownership. A gallery pause control remains outside this plan because it conflicts with an explicit owner decision.
- [x] Verify affected paths in the collaborative browser at desktop/mobile and reduced motion. Keep NVDA/VoiceOver, physical iOS/Android playback, actual captions, text comprehension and native-video assistive control checks listed as requiring human/device evidence. Automated screenshots or accessibility trees are not screen-reader certification.
- [x] Run `node --test tests/browser/cross-browser-smoke.test.mjs tests/browser/design-accessibility.test.mjs tests/browser/protected-accessibility.test.mjs tests/browser/private-media-accessibility.test.mjs` and commit with message `test: cover protected journeys across browser engines`.

**Acceptance:** Previously public-only alternate-engine evidence includes the protected flows, and accessibility claims stay within the checks actually performed.

## Task 12: Establish reproducible local performance and capacity baselines

**Files:** Create `scripts/benchmark-local.mjs`, `tests/unit/local-benchmark.test.mjs` and `docs/local-performance.md`. Add `benchmark:local` to `package.json`. Reuse the existing gallery delivery tests, account gateway and synthetic long-lesson/media fixtures.

**Interfaces:** Export `runLocalBenchmark({ iterations = 5 }): Promise<BenchmarkReport>` from the script. `BenchmarkReport` contains `scope: "local"`, `checkout: string`, `environment: { node: string, browser: string, viewport: { width, height }, network: string, cpuSlowdown: number }` and `scenarios: Array<{ name: string, synthetic: boolean, count: number, medianMs: number, p95Ms: number, errorCount: number, rateLimitedCount: number, transferredBytes: number }>`. The command owns loopback fixture servers and accepts no remote URL.

- [x] Add unit checks for report aggregation and remote-target rejection. Verify the harness closes browsers/servers when a scenario fails. Do not write a test that equates a made-up latency number with production readiness.

```js
assert.deepEqual(summarizeSamples([10, 20, 30, 40, 50]),
  { count: 5, medianMs: 30, p95Ms: 50 });
```

Define/export `summarizeSamples(samples): { count, medianMs, p95Ms }` in the benchmark script using sorted nearest-rank percentiles; this is the only extra test interface.

- [x] Measure cold/warm homepage, course library and public quiz loads in Chromium at desktop and mobile sizes, then free/paid synthetic reader loads, saved-position requests, quiz save/submit and private-media range playback. Use explicit fixed local network/CPU settings; exclude deliberate rate-limit responses from successful-request latency summaries but report their count.
- [x] Run bounded gateway concurrency at 1, 5 and 10 synthetic readers using owned fixtures and sufficient fixture-only rate limits. Record p50/p95/error counts and database/process resources available locally. Label all capacity results as local synthetic measurements; make no prediction about Supabase/Cloudflare quotas, actual media egress or real phone playback.
- [x] Record the first baseline and identify actual regressions or excessive delivery. Reuse the existing image budgets and optimizer; optimize only measured offenders, sequentially, preserving supplied original bytes. If a real optimization is justified, include its before/after evidence and run the media/gallery delivery checks. Do not impose an arbitrary new pass/fail budget on a noisy first run.
- [x] Run `node --test tests/unit/local-benchmark.test.mjs`, then `npm run benchmark:local`. Save sanitized summarized results in the runbook, with raw synthetic output in an ignored/temporary location. Commit with message `test: add reproducible local performance baseline`.

**Acceptance:** There is a repeatable measured baseline. Real hosted cost/capacity and physical-device evidence remain explicitly unverified.

## Task 13: Produce a local pilot-readiness check and close verification

**Files:** Create `scripts/check-pilot-readiness.mjs`, `tests/unit/pilot-readiness.test.mjs` and `docs/reviews/local-readiness-2026-10-08.md`. Add `check:pilot:local` to `package.json`. Modify `README.md`, `docs/hosting.md` and `docs/OPERATIONS.md` to link the command/results and the owner-input sheet.

**Interfaces:** Export `checkLocalPilotReadiness(): Promise<{ scope: "local", checkout: string, migrations: string[], checks: Array<{ name: string, passed: boolean }>, externalDependencies: string[] }>`; the command accepts only `--local` and rejects hosted URLs/credentials/deployment arguments. It reports the checkout and migration list, allowlist/package checks, synthetic account/learning/media journeys and unresolved external inputs. Exit success means local checks passed, not permission to open registration.

- [x] Add unit tests proving a local pass retains `scope: "local"` and the hosted dependency list. Test failure exit behavior and rejection of unsupported hosted/deploy flags. No environment secret or learner record may enter the report.
- [x] Assemble existing package/configuration validators and the owned synthetic gateway fixture into the local check. Verify free reading, explicit fixture-only paid grants, position persistence, quiz history, withdrawal and caption access. Report actual checked-in admission/Google/billing defaults separately from fixture behavior.

```js
const report = {
  scope: "local",
  checkout,
  migrations,
  checks,
  externalDependencies: ["instructor approval", "real media and rights", "contact and support",
    "privacy and deletion decisions", "hosted provider configuration", "backup and alert ownership",
    "authorized deployment", "owner/Oren pilot", "physical-device and screen-reader checks"],
};
```

- [x] Run `npm run check:pilot:local`, `npm run rehearse:recovery` and the benchmark command once against the final checkout. Keep reports sanitized and label synthetic evidence.
- [x] Run the final application checks:

```bash
npm test
node scripts/publish-theory-quizzes.mjs --check
npm run check:links
npm run check:media
npm run check:search
npm run package:worker
git diff --check
```

Inspect the package for private fixture/content exclusion. Run `npm run check:hosting` only with an already authorized local configuration file; record its absence as external configuration still needed, not as a fabricated pass. If `index.html` changed because of a justified delivery optimization, run `npm run minify:html` after that optimizer and repeat the relevant audits.

- [x] Review affected public paths with JavaScript disabled and the entry module blocked. Review protected controls with pointer and keyboard input, desktop/mobile sizes and reduced motion. Check that delayed responses never repopulate cleared private content or steal focus.
- [x] Write the dated readiness report with actual tests/counts, measured/rehearsed outcomes, commit revision and unresolved gates. Update only the backlog items these changes completed. Preserve the original audit as the baseline.
- [x] Commit with message `docs: record independent local readiness improvements`. Hand back the completed local work and precise remaining owner dependencies; do not publish, deploy or start a timed opening.

**Acceptance:** Every autonomous deliverable is implemented and verified, and its evidence is easy to review. A passing report cannot be confused with teaching approval or live service verification.

## Coverage of the audit and remaining dependencies

| Audit finding | Autonomous deliverable | Remaining input/action |
| --- | --- | --- |
| Teaching gaps and approval | Task 10: researched Hebrew drafts and exact question coverage packet. | Oren approves the exact revision or changes question selection before publication. |
| Misleading review links | Task 5: explanation/topic distinction and corrected generated links. | New approved teaching can later restore explanation links. |
| Missing instructional media | Tasks 6 and 10: private accessibility delivery and 28 production briefs. | Supply actual media, rights, captions/transcripts and instructor approval. |
| Contact/error reporting | Task 10: destination/context/request specification. | Supply a real approved contact destination and responder; then implement the public route. |
| Hosted learner availability | Task 13: local readiness command and configuration/package evidence. | Authorized provider setup/deployment and actual Google/email/HTTPS/cross-device verification. |
| Privacy/terms/deletion | Task 10: factual data inventory and request/operator workflow draft. | Approved policies and deletion rules before implementing destructive account behavior. |
| Monitoring and restoration | Tasks 8-9: safe emitted diagnostics and synthetic recovery proof. | Cloud collection/alerts, responder, real backup destination/schedule/key custody and hosted restore. |
| Unsafe protected drafts | Task 7: service-only withdrawal state, concurrency tests and runbook. | Authorized hosted migration; operator action on a real affected version. |
| Lost reading position | Task 2: serialized keepalive save and authorized reconciliation. | Physical-device/forced-termination limits remain documented. |
| Lost Google destination | Task 3: encrypted flow return path and local tests. | Live Google configuration/verification. |
| Incorrect retry guidance | Task 4: real local/database cooldown and shared browser feedback. | Authorized hosted migration before deploying its new RPC caller. |
| Browser/accessibility evidence | Task 11: protected engine and automated accessibility coverage. | Actual screen-reader and physical phone checks; owner decision on gallery motion. |
| Performance/quotas | Task 12: repeatable local measurements. | Representative hosted workload, real media egress and physical-device measurement. |
| Roadmap/documentation drift | Tasks 1 and 13: corrected boundaries, safe instructions and actual evidence. | Future hosted evidence must be recorded when performed. |
| Billing and search expansion | Existing product decisions preserved. | Explicit changed release scope/provider/policy decisions; these are not missing autonomous implementation. |

## Final self-review and rollback boundaries

- [x] Each audit finding maps to a task or an explicit dependency in the table. No supplied fact, approval or hosted verification is invented.
- [x] Browser/server/SQL contract names match across tasks. New JavaScript modules have concrete consumers; speculative shared abstractions are absent.
- [x] The old rate-limit RPC survives as a single-count compatibility wrapper. New hosted code must not precede its authorized database migration.
- [x] Withdrawal is additive state and preserves submitted evidence. A rollback must not reactivate withdrawn instruction; disable affected entry points until compatible code is restored.
- [x] Runtime commits can be reviewed independently. Database changes are forward migrations; do not undo them by rewriting historical files.
- [x] Source publication is reproducible, public fallbacks still work and protected fixture/draft files remain outside published output.
- [x] Privacy-safe local tooling and benchmarks accept no remote target. Operational destinations, policies and deployment stay visible as external dependencies.

The Supabase [function security guidance](https://supabase.com/docs/guides/database/functions#secure-a-database-function) supports the pinned search path and explicit execute privileges used here. Relevant official documentation and the [changelog](https://supabase.com/changelog) were checked on 2026-10-08; recheck them before implementation involving providers. No dependency upgrade or external configuration change is part of this plan.
