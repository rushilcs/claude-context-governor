import { getDatabase, closeDatabase } from "../store/database.js";
import { getItemCounts, getCategoryCounts } from "../store/memory-items.js";
import { statSync } from "node:fs";
import { join } from "node:path";

function main() {
  const projectDir = process.argv[2];
  if (!projectDir) {
    console.log("Usage: memory-status <project-dir>");
    process.exit(1);
  }

  const db = getDatabase();

  try {
    const statusCounts = getItemCounts(db, projectDir);
    const categoryCounts = getCategoryCounts(db, projectDir);

    const sessions = db
      .prepare(
        "SELECT COUNT(*) as count FROM sessions WHERE project_dir = ?",
      )
      .get(projectDir) as { count: number };

    const lastSession = db
      .prepare(
        "SELECT * FROM sessions WHERE project_dir = ? ORDER BY started_at DESC LIMIT 1",
      )
      .get(projectDir) as {
      session_id: string;
      started_at: string;
      items_extracted: number;
      items_restored: number;
    } | undefined;

    const totalItems = Object.values(statusCounts).reduce(
      (a, b) => a + b,
      0,
    );

    const lines: string[] = [];
    lines.push("# Memory Governor Status\n");
    lines.push(`**Project**: ${projectDir}`);
    lines.push(`**Total items**: ${totalItems}`);
    lines.push(`**Sessions**: ${sessions.count}`);
    lines.push("");

    lines.push("## Items by Status");
    for (const [status, count] of Object.entries(statusCounts)) {
      lines.push(`- ${status}: ${count}`);
    }
    if (totalItems === 0) lines.push("- (none)");
    lines.push("");

    lines.push("## Active Items by Category");
    for (const [category, count] of Object.entries(categoryCounts)) {
      lines.push(`- ${category}: ${count}`);
    }
    if (Object.keys(categoryCounts).length === 0) lines.push("- (none)");
    lines.push("");

    if (lastSession) {
      lines.push("## Last Session");
      lines.push(`- ID: ${lastSession.session_id}`);
      lines.push(`- Started: ${lastSession.started_at}`);
      lines.push(`- Extracted: ${lastSession.items_extracted}`);
      lines.push(`- Restored: ${lastSession.items_restored}`);
    }

    // DB size
    const dataDir =
      process.env.CLAUDE_PLUGIN_DATA ||
      join(process.env.HOME || "~", ".claude-context-governor");
    try {
      const dbStat = statSync(join(dataDir, "governor.db"));
      lines.push("");
      lines.push(
        `**Storage**: ${(dbStat.size / 1024).toFixed(1)} KB`,
      );
    } catch {
      // DB might be in-memory or path doesn't exist
    }

    console.log(lines.join("\n"));
  } finally {
    closeDatabase();
  }
}

main();
