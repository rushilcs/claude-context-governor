import { getDatabase, closeDatabase } from "../store/database.js";
import {
  generateAuditReport,
  generateProjectReport,
} from "../audit/reporter.js";

function resolveSessionId(
  db: ReturnType<typeof getDatabase>,
  partial: string,
): string | null {
  if (partial.length >= 36) return partial;
  const row = db
    .prepare("SELECT session_id FROM sessions WHERE session_id LIKE ? LIMIT 1")
    .get(`${partial}%`) as { session_id: string } | undefined;
  return row?.session_id ?? null;
}

function main() {
  const projectDir = process.cwd();
  const sessionIdArg = process.argv[2];
  const db = getDatabase();

  try {
    if (sessionIdArg) {
      const sessionId = resolveSessionId(db, sessionIdArg);
      if (!sessionId) {
        console.log(`No session found matching: ${sessionIdArg}`);
        process.exit(1);
      }
      const report = generateAuditReport(db, sessionId);
      console.log(report.markdown);
    } else {
      const report = generateProjectReport(db, projectDir);
      console.log(report);
    }
  } finally {
    closeDatabase();
  }
}

main();
