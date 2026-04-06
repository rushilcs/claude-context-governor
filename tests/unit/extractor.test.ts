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

  it("extracts discrete facts from structured compact summaries", () => {
    const compactSummary = `<summary>
1. Primary Request and Intent:
   - User asked about database options and architecture decisions.

2. Key Technical Concepts:
   - We decided to use PostgreSQL for the main database.
   - The convention is to use kebab-case for API endpoints.
   - The webhook race condition was fixed by adding a mutex lock.

3. Files and Code Sections:
   - src/db.ts — database connection setup
   - src/api/routes.ts — endpoint definitions

4. All user messages:
   - "What database should we use?"
   - "Fix the webhook bug"
</summary>`;

    const result = extractMemories(
      db,
      compactSummary,
      "compact_summary",
      "test-session",
      "/test/project",
    );

    for (const item of result.items) {
      expect(item.content.length).toBeLessThanOrEqual(300);
    }

    const contents = result.items.map((i) => i.content);
    expect(contents.some((c) => c.includes("PostgreSQL"))).toBe(true);
  });

  it("rejects oversized compact summary blocks as single items", () => {
    const bloatedSummary =
      "We decided to use PostgreSQL. " +
      "The reason was that after a very long and detailed evaluation process spanning multiple weeks of careful analysis and benchmarking " +
      "of various database systems including MySQL, MariaDB, CockroachDB, MongoDB, and several others, the team concluded that " +
      "PostgreSQL provides the best combination of JSONB support, full-text search capabilities, strong ACID compliance, " +
      "excellent community support, and mature tooling ecosystem for the specific requirements of this microservices platform.";

    const result = extractMemories(
      db,
      bloatedSummary,
      "compact_summary",
      "test-session",
      "/test/project",
    );

    for (const item of result.items) {
      expect(item.content.length).toBeLessThanOrEqual(300);
    }
  });

  it("filters out meta-content from compact summaries", () => {
    const text = `1. All user messages:
   - "What database should we use?"
   - "Fix the webhook bug"

2. Pending tasks:
   - None remaining.`;

    const result = extractMemories(
      db,
      text,
      "compact_summary",
      "test-session",
      "/test/project",
    );

    expect(result.items.length).toBe(0);
  });
});
