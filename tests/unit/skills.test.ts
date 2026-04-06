import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createTestDatabase } from "../../src/store/database.js";
import { ensureSession } from "../../src/store/sessions.js";
import { insertMemoryItem } from "../../src/store/memory-items.js";
import { computeFingerprint } from "../../src/extract/fingerprint.js";
import type { MemoryItem } from "../../src/types.js";
import type Database from "better-sqlite3";

const DIST = join(import.meta.dirname, "..", "..", "dist");

function makeItem(
  db: Database.Database,
  overrides: Partial<MemoryItem> = {},
): MemoryItem {
  const now = new Date().toISOString();
  const content = overrides.content ?? "Use PostgreSQL for the database";
  const category = overrides.category ?? "decision";
  const item: MemoryItem = {
    id: overrides.id ?? crypto.randomUUID(),
    category,
    content,
    rationale: "test",
    memory_source: "transcript",
    source_session_id: "test-session",
    created_at: now,
    confidence: 0.8,
    last_verified: now,
    related_files: [],
    tags: [],
    status: "active",
    pinned: false,
    dismissed_at: null,
    fingerprint: computeFingerprint(content, category),
    superseded_by: null,
    token_estimate: 20,
    branch: null,
    project_dir: "/test/project",
    ...overrides,
  };
  insertMemoryItem(db, item);
  return item;
}

function runSkill(
  script: string,
  args: string[],
  dbPath: string,
): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync("node", [join(DIST, script), ...args], {
      encoding: "utf-8",
      env: { ...process.env, CLAUDE_PLUGIN_DATA: dbPath },
      timeout: 5000,
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

describe("skill argv parsing", () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    db = createTestDatabase();
    dbPath = ":memory:";
  });

  afterEach(() => {
    db.close();
  });

  describe("memory-status", () => {
    it("runs without args (uses cwd as project-dir)", () => {
      const { stdout, exitCode } = runSkill("skills/memory-status.js", [], dbPath);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Memory Governor Status");
    });
  });

  describe("memory-search", () => {
    it("runs without args (lists all items)", () => {
      const { stdout, exitCode } = runSkill("skills/memory-search.js", [], dbPath);
      expect(exitCode).toBe(0);
    });

    it("accepts a query argument", () => {
      const { stdout, exitCode } = runSkill("skills/memory-search.js", ["PostgreSQL"], dbPath);
      expect(exitCode).toBe(0);
    });
  });

  describe("memory-audit", () => {
    it("runs without args (project-wide report)", () => {
      const { stdout, exitCode } = runSkill("skills/memory-audit.js", [], dbPath);
      expect(exitCode).toBe(0);
    });
  });

  describe("memory-manage", () => {
    it("prints usage when missing action and item-id", () => {
      const { stdout, exitCode } = runSkill(
        "skills/memory-manage.js",
        [],
        dbPath,
      );
      expect(exitCode).toBe(1);
      expect(stdout).toContain("Usage:");
    });

    it("prints usage when missing item-id", () => {
      const { stdout, exitCode } = runSkill(
        "skills/memory-manage.js",
        ["pin"],
        dbPath,
      );
      expect(exitCode).toBe(1);
      expect(stdout).toContain("Usage:");
    });

    it("prints item-not-found for nonexistent item", () => {
      const { stdout, exitCode } = runSkill(
        "skills/memory-manage.js",
        ["pin", "nonexistent-id"],
        dbPath,
      );
      expect(exitCode).toBe(1);
      expect(stdout).toContain("Item not found");
    });
  });
});
