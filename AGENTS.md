# Project instructions

## Product

- Build Oren Bachor's driving-course website, including the public preview and protected learner experience. Distinguish implemented local features from deployed services.
- Write all visitor-facing website copy in Hebrew and preserve right-to-left layout and reading order.
- Communicate with the user in English.
- Use ASCII punctuation in project-authored text, including Hebrew: `-`, `:`, `;`, `'`, `"`, `,`, `/`, `?`, and `.`. Preserve supplied reference documents, font files, and third-party license text.

## Sources of truth

- Before changing layout, typography, color, spacing, components, or motion, read `DESIGN.md` and keep the result consistent with it.
- When changing domain language or content structure, read `CONTEXT.md` and use its terms.
- Before changing module ownership, content verification, media delivery, gallery initialization, accounts, or protected learning, read [Architecture](docs/ARCHITECTURE.md) for ownership and test seams.
- Use `README.md` for local setup and current project scope. Its Todo section records future suggestions; implement them only when the user explicitly requests them.
- Use `PRODUCT.md` for audience, release boundaries, and supplied evidence.
- When changing search metadata, structured data, crawler files, or public URLs, follow [Search and sharing metadata](README.md#search-and-sharing-metadata).
- For account flows and local gateway configuration, read [Local accounts](docs/local-accounts.md). For protected content, quiz attempts, completion, retention, or private media, read [Protected learning](docs/protected-learning.md).
- For Worker packaging, hosted configuration, durable sessions, registration admission, or deployment, read [Hosting preparation](docs/hosting.md) and the [owner's decisions](docs/recommendation.md). Use [Operations](docs/OPERATIONS.md) for teaching approval, publication, and rollback.

## Technical boundaries

- Keep the checked-in frontend in plain HTML, CSS, and JavaScript, directly servable without a build. The local Node gateway and hosted Worker are separate runtimes; follow their documented setup and packaging steps.
- Preserve semantic HTML, keyboard access, visible focus, mobile behavior, progressive enhancement, and reduced-motion support.
- Never show focus rings on mouse clicks or touch taps, including text fields and buttons. Keep native focus and caret behavior; show visible focus for keyboard navigation. Follow [Focus behavior](DESIGN.md#focus-behavior) and verify both pointer and keyboard input when adding controls.
- Keep navigation and all topic descriptions usable when JavaScript is disabled or the entry module fails to load. Use the baseline HTML descriptions as the interactive preview's content source.
- When adding learning sections or practice quizzes, follow [Add learning sections and quizzes](README.md#add-learning-sections-and-quizzes). Each quiz owns its static content and return links; `course/js/quiz.js` owns shared interaction. Preserve the current HTML formatting.
- For public theory-question changes, edit the reviewed maintenance source and regenerate the owned HTML regions through [Maintain public theory quizzes](README.md#maintain-public-theory-quizzes). Keep source provenance, documented adaptations, and original diagrams aligned.
- After editing `index.html`, follow [Page source maintenance](README.md#page-source-maintenance): run `npm run minify:html` after any media optimization. Preserve formatting in other HTML pages.
- Keep course copy, search and sharing metadata, structured data, and `llms.txt` consistent with supplied facts. Add real contact details, profile URLs, or enrollment destinations only when supplied.
- Preserve user-supplied image bytes unless the user explicitly requests an image edit. Keep marked road-media metadata accurate when paths or images change.
- When changing image sources, delivery widths, compression, or sizing hints, follow [Optimize delivery images](README.md#optimize-delivery-images) for regeneration, publishing, and browser delivery checks. Run optimizers sequentially within a checkout.
- For gallery maintenance, follow [Add or update student photos](README.md#add-or-update-student-photos). Preserve numeric photo order without a fixed maximum; regenerate the photo list through the optimizer. Publish originals, generated delivery files, `js/road-photo-sources.js`, and updated `index.html` together. Keep car templates, sprite files, and CSS alignment consistent. The supplied `cars.png` composite is source artwork, not dead code.
- Supply a student photo list to each gallery initialization. Tests own their fixture lists; the generated list stays unchanged during tests.
- Make focused changes. Introduce shared modules only after a real second consumer creates a clear need.

## Accounts and protected content

- Public course HTML and theory answer keys are intentionally public. Keep restricted teaching content, private quiz keys, and private media outside public HTML, JavaScript, assets, and Worker static output. Serve them through authorized APIs and private storage.
- Keep provider credentials, access/refresh tokens, and PKCE verifiers on the server. The browser receives an opaque session cookie and CSRF value. Preserve origin checks, session validation, learner-scoped authorization, and private-response cache controls.
- Keep protected grading, entitlement checks, and progress ownership in the server/database boundary. Public practice results do not grant saved progress or topic completion. Billing remains disabled under the owner's recorded decision.
- Preserve the public-file allowlist when changing either server entry or Worker packaging. GitHub Pages publication does not deploy the gateway, apply database migrations, or configure Auth and cleanup jobs.
- Use disposable local databases and owned synthetic fixtures for tests. Never apply `supabase/tests/database/auth-bootstrap.sql` to hosted Supabase or synthetic development grants to production. Follow [Database and hosted API verification](supabase/tests/README.md) for database checks; report local evidence separately from hosted verification.

## Verification

- Add or update tests for behavior changes and run `npm test`. This includes unit, gateway, database, hosting, and browser checks, including Chromium gallery/image-delivery tests and Firefox/WebKit smoke coverage. Follow [Local checks](README.md#local-checks) for dependencies and browser installation.
- Run `npm run check:links` after changing pages, local URLs, anchors, or referenced file paths. Preserve ordinary learning pages' relative URLs and the domain-root recovery paths in `404.html`.
- Run `npm run check:media` after changing HTML image declarations, preload metadata, or files under `assets/`.
- Keep learning relationships interpreted by `scripts/learning-content.mjs`, including file-specific diagnostics for malformed authored content. Keep placeholder-layout assertions separate from shared quiz interaction tests.
- The media audit discovers authored HTML pages and checks local image declarations. Preserve its stricter marked road-media rules while allowing scaled ordinary images. Check the documented exclusions before placing new pages in subdirectories.
- Run `git diff --check` before completion.
- For documentation-only changes, verify referenced files, section anchors, and commands against the repository. Application tests are unnecessary unless runtime files or behavior also change.
- For visual or interaction changes, verify the affected path at desktop and mobile sizes in the collaborative browser, including reduced motion. If it is unavailable, use local Playwright Chromium and report that limitation.
- When changing navigation or topic selection, verify both the enhanced interaction and the baseline experience with JavaScript disabled or the entry module blocked.

## Agent workflows

- Before reading, creating, or updating issues, follow [GitHub issue workflow](docs/agents/issue-tracker.md).
- When triaging issues, use the [triage role mapping](docs/agents/triage-labels.md).
- Before domain exploration or recording an architectural decision, follow the [single-context domain rules](docs/agents/domain.md).
