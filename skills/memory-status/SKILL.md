# /memory-status

Show current memory governance status for this project.

## Instructions

When the user invokes `/memory-status`, run the governor status script:

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/skills/memory-status.js "${PWD}"
```

Display the output to the user. It shows:
- Total memory items by status (active, dismissed, expired, rejected, superseded)
- Active items by category (decision, constraint, convention, bug-lesson)
- Recent session summary
- Database storage size
