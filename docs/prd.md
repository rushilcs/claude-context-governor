# Product Requirements Document

## Problem

Claude Code has built-in memory mechanisms (CLAUDE.md, compaction, auto-memory, `.claude/rules/`), but no governance layer over memory. The gap creates five concrete pain points:

1. **Context loss after compaction**: intermediate decisions, bug investigations, and conventions are summarized away or dropped entirely during compaction. Developers restart sessions without the context they built up.

2. **Context bloat from low-value injection**: naive memory persistence re-injects everything, consuming token budget with stale or irrelevant information.

3. **Stale summaries carried forward**: compacted summaries can contain outdated information that misleads Claude in future turns.

4. **No inspectability**: there is no way to see what memory was loaded, what was skipped, why, or how many tokens it consumed.

5. **Drift from project rules**: compacted context can contradict CLAUDE.md or `.claude/rules/`, and there is no detection mechanism.

## Users

**Primary**: individual developers using Claude Code for daily work who experience context loss across sessions and compactions.

**Secondary**: small teams sharing a codebase where memory consistency matters (post-MVP).

## Differentiator

Not "persistent memory." The market has tools that save context. The differentiator is **governance**: selective, explainable, conflict-safe, auditable memory restoration. Every memory item has provenance, a confidence score, a conflict status, and an audit trail.

## MVP Scope

### Core Capabilities

1. **Capture** state at PreCompact, PostCompact, and InstructionsLoaded hooks. SessionStart performs restore (not capture). Stop ensures session tracking. SessionEnd is a no-op due to hard timeout constraints.
2. **Extract** atomic memory items from two sources:
   - Assistant messages in session transcripts (via PreCompact hook)
   - Compaction summaries (via PostCompact hook)
3. **Classify** into 4 core categories: decision, constraint, convention, bug-lesson
4. **Store** with full provenance: source session, timestamp, related files, confidence, memory source, fingerprint
5. **Detect conflicts** between memory candidates and loaded CLAUDE.md / `.claude/rules/` files
6. **Restore selectively** at SessionStart using recency/confidence/category scoring + configurable token budget
7. **Audit** every decision: what was loaded, skipped, rejected, and why
8. **User lifecycle controls**: pin, dismiss, revive, fingerprint-based dedup

### Skills

| Skill | Purpose |
|-------|---------|
| /memory-status | Show current state: item counts by category, last session, storage size |
| /memory-audit | Display full audit report for current or recent sessions |
| /memory-search | Query items by category, keyword, file, date range |
| /memory-manage | Pin, dismiss, or revive memory items |

### Extraction Categories

**Core MVP (enabled by default)**:
- **decision**: architectural choices, tool selections, approach decisions
- **constraint**: hard rules, prohibitions, requirements
- **convention**: coding patterns, naming standards, style choices
- **bug-lesson**: root causes, fixes, debugging insights

**Experimental (disabled by default, behind config flag)**:
- **open-question**: deferred because questions go stale quickly
- **command-recipe**: deferred because recipes belong in docs, not memory
- **work-in-progress**: deferred because WIP status changes rapidly and becomes misleading

Rationale: this is a governance layer, not a notes dump. Fewer, higher-quality memories build user trust faster and produce cleaner demo output.

## Non-Goals for MVP

- Branch-aware memory (schema prepared, functionality deferred)
- Embeddings or semantic retrieval
- Team-shared memory
- Web dashboard or UI beyond CLI skills
- LLM-based extraction (heuristic extraction for determinism and speed)
- Cloud infrastructure of any kind

## Success Criteria

1. A developer can install the plugin, work through a session with compaction, and see governed memory restored in the next session -- without any manual action beyond plugin installation. (Target behavior; requires manual Claude Code validation to confirm.)
2. The audit report clearly shows what was loaded, what was rejected (with conflict reason), and token budget used.
3. A conflict between a memory candidate and CLAUDE.md is detected and handled (rejected or flagged).
4. SessionStart restore completes in <3 seconds.
5. The plugin is installable from a git clone with `pnpm install && pnpm build`.
6. At least one demo scenario can be recorded as a terminal gif and posted to GitHub/LinkedIn.
7. A developer can pin, dismiss, and revive memory items using /memory-manage.
