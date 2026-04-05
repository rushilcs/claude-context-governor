import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { createTestDatabase } from "../../src/store/database.js";
import { ensureSession } from "../../src/store/sessions.js";
import { insertMemoryItem } from "../../src/store/memory-items.js";
import { selectForRestore } from "../../src/restore/selector.js";
import { serializeForContext } from "../../src/restore/serializer.js";
import { resetConfig } from "../../src/utils/config.js";
import type { MemoryItem } from "../../src/types.js";
import type Database from "better-sqlite3";

function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    category: "decision",
    content: "Use PostgreSQL for the database",
    rationale: "Evaluated options",
    memory_source: "transcript",
    source_session_id: "prev-session",
    created_at: now,
    confidence: 0.8,
    last_verified: now,
    related_files: [],
    tags: [],
    status: "active",
    pinned: false,
    dismissed_at: null,
    fingerprint: uuidv4(),
    superseded_by: null,
    token_estimate: 20,
    branch: null,
    project_dir: "/test/project",
    ...overrides,
  };
}

describe("SessionStart simulation", () => {
  let db: Database.Database;

  beforeEach(() => {
    resetConfig();
    db = createTestDatabase();
    ensureSession(db, "prev-session", "/test/project");
    ensureSession(db, "new-session", "/test/project");
  });

  afterEach(() => {
    db.close();
  });

  it("restores active items within token budget", () => {
    insertMemoryItem(db, makeItem());
    insertMemoryItem(
      db,
      makeItem({
        id: uuidv4(),
        category: "constraint",
        content: "Never use tabs in this project",
        fingerprint: uuidv4(),
      }),
    );

    const selection = selectForRestore(db, "/test/project", "new-session");
    const context = serializeForContext(selection);

    expect(selection.selected.length).toBe(2);
    expect(context).toContain("Restored Memory");
    expect(context).toContain("PostgreSQL");
    expect(context).toContain("tabs");
  });

  it("respects token budget by skipping low-score items", () => {
    // Create many items that exceed budget
    for (let i = 0; i < 50; i++) {
      insertMemoryItem(
        db,
        makeItem({
          id: uuidv4(),
          content: `Decision number ${i}: ${"x".repeat(200)}`,
          fingerprint: uuidv4(),
          token_estimate: 100,
        }),
      );
    }

    const selection = selectForRestore(db, "/test/project", "new-session");

    expect(selection.selected.length).toBeLessThan(50);
    expect(selection.skipped.length).toBeGreaterThan(0);
    expect(selection.budgetUsed).toBeLessThanOrEqual(selection.budgetTotal);
  });

  it("pinned items always included first", () => {
    insertMemoryItem(
      db,
      makeItem({
        pinned: true,
        confidence: 0.3,
        content: "Pinned: never delete user data",
        fingerprint: uuidv4(),
      }),
    );
    insertMemoryItem(
      db,
      makeItem({
        id: uuidv4(),
        confidence: 0.95,
        content: "High confidence unpinned item",
        fingerprint: uuidv4(),
      }),
    );

    const selection = selectForRestore(db, "/test/project", "new-session");
    expect(selection.selected.length).toBe(2);

    const context = serializeForContext(selection);
    expect(context).toContain("pinned");
  });

  it("returns empty context when no items exist", () => {
    const selection = selectForRestore(db, "/test/project", "new-session");
    const context = serializeForContext(selection);

    expect(selection.selected.length).toBe(0);
    expect(context).toBe("");
  });

  it("excludes dismissed items from restore", () => {
    insertMemoryItem(
      db,
      makeItem({
        status: "dismissed",
        dismissed_at: new Date().toISOString(),
        content: "This was dismissed",
        fingerprint: uuidv4(),
      }),
    );

    const selection = selectForRestore(db, "/test/project", "new-session");
    expect(selection.selected.length).toBe(0);
  });

  it("logs audit entries for load/skip decisions", () => {
    insertMemoryItem(db, makeItem());

    selectForRestore(db, "/test/project", "new-session");

    const audits = db
      .prepare(
        "SELECT * FROM audit_entries WHERE session_id = 'new-session'",
      )
      .all() as Array<{ action: string }>;

    expect(audits.length).toBeGreaterThan(0);
    expect(audits.some((a) => a.action === "loaded")).toBe(true);
  });
});
