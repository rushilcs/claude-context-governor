# /memory-search

Search stored memory items by keyword, category, or status.

## Instructions

When the user invokes `/memory-search`, followed by search terms, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/skills/memory-search.js "${PWD}" "<query>" [--category=<cat>] [--status=<status>] [--limit=<n>]
```

Display matching memory items with their ID, category, content, confidence, source, and status. The user can reference item IDs in `/memory-manage` to pin, dismiss, or revive items.
