import { describe, it, expect, beforeEach } from "vitest";
import { scoreItem } from "../../src/restore/scorer.js";
import { resetConfig } from "../../src/utils/config.js";
import type { MemoryItem } from "../../src/types.js";

function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: "test-1",
    category: "decision",
    content: "Use PostgreSQL",
    rationale: "test",
    memory_source: "transcript",
    source_session_id: "s1",
    created_at: new Date().toISOString(),
    confidence: 0.8,
    last_verified: new Date().toISOString(),
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
  };
}

describe("scorer", () => {
  beforeEach(() => {
    resetConfig();
  });

  it("scores recent items higher than old items", () => {
    const recent = scoreItem(makeItem({ created_at: new Date().toISOString() }));
    const old = scoreItem(
      makeItem({
        created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    );
    expect(recent.score).toBeGreaterThan(old.score);
  });

  it("scores high-confidence items higher", () => {
    const high = scoreItem(makeItem({ confidence: 0.9 }));
    const low = scoreItem(makeItem({ confidence: 0.3 }));
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("scores decisions higher than bug-lessons", () => {
    const decision = scoreItem(makeItem({ category: "decision" }));
    const bugLesson = scoreItem(makeItem({ category: "bug-lesson" }));
    expect(decision.score).toBeGreaterThan(bugLesson.score);
  });

  it("gives file relevance bonus", () => {
    const item = makeItem({ related_files: ["src/db.ts"] });
    const withRelevance = scoreItem(item, ["src/db.ts"]);
    const withoutRelevance = scoreItem(item, ["unrelated.ts"]);
    expect(withRelevance.score).toBeGreaterThan(withoutRelevance.score);
  });

  it("returns breakdown object", () => {
    const result = scoreItem(makeItem());
    expect(result.breakdown).toHaveProperty("recency");
    expect(result.breakdown).toHaveProperty("confidence");
    expect(result.breakdown).toHaveProperty("categoryPriority");
    expect(result.breakdown).toHaveProperty("fileRelevance");
  });
});
