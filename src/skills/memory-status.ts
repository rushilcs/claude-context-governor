import { getDatabase, closeDatabase } from "../store/database.js";
import { getItemCounts, getActiveItems } from "../store/memory-items.js";
import type { MemoryItem } from "../types.js";
import { statSync } from "node:fs";
import { join } from "node:path";

const CATEGORY_ORDER = [
  "decision",
  "constraint",
  "convention",
  "bug-lesson",
  "open-question",
  "command-recipe",
  "work-in-progress",
];

const CATEGORY_LABELS: Record<string, string> = {
  decision: "Decisions",
  constraint: "Constraints",
  convention: "Conventions",
  "bug-lesson": "Bug Lessons",
  "open-question": "Open Questions",
  "command-recipe": "Command Recipes",
  "work-in-progress": "Work in Progress",
};

function main() {
  const projectDir = process.argv[2] || process.cwd();

  const db = getDatabase();

  try {
    const statusCounts = getItemCounts(db, projectDir);
    const activeItems = getActiveItems(db, projectDir);

    const sessions = db
      .prepare(
        "SELECT COUNT(*) as count FROM sessions WHERE project_dir = ?",
      )
      .get(projectDir) as { count: number };

    const totalItems = Object.values(statusCounts).reduce(
      (a, b) => a + b,
      0,
    );

    const lines: string[] = [];
    lines.push("# Memory Governor Status\n");
    lines.push(`**Project**: ${projectDir}`);
    lines.push(`**Total items**: ${totalItems} (${Object.entries(statusCounts).map(([s, c]) => `${c} ${s}`).join(", ")})`);
    lines.push(`**Sessions**: ${sessions.count}`);

    const dataDir =
      process.env.CLAUDE_PLUGIN_DATA ||
      join(process.env.HOME || "~", ".claude-context-governor");
    try {
      const dbStat = statSync(join(dataDir, "governor.db"));
      lines.push(`**Storage**: ${(dbStat.size / 1024).toFixed(1)} KB`);
    } catch {
      // DB might be in-memory or path doesn't exist
    }

    lines.push("");

    if (activeItems.length === 0) {
      lines.push("No active memory items.");
    } else {
      const grouped = new Map<string, MemoryItem[]>();
      for (const item of activeItems) {
        const list = grouped.get(item.category) || [];
        list.push(item);
        grouped.set(item.category, list);
      }

      for (const cat of CATEGORY_ORDER) {
        const items = grouped.get(cat);
        if (!items) continue;
        lines.push(`## ${CATEGORY_LABELS[cat] || cat} (${items.length})`);
        for (const item of items) {
          const date = item.created_at.split("T")[0];
          const meta: string[] = [];
          meta.push(`confidence: ${item.confidence.toFixed(1)}`);
          if (item.memory_source !== "transcript") {
            meta.push(`source: ${item.memory_source}`);
          }
          if (item.pinned) meta.push("pinned");
          lines.push(`- **[${item.id.slice(0, 8)}]** [${date}] ${item.content} (${meta.join(", ")})`);
        }
        lines.push("");
      }
    }

    console.log(lines.join("\n"));
  } finally {
    closeDatabase();
  }
}

main();
