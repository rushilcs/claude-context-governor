import type { MemoryCategory } from "../types.js";

export interface GovernorConfig {
  tokenBudget: number;
  enabledCategories: MemoryCategory[];
  experimentalCategories: boolean;
  recencyDays: number;
  expirationDays: number;
  categoryPriority: Record<MemoryCategory, number>;
  confidenceThreshold: number;
  compactSummaryConfidenceBonus: number;
}

const DEFAULT_CONFIG: GovernorConfig = {
  tokenBudget: 2000,
  enabledCategories: ["decision", "constraint", "convention", "bug-lesson"],
  experimentalCategories: false,
  recencyDays: 7,
  expirationDays: 30,
  confidenceThreshold: 0.3,
  compactSummaryConfidenceBonus: 0.05,
  categoryPriority: {
    decision: 1.0,
    constraint: 0.95,
    convention: 0.85,
    "bug-lesson": 0.8,
    "open-question": 0.4,
    "command-recipe": 0.3,
    "work-in-progress": 0.2,
  },
};

let _config: GovernorConfig | null = null;

export function getConfig(): GovernorConfig {
  if (_config) return _config;
  _config = { ...DEFAULT_CONFIG };

  if (_config.experimentalCategories) {
    _config.enabledCategories = [
      ...DEFAULT_CONFIG.enabledCategories,
      "open-question",
      "command-recipe",
      "work-in-progress",
    ];
  }

  return _config;
}

export function setConfig(overrides: Partial<GovernorConfig>): GovernorConfig {
  _config = { ...getConfig(), ...overrides };
  return _config;
}

export function resetConfig(): void {
  _config = null;
}
