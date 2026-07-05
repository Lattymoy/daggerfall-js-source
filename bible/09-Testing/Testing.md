# Testing

Runner: `node --test` (bare - a trailing `test/` path breaks discovery on
Node 22). Suite: 188 tests across 40 files.

| File | Tests | Covers |
|---|---|---|
| action.test.js | 3 | door lifecycle/verbatim constants, move tween + chain gate, activation picking |
| anims.test.js | 2 | Directional attacks: verbatim DFU direction->strike mapping pins; delta-clip well-formedness (start/end 0, sorted keys); sampler continuity + keyframe hit + null past dur |
| player.test.js | 3 | verbatim speeds/constants, collider ground/slide/step, motor gravity/jump |
| sky.test.js | 3 | SKY reader pins, panorama mirror law, night mapping |
| smoke.test.js | 1 | runner sanity |
| clock.test.js | 4 | hour gates, LightCurve pins, sun sweep, flicker determinism |
| bsa.test.js | 6 | BSA containers, closure invariant, FOO quirk |
| palette.test.js | 10 | 8 palettes, MAP.PAL x4, embedded reads |
| texture.test.js | 6 | 472-archive corpus, per-codec checksums |
| imgcif.test.js | 8 | IMG table, palettized files, CIF/RCI/weapons |
| arch3d.test.js | 5 | 10251-mesh corpus, UV rules, patch table, model 456 |
| blocks.test.js | 4 | 1295-block corpus, resource closure, FixRdbData |
| dungeon.test.js | 13 | dfRandom LCG, texture tables, RDB matrix order, action records, overlap removal, Privateer's Hold, 187-RDB closure, full 4232-dungeon sweep, R6 light collection pins, per-light flicker bounds, R7 water corpus (32/187) + Maorn pins |
| enterexit.test.js | 5 | verbatim landing offsets, door transforms, landing selection, dungeon exit, ladder climb |
| interior.test.js | 8 | ModelDoor extraction, static doors, interior layout, 6832-interior corpus, R8 light offsets + MAGEAA00 pins |
| people.test.js | 2 | AddPeople position/data verbatim, 14174-people corpus (6724/6832 interiors, archives 176-184) |
| poses.test.js | 1 | Static pose table (POSES): melee1H well-formed, sagittal angles within joint ranges |
| weapons.test.js | 2 | Verbatim DFU weapon data pins (enums, damage table, material mods/dyes, ApplyWeaponMaterial math incl. half-to-even weight round); Longsword piece well-formed on the armR fist |
| names.test.js | 4 | Region->bank verbatim, deterministic name composition on DFRandom, Redguard female stream parity, 76-NPC exterior corpus (SENT7 lamp quirk) |
| enemies.test.js | 5 | 45x20 encounter tables, classic pick replay, fixed/passive/gender/water rules, Privateer's Hold pin (42 enemies / 25 fixed) |
| rig.test.js | 2 | Vendored Rewrite rig byte-parity vs canonical (16 bare-humanoid hashes), 710-face shape |
| rigmath.test.js | 5 | Two-bone IK invariants: exact bone lengths, reach/clamp, pole side, degenerate-target guard |
| paperdollart.test.js | 3 | Variant/cloak record resolution, material addressing (bases+morphology+clamps), plate-vs-leather band pins on 251 |
| piece.test.js | 2 | Sprite-shell geometry round-trip (synthetic + real plate-cuirass 1:1 witness + dye resolve). DAGGER_SPEC profile/pin cases removed with the trace rig. |
| neutral.test.js | 2 | Neutral paperdoll (buildNeutralBody): well-formed mesh (quad/normal/rgb shape, unit normals, on-ramp colours, feet-grounded ~7.5-head height), deterministic + snapped (blocky) shading |
| clothSim.test.js | 4 | Draped-garment cloth sim (verlet): stable (no NaN/explosion over 400 steps) for skirt/robe/cape; no clipping - every free particle stays outside the measured body collider after 500 steps under gravity + wind |
| relief.test.js | 4 | Relief identity witness + field arithmetic pins (synthetic + whole classic body), offsets pin (222,41 / 237,44), back shell mirrors z on the shared silhouette |
| charmesh.test.js | 2 | Face packing (fan order, color/normal interleave), bare-humanoid pack + bounds |
| paperdoll.test.js | 3 | 27-slot EquipSlots verbatim, 288-template DB (index resolution, Short Shirt pin), BlitItems order |
| dyes.test.js | 3 | Clothing dye range shifts (Blue identity, Red 0xEF), 11 metal tables extraction-pinned, band-only swap |
| equip.test.js | 5 | Slot-rule extraction pins (94 cases), hands verbatim, paired first-open, 2H right-hand rule, all-wearables corpus |
| maps.test.js | 9 | 62 regions, converters, climate, city + Privateer's |
| snd.test.js | 3 | 459 sounds, byte-exact header, zero-length record 5 |
| climate.test.js | 5 | applyClimate verbatim rules, texture-info classification, exterior-window table, nature/ground archives, 8820-combo corpus sweep (735 pairs, 0 missing) |
| streaming.test.js | 7 | world-coord conversions, nearest-first 7x7, crossing offsets + column swaps, two-pixel jumps, vertical recenter, 30-crossing floating-origin invariant, 2000-step invariant fuzz |
| terrain.test.js | 14 | WOODS.WLD reader + corpus pins, perlin, cubic, sampler pins, umRandom (float + int), marching-squares lookup, blend flattening, Daggerfall-on-terrain integration, 15251-location corpus sweep, terrain key, nature scatter rules + integration |
| weather.test.js | 4 | verbatim fog tables, mapping, offsets, scales, fog math, lightning strobe |
| window.test.js | 2 | MaterialReader style constants, real glass-texel mask pins |
| world.test.js | 13 | mat4, meshReader, rmbLayout, location grid, flats, nature-quirk pin, city lights, R9 tilemap conversion + grid pins |
| manifest.test.js | 1 | drift guard: this table and the total against the real suite |

