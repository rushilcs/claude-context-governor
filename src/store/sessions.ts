import type Database from "better-sqlite3";
import type { SessionRecord } from "../types.js";

export function ensureSession(
  db: Database.Database,
  sessionId: string,
  projectDir: string,
): void {
  const existing = db
    .prepare("SELECT session_id FROM sessions WHERE session_id = ?")
    .get(sessionId) as { session_id: string } | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO sessions (session_id, started_at, project_dir)
       VALUES (?, ?, ?)`,
    ).run(sessionId, new Date().toISOString(), projectDir);
  }
}

export function getSession(
  db: Database.Database,
  sessionId: string,
): SessionRecord | undefined {
  return db
    .prepare("SELECT * FROM sessions WHERE session_id = ?")
    .get(sessionId) as SessionRecord | undefined;
}

export function finalizeSession(
  db: Database.Database,
  sessionId: string,
): void {
  db.prepare(
    "UPDATE sessions SET ended_at = ? WHERE session_id = ?",
  ).run(new Date().toISOString(), sessionId);
}

export function incrementCompactionCount(
  db: Database.Database,
  sessionId: string,
): void {
  db.prepare(
    "UPDATE sessions SET compaction_count = compaction_count + 1 WHERE session_id = ?",
  ).run(sessionId);
}

export function updateCompactSummary(
  db: Database.Database,
  sessionId: string,
  summary: string,
): void {
  db.prepare(
    "UPDATE sessions SET last_compact_summary = ? WHERE session_id = ?",
  ).run(summary, sessionId);
}

export function incrementExtracted(
  db: Database.Database,
  sessionId: string,
  count: number,
): void {
  db.prepare(
    "UPDATE sessions SET items_extracted = items_extracted + ? WHERE session_id = ?",
  ).run(count, sessionId);
}

export function incrementRestored(
  db: Database.Database,
  sessionId: string,
  count: number,
): void {
  db.prepare(
    "UPDATE sessions SET items_restored = items_restored + ? WHERE session_id = ?",
  ).run(count, sessionId);
}
