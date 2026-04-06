# /claude-context-governor:memory-audit

Generate an audit report of memory governance decisions.

## Instructions

When the user invokes `/claude-context-governor:memory-audit`, optionally followed by a session ID, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/skills/memory-audit.js [session-id]
```

If no session ID is provided, it generates a project-wide report. If a session ID is given, it generates a session-specific audit report showing:
- What was extracted
- What was loaded vs skipped
- What was rejected and why
- Conflict details
- Token costs
