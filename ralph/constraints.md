# Ralph Constraints

- Do not refactor unrelated code.
- Prefer minimal diffs.
- Don’t rename routes or major folders unless required by PRD.
- Keep UI changes localized to tutorial components/pages.
- Avoid adding new heavy dependencies; prefer existing UI libs already in the repo.
- If a dependency is truly needed, document why in progress.md.

## Loop-Specific Rules

- Complete exactly one unchecked PRD checkbox per iteration (plus tiny prerequisites only).
- Run `ralph/gates.sh` and fix failures before checking off the PRD item.
- Append to `ralph/progress.md`; do not rewrite or delete prior entries.
- Do not perform destructive actions (`rm -rf`, resets, directory wipes, dependency upgrades) unless the PRD explicitly requires it.
