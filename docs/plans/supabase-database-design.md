# Supabase account and access database design

Status: Approved and implemented for development on 2026-09-23. Migration `20260923154100_account_access_foundation.sql` is applied. Local PostgreSQL and hosted Auth/REST tests passed; see [verification evidence](../../supabase/tests/README.md).

This is the first implementation slice of the [agreed product rules](paid-service-start.md), within the [paid-service architecture](paid-service-architecture.md). It specifies database ownership and access. The [local account gateway](../local-accounts.md) now implements account screens and cookie sessions. Live email delivery, Google OAuth configuration, payment integration, and production content publication remain separate work.

The 2026-09-25 [test-lesson integration](../test-lessons.md) uses these existing database contracts for saved percentages, conflict recovery, expiry, retained progress and renewal. Local gateway and desktop/mobile browser tests exercise real PostgreSQL; [manual reproduction](../manual-test-lessons.md) uses the same disposable fixture. No schema change was required. These results do not extend the dated hosted verification to a live browser/gateway journey.

## What this slice proves

A verified learner can read a free test explanation. A learner with a current paid entitlement can also read a paid test explanation in the same learning section. When that entitlement ends, the next request for paid text is denied without deleting progress. A new entitlement restores access. Another learner cannot read or change that progress.

The caller asks for a section and an access level, never another learner's ID or a claimed subscription state:

```text
readSection(sectionId, "free") -> current free content or unavailable
readSection(sectionId, "paid") -> current paid content or unavailable
readMyProgress() -> my saved positions, without lesson bodies
saveMyPosition(sectionId, accessLevel, contentVersionId, position, expectedRevision)
  -> saved position with revision, or a conflict
```

