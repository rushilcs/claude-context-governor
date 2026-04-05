# /memory-manage

Manage memory item lifecycle: pin, dismiss, revive, or mark as stale.

## Instructions

When the user invokes `/memory-manage`, followed by an action and item ID, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/skills/memory-manage.js "${PWD}" <action> <item-id>
```

Supported actions:
- `pin <item-id>` — Pin item so it always restores regardless of score
- `dismiss <item-id>` — Dismiss item from future restores
- `revive <item-id>` — Bring back a dismissed or expired item
- `stale <item-id>` — Mark item as expired (soft removal)

All actions are audit-logged. Use `/memory-search` first to find item IDs.
