# Demo Plan

## Positioning

**Lead with governance, not persistence.**

The headline is: "What if Claude Code could remember the right things, reject the wrong things, and prove why?"

The product is positioned as:
- "Memory governance for Claude Code"
- "Selective, explainable, conflict-safe memory"

NOT:
- "Persistent memory for Claude Code"
- "Never forget anything"
- "Memory bank for AI"

The differentiator must be visually obvious in every demo artifact: conflict detection, audit trail, selective restore with reasoning.

---

## Demo Scenario 1: Conflict Detection (LEAD DEMO)

This is the most compelling scenario because it shows governance, not just storage.

### Setup
1. Create a project with a CLAUDE.md containing: "Always use spaces for indentation (2 spaces). Never use tabs."
2. Start a Claude Code session with the plugin installed

### Script
1. Ask Claude to write some code, and in the conversation, express a preference for tabs: "Actually, let's switch to tabs, I think they're better for accessibility"
2. Claude may agree and start using tabs in the conversation
3. Trigger `/compact`
4. **Show extraction**: the convention "use tabs for indentation" was extracted from the transcript
5. **Show conflict detection**: the system detected this conflicts with CLAUDE.md's "never use tabs" rule
6. **Show rejection**: the memory item was rejected with status=rejected
7. Run `/memory-audit` to show the full audit trail:
   ```
   ## Audit Report (claude-context-governor)

   ### Extracted
   - [convention] "Use tabs for indentation" (source: transcript, confidence: 0.6)

   ### Rejected
   - [convention] "Use tabs for indentation"
     Reason: Conflicts with CLAUDE.md rule: "Never use tabs"
     Conflict source: /Users/dev/project/CLAUDE.md
     Resolution: memory-rejected

   ### Summary
   1 extracted | 0 loaded | 1 rejected (conflict) | 0 tokens used
   ```

### Key Visual
The audit report showing: extraction -> conflict detected -> rejection with reason. This is the money shot.

### Why This Demo Matters
- Shows the system is not blindly saving everything
- Shows it checks memory against project rules
- Shows it explains every decision
- Distinguishes this from every "save more context" tool

---

## Demo Scenario 2: Memory Survives Compaction

### Setup
1. Start a Claude Code session with the plugin installed
2. Project has some existing code

### Script
1. Have a conversation where you make clear architectural decisions:
   - "Let's use PostgreSQL for the database -- we need JSONB support"
   - "API endpoints should follow /v1/resource/:id pattern"
   - "Never use an ORM for complex queries, raw SQL only"
2. Work on code for a while (build up context)
3. Trigger `/compact` (or let auto-compact fire)
4. Start a new session (or the session restarts after compaction)
5. Run `/memory-status`:
   ```
   ## Memory Status (claude-context-governor)

   Project: /Users/dev/my-project
   Active items: 3 (2 decisions, 1 constraint)
   Pinned: 0 | Dismissed: 0 | Expired: 0 | Rejected: 0
   Last session: 2026-04-05T14:22:00Z (3 items extracted)
   Storage: 42 KB

   ### Restored This Session
   3 loaded | 0 skipped | budget: 88/2000 tokens
   ```
6. Show the restored context block that Claude received:
   ```
   ## Restored Memory (claude-context-governor)
   3 loaded | 0 skipped | budget: 88/2000 tokens

   ### Decisions
   - [2026-04-05] Use PostgreSQL for the database -- JSONB support needed (confidence: 0.8, source: transcript)
   - [2026-04-05] API endpoints follow /v1/resource/:id pattern (confidence: 0.75, source: compact_summary)

   ### Constraints
   - [2026-04-05] Never use ORM for complex queries -- raw SQL only (confidence: 0.85, source: transcript)
   ```

### Key Visual
Before/after: a clean session that starts with governed memory instead of a blank slate.

---

## Demo Scenario 3: Full Audit Trail

### Setup
1. Work through 2-3 sessions on a project over an hour

### Script
1. First session: make decisions, establish conventions
2. Second session: investigate a bug, pin the bug lesson
3. Third session: run `/memory-audit`
4. Show the comprehensive report:
   ```
   ## Audit Report -- last 3 sessions

   ### Session sess-003 (2026-04-05T16:00:00Z)
   Restored: 4 items (112 tokens)
   - [loaded] "Use PostgreSQL for database" (decision, score: 0.92)
   - [loaded] "Never use ORM for complex queries" (constraint, score: 0.88) [pinned]
   - [loaded] "Race condition fix: acquire lock before processing" (bug-lesson, score: 0.85)
   - [loaded] "API follows /v1/resource/:id" (decision, score: 0.78)
   - [skipped] "Code review required for auth changes" (convention, score: 0.42, reason: below budget cutoff)
   Extracted: 2 items
   Rejected: 0

   ### Session sess-002 (2026-04-05T14:00:00Z)
   Restored: 2 items (64 tokens)
   Extracted: 3 items
   - [extracted] "Race condition in webhook handler" (bug-lesson, confidence: 0.9)
   - [pinned] "Race condition in webhook handler" (user action)
   Rejected: 1 item
   - [rejected] "Use console.log for debugging" (convention, conflict: CLAUDE.md says "use structured logger")

   ### Summary
   Total: 8 items active | 1 pinned | 1 rejected | 1 skipped
   Token usage: 112/2000 budget
   ```

### Key Visual
A complete audit report that answers: what happened, what was loaded, what was rejected, and why.

---

## Demo Artifacts

### GitHub README
- Header: "Memory governance for Claude Code -- selective, explainable, conflict-safe"
- Terminal gif of Scenario 1 (conflict detection) right below the header
- "How it works" section with the data flow diagram
- "Quick start" with installation instructions

### Terminal Recording
- Use [VHS](https://github.com/charmbracelet/vhs) or [asciinema](https://asciinema.org/) for Scenario 1
- Duration: 60-90 seconds
- Show: CLAUDE.md rule -> conversation -> compact -> extraction -> conflict -> audit
- The conflict detection and audit output are the climax

### LinkedIn Post

Draft:

> Claude Code remembers things. But should it remember *everything*?
>
> I built a memory governance layer for Claude Code that:
> - Extracts decisions, constraints, and conventions from your sessions
> - Detects conflicts with your project rules (CLAUDE.md)
> - Restores only the right context, within a token budget
> - Proves every decision with an audit trail
>
> Here's what happens when Claude suggests tabs but your project says spaces:
>
> [terminal gif showing conflict detection]
>
> The differentiator isn't "persistent memory." It's selective, explainable, conflict-safe memory restoration.
>
> Open source: [github link]
>
> #ClaudeCode #AI #DeveloperTools #OpenSource

### Key Message Hierarchy
1. Governance, not just persistence
2. Conflict detection is the headline feature
3. Audit trail proves trustworthiness
4. Selective restore shows intelligence
5. Open source, local-first, easy to install
