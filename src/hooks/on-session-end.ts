import { readStdin } from "../utils/stdin.js";

async function main() {
  // SessionEnd has a hard 1.5s timeout enforced by Claude Code.
  // The native better-sqlite3 module load alone exceeds this on cold start.
  // All meaningful work (session tracking, extraction) happens in Stop hook
  // which runs before SessionEnd with more headroom. This hook is a no-op.
  await readStdin();
}

main().catch(() => process.exit(0));
