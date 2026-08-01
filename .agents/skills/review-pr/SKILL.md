---
name: review-pr
description: Review a PR from local annotated-diff artifacts and write validated review.json for the workflow to publish. Use for machine-readable PR review instead of posting to GitHub directly. Optionally fold verify-behavior computer-use findings into the same review.json for UI changes.
---

# Review PR

Write `review.json` for the checked-out PR. Do **not** post to GitHub.

## Inputs

- Working tree = PR branch
- `pr_diff.txt` (annotated). If only a raw diff exists:
  ```sh
  python3 .agents/skills/review-pr/scripts/annotate_diff.py --input raw_diff.txt --output pr_diff.txt
  ```
- `pr_description.txt` when present
- `spec_context.md` when present (or build via `resolve_spec_context.py` if the prompt says so)
- Optional companions only when referenced: `review-pr-local`, `check-impl-against-spec`, `security-review-pr`, `verify-behavior` — same `review.json`; companions must not change schema, severities, safety, evidence, suggestion, or line contracts

## Scope

Prioritize: correctness, security, error handling, regressions, material performance, material spec drift.

- Findings must be grounded in the annotated diff + nearby checkout code
- Inline comments only on paths/lines in this PR's annotated diff; otherwise top-level `body`
- Style/nits only with a concrete suggestion block
- New tests only for distinct paths/edge cases not already covered
- Before suggesting a confirmation/undo guard that would reverse an intentional destructive action (e.g. a reset/clear control), check the PR description and any linked issue for explicit acceptance criteria first; if the behavior is already specified there, don't present the guard as an actionable fix — omit it or note it as a separate product question instead
- V0/initial PRs: timeouts/retries/lifecycle as optional unless correctness/security/data-loss risk
- Docs/specs-only: clarity, completeness, contradictions, missing acceptance criteria
- UI/interactive + `verify-behavior` present: optional `verify` on PR head; fold failures as important/critical; brief success note in `body` only if it changes the review

## Annotated lines (only location source)

| Prefix | Side |
|---|---|
| `[OLD:n]` | `LEFT`, line `n` |
| `[NEW:n]` | `RIGHT`, line `n` |
| `[OLD:n,NEW:m]` context | `RIGHT`, line `m` |

Copy `path` / `side` / `line` (and range) from a real annotation. No annotation → `body`, not `comments`.

## Comments

Each `comments[].body` **starts** with exactly one:

- `🚨 [CRITICAL]` — bugs, security, crashes, data loss
- `⚠️ [IMPORTANT]` — logic, edge cases, missing error handling, material spec drift
- `💡 [SUGGESTION]` — worthwhile improvements
- `🧹 [NIT]` — cleanup **only** with a suggestion block

Rules: concise, actionable, no praise/hedging; prefer single-line; ranges ≤ 10 lines; verify each comment's coordinates against `pr_diff.txt` before emit.

## Suggestions

```suggestion
<replacement only>
```

- Exact file indentation; block replaces **exactly** `start_line`–`line` inclusive
- Do not repeat lines outside that range (causes duplicates on apply)
- Preserve brace/bracket/paren/`end` depth vs replaced lines
- Multi-line: set `start_line`/`start_side` and `line`/`side`
- Validate fixes with available build/typecheck/lint/targeted tests when practical; if unvalidated, say so — do not present speculative code as ready

## Specs (`spec_context.md`)

Extract commitments → compare to diff/branch → flag **material** mismatches only (important+). Broad drift in `body`; inline only on changed lines. No drive-by alignment commentary. No useful specs → review on merits; mention absence only if it raises risk.

## `review.json` contract

```json
{
  "verdict": "REJECT",
  "body": "…",
  "comments": []
}
```

| Field | Rule |
|---|---|
| `verdict` | Required: `"APPROVE"` or `"REJECT"` only. `Approve` / `Approve with nits` → `APPROVE`; `Request changes` → `REJECT`. Must match `body` disposition. |
| `body` | Required string (GitHub review body). Not `summary`. |
| `comments` | Required array (empty OK). |
| `path` | Repo-relative; must be in the diff. |
| `line` / `side` | Required; `side` is `LEFT` or `RIGHT`. |
| `start_line` / `start_side` | Multi-line only; `start_side` required if `start_line` set. |

### `body` minimum

Lead with **actionable findings by severity**, or one line that there are no findings.

Also include only:

- `Found: X critical, Y important, Z suggestions`
- Disposition: `Approve` | `Approve with nits` | `Request changes` (matches `verdict`)
- Untouched-code / out-of-diff concerns that could not be inline (if any)

**Do not** include: PR change summaries, generic praise, restating the diff, low-value narration, or long overviews.

## Validate (required)

```sh
python3 .agents/skills/review-pr/scripts/validate_review_json.py --review-json review.json --diff pr_diff.txt
```

Fix until it passes. If the path differs, use `validate_review_json.py` under the loaded `review-pr` skill dir.

No `gh pr review` / `gh pr comment` / `gh api` posting. **Only output:** final `review.json`.
