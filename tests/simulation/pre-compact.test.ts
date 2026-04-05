import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "../../src/store/database.js";
import { ensureSession } from "../../src/store/sessions.js";
import { extractMemories } from "../../src/extract/extractor.js";
import { resetConfig } from "../../src/utils/config.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTranscriptText, extractAssistantMessages } from "../../src/utils/transcript.js";
import type Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("PreCompact simulation", () => {
  let db: Database.Database;

  beforeEach(() => {
    resetConfig();
    db = createTestDatabase();
    ensureSession(db, "test-session", "/test/project");
  });

  afterEach(() => {
    db.close();
  });

  it("extracts memories from sample transcript fixture", () => {
    const transcriptPath = join(
      __dirname,
      "..",
      "fixtures",
      "transcripts",
      "sample-session.jsonl",
    );
    const raw = readFileSync(transcriptPath, "utf-8");
    const messages = parseTranscriptText(raw);
    const assistantText = extractAssistantMessages(messages).join("\n\n");

    const result = extractMemories(
      db,
      assistantText,
      "transcript",
      "test-session",
      "/test/project",
    );

    expect(result.items.length).toBeGreaterThan(0);

    const categories = result.items.map((i) => i.category);
    expect(
      categories.some(
        (c) =>
          c === "decision" ||
          c === "constraint" ||
          c === "convention" ||
          c === "bug-lesson",
      ),
    ).toBe(true);
  });

  it("stores items in SQLite after extraction", () => {
    extractMemories(
      db,
      "We decided to use PostgreSQL for the main database in this project.",
      "transcript",
      "test-session",
      "/test/project",
    );

    const items = db
      .prepare("SELECT * FROM memory_items WHERE source_session_id = ?")
      .all("test-session") as Array<{ id: string }>;

    expect(items.length).toBeGreaterThan(0);
  });

  it("updates session extraction count", () => {
    extractMemories(
      db,
      "We decided to use PostgreSQL for the main database in this project.",
      "transcript",
      "test-session",
      "/test/project",
    );

    const session = db
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .get("test-session") as { items_extracted: number };

    expect(session.items_extracted).toBeGreaterThan(0);
  });
});
