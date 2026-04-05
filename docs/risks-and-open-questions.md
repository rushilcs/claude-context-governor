# Risks and Open Questions

## Platform Assumptions (validated by M0 spike)

These are the assumptions that could break the project if wrong. Each is validated by a specific M0 spike test before any real development begins.

| ID | Assumption | Risk | M0 Result | Notes |
|----|-----------|------|-----------|-------|
| A1 | Plugin loads via `--plugin-dir` | Low | **PASS** | Plugin appears in /plugin list immediately |
| A2 | SessionStart additionalContext injects into Claude's working context | Medium | **PASS** | Claude sees and references injected text. Confirmed working. |
| A3 | transcript_path is readable by hook process | Medium-High | **PASS** | 22-line JSONL, 16KB, fully readable. No sandboxing issues. |
| A4 | PostCompact provides usable compact_summary | Medium | **PASS** | 2,664 chars of structured XML with `<analysis>` and `<summary>` sections. Highly extractable. |
| A5 | Hook stdin JSON contains documented fields | Low | **PASS** | All documented fields present across all hooks, plus bonus fields (model, permission_mode, custom_instructions). |
| A6 | InstructionsLoaded fires for CLAUDE.md | Low-Medium | **NOT TESTED** | Did not fire because spike/CLAUDE.md was inside plugin dir, not project root. Test setup issue, not platform failure. Will retest in M2 with root-level CLAUDE.md. Fallback (read from disk) is viable. |
| A7 | /reload-plugins works for dev iteration | Low | **PASS** | Reloads hooks without session restart. Fast dev iteration confirmed. |

### Platform Risk Assessment (post-spike)

All critical assumptions validated. No fallbacks needed. The platform behaves as documented.

The only untested assumption (A6) is low-risk: even if InstructionsLoaded doesn't fire, the fallback of reading CLAUDE.md and .claude/rules/ from disk works. InstructionsLoaded is a convenience (tells us which files were loaded), not a requirement.

## Implementation Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|-----------|-----------|
| R1 | Transcript JSONL format changes between Claude Code versions | Extraction breaks | Medium | Version-aware parser with try/catch. Fall back to compact_summary extraction. Abstract parsing behind interface. |
| R2 | Pattern-based extraction produces too many false positives | User trust erodes, context bloat | Medium-High | Conservative patterns, 4-category scope (not 7), user can dismiss. Fingerprint dedup prevents accumulation. Conservative confidence thresholds. |
| R3 | Hook timeout pressure on large transcripts | PreCompact fails silently | Medium | Stream-parse JSONL (don't load entire file). Process only delta since last checkpoint (track extraction watermark per session). Set timeout to 60s in hooks.json. |
| R4 | better-sqlite3 native dependency fails on some platforms | Plugin won't install | Low-Medium | Use prebuild-install for prebuilt binaries. Test on macOS and Linux. Document Windows as unsupported initially. |
| R5 | Conflict detection is too naive for real-world rules | False rejections (good memory rejected) or missed conflicts (bad memory restored) | Medium | Flag ambiguous cases as soft conflicts rather than hard rejections. Let user resolve via /memory-manage. Err on the side of flagging, not rejecting. |
| R6 | SessionStart restore takes >5s | Poor UX, user disables plugin | Low | Index on (project_dir, status). Limit query to 100 items max. All operations are in-memory after query. Tested architecture targets <3s. |
| R7 | SessionEnd 1.5s timeout too short for cleanup | Incomplete session records | Medium | Do ONLY counter updates in SessionEnd. No extraction, no conflict detection, no stale-item cleanup. Defer heavy work to Stop hook (no hard timeout). |
| R8 | Compaction doesn't fire in short sessions | No memory extraction happens | Medium | For MVP, accept this gap. Post-MVP (v1.1), add extraction on Stop hook for sessions ending without compaction. |
| R9 | Memory store grows large over time | Slow queries, large disk usage | Low | Automatic expiration (30-day TTL). Fingerprint dedup prevents duplicates. Dismiss/supersede reduce active count. Index on primary query patterns. |
| R10 | Multiple concurrent Claude Code sessions write to same SQLite | Database locking errors | Low-Medium | better-sqlite3 handles WAL mode for concurrent reads. For writes, SQLite's built-in locking is sufficient for this workload (low write frequency). If issues arise, add retry with exponential backoff. |

## Product Risks

| ID | Risk | Mitigation |
|----|------|-----------|
| P1 | Pattern extraction quality is not good enough for real-world conversations | Compact_summary extraction partially compensates (Claude's own summary is higher quality). User lifecycle controls (pin/dismiss) provide a correction mechanism. Post-MVP LLM extraction upgrades the pipeline. |
| P2 | Users don't trust automatically extracted memories | Audit trail makes every decision inspectable. Conflict detection proves the system is checking work. Pinned items give users control. Start with 4 high-signal categories, not 7 noisy ones. |
| P3 | Token budget for restored memory is too small (2000 default) | Make it configurable via plugin userConfig. Users can increase to 4000+ if they want more context. Default is conservative by design. |
| P4 | Claude Code changes hook behavior in a future version | Pin to specific Claude Code version compatibility in README. Abstract hook input parsing behind versioned interface. M0 spike validates current behavior. |

## Open Questions

| ID | Question | Current Decision | Revisit When |
|----|----------|-----------------|-------------|
| Q1 | Should extraction run on Stop hook for sessions without compaction? | No -- MVP defers this to v1.1 | After MVP ships and users report context loss in short sessions |
| Q2 | Should fingerprint include related_files in the hash? | No -- content + category only. Same decision stated differently shouldn't dedup differently because of file context. | If dedup is too aggressive |
| Q3 | Should conflict detection read CLAUDE.md from disk or from InstructionsLoaded events? | Use InstructionsLoaded to know WHICH files, read content from disk. InstructionsLoaded doesn't pass file content. | If InstructionsLoaded is unreliable (A6 fallback) |
| Q4 | Should we support multiple projects in one SQLite database? | Yes -- filter by project_dir. Single DB simplifies management. | If performance degrades with many projects |
| Q5 | What happens when plugin updates reset ${CLAUDE_PLUGIN_DATA}? | It doesn't -- PLUGIN_DATA persists across updates per docs. The DB survives. | If this assumption is wrong |
| Q6 | Should skills invoke compiled TypeScript or use shell scripts? | Skills are prompt-based (SKILL.md with instructions). They tell Claude to run a script via Bash tool. The script is compiled TypeScript. | If skill execution model changes |
