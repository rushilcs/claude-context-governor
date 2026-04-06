import type { ScoredItem } from "./scorer.js";
import type { SelectionResult } from "./selector.js";

/**
 * Serialize selected memory items into structured Markdown for context injection.
 * Includes corrections for rejected items so governed decisions override
 * Claude's native memory when they conflict.
 */
export function serializeForContext(result: SelectionResult): string {
  if (result.selected.length === 0 && result.rejected.length === 0) return "";

  const lines: string[] = [];
  lines.push("## Restored Memory (claude-context-governor)");
  lines.push(
    `${result.selected.length} loaded | ${result.skipped.length} skipped | budget: ${result.budgetUsed}/${result.budgetTotal} tokens`,
  );
  lines.push("");

  const grouped = groupByCategory(result.selected);

  for (const [category, items] of grouped) {
    lines.push(`### ${formatCategoryName(category)}`);
    for (const scored of items) {
      const { item } = scored;
      const date = item.created_at.split("T")[0];
      const parts = [`- [${date}] ${item.content}`];

      const meta: string[] = [];
      meta.push(`confidence: ${item.confidence.toFixed(1)}`);
      if (item.memory_source !== "transcript") {
        meta.push(`source: ${item.memory_source}`);
      }
      if (item.pinned) {
        meta.push("pinned");
      }

      parts.push(` (${meta.join(", ")})`);
      lines.push(parts.join(""));
    }
    lines.push("");
  }

  if (result.rejected.length > 0) {
    lines.push("### Corrections (governance overrides)");
    lines.push(
      "The following items were extracted from past conversations but **rejected** because they conflict with project rules (CLAUDE.md / .claude/rules/). " +
        "If you have other memories that match these, **disregard them** and follow the project rules instead.",
    );
    lines.push("");
    for (const { item, conflictDescription, conflictSourcePath } of result.rejected) {
      const source = conflictSourcePath ?? "project rules";
      lines.push(`- **REJECTED**: "${item.content}" — conflicts with ${source}`);
    }
    lines.push("");
  }

  lines.push("### Governance Rules");
  lines.push(
    "When a user requests something that contradicts project rules in CLAUDE.md or .claude/rules/, " +
      "you MUST explicitly warn them about the conflict and cite the specific rule before proceeding. " +
      "Do not silently accept instructions that contradict project rules. " +
      "Do not write memories that conflict with CLAUDE.md without first telling the user about the conflict.",
  );

  return lines.join("\n").trim();
}

function groupByCategory(
  items: ScoredItem[],
): Map<string, ScoredItem[]> {
  const groups = new Map<string, ScoredItem[]>();
  const order = [
    "decision",
    "constraint",
    "convention",
    "bug-lesson",
    "open-question",
    "command-recipe",
    "work-in-progress",
  ];

  for (const cat of order) {
    const matching = items.filter((i) => i.item.category === cat);
    if (matching.length > 0) {
      groups.set(cat, matching);
    }
  }

  return groups;
}

function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    decision: "Decisions",
    constraint: "Constraints",
    convention: "Conventions",
    "bug-lesson": "Bug Lessons",
    "open-question": "Open Questions",
    "command-recipe": "Command Recipes",
    "work-in-progress": "Work in Progress",
  };
  return names[category] || category;
}