Two tiers per module:
1. **Synthetic fixtures** - in-memory data built inside the test. Always run;
   CI stays green with no game data (88 pass, 49 skip).
2. **Real-data validation** - gated on `ARENA2_PATH`; skip cleanly when
   absent. Pin observed counts, names, ids, checksums, and structural
   closure invariants.

Sourcing data in a fresh session: `sh tools/fetch-data.sh`, then
`ARENA2_PATH=/home/claude/dfdata/arena2 npm test`.

Visual proof: `npm run shot [out.png]` boots vite in-process and drives the
provisioned Chromium (playwright@1.56.0 <-> /opt/pw-browsers chromium-1194;
bump both together). CONTRACT: the scene query rides the SHOT_QUERY env
var, NOT argv (`SHOT_QUERY='shot&world&tod=22:00' npm run shot out.png`) -
argv[2] is only the output path. SHOT_TIMEOUT overrides the 30s ready
wait (streaming world wants 90000); SHOT_EVAL runs a JS snippet in-page
after ready (promise-returning expressions are awaited - top-level
`await` fails). Shot-mode probe hooks in the dungeon and world scenes:
window.__move(dx, dy, dz), window.__pose(x, y, z, yaw, pitch),
window.__player {pos, warp}, and in the dungeon __activate/__activateKey/
__ray/__actions. SwiftShader renders heavy scenes at ~7 fps headless -
time-based proofs must poll state, never trust wall-clock. `?shot` in main.js fixes the vantage and raises
`window.__shotReady`. Manual proof, not a suite gate.

Pre-push gate: `npm run check` (test + build).

Drift guard: `test/manifest.test.js` pins the total line and every row of
the table above against the real suite. Recalculate this doc in the same
commit as any test change.


