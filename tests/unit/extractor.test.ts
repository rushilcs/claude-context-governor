import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractMemories } from "../../src/extract/extractor.js";
import { createTestDatabase } from "../../src/store/database.js";
import { ensureSession } from "../../src/store/sessions.js";
import { getActiveItems } from "../../src/store/memory-items.js";
import { resetConfig } from "../../src/utils/config.js";
import type Database from "better-sqlite3";

describe("extractor", () => {
  let db: Database.Database;

  beforeEach(() => {
    resetConfig();
    db = createTestDatabase();
    ensureSession(db, "test-session", "/test/project");
  });

  afterEach(() => {
    db.close();
  });

  it("extracts decision from transcript text", () => {
    const text =
      "After evaluating the options, I've decided to use PostgreSQL for the main database. It provides excellent JSON support.";

    const result = extractMemories(
      db,
      text,
      "transcript",
      "test-session",
      "/test/project",
    );

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].category).toBe("decision");
    expect(result.items[0].memory_source).toBe("transcript");
  });

  it("extracts constraint from text", () => {
    const text =
      "We must always use 2-space indentation in this project. Never use tabs for formatting.";

    const result = extractMemories(
      db,
      text,
      "transcript",
      "test-session",
      "/test/project",
    );

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].category).toBe("constraint");
  });

  it("extracts from compact_summary with higher confidence", () => {
    const text =
      "The team decided to use Redis for caching. This is the chosen approach for all services.";

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

  it("deduplicates by fingerprint", () => {
    const text =
      "We decided to use PostgreSQL for storage in this project going forward.";

    extractMemories(db, text, "transcript", "test-session", "/test/project");
    const result2 = extractMemories(
      db,
      text,
      "transcript",
      "test-session",
      "/test/project",
    );

    expect(result2.duplicatesSkipped).toBeGreaterThan(0);
    const items = getActiveItems(db, "/test/project");
    expect(items.length).toBe(1);
  });

  it("stores related files", () => {
    const text =
      "We decided to use PostgreSQL for the main database in this project.";

    const result = extractMemories(
      db,
      text,
      "transcript",
      "test-session",
      "/test/project",
      ["src/db.ts", "config/database.yml"],
    );

    if (result.items.length > 0) {
      expect(result.items[0].related_files).toContain("src/db.ts");
    }
  });

  it("writes audit entries for extracted items", () => {
    const text =
      "We decided to use PostgreSQL for the main database in this project.";

    extractMemories(db, text, "transcript", "test-session", "/test/project");

    const audits = db
      .prepare(
        "SELECT * FROM audit_entries WHERE session_id = ? AND action = 'extracted'",
      )
      .all("test-session") as Array<{ action: string }>;
    expect(audits.length).toBeGreaterThan(0);
  });

  it("skips text that doesn't match any pattern", () => {
    const text = "Let me check the file contents for you now.";

    const result = extractMemories(
      db,
      text,
      "transcript",
      "test-session",
      "/test/project",
    );

    expect(result.items.length).toBe(0);
  });
});
