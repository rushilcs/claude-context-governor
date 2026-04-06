import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { readStdin } from "../utils/stdin.js";
import { getDatabase, closeDatabase } from "../store/database.js";
import { ensureSession } from "../store/sessions.js";
import { selectForRestore } from "../restore/selector.js";
import { serializeForContext } from "../restore/serializer.js";
import type { SessionStartInput } from "../types.js";

function debugLog(msg: string) {
  const logPath = join(
    process.env.HOME || "/tmp",
    ".claude-context-governor",
    "debug.log",
  );
  try {
    appendFileSync(logPath, `[SessionStart ${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // best effort
  }
}

async function main() {
  debugLog("Hook started");
  debugLog(`CLAUDE_PLUGIN_DATA=${process.env.CLAUDE_PLUGIN_DATA || "(unset)"}`);
  debugLog(`CLAUDE_PLUGIN_ROOT=${process.env.CLAUDE_PLUGIN_ROOT || "(unset)"}`);

  const input = (await readStdin()) as SessionStartInput;
  debugLog(`stdin parsed: session_id=${input.session_id}, cwd=${input.cwd}`);

  const db = getDatabase();
  debugLog("Database opened");

  try {
    ensureSession(db, input.session_id, input.cwd);
    debugLog("Session ensured");

    const selection = selectForRestore(db, input.cwd, input.session_id);
    debugLog(`Selection: ${selection.selected.length} selected, ${selection.skipped.length} skipped`);
    const additionalContext = serializeForContext(selection);
    debugLog(`additionalContext length: ${additionalContext.length}`);

    const output = {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    };

    console.log(JSON.stringify(output));
    debugLog("Output written to stdout");
  } finally {
    closeDatabase();
    debugLog("Database closed, hook complete");
  }
}

main().catch((err) => {
  debugLog(`ERROR: ${err}`);
  process.stderr.write(`[governor] SessionStart error: ${err}\n`);
  process.exit(0);
});
