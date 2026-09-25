# Private media policy implementation

The owner approved common policy ownership and strict shared validation. Keep the gateway's authorization and both transport lifetimes intact.

1. Compare compact catalog, separate pure functions and request-plan designs. Select a compact catalog with a request plan that resolves response metadata after size discovery.
2. Add adapter contract tests for strict IDs, immutable opaque catalogs, GET/HEAD and single ranges. Run before implementation to reproduce the local ID-coercion and empty-Range failures.
3. Implement `server/media-policy.mjs`; migrate both adapters and remove duplicate rules. Keep filename validation, local file checks, Storage metadata validation, cancellation and transport-specific failures in their adapters.
4. Repair the local database fixture's complete adapter forwarding and verify section media discovery. Keep transport-specific regression tests and actual Worker streaming coverage.
5. Update architecture and recommendations, review the focused changes, run `npm test` and `git diff --check`.

No website presentation, provider configuration or deployment changes are part of this work.
