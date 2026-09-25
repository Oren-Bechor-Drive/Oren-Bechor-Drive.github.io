# Local test lessons

This development slice connects the account gateway to two synthetic lessons. It supports saved reading positions in the learner account, with no checkout or real course material. The existing static course preview is still public.

## Open the lessons

1. Configure the gateway using [local account setup](local-accounts.md), then run `npm run dev`.
2. Sign in with a verified development learner account.
3. Open the account page's `לשיעורי הבדיקה` link, or visit `http://localhost:3000/account/test-lessons.html`.
4. Open the free lesson. Open the paid lesson to check its unavailable state before granting test access.

Navigation and explanations remain available without JavaScript. Loading a lesson body requires JavaScript and the local gateway. Static hosting has only the empty page shell. There are no demo login credentials in application code.

## Seed development content

Run [test-lessons.sql](../supabase/development/test-lessons.sql) in the development project's trusted SQL editor after applying the existing migration. The fixtures were seeded and read back in project `zurpazevlvtylnzvagoo` on 2026-09-24. Setup is repeatable: existing published fixture sections retain their versions; a conflicting source key or retired section stops setup.

| Lesson | Section ID | Access level |
| --- | --- | --- |
| Free test | `a524e32d-2640-4d94-a51c-000000000001` | `free` |
| Paid test | `a524e32d-2640-4d94-a51c-000000000002` | `paid` |

The gateway fixes these targets in `server/test-lessons.mjs`. The SQL publishes each through `public.publish_section`. Test bodies contain no driving instruction and are never embedded in browser HTML or JavaScript. These files are development data, not migrations or actual course publication.

## Grant temporary test access

Only a trusted operator can grant access. Choose a verified synthetic Auth user from the development project. In the SQL editor, run the following settings and the full contents of [grant-test-access.sql](../supabase/development/grant-test-access.sql) together on the same connection. Replace the Auth user ID with the chosen test user's UUID.

```sql
select set_config('oren.test_auth_user_id', 'REPLACE_WITH_TEST_AUTH_USER_UUID', false);
select set_config('oren.test_access_until', (statement_timestamp() + interval '1 hour')::text, false);
```

Append `supabase/development/grant-test-access.sql` to those two statements before running them.

The script provisions or resolves that learner and writes one development entitlement with source reference `test-lessons:<auth-user-id>`. It requires a future end within seven days. Re-running it updates the same grant and clears its revocation; use it only when granting or renewing test access deliberately. Keep an exact end timestamp if retrying the same operation. The entitlement has the existing course-wide scope, so use a development project with synthetic content only.

Return to the paid test lesson and select `ניסיון נוסף`. The text becomes available only after the database permits the read. To end a test grant immediately, run this trusted SQL with the exact reference:

```sql
update public.entitlements
set revoked_at = statement_timestamp()
where source = 'development'
  and source_reference = 'test-lessons:REPLACE_WITH_TEST_AUTH_USER_UUID';
```

Reload the paid lesson to verify denial. Free access remains. No browser or gateway endpoint publishes content, grants access, or accepts a learner ID or claimed plan. Grant scripts are not executed by `npm run dev`.

## Read contract

- `GET /api/lessons/free` and `GET /api/lessons/paid` accept the existing HttpOnly session cookie. Query parameters and non-GET requests are rejected.
- The account module serializes reads with session changes, checks the current verified identity and active learner, refreshes tokens when needed, and calls `public.read_section` using the learner token and publishable key. The secret key is never used to read lessons.
- A successful response contains `{ lesson: { id, sectionId, accessLevel, revision, body }, position, csrf }`. Position is null before the first save, otherwise `{ contentVersionId, position, revision }`. The CSRF token belongs to the same admitted session. The browser opens the reader with this one response and inserts `body` as text, not HTML.
- Preparation runs under one serialized learner-account operation and one identity/admission check. It reads saved progress before checking the current lesson body, so an entitlement that expires during preparation denies the complete response. These are separate database statements, not a transactional snapshot. A position-read failure also returns an error without partial reading data. Independent position reads remain available after paid access expires.
- Signed-out, expired, and recovery sessions receive `401`. Missing or inaccessible versions receive the same `404` with `lesson_unavailable`. Provider outages receive `503`, and throttling receives `429`. Error responses contain no lesson body.
- Responses use `Cache-Control: private, no-store`. The browser stores no lesson text or provider tokens in browser storage. Leaving the page clears the rendered body, and returning to a hidden or restored tab rechecks access. Text already received cannot be made impossible to copy.

## Save and resume reading positions

The test texts are short, so the page uses an explicit percentage field instead of automatic scroll tracking. Enter a value from 0 to 100 and select `שמירת מיקום`. Reload the page or sign in to the same account in a separate browser to restore the saved percentage. Changes are saved only when requested; leaving or hiding the page discards unsaved edits.

To exercise a conflict, open the same lesson in two signed-in browsers before saving. Save a different value in the first, then save from the second. The second browser preserves its unsaved input, explains the conflict, and disables saving until `טעינת המיקום השמור` loads the current value. It never retries a changed stale save automatically. After a connection failure, retrying the same save is safe, even if the previous response was lost.

