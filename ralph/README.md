# Ralph Loop Harness

`ralph/` is a repo-local harness for running iterative, checklist-driven Codex executions against this repository.

The loop is designed to:
- work from any current directory (it resolves paths from the script location),
- execute exactly one PRD checkbox per iteration,
- run project gates after each change,
- append a structured progress entry,
- create a git commit if the iteration changed files.

## Quick Start

```bash
chmod +x ralph/gates.sh ralph/ralph-loop.sh
./ralph/ralph-loop.sh 10
```

## Files

- `ralph/prd.md`: Append/maintain a checkbox PRD. The loop stops when no unchecked boxes remain.
- `ralph/progress.md`: Append-only log of each iteration. Do not rewrite prior entries.
- `ralph/constraints.md`: Guardrails the loop passes to Codex every iteration.
- `ralph/gates.sh`: Repo gate runner (best-effort auto-detection for JS/Python projects).
- `ralph/ralph-loop.sh`: Iterative Codex runner (`codex exec`, non-interactive).

## Conventions

- Keep PRD items small and verifiable. One checkbox should be one reviewable unit.
- Make the first checkbox a concrete gates prerequisite (for example: make `./ralph/gates.sh` pass on a clean tree) and treat all feature items as blocked until it is complete.
- Use explicit acceptance criteria in checkbox wording (what should change, where, and how you can verify it).
- Prefer page/component-local tasks before shared refactors.
- Keep `progress.md` append-only so iteration history remains auditable.
- Start the loop from a clean git working tree. The loop commits after each iteration and assumes it is not mixing in unrelated local edits.

## How the Loop Works

For each iteration, `ralph-loop.sh`:
1. Checks `ralph/prd.md` for unchecked checkboxes.
2. Invokes `codex exec` with a strict prompt that reads:
   - `ralph/prd.md`
   - `ralph/progress.md`
   - `ralph/constraints.md`
3. Instructs Codex to complete exactly one checkbox and run `ralph/gates.sh` until green.
4. Verifies exactly one checkbox was checked for successful iterations, or exits gracefully if the iteration is explicitly logged as `blocked`/`failed` with no checkbox checked.
5. Commits the result if files changed.

## Authoring PRDs

Use checkboxes like:

```md
- [ ] Add overlay dimming to tutorial steps on `frontend/sgsl/app/onboarding/page.tsx` while keeping the tutorial card and active target visually highlighted.
```

Good PRD items are:
- small enough for one iteration,
- tied to specific files/behaviors,
- testable (UI state, interaction, gate pass, regression guard).

## Gates

`ralph/gates.sh` runs from repo root and tries to detect common gates:
- JS/TS: probes `package.json` scripts and only runs defined `lint`, `typecheck`, `test`
- Package manager preference: `pnpm` > `yarn` > `npm` based on lockfiles in each package directory
- Python: if `pyproject.toml` exists, runs `python -m pytest -q` only when `pytest` is importable

If your gates are too heavy or currently red, do not directory-allowlist gates as a workaround. Prefer a top-of-PRD prerequisite that makes `./ralph/gates.sh` green on a clean tree, then proceed with feature items, and document the gate-fix work in `ralph/progress.md`.

## Blocked / Failed Iterations

The loop can stop cleanly with zero checkboxes checked only when the current iteration appends a progress entry whose `Status:` field is `blocked` or `failed` (case-insensitive).

To ensure that works, append a standard entry for the iteration and include a clear status line, for example:

```md
## Iteration 3 - 2026-02-22 13:45:00 UTC
- Status: blocked
- PRD item: <unchecked item text>
- Summary: Blocked by existing lint failures in `frontend/sgsl`
```

## Repo Context (Current First PRD)

The seeded PRD targets UI/tutorial improvements for the SGSL frontend. The current Module 1 teaching tutorial flow appears to live in `frontend/sgsl/app/onboarding/page.tsx`, and the later tutorial tasks in `ralph/prd.md` are scoped around extending/improving that experience and related practice pages.
