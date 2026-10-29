# FIELD BUGS 2026-10-29 - five #bug-reports threads

Five threads handed over as six screenshots with no word beside them. Each was read to its root on main's `c1f7101c0`
with the freeware's data (`tools/fetch-data.sh`). The owner decided the open ones (3 to 5) the same day. AUDIT FB1029
read 1 and 2 cold (`../audits/Audit-FB1029.md`).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Lordoldmanrets: "Alinor bridge bug" - "missing part of the bridge on both sides" | RUMARE-WATER let the river's bank vertices down a metre to the waterline, so each bridge's end stood over a metre-deep dip to the carved river | FIXED (BRIDGE-ENDS) |
| 2 | Fay: "Bounty targets in crypt" - "The Daedroths don't seem to spawn inside the crypt or in the overworld around it" | A graveyard's hunt stands in the open air, and the camp's stand refused every spot in the graveyard's own rect | FIXED (GRAVE-PACK) |
| 3 | AustinHale: "List of Ports with broke[n terrain]" - Westhead Moor, Aldwall Rock, Gothcroft, Antelibuton, Kalunnunu, Torval | The first five are #1184's town ground, which #1371 (FB1028 TOWN-GROUND) fixed; the list matches the ground before it. Kalunnunu stands 100 m over its harbour at its pixel's edge; Torval and Alinor stand in a bowl | Kalunnunu, Torval and Alinor: being built (the owner: "Ground meets the town", "Give them a relief") |
| 4 | YeetMa...: "Large portion of road in jabivia is also a body of water" | Basic Roads paves the Bay's sea ground, which stays at the sea's height, so Deep Waters draws its water over the road and carves under it (5 pixels; Sentinel's coast road at 421,374) | being built (the owner: "Lift the paving") |
| 5 | watchouttheres...: "Family between married characters not appearing for both players" | Recorded: each house raises its own children of a two-player union (Legacy-Arc section 9, FB1012d UNION-CHILDREN) | FIXED (UNION-CHILDREN, acct217; `06-Systems/Legacy-Arc.md` section 9a) |

## BRIDGE-ENDS: Alinor's bridges meet their banks (1)

`src/world/capitalAlinor.js` (buildAlinorBridges, alinorAbutments), `src/world/capitalWalks.js` (carveCapitalWalks),
`src/scenes/pixelBuild.js` (the walkers' grid).

FOUND. TESA-LORE's bridges run exactly from the river row's north edge to its south edge, each end 0.3 m over the
street, with no end face. Then RUMARE-WATER (`03-World/Tamriel.md`) laid a shore capital in two heights: a vertex a
water tile touches stands at the sea, a metre under the street (`world/terrain/capitalSea.js` capitalSeaGround). The
river's edge vertices are the bank's last tile's too, so that tile slopes a metre down to the water, under each end of
both bridges. The Deep Waters carve takes the river from there. On Alinor's pixel, built from the freeware: a dip a
metre deep across the bank's 6.4 m tile at each end, the deck's edge 1.35 m over the ground below it - the black band in
the report, and more than a step.

FIXED. Each end stands on an abutment over the bank's last tile, the deck's width. Its top is a ramp from 2 cm over the
street up to the deck's end, its parapets on, its sides and ends down into the ground. The ground is unchanged. AUDIT
FB1029 A1: a flat top 0.35 m over the street, like the old deck's end, stalled a walker's step-up on the game's motor in
over half its run-ups; the ramp stalls none. A2: the town's walkers stand on the terrain, so the abutments' cells are
closed on their grid; on the north bank they were Daggerfall's road.

The north abutments stand in the edge strip of two of Daggerfall's blocks (ARMRAL02, FIGHGL00), on cells their automaps
hold nothing on. PIN MOVED: `audit_tesa.test.js` A6-3 lets the abutments' rects, and nothing else of the model, into a
block; the ARENA2 pin reads the automaps.

Tests `test/world/fb1029_bridgeends.test.js` (4, one on ARENA2). Mutants `tools/mutants/fb1029_bridgeends.json` (16: 15
dead, 1 recorded equivalent with why). PIN KEPT: AUDIT TESA II C10's lane from each deck's end (`audittesa2c_capitals`),
its first 6.4 m now the abutment.

NOT CHANGED. The same slope stands before three quays, none reported: Alinor's kerb and piers 1.8 m out in carved water,
Torval's 2.2 m, and the Imperial City's Waterfront wall about 1.5 m out at one bearing. A walker cannot reach them from
the street.

## GRAVE-PACK: a graveyard's hunt stands at its graveyard (2)

`src/scenes/world.js` (_inAnyLocationRect, _standCampEncounter, _standBountyPack), `src/scenes/bountyHost.js`
(packTick). The law is `06-Systems/Bounty-Boards.md` section 14.

FOUND. The Crypts of Wickfield south of Eastcastle is a graveyard: Anticlere's location 302, pixel (504, 146), one block.
A graveyard's hunt never goes down into its crypt. It stands in the open air through the camp's stand, 60 to 110 m from
the hunter, and that stand refuses any spot in a location's rect (DISC19-F). The graveyard's rect runs a block past its
walls each side, 307 m across. On HEAD's own stand code with that rect, the pack stood on 0% of tries from the crypt's
door or the graveyard's middle, and 16% from a fast travel's arrival. A refused stand says nothing and tries again in 4 s,
so the hunter never heard of the pack. Once a pack did stand, a trip into the crypt forgot it: below, the host judged it
against the crypt's foes.

FIXED. The board hands the stand the hunt's own pixel, and that location's rect is not refused. Every other location's
rect still is. A pack stood outside is judged by the street's pool in every mode, and its beasts carry the place, so
WILD-ALERT treats them as wild (AUDIT FB1029 B1-B3).

Tests `test/scenes/fb1029_gravepack.test.js` (7). Mutants `tools/mutants/fb1029_gravepack.json` (18, all dead). PIN
MOVED: `test/systems/disc19.test.js`'s three source pins of the rect test and the camp's two refusals, now handed the
place; `tools/mutants/disc19.json` DISC19-F-camp-pitched-in-town and `wildalert.json`'s two rect records re-aimed by
content. bootWorld grows one logical line (the stand's `ownPlace`), under its ceiling.
