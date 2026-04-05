import { createHash } from "node:crypto";
import type { MemoryCategory } from "../types.js";

/**
 * Compute a deterministic fingerprint for deduplication.
 * SHA-256 of lowercase(trim(content)) + "|" + category
 */
export function computeFingerprint(
  content: string,
  category: MemoryCategory,
): string {
  const normalized = content.toLowerCase().trim().replace(/\s+/g, " ");
  const input = `${normalized}|${category}`;
  return createHash("sha256").update(input).digest("hex");
}
