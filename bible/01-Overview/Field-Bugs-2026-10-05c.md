# FIELD BUGS 2026-10-05c - ramps the map never filled, ship parts no one could lift, the teleporters walked into, the companion who stood there, the cellar's foe in a save, and the windmills

Six player reports from the Discord of the day:

> 1. "This particular section of dungeon maps, where there is a steep upward incline in a hallway, never gets filled
>    properly. Can be confusing when trying to figure out where in a dungeon you haven't been yet."
> 2. "Impossibly heavy boats can never be retrieved from storage" - "I do not believe its possible to carry all this."
>    (Parts of Small Ship 'I', 450 kg, against 74.71 / 304.)
> 3. "windmill has disappeared at my ..."
> 4. 'Not sure if bug but revenants just "stand there" during fight sometimes' - "Hard to have them understand what to
>    fight, have to kite them INTO the enemy at times to register even if enemy is hitting me or im hitting them"
> 5. "Red brick, random teleporters not working" - "red brick sections are not always working at teleporters"
> 6. "Unable to access basement to finish quest." - "Haunted House quest has enemy under the floor. Yeomcroft residence,
>    Woodwing Palace, Wayrest."

Each root cause was found in the code and reproduced headless; each change is pinned by a test that fails on the code
before it, and its pins are mutation-checked (`tools/mutants/fb1005c.json`). No ARENA2 was at hand, so the reporter's
own ramp, alcove and house were not measured: where a report names a place, the cause is the one the code and the
vendored packs show, said so below. Nothing here was seen in a browser.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | a steep hallway incline never filled | the 3D map inked a face as floor only past a literal 0.6 lean (53.13 degrees); the motor walks to 70 and the flat plan already read that law, so Daggerfall's 55-degree ramps were inked as WALLS - revealed, but never the grey of ground walked | RAMP-INK |
| 2 | heavy ship parts never retrieved from storage | PackBoat lays her hold's weight on her parts and a hold has no ceiling, so a ship packed off a plundered hold was one 450 kg item: AddItem took it unasked, and set down, every take refused it for good | HOLD-WEIGHT |
| 3 | a windmill disappeared | WD3's own law: a block a town mod serves stands only the mills its records place, and five of Kamer's seven farms have none in either mod - online both mods are everyone's since 2026-10-03 | kept as DFU reads it |
| 4 | revenants stand there in a fight | a companion ranked foes by DFU's chain alone, whose +5 goes to a foe targeting NO ONE: an idle foe behind a wall outranked the one striking the player whenever it stood outside his view cone | ASSIST |
| 5 | red brick teleporters not always working | `addRelay` never carried a flat's mark, so a FLAT Teleport (Collision03) walked into asked for triangles it has none of and never fired; a model's teleporter, or a flat one clicked, still worked | FLAT-RELAY |
| 6 | the Haunted House foe under the floor | SEALED-CELLAR's own house (Beautiful Villages' MANRAS02 #3 at Woodwing Palace, its foe marker 3.15 m down past a shut stair), fixed the same day (#620), very likely after the reporter's build; what was left: a foe a save made inside the house holds came back in the cellar | SEALED-SAVE |

## RAMP-INK (1)

`ui/inkDungeonGL.js` (`FLOOR_FACE_NY`, `faceInkOf`). The held map's 3D sheet (`10-UI/Dungeon-Map-3D.md`) shades a face
by its normal's lean: floors take the pencil and the flagstones, ceilings a flat tone, walls a light wash by the light
with strokes on the shaded side. The floor test was `n.y > 0.6` - 53.13 degrees - in four places of the shader (the
climb the All-floors cut spares, the stones, the pencil, a flooded floor's wash) and in the stair-tread mark. The motor
walks slopes to `SLOPE_LIMIT_DEG` (70) and the flat plan reads exactly that (`systems/automapFloors.js` `FLOOR_NY`), but
the 3D sheet did not: a ramp of 55 degrees (the corpus has 53 and 55, `Field-Bugs-2026-10-02.md`) was inked as a wall,
a near-bare wash on its lit side - and at 53.13 itself, a 3:4 rise, each triangle fell either way on rounding.

The reveal was never the fault: the classic scans (`systems/automap.js`) reveal the ramp's row as they reveal any other
(measured headless, ramps of 30 to 65 degrees between two flat halls). DFU draws every face alike
(`DaggerfallAutomap.shader`, its normal tests commented out), so this is the port's own split (EM3-3D, Port-Ledger A).

The fix reads the one law: `FLOOR_FACE_NY = FLOOR_NY`, interpolated into the shader, the tread mark the same; the
waterline's upright faces are those neither floor nor ceiling. The storey vote (a row's storey is where most of its
level area lies) keeps its own 0.6: a steep ramp is walked and drawn, but is no evidence of a storey (automapFloors'
own ramp note, `LEVEL_NY`).

