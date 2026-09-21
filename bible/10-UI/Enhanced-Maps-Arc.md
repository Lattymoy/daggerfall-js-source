# The enhanced maps arc — one map, three sheets

Mac, 2026-09-21:

> Next thing we are going to work on is the enhanced automap/town map.
> The goal is using the existing enhanced map infrastructure and
> imprinting on that. And instead of 3 seperate keybinds, adding a tab
> toggle on the map itself. So if you open it in a dungeon, the world
> map would be not accessible, same for the town map. Additionally,
> we're going to put our own spin on the automap and town map
> themselves, enhancing the look like how we did we the world map. The
> automap should become a 2d map and floor based instead of the current
> 3D implementation, streamlining it.

## Where this starts from

`10-UI/Held-Map-Arc.md` built the enhanced WORLD map: Mac's sprite of
two gauntleted hands holding a blank sheet, with the Iliac Bay inked
onto the paper at runtime — the coastline off WOODS.WLD, the borders
off the politic bytes, the roads off Hazelnut's arrays, the names in a
hand-lettered face, pan and zoom moving the map under the pen. None of
it is a painted asset; it is a render of the port's own reading of the
data, which is the doctrine that lets it exist at all.

The other two maps never got that treatment. They are DFU's own
windows, ported whole (`ROAD-C c2/S5`–`S10`, audited at `AUDIT 67`):
the dungeon automap is a real 3D pass in a 320×200 native panel with a
cut plane the player slides up and down, and the town map is a CPU
composition of rotated screen quads over the block layout bytes. Both
are faithful. Neither is ours, and neither is readable next to the
world map.

## The four decisions, taken 2026-09-21

**One window, three sheets.** The paper, the hands, the thumbs, the
pan, the zoom and the Morrowind held pose are the WINDOW; what is inked
on the sheet is a TAB. Three map windows become one.

**The tabs are gated by where you stand, and the gate is one module.**
Mac's sentence — *"if you open it in a dungeon, the world map would be
not accessible, same for the town map"* — as a table:

