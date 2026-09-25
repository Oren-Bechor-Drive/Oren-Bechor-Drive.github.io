# Synthetic learning sections

The local test gateway publishes two synthetic sections to check account-only free reading, temporary paid access, and saved positions. They contain no driving instruction. The public course preview remains separate.

## Open the fixtures

For a credential-free browser walkthrough, use [the manual guide](manual-test-lessons.md). It starts a disposable PostgreSQL database and deterministic Auth gateway with the free section, paid section, long free text, and a synthetic quiz.

For a configured development project, follow [local account setup](local-accounts.md), apply both migrations, and publish titled synthetic sections as described below. Sign in and open `/account/learning.html`. Its section links lead to `/account/reader.html?section=<uuid>&access=free` or `access=paid`. The learning page builds these links from the authorized `GET /api/sections` catalog. The reader requires JavaScript and a local gateway; its static HTML retains navigation and an explanation.

## Publish hosted development fixtures

[test-lessons.sql](../supabase/development/test-lessons.sql) publishes these fixed IDs with legacy `publish_section`. The disposable fixture gives them titles in its own database. For the hosted development project, first apply the currently unapplied [protected-learning migration](../supabase/migrations/20260925090715_protected_learning.sql), then republish each synthetic section with `publish_learning_section` and a Hebrew title. Check each current revision and pass it as `p_expected_revision`. Legacy `publish_section` leaves `title` null, so the seed alone does not put these sections in the learning catalog. Do not assume they are currently available on the hosted project.

| Fixture | Section ID | Access level |
| --- | --- | --- |
| Free definition | `a524e32d-2640-4d94-a51c-000000000001` | `free` |
| Paid lesson | `a524e32d-2640-4d94-a51c-000000000002` | `paid` |

The IDs live in [the test fixture](../tests/fixtures/test-sections.mjs), not in production routing. The gateway never imports or runs development SQL. These files contain synthetic data only.

## Grant temporary test access

Only a trusted operator can grant access. Choose a verified synthetic Auth user. In the development project's SQL editor, run these settings and the full contents of [grant-test-access.sql](../supabase/development/grant-test-access.sql) on the same connection. Replace the UUID with the chosen Auth user ID.

```sql
select set_config('oren.test_auth_user_id', 'REPLACE_WITH_TEST_AUTH_USER_UUID', false);
select set_config('oren.test_access_until', (statement_timestamp() + interval '1 hour')::text, false);
```

The script writes one development entitlement with source reference `test-lessons:<auth-user-id>`. It requires a future end within seven days. Repeating it updates that grant and clears revocation. The entitlement is course-wide, so use a development project with synthetic content only. Reload the learning page to see the paid section. To end access immediately, run:

```sql
update public.entitlements
set revoked_at = statement_timestamp()
where source = 'development'
  and source_reference = 'test-lessons:REPLACE_WITH_TEST_AUTH_USER_UUID';
```

## Section and position contract

- `GET /api/sections` lists accessible section IDs, titles, and access levels. `GET /api/sections/<uuid>/free` or `/paid` returns an authorized `{ lesson: { id, sectionId, accessLevel, revision, body }, position, csrf, media }` response. Position is null before saving or has `{ contentVersionId, position, revision }`. Body text is rendered as text. Paid media descriptors belong to the authorized version.
- The account module serializes the read with session changes, verifies the learner, reads saved progress, then checks current body access through `read_section`. Those database reads are separate statements. A denied body read exposes neither body nor progress. There is no standalone position GET route.
- `POST /api/sections/<uuid>/<free-or-paid>/position` accepts exactly `{ contentVersionId, position, expectedRevision }`. Position is an integer from 0 to 10000, in hundredths of one percent. The first save expects revision 0. POST requires the session cookie, matching Origin, JSON content type, and current CSRF token.
- Saves use learner-scoped `save_my_position` under RLS. An identical retry returns the saved row without incrementing its revision. A changed stale save returns `409 position_conflict` with the learner's current position. The reader requires an explicit reload before another save. No route accepts a learner ID or claimed plan.
- Paid reading and saving require current access. After expiry, a paid position is visible only when a paid section read succeeds after renewal. A free section read can still return its free position. After ten days without renewal, earlier positions and attempts expire while explicit topic completions remain.
- Signed-out or expired sessions receive `401`. Inaccessible sections receive `404`; throttling receives `429`, and provider outages receive `503`. Responses are private and uncached. The browser keeps no lesson text or provider tokens in local or session storage.

The reader saves scroll progress after scrolling pauses and through its save button. It resumes the saved position for the same content version. A newer version starts from the top with a notice. On tab backgrounding or pagehide, the shared protected-page lifetime aborts requests and clears private DOM. Restoration rechecks access. A server save may finish after the browser aborts; a later authorized read determines the current position.

## Expiry, renewal, and verification

The [manual walkthrough](manual-test-lessons.md) uses `startLessonGateway({ quiz: true, longLesson: true })` and real scrolling. Its trusted `grant(email, until?)`, `revoke(email)`, and `expire(email, elapsedDays?)` controls affect only the disposable database. A finite grant simulates cancellation by ending without renewal. Expiry denies paid reads and saves while free reading remains available. Renewal within ten days retains progress; a backdated 31-day lapse clears old progress before renewal.

`tests/helpers/test-lessons.mjs` owns the database, deterministic Auth, synthetic publication, grant controls, and cleanup. Gateway and Chromium tests exercise PostgreSQL roles, RLS, section reads, saved-position conflicts, retention, two-learner isolation, quiz flows, and delayed browser responses. They do not establish hosted Auth, PostgREST, Cron, SMTP, billing, or production hosting behavior.

```bash
npm run test:gateway
node --test tests/browser/test-lessons-browser.test.mjs tests/browser/test-lesson-lifetime.test.mjs
node --test tests/gateway/lesson-access-journey.test.mjs tests/browser/lesson-access-journey.test.mjs
npm run check:links
npm test
git diff --check
```