These contracts are implemented as database tables and SQL RPCs; the [architecture reference](../ARCHITECTURE.md#accounts-and-access-development-database) maps their names. The local gateway implements accounts; lesson reads and progress saves are not yet connected to it. A publishable API key alone does not identify a learner.

## Verified development baseline before migration

Read-only MCP inspection of project `zurpazevlvtylnzvagoo` found:

- Project URL: `https://zurpazevlvtylnzvagoo.supabase.co`.
- PostgreSQL 17.6.
- Zero public tables, zero Auth users, zero recorded migrations, and zero deployed Edge Functions.
- An enabled `ensure_rls` event trigger.
- New tables created by `postgres` do not automatically grant SELECT, INSERT, UPDATE, or DELETE to API roles. Other default privileges still exist, and defaults for objects created by `supabase_admin` differ.

The migration must explicitly revoke and grant privileges on its own objects. An unchecked dashboard option is not a substitute for inspecting actual grants. Do not alter Supabase-owned schemas or globally remove privileges from unrelated objects. The inspected `public.rls_auto_enable()` event-trigger helper is a narrow exception: revoke direct API execution while preserving its body and the `ensure_rls` trigger.

The database connection did not report a `pgrst.db_schemas` setting. That is not proof of the Data API's exposed schema list. Verify through the API before testing private-schema isolation.

## Chosen approach and alternatives

| Approach | Consequence | Decision |
| --- | --- | --- |
| Supabase Auth plus PostgreSQL access policies, with trusted operations behind an API | The database can deny direct content requests as well as requests through our interface. Billing changes remain privileged. | Recommended. Fits the selected services and makes isolation testable at the database boundary. |
| Trusted API using unrestricted database credentials for every learner request | Fewer database policies, but each endpoint must correctly reproduce all ownership and access checks. | Reserve privileged credentials for narrow administrative operations. |
| A paid flag stored in the browser or in user-editable profile metadata | A learner can change the claimed plan, or a stale claim can outlive paid access. | Reject. It cannot enforce the agreed access rules. |

The public frontend stays in plain HTML, CSS, and JavaScript. Ordinary learner queries use a verified Supabase user context so PostgreSQL policies apply. The database does not trust a learner ID supplied in a URL or request body.

The local gateway implements the architecture draft's service-owned HttpOnly cookie sessions and forwards each verified user's Supabase context for learner reads. Provider tokens stay in server memory. Database authorization tests use synthetic, transaction-local Auth claims; separate gateway and browser tests exercise session transport.

## Tables and ownership

Supabase owns `auth.users`, `auth.identities`, and `auth.sessions`. Store no passwords, Google credentials, or copies of Auth tokens in application tables. Google and password identities linked by Supabase to the same Auth user map to one learner. Account linking must use verified Auth flows, never an application-level email match.

Use six application tables for this slice:

| Table | Fields and constraints | Owner |
| --- | --- | --- |
| `public.learners` | `id uuid` primary key; `state text` limited to `active`, `suspended`, `deletion_pending`, `deleted`; `display_name text` of at most 100 characters, default empty; `created_at timestamptz`; `updated_at timestamptz`. | Provisioning creates the record. Only trusted lifecycle operations change state. An active learner may edit only their display name. |
| `private.learner_identities` | `auth_user_id uuid` primary key referencing `auth.users.id`; unique `learner_id uuid` referencing `learners.id`; `created_at timestamptz`. Foreign-key deletion is RESTRICT. | Trusted account provisioning. No browser table access. Keeps the domain learner ID independent of provider identity. |
| `public.learning_sections` | `id uuid` primary key; unique `source_key text`; `current_revision integer` greater than zero; `state text` limited to `draft`, `published`, `retired`; `created_at timestamptz`. | Content publisher. The source key maps to an authored section; it is not an authorization key or redirect destination. |
| `public.section_versions` | `id uuid` primary key; `section_id uuid` foreign key; `access_level text` limited to `free`, `paid`; positive `revision integer`; nonempty `body_text text`; `created_at timestamptz`. Unique `(section_id, access_level, revision)`. Also unique `(id, section_id, access_level)` for progress references. | Content publisher. Separate immutable rows contain free and paid explanations. This first slice uses plain-text test content. |
| `public.entitlements` | `id uuid` primary key; `learner_id uuid` foreign key; `scope text` equal to `oren-driving-course`; `starts_at timestamptz`; `ends_at timestamptz`; optional `revoked_at timestamptz`; `source text` equal to `development`; unique `source_reference text`; `created_at timestamptz`. Require `ends_at > starts_at`. | Privileged development fixture operations. Learners may inspect only their own grants and cannot create, extend, or revoke them. Real billing sources need a subsequent migration and verified payment commands. |
| `public.section_progress` | Composite primary key `(learner_id, section_id, access_level)`; `content_version_id uuid`; `position integer` between 0 and 10000; `revision bigint` greater than zero; `updated_at timestamptz`. Composite foreign key `(content_version_id, section_id, access_level)` references the matching content version. | The learner's atomic save operation. Position is reading position in basis points, not evidence of completion or a quiz grade. |

All required fields are NOT NULL. Generate UUIDs on the trusted side. Use timezone-aware timestamps and server time for decisions. Preserve referenced content versions; foreign keys use RESTRICT rather than cascading content or learner-history deletion. Account deletion needs its own approved workflow.

There is no `plan` column on the learner. Free access follows verified account status; paid access follows a current entitlement. This avoids a stale second copy of the access decision.

A section may have a free explanation and a paid explanation at the same revision. They must be separate rows because row-level security does not hide individual columns in a row. A free response never contains a hidden paid field. The publishing operation atomically inserts immutable content rows and advances `current_revision`; it must refuse publication without content at the selected revision. A reading-only section does not need a quiz or video.

Add an index on entitlement `learner_id` with the relevant validity columns and a static `revoked_at is null` predicate. Do not put the current time in an index predicate. Index referencing columns not already covered by the leading columns of an existing primary or unique index, including progress content-version references. Start without partitioning, progress event logs, or a separate content search index.

## Identity and access predicates

One private helper resolves the current learner from the verified request's `auth.uid()`. It returns no learner unless all of these hold:

1. An identity mapping exists.
2. The Auth account still exists, is not soft-deleted or anonymous, has a verified email, and is not currently banned.
3. The verified token contains a valid `session_id` matching a live `auth.sessions` row owned by that Auth user. Respect a session's explicit end time when present.

Read these facts from current server records, not from user-editable JWT metadata. A request with a malformed or missing identity/session must fail closed. Token signature, issuer, audience, and expiry validation remain the gateway's responsibility. The database session check adds revocation protection; it does not replace token validation.

A second predicate checks whether the resolved learner is active. A paid-content predicate then uses the current entitlement records:

```text
learner is active
AND entitlement belongs to learner
AND scope is oren-driving-course
AND revoked_at is null
AND starts_at <= server statement time
AND server statement time < ends_at
```

The end is exclusive. A grant ending at 12:00 permits a request at 11:59:59 and denies a request starting at 12:00. A valid future grant does not activate early. Overlapping grants allow access if any one is current and unrevoked. No scheduled job or JWT refresh is required for expiry to take effect on a new request.

Helpers that need protected Auth or identity records may be narrowly scoped SECURITY DEFINER functions in the unexposed `private` schema. Pin an empty search path, qualify every object, revoke default PUBLIC execution, and expose only the required helper execution to policy callers. They take no arbitrary learner ID and return only the caller's identity or a boolean. Their reviewed bypass avoids recursive policies; ordinary learner queries retain RLS.

## Access matrix

| Resource or operation | Signed out / unverified | Active free learner | Active paid learner | Suspended learner |
| --- | --- | --- | --- | --- |
| Static homepage and topic descriptions | Allow | Allow | Allow | Allow |
| Published free explanation | Deny | Allow | Allow | Deny |
| Published paid explanation | Deny | Deny | Allow | Deny |
| Draft, retired, or historical lesson body | Deny | Deny | Deny | Deny |
| Own progress positions | Deny | Allow, including retained paid positions | Allow | Deny |
| Save a position | Deny | Own currently accessible free content only | Own currently accessible content only | Deny |
| Other learner's data | Deny | Deny | Deny | Deny |
| Edit own display name | Deny | Allow | Allow | Deny |
| Change account state or an entitlement | Deny | Deny | Deny | Deny |

Reading saved positions does not return lesson bodies, answer explanations, media grants, or quiz answers. A paid position may remain visible as progress metadata after expiry without reopening the lesson. A learner cannot save progress for an inaccessible paid version or reassign an existing progress row to another learner.

## Grants, writes, and errors

- Enable RLS explicitly in migrations on every application table, including private tables. Revoke inherited grants on each newly created application object before granting the minimum operation set. Do not rely solely on the event trigger.
- Grant `authenticated` SELECT only where policies need it. `anon` receives no application table access. Never grant TRUNCATE, REFERENCES, TRIGGER, or unrestricted function execution to learner roles.
- Grant display-name updates by column, with policies restricting both the old and new row to the active caller. Learners cannot update lifecycle state or IDs.
- Deny direct learner INSERT, UPDATE, and DELETE on progress. A narrow atomic save operation binds the learner to the authenticated caller, validates the content-version relationship and current access, and owns revision handling. Its public wrapper is SECURITY INVOKER; any necessary privileged mutation implementation lives in the unexposed private schema and rechecks identity, ownership, and access before writing.
- For a first save, require `expectedRevision = 0`. For later saves, lock the existing row and compare the supplied revision. A changed value with a stale revision returns a conflict without writing. An exact retry whose complete saved values already match returns the existing row without advancing revision. Other stale retries require the caller to reload before resubmitting.
- The server assigns update timestamps and revisions. Reject out-of-range positions, inconsistent section/version/access-level pairs, and attempts to supply a different owner. Do not silently coerce them into valid data.
- Provision the learner and identity mapping in one trusted transaction after verified authentication. The unique Auth mapping makes retries and simultaneous first requests converge on one learner. User input never determines lifecycle state or paid access.
- The trusted API maps missing and unauthorized lesson bodies to the same unavailable response. A login error may identify the need to sign in without exposing another learner's existence. A progress conflict includes only the caller's current safe position and revision.

Use learner-scoped database access for learner requests. Administrative credentials bypass RLS and are reserved for tested provisioning, fixture grants, and publishing operations. A passing admin query is not evidence that RLS works.

## Billing, media, and quiz boundaries

This slice deliberately creates development grants, not subscriptions or payment records. Cancelling future renewal must leave the existing grant's end unchanged. The database tests prove that this end controls access, but they do not claim to test a real cancellation or renewal notification.

When billing is implemented, it owns subscription records, verified payment events, idempotency, and the conversion of paid periods to entitlements. Monthly means the provider's monthly billing period, not a hardcoded 30-day timer. Store actual period boundaries supplied by the provider. Price remains unset; currency is ILS. Failed-payment grace, refunds, and disputes must not acquire accidental policies from test fixtures.

Video playback will require private delivery and an authorization check before issuing a grant, with delivery access bounded by the subscription end and a short playback window. This design does not promise instant revocation of a previously issued bearer URL or removal of content already delivered. Real videos and quiz questions are not available yet, so this slice does not invent media records, answer keys, scores, or retention rules for quiz attempts.

Live account verification still requires configured Google and custom SMTP, including Hebrew email templates. Test the actual sign-in/recovery paths; SQL Auth fixtures and local gateway fixtures do not prove those external flows.

## Verification required before calling the foundation implemented

Use real PostgreSQL role and policy tests, with synthetic learners A and B, one unverified learner, one suspended learner, and bounded session fixtures. Run fixture writes inside transactions that roll back. Never change a real account for a test.

| Test | Required result |
| --- | --- |
| Anonymous, unverified, and anonymous-Auth identities request a lesson | No body returned. |
| Verified free learner requests a mixed section | Only the published free row is visible. |
| Paid learner requests the same section | Free and paid published rows are visible. |
| Learner uses a direct REST query, a join, a historical version ID, or an RPC | Same access rules; no bypass through a second route. |
| Grant starts in the future, ends now, or is revoked | Paid body is denied on the next request. |
| Renewal fixture adds a current grant | Paid body becomes readable with old progress intact. |
| Learner attempts to grant paid access or edit account state | Operation denied by grants and policies. |
| A reads or writes B's records | No B data returned or changed. |
| Session is revoked while its token has not expired | Protected content and progress operations deny it. |
| Two devices submit different positions with the same revision | One succeeds; the other gets a conflict. |
| A successful save is retried unchanged | No duplicate row or revision increment. |
| A new content revision is published | New reads use it; existing progress still references an intact older version. |
| Paid grant expires | Free reading continues; progress rows remain; paid position writes are denied. |
| Database grants, RLS flags, helper privileges, and API exposure are inspected | No unplanned learner privileges or exposed private tables/functions. |

Maintain migrations and SQL tests in the repo. Test from an empty local database before applying reviewed migrations to this development project. Follow with direct hosted API smoke tests and Supabase security advisors. Run repository tests for any runtime integration and `git diff --check` before completion. A documentation-only design does not count as passing these future acceptance tests.

## Implemented database files

The database-only deliverable contains:

- `supabase/config.toml`: local development configuration and explicit API exposure.
- `supabase/migrations/`: CLI-generated migration files containing the six tables, constraints, grants, helpers, policies, and atomic progress operation.
- `supabase/tests/database/`: the test-only Supabase Auth schema contract.
- `tests/database/` and `tests/support/database.mjs`: role-based database tests, transaction-owned fixtures, and the isolated PostgreSQL runner.
- `docs/ARCHITECTURE.md` and `README.md`: describe implemented ownership and test commands only after the migration is verified.

Do not embed real paid lesson text or production fixtures in this public repository. Synthetic test text must be clearly labeled in Hebrew as test content. Existing static course files remain publicly retrievable until a separate publication change removes restricted bodies and assets from public delivery.

## Evidence and current provider constraints

- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security): policies, helper functions, and access through exposed schemas.
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions): session IDs, token lifetime, and the limits of token-only checks after sign-out.
- [Explicit Data API grants](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically): current table-exposure behavior.
- [Free-plan email template change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier): custom SMTP is needed to customize Auth email templates on a new Free project.

The live baseline above was checked using MCP. Google configuration, SMTP configuration, project region, and a live browser authentication flow were not verified by those database reads.
