import { describe, it, expect, beforeEach } from "vitest";
import { serializeForContext } from "../../src/restore/serializer.js";
import { resetConfig } from "../../src/utils/config.js";
import type { SelectionResult } from "../../src/restore/selector.js";
import type { ScoredItem } from "../../src/restore/scorer.js";
import type { MemoryItem } from "../../src/types.js";

function makeScoredItem(overrides: Partial<MemoryItem> = {}): ScoredItem {
  return {
    item: {
      id: "test-1",
      category: "decision",
      content: "Use PostgreSQL for storage",
      rationale: "test",
      memory_source: "transcript",
      source_session_id: "s1",
      created_at: "2026-04-03T10:00:00.000Z",
      confidence: 0.9,
      last_verified: "2026-04-03T10:00:00.000Z",
      related_files: [],
      tags: [],
      status: "active",
      pinned: false,
      dismissed_at: null,
      fingerprint: "abc",
      superseded_by: null,
      token_estimate: 20,
      branch: null,
      project_dir: "/test",
      ...overrides,
    },
    score: 0.85,
    breakdown: {
      recency: 0.9,
      confidence: 0.9,
      categoryPriority: 1.0,
      fileRelevance: 0.3,
    },
  };
}

describe("serializer", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("produces empty string when no items selected", () => {
    const result: SelectionResult = {
      selected: [],
      skipped: [],
      rejected: [],
      totalTokens: 0,
      budgetUsed: 0,
      budgetTotal: 2000,
    };
    expect(serializeForContext(result)).toBe("");
  });

  it("includes header with counts", () => {
    const result: SelectionResult = {
      selected: [makeScoredItem()],
      skipped: [makeScoredItem({ id: "skip-1" })],
      rejected: [],
      totalTokens: 20,
      budgetUsed: 20,
      budgetTotal: 2000,
    };

    const output = serializeForContext(result);
    expect(output).toContain("Restored Memory");
    expect(output).toContain("1 loaded | 1 skipped");
    expect(output).toContain("20/2000 tokens");
  });

  it("groups items by category", () => {
    const result: SelectionResult = {
      selected: [
        makeScoredItem({ category: "decision" }),
        makeScoredItem({
          id: "test-2",
          category: "constraint",
          content: "Never use tabs",
        }),
      ],
      skipped: [],
      rejected: [],
      totalTokens: 40,
      budgetUsed: 40,
      budgetTotal: 2000,
    };

    const output = serializeForContext(result);
    expect(output).toContain("### Decisions");
    expect(output).toContain("### Constraints");
  });

  it("shows pinned label for pinned items", () => {
    const result: SelectionResult = {
      selected: [makeScoredItem({ pinned: true })],
      skipped: [],
      rejected: [],
      totalTokens: 20,
      budgetUsed: 20,
      budgetTotal: 2000,
    };

    const output = serializeForContext(result);
    expect(output).toContain("pinned");
  });

  it("shows source for non-transcript items", () => {
    const result: SelectionResult = {
      selected: [makeScoredItem({ memory_source: "compact_summary" })],
      skipped: [],
      rejected: [],
      totalTokens: 20,
      budgetUsed: 20,
      budgetTotal: 2000,
    };

    const output = serializeForContext(result);
    expect(output).toContain("source: compact_summary");
  });

  it("includes corrections section for rejected items", () => {
    const result: SelectionResult = {
      selected: [makeScoredItem()],
      skipped: [],
      rejected: [
        {
          item: {
            ...makeScoredItem({ content: "Use tabs for indentation", status: "rejected" }).item,
          },
          conflictDescription: 'value conflict: "Use tabs" vs "Use 2-space indentation"',
          conflictSourcePath: "CLAUDE.md",
        },
      ],
      totalTokens: 20,
      budgetUsed: 20,
      budgetTotal: 2000,
    };

    const output = serializeForContext(result);
    expect(output).toContain("Corrections (governance overrides)");
    expect(output).toContain("REJECTED");
    expect(output).toContain("Use tabs for indentation");
    expect(output).toContain("CLAUDE.md");
  });

  it("shows corrections even when no items are selected", () => {
    const result: SelectionResult = {
      selected: [],
      skipped: [],
      rejected: [
        {
          item: {
            ...makeScoredItem({ content: "Use MySQL", status: "rejected" }).item,
          },
          conflictDescription: "value conflict",
          conflictSourcePath: "CLAUDE.md",
        },
      ],
      totalTokens: 0,
      budgetUsed: 0,
      budgetTotal: 2000,
    };

    const output = serializeForContext(result);
    expect(output).toContain("Corrections (governance overrides)");
    expect(output).toContain("Use MySQL");
  });
});
