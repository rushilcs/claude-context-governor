import type Database from "better-sqlite3";
import type { MemoryItem, MemoryItemRow } from "../types.js";

export function rowToMemoryItem(row: MemoryItemRow): MemoryItem {
  return {
    ...row,
    category: row.category as MemoryItem["category"],
    memory_source: row.memory_source as MemoryItem["memory_source"],
    status: row.status as MemoryItem["status"],
    related_files: JSON.parse(row.related_files),
    tags: JSON.parse(row.tags),
    pinned: row.pinned === 1,
  };
}

export function insertMemoryItem(
  db: Database.Database,
  item: MemoryItem,
): void {
  db.prepare(`
    INSERT INTO memory_items
      (id, category, content, rationale, memory_source, source_session_id,
       created_at, confidence, last_verified, related_files, tags, status,
       pinned, dismissed_at, fingerprint, superseded_by, token_estimate,
       branch, project_dir)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.category,
    item.content,
    item.rationale,
    item.memory_source,
    item.source_session_id,
    item.created_at,
    item.confidence,
    item.last_verified,
    JSON.stringify(item.related_files),
    JSON.stringify(item.tags),
    item.status,
    item.pinned ? 1 : 0,
    item.dismissed_at,
    item.fingerprint,
    item.superseded_by,
    item.token_estimate,
    item.branch,
    item.project_dir,
  );
}

export function getActiveItems(
  db: Database.Database,
  projectDir: string,
): MemoryItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM memory_items
       WHERE project_dir = ? AND status = 'active'
       ORDER BY created_at DESC`,
    )
    .all(projectDir) as MemoryItemRow[];

  return rows.map(rowToMemoryItem);
}

export function getPinnedItems(
  db: Database.Database,
  projectDir: string,
): MemoryItem[] {
  const rows = db
    .prepare(
      `SELECT * FROM memory_items
       WHERE project_dir = ? AND pinned = 1 AND status IN ('active', 'dismissed')
       ORDER BY created_at DESC`,
    )
    .all(projectDir) as MemoryItemRow[];

  return rows.map(rowToMemoryItem);
}

export function findByFingerprint(
  db: Database.Database,
  fingerprint: string,
  projectDir: string,
): MemoryItem | undefined {
  const row = db
    .prepare(
      `SELECT * FROM memory_items
       WHERE fingerprint = ? AND project_dir = ? AND status = 'active'
       LIMIT 1`,
    )
    .get(fingerprint, projectDir) as MemoryItemRow | undefined;

  return row ? rowToMemoryItem(row) : undefined;
}

export function supersedeItem(
  db: Database.Database,
  oldId: string,
  newId: string,
): void {
  db.prepare(
    "UPDATE memory_items SET status = 'superseded', superseded_by = ? WHERE id = ?",
  ).run(newId, oldId);
}

export function updateItemStatus(
  db: Database.Database,
  itemId: string,
  status: string,
): void {
  db.prepare("UPDATE memory_items SET status = ? WHERE id = ?").run(
    status,
    itemId,
  );
}

export function pinItem(db: Database.Database, itemId: string): void {
  db.prepare(
    "UPDATE memory_items SET pinned = 1, status = 'active', dismissed_at = NULL WHERE id = ?",
  ).run(itemId);
}

export function dismissItem(db: Database.Database, itemId: string): void {
  db.prepare(
    "UPDATE memory_items SET status = 'dismissed', dismissed_at = ? WHERE id = ?",
  ).run(new Date().toISOString(), itemId);
}

export function reviveItem(db: Database.Database, itemId: string): void {
  db.prepare(
    "UPDATE memory_items SET status = 'active', dismissed_at = NULL WHERE id = ?",
  ).run(itemId);
}

export function getItemById(
  db: Database.Database,
  itemId: string,
): MemoryItem | undefined {
  const row = db
    .prepare("SELECT * FROM memory_items WHERE id = ?")
    .get(itemId) as MemoryItemRow | undefined;

  return row ? rowToMemoryItem(row) : undefined;
}

export function searchItems(
  db: Database.Database,
  projectDir: string,
  opts: {
    category?: string;
    keyword?: string;
    status?: string;
    limit?: number;
  } = {},
): MemoryItem[] {
  let sql = "SELECT * FROM memory_items WHERE project_dir = ?";
  const params: unknown[] = [projectDir];

  if (opts.category) {
    sql += " AND category = ?";
    params.push(opts.category);
  }
  if (opts.status) {
    sql += " AND status = ?";
    params.push(opts.status);
  }
  if (opts.keyword) {
    sql += " AND content LIKE ?";
    params.push(`%${opts.keyword}%`);
  }

  sql += " ORDER BY created_at DESC";

  if (opts.limit) {
    sql += " LIMIT ?";
    params.push(opts.limit);
  }

  const rows = db.prepare(sql).all(...params) as MemoryItemRow[];
  return rows.map(rowToMemoryItem);
}

export function getItemCounts(
  db: Database.Database,
  projectDir: string,
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT status, COUNT(*) as count FROM memory_items
       WHERE project_dir = ?
       GROUP BY status`,
    )
    .all(projectDir) as Array<{ status: string; count: number }>;

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = row.count;
  }
  return counts;
}

export function getCategoryCounts(
  db: Database.Database,
  projectDir: string,
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT category, COUNT(*) as count FROM memory_items
       WHERE project_dir = ? AND status = 'active'
       GROUP BY category`,
    )
    .all(projectDir) as Array<{ category: string; count: number }>;

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.category] = row.count;
  }
  return counts;
}

export function expireStaleItems(
  db: Database.Database,
  projectDir: string,
  olderThanDays: number,
): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = db
    .prepare(
      `UPDATE memory_items SET status = 'expired'
       WHERE project_dir = ? AND status = 'active' AND pinned = 0
       AND last_verified < ?`,
    )
    .run(projectDir, cutoff.toISOString());

  return result.changes;
}