`test/em3_3d_dungeon.test.js` (+1): ramps of 30, 53, 55 and 65 degrees from the real `rowMesh` are floor, 75 a wall, and
the shader carries the constant, not a literal.

## HOLD-WEIGHT (2)

`systems/comeSailAway.js` (`partsTooHeavy`, `HOLD_TOO_HEAVY_TEXT`, `PackBoat`'s `lost`), `systems/csaBoatMenu.js`
(`tooHeavy`), `scenes/world.js` (`entity.maxEncumbrance`, the landfall's guard). "Parts of Small Ship 'I'" is Come Sail
Away's `ItemBoatParts` (1320), worth her deed's 100,000. SHIP-PACK made her parts weigh no more than the Large Boat's
(120 kg) and kept her hold's weight on top, as the mod's PackBoat does (`Come-Sail-Away.md` SHIP-PACK) - and a hold has
no ceiling but her speed (`UpdateBoatCargoMod`). So 120 kg of hull and 330 of plunder made ONE unsplittable item, added
to the pack with no gate (DFU's AddItem; a pick-up, a fast travel from her helm, an Overworld landfall). The bearer,
overloaded, set it down; from there every take - DFU's CanCarryAmount (`systems/itemTransfer.js` planTake) - answered
0 against 304 kg, for good. The transfer law is DFU's and right; the item should never have been made.

Now parts the bearer could never carry are not made: `partsTooHeavy` asks the take's own arithmetic
(`inventory.js` canHoldAmount) over an EMPTY pack - so a full pack still packs her as the mod does, and only parts no
take could ever lift are refused. PackBoat answers false before anything moves, as it does for a missing deed: her
hold stays aboard, her deed in the pack. The pick-up says "Her hold is too heavy to carry her packed. Lighten it
first."; the boat menu's Pick up shows the reason; a fast travel from her helm and a landfall leave her where she lies.
A LOST boat (`recoverLostBoats` - under the ground, no one can reach her) is packed whatever she weighs: parts in the
pack place from it, wherever they weigh. A host that reads no MaxEncumbrance packs as the mod packs.

Parts already set down in an indoor chest stay there: placing them from the chest needs water. In the wagon, the
remote list's Use places them outdoors (ItemBoatParts.UseItem from `remoteItems`, as DFU's window calls it).

`test/fb1005c_holdweight.test.js` (4); `test/shippack.test.js`'s landfall pin moved.

## Windmills (3)

Kamer's mills stand on seven farm blocks (`world/windmillMesh.js` PLACEMENTS: FARMAA00/01/02/05/06/07/09). WD3
(`03-World/Beautiful-Towns.md` "Windmills") stands a block served from world data with the mills its own records
place and none of his - Beautiful Cities loads after Windmills of Daggerfall, so in DFU the mods' farms are the ones
read (`world/rmbLayout.js`). Decoded from the vendored packs: only FARMAA04, 05 and 07 (and FARMBA04/05/07/08/09)
place a mill of their own, so FARMAA00, 01, 02, 06 and 09 stand none in either mod. Online both mods are everyone's
(`systems/onlineLane.js`), so from 2026-10-03 the mills of those five farms were gone for every player; a home bought
before WD3 keeps its own town classic (`layoutPins.js`), but a farmstead beside it is its own location and follows the
mods. Asked whether to stand Kamer's mills on those farms (a departure from DFU's load order), the owner gave no
preference: the law is kept as DFU reads it, and this is the answer to the report. Standing them would need each spot
measured clear of the mods' models (the game's ARCH3D) and no subrecord attached, so no building's key moves.

## ASSIST (4)

`characters/enemyTargets.js` (`COMPANION_ASSIST_PRIORITY`, `fightsOurSide`). A sworn revenant (`06-Systems/Revenants.md`
13) is a crew companion (`03-World/Naval-Combat.md` CREW-COMPANIONS): an allied foe with the motor's `follow`, choosing
its foe through DFU's target machine (`getTargets`, EnemySenses.cs:752-878). That chain knows no fight but the
candidate's own: +5 for a foe targeting NO ONE, +10 seen, 30 less the distance - and an unseen candidate is kept while it
stands in the spawn band (:824-825). A companion at heel faces where he last walked; with the orc striking the player
outside his 180-degree cone, an idle foe a few metres behind a wall outranked it. He took that one: walked into the
wall at it when the stealth roll found it, or stood at heel holding it when it did not - and the mutual pass drew the
idle foe onto him. Struck by the orc, DFU's retaliation (MakeEnemyHostileToAttacker) fixed it, and close, the orc was
seen: hence "kite them INTO the enemy". Reproduced headless with the real EnemyAI and target machine, a wall at x = 3.

