#!/usr/bin/env bash
set -euo pipefail

RESULTS_DIR="${CLAUDE_PLUGIN_ROOT}/results"
mkdir -p "$RESULTS_DIR"

INPUT=$(cat)
echo "$INPUT" > "$RESULTS_DIR/post-compact-raw.json"

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "MISSING"')
TRIGGER=$(echo "$INPUT" | jq -r '.trigger // "MISSING"')
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "MISSING"')
COMPACT_SUMMARY=$(echo "$INPUT" | jq -r '.compact_summary // "MISSING"')

SUMMARY_LEN=0
if [ "$COMPACT_SUMMARY" != "MISSING" ]; then
  SUMMARY_LEN=${#COMPACT_SUMMARY}
fi

{
  echo "=== PostCompact fired at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "session_id:      $SESSION_ID"
  echo "trigger:         $TRIGGER"
  echo "hook_event_name: $HOOK_EVENT"
  echo "summary_length:  $SUMMARY_LEN chars"
  echo "---"
  echo "All fields received:"
  echo "$INPUT" | jq 'keys'
  echo ""
} >> "$RESULTS_DIR/post-compact.log"

if [ "$COMPACT_SUMMARY" != "MISSING" ] && [ "$SUMMARY_LEN" -gt 10 ]; then
  {
    echo "=== compact_summary content ==="
    echo "$COMPACT_SUMMARY"
    echo ""
  } > "$RESULTS_DIR/compact-summary.txt"

  echo "PASS: compact_summary received ($SUMMARY_LEN chars)" >> "$RESULTS_DIR/post-compact.log"
elif [ "$COMPACT_SUMMARY" = "MISSING" ]; then
  echo "FAIL: compact_summary field not present in stdin JSON" >> "$RESULTS_DIR/post-compact.log"
else
  echo "WARN: compact_summary present but very short ($SUMMARY_LEN chars): $COMPACT_SUMMARY" >> "$RESULTS_DIR/post-compact.log"
fi

exit 0
