import { readStdin } from "../utils/stdin.js";
import { getDatabase, closeDatabase } from "../store/database.js";
import { ensureSession } from "../store/sessions.js";
import type { StopInput } from "../types.js";

async function main() {
  const input = (await readStdin()) as StopInput;
  const db = getDatabase();

  try {
    ensureSession(db, input.session_id, input.cwd);

    // Stop hook: save last_assistant_message as turn snapshot
    // Lightweight stale-item check deferred to post-MVP
  } finally {
    closeDatabase();
  }
}

main().catch((err) => {
  process.stderr.write(`[governor] Stop error: ${err}\n`);
  process.exit(0);
});
