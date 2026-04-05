import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "hooks/on-session-start": "src/hooks/on-session-start.ts",
    "hooks/on-pre-compact": "src/hooks/on-pre-compact.ts",
    "hooks/on-post-compact": "src/hooks/on-post-compact.ts",
    "hooks/on-stop": "src/hooks/on-stop.ts",
    "hooks/on-session-end": "src/hooks/on-session-end.ts",
    "hooks/on-instructions-loaded": "src/hooks/on-instructions-loaded.ts",
    "skills/memory-status": "src/skills/memory-status.ts",
    "skills/memory-audit": "src/skills/memory-audit.ts",
    "skills/memory-search": "src/skills/memory-search.ts",
    "skills/memory-manage": "src/skills/memory-manage.ts",
  },
  format: ["esm"],
  target: "node18",
  platform: "node",
  splitting: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
