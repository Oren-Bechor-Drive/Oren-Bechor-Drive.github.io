# Security audit: 2026-09-25

## Scope and result

Reviewed the current repository, including committed application code and all uncommitted hosting, session and media changes. The Git baseline is `b1bf35c01701fe428ac566e334b7b7eabc776623`; this was a repository-wide audit, not only a review of its diff. Checks used owned local HTTP servers, disposable PostgreSQL, Chromium and the local Worker runtime. No production systems were attacked or modified, and no source was uploaded to an external scanner.

No confirmed SQL injection, authentication bypass, cross-learner access, browser code injection or credential disclosure was found in the inspected paths. No production-code change was justified by the findings. Five permanent regression tests were added for injection-shaped HTTP requests, fixed RPC routing, direct database text handling and safe browser rendering.

This result applies to the inspected source and local tests. It does not certify deployed provider settings or guarantee the absence of vulnerabilities.

## Coverage

| Area | Inspected controls and evidence |
| --- | --- |
| HTTP API | Account, section, reading-position, quiz, attempt, completion and media routes. Fixed operation selection, typed identifiers, rejected unknown body fields, 16 KiB body limit, exact-origin and session-CSRF checks for mutations, safe error mapping and private caching. |
| Authentication and sessions | Password and Google flows, browser-bound PKCE/state, one-use callback consumption, verified current provider identity, suspension/admission, token refresh, rotation, recovery-only sessions, logout and password-reset races. Cookies are HttpOnly and SameSite=Lax, with Secure and the `__Host-` prefix for HTTPS. |
| Durable sessions | AES-GCM encrypted payloads bound to opaque storage keys, separate derived lookup/encryption keys, service-only storage, cross-instance leases, expiry, generation fencing and uncertain-reset barriers. Existing real-database tests exercise lost replies and stale operations. |
| Authorization and database | All four migrations, table/column grants, RLS, current Auth session/identity checks, paid-access periods, exact content revisions, learner-owned progress/attempts, grading and private answer keys. Public wrappers use SECURITY INVOKER; privileged private functions use fixed search paths and explicit grants. |
| SQL injection | Production REST adapter, all request-reachable database functions, migration-time dynamic SQL, development SQL and test-query construction. Permanent tests cover both gateway input rejection and direct learner RPCs. |
| Private media | Immutable server catalog, opaque URLs, authorization before source access, local path/symlink checks, Storage origin/path constraints, redirect rejection, response metadata validation, byte ranges, HEAD, cancellation, length checks and inactivity limits. |
| Static hosting and files | Local allowlist, Worker routing, trusted ingress address handling, HTTPS origin checks, package exclusions and output-path guards. Tests prove server/config/test files are not public assets. |
| Browser | Account and protected-learning rendering, same-origin requests, CSP, redirects, storage use and private-page suspension. Content uses text nodes. A Chromium regression proves HTML-looking catalog titles and lesson bodies create no injected elements or requests. SVG source checks found no active-script patterns. |
| Secrets and dependencies | High-confidence credential-pattern scan of 263 current text files and 1,276 reachable historical text blobs, each at most 2 MB. No matches. Values were never printed. `npm audit` reported zero known vulnerabilities. |
| CI and operations | Read-only workflow permissions, checkout credentials disabled, no production secrets or deployment step in the test workflow, local-only launcher, separate hosted composition, ignored credential files and documented cleanup/reset procedures. |

## SQL injection conclusion

Production code sends values to fixed PostgREST RPC URLs using JSON serialization. It does not build SQL statements from HTTP parameters. Learner identifiers, access levels, quiz answers and revisions become function arguments; the database functions use static SQL and typed parameters. UUID/numeric validation adds rejection at the HTTP entry point but is not the sole protection.

The dynamic `EXECUTE format(...)` in the protected-learning migration revokes privileges using database-catalog `regprocedure` identities during migration. The test-only RLS event trigger also uses catalog-generated object identities. Neither accepts HTTP-controlled SQL. Test helpers interpolate fixed internal function names or allowlisted test roles and bind learner values separately.

Added regression coverage:

- [HTTP injection cases](../tests/gateway/security.test.mjs): SQL-looking paths, answer values and revisions, operator objects, prototype keys and arbitrary operation requests cannot mutate a quiz or grant paid access. A legitimate save and free read still succeed.
- [REST transport](../tests/gateway/provider.test.mjs): SQL-looking values remain JSON arguments to fixed learner RPC endpoints and retain learner credentials.
- [Direct database calls](../tests/database/protected-learning.test.mjs): injected topic keys and answer strings cannot change a draft; valid answers still save.
- [Database text and access](../tests/database/foundation.test.mjs): SQL-looking display names remain literal, injected access-level text returns no content, and a free learner still cannot read paid material.
- [Browser rendering](../tests/browser/security-browser.test.mjs): markup in titles and lesson bodies is displayed as text.

Separating query structure from values and retaining least-privilege grants follows the [OWASP SQL injection prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html). Supabase requires grants and RLS to work together; functions need their own explicit execution privileges. See [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api).

## Verification results

- `npm test`: 554 passed, 0 failed. Includes real PostgreSQL authorization/concurrency tests, Chromium journeys and local Worker streaming checks.
- Focused SQL/API regression run: 54 passed; focused browser security run: 2 passed.
- `npm run check:links`: 515 local references across 35 pages passed.
- `npm audit`: 0 reported vulnerabilities.
- `git diff --check`, `git diff --cached --check`, and whitespace checks on 34 untracked text files: passed.

The SQL/API regression tests passed against the existing implementation. They preserve verified controls rather than demonstrate a newly fixed exploit. No runtime security fix was needed within the inspected scope.

## Remaining deployment checks and limits

1. Verify the actual hosted schema, effective grants, exposed schemas, RLS policies and private Storage bucket policies. Local tests do not detect hosted configuration drift. Never apply the test Auth bootstrap or development grants to production.
2. Verify real Auth JWT validation, email confirmation, redirect allowlists, Google configuration, password recovery and revocation with non-team accounts. The local Auth fixture does not implement provider token-signature verification.
3. Gateway pilot/closed admission does not control direct Supabase Auth or Data API traffic. A previously provisioned learner with a valid provider token remains governed by database authorization on that path. If the operational requirement is to block all direct provider access during closure, that needs an additional provider/database control before deployment. Gateway rate limits also do not apply to direct provider traffic.
4. Rate limits and bounded stores fail closed, but distributed traffic or anonymous-session creation can exhaust capacity and deny new sign-ins. Free-plan quotas can also interrupt service. Verify provider abuse controls, alerts and hard quota behavior before opening registration; no denial-of-service load test was performed.
5. Verify secret custody, backup destination and restoration, scheduled cleanup, HTTPS, trusted Cloudflare ingress and the uncertain-reset recovery procedure. These remain operational work in the [hosting guide](hosting.md).

The credential scan covered recognizable token/private-key formats in UTF-8 text, not all passwords, binary documents, ignored local files, remote-only history or provider dashboards. Gitleaks and Semgrep were not installed; the audit used source review, local pattern scans, dependency audit and executable security tests. No live penetration test, external cloud review or independent security certification was performed.
