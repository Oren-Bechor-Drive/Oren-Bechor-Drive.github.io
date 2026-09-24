# Issue tracker: GitHub

Track new issues in [GitHub Issues](https://github.com/Oren-Bechor-Drive/Oren-Bechor-Drive.github.io/issues). Use the `gh` CLI from this repository, or pass `--repo Oren-Bechor-Drive/Oren-Bechor-Drive.github.io` explicitly.

Existing requirements in `README.md` and `docs/plans/` remain valid spec sources. Follow issue references when supplied; otherwise identify the relevant authored spec before reviewing or implementing work.

## Operations

- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels`, with appropriate filters.
- Create: write the exact body to a temporary Markdown file, then use `gh issue create --title "..." --body-file <path>`.
- Comment: `gh issue comment <number> --body-file <path>`.
- Apply or remove labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`. Use the role mapping in [triage-labels.md](triage-labels.md).
- Close: `gh issue close <number>`. Add an explanatory comment separately when needed.

When a skill says "publish to the issue tracker", create a GitHub issue. When it says "fetch the relevant ticket", read the referenced GitHub issue and its comments.

## Pull requests as a triage surface

**PRs as a request surface: no.** Set this to `yes` only when external pull requests should enter the issue triage workflow.

GitHub issues and pull requests share a number space. Resolve ambiguous references with `gh pr view <number>` and fall back to `gh issue view <number>`. Read pull request changes with `gh pr diff <number>`.

## Wayfinding

A map is one issue labelled `wayfinder:map`. Child tickets use `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.

Link children with GitHub sub-issues. If unavailable, maintain a task list in the map and a `Part of #<map>` reference in each child. Record blockers with native issue dependencies; if unavailable, put `Blocked by: #<number>` at the top of the child body.

The next ticket is the first open, unassigned child in map order with no open blocker. Claim it with `gh issue edit <number> --add-assignee @me`. Resolve it by commenting with the result, closing it, and adding a concise result and link to the map's decisions.
