#!/usr/bin/env bash
set -euo pipefail

RESULTS_DIR="${CLAUDE_PLUGIN_ROOT}/results"
mkdir -p "$RESULTS_DIR"

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // "MISSING"')
MEMORY_TYPE=$(echo "$INPUT" | jq -r '.memory_type // "MISSING"')
LOAD_REASON=$(echo "$INPUT" | jq -r '.load_reason // "MISSING"')
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "MISSING"')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "MISSING"')

{
  echo "=== InstructionsLoaded fired at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "session_id:      $SESSION_ID"
  echo "hook_event_name: $HOOK_EVENT"
  echo "file_path:       $FILE_PATH"
  echo "memory_type:     $MEMORY_TYPE"
  echo "load_reason:     $LOAD_REASON"
  echo "---"
  echo "All fields received:"
  echo "$INPUT" | jq 'keys'
  echo ""
} >> "$RESULTS_DIR/instructions-loaded.log"

exit 0
