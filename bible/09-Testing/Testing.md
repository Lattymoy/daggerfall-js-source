# Testing

Runner: `node --test` (bare - a trailing `test/` path breaks discovery on Node 22). Suite: 17 tests across 3 files.

Two tiers per format reader:
1. **Synthetic fixtures** - in-memory archives built inside the test. Always run, keep CI green with no game data.
2. **Real-data validation** - gated on `ARENA2_PATH`; skip cleanly when absent. Pin observed counts, names, ids, and the structural closure invariant.

Sourcing data in a fresh session: `sh tools/fetch-data.sh`, then
`ARENA2_PATH=/home/claude/dfdata/arena2 npm test`.

Pre-push gate: `npm run check` (test + build).