- `GET /api/lessons/free/position` and `GET /api/lessons/paid/position` return `{ position: null }` before the first save, otherwise `{ position: { contentVersionId, position, revision } }`. The integer position runs from 0 to 10000, representing hundredths of one percent.
- `POST` to the same endpoints accepts exactly `{ contentVersionId, position, expectedRevision }`. The first save expects revision 0; later saves use the loaded revision. Requests require the session cookie, matching Origin, JSON content type and the session's CSRF token. Unknown fields, invalid UUIDs, out-of-range positions and unsafe revisions are rejected.
- Reads query `section_progress` with the learner token and fixed lesson target. RLS limits results to the current learner. Saves call the existing `save_my_position` function with that token. Neither endpoint accepts a learner ID, section ID or claimed plan.
- A changed stale save returns `409` with `position_conflict` and the learner's current position, read again through RLS. Provider error details are never returned. An identical retry returns the existing position without incrementing its revision.
- Saved positions remain readable after paid access ends, but paid lesson bodies and saves require current access. An unavailable or superseded content version cannot be saved. On loading a newer lesson version, the page shows the previous saved percentage with a notice to review it before saving.
- Position responses are private and uncached. The page stores no progress in localStorage or sessionStorage. Hiding or leaving the page aborts pending requests and clears the displayed lesson and position; restoration reloads both. A save already accepted by the server may complete after the browser aborts.

## Simulated cancellation, expiry and renewal

For hands-on checks with disposable local accounts, follow [Manually test lesson access](manual-test-lessons.md). It includes browser steps, direct requests and Node console controls for expiry and renewal.

The local API and browser journeys cover a finite paid test period, its expiry, and renewal with saved progress intact. Simulated cancellation means leaving the current entitlement's end unchanged and issuing no renewal. There is no subscription record, cancellation endpoint or payment scheduler in this slice.

`tests/helpers/test-lessons.mjs` provides a trusted `expire(email, elapsedDays = 0)` operation only inside its disposable database. It moves that learner's development entitlement end to database statement time, or backdates it by the supplied whole days. It also moves the start earlier when necessary to preserve a valid period. It does not revoke access, change the application clock, delete progress or update hosted data. This avoids timed sleeps and keeps PostgreSQL's real time-based access checks in the journey.

The tests verify:

- Signed-out lesson requests return only an error, and a free learner cannot read paid text.
- A finite, unrevoked paid period allows reads and saves before its end.
- Expiry denies paid reads and saves, including an identical save retry, while free reading and saving remain available.
- Expiry during an open browser lesson rejects the next save and clears the rendered text and controls. Reloading also denies the lesson.
- Saved progress remains unchanged with an entitlement that ended 31 days ago. This backdated fixture checks the access state after a lapse; it does not simulate a month of background operations.
- Renewal restores the paid text and saved percentage. Two independently signed-in learners save separate positions for the same content, and neither learner's updates overwrite the other's. API requests with a claimed learner selector are rejected.

## Verification and limits

```bash
npm run test:gateway
node --test tests/browser/test-lessons-browser.test.mjs tests/browser/test-lesson-lifetime.test.mjs
node --test tests/gateway/lesson-access-journey.test.mjs tests/browser/lesson-access-journey.test.mjs
npm run check:media
npm run check:links
npm test
git diff --check
```

Gateway tests cover signed-out/recovery denial, safe response fields, refresh, expiry during a read, methods, query rejection, no-store responses, and provider failure. The adapter test checks the RPC URL, arguments, publishable key and learner Authorization header. The save RPC returns one JSON object; collection reads return arrays. A browser regression test runs the real adapter with that single-row response shape and verifies the immediate success message and restored percentage. The hosted smoke script also checks that response shape when run with an owned fixture.

`tests/helpers/test-lessons.mjs` combines deterministic Auth with disposable native PostgreSQL using the checked-in migrations, roles, RLS and RPCs. Gateway and Chromium tests exercise free access, paid denial, privileged grants, retry, repeatable setup, revocation, saved-position isolation, idempotent retries, CSRF/input rejection, save/reload, separate-browser resume, conflict recovery, network retry, keyboard navigation, desktop/mobile layout, and disabled/blocked JavaScript. They never change hosted learners or the generated gallery list. Browser lifetime tests also hold already-received responses to verify that hiding, restoration and newer loads invalidate old completions. A superseded conflict reload cannot steal focus after a newer load completes; a late save response cannot restore cleared text or controls. A save accepted before hiding still resumes on the next load. These tests dispatch the page-lifetime events explicitly; they do not claim browser back-forward cache eligibility.

Hosted seed readback proves the two fixtures exist. It does not prove live gateway authentication, SMTP or Google sign-in. Saved-position and access-lifecycle verification use the local gateway with deterministic Auth and real PostgreSQL, including Chromium journeys at 1440px and 390px. Live hosted PostgREST integration is covered by adapter contract tests only. These journeys do not verify payment-provider cancellation or renewal, actual checkout, or production hosting.
