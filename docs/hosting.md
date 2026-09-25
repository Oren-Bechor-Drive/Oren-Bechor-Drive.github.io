# Hosted gateway preparation

The Cloudflare Worker, durable Supabase sessions, shared rate limits and private Storage delivery are implemented for local verification. Nothing in this guide has been deployed. Provider accounts, domain, live authentication/email, approved course material and hosted checks remain outstanding. Follow the owner's [recorded decisions](recommendation.md); the three-day pilot never opens registration automatically.

## Local commands

The checked-in site still runs without a frontend build. `npm run dev` keeps its loopback-only, in-memory account gateway. Its sessions end on restart. Production uses the separate Worker entry and never enables that local launcher in production mode.

```sh
npm ci
npm run package:worker
npm run test:hosting
npm run dev:worker
```

`package:worker` copies allowed public files into ignored `.worker/public`. A custom output must be outside the source tree or exactly its `.worker/public` directory; it cannot replace source, docs, tests or Git metadata. It excludes server source, docs, tests, configuration, credentials, hidden files and unsupported extensions, rejects symlinks and oversized assets, and preserves supplied media bytes. `dev:worker` is local. There is no deployment script. Checked-in `wrangler.jsonc` disables `workers.dev` and preview URLs and declares no public routes.

Images, CSS and JavaScript in the configured static exclusions bypass the Worker and receive generated security/cache headers. HTML, directory routes, account pages and API requests invoke the Worker and consume its dynamic request allowance. This preserves existing checked-in URLs.

The local Worker serves the public site even without credentials; its account API returns unavailable. Runtime tests use synthetic identities. They do not authenticate against hosted Supabase or send emails.

## Configuration

Copy [.env.hosted.example](../.env.hosted.example) to ignored `.env.hosted.local`, fill the selected environment's values, then run `npm run check:hosting`. This validates structure locally and makes no network requests. It does not verify a provider plan or prove that authentication works.

| Setting | Purpose |
| --- | --- |
| `APP_ORIGIN` | Exact HTTPS course origin, without trailing slash or path. Mismatched API origins are rejected. |
| `SUPABASE_URL` | Exact HTTPS production project origin. Keep the development project separate. |
| `SUPABASE_PUBLISHABLE_KEY` | Auth project key, used only by the server adapter. |
| `SUPABASE_SECRET_KEY` | Server-only secret/service key for provisioning, gateway state and private Storage. |
| `SESSION_SECRET` | Stable, cryptographically random 32-byte secret encoded as standard base64. Generate separately from provider keys. |
| `REGISTRATION_MODE` | `closed` by default, `pilot`, or manually selected `public`. |
| `PILOT_EMAILS` | Private comma-separated list of one or two distinct verified tester emails. Required only in pilot mode. |
| `GOOGLE_AUTH_ENABLED` | Literal `true` only after Google configuration. Public mode requires it. Email/password remains enabled through Supabase Auth. |
| `PRIVATE_MEDIA_BUCKET`, `PRIVATE_MEDIA_ENTRIES` | Optional paired settings for a private bucket and JSON registry. Omit both until media exists. |

Put credentials, `SESSION_SECRET`, tester emails and the media registry in Cloudflare secret bindings. Keep them out of `wrangler.jsonc`, public assets, logs and Git. The local `.env.hosted.local` file belongs only to `check:hosting`; Wrangler uses its own ignored `.dev.vars` for local bindings. Never copy production secrets into test fixtures.

For a configured local Worker preview, use development-only provider bindings in `.dev.vars` and set `APP_ORIGIN=https://127.0.0.1:8787`. Start HTTPS with:

```sh
npm run dev:worker -- --local-protocol=https
```

Open `https://127.0.0.1:8787` and trust Wrangler's local development certificate in your browser. The scheme, host and port must match `APP_ORIGIN`; another origin returns 421 for account requests. Add that development callback origin to the development Auth configuration when testing real authentication. The ordinary HTTP command is sufficient for the public-site preview with no account configuration. This HTTPS recipe was verified locally with synthetic identities; live provider setup still requires its own checks.

Changing `SESSION_SECRET` invalidates existing gateway cookies. Expired records are removed by traffic and the scheduled cleanup. A forgotten secret cannot be recovered from encrypted database rows. Coordinate secret changes across deployments; mixed secrets make sessions appear signed out on some instances.

## Sessions and request limits

The browser receives an opaque HttpOnly, Secure, SameSite=Lax cookie and a CSRF value. Database rows contain keyed hashes and AES-GCM encrypted session payloads. Separate derived keys protect lookup and encryption. Provider credentials, email and PKCE verifier stay encrypted at rest. Anonymous sessions last one hour, authenticated sessions twelve hours, and recovery sessions ten minutes.

A database lease serializes operations on a session across Worker instances. It lasts thirty seconds; the application stops returning results after twenty-five seconds. An expired held lease destroys the session because an external refresh or callback may already have consumed its token. The browser must sign in again after such an interrupted operation. Ordinary completed requests survive process restarts.

Rotation and revocation commit through service-only RPCs. Password reset invalidates the user's other sessions and authentication already in flight. If the provider's password-update result is uncertain, a durable reset barrier blocks new authentication publication until an operator reconciles it. It never expires into an automatic authorization decision. See the recovery procedure below.

The default store holds at most 1000 sessions, with at most 800 anonymous sessions. Capacity exhaustion returns unavailable rather than switching to an unbounded or process-local store. Rate windows permit 150 API requests per minute and 20 account mutations per fifteen minutes per client address. PostgreSQL shares counters across instances and caps their storage at 4000 buckets. Counters store HMAC values, never raw IP addresses. Exhaustion denies requests; storage errors fail closed.

