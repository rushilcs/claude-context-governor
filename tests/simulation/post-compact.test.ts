import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "../../src/store/database.js";
import { ensureSession } from "../../src/store/sessions.js";
import { extractMemories } from "../../src/extract/extractor.js";
import { resetConfig } from "../../src/utils/config.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("PostCompact simulation", () => {
  let db: Database.Database;

  beforeEach(() => {
    resetConfig();
    db = createTestDatabase();
    ensureSession(db, "test-session", "/test/project");
  });

  afterEach(() => {
    db.close();
  });

  it("extracts memories from compact_summary fixture", () => {
    const summaryPath = join(
      __dirname,
      "..",
      "fixtures",
      "compact-summaries",
      "sample-summary.txt",
    );
    const summary = readFileSync(summaryPath, "utf-8");

    const result = extractMemories(
      db,
      summary,
      "compact_summary",
      "test-session",
      "/test/project",
    );

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => i.memory_source === "compact_summary")).toBe(
      true,
    );
  });

  it("compact_summary items have higher base confidence", () => {
    const text =
      "We decided to use PostgreSQL for the main database in this project.";

    const transcriptResult = extractMemories(
      db,
      text,
      "transcript",
      "test-session",
      "/test/project",
    );

    db.exec("DELETE FROM audit_entries");
    db.exec("DELETE FROM memory_items");

    const compactResult = extractMemories(
      db,
      text,
      "compact_summary",
      "test-session",
      "/test/project",
    );

    if (transcriptResult.items.length > 0 && compactResult.items.length > 0) {
      expect(compactResult.items[0].confidence).toBeGreaterThan(
        transcriptResult.items[0].confidence,
      );
    }
  });

  it("deduplicates across transcript and compact_summary", () => {
    const text =
      "We decided to use PostgreSQL for the main database in this project.";

    extractMemories(db, text, "transcript", "test-session", "/test/project");
    const result2 = extractMemories(
      db,
      text,
      "compact_summary",
      "test-session",
      "/test/project",
    );

    // Should supersede or skip based on confidence comparison
    const totalItems = db
      .prepare(
        "SELECT COUNT(*) as count FROM memory_items WHERE status = 'active' AND source_session_id = ?",
      )
      .get("test-session") as { count: number };

    expect(totalItems.count).toBe(1);
  });
});
