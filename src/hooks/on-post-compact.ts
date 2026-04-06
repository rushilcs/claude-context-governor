import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { readStdin } from "../utils/stdin.js";
import { getDatabase, closeDatabase } from "../store/database.js";
import { ensureSession, updateCompactSummary } from "../store/sessions.js";
import { extractMemories } from "../extract/extractor.js";
import { checkConflicts } from "../conflict/detector.js";
import type { PostCompactInput } from "../types.js";

function debugLog(msg: string) {
  const logPath = join(
    process.env.HOME || "/tmp",
    ".claude-context-governor",
    "debug.log",
  );
  try {
    appendFileSync(logPath, `[PostCompact ${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // best effort
  }
}

async function main() {
  debugLog("Hook started");
  debugLog(`CLAUDE_PLUGIN_DATA=${process.env.CLAUDE_PLUGIN_DATA || "(unset)"}`);

  const input = (await readStdin()) as PostCompactInput;
  debugLog(`stdin parsed: session_id=${input.session_id}, cwd=${input.cwd}`);
  debugLog(`compact_summary length: ${input.compact_summary?.length ?? 0}`);

  const db = getDatabase();
  debugLog("Database opened");

  try {
    ensureSession(db, input.session_id, input.cwd);
    debugLog("Session ensured");

    if (input.compact_summary) {
      updateCompactSummary(db, input.session_id, input.compact_summary);
      debugLog("Compact summary saved");

      const result = extractMemories(
        db,
        input.compact_summary,
        "compact_summary",
        input.session_id,
        input.cwd,
      );
      debugLog(
        `Extraction result: ${result.items.length} items, ${result.duplicatesSkipped} dupes, ${result.superseded} superseded`,
      );

      for (const item of result.items) {
        checkConflicts(db, item, input.session_id);
      }
      debugLog("Conflict checks complete");
    } else {
      debugLog("No compact_summary in input");
    }
  } finally {
    closeDatabase();
    debugLog("Database closed, hook complete");
  }
}

main().catch((err) => {
  debugLog(`ERROR: ${err}`);
  process.stderr.write(`[governor] PostCompact error: ${err}\n`);
  process.exit(0);
});
