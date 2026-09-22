# Architecture reliability implementation plan

**Goal:** Implement both candidates from the architecture review without changing the learner experience.

**Architecture:** Keep media preparation and recoverable publication inside the optimizer. Deepen the authored-page module with shared file resolution for learning-content and site-link verification. Preserve existing working-tree edits.

**Execution:** Implement directly in this session, as requested. No delegation.

## Media publication

- [x] Add command-level regression fixtures for a corrupt later photo, a missing later asset, and a publication failure after earlier files changed. Assert preservation of published bytes and source artwork, cleanup of temporary output, and successful retry.
- [x] Run the regressions against the current optimizer and confirm the partial-write failures.
- [x] Generate delivery files, student photo list and updated HTML in a private directory on the destination filesystem. Publish with a rollback journal, moving obsolete WebP files into backups until publication succeeds.
- [x] Preserve recovery backups and report their location if rollback itself fails. Document that process crashes and concurrent optimizer runs are outside this guarantee.
- [x] Run the optimizer tests, including deterministic output and removal of obsolete delivery widths.

## Authored-page resolution

- [x] Extend nested learning fixtures to cover .htm directory links, explicit paths, missing trailing slashes, and quiz return anchors. Confirm the current implementation rejects supported directory paths.
- [x] Put cached local-file resolution in scripts/site-pages.mjs alongside discovery. Directory lookup prefers index.html, then index.htm; explicit file paths remain exact.
- [x] Migrate scripts/site-links.mjs and scripts/learning-content.mjs to that resolver. Keep URL parsing, deployment-prefix checks, learning ownership and diagnostics in their current modules.
- [x] Verify inventory exclusions, ordinary non-HTML assets, missing files, malformed references, and directory precedence through focused tests.

## Documentation and verification

- [x] Update README.md and docs/ARCHITECTURE.md with publication recovery and resolution ownership.
- [x] Run npm test, npm run check:media, npm run check:links and git diff --check. Inspect only the intended changes against the pre-existing working tree. No image regeneration or visual changes are needed.

## Implementation verification results

- Initial regression run: five expected failures demonstrated partial media writes, missing rollback, and .htm directory-resolution disagreements.
- Final `npm test`: 276 tests passed, zero failures or skips. The first full run had one scroll-reveal timing assertion failure; it passed in isolation and in the complete rerun without changes to that test or runtime behavior.
- `npm run check:media`: 151 image references across 17 pages passed.
- `npm run check:links`: 274 local references across 17 pages passed.
- `git diff --check`: passed.
- Diff review confirmed that unrelated pre-existing tracked edits remained unchanged. Source images and the generated student photo list were not modified.

## Final review

- Reproduced and fixed obsolete-file cleanup treating a directory ending in .webp as an image. Cleanup now checks regular files and normalizes filesystem separators before comparing generated paths.
- Removed the redundant delete before restoring an existing file from its backup. New files without predecessors still get removed during rollback.
- Simplified file-resolution nesting and removed duplicate path conversion, eager document-loading traversal and a redundant regular-expression prefix.
- Consolidated filesystem-failure test setup. Restored successful relative quiz-return coverage and made the root-containment test use an existing file outside the site.
- Checked all new exports and their callers. No unused exports remain.
- Final review validation: all 277 tests passed without retries, both site audits passed, and git diff --check passed. No source artwork, generated photo list or unrelated existing changes were modified.
