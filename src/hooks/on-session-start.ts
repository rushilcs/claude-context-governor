import { readStdin } from "../utils/stdin.js";
import { getDatabase, closeDatabase } from "../store/database.js";
import { ensureSession } from "../store/sessions.js";
import { selectForRestore } from "../restore/selector.js";
import { serializeForContext } from "../restore/serializer.js";
import type { SessionStartInput } from "../types.js";

async function main() {
  const input = (await readStdin()) as SessionStartInput;
  const db = getDatabase();

  try {
    ensureSession(db, input.session_id, input.cwd);

    const selection = selectForRestore(db, input.cwd, input.session_id);
    const additionalContext = serializeForContext(selection);

    const output = {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    };

    console.log(JSON.stringify(output));
  } finally {
    closeDatabase();
  }
}

main().catch((err) => {
  process.stderr.write(`[governor] SessionStart error: ${err}\n`);
  process.exit(0);
});
