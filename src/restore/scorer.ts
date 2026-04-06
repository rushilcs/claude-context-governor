import type { MemoryItem } from "../types.js";
import { getConfig } from "../utils/config.js";

export interface ScoredItem {
  item: MemoryItem;
  score: number;
  breakdown: {
    recency: number;
    confidence: number;
    categoryPriority: number;
    fileRelevance: number;
  };
}

/**
 * Score a memory item for restore priority.
 * Higher score = more likely to be restored.
 */
export function scoreItem(
  item: MemoryItem,
  recentFiles: string[] = [],
): ScoredItem {
  const config = getConfig();

  const recency = computeRecencyScore(item.created_at, config.recencyDays);
  const confidence = item.confidence;
  const categoryPriority =
    config.categoryPriority[item.category] ?? 0.5;
  const fileRelevance = computeFileRelevance(
    item.related_files,
    recentFiles,
  );

  const score =
    recency * 0.3 +
    confidence * 0.3 +
    categoryPriority * 0.25 +
    fileRelevance * 0.15;

  return {
    item,
    score,
    breakdown: {
      recency,
      confidence,
      categoryPriority,
      fileRelevance,
    },
  };
}

function computeRecencyScore(createdAt: string, recencyDays: number): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 0) return 1.0;
  if (ageDays >= recencyDays) return 0.1;

  // Exponential decay
  return Math.exp(-ageDays / (recencyDays * 0.5));
}

// File relevance scoring is implemented but not yet wired into runtime restore.
// SessionStart input does not provide a recent-files list, so recentFiles is
// always [] at runtime, yielding the neutral baseline (0.3). The overlap-based
// scoring path below activates only when callers explicitly pass recentFiles
// (currently unit tests only). Wiring this up is a post-MVP enhancement.
function computeFileRelevance(
  itemFiles: string[],
  recentFiles: string[],
): number {
  if (!itemFiles || !recentFiles || itemFiles.length === 0 || recentFiles.length === 0) return 0.3;

  const recentSet = new Set(recentFiles);
  const overlap = itemFiles.filter((f) => recentSet.has(f)).length;

  if (overlap === 0) return 0.1;
  return Math.min(overlap / itemFiles.length, 1.0);
}
