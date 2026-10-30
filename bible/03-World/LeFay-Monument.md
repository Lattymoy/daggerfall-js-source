# The Monuments to Julian LeFay and Patrick Stewart (LEFAY1, GOTHWAY-MONUMENT, STEWART-MONUMENT)

> DF-LOOK (2026-10-15, `01-Overview/DF-Art.md`): the monument's stone and its plaque are painted here again (DF-ART's swap to Daggerfall's records reverted), laid on in Daggerfall's colours as they go up - grained and snapped to the player's own ART_PAL.COL (`world/dfLook.js`).

THE PORT'S OWN (2026-10-08). Asked: *"In the middle of gothway garden, I want to build and implement a monument to
Julian LeFay, one of the creators of daggerfall, with the ability of people to interact and throw flowers on it."*
Moved (HOLD-MONUMENT, 2026-10-14, Mac: *"Move julian monument to outside of privateers hold"*) outside Privateer's Hold,
then back (GOTHWAY-MONUMENT, 2026-10-30, the owner: *"move the Julian monument to a more player facing location in
gothway. Where players mostly populate"*) to Gothway Garden's north entrance. A second (STEWART-MONUMENT, the same day:
*"add a Patrick Stewart monument in the Imperial City next to the gold white tower"*) stands by the White-Gold Tower.

Julian LeFay (1965 - 2025) led Daggerfall as its creative director and programmer, and is remembered as the father of
The Elder Scrolls. Daggerfall has no monument to anyone, so nothing here has a DFU original to be faithful to: it is a
departure, Ledger A (LEFAY).

## What stands

**Where (GOTHWAY-MONUMENT).** Gothway Garden's north entrance, where the road in from Privateer's Hold crosses the
town's border: the first town every new character walks into, and the way GOTHWAY-NORTH stood its bounty boards for
them (`11-Multiplayer/Wild-Zone.md`). `world/lefayMonument.js` `northEntrance` reads the town's own navgrid's last
rows (`ENTRANCE_BAND_M`, 8 m): the run of road across them nearest the border's middle, else the widest open way in.
`lefaySpotOf` closes that way, `MONUMENT_WAY_M` (3.2 m) either side of it and `MONUMENT_WAY_IN_M` (16 m) in, and
stands the monument on the open ground nearest it. On the freeware that is cell (88, 188): 5.6 m inside the border,
beside the road's west edge. With no way in it stands nearest the grid's middle, as LEFAY1 did.

The spot is found before the town's yards are placed, so they keep `MONUMENT_KEEP_M` off it, and the people's navgrid
is carved round it (`carveLefay`). The camp and exit code HOLD-MONUMENT used is gone with it.

**Where the spot's law is LEFAY1's.** The navgrid is DFU's CityNavigation carve (`world/city/cityNavigation.js`): every
automap byte a building, a tree or a lamp draws is closed, and the water with it, on the enhanced water table always
(AUDIT LEFAY1 A3). The spot is the nearest cell whose every cell within `MONUMENT_CLEAR_M` (5.8 m) is open, each road
cell under it `MONUMENT_ROAD_COST` (0.3 cells) further (`lefaySpot`). A function of the layout alone: every client
stands it on one spot. The people's navgrid is closed within `MONUMENT_CARVE_M` (3.6 m) of it.

**STEWART-MONUMENT.** Patrick Stewart gave Emperor Uriel Septim VII his voice in The Elder Scrolls IV: Oblivion, and
Daggerfall's emperor is Uriel Septim VII. His monument is LeFay's stone with its own plaque (`STEWART_PLAQUE`, record
5): PATRICK / STEWART on two large lines (one is too wide at twice the size), then THE VOICE OF / URIEL SEPTIM VII.
It stands on the tower's plaza in the Imperial City's centre slice (`isStewartSlice`, slice 312): `STEWART_AT`, 25 m
out from the rotunda's wall at bearing 80, north of the walk to the palace door (it faces east), 50 m from the
arrivals' marker before the door. `stewartSpot` takes it into the slice's location frame (the city's middle is four
blocks in each way). Its plaque names him and "The voice of Emperor Uriel Septim VII", with LeFay's rows. Ledger A.

