# /claude-context-governor:memory-audit

Generate an audit report of memory governance decisions.

## Instructions

When the user invokes `/claude-context-governor:memory-audit`, optionally followed by a session ID, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/skills/memory-audit.js [session-id]
```

**Display the full output to the user exactly as printed.** The output is pre-formatted markdown with tables — do not summarize, paraphrase, or reformat it. Show it verbatim.

If no session ID is provided, it generates a project-wide report with:
- Active memory items table (ID, category, content, rationale, confidence)
- Recent sessions table
- Recent decisions table (audit log)
- Conflicts detected table

If a session ID is given, it generates a session-specific audit report with a decision log table.
