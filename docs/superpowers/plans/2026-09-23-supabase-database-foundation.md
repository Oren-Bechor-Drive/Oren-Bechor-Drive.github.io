# Supabase database foundation implementation plan

> For agentic workers: use superpowers:executing-plans to implement this plan task by task. The user approved the database design and development-project application.

**Goal:** Implement and verify the six-table account/access foundation against local PostgreSQL and the connected Supabase development project.

**Architecture:** Supabase Auth supplies verified identity. Explicit PostgreSQL grants, RLS, and narrow private functions own content visibility, entitlement validity, provisioning, and atomic progress saves. Ordinary learner operations never use administrative database credentials.

**Tech Stack:** Plain SQL, PostgreSQL 17, JavaScript ES modules, Node's test runner, pinned Supabase CLI, embedded-postgres, and node-postgres for isolated database tests.

**Spec:** [Approved database design](../../plans/supabase-database-design.md).

## Global constraints

- Preserve the plain HTML, CSS, and JavaScript frontend with no serving build step.
- Application tables and privileges follow the approved six-table design.
- Currency is ILS, live price is unset, and this slice creates development entitlements only.
- Expiration never deletes progress.
- Auth tokens, secrets, and real paid content stay out of repository files and logs.
- Authored text uses ASCII punctuation; learner-facing fixtures are Hebrew and clearly identified as tests.
- Use synthetic fixtures. Local tests own their database; hosted smoke tests remove only their own records.

## Task 1: Executable local database contract

**Files:** `package.json`, `package-lock.json`, `supabase/config.toml`, `tests/support/database.mjs`, `tests/database/foundation.test.mjs`, `supabase/tests/database/auth-bootstrap.sql`.

**Interfaces:** A test helper starts native PostgreSQL 17 on a free loopback port, loads the minimal Auth/role contract, applies sorted migration files, and returns a connection factory plus cleanup. SQL tests run inside a rollback transaction. The Auth fixture is test-owned and never applied to hosted Supabase.

- [x] Pin development dependencies and initialize Supabase configuration with the CLI.
- [x] Write a failing schema contract before migrations exist:

```js
assert.deepEqual(result.rows.map(({ table_name }) => table_name).sort(), [
  'entitlements', 'learner_identities', 'learners',
  'learning_sections', 'section_progress', 'section_versions',
]);
```

- [x] Run `npm run test:database`. Expected: assertion failure for missing application tables, with native PostgreSQL successfully started and stopped.
- [x] Write role-based SQL assertions for free/paid visibility, revocation, cross-learner isolation, malformed identity, draft/history denial, retained progress, invalid writes, and exact expiry boundaries.

## Task 2: Migration, identities, and content access

**Files:** CLI-created files in `supabase/migrations/`; SQL tests from Task 1.

**Interfaces:** `private.current_learner_id() -> uuid`, `private.active_learner_id() -> uuid`, `private.has_paid_access() -> boolean`; service-only `public.provision_learner(p_auth_user_id uuid) -> uuid`; `public.read_section(p_section_id uuid, p_access_level text) -> setof public.section_versions`.

- [x] Generate migration filenames using `supabase migration new` and implement the six tables, foreign keys, indexes, explicit privilege revocation/grants, and RLS.
- [x] Add narrow private identity helpers with fixed search paths. Read current Auth account/session records and learner state; no user metadata decides access.
- [x] Provide idempotent verified-account provisioning and atomic content publication; forbid mutation of published version bodies. Administrative operations are callable only by `service_role` or the database owner.
- [x] Run local SQL tests. Expected: verified free identities see only current free rows; active paid identities see current free and paid rows; forbidden roles cannot mutate protected records.

## Task 3: Progress and concurrent operations

**Files:** migration SQL, `tests/database/foundation.test.mjs`.

**Interfaces:** `public.save_my_position(p_section_id uuid, p_access_level text, p_content_version_id uuid, p_position integer, p_expected_revision bigint) -> public.section_progress`. First writes require revision zero; stale changed writes raise SQLSTATE `40001`. Exact retries return the existing row.

- [x] Write failing progress tests for an initial save, stale writes, out-of-range positions, incorrect content-version associations, inaccessible paid progress, and retry without a duplicate revision.
- [x] Implement a public SECURITY INVOKER wrapper and private identity-bound mutation. Serialize by learner/section/access level before inspecting the row so simultaneous first inserts obey the same revision contract as updates.
- [x] Use two real database connections to submit competing first saves and competing updates. Expected: exactly one succeeds in each race, the other returns `40001`, and no ownership or progress is lost.
- [x] Verify expiry leaves position rows readable while denying paid updates; renewal restores access to the existing position.

## Task 4: Hosted verification and project documentation

**Files:** `README.md`, `docs/ARCHITECTURE.md`, `docs/plans/paid-service-start.md`, `docs/plans/supabase-database-design.md`, `.github/workflows/tests.yml` if needed for test dependencies.

- [x] Run local database tests and `npm test`, plus existing media/link audits and `git diff --check`. Expected: all required checks pass.
- [x] Run a fresh-context review of SQL grants, SECURITY DEFINER boundaries, session validation, concurrent writes, content immutability, and cleanup. Fix verified findings with regression tests.
- [x] Inspect the hosted schema immediately before migration, then apply the reviewed migration to project `zurpazevlvtylnzvagoo` through MCP. Preserve the applied migration version in the local filename.
- [x] Verify hosted table definitions, grants, and advisors. Test real HTTP requests using short-lived synthetic accounts: signed-out denial, free/paid visibility, expiry, retained progress, and a forbidden owner/entitlement change. Remove only the owned fixtures in a guaranteed cleanup path.
- [x] Record implemented boundaries and repeatable test commands. Clearly distinguish database/API verification from Google login, email delivery, UI, payment, and media work that has not shipped.

## Execution ledger

- Ruling: Docker's daemon is unavailable and starting it requires credentials. Use native PostgreSQL 17.6 in an owned temporary directory for migration, role, and concurrency tests. Hosted API smoke tests cover Supabase integration beyond the local Auth contract.
- Ruling: Work in `.worktrees/supabase-database-foundation` on `feat/supabase-database-foundation`; preserve the prior documentation edits. Integrate only the completed task's files back into the user's checkout after verification.
- Pre-flight: tasks 2 and 3 share learner identity helpers and progress constraints; tests use the same RPC signatures above. Hosted tests consume the migrations verified locally.

- Completed: 23 PostgreSQL authorization, boundary, privilege, and concurrency tests. The initial empty-schema test failed before implementation; later soft-delete, conflict-detail, and legacy-helper ACL regressions were each observed failing before their fixes.
- Ruling: role assertions live in the Node database suite as executed SQL; the separate `access.sql` file was unnecessary. The bootstrap remains SQL and is local-only.
- Review: fresh-context review found no critical/important issue. Added structured conflict details and effective function-privilege tests for its two minor findings.
- Hosted: applied migration version `20260923154100`; aligned the CLI-generated local migration filename with recorded hosted history. Authenticated HTTP phases for initial access, expiry, renewal, and session revocation all passed. All owned database/Auth fixtures and the local credential file were removed.
- Advisors: no security warnings/errors; intentional private identity-table RLS-without-policy info and unused-index info on empty tables are documented in `supabase/tests/README.md`.
- Ruling: tightly restrict direct execution of the pre-existing automatic-RLS event-trigger helper. Tests and hosted inspection confirm the trigger remains active. No other platform function or schema was changed.
- Final verification in the user checkout after integration: clean `npm ci`; all 300 tests passed; media and link audits passed; dependency audit found zero vulnerabilities; whitespace checks passed.
