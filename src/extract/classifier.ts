import type { MemoryCategory, MemorySource } from "../types.js";
import { getEnabledPatterns, type PatternDefinition } from "./patterns.js";
import { getConfig } from "../utils/config.js";

export interface ClassificationResult {
  category: MemoryCategory;
  confidence: number;
  matchedPattern: string;
}

const MAX_CLASSIFIABLE_LENGTH = 300;

/**
 * Classify a text segment into a memory category based on pattern matching.
 * Returns null if no pattern matches or if the segment is too long to be a discrete fact.
 */
export function classify(
  text: string,
  source: MemorySource,
): ClassificationResult | null {
  if (text.length > MAX_CLASSIFIABLE_LENGTH) return null;

  const config = getConfig();
  const patterns = getEnabledPatterns(config.experimentalCategories);

  let bestMatch: ClassificationResult | null = null;
  let bestScore = 0;

  for (const def of patterns) {
    const result = matchPatterns(text, def, source);
    if (result && result.confidence > bestScore) {
      bestMatch = result;
      bestScore = result.confidence;
    }
  }

  if (bestMatch && bestMatch.confidence < config.confidenceThreshold) {
    return null;
  }

  return bestMatch;
}

function matchPatterns(
  text: string,
  def: PatternDefinition,
  source: MemorySource,
): ClassificationResult | null {
  const config = getConfig();

  for (const pattern of def.patterns) {
    const match = pattern.exec(text);
    if (match) {
      let confidence = computeBaseConfidence(text, match[0]);

      if (source === "compact_summary") {
        confidence += config.compactSummaryConfidenceBonus;
      } else if (source === "user") {
        confidence = 1.0;
      }

      confidence = Math.min(confidence, 1.0);

      return {
        category: def.category,
        confidence,
        matchedPattern: match[0],
      };
    }
  }

  return null;
}

function computeBaseConfidence(text: string, matchedText: string): number {
  const len = text.length;

  // Longer, more specific matches get higher confidence
  const matchRatio = matchedText.length / Math.max(len, 1);
  const lengthBonus = Math.min(len / 200, 0.15);

  // Base: 0.5-0.8 range depending on specificity
  let base = 0.5;

  if (matchRatio > 0.1) base += 0.1;
  if (len > 50) base += 0.05;
  base += lengthBonus;

  return Math.min(base, 0.8);
}