| where | tabs | why |
|---|---|---|
| dungeon | automap | a crypt offers its own plan and nothing else |
| building | automap | a shop is inside too (Mac's own answer) |
| town | town, world | the streets, and the bay you would travel |
| wilderness | world | no streets to draw and no walls to cut |

One sentence behind it: **inside is inside**. The context is DERIVED
from the flags every host already keeps (`isPlayerInsideDungeon`,
`isPlayerInside`, whether the map pixel carries a location), never
declared by a host — a host that declares is a host that forgets.
`systems/mapTabs.js`, pinned in `test/maptabs.test.js`.

**One key.** `AutoMap` opens the map wherever the player is, on
whichever tab that place offers, and the tabs do the rest.

> **THE ONE PLACE MAC'S ANSWER COULD NOT BE TAKEN LITERALLY, recorded
> rather than quietly worked around.** Mac chose "TravelMap (V)
> retired from the registry". It cannot leave the registry: `TravelMap`
> is one of DFU's OWN action rows (`inputActions.js`'s list is
> SetupDefaults', and `ACTIONS.length` is pinned), and the CLASSIC skin
> still opens DFU's own travel map on it. So the row stays and what it
> OPENS changes: on the enhanced skin V is no longer a separate map, it
> is a second door into the one window, landing on the world tab when
> the place offers one (`openOn`). Nothing is lost and no third window
> exists. Say the word and V becomes a no-op on the enhanced skin
> instead — it is one line.

**The automap is 2D and floor-based.** Below.

## Floors, which Daggerfall does not have

There is no floor field to read, and the arc checked rather than
assumed: the `DungeonBlock` record parses x and z and no y
(`formats/mapsFile.js`), every block is laid at y zero
(`world/dungeonLayout.js`: *"Block (X, Z) sits at (X \* RDBSide, 0, Z
\* RDBSide)"*), `originY` appears nowhere in `src/`, and inside a block
the object roots are a 2D grid of models at whatever height they sit
at. DFU answers the question with a cut plane the player slides, which
is honest and unreadable — the player has to hunt for the height at
which a room appears.

So the storeys are DERIVED, in `systems/automapFloors.js`, from data
the reveal index already holds: every revealed row carries its CPU
triangles and its placement matrix (`ROAD-C c2/S7` put them there for
the picker).

**A storey is defined by its flat floor; a ramp merely belongs to one.**
This is the arc's first real finding, and it came from a fixture rather
than from thought. The first cut had ONE threshold — the motor's own
walk limit — and clustered the walkable triangles by height gaps. Two
rooms with a ramp between them came back as **one storey**, and it was
right to: a ramp puts a walkable triangle at every height between the
floors it joins, so a gap-walk over the walkable set has no gap to
find. Every real dungeon has ramps and stairs, so that cut would have
answered "one floor" for most of the game.

Two thresholds, and the split is the whole idea:

- `LEVEL_NY` (twenty degrees off flat) picks the triangles allowed to
  **vote** for a storey. A Daggerfall floor is laid flat; twenty
  degrees is slack for a model placed off square and well clear of any
  slope a player would read as a ramp.
- `FLOOR_NY` (`SLOPE_LIMIT_DEG`, the motor's own walk limit, one home)
  picks the triangles **drawn** on it.

A ramp is walked, drawn, and votes for nothing. Among the voters, a gap
wider than `FLOOR_MIN_GAP` (the player's own capsule plus the headroom
a room needs — a ledge you cannot stand up under is not a storey)
starts a new storey, and each storey's height is the AREA-WEIGHTED mean
of its voters, so one great hall decides a floor's level and a stray
step does not move it. A level of nothing but slopes falls back to the
walkable set rather than answering "no floors", because a map with no
storey on the strip is a map that draws nothing.

**The plan is a coastline.** Assign every walkable triangle to the
nearest storey, rasterise its XZ footprint into a grid of cells, and
the storey's plan is the OUTLINE of the covered cells — which is
`boundarySegments` + `linkSegments`, inkMap's own two functions, the
ones that ink the Iliac Bay. The walkable area is an island and its
shore is the wall; `roundCorners` softens the stair-step exactly as it
softens the coast, so the two maps are drawn by the same hand. A ramp
lands on both storeys it joins, which is what a ramp is.

Nothing about the SAVE changes: `revealed` / `visitedThisRun` are flat
key sets, floor-agnostic, and the storeys are a pure derivation over
them.

## What stays classic

The classic skin keeps DFU's own windows, whole and untouched — the
native automap panel, the town map, the travel map, their chrome, their
console verbs and their pins. This arc is the ENHANCED skin's, behind
the same skin door `ui/travelMapDoor.js` already forks on. A departure
here is a departure from DFU only where the enhanced skin is worn.

## The window is the paper; the sheet is the ink

The held window is 2,244 lines and every one of them was audited twice
(`AUDIT-MAP`, `AUDIT-MAP2`). EM1 did not move them. It put a SEAM in
front of them and routed the window through it, which is the difference
between an architecture and a rewrite.

The contract is `SHEET_MEMBERS` in `ui/mapStrip.js`, and it is three
things: the SPACE (`size`, which the pan and zoom clamp against), the
INK (`ensure`, `staticKey`, `paintStatic`, `paintOverlay`) and the
POINTER (`pickAt`, `hoverLabel`, `mark`), plus a clock and a
`mount`/`unmount` pair for the shared chrome a sheet claims while it is
up. The window keeps the parchment, the hands, the pan, the zoom, the
Morrowind pose and the closing; it asks the SHEET for everything else
and never asks WHICH sheet — a pin walks the class and fails on any
comparison against a sheet's name, because a window that knows which
sheet is up is a window that grows a special case per sheet, which is
the three windows this arc exists to collapse.

**Keys and chrome are deliberately not in the contract yet.** The world
map's keys are tangled with the window's own phases and boxes (the
resume prompt, the info box, the travel panel), and the automap's — a
floor up, a floor down — arrive with EM3. Deriving a hook's shape from
ONE implementation is how a hook comes out the wrong shape, so the hook
is written when there are two.

The world sheet is therefore an adapter built inside the window, closing
over it, every member delegating to the method that has always done the
work. EM3's and EM4's sheets are standalone modules with no such
back-reference. When the world map's travel half follows them out, the
adapter shrinks to nothing and the contract does not move.

**The strip is INK, not chrome**, and the reason is MAP3. Every other
control on this window is a DOM node laid over the sprite; a DOM tab
would float in front of the Morrowind arm when the rig is holding the
sheet. Inked in paper coordinates, the tabs go round the corner with the
paper and the pointer reaches them through the same inverse homography
the marks are picked through, for free. They ride the KEPT static layer,
so a breathing ring costs no re-lettering, and the live tab is part of
what makes that layer stale.

**THE ARC'S MID-FLIGHT GATE.** The slot's offer is the place's offer
narrowed by the sheets the window actually holds. EM1 ships the world
sheet alone, so wherever the map opens today the strip reads "The Bay"
and there is no second tab: nothing a player can reach has moved. A
place whose every sheet is missing answers `empty` at the door rather
than opening a blank page. The narrowing is over the window's own sheet
map rather than a literal, so it lifts itself the moment EM3 and EM4
hand their sheets over — and until then it is impossible to ship a tab
that inks nothing.

## The slices

- **EM1 — the sheet contract and the tab strip.** SHIPPED: the tab law
  (`systems/mapTabs.js`, 5 pins), the strip and the slot
  (`ui/mapStrip.js`, 11 pins), and the window routed through the
  contract with the bay unchanged (`ui/heldMap.js`, 7 pins in its own
  suite). 31 mutants, 31 dead. The KEY WIRING waits for EM3/EM4: a key
  that opens a blank sheet is a regression, so `AutoMap` keeps its two
  windows until there is something to ink.
- **EM2 — the floor model.** SHIPPED: `systems/automapFloors.js`, 14
  pins over hand-built geometry — two stacked rooms, a ramp, a wall, a
  sliver, a partly revealed hall, and the coastline chain landing on
  the room's true edges in world units. 29 mutants, 27 dead and 2
  recorded equivalent.

  **The campaign paid for itself.** Seven mutants survived the first
  run, and every one of them was a fixture that was too tidy: quads fed
  bottom to top (so nothing proved the sort), every triangle wound the
  same way (so nothing proved the inside test agreed with the facing
  test), every room with a flat floor in it (so nothing proved a cave
  of pure slope still gets a storey), and a `FLOOR_MIN_GAP` held only
  BY VALUE — where the motor's capsule is 1.8 and the headroom 1.2, a
  hardcoded `3.0` agrees today and stops agreeing the day the player's
  height moves, so that law is now held at the source as well.

  The last survivor taught the module something about itself: the
  `len > 0` facing guard looks redundant beside the area guard, since a
  zero-area triangle is dropped either way. It is not. A NaN vertex
  gives `area` of NaN, and `NaN < MIN_TRI_AREA` is FALSE, so a bad
  position sails past the area test and lands in the list at `y: NaN`,
  where it sorts unpredictably and drags a storey to nowhere. Only a
  guard written as `!(len > 0)` catches it, and only a fixture with a
  NaN vertex proves so.
- **EM3 — the automap sheet**, and the key. The floor plan in the world map's pen,
  visited-this-run and previously-revealed as two pen weights (DFU's
  grayscale law, as ink), the player caret, the entrance beacon, doors,
  teleporters and user notes; the floor strip. Wired into the dungeon
  host and both interior hosts.
- **EM4 — the town sheet.** The town plan in the same pen over the
  block layout bytes and the building summaries, with the discovered
  nameplates in the hand-lettered face and the quest-marked residences.
  Wired into the two exterior hosts.
- **EM5 — records, mutants, probes, PR.**

## Doctrine, unchanged

The sprite is Mac's, the maps are computed, the names are the game's
own strings drawn in a face the port ships. No ARENA2 raster enters the
repo through this arc either.
