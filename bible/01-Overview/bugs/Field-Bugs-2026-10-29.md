# FIELD BUGS 2026-10-29 - six #bug-reports threads

Six threads handed over as screenshots with no word beside them. Each was read to its root on main's `c1f7101c0` with
the freeware's data (`tools/fetch-data.sh`).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Lordoldmanrets: "Alinor bridge bug" - "missing part of the bridge on both sides" | RUMARE-WATER let the river's bank vertices down a metre to the waterline, so each bridge's end stood over a 6.4 m slope to the carved river | FIXED (BRIDGE-ENDS) |
| 2 | Fay: "Bounty targets in crypt" - "The Daedroths don't seem to spawn inside the crypt or in the overworld around it" | A graveyard's hunt stands in the open air, and the camp's stand refused every spot in the graveyard's own rect | FIXED (GRAVE-PACK) |

## BRIDGE-ENDS: Alinor's bridges meet their banks (1)

`src/world/capitalAlinor.js` (buildAlinorBridges).

FOUND. TESA-LORE's bridges run exactly from the river row's north edge to its south edge, each end 0.3 m over the
street, with no end face. Then RUMARE-WATER (`03-World/Tamriel.md`) laid a shore capital in two heights: a vertex a
water tile touches stands at the sea, a metre under the street (`world/terrain/capitalSea.js` capitalSeaGround). The
river's edge vertices are the bank's last tile's too, so that tile slopes a metre down to the water, under each end of
both bridges. The Deep Waters carve takes the river from there. On Alinor's pixel, built from the freeware: a 6.4 m dip
at each end, the deck's edge 1.35 m over the ground below it - the black band in the report, and more than a step.

FIXED. Each end stands on an abutment over the bank's last tile: the deck's width, its top 0.3 m over the street like
the deck's end, its parapets on. The ground is unchanged.

The north abutments stand in the edge strip of two of Daggerfall's blocks (ARMRAL02, FIGHGL00), on cells their automaps
hold nothing on. PIN MOVED: `audit_tesa.test.js` A6-3 lets the bridges one ground tile into a block, as it lets
Solitude's terraces; the ARENA2 pin reads the automaps.

Tests `test/world/fb1029_bridgeends.test.js` (2, one on ARENA2). Mutants `tools/mutants/fb1029_bridgeends.json` (6, all
dead).

NOT CHANGED. Alinor's quay kerb and piers stand 1.8 m out past the same slope, in carved water. No player reported it.

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
rect still is. A pack stood outside is judged outdoors alone.

Tests `test/scenes/fb1029_gravepack.test.js` (3). Mutants `tools/mutants/fb1029_gravepack.json` (9, all dead).
