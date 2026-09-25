# Operations runbook

This runbook covers content review, publication, support intake, and recovery for the current static site. GitHub Pages serves the root of `main` at `https://oren-bechor-drive.github.io/`. The published static site has no running account backend. The repository includes a local account gateway and a Supabase development database foundation; neither supplies a production account service. Payments, a staff console, a public support channel and application monitoring remain unimplemented.

Use these project sources when a change touches their scope:

- [Product](../PRODUCT.md) defines the released product and the evidence on hand.
- [Driving Learning](../CONTEXT.md) defines course terms.
- [Course architecture](ARCHITECTURE.md) defines learning and media verification ownership.
- [Course topic coverage](reference/course-topic-coverage.md) maps the supplied PDF to adapted lessons.
- [Official source review](reference/official-source-review-2026-09-22.md) records the latest bounded review and its limits.
- [README](../README.md) contains maintenance commands and GitHub Pages settings.

## Check local account and test-lesson changes

Use [local account setup](local-accounts.md) for the configured development gateway and [test-lesson setup](test-lessons.md) for synthetic content and temporary development grants. Use the [manual browser/API walkthrough](manual-test-lessons.md) to check cancellation simulation, expiry, retained progress, renewal and learner isolation in an owned disposable database without hosted credentials. Close that fixture using `await app.close()` after testing.

Run `npm test`, `npm run check:media`, `npm run check:links` and `git diff --check` before publishing these changes. Record local fixture results separately from [hosted verification](../supabase/tests/README.md). Pushing files to GitHub Pages does not deploy the gateway, apply migrations, grant access, or configure Auth providers. Keep real restricted course content out of public delivery.

## Keep evidence, approval, and technical checks separate

A source review checks evidence and wording limits. Instructor approval accepts the teaching adaptation. Automated checks test repository behavior. One result does not replace another.

For each teaching change, record this small approval block in the pull request or a dated review note:

```text
Topic or section:
Revision: <commit SHA or pull request head SHA>
Source review: <review note or source links, reviewer, and date>
Instructor decision: approved | changes requested
Instructor reviewer:
Instructor review date:
Approved scope and required corrections:
```

Oren's approval remains required before adapted teaching copy, real quiz content, answer explanations, or teaching media becomes final. If the approved files change, obtain approval for the new revision. A passing test run does not mean that teaching content is approved.

For each new or replaced source or media asset, record:

- the topic and teaching purpose;
- the source URL or supplied-file path, the source owner, and the date received or reviewed;
- the rights basis, any use limits, and permission for identifiable people or vehicles;
- the unchanged original path and every generated derivative path;
- the attribution or license files that must remain with the asset;
- any uncertainty that the reviewer could not resolve.

Do not add an asset when its source or permission is unclear. Preserve supplied original bytes. The current repository license excludes course content, photos, artwork, and branding. Font and Font Awesome sources and license files remain under `assets/fonts/` and `assets/icons/`.

## Review and publish a change

The repository does not deploy pull request branches. Preview the exact pull request revision locally, or use an explicitly approved temporary static preview if one is later configured.