**What.** Three octagonal granite steps (corner radii 2.8, 2.15 and 1.5 m, tops at 0.3, 0.6 and 0.9 m, the lowest sunk
0.4 m below the ground so a gentle slope never shows light under it), a marble pedestal (its base moulding, its die and
its cornice), a bronze plaque proud of each face of the die, and a marble obelisk to 6.4 m tipped in gilt to 6.95 m
(`buildLefayModel`). Every face is wound outward (the world pass culls the back). Its pictures are the port's own, made
at boot from noise under the pseudo-archive 38211 (`world/lefayArt.js`, `world/gate/gateArt.js`'s law): granite, marble,
gilt, plain bronze, and the plaque - bronze, bevelled, with the inscription cut into it in square capitals:

    JULIAN LEFAY
    1965 - 2025
    FATHER OF
    THE ELDER SCROLLS

No game data: nothing of the monument's stone comes from ARENA2.

**The flowers.** Daggerfall's own - TEXTURE.254's red and yellow roses, red and yellow flowers and white rose, the arena
crowd's table (`systems/arena/arenaCrowd.js` `THROWN_FLOWERS`, imported, never copied). A press on the monument throws one
from the hand (0.35 m under the eye) on an 850 ms arc, 0.9 m over the line at its middle, to a rest on the thrower's
side (within 0.7 rad of the bearing to them): on the top step (35% of throws), the middle (30%), the lowest (20%) or the
ground at its foot (15%) (`tossRest`, `flowerPlace`, `tossPoint`). At most one every 1.2 s. It is laid where it lands.

**The tribute is the character's.** Each character keeps how many it laid at each monument and the newest 48 where
they lay (`normalTribute`, `layFlower`; `systems/save/save.js` carries `lefayTribute` and `stewartTribute` - a save from
before it laid none). A pile laid stands there again after a load. NOTHING IS SENT: another player sees their own pile, not
yours, and does not see your throw.

**The press and the plaque.** In the street's one ray (`scenes/worldModes.js` `exteriorActivationTargets`, the
`monumentTargets` both exterior hosts hand it), two boxes under one key - its steps, and its column from the cornice's
square to its gilt point (`MONUMENT_BOXES`), so the air over its lower steps is not its own and a door seen past it is
not pressed into it - each met at its stone when the ray enters it over air or the eye stands inside it (its collider
bucket and its key are one name, `monument:<id>` - activate.js's CASTLE1 and DISC19-E laws), its reach a static NPC's
(6.4 m); too far speaks DFU's refusal. The plaque (WORLD-HOVER) names it -
"Monument to Julian LeFay", "1965 - 2025", "Father of The Elder Scrolls", and "You have laid N flowers here" once a
character has - and lists two rows: **Throw flowers** and **Read the inscription**. A press does the lit row; with no
row lit, Info mode reads the inscription to the HUD's lines, Steal takes nothing ("You leave the flowers where they
lie."), and anything else throws a flower ("You lay flowers for Julian LeFay.", the hand's swing sound).

## The four hosts

- `scenes/world.js` - WIRED. The pixel's build (`scenes/pixelBuild.js`) asks `monumentSpotOf` before the yards and
  keeps the answer on the pixel (`monument`: its id and its spot, the location frame), a near view only. One pool a
  monument (`scenes/lefayMonumentHost.js` `createMonuments`), made beside the Sigil Broker; `site(id)` finds the pixel
  that stands it. Framed, drawn, its flowers on the live flats' axis; taken down at a change of place, a re-anchor and
  a load. The words both share, and Stewart's, read through `t()` (`monument.*`).
- `scenes/exterior.js` - WIRED. The bench's Gothway Garden (`?region=Daggerfall&loc=Gothway Garden`): the same pools on
  its fixed frame. The bench cannot load the Imperial City's slices, so it never stands Stewart's (FLAGGED).
- `scenes/worldModes.js` - WIRED for the press both exterior hosts share: the targets and the `monument:` key's arm.
- `scenes/dungeonContext.js` - stands no street; nothing of the monuments reaches it.

## The pool's law

`createLefayMonument` stands the monument on its site's ground (the drawn ground, read when the spot moves and every
30 frames, and read afresh when the town is built again), restands its collider when it moves, and holds the collider
back while a body stands where it would first rise - anywhere in its footprint, its lowest step's corners and a
capsule's radius about them (`bodyTrapped`, AUDIT SET W1's law) - until they step off; never as it moves (a recentre
carries a body on its steps with it). A vertical recentre (the site's compensation) re-reads its ground at once. Its mesh is made
once; the laid pile is one billboard batch to a kind of flower, made again when the character's pile changes, riding
the monument's middle; a flower in flight is a batch of its own, freed when it lands. A transition lays what is in
flight - but a flower thrown before a save was restored (`systems/save/save.js` `restoresSoFar`, any load) lands nowhere. `dispose` frees the mesh and every batch. A game folder that will not give TEXTURE.254 leaves the flowers
unseen, and the count still counts.

## Verification

- `test/world/lefay1_monument.test.js` (26): GOTHWAY-MONUMENT - the town by its names, the way in (`northEntrance`),
  the spot beside it and never on it, and on the freeware Gothway Garden's own cell (88, 188), the Hold north of it
  (ARENA2 only). STEWART-MONUMENT - the slice, the spot on the plaza's open stone, its frame back through
  `imperialAnchorOf` from every block, both pools at once, his plaque, its letters and the save. LEFAY1's spot law,
  carve, stone, art, throw, tribute and pool, as before.
- `tools/mutants/gothway_monument.json`: 26 mutants, all dead. `tools/mutants/hold_monument.json` is RETIRED with the
  Hold's spot.
- `tools/mutants/lefay1.json`: 79 mutants, 79 dead (34 at the slice, 4 by lens A, 32 by lens B, 9 with lens C's fixes). Three more were
  run by lens B and left out as equivalent: the carve's bounds check (the clear disc is always in bounds and holds the
  carve's), `flowerPlace`'s ring fallback (an entry is normalised before it is placed) and `tossPoint`'s low clamp (a
  flight's k is never under 0 - a clock stepped back lands it).
- `tools/lefayProbe.mjs`: the monument drawn in a real WebGL2 context with the back faces culled - every part drawn
  from outside, a plaque on each face, and the inscription read back off the screen against its own picture (0.90
  correlation as drawn, 0.17 mirrored, -0.03 upside down).

## AUDIT LEFAY1 (2026-10-08)

**Lens A - the stone as the game draws it** (`4b9bfbf6c`). A1 (blocker): the world is DFU's, left-handed, and drawn so
(`world/mat4.js` THE HANDEDNESS LAW) - the plaque's u ran right to left on screen and every face read backwards; the
probe had drawn with a plain projection, the mirror of the game's, and certified it. It now draws with the game's
mirrored projection and clockwise front faces, and fails the old mapping. A2 (major): the cornice overhung the die with
no underside - the sky showed through it from the ground; capped. A3 (minor): the spot is read on the enhanced water
table always - on the classic table it could stand in the shallows, and a client on each lane stood it elsewhere. A4:
the people's carve is the clear disc (3.6 m), a walker's sprite clear of the ground ring. A5: a hole in a saved entry
and a NaN bearing refused.

**Lens B - the pool's lifecycle, its tests and its record** (an adversarial reviewer's 34 mutants against the slice's
pins, 31 of them surviving, and the record read against the code). B1 (major): a flower still in the air at a quick
load was laid in the LOADED character's pile - `restorePlayer` ran before the load's `destroyAll`, which lands what is
in flight - so a quickload within 850 ms of a throw added a flower to the save loaded, or to another character.
Each throw is stamped with the save's restore count (`systems/save/save.js` `restoresSoFar`, PORTAL1's), and one that lands
after the count moved is freed and laid nowhere - every load at once, the quick load's and the classic import's
(lens C's C4 found the latter). B2-B5: the pins the
survivors showed missing - the pool's own laws (a flight laid when its town goes, the lit row over the mode, no "0
flowers" line, the ground, the collider and the pile's batches made once, `dispose` freeing the pile), the A5 bearing,
the draws' order, every edge of a saved entry and the save's 48, the search's round bound, and the plaque READ off its
picture (its letters the right way round and up, centred inside its bevel - the slice counted cut texels, which a
mirrored or upside-down glyph keeps). B6: "all of 4 m round it open" overclaimed - the clear disc held open ground to
3.39 m at the diagonals; the words and the ground ring's pin say what it holds (5.6 m since C3). The record's carve
(3.2), its water switch and its counts were stale after lens A; corrected.

**Lens C - the hosts' integration** (an adversarial reviewer over both exterior hosts and the shared press, the
frame math, the transitions, the ray, the carve's consumers, the flowers' draw list and the save; those traced clean).
C1: the hold-back covered the pedestal alone - the steps' tops (0.6, 0.9) are over the motor's STEP_OFFSET, so a body on
the green when it first stood (a save from before it, in the first town out of Privateer's Hold) was walled in by
them. It covers the whole footprint now, and only as it first stands: a recentre carries a body on its steps with it.
C2: a vertical recentre moved the ground and not the site's x, z, so its stone stood up to 29 frames at the old
height; the site carries the vertical compensation and a change re-reads the ground. C3: the clear disc (4.0 m) and
the carve (3.6 m) were the same 21 cells - no way round it was held open, and on a green five cells wide the carve
could close the town's way through; `MONUMENT_CLEAR_M` is 5.8 m, every cell beside a carved one open (the spot may
stand a little further from the middle for it). C4: the classic import's restore, a load the B1 call did not reach -
B1's mechanism moved to the restore count, which every load passes. The merge's gates and the full suite on the merged tree found four
pins the branch had broken and never run - the peer's namer last (PEER-PLAQUE1), the wagon's draw beside the camps'
(HCC), one home for `ROAD_WEIGHT` (GOTHWAY-BOARDS' now), the pixel entry's bound (DISC20-C, 9500 -> 9700) - and one host
NUDE-HOSTS names; each mended.

## Not done / open

- **Not seen in the game.** Both spots are measured off the layouts (Gothway Garden's on the freeware), not by eye: how
  the monument reads beside the road in, and whether any of the port's later props stand on the plaza beside it.
- **Online, nothing is shared.** Each character's pile is its own. A shared tally would ride the account service (a
  table and a cached read, the yards' pattern - `scenes/homeYards.js`) and is not built.
