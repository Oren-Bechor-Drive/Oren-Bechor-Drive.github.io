# SEO audit decisions

The [SEOptimer live audit](https://www.seoptimer.com/oren-bechor.github.io) retrieved on September 17, 2026 at 08:26 UTC reported D+ overall and 28 recommendations. Its initial summary had different grades; this review uses the loaded live report. These are automated observations, not a list of requirements. Changes are scoped to the single Hebrew welcome page and its documented product boundaries.

## Recommendation disposition

Numbers match the report's recommendation order.

| Items | Finding | Decision |
| --- | --- | --- |
| 1 | Backlinks | External promotion, not a code fix. No link purchases, fabricated endorsements, or outreach were added. |
| 2, 3 | Missing robots.txt and XML sitemap | Added public crawl access and a sitemap containing the canonical welcome-page URL. No section anchors or unpublished pages. |
| 4, 5, 8 | Short title/description and keyword consistency | Updated Hebrew metadata to describe the real course, its audience, and instructor. The course-section heading and introduction now name the driving course directly, with natural wording and no change to the hero. |
| 6 | Missing canonical tag | Added the HTTPS root URL consistently across canonical and sharing metadata. |
| 7, 9 | Missing structured data and identity | Added linked WebSite, WebPage, Course, and Person data using supplied facts. No invented organization, reviews, pricing, or enrollment offer. |
| 10 | Missing image alt attribute | Every HTML image has an alt attribute. The brand icon now uses the owner's requested Hebrew text, `לוגו`, and the enclosing link retains its descriptive accessible name. |
| 11 | Low word count | Expanded the course introduction with three Hebrew paragraphs explaining the audience, specific topics and examples, and how to review material alongside practical lessons. The content uses the supplied brief and product facts, remains in baseline HTML, and adds approximately 110 words without new page sections or JavaScript. |
| 12 | High rendered-content percentage | Retained after a separate rendering review. Desktop and mobile checks found that the increase from 17 to 65 images comes entirely from expanding the gallery to all 15 photos and duplicating its row for continuous motion. The duplicate is hidden from assistive technology. All seven topic descriptions already exist in baseline HTML. Pregenerating the gallery would add HTML maintenance while retaining its loading, timing, and recovery code, with no demonstrated visitor benefit. |
| 13 | Render-blocking CSS | Kept the four small stylesheets in their documented order. They provide layout, responsive behavior, focus, and reduced-motion rules. Async loading or duplicated critical CSS would add failure modes and maintenance for an already fast page. |
| 14, 15 | DMARC and SPF | Outside this repository. The site uses a GitHub-owned hostname, with no supplied custom mail domain or sending service. Mail policy requires the actual domain owner and mail configuration. |
| 16, 17 | Contact details and LocalBusiness schema | Deferred. The owner confirmed public contact details are not available. Instructor identity is represented as a Person, without inventing a business address or phone. |
| 18, 19 | Open Graph and X cards | Added static Hebrew sharing metadata with an existing instructor image. No accounts or tracking required. |
| 20, 27 | Analytics and Facebook Pixel | Not installed. Tracking is a separate product decision requiring a provider, account configuration, and a measurement purpose. It is not necessary for crawling or metadata. |
| 21-25 | Social profiles | Deferred. The owner confirmed real profile URLs are not available. Existing documented footer placeholders are not represented as real profiles in structured data. |
| 26 | llms.txt | Added at the owner's request: a short Hebrew overview and links to the existing public page sections. The HTML links to it with `rel="describedby"`. This is a convenience for consumers of the proposal, not a promise of better rankings. |
| 28 | Short browser cache lifetimes | Hosting constraint. GitHub Pages controls response headers; repository files such as `_headers` or `.htaccess` do not change them. See the README caching section. |

## Other observations

- Project-authored text uses ASCII punctuation, including Hebrew hyphens and straight quotation marks. Original font licenses and supplied reference documents remain unchanged.
- Hreflang is unnecessary for this single Hebrew page; there are no alternate-language pages to link.
- No child pages were found because this release has one page. Section fragments remain on that page.
- Insufficient real-user Core Web Vitals data and premium-only report sections are not implementation defects.
- PageSpeed results in the report were 99 mobile and 100 desktop. Redirect and caching suggestions require inspecting the deployed request chain and host configuration, not inventing a client-side redirect.
- Structured data describes the content; it does not promise a rich result, indexing, or a higher audit grade.

## Evidence and maintenance

- [Google: helpful, reliable content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) does not prescribe a preferred word count. Preserve useful, accurate content rather than expanding to satisfy a scanner threshold.
- [Google: AI features and websites](https://developers.google.com/search/docs/appearance/ai-features) recommends accessible text and ordinary SEO fundamentals, with no additional AI text files or special schema required.
- [Google: structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) requires markup to represent the page accurately. Keep metadata synchronized when real course facts change.
- [README: search and sharing metadata](../README.md#search-and-sharing-metadata) records publishing and domain-change steps. [Production caching](../README.md#production-caching) records the hosting limitation.

## Verification and follow-up

The repository checks cover metadata consistency, sharing-image dimensions, structured-data links, crawl access, sitemap URLs, and `llms.txt` destinations. Chromium checks cover desktop and mobile rendering, image delivery, and navigation and topic descriptions with JavaScript enabled, disabled, or the entry module blocked. The expanded course introduction was also inspected at 1440px, 390px, and 320px. Local Chromium was used because the collaborative browser could not reach the development server.

After publishing, verify the page, `robots.txt`, `sitemap.xml`, and `llms.txt` at the public GitHub Pages address, then rerun the live audit. The grades above remain the original report's measurements; local checks and a successful push do not establish a new production score.
