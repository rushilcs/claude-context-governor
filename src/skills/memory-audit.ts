import { getDatabase, closeDatabase } from "../store/database.js";
import {
  generateAuditReport,
  generateProjectReport,
} from "../audit/reporter.js";

function main() {
  const projectDir = process.argv[2];
  if (!projectDir) {
    console.log("Usage: memory-audit <project-dir> [session-id]");
    process.exit(1);
  }

  const sessionId = process.argv[3];
  const db = getDatabase();

  try {
    if (sessionId) {
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
