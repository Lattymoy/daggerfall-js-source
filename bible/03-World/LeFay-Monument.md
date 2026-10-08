# The Monument to Julian LeFay (LEFAY1)

THE PORT'S OWN (2026-10-08). Asked: *"In the middle of gothway garden, I want to build and implement a monument to
Julian LeFay, one of the creators of daggerfall, with the ability of people to interact and throw flowers on it."*

Julian LeFay (1965 - 2025) led Daggerfall as its creative director and programmer, and is remembered as the father of
The Elder Scrolls. Daggerfall has no monument to anyone, so nothing here has a DFU original to be faithful to: it is a
departure, Ledger A (LEFAY).

## What stands

**Where.** Gothway Garden, the Daggerfall region's hamlet (`world/lefayMonument.js` `isLefayTown`: the region by its
name in `REGION_NAMES`, the town by its own - a pack's read of the town keeps both), in every read of it. The spot is
the open ground nearest the middle of the town's block grid, read off the town's own navgrid
(`world/cityNavigation.js`, DFU's CityNavigation carve: every automap byte a building, a tree or a lamp draws is closed,
and the water with it): the nearest cell whose whole `MONUMENT_CLEAR_M` (4 m) round it is open, each road cell under it
costing `MONUMENT_ROAD_COST` (0.3 cells) of distance, so it stands on a green beside a street rather than across one
where the town has a green (`lefaySpot`, `lefaySpotOf`). A function of the layout alone: every client stands it on the
same spot. The wandering people's navgrid is closed within `MONUMENT_CARVE_M` (3.2 m) of it (`carveLefay`), so they
walk round it.

