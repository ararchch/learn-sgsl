#!/usr/bin/env bash
set -euo pipefail

IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

FAILURES=0
RAN_ANY=0
RUNNER_DESC=""
RUNNER_CMD=()

log() {
  printf '[ralph:gates] %s\n' "$*"
}

to_rel() {
  local abs_path="$1"
  if [ "$abs_path" = "$REPO_ROOT" ]; then
    printf '.\n'
  else
    printf '%s\n' "${abs_path#"$REPO_ROOT"/}"
  fi
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

json_has_script() {
  local package_json="$1"
  local script_name="$2"

  if have_cmd python3; then
    python3 - "$package_json" "$script_name" <<'PY'
import json, sys
path, name = sys.argv[1], sys.argv[2]
try:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    scripts = data.get("scripts") or {}
except Exception:
    sys.exit(2)
sys.exit(0 if name in scripts else 1)
PY
    return $?
  fi

  if have_cmd python; then
    python - "$package_json" "$script_name" <<'PY'
import json, sys
path, name = sys.argv[1], sys.argv[2]
try:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    scripts = data.get("scripts") or {}
except Exception:
    sys.exit(2)
sys.exit(0 if name in scripts else 1)
PY
    return $?
  fi

  if have_cmd node; then
    node -e '
const fs = require("fs");
const [pkgPath, scriptName] = process.argv.slice(1);
try {
  const data = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const scripts = data && data.scripts ? data.scripts : {};
  process.exit(Object.prototype.hasOwnProperty.call(scripts, scriptName) ? 0 : 1);
} catch {
  process.exit(2);
}
' "$package_json" "$script_name"
    return $?
  fi

  return 3
}

select_js_runner() {
  local pkg_dir="$1"
  RUNNER_DESC=""
  RUNNER_CMD=()

  if [ -f "$pkg_dir/pnpm-lock.yaml" ]; then
    if have_cmd pnpm; then
      RUNNER_DESC="pnpm"
      RUNNER_CMD=(pnpm run)
      return 0
    fi
    log "Found pnpm lockfile in $(to_rel "$pkg_dir"), but pnpm is unavailable; falling back."
  fi

  if [ -f "$pkg_dir/yarn.lock" ]; then
    if have_cmd yarn; then
      RUNNER_DESC="yarn"
      RUNNER_CMD=(yarn run)
      return 0
    fi
    log "Found yarn lockfile in $(to_rel "$pkg_dir"), but yarn is unavailable; falling back."
  fi

  if have_cmd npm; then
    RUNNER_DESC="npm"
    RUNNER_CMD=(npm run)
    return 0
  fi

  return 1
}

run_js_gates_for_package() {
  local package_json="$1"
  local pkg_dir
  local rel_dir
  local script_name
  local probe_status

  pkg_dir="$(cd "$(dirname "$package_json")" && pwd)"
  rel_dir="$(to_rel "$pkg_dir")"

  for script_name in lint typecheck test; do
    if json_has_script "$package_json" "$script_name"; then
      probe_status=0
    else
      probe_status=$?
    fi

    if [ "$probe_status" -eq 0 ]; then
      if ! select_js_runner "$pkg_dir"; then
        log "No JS package runner available for ${rel_dir}; cannot run '${script_name}'."
        FAILURES=1
        continue
      fi

      RAN_ANY=1
      log "Running ${RUNNER_DESC} ${script_name} in ${rel_dir}"
      if ! (
        cd "$pkg_dir"
        "${RUNNER_CMD[@]}" "$script_name"
      ); then
        log "FAILED: ${script_name} in ${rel_dir}"
        FAILURES=1
      fi
      continue
    fi

    case "$probe_status" in
      1)
        log "Skipping ${script_name} in ${rel_dir} (script not defined)"
        ;;
      2)
        log "Skipping ${script_name} in ${rel_dir} (could not parse package.json)"
        ;;
      3)
        log "Skipping ${script_name} in ${rel_dir} (no parser available to inspect package.json)"
        ;;
      *)
        log "Skipping ${script_name} in ${rel_dir} (unexpected probe status: ${probe_status})"
        ;;
    esac
  done
}

run_python_gates_for_project() {
  local pyproject_toml="$1"
  local py_dir
  local rel_dir

  py_dir="$(cd "$(dirname "$pyproject_toml")" && pwd)"
  rel_dir="$(to_rel "$py_dir")"

  if ! have_cmd python; then
    log "Skipping python gates in ${rel_dir} (python not available)"
    return 0
  fi

  if ! (
    cd "$py_dir"
    python - <<'PY'
import importlib.util, sys
sys.exit(0 if importlib.util.find_spec("pytest") else 1)
PY
  ); then
    log "Skipping python gates in ${rel_dir} (pytest not available)"
    return 0
  fi

  RAN_ANY=1
  log "Running python gate in ${rel_dir}: python -m pytest -q"
  if ! (
    cd "$py_dir"
    python -m pytest -q
  ); then
    log "FAILED: python tests in ${rel_dir}"
    FAILURES=1
  fi
}

discover_and_run_js() {
  while IFS= read -r package_json; do
    run_js_gates_for_package "$package_json"
  done < <(
    find "$REPO_ROOT" \
      \( -name .git -o -name .vercel -o -name node_modules -o -name .next -o -name dist -o -name build -o -name coverage -o -name .venv -o -name venv \) -prune \
      -o -name package.json -print | sort
  )
}

discover_and_run_python() {
  while IFS= read -r pyproject_toml; do
    run_python_gates_for_project "$pyproject_toml"
  done < <(
    find "$REPO_ROOT" \
      \( -name .git -o -name .vercel -o -name node_modules -o -name .next -o -name dist -o -name build -o -name coverage -o -name .venv -o -name venv \) -prune \
      -o -name pyproject.toml -print | sort
  )
}

log "Repo root: $REPO_ROOT"

discover_and_run_js
discover_and_run_python

if [ "$RAN_ANY" -eq 0 ]; then
  log "No runnable gates detected."
fi

if [ "$FAILURES" -ne 0 ]; then
  log "Gate run completed with failures."
  exit 1
fi

log "All detected gates passed."
