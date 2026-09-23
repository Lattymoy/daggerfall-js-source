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

MAP-TOGGLE (2026-09-22, Mac: "Yes needs to be a toggle"): the door is
the skin AND a Features switch now (`enhanced-map`, `ui/mapSkin.js`),
so a player may keep the enhanced skin and take DFU's three windows
back; see Held-Map-Arc.md MAP-TOGGLE.

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
- **EM3 — the automap sheet**, and the key. SHIPPED:
  `ui/inkAutomap.js` (12 pins), `ui/automapSheet.js` (16 pins),
  `ui/automapDoor.js`, and the dungeon host plus both interior hosts
  wired through it. The wall is the outline of what was revealed, the
  wash is the floor walked this run (DFU's grayscale law read as ink
  rather than as brightness), the caret points where the player looks,
  the beacon breathes at the way in, and the floor strip runs down the
  right edge in the tab strip's own hand.

  **The strip's seam bug, found by a pin rather than by reading.** The
  floor strip's rows sit a gap apart narrower than two grab bands, so
  the first-match hit handed every press near a seam to the row ABOVE:
  a player aiming at Floor 1 got Floor 2, every time. Fixed in the
  shared grab law — one `grabHit` for both inked strips — by giving an
  overlap to the NEAREST box, measured to the ink rather than to the
  grown box. Shrinking the band to half a gap was the other option and
  was not taken: a band that stops being generous stops doing its job.

  **The sheet's own two findings.** The level was being derived once per
  FRAME rather than once per level, because the frame was keyed on the
  model wrapper's identity and a host is free to hand a fresh bag back
  on every call; it is keyed on the reveal index's own `rows` array now,
  which is built once per level. And the static key read the CACHE, so a
  storey change made it answer "none" until the next cut — and the
  window's kept ink layer is keyed on it, so the old storey's ink would
  have sat under the new storey's rule.

  **`key` joined the contract here**, held back through EM1 on purpose:
  deriving a hook's shape from one implementation is how a hook comes
  out the wrong shape, and the automap gave it the second. The world
  sheet answers false to every key — its own (the resume prompt, the
  info box, the travel panel's S/T/N/B) are about the WINDOW's phases
  rather than about the bay — and that is recorded rather than left to
  look like an oversight.

  **CRASH2's closed-population gate was widened, not relaxed.** A skin
  door made `interior.js`'s slot stop being a set of `new X(...)`
  literals and the pin went red, correctly: it had lost sight of what
  could arrive. `test/windowContract.mjs` follows a door now — its arms
  are the `new` calls in the door module, so the set is still exactly
  knowable, and each class is resolved to the module that DECLARES it by
  looking rather than by guessing a filename from the class name
  (`HeldMapWindow` lives in `heldMap.js`, and the guess
  `heldMapWindow.js` is the kind of silent miss that library exists to
  prevent). Any future door works with no edit.
- **EM4 — the town sheet.** SHIPPED: `ui/inkTown.js`,
  `ui/townSheet.js`, `ui/townMapDoor.js`, and both exterior hosts wired
  through it (15 pins).

  **The plan is TRACED, not stamped.** The shipped town map paints the
  FLD bytes as four flat colours and rotates the result under a camera.
  That is faithful, and it is a bitmap. Here the built-up pixels are an
  island whose sea is the street, and its shore is the same two
  functions that ink the bay's coast and the dungeon's walls. Shops,
  taverns and temples get the wash; a house is outline alone, which is
  what a house is on a plan you are reading to find a smith.

  **What the bytes cannot say is WHICH building a pixel belongs to.**
  They carry a type per pixel and no identity, so "wash what you have
  discovered" is not derivable from them and is not attempted:
  discovery is answered by the NAMES, which come off the building
  summaries and the discovery record and know exactly what they name.
  Written down because the absence looks like an oversight.

  **A ground flat is not a building**, found by a pin. `0xfb` is in the
  shipped map's SHOWALL set, which only its third view mode draws, so
  folding SHOWALL into the built set painted every patch of scenery as
  architecture.

  **The field is laid in NAMEPLATE-ANCHOR space**, and that is the
  sheet's one orientation law. The shipped map flips twice and its net
  effect DISAGREES with `nameplateAnchor` across blocks — higher
  `blockY` is a lower row in that texture and a higher row in the anchor
  — which it gets away with because the two reach the screen down
  different paths. Drawn as one picture they have to agree, and the
  anchor is the one obeyed: it is the names, and the names are the
  point. What a pin cannot settle, and is written down rather than
  assumed, is whether the picture is the right way up against the
  WORLD: that is one composed rotation either way and nothing in the
  harness renders anything. **It is a browser probe's question and
  Mac's eyes' — MAP-FIELD's own lesson, that nothing about a PICTURE
  can be seen from inside a test.**

  **The travel tag stopped being a constant.** `isTravelMap` was `true`
  for every held map, which was true while this window was only ever the
  bay. Once it also opens on a town or a crypt the constant became a
  lie, and the world host reads it (`sheetWindowUp`) to know a travel
  map is up. It is DERIVED off the slot now: true exactly where the bay
  is reachable.

  > **OPEN, AND MAC'S CALL: the bay tab from a town.** `mapTabs` says a
  > town offers the streets AND the bay, and the strip would show both —
  > but the town key does not hand the world sheet over, so the slot's
  > narrowing leaves that tab off. The reason is DFU's travel guards:
  > `toggleTravelMap` refuses to OPEN the bay with enemies nearby, with
  > a merchant's offer pending, in sunlight for a sun-damaged career, or
  > under a racial fast-travel block. Four checks, all at open time.
  > Handing the bay over on the town key walks past all four, and moving
  > them to commit time is a behaviour change to a ported, audited
  > system. So for now the town key opens the streets and the travel key
  > opens the bay, each with its own ladder, and the one window still
  > holds both sheets the moment that call is taken.
- **EM5 — the campaigns, and what only a browser can answer.** The
  campaigns are run: `tools/mutants/em1.json` (34, all dead),
  `em2.json` (29, 27 dead and 2 recorded equivalent) and `em34.json`
  (47, 44 dead and 3 recorded equivalent). Six pins in the two ink
  modules exist because a mutant walked past the first version of them,
  and two of the six taught the code something rather than the test:
  the FLD ground flat is in DFU's SHOWALL set (so folding that set into
  "built" painted scenery as architecture), and a reader that is not
  bounded on all four sides wraps a row, joining a building at one
  edge to a building at the other.

  **THE BROWSER PROBE IS WRITTEN AND IT FOUND THINGS.**
  `tools/enhancedMapProbe.mjs` stands real windows up in Chromium over
  synthetic fixtures, checks thirteen laws and writes a shot per sheet.
  Its first run caught a real bug and two real layout defects that no
  pin could have seen:

  - **The window held a world sheet it had nothing to ink one with.**
    The sheet map was seeded unconditionally, so the town key built a
    window with no bay data, the slot's narrowing saw a world sheet in
    hand and offered the tab, and pressing it would have shown a blank
    page — which is exactly the regression the narrowing exists to
    prevent, walked in through the back. The window holds a sheet only
    where it was given what to ink on it now.
  - **The floor strip sat under the right gauntlet.** It was
    right-aligned and centred down the edge, and the hands hold the
    sheet at its lower corners. It is top-anchored in the clear
    parchment now.
  - **Names were written through the tab strip, and under the
    gauntlets.** The paper's rectangle is not the part of it a player
    can SEE — MAP-FIELD3's lesson, learnt twice more. The window passes
    every sheet the band the strip has taken and the two thumb zones in
    paper space, and a sheet lays no WORD in either. Its lines still
    run under a thumb: a wall behind a hand is a wall you pan to see.

  The three recorded-equivalent mutants are the probe's checks now, and
  what remains for Mac's eyes is the one thing nothing automated can
  settle: **whether the town's plan is the right
  way up against the world.** The plan and the names cannot mirror
  against each other — that is pinned — but the pair could still be
  rotated as one, and only a real city loaded from real data says
  which.

