# Testing

Runner: `node --test` (bare - a trailing `test/` path breaks discovery on
Node 22). Suite: 86 tests across 14 files.

| File | Tests | Covers |
|---|---|---|
| smoke.test.js | 1 | runner sanity |
| bsa.test.js | 6 | BSA containers, closure invariant, FOO quirk |
| palette.test.js | 10 | 8 palettes, MAP.PAL x4, embedded reads |
| texture.test.js | 6 | 472-archive corpus, per-codec checksums |
| imgcif.test.js | 8 | IMG table, palettized files, CIF/RCI/weapons |
| arch3d.test.js | 5 | 10251-mesh corpus, UV rules, patch table, model 456 |
| blocks.test.js | 4 | 1295-block corpus, resource closure, FixRdbData |
| dungeon.test.js | 10 | dfRandom LCG, texture tables, RDB matrix order, action records, overlap removal, Privateer's Hold, 187-RDB closure, full 4232-dungeon sweep |
| interior.test.js | 7 | ModelDoor extraction, static doors, interior layout, 6832-interior corpus |
| maps.test.js | 9 | 62 regions, converters, climate, city + Privateer's |
| snd.test.js | 3 | 459 sounds, byte-exact header, zero-length record 5 |
| terrain.test.js | 6 | WOODS.WLD reader + corpus pins, perlin, cubic, sampler pins for Daggerfall environs + open ocean |
| world.test.js | 10 | mat4, meshReader, rmbLayout, location grid, flats, nature-quirk dead-path pin |
| manifest.test.js | 1 | drift guard: this table and the total against the real suite |

Two tiers per module:
1. **Synthetic fixtures** - in-memory data built inside the test. Always run;
   CI stays green with no game data (48 pass, 38 skip).
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

Drift guard: `test/manifest.test.js` pins the total line and every row of
the table above against the real suite. Recalculate this doc in the same
commit as any test change.
