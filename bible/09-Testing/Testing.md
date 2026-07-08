# Testing

Runner: `node --test` (bare - a trailing `test/` path breaks discovery on
Node 22). Suite: 281 tests across 72 files.

| File | Tests | Covers |
|---|---|---|
| action.test.js | 3 | door lifecycle/verbatim constants, move tween + chain gate, activation picking |
| anims.test.js | 2 | Directional attacks: verbatim DFU direction->strike mapping pins; delta-clip well-formedness (start/end 0, sorted keys); sampler continuity + keyframe hit + null past dur |
| pointerlock.test.js | 3 | requestLook never throws - swallows a rejecting requestPointerLock promise (the sh/< crash + lock:N frozen-yaw bug), tolerates the void-returning API, survives a synchronous throw |
| player.test.js | 6 | verbatim speeds/constants, collider ground/slide/step, motor gravity/jump, strafe = true camera-right, wall-ladder regression (step-up needs a clear raised path) |
| save.test.js | 2 | the snapshot/restore round-trip (entity fields, deep-copied stats/items/actives, spells re-resolved by index, extras + the S12 world/locationKey riding the envelope, the version gate refusing, storage round-trip + corrupt-JSON null), F12 piercing overlays while F9 stays gated |
| sky.test.js | 3 | SKY reader pins, panorama mirror law, night mapping |
| smoke.test.js | 1 | runner sanity |
| clock.test.js | 4 | hour gates, LightCurve pins, sun sweep, flicker determinism |
| datasource.test.js | 1 | ARENA2 key rule: uppercase basename across path styles (unix/windows/bare) |
| bsa.test.js | 6 | BSA containers, closure invariant, FOO quirk |
| palette.test.js | 10 | 8 palettes, MAP.PAL x4, embedded reads |
| textrsc.test.js | 2 | the verbatim record table on crafted bytes (headerLength/6 - 1 count, id->offset walk, raw bytes INCLUSIVE of the 0xFE terminator, missing ids null), plainText flattening (NewLine, SubrecordSeparator variants, the two one-operand prefixes consuming without leaking printable operands, justify/control drops) |
| texture.test.js | 6 | 472-archive corpus, per-codec checksums |
| imgcif.test.js | 8 | IMG table, palettized files, CIF/RCI/weapons |
| arch3d.test.js | 5 | 10251-mesh corpus, UV rules, patch table, model 456 |
| blocks.test.js | 4 | 1295-block corpus, resource closure, FixRdbData |
| dungeon.test.js | 13 | dfRandom LCG, texture tables, RDB matrix order, action records, overlap removal, Privateer's Hold, 187-RDB closure, full 4232-dungeon sweep, R6 light collection pins, per-light flicker bounds, R7 water corpus (32/187) + Maorn pins |
| monstercareer.test.js | 1 | ENEMY{nnn}.CFG careers from a crafted MONSTER.BSA through the shared BsaFile+ClassFile readers: fields real on the entity, session cache proven (throwing re-fetch), missing-index null path |
| playerweapon.test.js | 3 | verbatim reach 2.25+0.25 + view/LOS hit rule + the swing-mod table, drag-gesture -> mapped strike on the shared machine (threshold + release reset), hit-frame kill through the full chain (deterministic rolls) + reach/dead gating |
| formulas.test.js | 5 | FormulaHelper verbatim: Dice100/DamageModifier/H2H (sheet rule)/weapon min-max tables/material mods/body parts, career attack-modifier bits + enemy-type bonus, to-hit chain (dodging/4 bug preserved, roll ordering, 3..97 clamp), damage paths (str-after-skeletal ordering, silver x2, material gate), the classic 0.25/MeleeDistance/35.156deg hit gate |
| spellcost.test.js | 2 | the verbatim component math (offset + A*starting + B*trunc(inc/per), averaged magnitude, per-effect skill scaling gold*(110-skill)/400, the zero-component fudge 60/100/160), target multipliers on the SUMS (x1.5/x2.5 pinned, the table's x2.0) + the castCostFloor 5 at mastery |
| spellcast.test.js | 5 | verbatim saving throw (tolerance precedence Resistant>Immune, immunity->0, DF-Chronicles proration edges at exact rolls, 5..95 clamp + MagicResist), magnitude roll (base+plus x floor(level/per), per-0 guard) + damage-family gate + full resolve skipping non-damage, the CastSpell 45.454546 cooldown firing through the sink with origin, TARGET_TYPES verbatim + applySpell (the one door) vs a fire-immune foe (nothing lands) and a soft target, skipped-family count, the ranges-II pure targeting (touch reach + nearest-live + LOS gate + corpse skip, the 4.0 sweep in/out/dead) |
| magicitems.test.js | 3 | MAGIC.DEF verbatim 62-byte records (index = stream position, -1 unfilled enchantment slots, artifact types read), CreateRegularMagicItem routing (regular-only filter, group-byte tables, the arrow re-roll, magic name swap + condition = uses, -1 slots filtered), the MI loot halving loop firing with the registry set and skipping without |
| magicka.test.js | 3 | SPELLS.STD verbatim 89-byte walk on crafted records (subType ALWAYS read - the dead 0xFF sbyte branch documented; invalid all -1 record gated), the 0x1C00>>8 multiplier decode table + SpellPoints floor, DrainMagicka max(1, flat?mag:axis) + 0-floor through the action system |
| advancement.test.js | 3 | the 35-entry advancement-multiplier table + uses-needed/level formulas, the raise flow (360-min gate, reflexes bit math 0x10000-((r-2)<<13) incl VeryHigh 1.25x, uses reset, the 95+/mastery cap), the level-up sum shape (primaries + majors - min + max minor) + headless leveling applying HP and the 4..6 pool |
| arrows.test.js | 2 | the ranged-attack gate (bow foes strike from sight via events at full speed, melee foes stay distance-gated with the timer untouched), Short/Long Bow -> Archery mapping + recoverable landed arrows stacking on the target |
| chargen.test.js | 4 | verbatim stat rolls (base + 0..10 inclusive, pool 6..14), skill tiers (28/18/13 + 0..3, defaults 3..6), HP (25 + hpPerLevel; per-level floor 1 + endurance mod), the interim lowest-first pool policy + full create (totals pinned), skillValue dual shape driving formulas (weapon skill hits where HandToHand misses on the same roll), the verbatim starting-spell sets (Mage/Sorcerer shared, Bard single, >6 none, resolution skipping missing records loudly) |
| charsheet.test.js | 3 | raiseSkills with a sink sets ready+pending WITHOUT applying (headless path unchanged), applyLevelUp (HP roll + endurance mod pinned, hand distribution, flags cleared, idempotent), the level-up screen sharing the verbatim clamps (pre-level floor, pool-0 block, confirm gate) with the hand-built stats landing |
| chargenui.test.js | 3 | the four verbatim pool clamps (stat max 100/pool 0/floor-at-rolled with points returning; skill pool-only up/floor-at-rolled), the flow end to end (name/gender/class/stats/skills, pool-0 confirm gates, stat-total conservation pinned, group pools landing on their skills), reroll replacing the working set |
| effects.test.js | 3 | HealHealth (10,8) instant + the verbatim duration arithmetic (base + mod x floor(level/per), per-0 guard), continuous (1,0) joining actives with the ONCE-rolled save percent scaling EVERY per-round magnitude roll, tick + expiry at 0, immune saves never joining, empty lists safe, the S8 buff kinds (slowfall/waterWalking/chameleonNormal keys, incumbent RENEW not stack, duration arithmetic, expiry clearing the query) |
| effectactions.test.js | 4 | Hurt21 every-20th gate + verbatim exclusive Range * level (min<=max guard), Hurt22-25 flat/axis every activation + Poison as DFU's own empty delegate, chain cascade lever->spike (ActivateNext-first order, activationCount), the verbatim Receive trigger gate (Collision03 blocks Direct/passes WalkInto, chains always valid, MultiTrigger's exact trio, undefined flags never fire) |
| enemyattack.test.js | 3 | verbatim reset-timer arithmetic (Range/level/reflex terms, /980, 0-floor), the floored-speed >>3 roll gate, strike gating (range+sight+22.5deg yaw) + hit event at HIT_FRAME_MELEE |
| enemyentity.test.js | 3 | ClassFile verbatim 74-byte parse (incl the (a<<16)|(c<<8)|b shuffle) on a crafted record, class entity rules (level, HP roll bounds, skills clamp, career Speed, city-watch +3..6), monster rules (predefined level, inclusive HP range, armor*5) |
| fnt.test.js | 2 | verbatim FNT layout on crafted bytes (header, 240-entry table, the L/R half SWAP with MSB-first expansion - x0 from the odd byte, x15 from the even, bounds null), the white atlas (256x240, pixel spot-checks) + measure (space rule, 1px classic spacing) + row-1 cell UVs |
| hudtext.test.js | 1 | the popup queue (4-line cap dropping oldest, per-line 2s life with independent lifetimes across a late add, expiry, empty ticks safe) |
| hud.test.js | 3 | compass scroll verbatim (trunc(258 x heading), wrap both directions, the 64 window never exceeds the 322 strip), bottom-anchored bar fill (v-window + clamps + max-0 guard) + integer scale flooring at 1, indexed->RGBA with the classic index-0 transparency |
| inventory.test.js | 4 | the verbatim stackable rule (equipped/enchanted never), AddItem merge-vs-append incl material split, CalculateWeightForMaterial verbatim (quarter-kg quantized, banker half-to-even: iron and daedric daggers BOTH 0.5kg) + leather formula + transferAll, the house-container predicate (418xx group, the 13-index list, shop-shelf 5 excluded, record = id%100) |
| inputmap.test.js | 3 | the binding tables (overlay chars/controls/null, F5/F6/Backspace/KeyC/none), routeKey precedence (overlay wins so Backspace edits not opens, toggles fire, the cast dir threads, unconsumed falls through), the one-shot click-cast latch (unarmed nothing, fires once, double-arm single fire) |
| inventoryui.test.js | 2 | the inventory window (cursor wrap, weapon equip via callback, arrows refused, gold not equippable, close), the spellbook (the interim known-list from the file excluding caster-only/non-damage, an entity's own book preferred, ready callback, null-map empty) |
| loot.test.js | 3 | 22 matrix rows exact (key C pinned) + brace-bounded group lists (no cross-enum bleed), gold x level + the WP halving loop at exact roll consumption + the '-'-key empty path, level-split ingredients (C1 scales/C3 flat), arrows stack/material, book template+variant, gender clothing, unknown-key -> '-' |
| enemyequipment.test.js | 3 | verbatim material walk ([64,128,...] modifier table, level clamps), armor materials (70/90 split, plate+weapon-material), variant-0 loadout + the init-100/subtract/class-60-clamp armor pass, variant-2 + monster keep-better + city-watch itemLevel-1 + weapon-vs-weaponless averages |
| enemymotor.test.js | 4 | verbatim classic AI constants (sight/hearing/FOV/melee/turn/update-rate/system-divisor/walk-base), 11.25deg turn clamp, LOS wall + FOV gates, pursue-and-stop at MeleeDistance on the classic cadence |
| enterexit.test.js | 6 | verbatim landing offsets, door transforms, landing selection, dungeon exit, ladder climb, FixStanding floor snap |
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
| charsprite.test.js | 1 | shared pixelize pass: projection-exact ph/pw at CHAR_PIXEL, hand-computed center/half-extents |
| backstab.test.js | 3 | verbatim 8-orientation back-facing wheel (records 3/4, Unity half-to-even at 112.5/157.5, sign-symmetric), backstab channels (chance on chanceToHitMod, x3 post-calc roll), FP pose composition (base+clip, couplings zeroed) |
| charmesh.test.js | 2 | Face packing (fan order, color/normal interleave), bare-humanoid pack + bounds |
| paperdoll.test.js | 3 | 27-slot EquipSlots verbatim, 288-template DB (index resolution, Short Shirt pin), BlitItems order |
| dyes.test.js | 3 | Clothing dye range shifts (Blue identity, Red 0xEF), 11 metal tables extraction-pinned, band-only swap |
| equip.test.js | 5 | Slot-rule extraction pins (94 cases), hands verbatim, paired first-open, 2H right-hand rule, all-wearables corpus |
| maps.test.js | 9 | 62 regions, converters, climate, city + Privateer's |
| snd.test.js | 3 | 459 sounds, byte-exact header, zero-length record 5 |
| climate.test.js | 5 | applyClimate verbatim rules, texture-info classification, exterior-window table, nature/ground archives, 8820-combo corpus sweep (735 pairs, 0 missing) |
| spectral.test.js | 2 | SetSpectral constants + gray remap (eyes 14->247, 96-index), the V^1.9 emission lerp (red eyes, body toward black) on a hand-built albedo |
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


