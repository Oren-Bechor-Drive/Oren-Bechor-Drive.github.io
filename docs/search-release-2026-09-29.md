# Search release, 2026-09-29

## Initial production audit

- Host: GitHub Pages, branch source `main`, root `/`, HTTPS enforced, no custom domain.
- Production URL: `https://oren-bechor-drive.github.io/`.
- Initial deployed revision: `0cc4e8b486d960fddfeb5d770481e9500c4de4b1`.
- HTTP homepage returns 301 to HTTPS. HTTPS homepage, robots and sitemap return 200. `/course` redirects 301 to `/course/`.
- A nonexistent nested URL returns HTTP 404 and the noindex recovery page. `/404.html` itself is an existing noindex file and returns 200.
- All 35 authored HTML pages have a title, description, one h1 and alt attributes on their images. Homepage metadata, absolute sharing image and structured data already existed. Only the homepage is indexable; 34 preview/account/error pages remain noindex.
- Initial homepage content is static HTML. Existing progressive-enhancement tests cover navigation and topic descriptions without JavaScript or with the entry module blocked.
- Shared-browser desktop observation: no horizontal overflow at 1536px; homepage document transferred about 6.3 KB, TTFB about 357ms and load about 1.65s in this one session. These are observations, not mobile performance scores or field Core Web Vitals. Lazy images below the viewport had not yet loaded.
- Shared-browser viewport changes timed out twice. The browser also logged Electron preload errors. Phone and reduced-motion verification must be recorded separately from this desktop observation.

## Change and verification status

The release adds the supplied Google verification tag, generated-sitemap maintenance, production response checks, an IndexNow key and a notification workflow gated on successful Pages deployment. It preserves page layout, Hebrew copy, original image bytes, noindex previews and the existing deployment platform. The Worker allowlist gains only the named IndexNow key file; no backend deployment is part of this release.

Local release checks passed:

- `npm test`: 612 passed, zero failures or skips, including Chromium journeys, Firefox/WebKit smoke coverage, desktop/phone, pointer/keyboard, reduced motion, JavaScript-disabled/blocked paths, gateway, database and Worker runtime checks.
- `npm run check:links`: 528 local references across 35 pages.
- `npm run check:media`: 179 image references across 35 pages.
- `npm run check:search`: generated sitemap matches the indexable inventory.
- `npm run minify:html`: homepage 26,886 bytes, 6,138 gzip bytes for comparison.
- `npm run package:worker`: 226 allowlisted public files. This is a local package check, not a Worker deployment.
- `npm audit`: zero vulnerabilities after updating Wrangler from 4.140.0 to 4.143.1. Its transitive Undici update resolves GHSA-3wwx-pv8p-q78v.
- `git diff --check`: passed.
- Independent code review found no blocking defects. A future-filename sitemap issue was reproduced, fixed and covered by the five passing search-publication tests.

Google ownership confirmation, Bing verification or import, sitemap submissions and Google's live URL test require the owner's signed-in accounts. The owner chose to complete those steps in their own browser. No indexing result is claimed. Deployment and notification evidence will be added after Pages publishes this change.
