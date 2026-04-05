import type { ScoredItem } from "./scorer.js";
import type { SelectionResult } from "./selector.js";

/**
 * Serialize selected memory items into structured Markdown for context injection.
 */
export function serializeForContext(result: SelectionResult): string {
  if (result.selected.length === 0) return "";

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
