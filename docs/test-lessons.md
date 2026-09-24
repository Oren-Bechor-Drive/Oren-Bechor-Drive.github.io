# Local test lessons

This development slice connects the account gateway to two synthetic lessons. It has no checkout, real course material, or saved reading positions. The existing static course preview is still public.

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
- A successful response contains `{ lesson: { id, sectionId, accessLevel, revision, body } }`. The browser inserts `body` as text, not HTML.
- Signed-out, expired, and recovery sessions receive `401`. Missing or inaccessible versions receive the same `404` with `lesson_unavailable`. Provider outages receive `503`, and throttling receives `429`. Error responses contain no lesson body.
- Responses use `Cache-Control: private, no-store`. The browser stores no lesson text or provider tokens in browser storage. Leaving the page clears the rendered body, and returning to a hidden or restored tab rechecks access. Text already received cannot be made impossible to copy.

## Verification and limits

```bash
npm run test:gateway
node --test tests/browser/test-lessons-browser.test.mjs
npm run check:media
npm run check:links
npm test
git diff --check
```

Gateway tests cover signed-out/recovery denial, safe response fields, refresh, expiry during a read, methods, query rejection, no-store responses, and provider failure. The adapter test checks the RPC URL, arguments, publishable key and learner Authorization header.

`tests/helpers/test-lessons.mjs` combines deterministic Auth with disposable native PostgreSQL using the checked-in migrations, roles, RLS and RPCs. Gateway and Chromium tests exercise free access, paid denial, privileged grants, retry, repeatable setup, revocation, keyboard navigation, desktop/mobile layout, and disabled/blocked JavaScript. They never change hosted learners or the generated gallery list.

Hosted seed readback proves the two fixtures exist. It does not prove live gateway authentication, SMTP or Google sign-in. Saved positions, stale-revision conflicts, cross-device resume, and the full cancellation/expiry/renewal browser journey remain the next milestones.