## EM7 — the four quarters, in our hand

Mac, 2026-09-21:

> keep our own version of the colored buildings that classic uses

**THE FIRST CUT THREW AWAY THE ONE THING CLASSIC'S TOWN MAP HAS
ALWAYS HAD.** EM4 washed every ENTERABLE pixel in one flat sepia and
left a house as outline alone. It was legible, and it was monochrome:
classic sorts a town's bytes into four groups and paints each in its
own colour — the temple's tan, the shop's blue, the tavern's green,
the house's slate — and that single decision is why you find the smith
on it without reading a word.

The READING is kept whole. The PAINT is ours. Each quarter is traced
as its own island and washed in classic's own hue at a watercolour's
strength, so the parchment's cracks read straight through and the
sepia outline still sits on top as the drawing rather than as a border
round a block of colour. The wall is stroked ONCE over all four,
because a wall two quarters share would otherwise be drawn twice and
read heavier than a wall against the street.

**THE SETS LIVED TWICE, AND THAT WAS A HAZARD RATHER THAN UNTIDINESS.**
`ui/exteriorAutomapWindow.js` had the four byte groups for its stamp
and `ui/inkTown.js` had them for its trace, and DFU's four colour
defaults were typed out in *three* places in the classic window alone
(the paint, the caption swatches, and the fallbacks beside them). A
byte regrouped in one skin would have silently disagreed with the
other: the same building drawn as a shop on one map and a house on the
next. `ui/townQuarters.js` is the one home now, and both skins ask it.

