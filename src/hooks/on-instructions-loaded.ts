import { readStdin } from "../utils/stdin.js";
import { getDatabase, closeDatabase } from "../store/database.js";
import { ensureSession } from "../store/sessions.js";
import { recordInstructionFile } from "../store/instruction-files.js";
import type { InstructionsLoadedInput } from "../types.js";

async function main() {
  const input = (await readStdin()) as InstructionsLoadedInput;
  const db = getDatabase();

  try {
    ensureSession(db, input.session_id, input.cwd);

    recordInstructionFile(db, {
      session_id: input.session_id,
      file_path: input.file_path,
      memory_type: input.memory_type || "unknown",
      load_reason: input.load_reason || "unknown",
      loaded_at: new Date().toISOString(),
    });
  } finally {
    closeDatabase();
  }
}

main().catch((err) => {
  process.stderr.write(`[governor] InstructionsLoaded error: ${err}\n`);
  process.exit(0);
});
