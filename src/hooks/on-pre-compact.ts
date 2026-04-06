import { existsSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { readStdin } from "../utils/stdin.js";
import { getDatabase, closeDatabase } from "../store/database.js";
import { ensureSession, incrementCompactionCount } from "../store/sessions.js";
import { extractMemories } from "../extract/extractor.js";
import { checkConflicts } from "../conflict/detector.js";
import {
  parseTranscript,
  extractAssistantMessages,
  getRelatedFilesFromTranscript,
} from "../utils/transcript.js";
import type { PreCompactInput } from "../types.js";

function debugLog(msg: string) {
  const logPath = join(
    process.env.HOME || "/tmp",
    ".claude-context-governor",
    "debug.log",
  );
  try {
    appendFileSync(logPath, `[PreCompact ${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // best effort
  }
}

async function main() {
  debugLog("Hook started");
  debugLog(`CLAUDE_PLUGIN_DATA=${process.env.CLAUDE_PLUGIN_DATA || "(unset)"}`);
  debugLog(`CLAUDE_PLUGIN_ROOT=${process.env.CLAUDE_PLUGIN_ROOT || "(unset)"}`);

  const input = (await readStdin()) as PreCompactInput;
  debugLog(`stdin parsed: session_id=${input.session_id}, cwd=${input.cwd}`);
  debugLog(`transcript_path=${input.transcript_path}`);
  debugLog(`compact_summary present=${!!(input as Record<string, unknown>).compact_summary}`);
  debugLog(`hook_event_name=${input.hook_event_name}`);

  const db = getDatabase();
  debugLog("Database opened");

  try {
    ensureSession(db, input.session_id, input.cwd);
    debugLog("Session ensured");
    incrementCompactionCount(db, input.session_id);
    debugLog("Compaction count incremented");

    if (input.transcript_path && existsSync(input.transcript_path)) {
      debugLog(`Transcript file exists, reading...`);
      const messages = parseTranscript(input.transcript_path);
      debugLog(`Parsed ${messages.length} messages total`);
      const assistantText = extractAssistantMessages(messages).join("\n\n");
      debugLog(`Assistant text length: ${assistantText.length} chars`);
      const relatedFiles = getRelatedFilesFromTranscript(messages);
      debugLog(`Related files: ${relatedFiles.length}`);

      if (assistantText.length > 0) {
        debugLog("Extracting memories...");
        const result = extractMemories(
          db,
          assistantText,
          "transcript",
          input.session_id,
          input.cwd,
          relatedFiles,
        );
        debugLog(
          `Extraction result: ${result.items.length} items, ${result.duplicatesSkipped} dupes, ${result.superseded} superseded`,
        );

        for (const item of result.items) {
          checkConflicts(db, item, input.session_id);
        }
        debugLog("Conflict checks complete");
      } else {
        debugLog("No assistant text found - skipping extraction");
      }
    } else {
      debugLog(
        `Transcript not available: path=${input.transcript_path}, exists=${input.transcript_path ? existsSync(input.transcript_path) : "no path"}`,
      );
    }
  } finally {
    closeDatabase();
    debugLog("Database closed, hook complete");
  }
}

main().catch((err) => {
  debugLog(`ERROR: ${err}`);
  process.stderr.write(`[governor] PreCompact error: ${err}\n`);
  process.exit(0);
});
