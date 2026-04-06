import type Database from "better-sqlite3";
import type { MemoryItem, MemoryItemRow } from "../types.js";
import { getActiveItems, getPinnedItems, rowToMemoryItem } from "../store/memory-items.js";
import { scoreItem, type ScoredItem } from "./scorer.js";
import { getConfig } from "../utils/config.js";
import { logAudit } from "../audit/logger.js";
import { incrementRestored } from "../store/sessions.js";

export interface RejectedItemWithReason {
  item: MemoryItem;
  conflictDescription: string;
  conflictSourcePath: string | null;
}

export interface SelectionResult {
  selected: ScoredItem[];
  skipped: ScoredItem[];
  rejected: RejectedItemWithReason[];
  totalTokens: number;
  budgetUsed: number;
  budgetTotal: number;
}

/**
 * Select memory items for restore, respecting token budget.
 * Pinned items are always included first. Then fill by score descending.
 */
export function selectForRestore(
  db: Database.Database,
  projectDir: string,
  sessionId: string,
  recentFiles: string[] = [],
): SelectionResult {
  const config = getConfig();
  const budget = config.tokenBudget;

  const pinnedItems = getPinnedItems(db, projectDir);
  const activeItems = getActiveItems(db, projectDir);

  // Deduplicate: remove pinned items from active list
  const pinnedIds = new Set(pinnedItems.map((i) => i.id));
  const nonPinnedActive = activeItems.filter((i) => !pinnedIds.has(i.id));

  // Score all items
  const scoredPinned = pinnedItems.map((i) => scoreItem(i, recentFiles));
  const scoredActive = nonPinnedActive
    .map((i) => scoreItem(i, recentFiles))
    .sort((a, b) => b.score - a.score);

  const selected: ScoredItem[] = [];
  const skipped: ScoredItem[] = [];
  let tokensUsed = 0;

  // Pinned items go first, always
  for (const scored of scoredPinned) {
    if (tokensUsed + scored.item.token_estimate <= budget) {
      selected.push(scored);
      tokensUsed += scored.item.token_estimate;
      logAudit(
        db,
        sessionId,
        "loaded",
        scored.item.id,
        `Pinned item restored (score: ${scored.score.toFixed(2)})`,
        scored.item.token_estimate,
      );
    } else {
      skipped.push(scored);
      logAudit(
        db,
        sessionId,
        "skipped",
        scored.item.id,
        "Pinned item skipped: exceeded token budget",
      );
    }
  }

  // Fill remaining budget by score
  for (const scored of scoredActive) {
    if (tokensUsed + scored.item.token_estimate <= budget) {
      selected.push(scored);
      tokensUsed += scored.item.token_estimate;
      logAudit(
        db,
        sessionId,
        "loaded",
        scored.item.id,
        `Restored (score: ${scored.score.toFixed(2)}, category: ${scored.item.category})`,
        scored.item.token_estimate,
      );
    } else {
      skipped.push(scored);
      logAudit(
        db,
        sessionId,
        "skipped",
        scored.item.id,
        `Skipped: token budget exhausted (score: ${scored.score.toFixed(2)})`,
      );
    }
  }

  if (selected.length > 0) {
    incrementRestored(db, sessionId, selected.length);
  }

  const rejected = getRecentRejectedItems(db, projectDir);

  return {
    selected,
    skipped,
    rejected,
    totalTokens: tokensUsed,
    budgetUsed: tokensUsed,
    budgetTotal: budget,
  };
}

function getRecentRejectedItems(
  db: Database.Database,
  projectDir: string,
): RejectedItemWithReason[] {
  const rows = db
    .prepare(
      `SELECT mi.*, cr.description as conflict_description, cr.conflict_source_path
       FROM memory_items mi
       JOIN conflict_records cr ON cr.memory_item_id = mi.id
       WHERE mi.project_dir = ? AND mi.status = 'rejected'
         AND cr.resolution = 'memory-rejected'
       ORDER BY cr.detected_at DESC`,
    )
    .all(projectDir) as Array<
    MemoryItemRow & {
      conflict_description: string;
      conflict_source_path: string | null;
    }
  >;

  return rows.map((row) => ({
    item: rowToMemoryItem(row),
    conflictDescription: row.conflict_description,
    conflictSourcePath: row.conflict_source_path,
  }));
}