DFU has no companion and no "assist the player" rule (every PlayerAlly use in its scripts read); the chain stays
verbatim for every other pair. A companion puts a foe fighting his side - a player, another companion, himself - first,
by `COMPANION_ASSIST_PRIORITY` (20): a foe in the fight is taken unless an idle one stands fifteen metres nearer. Every
host shares the machine (the dungeon's, the street's and the buildings' through `exteriorFoes.js`, `world.js`'s),
so the four hosts carry it at once.

`test/crewcompanions.test.js` (+1): facing the player, away from him and aside, the companion takes the orc, is not
pressed to the wall, and the idle foe is not drawn onto him.

## FLAT-RELAY (5)

`world/actionSystem.js` (`addRelay`'s `isFlat`). A red brick teleporter is an RDB Teleport action (`03-World/Player-Arc.md`
P10), on a model or on a flat - 25 of the corpus's 84 ride flats. AUDIT PRE-MERGE 0929 D1/D2 made the dungeon's
collision pass hear an action by its OWN triangles, and kept the box for an acting flat, which has none ("The acting
flats keep the box", `Audit-PreMerge-0929.md`): `o.isFlat ? standsOnAction(...) : actionContact(...)`. `addEffect` and
`addMoveFlat` carry the flat's mark; `addRelay` built its object without it. So a flat relay asked for triangles it was
never given and was heard by nothing: a Collision03 flat Teleport walked into never fired, a MultiTrigger or Collision09
one fired only when clicked, a model's always - "not always working". It carries the mark now; nothing else in `src/`
reads a relay's `isFlat`. A corpse on the floor before the wall cannot stop a walk-in (corpses carry no collider) and
takes a click only aimed under 0.6 m inside its box.

`test/audit0929_actions.test.js` (+1): an editor flat's Collision03 Teleport, laid out by the real `layoutRdbBlock`
and registered as `registerFlatAction` registers it, is heard when walked into and sends the body to its next object.

## SEALED-SAVE (6)

`systems/quest/markerCuration.js` (`curatedFrom`, `mendedFoeSpot`), `scenes/questFoeHost.js` (`restandMendedQuestFoe`,
`SEALED_SAVE_REACH_M`, `SEALED_SAVE_LEVEL_M`), `scenes/exteriorFoes.js` (`restoreWorld`'s `restandQuestFoe`),
`scenes/worldModes.js` (restoreInteriorPools). "The Haunted House" is C0B00Y00 (`place foe` at a remote House2).
Woodwing Palace (Wayrest, 23-785) is Beautiful Villages' grid; of its five House2, only MANRAS02 #3 stands its 199.11
under the floor - 3.15 m down, its stair shut by a floor tile, a rug over it: the screenshot's rug in a narrow passage.
That house is on SEALED-CELLAR's list (`Field-Bugs-2026-10-05.md`), which moved the marker to the hatch's near side and
merged the same day (#620) - by the times, very likely after the reporter's build. The name "Yeomcroft residence" was not mapped to its record without the game's
data; by elimination it is that one.

What was left: the load's mend (`mendCuratedMarkers`) moves a SAVED site's marker, never a foe a save made inside the
house holds, which SerializableEnemy's position stands back in the cellar. The mend now keeps where a marker stood
(`curatedFrom`), and the interior host's restore asks: a quest foe restored on its marker's old spot - on its level,
within a cellar's breadth - stands at the marker's new spot, as `standFoe` stands it. Anywhere else it stands where it
was.

`test/fb1004d_questmarkers.test.js` (+1).

## Records

Port-Ledger: SHIP-PACK (HOLD-WEIGHT), CREW-COMPANIONS (ASSIST) and EM3-3D (RAMP-INK) rows narrowed in place. Notes in
`Come-Sail-Away.md`, `Naval-Combat.md`, `Revenants.md`, `Dungeon-Map-3D.md`, `Audit-PreMerge-0929.md`,
`Field-Bugs-2026-10-05.md` and `Beautiful-Towns.md`. Mutants `tools/mutants/fb1005c.json`; `shippack.json` and
`ows2.json` re-aimed by content where the landfall and the menu lines moved.
