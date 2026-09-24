# Local gateway architecture implementation plan

**Goal:** Implement both selected architecture improvements: owned lesson-fixture lifecycle and shared local application startup.

**Architecture:** The lesson fixture owns synthetic identities, PostgreSQL sessions, grant transactions and cleanup. A local application module owns HTTP routing, listener settings and lifetime, with the command-line launcher and test fixture as its two consumers.

**Tech stack:** Plain JavaScript modules, Node HTTP, native PostgreSQL and Playwright Chromium.

**Scope:** Preserve the access rules, static file allowlist, loopback-only launcher, production refusal and existing browser behavior. Preserve the earlier uncommitted lesson implementation. No dependency or migration changes.

## 1. Own lesson fixture lifecycle

- [x] Add a regression test that rejects an expired grant, then successfully grants access without caller rollback. Add two-learner grant/revoke isolation checks.
- [x] Give the deterministic account provider one session-user creation operation used by password login, code exchange and refresh. Create database identity/session state before recording issued tokens.
- [x] Keep database handles, provider tokens and identity maps private in `tests/helpers/test-lessons.mjs`. Expose `origin`, `grant(email, until?)`, `revoke(email)` and idempotent `close()`.
- [x] Give each grant its own connection, including rollback and connection closure on failure. Scope revocation to the supplied learner. Always close PostgreSQL after the HTTP listener.
- [x] Move seed/grant idempotency assertions into database tests. Retain direct role/privilege checks in `tests/database/foundation.test.mjs`.
- [x] Run gateway/database lesson tests and existing browser lesson journeys.

## 2. Share application startup

- [x] Add tests for static/API routing, a usable ephemeral origin, bind failure, invalid origins, and repeated shutdown with open connections.
- [x] Add `server/application.mjs` exporting `startLocalApplication(options)` with `origin` and `close()` results. Own loopback binding, gateway construction, timeouts, startup cleanup and shutdown there.
- [x] Migrate `server/start.mjs` and `startAccountGateway` to that module. Keep credentials, production refusal and process signals in the launcher.
- [x] Verify the actual launcher starts, serves requests and exits on a termination signal; preserve rejection tests.

## Completion

- [x] Update `docs/ARCHITECTURE.md` with final module ownership.
- [x] Run `npm test` and `git diff --check`.
- [x] Request an independent review of this focused change and address findings.

Execution stays in the existing working tree so the earlier uncommitted work remains available. Changes remain uncommitted for review.

## Verification evidence

- Before the fixture change, the new regression checks reproduced an aborted transaction after a rejected grant and interference between concurrent grant settings. They pass with separate connections and owned rollback.
- Targeted startup checks cover real HTTP requests, occupied ports, incomplete requests, repeated close, process signals and environment restrictions.
- `npm test`: 397 passed, 0 failed, including desktop/mobile Chromium lesson journeys and baseline JavaScript failure paths.
- `git diff --check`: clean.
- Independent focused review: no actionable findings; application/provider checks also passed in the review.
