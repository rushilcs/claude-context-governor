#!/usr/bin/env bash
set -euo pipefail

RESULTS_DIR="${CLAUDE_PLUGIN_ROOT}/results"
mkdir -p "$RESULTS_DIR"

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "MISSING"')
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "MISSING"')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // "MISSING"')
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // "MISSING"')

LAST_MSG_LEN=0
if [ "$LAST_MSG" != "MISSING" ]; then
  LAST_MSG_LEN=${#LAST_MSG}
fi

{
  echo "=== Stop fired at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "session_id:        $SESSION_ID"
  echo "hook_event_name:   $HOOK_EVENT"
  echo "stop_hook_active:  $STOP_HOOK_ACTIVE"
  echo "last_msg_length:   $LAST_MSG_LEN chars"
  echo "---"
  echo "All fields received:"
  echo "$INPUT" | jq 'keys'
  echo ""
} >> "$RESULTS_DIR/stop.log"

exit 0
