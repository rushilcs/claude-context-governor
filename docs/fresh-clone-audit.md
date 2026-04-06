# Fresh-Clone Audit

Audited: 2026-04-05

## Problems Found and Fixes

### 1. `npm test` fails on a fresh clone (CRITICAL)

**Root cause**: `tests/unit/skills.test.ts` shells out to `dist/skills/*.js` via `execFileSync("node", [...])`. On a fresh clone, `dist/` does not exist because it is gitignored. All 7 skill CLI tests fail with `MODULE_NOT_FOUND`.

**Fix**: Changed `npm test` to run `npm run build && vitest run` so the build step always runs before tests. Added `npm run test:fast` (runs `vitest run` without building) for rapid iteration during development.

**Result**: `npm test` now works from a fresh clone. `npm run verify` runs typecheck + build + test as the canonical from-scratch command.

### 2. Package manager inconsistency

**Root cause**: The repo uses `npm` (evidenced by `package-lock.json`), but planning docs (`docs/prd.md`, `docs/mvp-milestones.md`, `docs/todo.md`, `docs/test-strategy.md`) reference `pnpm` commands. A new developer would be confused about which to use.

**Fix**: Replaced all `pnpm` references in docs with the correct `npm` equivalents. The canonical package manager is `npm`.

### 3. No single "does this repo work?" command

**Root cause**: No script combined typecheck + build + test. A developer had to know the right sequence.

**Fix**: Added `npm run verify` script that runs `tsc --noEmit && tsup && vitest run` in sequence. This is the canonical first-time validation command.

### 4. Test count inconsistency in docs

**Root cause**: `publish-readiness.md` and `VALIDATION.md` reported "60 tests" and "6 skill tests". The actual count is 61 tests with 7 skill tests.

**Fix**: Updated all docs to reflect accurate counts (61 total, 7 skill CLI tests).

### 5. README lacked clear quickstart

**Root cause**: The README had installation instructions but no quickstart section that a stranger could follow. The "Development" section was buried at the bottom. There was no explanation of what was automated vs what required manual validation.

**Fix**: Added a prominent "Quickstart" section at the top of the README with exact commands, a commands table, and an automated-vs-manual status table.

### 6. `test:simulation` script referenced non-existent vitest project

**Root cause**: `package.json` had `"test:simulation": "vitest run --project simulation"` but no vitest project configuration named "simulation" existed. This command would fail.

**Fix**: Removed the broken script. Simulation tests are included in the default `npm test` run.

## Commands a New User Should Run

```bash
git clone https://github.com/rushilcs/claude-context-governor.git
cd claude-context-governor
npm install
npm run verify    # typecheck + build + test (61/61 should pass)
```

To run the plugin with Claude Code:

```bash
claude --plugin-dir /path/to/claude-context-governor
```

## Script Reference

| Command | What it does | When to use |
|---------|-------------|-------------|
| `npm run verify` | `tsc --noEmit` + `tsup` + `vitest run` | First time, CI, or "does everything work?" |
| `npm test` | `tsup` + `vitest run` | Normal testing (builds first, always safe) |
| `npm run test:fast` | `vitest run` only | Rapid dev iteration (skip build, may fail skill tests if dist/ is stale) |
| `npm run build` | `tsup` | Build hooks + skills to dist/ |
| `npm run typecheck` | `tsc --noEmit` | Type checking only |
| `npm run clean` | `rm -rf dist` | Remove build artifacts |

## Remaining Caveats

1. **Manual Claude Code validation is pending.** The 10 scenarios in `tests/e2e/VALIDATION.md` must be run by a human inside a live Claude Code session. This audit does not claim that has happened.

2. **`better-sqlite3` requires native compilation.** On most systems, prebuilt binaries are downloaded automatically during `npm install`. On exotic platforms or locked-down CI environments, this may require a C++ toolchain. Node.js >= 18 is required.

3. **Skill CLI tests add ~2s to test runs.** They spawn real node processes against built `dist/` files. This is intentional -- they test the actual CLI interface. Use `npm run test:fast` to skip them during rapid iteration.

4. **No lint configuration.** The repo does not have ESLint or a formatter configured. `npm run verify` does not include a lint step because none exists. TypeScript strict mode and the typecheck step are the primary code quality gates.
