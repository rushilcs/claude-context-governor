import type Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type { AuditAction } from "../types.js";

export function logAudit(
  db: Database.Database,
  sessionId: string,
  action: AuditAction,
  memoryItemId: string,
  reason: string,
  tokenCost?: number,
): void {
  const stmt = db.prepare(`
    INSERT INTO audit_entries (id, session_id, timestamp, action, memory_item_id, reason, token_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    uuidv4(),
    sessionId,
    new Date().toISOString(),
    action,
    memoryItemId,
    reason,
    tokenCost ?? null,
  );
}
