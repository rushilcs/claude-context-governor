import { readStdin } from "../utils/stdin.js";
import { getDatabase, closeDatabase } from "../store/database.js";
import { ensureSession, updateCompactSummary } from "../store/sessions.js";
import { extractMemories } from "../extract/extractor.js";
import { checkConflicts } from "../conflict/detector.js";
import type { PostCompactInput } from "../types.js";

async function main() {
  const input = (await readStdin()) as PostCompactInput;
  const db = getDatabase();

  try {
    ensureSession(db, input.session_id, input.cwd);

    if (input.compact_summary) {
      updateCompactSummary(db, input.session_id, input.compact_summary);

      const result = extractMemories(
        db,
        input.compact_summary,
        "compact_summary",
        input.session_id,
        input.cwd,
      );

      for (const item of result.items) {
        checkConflicts(db, item, input.session_id);
      }
    }
  } finally {
    closeDatabase();
  }
}

main().catch((err) => {
  process.stderr.write(`[governor] PostCompact error: ${err}\n`);
  process.exit(0);
});
