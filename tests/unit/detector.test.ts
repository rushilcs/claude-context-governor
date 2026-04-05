import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { checkConflictsAgainstFragments } from "../../src/conflict/detector.js";
import { parseInstructionText } from "../../src/conflict/instruction-parser.js";
import { createTestDatabase } from "../../src/store/database.js";
import { ensureSession } from "../../src/store/sessions.js";
import { insertMemoryItem } from "../../src/store/memory-items.js";
import type { MemoryItem } from "../../src/types.js";
import type Database from "better-sqlite3";

function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    category: "convention",
    content: "Use tabs for indentation",
    rationale: "test",
    memory_source: "transcript",
    source_session_id: "test-session",
    created_at: now,
    confidence: 0.7,
    last_verified: now,
    related_files: [],
    tags: [],
    status: "active",
    pinned: false,
    dismissed_at: null,
    fingerprint: "abc123",
    superseded_by: null,
    token_estimate: 10,
    branch: null,
    project_dir: "/test/project",
    ...overrides,
  };
}

describe("conflict detector", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
    ensureSession(db, "test-session", "/test/project");
  });

  afterEach(() => {
    db.close();
  });

  it("detects polarity conflict: tabs vs spaces", () => {
    const item = makeItem({ content: "Use tabs for indentation in all files" });
    insertMemoryItem(db, item);

    const fragments = parseInstructionText(
      "Always use spaces for indentation, never tabs",
      "/project/CLAUDE.md",
      "claude-md",
    );

    const result = checkConflictsAgainstFragments(
      db,
      item,
      "test-session",
      fragments,
    );

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.rejected).toBe(true);
  });

  it("detects value conflict: MySQL vs PostgreSQL", () => {
    const item = makeItem({
      category: "decision",
      content: "We decided to use MySQL for the database",
    });
    insertMemoryItem(db, item);

    const fragments = parseInstructionText(
      "Use PostgreSQL for data storage",
      "/project/CLAUDE.md",
      "claude-md",
    );

    const result = checkConflictsAgainstFragments(
      db,
      item,
      "test-session",
      fragments,
    );

    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("does not flag non-conflicting items", () => {
    const item = makeItem({
      category: "decision",
      content: "We decided to add a caching layer using Redis for better performance",
    });
    insertMemoryItem(db, item);

    const fragments = parseInstructionText(
      "Always use spaces for indentation",
      "/project/CLAUDE.md",
      "claude-md",
    );

    const result = checkConflictsAgainstFragments(
      db,
      item,
      "test-session",
      fragments,
    );

    expect(result.conflicts.length).toBe(0);
    expect(result.rejected).toBe(false);
  });

  it("writes conflict records to database", () => {
    const item = makeItem({ content: "Use tabs for indentation in all files" });
    insertMemoryItem(db, item);

    const fragments = parseInstructionText(
      "Always use spaces for indentation, never tabs",
      "/project/CLAUDE.md",
      "claude-md",
    );

    checkConflictsAgainstFragments(db, item, "test-session", fragments);

    const records = db
      .prepare("SELECT * FROM conflict_records WHERE memory_item_id = ?")
      .all(item.id) as Array<{ id: string }>;

    expect(records.length).toBeGreaterThan(0);
  });

  it("logs audit entries for conflicts", () => {
    const item = makeItem({ content: "Use tabs for indentation in all files" });
    insertMemoryItem(db, item);

    const fragments = parseInstructionText(
      "Always use spaces for indentation, never tabs",
      "/project/CLAUDE.md",
      "claude-md",
    );

    checkConflictsAgainstFragments(db, item, "test-session", fragments);

    const audits = db
      .prepare(
        "SELECT * FROM audit_entries WHERE memory_item_id = ? AND action = 'conflict-detected'",
      )
      .all(item.id) as Array<{ action: string }>;

    expect(audits.length).toBeGreaterThan(0);
  });
});
