#!/usr/bin/env bash
set -euo pipefail

RESULTS_DIR="${CLAUDE_PLUGIN_ROOT}/results"
mkdir -p "$RESULTS_DIR"

INPUT=$(cat)
echo "$INPUT" > "$RESULTS_DIR/pre-compact-raw.json"

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "MISSING"')
TRIGGER=$(echo "$INPUT" | jq -r '.trigger // "MISSING"')
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "MISSING"')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // "MISSING"')

{
  echo "=== PreCompact fired at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "session_id:      $SESSION_ID"
  echo "trigger:         $TRIGGER"
  echo "hook_event_name: $HOOK_EVENT"
  echo "transcript_path: $TRANSCRIPT_PATH"
  echo "---"
  echo "All fields received:"
  echo "$INPUT" | jq 'keys'
  echo ""
} >> "$RESULTS_DIR/pre-compact.log"

if [ "$TRANSCRIPT_PATH" != "MISSING" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  LINES=$(wc -l < "$TRANSCRIPT_PATH")
  SIZE=$(wc -c < "$TRANSCRIPT_PATH")
  FIRST_LINE=$(head -1 "$TRANSCRIPT_PATH")

  {
    echo "=== Transcript file readable ==="
    echo "path:       $TRANSCRIPT_PATH"
    echo "lines:      $LINES"
    echo "size_bytes: $SIZE"
    echo "first_line: $FIRST_LINE"
    echo "---"
    echo "Last 5 lines:"
    tail -5 "$TRANSCRIPT_PATH"
    echo ""
  } >> "$RESULTS_DIR/transcript-read.log"

  echo "PASS: transcript_path is readable ($LINES lines, $SIZE bytes)" >> "$RESULTS_DIR/pre-compact.log"
elif [ "$TRANSCRIPT_PATH" = "MISSING" ]; then
  echo "FAIL: transcript_path field not present in stdin JSON" >> "$RESULTS_DIR/pre-compact.log"
else
  echo "FAIL: transcript_path=$TRANSCRIPT_PATH but file does not exist or is not readable" >> "$RESULTS_DIR/pre-compact.log"
fi

exit 0
