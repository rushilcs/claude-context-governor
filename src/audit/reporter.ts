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

  const activeItems = items
    .map(rowToMemoryItem)
    .filter((i) => i.status === "active");

  const lines: string[] = [];
  lines.push("# Memory Governor — Project Report");
  lines.push("");
  lines.push(`**Project**: ${projectDir}`);
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push(`**Total items**: ${items.length} (${activeItems.length} active)`);
  lines.push(`**Sessions recorded**: ${sessions.length}`);
  lines.push("");

  lines.push("## Active Memory Items");
  if (activeItems.length > 0) {
    lines.push("| ID | Category | Content | Rationale | Confidence | Created |");
    lines.push("|----|----------|---------|-----------|------------|---------|");
    for (const item of activeItems) {
      const shortId = item.id.slice(0, 8);
      const content = item.content.length > 60
        ? item.content.slice(0, 57) + "..."
        : item.content;
      const rationale = item.rationale.length > 50
        ? item.rationale.slice(0, 47) + "..."
        : item.rationale;
      const created = item.created_at.split("T")[0];
      const conf = Math.round(item.confidence * 100) + "%";
      lines.push(
        `| ${shortId} | ${item.category} | ${content} | ${rationale} | ${conf} | ${created} |`,
      );
    }
  } else {
    lines.push("_(no active items)_");
  }
  lines.push("");

  lines.push("## Status Breakdown");
  if (Object.keys(statusCounts).length > 0) {
    for (const [status, count] of Object.entries(statusCounts)) {
      lines.push(`- ${status}: ${count}`);
    }
  } else {
    lines.push("_(no items)_");
  }
  lines.push("");

  lines.push("## Active Items by Category");
  if (Object.keys(categoryCounts).length > 0) {
    for (const [category, count] of Object.entries(categoryCounts)) {
      lines.push(`- ${category}: ${count}`);
    }
  } else {
    lines.push("_(no active items)_");
  }
  lines.push("");

  if (sessions.length > 0) {
    lines.push("## Recent Sessions");
    lines.push("| Date | Session | Extracted | Restored | Compactions |");
    lines.push("|------|---------|-----------|----------|-------------|");
    for (const s of sessions.slice(0, 10)) {
      const date = s.started_at.split("T")[0];
      const shortId = s.session_id.slice(0, 8);
      lines.push(
        `| ${date} | ${shortId} | ${s.items_extracted} | ${s.items_restored} | ${s.compaction_count} |`,
      );
    }
  }
  lines.push("");

  const sessionIds = sessions.map((s) => s.session_id);
  const auditEntries = sessionIds.length > 0
    ? (db
        .prepare(
          `SELECT ae.*, s.started_at as session_date
           FROM audit_entries ae
           JOIN sessions s ON ae.session_id = s.session_id
           WHERE ae.session_id IN (${sessionIds.map(() => "?").join(",")})
           ORDER BY ae.timestamp DESC
           LIMIT 20`,
        )
        .all(...sessionIds) as Array<{
        id: string;
        session_id: string;
        timestamp: string;
        action: string;
        memory_item_id: string;
        reason: string;
        token_cost: number | null;
        session_date: string;
      }>)
    : [];

  lines.push("## Recent Decisions");
  if (auditEntries.length > 0) {
    lines.push("| Time | Action | Item | Reason | Tokens |");
    lines.push("|------|--------|------|--------|--------|");
    for (const entry of auditEntries) {
      const time = entry.timestamp.split("T")[1]?.split(".")[0] ?? "";
      const itemContent = getItemContentPreview(db, entry.memory_item_id);
      const tokens = entry.token_cost ?? "-";
      lines.push(
        `| ${time} | ${entry.action} | ${itemContent} | ${entry.reason} | ${tokens} |`,
      );
    }
  } else {
    lines.push("_(no audit entries — decisions are recorded during compaction events)_");
  }
  lines.push("");

  const conflicts = db
    .prepare(
      `SELECT cr.*, mi.content, mi.category
       FROM conflict_records cr
       LEFT JOIN memory_items mi ON cr.memory_item_id = mi.id
       WHERE mi.project_dir = ?
       ORDER BY cr.detected_at DESC
       LIMIT 10`,
    )
    .all(projectDir) as Array<{
    id: string;
    memory_item_id: string;
    conflict_source: string;
    conflict_source_path: string | null;
    description: string;
    resolution: string;
    detected_at: string;
    content: string | null;
    category: string | null;
  }>;

  if (conflicts.length > 0) {
    lines.push("## Conflicts Detected");
    lines.push("| Resolution | Category | Item | Source | Detected |");
    lines.push("|------------|----------|------|--------|----------|");
    for (const c of conflicts) {
      const preview = c.content
        ? c.content.length > 50
          ? c.content.slice(0, 47) + "..."
          : c.content
        : `[${c.memory_item_id.slice(0, 8)}]`;
      const source = c.conflict_source_path
        ? `${c.conflict_source} (${c.conflict_source_path})`
        : c.conflict_source;
      const detected = c.detected_at.split("T")[0];
      lines.push(
        `| ${c.resolution} | ${c.category ?? "-"} | ${preview} | ${source} | ${detected} |`,
      );
    }
  } else {
    lines.push("## Conflicts Detected");
    lines.push("_(none)_");
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
