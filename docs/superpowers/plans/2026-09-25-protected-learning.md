# Protected Learning Implementation Plan

> For agentic workers: Use subagent-driven-development for the database work and review; the controller owns gateway integration. Parent alone stages and commits.

**Goal:** Implement protected quizzes, saved learning progress, optional topic completion, ten-day lapse cleanup, and protected content delivery.

**Architecture:** PostgreSQL owns authorization, immutable quiz revisions, grading, optimistic draft updates, completion and retention. The existing same-origin account gateway keeps tokens server-side. Empty Hebrew HTML shells fetch only authorized content. Private media is delivered through an authenticated server endpoint.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node, Supabase REST and PostgreSQL, native PostgreSQL tests and Playwright.

**Spec:** `docs/plans/paid-release-scope.md` and the user's approved decisions.

## Global constraints

- Hebrew visitor copy, RTL, ASCII punctuation, DESIGN.md focus and layout rules.
- Exactly 20 questions, all answered before submission; passing at 17; unlimited retries; manual completion.
- No answer keys in public files or unfinished-attempt responses.
- Keep all learning data while access is active and for ten days after expiry; delete positions/drafts/attempts after that deadline, never topic completions. A late renewal must not recover expired data.
- No fabricated instructional content, approvals, business details, price or payment provider. Use synthetic test fixtures only. Real checkout remains unavailable until provider and price are supplied.
- Existing process-local gateway remains a development host; production hosting/session storage and real provider verification are separate release prerequisites.

## Task 1: Database quiz and retention operations

Files: new CLI-created migration under `supabase/migrations/`; `tests/database/protected-learning.test.mjs`; synthetic fixture under `tests/fixtures/` if useful.

- [x] Add service-only publication of immutable quiz revisions and private answer keys, learner-owned drafts/submissions and durable topic completions.
- [x] Add strict publication validation: exactly 20 unique questions, each has 2-6 unique choices, valid correct choice and nonempty explanation. Require recorded approval reference. Never seed real content in a migration.
- [x] Implement learner RPCs with fixed below contract, authenticated live learner and paid-access checks. Draft save uses expected revision and identical retry is idempotent; submit grades only server-side, stores immutable results, and is idempotent. One unfinished attempt per topic, unlimited submitted attempts. Existing draft pins its version when content is updated.
- [x] Implement cleanup and late-renewal behavior, serialized against progress/attempt writes and entitlement changes. Expose service-only sweep for scheduled execution, and make request/renewal paths enforce deadline even if sweep has not run. Preserve completions, account and billing identity. Hide stale rows on direct learner reads.
- [x] Verify native PostgreSQL RLS/direct RPC bypass, no keys in unfinished responses, 16/17/20 scores, missing/invalid/foreign answers, revisions/retries, other learner isolation, expired access, immutable revisions, lapse boundaries, late renewal and concurrency.

RPC contract (all return one JSON object except sweep; names prefixed `public.`):

```
my_learning(): {topics:[{key,title,completedAt}], paidAccess:boolean}
start_my_quiz(p_topic_key text): attempt
read_my_attempt(p_attempt_id uuid): attempt
save_my_quiz(p_attempt_id uuid,p_answers jsonb,p_expected_revision bigint): attempt
submit_my_quiz(p_attempt_id uuid,p_expected_revision bigint): attempt
my_quiz_history(p_topic_key text): {attempts:[{id,submittedAt,score,passed}], hasMore:boolean}
complete_my_topic(p_topic_key text): {key,completedAt}
```

`attempt = {id,topicKey,title,revision,status:'draft'|'submitted',questions:[{id,prompt,options:[{id,text}]}],answers:{questionId:optionId},score:null|integer,passed:boolean,submittedAt:null|string}`. Submitted only adds `results:[{questionId,correctOptionId,explanation,correct}]`. History latest 50 with `hasMore`; add cursor later only if needed for fixture history >50 (must make all history accessible, extend contract with cursor then inform controller).

Publication service RPC: `publish_quiz(p_topic_key text,p_title text,p_questions jsonb,p_approval_reference text)` returns version UUID. Authored question adds `correctOptionId,explanation` to safe question shape. Errors: `42501` unavailable, `22023` invalid input, `40001` stale revision. Notify controller of exact cleanup RPC and contract additions before integration.

## Task 2: Gateway and protected learner UI

Files: `server/gateway.mjs`, `server/learner-accounts.mjs`, `server/supabase.mjs`; new `account/learning.html`, `account/learning.js`, `account/learning.css`; `account/index.html`; tests helpers and gateway/browser journey tests.

- [x] Extend narrow token-bearing provider methods for the task 1 RPCs. Reuse session serialization and fresh identity validation.
- [x] Add GET `/api/learning`, POST `/api/quizzes/<topic>/start`, GET `/api/quizzes/<topic>/history`, GET `/api/attempts/<uuid>`, POST `/api/attempts/<uuid>/{save,submit}`, POST `/api/topics/<topic>/complete`. Exact fields, limits, origin/CSRF, safe mapped errors, no caching.
- [x] Render empty initial shell, topic buttons, resumable questions, explicit save plus autosave on selections, history/results, retries and manual completion. Preserve unsaved values on network errors; no silent stale-overwrite retries. All 20 required. Clear private UI on background/pagehide and revalidate on return.
- [x] Integrate real Postgres fixture provider and verify reload/resume, scores/explanations, completion, expiry and cleanup through HTTP and browser. Keep generated photos unchanged.

## Task 3: Protected lesson and media delivery

Files: server learning catalog/provider routes, private-media module; learner UI; fixture and security tests.

- [x] Add approved published section discovery/read using existing immutable section/version access model, expose free definitions and paid sections through authenticated endpoints, with existing position save RPC.
- [x] Serve media only through authenticated entitlement checks using server-owned metadata and private source files outside the public roots. Support video range requests; refuse traversal/symlink/public roots, safe content types and no-store.
- [x] Verify unauthenticated/free/expired access denied, unrelated learner paths cannot override ownership, direct static URLs fail, streaming/range and free definitions work.

## Task 4: Verification and release documentation

- [x] Run relevant tests while developing, then complete `npm test`, `npm run check:links`, `npm run check:media`, `git diff --check`.
- [x] Check desktop/mobile and pointer/keyboard focus in collaborative browser or local Chromium when unavailable.
- [ ] Complete final whole-branch review. Database and gateway/UI task reviews have already found and verified fixes.
- [x] Update README, PRODUCT, CONTEXT and architecture with actual capabilities, scheduled cleanup setup and remaining external inputs. Record provider/price status without implying live billing is enabled.

## Verification record

- `npm test`: 478 tests passed, 0 failures/skips, 2026-09-25. Includes native PostgreSQL, Chromium account/learning/media/gallery/delivery checks and existing Firefox/WebKit checks.
- `npm run check:links`: 530 local references across 36 authored pages.
- `npm run check:media`: 171 image references across 36 authored pages.
- `git diff --check`: clean.
- Desktop1440 and mobile390 Chromium journeys verify resume,17/20 grading,manualcompletion,expiry,real scroll position and keyboard/pointer focus. Failure tests cover autosave outages, repeated background restoration and revision conflicts.
- Collaborative browser could navigate and sign in, but snapshot/click/resize automation failed intermittently and then lost its host. Local Playwright Chromium completed the affected journeys and visual inspection; screenshots are temporary verification artifacts outside the repo.
- Billing remains disabled at the owner's request; ILS150/month and3-day trial recorded. No hosted migration, cleanup schedule, content publication or deployment performed.
