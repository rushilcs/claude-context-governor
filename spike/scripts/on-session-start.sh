#!/usr/bin/env bash
set -euo pipefail

RESULTS_DIR="${CLAUDE_PLUGIN_ROOT}/results"
mkdir -p "$RESULTS_DIR"

INPUT=$(cat)
echo "$INPUT" > "$RESULTS_DIR/session-start-raw.json"

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "MISSING"')
CWD=$(echo "$INPUT" | jq -r '.cwd // "MISSING"')
SOURCE=$(echo "$INPUT" | jq -r '.source // "MISSING"')
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "MISSING"')

{
  echo "=== SessionStart fired at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "session_id:      $SESSION_ID"
  echo "cwd:             $CWD"
  echo "source:          $SOURCE"
  echo "hook_event_name: $HOOK_EVENT"
  echo "---"
  echo "All fields received:"
  echo "$INPUT" | jq 'keys'
  echo ""
} >> "$RESULTS_DIR/session-start.log"

cat <<'RESPONSE'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "[GOVERNOR-SPIKE] This is a test injection from claude-context-governor M0 spike. If you can see this text, additionalContext injection is working. The magic word is PINEAPPLE."
  }
}
RESPONSE
