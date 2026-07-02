# Testing

Runner: `node --test` (bare - a trailing `test/` path breaks discovery on
Node 22). Suite: 61 tests across 10 files.

| File | Tests | Covers |
|---|---|---|
| smoke.test.js | 1 | runner sanity |
| bsa.test.js | 6 | BSA containers, closure invariant, FOO quirk |
| palette.test.js | 10 | 8 palettes, MAP.PAL x4, embedded reads |
| texture.test.js | 6 | 472-archive corpus, per-codec checksums |
| imgcif.test.js | 8 | IMG table, palettized files, CIF/RCI/weapons |
| arch3d.test.js | 5 | 10251-mesh corpus, UV rules, patch table, model 456 |
| blocks.test.js | 4 | 1295-block corpus, resource closure, FixRdbData |
| maps.test.js | 9 | 62 regions, converters, climate, city + Privateer's |
| snd.test.js | 3 | 459 sounds, byte-exact header, zero-length record 5 |
| world.test.js | 9 | mat4, meshReader, rmbLayout, location grid, flats |

Two tiers per module:
1. **Synthetic fixtures** - in-memory data built inside the test. Always run;
   CI stays green with no game data (32 pass, 29 skip).
2. **Real-data validation** - gated on `ARENA2_PATH`; skip cleanly when
   absent. Pin observed counts, names, ids, checksums, and structural
   closure invariants.

Sourcing data in a fresh session: `sh tools/fetch-data.sh`, then
`ARENA2_PATH=/home/claude/dfdata/arena2 npm test`.

Visual proof: `npm run shot [out.png]` boots vite in-process and drives the
provisioned Chromium (playwright@1.56.0 <-> /opt/pw-browsers chromium-1194;
bump both together). `?shot` in main.js fixes the vantage and raises
`window.__shotReady`. Manual proof, not a suite gate.

Pre-push gate: `npm run check` (test + build).

Drift risk: the suite count above and in arc docs is hand-maintained.
Candidate (needs Mac approval): a manifest test pinning the real count,
project-final style.
