# Search publication and ownership

## Production scope

GitHub Pages publishes the root of `main` at `https://oren-bechor-drive.github.io/`. There is no custom domain. Pages uses its branch deployment workflow, `pages-build-deployment`, with HTTPS enforced. The checked-in frontend is plain HTML, CSS and JavaScript and needs no production build. Homepage text, topic descriptions, FAQ answers, metadata and JSON-LD are in the initial HTML.

The homepage is the only indexable page. Course previews, public practice, legacy quiz transition pages, account screens and the error page remain `noindex` and outside the sitemap. They are still crawlable so engines can read that directive. This is not access control. The protected backend, actual learner content and registration are not deployed by GitHub Pages.

The homepage's existing Hebrew title, description, canonical, Open Graph, X card and linked WebSite/WebPage/Course/Person data describe supplied facts. The sharing image is the unchanged instructor photograph at `https://oren-bechor-drive.github.io/assets/images/oren.jpg`. Do not add offers, reviews, addresses, social accounts or availability claims without supplied evidence. Preview and account pages have their own titles and descriptions; they deliberately do not advertise indexable canonical or sharing URLs.

## Maintain and deploy

1. Update the authored HTML. Keep preview and account `noindex` directives until their release prerequisites are met. An indexable page needs an absolute self-canonical matching its directory URL, a descriptive Hebrew title and description, and matching sharing metadata.
2. Run `npm run generate:sitemap`. It discovers authored pages through `scripts/site-pages.mjs`, excludes noindex, refresh redirects and `404.html`, and rejects missing or mismatched canonicals. It does not add fragments, queries, guessed modification dates or private URLs. `npm run check:search` detects sitemap drift without writing.
3. Run `npm run minify:html` after homepage changes, then `npm run check:links`, `npm run check:media`, `npm test`, `npm audit` and `git diff --check`.
4. Publish through the [operations review process](OPERATIONS.md#review-and-publish-a-change). Merge the tested revision to `main` and wait for Pages to finish successfully. The Tests workflow does not deploy the site.
5. Run `npm run check:search:production` from the deployed revision. It checks HTTPS redirection, exact homepage HTML, all authored pages' metadata and noindex state, verification tags, sharing-image responses, robots, sitemap and real 404 responses at root and nested missing paths. A failure can indicate a stale CDN response or newer deployment; compare the latest Pages build SHA before retrying.

`/index.html` is a duplicate served by Pages with a canonical pointing to `/`. Pages redirects `/course` to `/course/`. A direct request for `/404.html` returns 200 because it is an existing file, while nonexistent URLs return HTTP 404 with that file's noindex recovery content. Do not use JavaScript or meta refresh to simulate HTTP redirects or error status codes.

`scripts/search-discovery.mjs` owns the HTML metadata inventory used by sitemap generation and production verification. `scripts/search-production.mjs` owns HTTP verification and IndexNow notifications. These are maintenance tools, never browser modules. The local/Worker public-file allowlist includes only the specific additional `indexnow-key.txt`; it does not expose scripts or configuration.

## Google Search Console

The owner-supplied `google-site-verification` tag is in the homepage head. Keep it after verification so ownership can be rechecked. The value is public proof, not an account password. Do not replace it with an example value.

1. Sign in at [Google Search Console](https://search.google.com/search-console) with the account that supplied the tag.
2. Add or select the URL-prefix property `https://oren-bechor-drive.github.io/`. This host does not give the repository owner DNS control over `github.io`, so use the HTML-tag method instead of a DNS Domain property.
3. After the production check confirms the tag, choose Verify in the HTML-tag method. Record Google's actual result.
4. Open Sitemaps and submit `https://oren-bechor-drive.github.io/sitemap.xml`. Record its status, last-read time and discovered page count. The expected submitted count is one.
5. Inspect `https://oren-bechor-drive.github.io/`, choose Test live URL, and check crawl access, successful fetch, indexing permission and the rendered content. If eligible, choose Request indexing once. Anchors and preview pages are not additional indexing targets.
6. Later, check the indexed result and Google's selected canonical. A successful live test or request does not establish indexing or ranking.

For a submission error, retain its exact wording and affected URL. Check the sitemap's 200 response, XML content type and canonical URL, then use the homepage live test. Inspect tested HTML and loaded resources for a verification mismatch, blocked fetch, noindex, redirect or missing content. The local HTTP audit cannot see manual actions, removals, Google's selected canonical or Search Console account state. Use [Google's URL Inspection guidance](https://support.google.com/webmasters/answer/9012289) for those results. The URL Inspection API reads indexed information; it does not replace the interactive live test or request-indexing action.

## Bing Webmaster Tools

Sign in at [Bing Webmaster Tools](https://www.bing.com/webmasters/). Import the verified Search Console property, or add the same HTTPS site and choose HTML meta-tag verification. If using the tag method, supply the exact `<meta name="msvalidate.01" content="...">` from that account. Add it once inside the homepage head, run minification and checks, deploy, then select Verify in Bing. No empty or invented Bing verification tag is published.

The production checker compares both `google-site-verification` and `msvalidate.01` tags against the checked-out HTML, so it checks a supplied Bing tag automatically. Keep verified tags during future edits. Submit the canonical sitemap in Bing, or confirm that importing Google also imported it, and record the actual status. See [Bing's verification options](https://www2.bing.com/webmasters/help/add-and-verify-site-12184f8b).

## IndexNow after deployment

[Search publication](../.github/workflows/search-publication.yml) runs after a successful `pages-build-deployment` on `main`. It confirms the latest Pages build succeeded and checks out its exact SHA. Superseded build events are skipped. A manual run also resolves the last successful deployed revision, rather than publishing an arbitrary branch's URLs.

`npm run notify:indexnow` first runs the full production gate, then checks that `https://oren-bechor-drive.github.io/indexnow-key.txt` serves the expected key. Only then does it POST the indexable sitemap URLs to `https://api.indexnow.org/indexnow`, using the root key location. The root file is public ownership proof; it is not a provider credential. Keep it deployed, and update the file and notification together if rotating it.

HTTP 200 records receipt. HTTP 202 records receipt with key validation pending. Neither proves crawling or indexing. HTTP 403 means key validation failed; 422 means the host, key or URL scope is invalid; 429 means rate limiting. Read the workflow output and fix the cause before manually rerunning. Do not repeatedly notify to try to force indexing. This small sitemap is sent after each successful deployment; it is not a changed/deleted-URL feed. Add explicit deletion handling before using the workflow for a release that removes previously indexable pages. IndexNow is separate from Google Search Console verification and submissions. See the [IndexNow protocol](https://www.indexnow.org/documentation).

## Release evidence

Record the deployed commit, Pages build, production audit, browser checks, ownership results, sitemap receipt and URL Inspection result separately. Search-engine acceptance and eventual indexing are external states. The [2026-09-29 release record](search-release-2026-09-29.md) records this setup's observed results and outstanding work.
