import type Database from "better-sqlite3";
import type { ActiveInstructionFile } from "../types.js";

export function recordInstructionFile(
  db: Database.Database,
  file: ActiveInstructionFile,
): void {
  db.prepare(
    `INSERT INTO active_instruction_files (session_id, file_path, memory_type, load_reason, loaded_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    file.session_id,
    file.file_path,
    file.memory_type,
    file.load_reason,
    file.loaded_at,
  );
}

export function getInstructionFilesForSession(
  db: Database.Database,
  sessionId: string,
): ActiveInstructionFile[] {
  return db
    .prepare(
      "SELECT * FROM active_instruction_files WHERE session_id = ?",
    )
    .all(sessionId) as ActiveInstructionFile[];
}

export function getDistinctInstructionPaths(
  db: Database.Database,
  sessionId: string,
): string[] {
  const rows = db
    .prepare(
      "SELECT DISTINCT file_path FROM active_instruction_files WHERE session_id = ?",
    )
    .all(sessionId) as Array<{ file_path: string }>;

  return rows.map((r) => r.file_path);
}
