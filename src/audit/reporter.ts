import type Database from "better-sqlite3";
import type { AuditEntry, MemoryItemRow } from "../types.js";
import { rowToMemoryItem } from "../store/memory-items.js";

export interface AuditReport {
  sessionId: string;
  generatedAt: string;
  summary: {
    loaded: number;
    skipped: number;
    rejected: number;
    extracted: number;
    conflictsDetected: number;
    totalTokenCost: number;
  };
  entries: AuditEntry[];
  markdown: string;
  json: string;
}

export function generateAuditReport(
  db: Database.Database,
  sessionId: string,
): AuditReport {
  const entries = db
    .prepare(
      "SELECT * FROM audit_entries WHERE session_id = ? ORDER BY timestamp ASC",
    )
    .all(sessionId) as AuditEntry[];

  const summary = {
    loaded: 0,
    skipped: 0,
    rejected: 0,
    extracted: 0,
    conflictsDetected: 0,
    totalTokenCost: 0,
  };

  for (const entry of entries) {
    switch (entry.action) {
      case "loaded":
        summary.loaded++;
        summary.totalTokenCost += entry.token_cost ?? 0;
        break;
      case "skipped":
        summary.skipped++;
        break;
      case "rejected":
        summary.rejected++;
        break;
      case "extracted":
        summary.extracted++;
        break;
      case "conflict-detected":
        summary.conflictsDetected++;
        break;
    }
  }

  const markdown = renderMarkdownReport(sessionId, summary, entries, db);
  const json = JSON.stringify({ sessionId, summary, entries }, null, 2);

  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    summary,
    entries,
    markdown,
    json,
  };
}

export function generateProjectReport(
  db: Database.Database,
  projectDir: string,
): string {
  const items = db
    .prepare("SELECT * FROM memory_items WHERE project_dir = ? ORDER BY created_at DESC")
    .all(projectDir) as MemoryItemRow[];

  const sessions = db
    .prepare("SELECT * FROM sessions WHERE project_dir = ? ORDER BY started_at DESC")
    .all(projectDir) as Array<{
    session_id: string;
    started_at: string;
    compaction_count: number;
    items_extracted: number;
    items_restored: number;
  }>;

  const statusCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  for (const row of items) {
    const item = rowToMemoryItem(row);
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
    if (item.status === "active") {
      categoryCounts[item.category] =
        (categoryCounts[item.category] ?? 0) + 1;
    }
  }

  const lines: string[] = [];
  lines.push("# Memory Governor — Project Report");
  lines.push("");
  lines.push(`**Project**: ${projectDir}`);
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push(`**Total items**: ${items.length}`);
  lines.push(`**Sessions recorded**: ${sessions.length}`);
  lines.push("");

  lines.push("## Status Breakdown");
  for (const [status, count] of Object.entries(statusCounts)) {
    lines.push(`- ${status}: ${count}`);
  }
  lines.push("");

  lines.push("## Active Items by Category");
  for (const [category, count] of Object.entries(categoryCounts)) {
    lines.push(`- ${category}: ${count}`);
  }
  lines.push("");

  if (sessions.length > 0) {
    lines.push("## Recent Sessions");
    for (const s of sessions.slice(0, 5)) {
      lines.push(
        `- ${s.started_at.split("T")[0]} | extracted: ${s.items_extracted} | restored: ${s.items_restored} | compactions: ${s.compaction_count}`,
      );
    }
  }

  return lines.join("\n");
}

function renderMarkdownReport(
  sessionId: string,
  summary: AuditReport["summary"],
  entries: AuditEntry[],
  db: Database.Database,
): string {
  const lines: string[] = [];
  lines.push("# Memory Governor — Audit Report");
  lines.push("");
  lines.push(`**Session**: ${sessionId}`);
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Summary");
  lines.push(`- Extracted: ${summary.extracted}`);
  lines.push(`- Loaded: ${summary.loaded}`);
  lines.push(`- Skipped: ${summary.skipped}`);
  lines.push(`- Rejected: ${summary.rejected}`);
  lines.push(`- Conflicts detected: ${summary.conflictsDetected}`);
  lines.push(`- Total token cost: ${summary.totalTokenCost}`);
  lines.push("");

  lines.push("## Decision Log");
  lines.push("| Time | Action | Item | Reason | Tokens |");
  lines.push("|------|--------|------|--------|--------|");

  for (const entry of entries) {
    const time = entry.timestamp.split("T")[1]?.split(".")[0] ?? "";
    const itemContent = getItemContentPreview(db, entry.memory_item_id);
    const tokens = entry.token_cost ?? "-";
    lines.push(
      `| ${time} | ${entry.action} | ${itemContent} | ${entry.reason} | ${tokens} |`,
    );
  }

  return lines.join("\n");
}

function getItemContentPreview(
  db: Database.Database,
  itemId: string,
): string {
  const row = db
    .prepare("SELECT content FROM memory_items WHERE id = ?")
    .get(itemId) as { content: string } | undefined;

  if (!row) return `[${itemId.slice(0, 8)}]`;
  return row.content.length > 40
    ? row.content.slice(0, 37) + "..."
    : row.content;
}
