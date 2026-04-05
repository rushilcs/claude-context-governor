# Test Strategy

Testing is organized into three tiers with increasing scope and decreasing automation.

## Tier 1: Unit Tests (automated, vitest)

Pure function tests with no I/O, no process spawning, no SQLite. These test the core logic in isolation.

| Module | What to Test |
|--------|-------------|
| extractor | Feed text segments (both transcript excerpts and compact_summary text), assert correct memory candidates extracted |
| classifier | Feed snippets, assert correct category assignment and confidence scoring |
| fingerprint | Feed content + category pairs, assert deterministic SHA-256 output; verify normalization (case, whitespace) |
| patterns | Feed text with known signals, assert pattern matches; feed text without signals, assert no match |
| detector | Feed memory item + instruction fragments, assert conflicts detected for polarity and value conflicts |
| scorer | Feed memory items + context params (recency, file overlap), assert correct ordering |
| serializer | Feed scored items + budget, assert Markdown output format and token budget enforcement |
| tokens | Feed strings of known length, assert reasonable token estimates |

**Run**: `pnpm test` (via vitest)

**Coverage target**: >90% for extract/, conflict/, restore/ modules.

## Tier 2: Hook Simulation Tests (automated, vitest)

These tests spawn compiled hook handler JS files with mock stdin JSON, capture stdout, and assert the output and SQLite side effects. They validate the stdin/stdout contract and database integration.

| Test | Setup | Input | Assert |
|------|-------|-------|--------|
| session-start | Seed SQLite with 10 memory items (mixed status, pinned, dismissed) | SessionStart JSON with cwd matching items | stdout JSON contains additionalContext with scored items; pinned items included; dismissed items excluded; audit entries written |
| pre-compact | Seed SQLite with session record; create fixture transcript file | PreCompact JSON with transcript_path pointing to fixture | New memory items in SQLite with correct category, memory_source="transcript", fingerprint |
| post-compact | Seed SQLite with session record | PostCompact JSON with compact_summary text containing known patterns | New memory items with memory_source="compact_summary"; session record updated |
| instructions-loaded | Empty ActiveInstructionFile table | InstructionsLoaded JSON with file_path and load_reason | ActiveInstructionFile record created with correct fields |
| dedup | Seed SQLite with existing item with known fingerprint | PreCompact with transcript containing same content | Existing item superseded, new item created with same fingerprint |

**Implementation**: each test spawns `node dist/hooks/on-<event>.js` as a child process, pipes JSON to stdin, reads stdout, then queries the test SQLite database for side effects.

**Run**: `pnpm test:simulation`

### Limitation

Simulation tests are **necessary but not sufficient**.

They validate that our code correctly handles the I/O contract (read JSON from stdin, write JSON to stdout, interact with SQLite). They do NOT validate:

- That Claude Code actually sends the fields we expect
- That additionalContext actually appears in Claude's working context
- That hook timeouts are respected in the real runtime
- That the plugin loads and initializes correctly in Claude Code
- That skills render correctly when invoked by a user

These gaps are covered by Tier 3.

## Tier 3: Real Claude Code Validation (manual, required before MVP ship)

These scenarios must be executed manually inside a real Claude Code session. They cannot be automated because they depend on Claude Code's runtime behavior.

### Validation Scenarios

#### V1: Plugin Install and Load

**Steps**:
1. From the repo root, run `claude --plugin-dir ./`
2. In the session, type `/plugin` and verify the plugin appears in the list
3. Run `/plugin validate` to check for manifest or hook errors

**Pass criteria**:
- Plugin appears in the list with correct name and description
- No validation errors

#### V2: Plugin Reload

**Steps**:
1. Start a session with the plugin loaded
2. Edit hooks/hooks.json to add a `statusMessage` to one hook
3. Run `/reload-plugins`
4. Trigger the hook and verify the statusMessage appears

**Pass criteria**:
- Hook change takes effect without restarting the session

#### V3: SessionStart Restore

**Steps**:
1. Pre-seed the SQLite database with 3-5 test memory items for the current project directory
2. Start a new Claude Code session with the plugin
3. Ask Claude: "What context was restored from memory governance?"

**Pass criteria**:
- Claude's response references the restored memory items
- The additionalContext Markdown block is present in Claude's context
- /memory-status shows items_restored > 0

#### V4: PreCompact Capture

**Steps**:
1. Start a session, have a conversation where you make an explicit decision ("Let's use PostgreSQL for the database")
2. Run `/compact`
3. After compaction, run `/memory-search category:decision`

**Pass criteria**:
- The decision about PostgreSQL appears as a memory item
- memory_source = "transcript"
- related_files is populated if files were discussed

#### V5: PostCompact Capture

**Steps**:
1. Same as V4, but after compaction completes, check that compact_summary was processed
2. Run `/memory-search source:compact_summary`

**Pass criteria**:
- At least one item extracted from the compact_summary
- Item has memory_source = "compact_summary"
- Session record has last_compact_summary populated

#### V6: InstructionsLoaded Tracking

**Steps**:
1. Create or verify a CLAUDE.md file in the project root
2. Start a session with the plugin
3. Query the ActiveInstructionFile table (via /memory-status or direct DB inspection)

**Pass criteria**:
- CLAUDE.md file_path recorded
- load_reason = "session_start"

#### V7: Conflict Detection (live)

**Steps**:
1. Add to CLAUDE.md: "Always use spaces for indentation, never tabs"
2. Start a session, have a conversation where Claude suggests using tabs
3. Run `/compact`
4. Run `/memory-audit`

**Pass criteria**:
- A convention item about tabs was extracted
- A ConflictRecord exists showing the conflict with CLAUDE.md
- The item status is "rejected"
- /memory-audit shows the rejection with reason

#### V8: Skill Invocation

**Steps**:
1. With items in the database, invoke `/memory-status`
2. Invoke `/memory-audit`
3. Invoke `/memory-search category:decision`
4. Invoke `/memory-manage pin <some-id>`

**Pass criteria**:
- Each skill produces meaningful output
- /memory-manage correctly modifies the item's pinned status

## Fixture Strategy

### Transcript Fixtures (tests/fixtures/transcripts/)

Create 3-4 realistic JSONL files:

1. **decision-session.jsonl**: session where user and Claude make architectural decisions (PostgreSQL choice, API design, deployment strategy). Contains clear decision language.
2. **bug-investigation.jsonl**: session investigating and fixing a bug. Contains root cause analysis and fix description.
3. **convention-session.jsonl**: session establishing coding conventions (naming, file structure, testing patterns).
4. **mixed-session.jsonl**: realistic session with decisions, constraints, and some noise (small talk, questions, tangents).

### Compact Summary Fixtures (tests/fixtures/compact-summaries/)

Create 2-3 compact_summary text samples:

1. **summary-with-decisions.txt**: summary that mentions decisions and constraints
2. **summary-with-bugs.txt**: summary mentioning a bug investigation and fix
3. **summary-minimal.txt**: very short summary with little extractable content (edge case)

### Instruction Fixtures (tests/fixtures/claude-md/, tests/fixtures/rules/)

1. **standard-claude-md.md**: typical CLAUDE.md with 5-10 rules covering style, testing, architecture
2. **conflicting-claude-md.md**: CLAUDE.md with rules designed to conflict with fixture transcript content
3. **conditional-rule.md**: a `.claude/rules/` file with `paths:` frontmatter

## Test Environment

- All test databases are created in a temp directory and cleaned up after each test
- Fixture files are committed to the repo (they're small text files)
- No network access required for any test tier
- Tier 3 requires Claude Code CLI installed and authenticated
