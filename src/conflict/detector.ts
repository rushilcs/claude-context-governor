import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import type { MemoryItem, ConflictRecord } from "../types.js";
import {
  parseInstructionFile,
  type InstructionFragment,
} from "./instruction-parser.js";
import { getDistinctInstructionPaths } from "../store/instruction-files.js";
import { updateItemStatus } from "../store/memory-items.js";
import { logAudit } from "../audit/logger.js";

export interface ConflictCheckResult {
  conflicts: ConflictRecord[];
  rejected: boolean;
}

/**
 * Check a memory item against loaded instruction files for conflicts.
 * Uses keyword overlap + negation polarity to detect contradictions.
 */
export function checkConflicts(
  db: Database.Database,
  item: MemoryItem,
  sessionId: string,
): ConflictCheckResult {
  let instructionPaths = getDistinctInstructionPaths(db, sessionId);

  // Fallback: if InstructionsLoaded never fired, scan disk directly
  if (instructionPaths.length === 0) {
    instructionPaths = discoverInstructionFiles(item.project_dir);
  }

  const fragments = loadAllFragments(instructionPaths);
  return checkConflictsAgainstFragments(db, item, sessionId, fragments);
}

/**
 * Fallback discovery when InstructionsLoaded hook doesn't fire.
 * Looks for CLAUDE.md at project root and .claude/rules/*.md
 */
function discoverInstructionFiles(projectDir: string): string[] {
  const paths: string[] = [];

  const claudeMd = join(projectDir, "CLAUDE.md");
  if (existsSync(claudeMd)) paths.push(claudeMd);

  const rulesDir = join(projectDir, ".claude", "rules");
  if (existsSync(rulesDir)) {
    try {
      const files = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
      for (const f of files) {
        paths.push(join(rulesDir, f));
      }
    } catch {
      // ignore read errors
    }
  }

  return paths;
}

export function checkConflictsAgainstFragments(
  db: Database.Database,
  item: MemoryItem,
  sessionId: string,
  fragments: InstructionFragment[],
): ConflictCheckResult {
  const conflicts: ConflictRecord[] = [];
  let rejected = false;

  const itemKeywords = extractItemKeywords(item.content);
  const itemNegated = hasItemNegation(item.content);

  for (const fragment of fragments) {
    const overlap = computeKeywordOverlap(itemKeywords, fragment.keywords);
    const valueConflict = detectValueConflict(item.content, fragment.text);

    // Polarity conflict: one negated, other not, with meaningful keyword overlap
    const polarityConflict =
      itemNegated !== fragment.negated && overlap >= 0.25;

    if (!polarityConflict && !valueConflict) continue;

    const conflictType = valueConflict ? "value" : "polarity";
    const isHardConflict = overlap >= 0.4 || valueConflict;

    const record: ConflictRecord = {
      id: uuidv4(),
      memory_item_id: item.id,
      conflict_source: fragment.sourceType,
      conflict_source_path: fragment.sourcePath,
      description: `${conflictType} conflict: memory "${truncate(item.content, 60)}" vs instruction "${truncate(fragment.text, 60)}" (keyword overlap: ${(overlap * 100).toFixed(0)}%)`,
      resolution: isHardConflict ? "memory-rejected" : "memory-flagged",
      detected_at: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO conflict_records (id, memory_item_id, conflict_source, conflict_source_path, description, resolution, detected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.memory_item_id,
      record.conflict_source,
      record.conflict_source_path,
      record.description,
      record.resolution,
      record.detected_at,
    );

    logAudit(
      db,
      sessionId,
      "conflict-detected",
      item.id,
      `${conflictType} conflict with ${fragment.sourceType}: ${truncate(fragment.text, 80)}`,
    );

    conflicts.push(record);

    if (isHardConflict) {
      rejected = true;
      updateItemStatus(db, item.id, "rejected");
      logAudit(
        db,
        sessionId,
        "rejected",
        item.id,
        `Rejected due to ${conflictType} conflict with ${fragment.sourcePath}`,
      );
    }
  }

  return { conflicts, rejected };
}

function loadAllFragments(filePaths: string[]): InstructionFragment[] {
  const fragments: InstructionFragment[] = [];
  for (const path of filePaths) {
    const sourceType = path.includes(".claude/rules")
      ? ("rules" as const)
      : ("claude-md" as const);
    fragments.push(...parseInstructionFile(path, sourceType));
  }
  return fragments;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "for", "and", "nor",
  "but", "or", "yet", "so", "at", "by", "in", "of", "on", "to", "up",
  "it", "its", "this", "that", "with", "from", "as", "into", "all",
  "use", "using", "new", "code",
]);

function extractItemKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function hasItemNegation(text: string): boolean {
  return /\b(never|not|don't|do not|must not|shouldn't|should not|prohibited|forbidden|avoid)\b/i.test(
    text,
  );
}

function computeKeywordOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const overlap = a.filter((w) => setB.has(w)).length;
  return overlap / Math.min(a.length, b.length);
}

const VALUE_PAIRS: Array<[RegExp, RegExp]> = [
  [/\btabs\b/i, /\bspaces\b/i],
  [/\bsql\b/i, /\borm\b/i],
  [/\bmysql\b/i, /\bpostgres(?:ql)?\b/i],
  [/\bmonorepo\b/i, /\bsingle[- ]?(?:package|repo)\b/i],
  [/\brest\b/i, /\bgraphql\b/i],
  [/\bjest\b/i, /\bvitest\b/i],
  [/\bnpm\b/i, /\bpnpm\b/i],
  [/\byarn\b/i, /\bpnpm\b/i],
];

function detectValueConflict(itemText: string, instructionText: string): boolean {
  const instrNegated = hasItemNegation(instructionText);

  for (const [patternA, patternB] of VALUE_PAIRS) {
    const itemMatchesA = patternA.test(itemText);
    const itemMatchesB = patternB.test(itemText);
    const instrMatchesA = patternA.test(instructionText);
    const instrMatchesB = patternB.test(instructionText);

    // Simple case: item uses A, instruction uses B (exclusive)
    if (
      (itemMatchesA && instrMatchesB && !instrMatchesA) ||
      (itemMatchesB && instrMatchesA && !instrMatchesB)
    ) {
      return true;
    }

    // Negation case: instruction mentions both but negates one
    // e.g., "use spaces, never tabs" -> affirms B, negates A
    if (instrNegated && instrMatchesA && instrMatchesB) {
      if (itemMatchesA && !itemMatchesB) return true;
      if (itemMatchesB && !itemMatchesA) return true;
    }
  }
  return false;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}
