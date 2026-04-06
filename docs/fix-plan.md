# Credibility Fix Plan

Audit performed 2026-04-05. Goal: close gaps between what the code does, what docs claim, and what has been E2E-validated.

## Issue 1: Skill UX / Invocation Correctness

**Root cause:** `memory-search` SKILL.md says "followed by search terms" but the script allows an empty query (lists all active items). No automated tests exist for skill entry points.

**Fix:** Clarify optional query in SKILL.md. Add skill argv unit tests.

**Files:** `skills/memory-search/SKILL.md`, new `tests/unit/skills.test.ts`

## Issue 2: File Relevance Scoring Is Not Live

**Root cause:** `on-session-start.ts` calls `selectForRestore(db, cwd, sessionId)` without `recentFiles`. The scorer always gets `[]`, returning neutral 0.3 for all items. File-overlap scoring only runs in unit tests.

**Decision:** Option B -- keep deferred, soften claims. SessionStart input does not provide recent files.

**Fix:** Change "recency, confidence, and relevance" to "recency, confidence, and category priority" in README. Add code comment and architecture note.

**Files:** `README.md`, `docs/architecture.md`, `src/restore/scorer.ts`

## Issue 3: SessionEnd and Stop Lifecycle Are Overstated

**Root cause:** `on-session-end.ts` is a no-op (reads stdin, exits). `on-stop.ts` only calls `ensureSession`. But architecture.md describes them as "Finalize session record" and "Save turn snapshot."

**Fix:** Rewrite hook table and data flow diagram in architecture.md to match reality. Update prd.md capture scope.

**Files:** `docs/architecture.md`, `docs/prd.md`

## Issue 4: E2E Validation Evidence Is Incomplete

**Root cause:** `tests/e2e/VALIDATION.md` has an empty results table. No evidence artifacts exist.

**Fix:** Restructure into automated validation (Tier 1+2 reference), manual validation checklist (pending), and evidence artifact guidance.

**Files:** `tests/e2e/VALIDATION.md`

## Issue 5: Public Claims Are Too Absolute

**Root cause:** README implies file relevance is live, lists SessionEnd without noting it's a no-op, and lacks MVP status note.

**Fix:** Add MVP status note, fix scoring language, add parentheticals for minimal hooks.

**Files:** `README.md`

## Issue 6: Extraction Scope Must Be Described Accurately

**Root cause:** Transcript extraction processes assistant messages only. Docs say "session transcripts" without qualifying.

**Fix:** Add "assistant messages in" qualifier to README and architecture.md.

**Files:** `README.md`, `docs/architecture.md`

## Issue 7: Conflict Detection Must Be Framed as Heuristic

**Root cause:** Detector uses keyword overlap + polarity + 8 hardcoded value pairs. Docs should say "heuristic" explicitly.

**Fix:** Add "heuristic" framing to README and architecture.md.

**Files:** `README.md`, `docs/architecture.md`
