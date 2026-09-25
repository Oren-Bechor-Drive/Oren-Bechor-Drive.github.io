# Local account gateway and Hebrew screens

Status: Implemented and locally verified on 2026-09-23. The owner chose local development and deferred hosting. Live email and Google setup remain external configuration.

The 2026-09-25 follow-up adds [synthetic test lessons and saved reading positions](../test-lessons.md). Lesson reads return safe lesson data, saved position and CSRF under one serialized session operation. Position reads remain available after paid expiry; saves require current access. The [reader implementation plan](2026-09-25-test-lesson-architecture.md) records request ownership and delayed-response checks. Use the [manual walkthrough](../manual-test-lessons.md) for local lifecycle verification.

## Scope and design

Add one Node.js HTTP service alongside the unchanged no-build static site. It serves an explicit public-file allowlist, `/api/account/*` and `/api/lessons/*` from one origin. GitHub Pages continues to serve public files; it cannot run the gateway. Account submission fails closed with a readable Hebrew status when the API is absent. Fields remain editable during initialization and service failures; entering text does not require an active service.

The account pages reuse `css/base.css` tokens, Varela Round, blue buttons, white rounded cards, and pale blue backgrounds. All copy is Hebrew, reading order is RTL, and email/password fields use LTR input. Login, registration, confirmation guidance, recovery, password reset, and a small account page have independent URLs and baseline navigation. The standalone screens have no top bar or account kicker. The card fits within the viewport, with inner overflow for short or enlarged layouts. The Google and password visibility icons are local Font Awesome SVGs. Input focus outlines appear for keyboard navigation. No new illustration, price, subscription purchase, or fabricated progress is needed.

## Session boundary

Use an opaque random HttpOnly, SameSite=Lax, host-only cookie. HTTPS uses Secure and a __Host- prefix; only loopback development may use HTTP. Store keyed hashes of cookie tokens in bounded process memory. Access tokens, refresh tokens, and PKCE verifiers stay on the server. Sessions expire after 12 hours; unauthenticated contexts after 1 hour; recovery sessions after 10 minutes. Restarting the process signs everyone out. Production startup is refused until persistent session storage and hosting are designed.

All POST routes require exact Origin, JSON, bounded bodies, and a constant-time comparison of a session-bound CSRF header. Responses are private/no-store. Requests are rate limited using the socket address, without trusting forwarding headers. Public serving excludes source, tests, environment files, migrations, hidden paths, and symlink escapes.

The Supabase adapter uses documented Auth REST endpoints and learner-scoped REST reads. Validate the current user with Auth, then require a learner row visible through RLS. Only verified authentication can call the service-key provisioning RPC. Administrative credentials are used only for provisioning. Each session serializes refresh and mutation work; logout removes local access even if provider revocation fails. No authorization uses user metadata.

## Account flows

- Password login validates credentials, provisions the learner idempotently, checks RLS, and rotates the local cookie. Failures do not disclose whether an email exists.
- Registration starts Supabase PKCE signup and shows generic email-confirmation guidance. Immediate sessions are rejected because verified email is required. The server retains no password.
- Recovery starts a separate PKCE flow and returns the same message for existing and absent accounts. Callback issues only a short recovery session. Password update invalidates local sessions for that user and requests global provider sign-out.
- Google starts with a CSRF-protected POST, server-held PKCE verifier and random state. Callback must match both the browser cookie and state, consumes the flow once, then exchanges the code. Registration uses the same callback. Destinations are fixed local URLs.
- Email links must open in the browser where the flow began. Missing/expired flow gets a Hebrew retry path. Google remains unavailable until explicitly enabled after provider setup.
- The account page shows verified email and offers sign-out, a link to the public course preview and a link to the synthetic test reader. It does not promise protected lessons or saved progress from the static files.

## Alternatives considered

Browser Supabase tokens would simplify static hosting but violate the agreed server-owned session boundary. Encrypted token cookies would remove process storage but complicate refresh races and local revocation. The opaque server session fits this local slice; persistent storage is a hosting prerequisite.

## Verification

Exercise real local HTTP and browser requests against a deterministic Auth/REST fixture. Cover cookie rotation, no browser tokens, CSRF/origin failures, session and flow expiry, concurrent refresh, revocation, account isolation, generic errors, callback replay and substitution, recovery-only authority, bounds, and public-file isolation. Separately verify the real Supabase adapter's HTTP contracts. Run existing database tests, the full repository suite, media/link audits, and desktop/mobile/no-JavaScript browser checks. Live Google and email delivery require owner-supplied provider configuration and are not claimed from fixtures.

## Provider references

- [Supabase Auth REST contract](https://github.com/supabase/auth/blob/master/openapi.yaml)
- [Supabase server authentication](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Google configuration](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Free email template changes](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)
