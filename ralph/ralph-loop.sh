#!/usr/bin/env bash
set -euo pipefail

IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RALPH_DIR="$REPO_ROOT/ralph"
PRD_FILE="$RALPH_DIR/prd.md"
PROGRESS_FILE="$RALPH_DIR/progress.md"
CONSTRAINTS_FILE="$RALPH_DIR/constraints.md"
GATES_SCRIPT="$RALPH_DIR/gates.sh"
COMMIT_BRANCH="ralph"

MAX_ITERS="${1:-10}"

log() {
  printf '[ralph:loop] %s\n' "$*"
}

die() {
  log "ERROR: $*"
  exit 1
}

count_unchecked_boxes() {
  awk '
    /^[[:space:]]*[-*][[:space:]]+\[ \]/ { count += 1 }
    END { print count + 0 }
  ' "$PRD_FILE"
}

progress_file_size_bytes() {
  wc -c < "$PROGRESS_FILE" | tr -d '[:space:]'
}

get_last_progress_entry_meta() {
  awk '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }
    function start_section(raw_value, parsed_value) {
      parsed_value = trim(raw_value)
      if (match(parsed_value, /[0-9]+/)) {
        parsed_value = substr(parsed_value, RSTART, RLENGTH)
      }
      have_section = 1
      last_iteration = parsed_value
      last_status = ""
    }
    {
      line = $0

      if (line ~ /^[[:space:]]*##[[:space:]]*[Ii]teration([[:space:]]|$)/) {
        value = line
        sub(/^[[:space:]]*##[[:space:]]*[Ii]teration[[:space:]]*/, "", value)
        start_section(value)
        next
      }

      if (line ~ /^[[:space:]]*[-*]?[[:space:]]*[Ii]teration[[:space:]]*:/) {
        value = line
        sub(/^[[:space:]]*[-*]?[[:space:]]*[Ii]teration[[:space:]]*:[[:space:]]*/, "", value)
        start_section(value)
        next
      }

      if (have_section && line ~ /^[[:space:]]*[-*]?[[:space:]]*[Ss]tatus[[:space:]]*:/) {
        value = line
        sub(/^[[:space:]]*[-*]?[[:space:]]*[Ss]tatus[[:space:]]*:[[:space:]]*/, "", value)
        last_status = trim(value)
      }
    }
    END {
      if (!have_section) {
        exit 1
      }
      printf "%s\t%s\n", last_iteration, last_status
    }
  ' "$PROGRESS_FILE"
}

status_is_blocked_or_failed() {
  local raw_status="$1"
  local normalized_status
  normalized_status="$(printf '%s' "$raw_status" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  case "$normalized_status" in
    blocked*|failed*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

zero_checkbox_iteration_has_blocked_or_failed_progress() {
  local iter="$1"
  local progress_bytes_before="$2"
  local progress_bytes_after
  local meta
  local parsed_iter=""
  local parsed_status=""
  local IFS

  progress_bytes_after="$(progress_file_size_bytes)"
  if [ "$progress_bytes_after" -le "$progress_bytes_before" ]; then
    return 1
  fi

  meta="$(get_last_progress_entry_meta 2>/dev/null || true)"
  if [ -z "$meta" ]; then
    return 1
  fi

  IFS=$'\t'
  read -r parsed_iter parsed_status <<EOF
$meta
EOF

  if [ "$parsed_iter" != "$iter" ]; then
    return 1
  fi

  if ! status_is_blocked_or_failed "$parsed_status"; then
    return 1
  fi

  ITERATION_TERMINAL_STATUS="$parsed_status"
  return 0
}

append_runner_progress_entry() {
  local iter="$1"
  local status="$2"
  local summary="$3"
  local ts
  ts="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"

  {
    printf '\n## Iteration %s - %s\n' "$iter" "$ts"
    printf -- '- Status: %s\n' "$status"
    printf -- '- PRD item: (runner-level entry; Codex may not have completed an item)\n'
    printf -- '- Summary: %s\n' "$summary"
    printf -- '- Files changed:\n'
    printf -- '  - (see git diff)\n'
    printf -- '- Gates:\n'
    printf -- '  - `ralph/gates.sh`: not-run\n'
    printf -- '- Notes/Risks:\n'
    printf -- '  - Added by `ralph/ralph-loop.sh` because the Codex iteration exited before appending a normal progress entry.\n'
  } >> "$PROGRESS_FILE"
}

ensure_required_files() {
  [ -f "$PRD_FILE" ] || die "Missing $PRD_FILE"
  [ -f "$CONSTRAINTS_FILE" ] || die "Missing $CONSTRAINTS_FILE"
  [ -x "$GATES_SCRIPT" ] || die "Missing or non-executable $GATES_SCRIPT"

  if [ ! -f "$PROGRESS_FILE" ]; then
    cat > "$PROGRESS_FILE" <<'EOF'
# Ralph Progress Log

Append-only. Add new entries at the end.
EOF
  fi
}

ensure_clean_worktree() {
  local status
  status="$(git -C "$REPO_ROOT" status --porcelain)"
  if [ -n "$status" ] && [ "${RALPH_ALLOW_DIRTY:-0}" != "1" ]; then
    die "Git working tree is not clean. Commit/stash changes first, or rerun with RALPH_ALLOW_DIRTY=1."
  fi
}

current_git_branch() {
  git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD
}

ensure_commit_branch_checked_out() {
  local current_branch
  current_branch="$(current_git_branch)"

  if [ "$current_branch" = "$COMMIT_BRANCH" ]; then
    return 0
  fi

  if ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$COMMIT_BRANCH"; then
    die "Required commit branch '$COMMIT_BRANCH' does not exist. Create it first, then rerun."
  fi

  if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
    die "Cannot switch to '$COMMIT_BRANCH' with a dirty working tree."
  fi

  log "Switching from branch '${current_branch}' to '${COMMIT_BRANCH}' for Ralph loop commits."
  git -C "$REPO_ROOT" checkout "$COMMIT_BRANCH" >/dev/null
}

assert_on_commit_branch() {
  local current_branch
  current_branch="$(current_git_branch)"
  if [ "$current_branch" != "$COMMIT_BRANCH" ]; then
    die "Expected to commit on branch '$COMMIT_BRANCH', but current branch is '$current_branch'."
  fi
}

commit_if_needed() {
  local iter="$1"
  assert_on_commit_branch
  if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
    git -C "$REPO_ROOT" add -A
    if git -C "$REPO_ROOT" commit -m "ralph: iteration ${iter}"; then
      log "Created commit for iteration ${iter} on branch '${COMMIT_BRANCH}'."
    else
      log "git commit returned non-zero for iteration ${iter}."
      return 1
    fi
  else
    log "No file changes in iteration ${iter}; skipping commit."
  fi
}

build_prompt_file() {
  local iter="$1"
  local prompt_file="$2"

  cat > "$prompt_file" <<EOF
You are running a single Ralph loop iteration inside this repository.

Repository root (absolute path): $REPO_ROOT
Ralph PRD (absolute path): $PRD_FILE
Ralph progress log (absolute path): $PROGRESS_FILE
Ralph constraints (absolute path): $CONSTRAINTS_FILE
Ralph gates script (absolute path): $GATES_SCRIPT
Iteration number: $iter

Task requirements for THIS iteration:
1. Read the PRD, progress log, and constraints files listed above.
2. Pick exactly ONE unchecked checkbox from the PRD.
3. Implement only that checkbox (plus tiny prerequisites that are strictly necessary).
4. Run "$GATES_SCRIPT".
5. If gates fail, fix the implementation and rerun "$GATES_SCRIPT" until it passes.
6. Only after gates pass, check off exactly the one PRD checkbox you completed.
7. Append a structured progress entry to "$PROGRESS_FILE" (append-only; do not edit previous entries).

Progress entry format (append at end):
## Iteration $iter - YYYY-MM-DD HH:MM:SS UTC
- Status: done | blocked | failed
- PRD item: <exact checkbox text>
- Summary: <what changed>
- Files changed:
  - <one path per line>
- Gates:
  - \`ralph/gates.sh\`: pass | fail
- Notes/Risks:
  - <notes>

Hard rules:
- Complete exactly one PRD checkbox. Do not check multiple boxes.
- Do not refactor unrelated code.
- Prefer minimal diffs.
- Do not rename routes or major folders unless required by the PRD item.
- Keep UI changes localized to tutorial components/pages.
- Avoid adding new heavy dependencies; prefer existing libraries already in the repo.
- If a dependency is truly needed, document why in the progress entry.
- Do not run destructive commands (no resets, no directory wipes, no removing unrelated files).
- Do not create a git commit; the loop runner will handle commits.
- Do not switch git branches; the loop runner commits on the repository's "$COMMIT_BRANCH" branch.

If you are blocked:
- Leave the PRD checkbox unchecked.
- Append a progress entry with Status: blocked and a concrete blocker description.
- Stop after making the smallest safe diagnostic change (or no code changes if none are needed).
EOF
}

run_codex_iteration() {
  local iter="$1"
  local prompt_file
  local output_file
  local codex_rc

  prompt_file="$(mktemp "${TMPDIR:-/tmp}/ralph-prompt.${iter}.XXXXXX")"
  output_file="$(mktemp "${TMPDIR:-/tmp}/ralph-codex-output.${iter}.XXXXXX")"

  build_prompt_file "$iter" "$prompt_file"

  log "Starting Codex iteration ${iter}."
  if codex -a never -s workspace-write exec -C "$REPO_ROOT" --color never --output-last-message "$output_file" - < "$prompt_file"; then
    codex_rc=0
  else
    codex_rc=$?
  fi

  if [ -s "$output_file" ]; then
    log "Codex summary (iteration ${iter}):"
    sed 's/^/[ralph:loop]   /' "$output_file"
  fi

  rm -f "$prompt_file" "$output_file"

  if [ "$codex_rc" -ne 0 ]; then
    append_runner_progress_entry "$iter" "failed" "Codex exec exited with status ${codex_rc}."
    die "Codex iteration ${iter} failed (exit ${codex_rc})."
  fi
}

validate_iteration_checkbox_change() {
  local before_count="$1"
  local after_count="$2"
  local iter="$3"
  local progress_bytes_before="$4"

  ITERATION_RESULT="success"
  ITERATION_TERMINAL_STATUS=""

  if [ "$after_count" -gt "$before_count" ]; then
    append_runner_progress_entry "$iter" "failed" "Unchecked checkbox count increased unexpectedly (${before_count} -> ${after_count})."
    die "PRD unchecked checkbox count increased after iteration ${iter}."
  fi

  if [ "$after_count" -eq "$before_count" ]; then
    if zero_checkbox_iteration_has_blocked_or_failed_progress "$iter" "$progress_bytes_before"; then
      ITERATION_RESULT="blocked"
      return 0
    fi

    append_runner_progress_entry "$iter" "failed" "No PRD checkbox was checked by Codex (${before_count} remaining)."
    die "Iteration ${iter} did not complete a PRD checkbox."
  fi

  if [ "$after_count" -lt $((before_count - 1)) ]; then
    append_runner_progress_entry "$iter" "failed" "More than one PRD checkbox appears to have been checked (${before_count} -> ${after_count})."
    die "Iteration ${iter} appears to have checked multiple PRD items."
  fi
}

main() {
  case "$MAX_ITERS" in
    ''|*[!0-9]*)
      die "Max iterations must be a positive integer (got: ${MAX_ITERS})"
      ;;
  esac

  if [ "$MAX_ITERS" -lt 1 ]; then
    die "Max iterations must be >= 1"
  fi

  command -v codex >/dev/null 2>&1 || die "codex CLI not found in PATH"
  command -v git >/dev/null 2>&1 || die "git not found in PATH"

  ensure_required_files
  cd "$REPO_ROOT"
  ensure_clean_worktree
  ensure_commit_branch_checked_out

  log "Repo root: $REPO_ROOT"
  log "Commit branch: $COMMIT_BRANCH"
  log "Max iterations: $MAX_ITERS"

  local iter
  local unchecked_before
  local unchecked_after
  local progress_bytes_before
  local stopped_due_to_blocked_or_failed=0

  for ((iter = 1; iter <= MAX_ITERS; iter += 1)); do
    unchecked_before="$(count_unchecked_boxes)"
    if [ "$unchecked_before" -eq 0 ]; then
      log "No unchecked PRD items remain. Stopping."
      break
    fi

    log "Iteration ${iter}: ${unchecked_before} unchecked PRD item(s) remain."
    progress_bytes_before="$(progress_file_size_bytes)"
    run_codex_iteration "$iter"

    unchecked_after="$(count_unchecked_boxes)"
    validate_iteration_checkbox_change "$unchecked_before" "$unchecked_after" "$iter" "$progress_bytes_before"

    commit_if_needed "$iter"

    if [ "${ITERATION_RESULT:-success}" = "blocked" ]; then
      stopped_due_to_blocked_or_failed=1
      log "Iteration ${iter} ended with no checkbox checked and Status: ${ITERATION_TERMINAL_STATUS}. Stopping gracefully; see the latest entry in ${PROGRESS_FILE} for details."
      break
    fi
  done

  if [ "$stopped_due_to_blocked_or_failed" -eq 1 ]; then
    log "Loop stopped after a blocked/failed iteration."
  elif [ "$(count_unchecked_boxes)" -gt 0 ]; then
    log "Reached iteration limit (${MAX_ITERS}) with remaining PRD items."
  else
    log "PRD complete. No unchecked items remain."
  fi
}

main "$@"
