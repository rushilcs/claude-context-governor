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

const MAX_SEGMENT_LENGTH = 300;
const MIN_SEGMENT_LENGTH = 20;

const META_SECTION_PATTERNS = [
  /^\d+\.\s*(?:all )?user messages/i,
  /^\d+\.\s*pending tasks/i,
  /^\d+\.\s*current work/i,
  /^\d+\.\s*optional next step/i,
  /^\d+\.\s*errors and fixes/i,
  /^if you need specific details/i,
  /^read the full transcript at/i,
  /^summary:/i,
];

/**
 * Segment text into candidate chunks for classification.
 * Handles both conversational text and structured compact summaries.
 */
export function segmentText(text: string): string[] {
  let cleaned = text
    .replace(/<\/?summary>/gi, "")
    .replace(/<\/?compact_summary>/gi, "")
    .trim();

  const lines = splitIntoLines(cleaned);
  const segments: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < MIN_SEGMENT_LENGTH) continue;
    if (trimmed.length > MAX_SEGMENT_LENGTH) continue;
    if (isMetaContent(trimmed)) continue;

    segments.push(trimmed);
  }

  return segments;
}

function splitIntoLines(text: string): string[] {
  const lines: string[] = [];

  const blocks = text.split(/\n{2,}/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const structuredLines = trimmed.split(
      /\n(?=\s*[-*]\s|\s*\d+\.\s|#{1,4}\s)/,
    );

    for (const line of structuredLines) {
      const stripped = line
        .replace(/^\s*[-*]\s+/, "")
        .replace(/^\s*\d+\.\s+/, "")
        .replace(/^#{1,4}\s+/, "")
        .replace(/^\*\*.*?\*\*:\s*/, "")
        .trim();

      if (!stripped) continue;

      const sentences = stripped
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.trim().length > 10);

      if (sentences.length <= 2 || stripped.length <= MAX_SEGMENT_LENGTH) {
        lines.push(stripped);
      } else {
        for (let i = 0; i < sentences.length; i += 2) {
          const window = sentences.slice(i, i + 2).join(" ");
          lines.push(window.trim());
        }
      }
    }
  }

  return lines;
}

function isMetaContent(text: string): boolean {
  for (const pattern of META_SECTION_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  if (/^\[.*\]\(.*\)/.test(text)) return true;

  const codeBlockCount = (text.match(/```/g) || []).length;
  if (codeBlockCount >= 2) return true;

  return false;
}
