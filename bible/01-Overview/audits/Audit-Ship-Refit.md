# AUDIT SHIP-REFIT - the removal, the ship refit and the seabed audited, 2026-10-29

Mac, of the change that took two vendored mods out and put the port's own in their place (`03-World/Ship-Refit.md`,
`03-World/Dungeon-Flora.md`, `03-World/Beautiful-Towns.md` TOWN-ITEMS): *"Audit this. Ensure its perfect"*.

Four lanes read a frozen copy of the pushed branch, each given the code and the request, never the author's
conclusions: the ship refit; the seabed; what the removal could break (saves, online, the decorator, the town items,
the locales); and the scrub and the record. The whole suite ran beside them with the game's data. Every fix below has
a pin that fails without it, and a mutant for each pin; a lane's finding was checked before it was fixed, and two of the
seabed checks it asked for were narrowed where they flagged what no player sees (S-15 below).

## The ship refit

| ID | Sev | Finding | Fix | Pin |
|---|---|---|---|---|
| S-1 | high | A chest's things "set down at your feet" were placed where the player stood before the door: the restore runs before the spawn. Every chest record of the removed mod's era (0 of 31 and 1 of 90 match a refit chest) took this path, and a save loaded on board put the pile outside every room. | `scenes/arrivalSetDown.js`: held while the room restores, landed at the spot the player is stood. | `arrivalSetDown.test.js`; `fb1012g_holdkept.test.js` re-aimed |
| S-2 | medium | Offline, with Replace Game Artwork off, the ships stood bare: the refit rode the mods' door. | `registerPortBuilding`: the port's own building files, behind no door. | `shipRefit.test.js` (the door shut) |
| S-3 | medium | A pile left on a ship's floor before the change could lie inside new furniture, hidden and unclickable. | A pile inside a closed solid is lifted out and set down on arrival (`insideSolid`: the ray up and three of four level rays meet faces from behind; a wardrobe's open back allowed, a table's open sides not). | `arrivalSetDown.test.js`, Daggerfall's own furniture with ARENA2 |
| S-4 | low | Two of the large ship's own lanterns hung inside a bunk and a wardrobe. | The bunk under the first gone, the arms locker's wardrobes either side of the second. | `shipRefitCheck.mjs`: every billboard clear of every piece |
| S-5 | low | Three small-ship deck crates stood up to 0.20 m into the bulwark, between the check's rays; the denser check then found nine hold crates 4-5 cm into the curved hull. | Each moved clear (5-25 cm). | `shipRefitCheck.mjs`: the shell's surface sampled every 4 cm |
| S-6 | low | A hold flat's billboard clipped a crate. | Moved 0.3 m. | the same check |
| S-7 | low | No pin for a stacked deck piece's lift, the foot table, or the deck carrying no flats. | Pinned. | `shipRefit.test.js` |
| S-8 | latent | A later vendorless file of the same name would have replaced the refit's entry. | The port's files in a list of their own; a live mod's file still answers first. | `shipRefit.test.js` |
| S-9 | record | The container counts held the open deck's crates, which are no containers; Come Sail Away's cabins went unmentioned. | `Ship-Refit.md` | - |

## The seabed

