import type { MemoryCategory } from "../types.js";

export interface PatternDefinition {
  category: MemoryCategory;
  patterns: RegExp[];
  core: boolean;
}

export const PATTERN_DEFINITIONS: PatternDefinition[] = [
  // Core categories (enabled by default)
  {
    category: "decision",
    core: true,
    patterns: [
      /\b(?:decided to|we(?:'ll| will) use|going with|chose|the approach is|we agreed|I(?:'ll| will) go with|let(?:'s|'s) use|opting for|settling on)\b/i,
      /\b(?:decision|architecture choice|design choice):\s/i,
      /\bwe(?:'re| are) going (?:to|with)\b/i,
    ],
  },
  {
    category: "constraint",
    core: true,
    patterns: [
      /\b(?:must not|must always|always|never|do not|don't|cannot|should not|shouldn't|prohibited|required|requirement|mandatory|forbidden)\b/i,
      /\b(?:constraint|limitation|restriction|invariant):\s/i,
    ],
  },
  {
    category: "convention",
    core: true,
    patterns: [
      /\b(?:convention|pattern|standard|we follow|naming(?::| convention)|style(?::| guide)|code style|naming scheme|file structure|folder structure)\b/i,
      /\b(?:the convention is|our pattern is|standard(?:s)? (?:is|are)|format(?:ting)?:)\b/i,
    ],
  },
  {
    category: "bug-lesson",
    core: true,
    patterns: [
      /\b(?:the (?:issue|bug|problem|root cause) was|root cause|fixed by|the fix (?:is|was)|lesson(?::| learned)|caused by|debugging|workaround)\b/i,
      /\b(?:turned out|it was because|the reason was|the error (?:is|was) (?:caused|due))\b/i,
    ],
  },

  // Experimental categories (disabled by default)
  {
    category: "open-question",
    core: false,
    patterns: [
      /\b(?:still need to|TODO|unclear|open question|TBD|to be determined|need to figure out|unsure|undecided)\b/i,
    ],
  },
  {
    category: "command-recipe",
    core: false,
    patterns: [
      /\b(?:run `|execute|the command is|use this:|to (?:run|start|build|deploy|test)(?::| this))\b/i,
    ],
  },
  {
    category: "work-in-progress",
    core: false,
    patterns: [
      /\b(?:working on|in progress|next step|currently|WIP|started implementing|halfway through)\b/i,
    ],
  },
];

export function getEnabledPatterns(
  enableExperimental: boolean,
): PatternDefinition[] {
  if (enableExperimental) return PATTERN_DEFINITIONS;
  return PATTERN_DEFINITIONS.filter((p) => p.core);
}
