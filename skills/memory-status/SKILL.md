# /claude-context-governor:memory-status

Show current memory governance status for this project.

## Instructions

When the user invokes `/claude-context-governor:memory-status`, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/skills/memory-status.js
```

**Display the full output to the user exactly as printed.** Do not summarize or paraphrase it. It shows:
- Total memory items by status (active, dismissed, expired, rejected, superseded)
- Active items by category (decision, constraint, convention, bug-lesson)
- Recent session summary
- Database storage size
