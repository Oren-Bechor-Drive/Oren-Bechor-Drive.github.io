# Project organization implementation plan

The requested change groups non-home pages into their own folders and organizes the supporting code and tests. The site remains directly servable HTML, CSS and JavaScript.

## Structure

- `index.html`: public homepage.
- `course/index.html`: course library.
- `course/right-of-way/index.html`: learning page.
- `course/right-of-way/quizzes/<section-id>/index.html`: independent quizzes.
- `course/css/` and `course/js/`: course styles and interaction modules.
- `css/`, `js/` and `assets/`: existing homepage and site-wide resources.
- `tests/browser/`, `tests/unit/` and `tests/helpers/`: Chromium journeys, Node checks and request fixtures.
- `scripts/site-pages.mjs`: shared authored-page discovery for learning and media checks.

## Work

- [x] Add failing learning-reader fixtures for nested pages, directory URLs, explicit index URLs and malformed nested return links.
- [x] Extract the existing recursive media discovery for its second consumer, the learning reader. Preserve exclusions, symlink handling and file-specific diagnostics.
- [x] Move pages and course assets, preserving HTML formatting and supplied image bytes. Rebase relative assets, navigation and quiz return links.
- [x] Group tests by execution environment; update imports, repository reads, browser serving and npm commands.
- [x] Update contributor documentation and the repository map to describe the actual structure and page-creation workflow.
- [x] Run Node checks, all Chromium tests, the media audit and `git diff --check`. Verify the course-to-lesson-to-quiz journey at desktop and mobile sizes. The collaborative browser loaded the library but failed during resize; local Playwright completed both sizes over real HTTP, at the site root and a directory prefix.

Preview URLs change together; preview pages retain noindex and stay out of the public sitemap. Hebrew copy, RTL order, visual styling, question content, baseline navigation and generated media stay intact.

## Verification

- `npm test`: 213 passed, zero failures or skips.
- `npm run check:media`: 133 image references across seven pages.
- All 130 local link and resource targets, including fragment anchors, resolve.
- Course body text is unchanged; moved CSS and JavaScript files are byte-for-byte identical to their originals.
- Desktop 1440px and mobile 390px browser journeys cover library, lesson, quiz answer navigation, lesson return and home navigation. The full suite also covers disabled and blocked JavaScript.
- `git diff --check` passes.
