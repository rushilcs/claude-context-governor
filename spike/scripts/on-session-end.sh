#!/usr/bin/env bash
set -euo pipefail

RESULTS_DIR="${CLAUDE_PLUGIN_ROOT}/results"
mkdir -p "$RESULTS_DIR"

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "MISSING"')
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "MISSING"')
REASON=$(echo "$INPUT" | jq -r '.reason // "MISSING"')

{
  echo "=== SessionEnd fired at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "session_id:      $SESSION_ID"
  echo "hook_event_name: $HOOK_EVENT"
  echo "reason:          $REASON"
  echo "---"
  echo "All fields received:"
  echo "$INPUT" | jq 'keys'
  echo ""
} >> "$RESULTS_DIR/session-end.log"

exit 0
