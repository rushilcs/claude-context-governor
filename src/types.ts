export type MemoryCategory =
  | "decision"
  | "constraint"
  | "convention"
  | "bug-lesson"
  | "open-question"
  | "command-recipe"
  | "work-in-progress";

export const CORE_CATEGORIES: MemoryCategory[] = [
  "decision",
  "constraint",
  "convention",
  "bug-lesson",
];

export const EXPERIMENTAL_CATEGORIES: MemoryCategory[] = [
  "open-question",
  "command-recipe",
  "work-in-progress",
];

export type MemorySource = "transcript" | "compact_summary" | "user";

export type MemoryStatus =
  | "active"
  | "superseded"
  | "expired"
  | "rejected"
  | "dismissed";

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  rationale: string;
  memory_source: MemorySource;
  source_session_id: string;
  created_at: string;
  confidence: number;
  last_verified: string;
  related_files: string[];
  tags: string[];
  status: MemoryStatus;
  pinned: boolean;
  dismissed_at: string | null;
  fingerprint: string;
  superseded_by: string | null;
  token_estimate: number;
  branch: string | null;
  project_dir: string;
}

export interface MemoryItemRow {
  id: string;
  category: string;
  content: string;
  rationale: string;
  memory_source: string;
  source_session_id: string;
  created_at: string;
  confidence: number;
  last_verified: string;
  related_files: string;
  tags: string;
  status: string;
  pinned: number;
  dismissed_at: string | null;
  fingerprint: string;
  superseded_by: string | null;
  token_estimate: number;
  branch: string | null;
  project_dir: string;
}

export interface SessionRecord {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  project_dir: string;
  compaction_count: number;
  items_extracted: number;
  items_restored: number;
  last_compact_summary: string | null;
}

export interface ActiveInstructionFile {
  id?: number;
  session_id: string;
  file_path: string;
  memory_type: string;
  load_reason: string;
  loaded_at: string;
}

export type AuditAction =
  | "loaded"
  | "skipped"
  | "rejected"
  | "extracted"
  | "conflict-detected"
  | "pinned"
  | "dismissed"
  | "revived"
  | "superseded"
  | "expired";

export interface AuditEntry {
  id: string;
  session_id: string;
  timestamp: string;
  action: AuditAction;
  memory_item_id: string;
  reason: string;
  token_cost: number | null;
}

export interface ConflictRecord {
  id: string;
  memory_item_id: string;
  conflict_source: "claude-md" | "rules" | "memory-item";
  conflict_source_path: string | null;
  description: string;
  resolution: "memory-rejected" | "memory-flagged" | "unresolved";
  detected_at: string;
}

// Hook input types based on M0 spike validated fields

export interface HookInputBase {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
}

export interface SessionStartInput extends HookInputBase {
  hook_event_name: "SessionStart";
  source: "startup" | "resume" | "clear" | "compact";
  model: string;
}

export interface PreCompactInput extends HookInputBase {
  hook_event_name: "PreCompact";
  trigger: "manual" | "auto";
  custom_instructions: string;
}

export interface PostCompactInput extends HookInputBase {
  hook_event_name: "PostCompact";
  trigger: "manual" | "auto";
  compact_summary: string;
}

export interface StopInput extends HookInputBase {
  hook_event_name: "Stop";
  stop_hook_active: boolean;
  last_assistant_message: string;
  permission_mode: string;
}

export interface SessionEndInput extends HookInputBase {
  hook_event_name: "SessionEnd";
  reason: string;
}

export interface InstructionsLoadedInput extends HookInputBase {
  hook_event_name: "InstructionsLoaded";
  file_path: string;
  memory_type: string;
  load_reason: string;
  globs?: string[];
  trigger_file_path?: string;
  parent_file_path?: string;
}

export type HookInput =
  | SessionStartInput
  | PreCompactInput
  | PostCompactInput
  | StopInput
  | SessionEndInput
  | InstructionsLoadedInput;
