# Session gateway implementation plan

> Execute inline using the executing-plans workflow. User authorization covers local implementation; hosting remains deferred.

**Goal:** Working local cookie sessions and Hebrew account screens matching the existing site.

**Architecture:** Native Node.js service with a Supabase REST adapter, bounded local session storage, and static HTML/CSS/JS account pages. Existing content authorization stays in PostgreSQL RLS.

**Spec:** [Session gateway design](../../plans/session-gateway-design.md).

## Constraints

- Plain JavaScript; no frontend build; Hebrew RTL; ASCII punctuation.
- Reuse current design tokens and preserve existing database work.
- Never return provider tokens to the browser or serve private project files.
- Local development only. No hosted deployment, Google credential changes, or real emails without configured providers.

## Task 1: Session service and provider boundary

- [x] Write `tests/gateway/session.test.mjs` with real HTTP tests for bootstrap, CSRF, login rotation, isolation, refresh serialization, expiry, revocation, callbacks, recovery, limits, and static-file denial. Run `node --test tests/gateway/*.test.mjs` and record the missing-module failure.
- [x] Implement `server/sessions.mjs`, `server/supabase.mjs`, `server/gateway.mjs`, `server/http.mjs`, and `server/start.mjs`. The gateway consumes a provider with password, signup, recovery, exchange, refresh, identity, provision, learner, password-update, and logout operations. It returns an HTTP request handler; the local server also owns static serving.
- [x] Test the adapter against HTTP fixtures using the actual documented paths, headers, PKCE values, errors and payloads. Verify all gateway cases pass.

## Task 2: Hebrew account screens

- [x] Add failing Playwright tests in `tests/browser/account-browser.test.mjs` for login/registration/recovery, keyboard labels, password visibility, mobile overflow, service failure, and baseline links.
- [x] Add checked-in `account/*.html`, `account/account.css`, and `account/account.js`. Share base styles in standalone account cards. Static submit buttons start disabled; only a successful session bootstrap enables mutations. Fields remain editable during startup and service failures. Keep feedback readable and announced.
- [x] Connect course profile controls through a capability check, preserving disabled fallback on static hosting and failure. Verify the baseline and enhanced course navigation.
- [x] Inspect screenshots at desktop/mobile widths and run affected browser tests.

## Task 3: Setup, review, and integration

- [x] Add `npm run dev`, `npm run test:gateway`, ignored local environment files, and a safe `.env.example`. Document provider callback, Google and SMTP setup, local limits, and exact startup commands.
- [x] Update README, DESIGN, PRODUCT, CONTEXT, and architecture scope to distinguish local account support from the publicly deployed static preview.
- [x] Obtain an independent security/code review required by executing-plans. Fix material findings with regression tests.
- [x] Run `npm test`, `npm run check:media`, `npm run check:links`, and `git diff --check`. Record outcomes and remaining provider configuration.

## Execution ledger

- Design follows the user's explicit build request and local-hosting choice. No additional design approval is needed.
- Work stays in the shared checkout so the completed uncommitted database foundation remains available. No commits or unrelated cleanup.

- Baseline: all 300 existing tests passed before implementation.
- Gateway tests first failed for absent implementation; browser tests first failed on absent pages. Added regression failures for callback guidance, profile navigation, manifest serving, concurrent reset/login/callback, and provider logout failure before their fixes.
- Final suite: `npm test` passed 322 tests with no skips or failures. Focused gateway suite passed 16 tests.
- `npm run check:media`: 163 references across 23 pages. `npm run check:links`: 370 references across 23 pages.
- Local Playwright Chromium verified desktop 1440px and mobile 390px/320px, login, registration, recovery/reset, sign-out, keyboard operation, no-JavaScript links, and API-failure fallbacks. Desktop/mobile screenshots inspected. Collaborative browser tooling was unavailable.
- Independent security review found a concurrent authentication/password-reset race and an inaccurate reset failure outcome. Both reproduced in tests and were fixed; targeted re-review found no remaining material issues.
- `npm run dev` starts successfully without secrets; the login page responds 200 and account bootstrap accurately reports unavailable authentication. No hosted mutations, real email, or Google configuration changes were made in this slice.
- Runtime Supabase credentials and live SMTP/Google setup remain external configuration steps, documented in `docs/local-accounts.md`. No claim of real-provider end-to-end verification.
- The shared checkout contains the implementation. Prior database work is preserved. No staging, commits, pushes, or deployment.

- Follow-up: corrected the unavailable-service state to keep email/password fields editable. Only submission depends on successful initialization; the fieldset is disabled during an actual submission. Regression tests cover desktop/mobile, no JavaScript, pending/failed initialization, blocked premature submission, and preserved input after retry.

- UI follow-up split across three agents: layout/markup, local icons/password controls, and browser verification. Removed all account headers and kickers, moved recovery before submit, and added the requested Font Awesome artwork. The owner clarified that input outlines should appear only for keyboard navigation. All normal desktop/phone documents fit the viewport; short layouts use card overflow to retain access. Independent screenshot inspection covered 1440x900, 390x844, and 320x568.
- UI follow-up verification: all 361 repository tests pass, including 38 focused account-layout checks. Media audit passes 151 image references across 23 pages; link audit passes 346 local references. Tracked and new-file whitespace checks pass. Visual verification used local Playwright Chromium because collaborative browser tooling was unavailable.

## Final code review, 2026-09-23

- Reviewed all uncommitted account, gateway, database, fixture, configuration, and documentation changes against the agreed local scope.
- Fixed completed password resets being reported as failures when another recovery session revoked local state. Failed callbacks now attempt to revoke exchanged provider sessions. The local launcher rejects origins its plain HTTP IPv4 listener cannot serve.
- Removed unused parameters, exports, a dependency declaration, markup, and confirmation-page JavaScript. Consolidated registration validation and form disabled-state handling. New recovery requests clear prior success feedback immediately.
- Improved database fixture cleanup and effective privilege checks, including inherited grants. No applied migration or hosted data was changed.
- Updated setup and architecture documents to reflect the implemented account gateway and the remaining protected-content work.
- Verification: all 369 tests passed, including 21 gateway tests, 23 database tests, and 48 account browser tests. Media audit passed 151 references across 23 pages; link audit passed 345 references. Dependency audit found zero known vulnerabilities. Tracked and new-file whitespace checks passed. Local Playwright covered desktop/mobile, keyboard, reduced motion, and baseline fallbacks; desktop/mobile registration and confirmation screenshots were inspected. Collaborative browser tooling was unavailable.
- Live SMTP/Google delivery, production hosting, durable sessions, payments, and protected browser lessons remain outside this review's local verification.

- Architecture follow-up: `server/learner-accounts.mjs` now owns all private session/lifecycle state; the original `server/sessions.mjs` was removed. See the [architecture refactor plan and verification](2026-09-23-architecture-deepening.md).
