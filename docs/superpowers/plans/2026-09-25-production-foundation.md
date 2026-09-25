# Production foundation implementation plan

**Goal:** Prepare a locally verified hosted gateway without deploying or opening registration.

**Architecture:** Keep the checked-in static site and Node development gateway. Add Cloudflare hosting, private Supabase session storage and a streaming Storage adapter. Server configuration controls admission; PostgreSQL coordinates sessions and request limits across instances.

**Stack:** Plain JavaScript, Node compatibility in Workers, Supabase REST and PostgreSQL.

**Scope authority:** Owner decisions in [recommendation.md](../../recommendation.md) and the user's instruction to develop what can be done now. Account creation, domain purchase, hosted deployment, content approval and public opening remain external steps.

## Constraints

- Keep provider tokens and private media paths out of browser responses and public assets.
- Preserve local account behavior and all learner access checks. Registration grants no paid access.
- Default hosted admission to closed. Pilot admission uses a private tester list. Public opening requires an explicit configuration change after owner approval, with both login methods configured.
- No timers open registration. No paid infrastructure, billing, deployment or messages.
- Preserve existing public HTML and its no-JavaScript behavior.

## Tasks and verification

- [x] Persistent sessions: extract local storage, inject durable encrypted storage, serialize cross-instance lifecycle operations with database leases, invalidate uncertain leases, and preserve reset revocation across pending authentication. Test restart, concurrent refresh, callback consumption, logout, reset, expiry, capacity, encryption and database privileges.
- [x] Hosting: package only allowed public files, bridge Worker requests into the existing gateway, preserve streaming, fixed-origin cookies and private caching. Test the actual local Workers runtime and excluded paths. Keep preview/deploy disabled in checked-in configuration.
- [x] Private media: add server-credential Supabase Storage delivery after existing authorization. Test full/range/HEAD delivery, invalid upstream headers, denial before storage access, redirects and cancellation.
- [x] Admission and rate limits: implement closed/pilot/public modes and verified-email admission. Add atomic, bounded database request counters keyed by HMAC, never raw IP addresses. Test simultaneous callers and service-role-only privileges.
- [x] Composition and operations: validate server environment, wire adapters, document migration/Cron/auth/email/pilot setup, and add safe local configuration checks. Update recommendations to distinguish implemented code from unverified hosted setup.
- [x] Review and verify: run gateway/database tests, actual Worker tests, npm test, link/media checks and git diff --check. Review the complete change for concurrency, authorization and packaging errors.

Independent implementation tasks own separate files. The session task owns learner-accounts.mjs and its gateway injection changes. The hosting task owns http.mjs allowlist extraction, Worker/packaging code and development dependencies. Parent integrates only after those interfaces are available. No UI redesign or content publication is included.

## Verification result

All 544 tests passed, including real PostgreSQL, browser journeys and seven local Workers-runtime checks. Link and media audits, dependency audit and git diff --check passed. Desktop/mobile Worker pages were inspected with local Playwright after the collaborative preview failed during resize. Hosted setup remains pending as described in docs/hosting.md.