1. Create a focused branch and draft pull request. List the changed topics, pages, assets, and source records.
2. Follow the [local-check setup](../README.md#local-checks). Install the locked dependencies and Playwright browser engines before generation or tests:

   ```bash
   npm ci
   npx playwright install --with-deps chromium firefox webkit
   ```

   A checkout with current installed browsers can skip the Playwright installation. Repeat it when Playwright or the required browser versions change.
3. For an image or gallery change, follow the [image maintenance procedure](../README.md#optimize-delivery-images). Run `npm run optimize:media` before the remaining steps. Commit the originals, generated files, `js/road-photo-sources.js`, image declarations, and any deletions together.
4. After image optimization, run `npm run minify:html` when `index.html` changed. Preserve the formatting of course, lesson, and quiz HTML.
5. Update the pull request so its head contains the complete generated and formatted change. Serve that exact revision with `python3 -m http.server 8000`. Review the affected path on desktop and phone sizes. For navigation or topic changes, also block JavaScript and confirm that the baseline content and links work. Add the exact revision to the instructor approval record.
6. Run the release checks from the repository root:

   ```bash
   npm audit
   npm run check:links
   npm run check:media
   npm test
   git diff --check
   ```

   `npm run check:links` checks local files and fragments. It does not validate external destinations. The command is backed by `scripts/site-links.mjs`.
7. Resolve all failed checks. Record the commands and results in the pull request. Record content approval separately from these results. If a correction changes approved teaching content, obtain approval for the new revision.
8. Merge only the reviewed revision after required approval and CI pass. GitHub Pages then publishes the root of `main`; the Tests workflow verifies the repository but does not deploy it.
9. Confirm that the Pages deployment completed for the merged commit. Record the pull request, merge commit, approval record, check results, and live-check result as the release record.

### Check the live site

Check the deployed commit in a fresh browser session. Use a query string when necessary to distinguish an old cached response.

- Open the welcome page, `/course/`, every changed lesson, and every changed quiz.
- Confirm that navigation, the affected Hebrew and right-to-left content, images, fonts, and local icons load over HTTPS.
- On desktop and phone sizes, use the changed controls with a keyboard and confirm visible focus.
- For navigation or topic changes, confirm the usable baseline with JavaScript disabled or the entry module blocked.
- Confirm that changed fragments and return links reach the intended section.
- Confirm that unavailable enrollment, profile, and social controls still describe their real state.
- Inspect the browser console and network panel for errors, missing files, mixed content, or unexpected external requests.
- When public metadata changed, inspect the page title, canonical URL, sharing fields, `robots.txt`, `sitemap.xml`, and `llms.txt` against the visible facts.

## Roll back a bad publication

Use a new revert commit and pull request. Do not reset `main`, force-push it, or rewrite published history.

1. Record the bad release commit, affected URLs, first observed time, and visitor impact.
2. Identify the last known good commit with `git log`. Revert the faulty commit with `git revert <commit>`. For a merge commit, review the parent choice before using `git revert -m 1 <merge-commit>`.
3. If the release changed images, revert the full image set together: originals, generated delivery files, `js/road-photo-sources.js`, and HTML declarations.
4. Run `npm run check:links`, `npm run check:media`, `npm test`, and `git diff --check` on the revert. Repeat any content-specific review needed to confirm the restored text.
5. Merge the revert pull request. Confirm that GitHub Pages publishes the revert commit, then repeat the live smoke checklist.
6. Link the release, incident record, and revert. Record the cause and the follow-up that prevents the same failure.

For an urgent safety error in teaching content, remove or revert the affected unapproved change first. Instructor review is still required for replacement teaching copy.

## Receive teaching, media, and link reports

The current site does not publish a support address or reporting form. Do not present a repository issue tracker, personal address, or social account as a visitor support route unless the owner supplies and approves that destination.

When a report reaches a maintainer through an existing authorized channel, record it in the team's approved work tracker. A repository issue is suitable only when the report contains no personal or sensitive information. Record:

- report type: teaching, quiz, media, internal link, external link, accessibility, or site availability;
- page URL, topic, learning section, and question identifier when applicable;
- expected and observed behavior;
- observation time, browser or device details, and reproducible evidence;
- possible safety impact, affected scope, and the reporter's permission before retaining personal details;
- the revision that introduced the problem, if known, and the resolution revision.

Triage a driving-rule error, unsafe instruction, or misleading answer as a content-safety issue. Compare the wording with the supplied source and current authoritative material, then send the correction to Oren for teaching approval. A source or rights complaint requires the affected asset and its provenance record to be reviewed before further use. Technical link or media fixes still require the release checks above. Notify affected people only through an approved channel and only after an owner decides that notification is warranted.

## Triage a technical outage

Assign responsibilities before an incident. The person with repository write access manages code and reverts. A repository administrator checks Pages configuration and deployments. The content approver decides teaching corrections. A future provider owner handles that provider. These are responsibilities, not assigned staff names or response-time promises.

1. Record the start time, affected URLs, scope, browser evidence, and the latest published commit.
2. Determine whether the failure reproduces locally at the same commit. If it does, follow the rollback procedure or prepare a tested fix.
3. If `main` works locally, inspect the Pages deployment for the commit. Confirm that Pages still publishes from the root of `main` and that the organization site URL has not changed.
4. Check GitHub's public service status when deployments or Pages responses fail. Escalate repository-setting problems to a repository administrator and platform failures through GitHub's documented support route.
5. Check live response status without assuming that one response proves full recovery:

   ```bash
   curl -I https://oren-bechor-drive.github.io/
   curl -I https://oren-bechor-drive.github.io/course/
   ```

6. After recovery, run the live smoke checklist and record the recovery commit or provider event. Keep unresolved content and rights questions open after technical service returns.

GitHub Pages controls response headers and caching for the current host. Do not add inactive `_headers`, `.htaccess`, committed compressed files, or unsupported meta tags as outage fixes.

## Proposed maintenance cadence

This cadence is a process proposal. It is not an existing monitoring schedule or response commitment.

| When | Check | Record |
| --- | --- | --- |
| Every pull request | Local links, media audit, tests, diff check, affected desktop and phone paths, and relevant baseline behavior without JavaScript | Pull request check results |
| Monthly | `npm audit`, `npm run check:links`, the live smoke checklist, and a normal-browser check of official external links | Dated maintenance note with failures and follow-up |
| Every three months | Keyboard navigation, visible focus, 200% zoom, reduced motion, right-to-left reading order, and a screen-reader pass through the welcome page, library, one lesson, and one quiz | Dated accessibility review with browser and assistive-technology versions |
| Every six months | The procedure in the dated [official source review](reference/official-source-review-2026-09-22.md), plus instructor review of time-sensitive teaching copy | A new or updated dated source note and separate instructor approval |
| Before a material content or media release | Source and rights records, permission limits, captions or transcripts, alternative text, and instructor approval for the exact revision | Pull request approval and provenance record |
| After a dependency or browser-engine update | Full `npm test`, `npm run check:media`, and a review of audit findings before accepting lockfile changes | Pull request check results |

Do not treat an automated `403` from a government page as proof that the visitor destination is unavailable. Open official links in a normal browser and record verification limits.

## Prepare for a future paid-service incident

The following checklist is a readiness gate for a future service. It does not describe current capabilities.

Before accepting payment or storing learner data:

- document each provider, production and test environment, source of truth, state transition, credential owner, and authorized escalation route;
- assign operational owners for identity, billing, entitlement, protected media, email, and data recovery;
- implement privacy-safe logs, health checks, alerts, and provider-status checks, then test that the assigned people receive them;
- define approved subscription, failed-payment, cancellation, refund, dispute, access, data-retention, and deletion policies with qualified review;
- implement idempotent webhook processing and a reconciliation tool that compares provider events with local subscription and entitlement state;
- set up backups and prove a restore in a non-production environment before relying on them;
- rehearse rollback, credential rotation, provider outage, missed or duplicate webhook, and inconsistent billing/access scenarios;
- document which actions each support role may take, which data each role may view, and which actions require billing, content, security, or legal escalation.

During a future billing or access incident, preserve provider event identifiers and local correlation identifiers without copying credentials or unnecessary learner data. Compare the provider's transaction state, verified webhook history, local subscription state, and enforced entitlement. Do not grant access from a checkout return URL or replay an event until signature, idempotency, and target account checks pass. Route refunds, retention decisions, legal notices, and learner communications through the approved policy and authorized owner.

Do not claim that monitoring, a staff console, backups, reconciliation, or an incident response team exists until each item is implemented and tested.
