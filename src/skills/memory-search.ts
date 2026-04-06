import { getDatabase, closeDatabase } from "../store/database.js";
import { searchItems } from "../store/memory-items.js";

function main() {
  const projectDir = process.cwd();
  const query = process.argv[2];

  const args = process.argv.slice(3);
  let category: string | undefined;
  let status: string | undefined;
  let limit = 20;

  for (const arg of args) {
    if (arg.startsWith("--category=")) category = arg.split("=")[1];
    if (arg.startsWith("--status=")) status = arg.split("=")[1];
    if (arg.startsWith("--limit=")) limit = parseInt(arg.split("=")[1], 10);
  }

  const db = getDatabase();

  try {
    const items = searchItems(db, projectDir, {
      keyword: query,
      category,
      status: status || "active",
      limit,
    });

    if (items.length === 0) {
      console.log("No matching memory items found.");
      return;
    }

    console.log(`Found ${items.length} memory items:\n`);

    for (const item of items) {
      console.log(`**[${item.id.slice(0, 8)}]** ${item.category}`);
      console.log(`  ${item.content}`);
      console.log(
        `  confidence: ${item.confidence.toFixed(2)} | source: ${item.memory_source} | status: ${item.status}${item.pinned ? " | PINNED" : ""}`,
      );
      console.log(
        `  created: ${item.created_at.split("T")[0]} | session: ${item.source_session_id.slice(0, 8)}`,
      );
      console.log("");
    }
  } finally {
    closeDatabase();
  }
}

main();
