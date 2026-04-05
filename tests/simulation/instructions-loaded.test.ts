import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "../../src/store/database.js";
import { ensureSession } from "../../src/store/sessions.js";
import {
  recordInstructionFile,
  getInstructionFilesForSession,
  getDistinctInstructionPaths,
} from "../../src/store/instruction-files.js";
import type Database from "better-sqlite3";

describe("InstructionsLoaded simulation", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
    ensureSession(db, "test-session", "/test/project");
  });

  afterEach(() => {
    db.close();
  });

  it("records instruction file from hook input", () => {
    recordInstructionFile(db, {
      session_id: "test-session",
      file_path: "/test/project/CLAUDE.md",
      memory_type: "Project",
      load_reason: "session_start",
      loaded_at: new Date().toISOString(),
    });

    const files = getInstructionFilesForSession(db, "test-session");
    expect(files.length).toBe(1);
    expect(files[0].file_path).toBe("/test/project/CLAUDE.md");
  });

  it("records multiple instruction files", () => {
    recordInstructionFile(db, {
      session_id: "test-session",
      file_path: "/test/project/CLAUDE.md",
      memory_type: "Project",
      load_reason: "session_start",
      loaded_at: new Date().toISOString(),
    });
    recordInstructionFile(db, {
      session_id: "test-session",
      file_path: "/test/project/.claude/rules/style.md",
      memory_type: "Local",
      load_reason: "path_glob_match",
      loaded_at: new Date().toISOString(),
    });

    const files = getInstructionFilesForSession(db, "test-session");
    expect(files.length).toBe(2);
  });

  it("returns distinct paths", () => {
    recordInstructionFile(db, {
      session_id: "test-session",
      file_path: "/test/project/CLAUDE.md",
      memory_type: "Project",
      load_reason: "session_start",
      loaded_at: new Date().toISOString(),
    });
    recordInstructionFile(db, {
      session_id: "test-session",
      file_path: "/test/project/CLAUDE.md",
      memory_type: "Project",
      load_reason: "compact",
      loaded_at: new Date().toISOString(),
    });

    const paths = getDistinctInstructionPaths(db, "test-session");
    expect(paths.length).toBe(1);
  });
});
