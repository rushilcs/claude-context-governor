import { existsSync } from "node:fs";
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

async function main() {
  const input = (await readStdin()) as PreCompactInput;
  const db = getDatabase();

  try {
    ensureSession(db, input.session_id, input.cwd);
    incrementCompactionCount(db, input.session_id);

    if (input.transcript_path && existsSync(input.transcript_path)) {
      const messages = parseTranscript(input.transcript_path);
      const assistantText = extractAssistantMessages(messages).join("\n\n");
      const relatedFiles = getRelatedFilesFromTranscript(messages);

      if (assistantText.length > 0) {
        const result = extractMemories(
          db,
          assistantText,
          "transcript",
          input.session_id,
          input.cwd,
          relatedFiles,
        );

        for (const item of result.items) {
          checkConflicts(db, item, input.session_id);
        }
      }
    }
  } finally {
    closeDatabase();
  }
}

main().catch((err) => {
  process.stderr.write(`[governor] PreCompact error: ${err}\n`);
  process.exit(0);
});