Cloudflare supplies `CF-Connecting-IP`; generic forwarded headers cannot select a different identity. Do not place this adapter behind a proxy that lets callers choose that header. Provider Auth/email limits remain additional limits. Application limits do not implement provider billing caps; selected accounts must remain on their Free plans.

## Database and cleanup deployment

The repository's migrations must be applied to the chosen target before enabling hosted accounts. Do not apply `supabase/tests/database/auth-bootstrap.sql` or the synthetic development grants to production. New gateway tables are private, have RLS enabled, and expose no direct browser or service-role table privileges. Only their restricted service RPCs can mutate them.

After enabling Supabase Cron, install both reviewed schedules as the database owner:

- [Learning retention](../supabase/operations/schedule-learning-cleanup.sql).
- [Expired gateway sessions and rate counters](../supabase/operations/schedule-gateway-cleanup.sql).

Verify the named jobs and successful runs in `cron.job` and `cron.job_run_details`. Check expiration and retained topic completions against the target database. Local PostgreSQL tests do not establish that either job runs in a hosted project. A paused or quota-restricted database can interrupt the jobs and the service.

### Recovering an uncertain password reset

Only a database owner/operator should perform this procedure. Close registration and stop or drain old gateway workers before reconciling a reset, so an in-flight provider update cannot complete after the barrier is released. Inspect the single row in `private.gateway_session_control` for a non-null `reset_key`. Investigate the Auth operation and revoke the affected user's provider sessions before releasing the barrier. If the password outcome is unknown, require another recovery flow afterward. Do not clear it solely because time passed.

After resolving the provider operation, use the exact current barrier identifiers in one database-owner transaction:

```sql
begin;
select public.gateway_session(
    'resolve_reset', reset_key, reset_lease,
    jsonb_build_object('user_key', reset_user_key)
)
from private.gateway_session_control
where singleton and reset_key is not null;
commit;
```

The operation matches the stored barrier, removes the affected user's gateway sessions and advances the authentication generation. A stale identifier cannot clear a different reset. Confirm the barrier is empty and run a new recovery/sign-in check before restoring admission. Never publish the control-row values.

## Private media

Create a private bucket only after selecting the hosted project and confirming its Free plan. Do not grant public reads. The application serves media through `/api/media/<opaque-id>` after current learner, paid entitlement and exact content-version checks on every request. Registration alone grants no paid media access. Browser responses contain neither Storage URLs nor reusable signed links.

The hosted adapter supports full delivery, HEAD and single byte ranges, validates upstream MIME type and range metadata, and streams without buffering a video in memory. Disconnects and fifteen seconds without upstream progress abort the download. Invalid upstream responses fail closed. This adapter currently accepts the standard `https://<project>.supabase.co` host, not custom Storage domains.

The registry has the same `id`, `sectionId`, `contentVersionId`, `type`, `title` and `file` fields as the [local media manifest](protected-learning.md). `file` is now a private object path. Use opaque ASCII object names with letters, digits, `_`, `-` and `.`, separated by `/`; no dot-leading, empty or escaped path segments. Titles remain Hebrew. Accepted types are MP4/WebM and PNG/JPEG/WebP. The registry is server configuration, not learner-supplied data or a public file.

No videos or registry entries have been uploaded. Captions, transcripts, approved media, browser playback and actual storage/egress capacity remain release work. The current adapter does not add adaptive streaming or remove the selected plan's per-file limit.

## Private pilot and public opening

1. Verify Cloudflare, Supabase and email providers are on the agreed Free plans, without billable add-ons or automatic upgrades. Select the temporary course origin; a domain purchase remains a separate owner decision.
2. Configure Supabase email/password with confirmation required, Google OAuth and the exact callback origin. Install the Hebrew account templates through custom SMTP. New Free projects using Supabase's default sender cannot customize those templates; custom SMTP restores that ability. [Supabase change notice](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).
3. Configure the gateway with `REGISTRATION_MODE=pilot` and the owner/Oren tester addresses as a secret. Oren's email is still missing. Admission checks verified identity before provisioning and again on session use. Non-testers receive no ordinary or recovery gateway session; registration/recovery email requests for outsiders are suppressed. This gate does not disable the provider's own public Auth signup endpoint. A separate production project avoids importing previously provisioned development learners.
4. Deploy only after the owner's deployment instruction. Run the two-person test for three days, recording its actual start and findings. Use synthetic content until supplied material has exact-revision approval. Do not send it as approved driving instruction.
5. Check password signup/confirmation/login, Google login, recovery, logout, expiry, restart, cross-instance concurrency, suspended access and private media seeking on desktop and mobile. Confirm denied users never receive restricted bodies. Check both successful and failed SMTP delivery and quota behavior.
6. Before public opening, obtain approved free material and policy review, complete both login methods, and receive the owner's explicit go-ahead. Only then change `REGISTRATION_MODE` to `public`. No date or timer performs this change. Public registration does not create an entitlement, trial or payment.

For rollback, select `closed` and keep secrets stable. Session use will reject identities under the closed gate. Already delivered bytes cannot be recalled; provider account deletion and content unpublication are separate actions. Preserve the schema while investigating rather than dropping learner data.

Backups are still unresolved: no backup destination has been supplied. Durable sessions and passing tests do not establish recoverability of learner data. Live provider setup, hosted verification, approved content and the owner's opening decision remain outside this local implementation.
