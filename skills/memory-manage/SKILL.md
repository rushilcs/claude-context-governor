# /claude-context-governor:memory-manage

Manage memory item lifecycle: pin, dismiss, revive, or mark as stale.

## Instructions

When the user invokes `/claude-context-governor:memory-manage`, followed by an action and item ID, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/skills/memory-manage.js <action> <item-id>
```

**Display the full output to the user exactly as printed.** Do not summarize or paraphrase it.

Supported actions:
- `pin <item-id>` — Pin item so it always restores regardless of score
- `dismiss <item-id>` — Dismiss item from future restores
- `revive <item-id>` — Bring back a dismissed or expired item
- `stale <item-id>` — Mark item as expired (soft removal)

All actions are audit-logged. Use `/claude-context-governor:memory-search` first to find item IDs.
