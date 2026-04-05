import { v4 as uuidv4 } from "uuid";
import type Database from "better-sqlite3";
import type { MemoryItem, MemorySource } from "../types.js";
import { classify } from "./classifier.js";
import { computeFingerprint } from "./fingerprint.js";
import { estimateTokens } from "../utils/tokens.js";
import {
  insertMemoryItem,
  findByFingerprint,
  supersedeItem,
} from "../store/memory-items.js";
import { incrementExtracted } from "../store/sessions.js";
import { logAudit } from "../audit/logger.js";

export interface ExtractionResult {
  items: MemoryItem[];
  duplicatesSkipped: number;
  superseded: number;
}

/**
 * Extract memory items from text (transcript messages or compact_summary).
 * Segments text, classifies, deduplicates, and stores in SQLite.
 */
export function extractMemories(
  db: Database.Database,
  text: string,
  source: MemorySource,
  sessionId: string,
  projectDir: string,
  relatedFiles: string[] = [],
): ExtractionResult {
  const segments = segmentText(text);
  const result: ExtractionResult = {
    items: [],
    duplicatesSkipped: 0,
    superseded: 0,
  };

  for (const segment of segments) {
    const classification = classify(segment, source);
    if (!classification) continue;

    const fingerprint = computeFingerprint(segment, classification.category);

    const existing = findByFingerprint(db, fingerprint, projectDir);
    if (existing) {
      if (existing.confidence >= classification.confidence) {
        result.duplicatesSkipped++;
        continue;
      }
      result.superseded++;
    }

    const now = new Date().toISOString();
    const item: MemoryItem = {
      id: uuidv4(),
      category: classification.category,
      content: segment.trim(),
      rationale: `Pattern matched: "${classification.matchedPattern}" in ${source}`,
      memory_source: source,
      source_session_id: sessionId,
      created_at: now,
      confidence: classification.confidence,
      last_verified: now,
      related_files: relatedFiles,
      tags: [],
      status: "active",
      pinned: false,
      dismissed_at: null,
      fingerprint,
      superseded_by: null,
      token_estimate: estimateTokens(segment),
      branch: null,
      project_dir: projectDir,
    };

    // Insert new item first, then supersede old one (FK requires new item to exist)
    insertMemoryItem(db, item);

    if (existing) {
      supersedeItem(db, existing.id, item.id);
      logAudit(
        db,
        sessionId,
        "superseded",
        existing.id,
        `Superseded by newer extraction from ${source} with higher confidence`,
      );
    }
    logAudit(
      db,
      sessionId,
      "extracted",
      item.id,
      `Extracted ${classification.category} from ${source} (confidence: ${classification.confidence.toFixed(2)})`,
    );

    result.items.push(item);
  }

  if (result.items.length > 0) {
    incrementExtracted(db, sessionId, result.items.length);
  }

  return result;
}

/**
 * Segment text into candidate chunks for classification.
 * Uses sentence boundaries (period, exclamation, question mark) and paragraph breaks.
 * Groups 2-3 sentences together for context.
 */
function segmentText(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const segments: string[] = [];

  for (const paragraph of paragraphs) {
    const sentences = paragraph
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 10);

    if (sentences.length <= 3) {
      segments.push(paragraph.trim());
    } else {
      // Sliding window of 2-3 sentences
      for (let i = 0; i < sentences.length; i += 2) {
        const window = sentences.slice(i, i + 3).join(" ");
        segments.push(window.trim());
      }
    }
  }

  return segments.filter((s) => s.length > 20);
}