Everything downstream is derived from that one ladder rather than kept
beside it — `isBuilt` is "belongs to a quarter", `isEnterable` is
"belongs to one that is not the houses", and the four washes and four
name inks are a law applied to `CLASSIC_ARGB` rather than colours
picked by eye.

**AND "FOUR COLOURS" IS MEASURED, NOT ASSERTED.** The first pin
checked that the four washes were four different *strings*, and it
passed at a wash alpha where the tavern's green and the house's slate
composited to within ΔE 9.8 of each other over the parchment — both
low-chroma, both pulled toward the paper by the same alpha. That is a
difference you can find when you look for it and not one you READ. A
wash pulls every hue toward the parchment, so the only honest question
is what comes out the other side: every pair now goes through CIE76
against the paper and must clear a floor, every name ink must clear it
too *and* stand far enough off the parchment to letter with, and the
alpha is pinned as the SMALLEST that clears rather than the largest
the sheet can bear.

## EM8 — the names, enhanced

Mac, 2026-09-21:

> plus let's enhance the location names on the buildings more

A town plan is read to FIND something. Three things were added, and
each of them is information rather than decoration:

- **A name is lettered in its own quarter's ink**, through the same
  ladder its own pixels went — reached by `quarterOfType`, the one
  place the `+ 1` between a summary's `buildingType` and the grid's
  byte is written, so the word and the wash under it cannot come to
  disagree about what the building is. A quest's name still overrides,
  because a quest is why the map is open at all. A building whose type
  is unknown is still inked, in the sheet's plain name pen: an unknown
  type is not a missing name.
- **A tick on the building, and a leader only when it is earned.** The
  nameplate solver displaces plates VERTICALLY to untangle them, which
  means a name's own position is not reliably its building's — DFU's
  own window gets away with it because its plates are screen-space
  labels over a rotating camera and nobody reads them as a plan. Every
  plate ticks its anchor; a plate pushed further than its own height
  gets a hairline back to that tick, stopping short of the lettering.
  A plate that did not move gets nothing, which is most of them.
- **A size that says what the name is.** The landmarks a player steers
  by — the temple and the tavern — stand a little proud of the run of
  shops, and a quest's name proud of them.

**THE WEIGHT IS APPLIED AFTER THE BAND, AND THAT ORDER IS THE WHOLE
OF IT.** The first cut multiplied inside the clamp, which looked right
and quietly threw the hierarchy away at both ends of the zoom: past
scale 2.4 every plate is already at `NAME_SIZE_MAX`, so a landmark and
the shop beside it came out the same size *exactly where the map is
most read*. A weight is a RATIO against the names beside it. The band
bounds the baseline; the weight rides on top; the true ceiling is the
band's own times the largest weight there is.

**AND `NAME_SIZE_MIN` IS UNREACHABLE**, which is worth writing down
rather than assuming: the baseline only reaches it below scale
`(NAME_SIZE_MIN/NAME_SIZE)^2`, and no name is laid at all under
`NAME_ZOOM_MIN`, which is higher. It is a guard against a future band,
not a size anything is lettered at.

The probe carries four more checks for all of this, and its town shot
is the answer to whether it reads: all four quarters traced, every
plate carrying its own quarter, a landmark lettered proud of the shops
at rest, and a quest proud of the landmarks.

## EM-BUG1 / EM-BUG2 — two the tabs cost, both from the same shape

Mac, 2026-09-21, from play:

> 1. Regression where your equipped weapon isnt stowed when the map is
>    out, and it shows the map and your weapon on the screen
> 2. You cannot press the M key to stow the map

Both are the price of the arc's own central move. Three windows became
ONE window with three sheets, and two laws that had been written for
the travel map alone did not widen with it.

**EM-BUG1 — one flag was answering two questions.** MAP-WEAPON gave the
weapon rig a gate: `if (sheetWindowUp()) return;` (`combat/weaponRig.js`),
because hands holding a map are not also holding a sword. The host
answered it off the window's own duck tag, `isTravelMap` — fine while
this window WAS the travel map.

Then EM4 narrowed that tag, correctly and for a good reason: once the
same window opens on a town or a crypt, a constant `true` is a lie,
because the tag also gates whether travel is offered from the sheet. It
became `this._slot.ids.includes('world')` — *the bay is reachable from
here*.

That is the right answer to the travel question and the wrong answer to
the weapon one, and nothing said the two were different questions. On a
town sheet and a dungeon sheet `isTravelMap` is false, so the gate
stopped firing and the weapon drew over the map. The fix is to stop
overloading the flag: `holdsScreen` is declared constant on the window
and answers only "a map holds the screen"; `isTravelMap` stays derived
and answers only "travel is offered here".

