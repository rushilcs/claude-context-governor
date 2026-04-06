# /claude-context-governor:memory-search

Search stored memory items by keyword, category, or status.

## Instructions

When the user invokes `/claude-context-governor:memory-search`, optionally followed by search terms, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/skills/memory-search.js ["<query>"] [--category=<cat>] [--status=<status>] [--limit=<n>]
```

If no query is provided, all active items for the project are listed. If a query is given, results are filtered by keyword match. Optional flags filter by category, status, or result count.

Display matching memory items with their ID, category, content, confidence, source, and status. The user can reference item IDs in `/claude-context-governor:memory-manage` to pin, dismiss, or revive items.
