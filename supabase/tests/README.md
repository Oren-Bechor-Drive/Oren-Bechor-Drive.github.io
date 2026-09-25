# Database and hosted API verification

## Local tests

Run `npm ci`, then `npm run test:database` as a regular user. `npm test` includes the same database suite. No hosted URL, credentials, Docker daemon, or existing database is used.

The helper starts pinned PostgreSQL 17.6 in an owned temporary directory on a free loopback port. It loads `database/auth-bootstrap.sql`, applies all migration files, and closes connections and removes the database afterward. The bootstrap models only the Auth columns, claims functions, API roles, inherited privileges, and automatic-RLS trigger needed by these tests. Never apply it to Supabase.

The 23 database tests exercise actual SQL roles and policies, including:

- Signed-out, unverified, anonymous, banned, soft-deleted, and suspended identity denial.
- Missing, malformed, expired, revoked, and mismatched sessions.
- Free/paid separation through tables, joins, and RPCs; draft/history/retirement denial.
- Inclusive grant start and exclusive end at one exact server statement time.
- Revocation, overlapping grants, expiry, renewal, and retained progress.
- Cross-learner isolation, column-restricted profile edits, and forbidden administrative writes.
- Validated progress, exact retries, safe conflict details, and two-connection insert/update races.
- Immutable versions, atomic publishing, and simultaneous trusted provisioning.
- Effective function privileges, pinned search paths, RLS flags, and continued automatic RLS after removing the legacy helper's direct API execution rights.

The local Auth contract cannot prove token validation, hosted API configuration, Google OAuth, email delivery, browser cookie handling, or payment behavior.

## Gateway and reader integration verified on 2026-09-25

The local gateway and desktop/mobile Chromium journeys use deterministic Auth with real disposable PostgreSQL. They cover saved reading percentages, stale-save conflicts, expiry, progress retained after a simulated 31-day lapse, renewal and learner isolation. Reader lifetime tests hold real responses to verify that superseded loads and saves cannot restore cleared content or steal focus. See [ownership and test seams](../../docs/ARCHITECTURE.md) and the [manual browser/API walkthrough](../../docs/manual-test-lessons.md).

The hosted smoke script now also asserts that `save_my_position` returns one saved-position object rather than an array. Adapter tests cover that response contract locally. This added hosted assertion has not been rerun against the hosted project; the dated hosted evidence below remains the earlier database-only verification.

## Hosted smoke test

`hosted-smoke.mjs` exercises the real Auth and REST endpoints using a publishable key and two short-lived synthetic password accounts. It is manual and never runs as part of CI. Run it only in the development project, with a trusted operator coordinating SQL fixture setup and cleanup. It uses no service-role key.

Prepare one mode-0600 JSON file outside the repository with this structure:

```json
{
  "url": "https://PROJECT.supabase.co",
  "key": "PUBLISHABLE_KEY",
  "sectionId": "OWNED_SECTION_UUID",
  "paidVersion": "OWNED_PAID_VERSION_UUID",
  "free": {
    "id": "OWNED_FREE_AUTH_UUID",
    "email": "FREE_TEST_EMAIL",
    "password": "TEMPORARY_RANDOM_PASSWORD",
    "learnerId": "FREE_LEARNER_UUID"
  },
  "paid": {
    "id": "OWNED_PAID_AUTH_UUID",
    "email": "PAID_TEST_EMAIL",
    "password": "TEMPORARY_RANDOM_PASSWORD",
    "learnerId": "PAID_LEARNER_UUID"
  }
}
```

The operator must create confirmed, nonanonymous synthetic Auth accounts with email identities, provision their learners through `provision_learner`, publish one section with clearly labeled Hebrew free and paid test text, and grant the paid learner a current development entitlement. Record all created IDs and a unique entitlement source reference for cleanup. Do not reuse real learner accounts or send verification email as part of this database check.

Run the phases in order, using the same fixture file and tokens:

```bash
node supabase/tests/hosted-smoke.mjs /path/to/private-fixture.json initial
```

Expire only the owned entitlement by setting its end to the current server time, then run `expired`. Add a new current development entitlement for the same learner, then run `renewed`. Remove only that synthetic learner's `auth.sessions` rows, then run `revoked`. The last phase reuses the still-unexpired token to prove session revocation is enforced.

The script stores access tokens in that private file and prints only phase/check results. The coordinating operator must use a `finally` cleanup path even if a phase fails: delete owned progress, entitlements, content versions and sections, identity mappings and learners, then synthetic refresh tokens, sessions, Auth identities and users. Remove the private credential file. Check all owned records are gone. These are test-fixture cleanup instructions, not an application account-deletion policy.

## Verified on 2026-09-23

- Final repository verification passed: 300 tests, including 23 database tests; media audit (151 image references), link audit (274 local references), dependency audit (zero vulnerabilities), and whitespace checks. A clean `npm ci` was verified before the final run.
- Applied migration `20260923154100_account_access_foundation.sql` to `zurpazevlvtylnzvagoo`; repository filename matches hosted migration history.
- All four hosted phases passed. Password sign-in returned real Supabase tokens. Direct reads, joins, RPC access, progress retention, renewal, forbidden state/entitlement edits, and session revocation behaved as expected.
- The API rejected the `private` schema with `PGRST106`.
- Cleanup left zero Auth users and zero rows in all six application tables. The automatic-RLS trigger remained enabled.
- Security advisors reported no warning/error findings. The informational [RLS-without-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) for `private.learner_identities` is intentional: API roles have no table grants or policies; narrow private helpers own lookups.
- Performance advisors reported only [unused-index notices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) on the new empty tables. Keep these ownership/foreign-key indexes until real workload measurements justify a change.

These database checks do not establish production readiness. The [local account screens and session gateway](../../docs/local-accounts.md) now have separate fixture tests. The public static preview remains public; production hosting, live Google and email configuration, actual billing, protected video, and actual course publication remain separate work.
