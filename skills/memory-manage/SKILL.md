# /claude-context-governor:memory-manage

Manage memory item lifecycle: pin, dismiss, revive, or mark as stale.

## Instructions

When the user invokes `/claude-context-governor:memory-manage`, they will provide an action and an item ID (either inline or in a follow-up message). Extract the action and item ID from the user's input, then run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/skills/memory-manage.js <action> <item-id>
```

**Display the full output to the user exactly as printed.** Do not summarize or paraphrase it.

**Important**: The user must use the full command `/claude-context-governor:memory-manage`, not just `/memory-manage`. If the user gets an "Unknown skill" error, remind them to use the full plugin-prefixed command.

Supported actions:
- `pin <item-id>` — Pin item so it always restores regardless of score
- `dismiss <item-id>` — Dismiss item from future restores
- `revive <item-id>` — Bring back a dismissed or expired item
- `stale <item-id>` — Mark item as expired (soft removal)

Item IDs can be full UUIDs or the first 8 characters (short IDs shown in audit/search output).

All actions are audit-logged. Use `/claude-context-governor:memory-search` first to find item IDs.