**...and three hosts never had the gate at all.** The second half, which
the flag hid. `sheetWindowUp` was wired in `scenes/world.js` and nowhere
else, because when MAP-WEAPON was written the world host was the only
one that could open the sheet. EM3 and EM4 gave the same window a door
in a dungeon, in a building and on the second exterior host; none of
those three rigs grew the term. So even with the flag fixed, the
dungeon automap would still have come up with a sword through it. All
four hosts read their own slot now.

**EM-BUG2 — the key that opens it could not shut it.** The sheet's
close arm was `code === 'Escape' || actionForCode(bindings(), code) ===
'TravelMap'`, written when the only way in was the TravelMap key. Every
door EM3 and EM4 added is behind the AUTOMAP key, so in a dungeon, a
town or a building the map opened on M and refused to close on it. The
classic twin has always taken its own binding back
(`ui/automapWindow.js`); this one takes both actions now, on every
sheet, because the tabs mean one window can be entered by either key and
the player should not have to remember which.

**WHAT LET THE FIRST ONE THROUGH.** `test/map3_heldpose.test.js` pinned
the gate — and pinned it as `isTravelMap`, so when EM4 narrowed the tag
the pin was updated to match the new shape and went green over the
regression. A pin that asserts the wiring as it is will always agree
with the wiring as it is. It now asserts the law instead: every host
reads its own slot, the screen tag is constant, the travel tag is
derived, and neither answers the other's question. Nine mutants, nine
dead, including one per host that simply removes the term.

## EM-BUG3 — the town plan stood in a space of its own

Mac, from play (2026-09-21): *"Heads up but enhanced local town maps are
rotated wrong. Not exactly sure the correct location but i was in the
corner of town and It thinks entirely different buildings are there."*

Two defects, one root: **the plan and everything named on it were in
different spaces**, and EM4's own note argued its way into both.

### The grid's rows run against +Z

`autoMapData` is an FLD-header grid, and the port already knows which way
those run — `buildGroundTilemap` reads `groundTiles[x][15 - y]` for "row
0 nearest Z=0" (`world/rmbLayout.js:268`). `ExteriorAutomap.cs:1481` is
that same law at 64 rows instead of 16, which is what the shipped
window's "per-block row flip" is.

`townBytes` copied `data[y * 64 + x]` straight into row `y`. So every
block's bytes lay **mirrored north-south** against the three things that
come off +Z directly: the nameplate anchors, the quest rings, and the
player's caret (`local.z / WORLD_PER_PX`, handed over by both hosts).
Within one block a tavern swapped ends with whatever faced it. Stand at
the edge of town, and your caret sits on somebody else's roof — reported
exactly as "entirely different buildings are there."

### And the sheet was the mirror of the shipped one

EM4's note read the shipped window as *disagreeing* with the anchor
formula across blocks, and obeyed the anchor instead. Compose the two
flips and there is no disagreement — they are one law:

    (gridH-1-b.y)*64 + y_src   ==   H-1-anchorRow

That is the anchor formula **seen from the screen**, where a higher +Z is
a higher row on the paper. Drawing the anchor row downward instead turned
the enhanced plan over against the classic map of the same town.

### The fix is one space and one transform

The field is laid in the shipped window's screen space directly, and
`sheetY(fieldH, anchorY)` is the single crossing for everything that
arrives in anchor space — the plates, the quest rings, and the caret
through `playerOnSheet`, so the overlay and the rest view cannot cross on
different paths. Nothing in `nameplateLayout.js` moved: the classic
window reads the same anchors and applies its own flip at
`toPanelScreen`.

### The pin that let it through

EM4 wrote a pin for exactly this question and then asserted the
arithmetic as written — *"local y 5 is field row 5"* — so it agreed with
the bug for as long as the bug stood. Its own note said the picture's
rightness "is a browser probe's question and Mac's eyes'." Mac's eyes
answered.

It is re-aimed onto an **equality between the two modules**, swept over
four grid cells and four blocks. The new pin stands a building and the
player on one spot in the world and checks they come out on one spot on
the paper, then checks the whole sheet against `buildExteriorLayout` — so
the two maps of one town can never be mirrors again. Seven mutations,
seven dead.

**The lesson, for the third time this month:** a pin that restates the
code will always agree with the code. The pins that caught things here
are the ones that made two independent modules answer the same question.

## Doctrine, unchanged

The sprite is Mac's, the maps are computed, the names are the game's
own strings drawn in a face the port ships. No ARENA2 raster enters the
repo through this arc either.

---

## MW-MAP1 (2026-09-22) - the M-key sheets take the Morrowind hands

EM3 and EM4 opened this window from the M key on every host and handed
it no `holder`, so the Morrowind hands lane (MAP3) stood only on the V
key's travel map. The holder is combat/weaponRig.js's `sheetHolderOf`
now and every door on every host with a rig passes it; the record is
Held-Map-Arc.md's MW-MAP1 section.

