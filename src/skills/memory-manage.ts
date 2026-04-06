import { getDatabase, closeDatabase } from "../store/database.js";
import {
  getItemById,
  pinItem,
  dismissItem,
  reviveItem,
  updateItemStatus,
} from "../store/memory-items.js";
import { logAudit } from "../audit/logger.js";

function main() {
  const projectDir = process.cwd();
  const action = process.argv[2];
  const itemId = process.argv[3];

  if (!action || !itemId) {
    console.log("Usage: memory-manage <action> <item-id>");
    console.log("Actions: pin, dismiss, revive, stale");
    process.exit(1);
  }

  const db = getDatabase();

  try {
    // Support partial IDs
    let fullId = itemId;
    if (itemId.length < 36) {
      const match = db
        .prepare(
          "SELECT id FROM memory_items WHERE id LIKE ? AND project_dir = ?",
        )
        .get(`${itemId}%`, projectDir) as { id: string } | undefined;
      if (match) fullId = match.id;
    }

    const item = getItemById(db, fullId);
    if (!item) {
      console.log(`Item not found: ${itemId}`);
      process.exit(1);
    }

    const sessionId = "manual-management";

    switch (action) {
      case "pin":
        pinItem(db, fullId);
        logAudit(db, sessionId, "pinned", fullId, "Pinned by user via /memory-manage");
        console.log(`Pinned: ${item.content.slice(0, 60)}`);
        break;

      case "dismiss":
        dismissItem(db, fullId);
        logAudit(db, sessionId, "dismissed", fullId, "Dismissed by user via /memory-manage");
        console.log(`Dismissed: ${item.content.slice(0, 60)}`);
        break;

      case "revive":
        reviveItem(db, fullId);
        logAudit(db, sessionId, "revived", fullId, "Revived by user via /memory-manage");
        console.log(`Revived: ${item.content.slice(0, 60)}`);
        break;

      case "stale":
        updateItemStatus(db, fullId, "expired");
        logAudit(db, sessionId, "expired", fullId, "Marked as stale by user via /memory-manage");
        console.log(`Marked as stale: ${item.content.slice(0, 60)}`);
        break;

      default:
        console.log(`Unknown action: ${action}`);
        console.log("Supported: pin, dismiss, revive, stale");
        process.exit(1);
    }
  } finally {
    closeDatabase();
  }
}

main();
