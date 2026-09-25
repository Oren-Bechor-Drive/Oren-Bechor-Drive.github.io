# Run and configure local accounts

The Node gateway and Hebrew account pages run locally. The checked-in site still needs no build. GitHub Pages cannot run the gateway, so published course profile controls remain disabled there. Existing static lessons remain public.

## Preview the screens

```bash
npm ci
npm run dev
```

Open [local login](http://localhost:3000/account/login.html) or [registration](http://localhost:3000/account/register.html). Without provider keys, the layout is visible and the forms explain that sign-in is unavailable. There are no demo credentials in the application.

## Connect the development project

Copy `.env.example` to `.env.local`. Fill the keys in that local file, then restart `npm run dev`.

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | `http://localhost:3000`. The local launcher accepts exact HTTP origins on `localhost` or `127.0.0.1` only. Use the configured address in the browser; those hostnames are different origins. |
| `SUPABASE_URL` | `https://zurpazevlvtylnzvagoo.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | The development project's publishable API key. |
| `SUPABASE_SECRET_KEY` | A server-only secret API key, or legacy `service_role` key. Only learner provisioning uses it. |
| `GOOGLE_AUTH_ENABLED` | Leave `false` until Google is configured and tested; then use `true`. |

Find API keys in the Supabase project's API Keys settings. Put the secret directly into `.env.local`; it is ignored by Git and never sent to the browser. MCP authentication gives the coding tool access to the project. It does not give the running Node process an API key.

The existing database migration must be applied before sign-in. After verified authentication, the gateway calls `provision_learner` and reads the caller's learner through RLS. It never grants a subscription.

## Supabase Auth settings

In Authentication settings:

1. Enable email/password and **Confirm email**. Set the hosted minimum password length to 9 to match registration. Registration accepts 9-128 characters and requires an uppercase and lowercase English letter, a digit, and an ASCII special character such as `!`, `#`, or `%`. The screen and gateway enforce these four rules using `account/password-policy.js`. The registration bar counts completed requirements; it does not estimate password entropy. Login accepts existing passwords, and the reset screen retains its 12-128 character rule. The local `supabase/config.toml` minimum is 9; editing that file does not update the hosted project. See [Supabase password settings](https://supabase.com/docs/guides/auth/password-security).
2. Set the development Site URL to `http://localhost:3000`.
3. Add `http://localhost:3000/api/account/callback**` to the redirect allowlist. The callback has a random `state` query value, so an exact URL with no query is insufficient. Only use this localhost pattern for development. Select a precise HTTPS callback pattern when hosting is chosen.
4. Configure a custom SMTP sender for emails to real learners. Supabase's default email service is restricted and is not a public signup mail service. Verify sender authentication and delivery with the selected provider.
5. Use Hebrew confirmation and recovery email templates. Keep the link based on `{{ .ConfirmationURL }}` so Supabase verifies the email and returns a PKCE code. Do not replace it with an implicit token-fragment callback. New Free projects need custom SMTP to customize templates.

Open confirmation/recovery links in the same browser where the request began. The server retains the PKCE verifier for up to one hour and accepts each callback once. Closing/restarting the gateway invalidates pending links locally. Request a new link if that happens. Existing-account and absent-account requests receive generic messages.

### Google

Create a web OAuth client in Google Cloud, configure its consent screen and development test users, and set the authorized redirect URI to:

```text
https://zurpazevlvtylnzvagoo.supabase.co/auth/v1/callback
```

Enable the Google provider in Supabase and enter the Google client ID and secret there. The Google secret belongs in Supabase, not `.env.local` or browser JavaScript. Once this and the app callback allowlist are configured, set `GOOGLE_AUTH_ENABLED=true` and restart the gateway. Complete a real browser sign-in before marking the provider ready.

## Flows and current limits

- Login, registration, confirmation guidance, recovery, password reset, account details, and sign-out are at `/account/`. Confirmation guidance is a static page that works without JavaScript. Interactive forms require the gateway. The course profile becomes an account link when the gateway is available.
- Provider tokens stay in Node memory. The browser receives a random HttpOnly, host-only, SameSite=Lax cookie. HTTPS adds Secure and a `__Host-` name; loopback HTTP is for local development.
- Authenticated sessions last at most 12 hours. Recovery authority lasts 10 minutes. Restarting Node signs everyone out. Local session storage is bounded to 1,000 records.
- Sessions serialize refresh and changes. Password reset deletes local sessions for the user and invalidates authentication already in flight. This conservatively cancels an unrelated concurrent sign-in too; that learner may retry. If two recovery sessions complete password changes concurrently, local revocation does not turn an already-completed change into a false failure response.
- Password reset requests global Supabase sign-out. If that provider call fails after the password changed, the response reports the completed change and the UI explains that other devices could not all be signed out. Local sessions are already gone. Ordinary sign-out always ends this local session and attempts Supabase local sign-out.
- API responses never use shared caching. POST requests require the exact origin, JSON, a CSRF header, and a body of at most 16 KiB. Limits are 20 account mutations per 15 minutes and 150 API requests per minute per socket address. Lesson-position saves use the general API limit. Forwarded IP headers are not trusted.
- The local HTTP process binds to IPv4 loopback. HTTPS, external hosts, and IPv6 origins are rejected by this launcher because it serves plain HTTP on `127.0.0.1`. `NODE_ENV=production` is refused. Hosting needs durable session storage, distributed locking/rate limits if replicated, HTTPS/proxy configuration, and a reviewed deployment. Do not place this process behind a public proxy as a production launch.
- The account page links to [two synthetic test lessons](test-lessons.md). Their bodies load through learner-scoped database reads; temporary paid access requires a privileged development SQL operation. Google and real email delivery require external setup. The test reader saves reading percentages, resumes saved positions and requires explicit reload after a stale-save conflict. Payments, protected publication and progress for actual course material, and private media remain separate work.

For a credential-free manual exercise, use the [disposable test-lesson walkthrough](manual-test-lessons.md). It starts its own local gateway with deterministic synthetic Auth and real PostgreSQL, separate from `npm run dev` and the hosted development project. It covers cancellation simulation, expiry, retained progress, renewal and learner isolation.

## Verification

```bash
npm run test:gateway
node --test tests/browser/account*-browser.test.mjs
npm run check:media
npm run check:links
npm test
git diff --check
```

Gateway tests make real local HTTP requests against a deterministic provider fixture. Adapter tests check the Supabase HTTP methods, PKCE payloads, token scopes, and error handling. Browser tests exercise login, registration, recovery/reset, sign-out, keyboard entry, password visibility, account navigation, errors, desktop/mobile layouts, and no-JavaScript fallbacks. The account layout checks also cover the standalone card, local icons, keyboard-only input outlines, viewport bounds, and access to controls on short screens. No real email is sent by these tests. They do not prove SMTP delivery or live Google configuration.

The test-lesson gateway and desktop/mobile Chromium suites additionally exercise real PostgreSQL access checks, saved-position conflicts, renewal after a simulated 31-day lapse, learner isolation and delayed responses after reader invalidation. See [test seams and limits](test-lessons.md#verification-and-limits). These fixtures do not establish live gateway/PostgREST integration.

## Sources

- [Supabase Auth REST contract](https://github.com/supabase/auth/blob/master/openapi.yaml)
- [Server authentication and PKCE](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Redirect allowlists and wildcard matching](https://supabase.com/docs/guides/auth/redirect-urls)
- [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Free email-template change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)
