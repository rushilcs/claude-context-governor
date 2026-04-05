import { readFileSync, existsSync } from "node:fs";

export interface InstructionFragment {
  text: string;
  sourcePath: string;
  sourceType: "claude-md" | "rules";
  keywords: string[];
  negated: boolean;
}

/**
 * Parse an instruction file (CLAUDE.md or .claude/rules/*.md) into fragments.
 * Each line/rule becomes a fragment with extracted keywords and negation detection.
 */
export function parseInstructionFile(
  filePath: string,
  sourceType: "claude-md" | "rules",
): InstructionFragment[] {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, "utf-8");
  return parseInstructionText(content, filePath, sourceType);
}

export function parseInstructionText(
  content: string,
  sourcePath: string,
  sourceType: "claude-md" | "rules",
): InstructionFragment[] {
  const fragments: InstructionFragment[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.replace(/^[-*#>\s]+/, "").trim();
    if (trimmed.length < 10) continue;
    if (trimmed.startsWith("```")) continue;

    const keywords = extractKeywords(trimmed);
    if (keywords.length === 0) continue;

    fragments.push({
      text: trimmed,
      sourcePath,
      sourceType,
      keywords,
      negated: hasNegation(trimmed),
    });
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

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

const NEGATION_PATTERNS = [
  /\bnever\b/i,
  /\bdo not\b/i,
  /\bdon't\b/i,
  /\bnot\b/i,
  /\bno\b/i,
  /\bprohibited\b/i,
  /\bforbidden\b/i,
  /\bavoid\b/i,
  /\bmust not\b/i,
  /\bshouldn't\b/i,
  /\bshould not\b/i,
];

function hasNegation(text: string): boolean {
  return NEGATION_PATTERNS.some((p) => p.test(text));
}