**What.** Three octagonal granite steps (corner radii 2.8, 2.15 and 1.5 m, tops at 0.3, 0.6 and 0.9 m, the lowest sunk
0.4 m below the ground so a gentle slope never shows light under it), a marble pedestal (its base moulding, its die and
its cornice), a bronze plaque proud of each face of the die, and a marble obelisk to 6.4 m tipped in gilt to 6.95 m
(`buildLefayModel`). Every face is wound outward (the world pass culls the back). Its pictures are the port's own, made
at boot from noise under the pseudo-archive 38211 (`world/lefayArt.js`, `world/gateArt.js`'s law): granite, marble,
gilt, plain bronze, and the plaque - bronze, bevelled, with the inscription cut into it in square capitals:

    JULIAN LEFAY
    1965 - 2025
    FATHER OF
    THE ELDER SCROLLS

No game data: nothing of the monument's stone comes from ARENA2.

**The flowers.** Daggerfall's own - TEXTURE.254's red and yellow roses, red and yellow flowers and white rose, the arena
crowd's table (`systems/arenaCrowd.js` `THROWN_FLOWERS`, imported, never copied). A press on the monument throws one
from the hand (0.35 m under the eye) on an 850 ms arc, 0.9 m over the line at its middle, to a rest on the thrower's
side (within 0.7 rad of the bearing to them): on the top step (35% of throws), the middle (30%), the lowest (20%) or the
ground at its foot (15%) (`tossRest`, `flowerPlace`, `tossPoint`). At most one every 1.2 s. It is laid where it lands.

**The tribute is the character's.** Each character keeps how many it laid and the newest 48 where they lay
(`normalTribute`, `layFlower`; `systems/save.js` carries `lefayTribute` in the player's snapshot - a save from before
it laid none). A pile laid stands there again after a load. NOTHING IS SENT: another player sees their own pile, not
yours, and does not see your throw.

**The press and the plaque.** In the street's one ray (`scenes/worldModes.js` `exteriorActivationTargets`, the
`monumentTargets` both exterior hosts hand it), two boxes under one key - its steps, and its column from the cornice's
square to its gilt point (`MONUMENT_BOXES`), so the air over its lower steps is not its own and a door seen past it is
not pressed into it - each met at its stone when the ray enters it over air or the eye stands inside it (its collider
bucket and its key are one name, `lefay:monument` - activate.js's CASTLE1 and DISC19-E laws), its reach a static NPC's
(6.4 m); too far speaks DFU's refusal. The plaque (WORLD-HOVER) names it -
"Monument to Julian LeFay", "1965 - 2025", "Father of The Elder Scrolls", and "You have laid N flowers here" once a
character has - and lists two rows: **Throw flowers** and **Read the inscription**. A press does the lit row; with no
row lit, Info mode reads the inscription to the HUD's lines, Steal takes nothing ("You leave the flowers where they
lie."), and anything else throws a flower ("You lay flowers for Julian LeFay.", the hand's swing sound).

## The four hosts

- `scenes/world.js` - WIRED. The pixel's build finds the spot (`lefaySpotOf` over the laid-out town, the water
  switch the people's navgrid is carved under) and keeps it on the pixel (`lefay`, the location frame); the people's
  navgrid is carved before they are made. The pool (`scenes/lefayMonumentHost.js`) is made beside the Sigil Broker,
  framed before the lights and the world pass, drawn in it, its flowers on the live flats' axis; taken down at a change
  of place, a re-anchor and a load, and stood again by the next frame that finds Gothway Garden built.
- `scenes/exterior.js` - WIRED. The bench's Gothway Garden (`?region=Daggerfall&loc=Gothway Garden`): the same pool
  on its fixed frame, the ground its one plane.
- `scenes/worldModes.js` - WIRED for the press both exterior hosts share (the targets, the `lefay:` arm with the
  too-far refusal and the plaque's lit row). Its interiors stand no street and no monument.
- `scenes/dungeonContext.js` - stands no street; nothing of the monument reaches it.

## The pool's law

`createLefayMonument` stands the monument on its site's ground (the drawn ground, read when the spot moves and every
30 frames, and read afresh when the town is built again), restands its collider when it moves, and holds the collider
back while a body stands inside its pedestal (`bodyTrapped`, AUDIT SET W1's law) until they step off. Its mesh is made
once; the laid pile is one billboard batch to a kind of flower, made again when the character's pile changes, riding
the monument's middle; a flower in flight is a batch of its own, freed when it lands. A transition lays what is in
flight. `dispose` frees the mesh and every batch. A game folder that will not give TEXTURE.254 leaves the flowers
unseen, and the count still counts.

## Verification

- `test/lefay1_monument.test.js` (13): the town; the spot (the middle, round a building, beside a road, all road, none);
  a laid-out town's spot equal to the people's own navgrid's; the carve; the stone's faces by picture and all wound
  outward; the plaque's face (its picture's top-left at the plaque's top, on the viewer's left, on all four faces); the
  art (deterministic, opaque, every letter drawn, every line fitting, the cut texels counted); a throw's rest and
  flight; the tribute and its round trip through the save; the pool (its ground, bucket, boxes, recentre, its town gone,
  no ground; held back from a body; the press's arms, the flight, the landing, the cooldown, the hover, a loaded pile,
  dispose); and the wiring in the hosts and the save.
- `tools/mutants/lefay1.json`: 34 mutants, 34 dead.
- `tools/lefayProbe.mjs`: the monument drawn in a real WebGL2 context with the back faces culled - every part drawn
  from outside, a plaque on each face, and the inscription read back off the screen against its own picture (0.90
  correlation as drawn, 0.17 mirrored, -0.03 upside down).

## Not done / open

- **Not seen in the game with ARENA2.** Gothway Garden's real layout is not in this tree: where the spot falls in it,
  how the monument sits among its buildings, and the TEXTURE.254 flowers' look on its steps are unverified by eye.
  The spot's law is the town's own navgrid, so it cannot stand in a building or on water; whether a green near the
  middle exists, or it stands on a road there, is the layout's.
- **Online, nothing is shared.** Each character's pile is its own. A shared tally (every player's flowers at the one
  monument) would ride the account service (a table and a cached read, the yards' pattern - `scenes/homeYards.js`) and
  is not built.