| ID | Sev | Finding | Fix | Pin |
|---|---|---|---|---|
| S-10 | high | A ring spot past its seed's block was judged by the seed's water: 17 plants in dry blocks and 2 shallow over every dungeon MAPS.BSA floods, 21 more in lairs past the Bay; the spread ran block by block, so plants across an edge stood 0.89 m apart. | A spot stays in its own block; the spacing counts every plant of the dungeon. | `dungeonFlora.test.js` |
| S-11 | medium | Plants stood on loot piles, quest items, foes' and the start's markers (14 of 435 within 1 m) and over the layout's flats. | 1.5 m from every such marker on its storey, 1 m from every flat (the fires' AUDIT REST II F3). | `dungeonFlora.test.js` |
| S-12 | medium | No level, edge or furniture test: a coral fan on a table, kelp 0.17 m from a 4.88 m drop, kelp inside a solid; a normal of 0.9 passed a 25.8 degree ramp. | The fires' C3 and F4: a normal of 0.99, level rings at 0.5 and 1 m, and at a wider plant's own half width; a face met from behind refused. | `dungeonFlora.test.js` |
| S-13 | medium | The plants stood bodies that clamped the swimming player, and five records were cover. | Swum through: `noCover`. | `dungeonFlora.test.js` |
| S-14 | low | Doors were measured from the hinge, 0.6 m off the leaf's middle. | `floraDoors`: an action door's model box. | `dungeonFlora.test.js` |
| S-15 | pins | The door, spacing and three-height rules died only in the ARENA2 test, which CI skips; the check tool laid each block alone at one seed and asked the law's own rays. | Every rule over fake probes; the check rewritten - whole dungeons at their seeds, twenty seeds a block, lairs past the Bay, its own denser rays. Its first run flagged a ramp's underside 1 m off as "inside a solid": narrowed to what a player sees (twelve of sixteen rays from behind; level under the footprint; an island 1.5 m out). | 33 mutants, all dead without ARENA2 |
| S-16 | medium | Found by the new check: eight bearings left a gap of a metre at a wide bed's edge, and a column stood in it; a wide bed overhung a step; `TEXTURE.106` record 6 is a column of bubbles, not kelp. | `clearanceBearings` (a gap at most 15 cm, turned by literal cosines); the foot ring; record 6 out. | `dungeonFlora.test.js` |
| S-17 | medium | Found by the check's `--all` sweep (3036 dungeons, 62,511 plants): the room's rays ran a fifth of a plant's height apart, from a tenth to nine tenths, so a 1.9 m fan stood 0.1 m under a lintel in three dungeons, one over a 15 cm stone, and, once those were read, three beside a bar 0.45 m deep. | The rays run from 6 cm over the floor, past what the level rule lets it rise, to the plant's top, no more than 15 cm apart up its height as round its edge; the check reads every 5 cm. | `dungeonFlora.test.js` |

## What the removal broke

| ID | Sev | Finding | Fix | Pin |
|---|---|---|---|---|
| R-1 | medium | DET's pieces and archive 1210/1230's items stood only while a town pack loaded; the removed mod had registered them at every boot (on by default, forced online), so decorations players had placed vanished with the towns off. | `installPortStandIns` at boot: 143 of the catalogue's 297 stand with every town mod off, as before. | `wd3_standins.test.js`, `decormods.test.js` |
| R-2 | low | 32 decorations' names renumbered and 18 pieces left the decorator. | `DECOR_MOD_KEPT`, the bottles' names kept: against the parent, no name moved and none left. | `decormods.test.js` |
| R-3 | low | An older build in the same room stood the removed mod's deck at the ships' pixel. | None: furniture, not ground. `GROUND_LAW` holds the land's heights to a print, its test kills a law moved without one, and no town's buildings have moved it. An older tab draws a sailor a crate's height off until it updates. | - |

## The scrub, the record and the suite

- **A title split across two comment lines** (`net/decorLaw.js`) escaped the line search; a search across line breaks
  finds no other. A slice tag that credited the removed mod's pictures, and "at their author's request", went too.
- **Comments the scrub made false** (`render/staticBatch.js`, `world/rmbLayout.js`, `formats/worldData/worldDataJson.js`,
  and "a ship refit since removed" in two stand-in tables) say what is true.
- **The suite:** the fires' tests mount the host's fire block alone, and the seabed's call stood in it (moved after it);
  `FLORA` was a second module's name (now `SEABED`); the hard-coded English counts fell and the map was written down.

## Not this change's

- **Immersive Travel's `WALLAA08` gate patch** (#1280) has never rebuilt to its author's sha256 from the game data this
  repository fetches: it fails at the commit that brought it, its three sibling patches rebuild exactly, and no
  serialiser code moved since. The loader warns and serves the rebuild; only the ARENA2 tests' exact pin fails. Which
  field differs cannot be named without the author's file.
- **`fb1002_audit.test.js` CRACK-LIP and `fb1009_yardfoot.test.js` HOME-FOOT** fail with ARENA2 on main as on this branch.
- **No picture of the seabed**: SwiftShader drew no frame of a flooded 11-block dungeon in 15 minutes.
