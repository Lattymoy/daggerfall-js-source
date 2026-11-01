# The Monuments to Julian LeFay and Patrick Stewart

Two stone monuments the player can lay flowers on. Julian LeFay's (1965 - 2025, Daggerfall's creative director and
programmer, remembered as the father of The Elder Scrolls) stands at Gothway Garden's north entrance, the first town a
new character walks into. Patrick Stewart's, who voiced Emperor Uriel Septim VII in Oblivion, stands by the White-Gold
Tower in the Imperial City.

## How it works

- **LeFay's spot.** `src/world/lefayMonument.js` `northEntrance` reads Gothway Garden's own navgrid's last rows
  (`ENTRANCE_BAND_M`, 8 m) for the road in nearest the border's middle, else the widest way in. `lefaySpotOf` keeps that
  way clear (`MONUMENT_WAY_M` either side, `MONUMENT_WAY_IN_M` in) and stands the monument on the nearest open ground
  (`lefaySpot`): every cell within `MONUMENT_CLEAR_M` (5.8 m) open, road cells costed `MONUMENT_ROAD_COST` further. The
  navgrid is DFU's CityNavigation carve, read on the enhanced water table always. With no way in it stands nearest the
  grid's middle. The spot is found before the town's yards are placed, and `carveLefay` closes the people's navgrid
  within `MONUMENT_CARVE_M` (3.6 m).
- **Stewart's spot.** On the tower's plaza in the Imperial City's centre slice (`isStewartSlice`): `STEWART_AT`, 25 m
  out from the rotunda at bearing 80, facing east (`stewartSpot`).
- **The stone.** `buildLefayModel`: three octagonal granite steps, the lowest sunk 0.4 m, a marble pedestal, a bronze
  plaque on each face of the die, and a marble obelisk to 6.4 m tipped in gilt to 6.95 m. Its textures are the port's
  own, made at boot from noise under pseudo-archive 38211 (`src/world/lefayArt.js`). LeFay's plaque reads JULIAN LEFAY /
  1965 - 2025 / FATHER OF / THE ELDER SCROLLS. Stewart's (`STEWART_PLAQUE`) reads PATRICK / STEWART / THE VOICE OF /
  URIEL SEPTIM VII.
- **The flowers.** Daggerfall's own TEXTURE.254 roses and flowers, the arena crowd's table
  (`src/systems/arena/arenaCrowd.js` `THROWN_FLOWERS`). A press throws one on an 850 ms arc to a rest on the thrower's
  side: the top step 35%, the middle 30%, the lowest 20%, the ground 15% (`tossRest`, `FLOWER_RINGS`). At most one every
  1.2 s.
- **The press.** In the street's activation ray (`src/scenes/worldModes.js` `exteriorActivationTargets`), two boxes
  under one key (`MONUMENT_BOXES`, `LEFAY_KEY`, `STEWART_KEY`), at a static NPC's reach. The plaque lists **Throw
  flowers** and **Read the inscription**, and the count once the character has laid any. Info mode reads the
  inscription; Steal takes nothing.
- **Hosts.** `src/scenes/world.js` asks `monumentSpotOf` in the pixel build and keeps one pool a monument
  (`src/scenes/lefayMonumentHost.js` `createMonuments`). `src/scenes/exterior.js` stands LeFay's in its Gothway Garden
  bench. The dungeon host stands none.
- **The pool.** `createLefayMonument` stands the monument on the drawn ground, re-reads it on a vertical recentre, and
  holds its collider back while a body stands in its footprint when it first rises. The laid pile is one billboard batch
  a flower kind.

## Rules

- A monument to Julian LeFay where players can throw flowers (the owner). It stands at Gothway Garden's north entrance,
  where players mostly gather (the owner). A Patrick Stewart monument stands in the Imperial City next to the White-Gold
  Tower (the owner).
- The spot is a function of the layout alone, so every client stands it in one place.
- The tribute is the character's: each keeps a count and the newest 48 flowers (`MONUMENT_FLOWERS_KEPT`, `layFlower`),
  saved as `lefayTribute` and `stewartTribute` (`src/systems/save/save.js`). Nothing is sent: another player sees their
  own pile.
- A flower still in flight when a save is restored lands nowhere (`restoresSoFar`).
- Nothing of the stone comes from ARENA2. Without TEXTURE.254 the flowers are unseen and the count still counts.

## Daggerfall Unity

Daggerfall has no monument to anyone. This is the port's own departure (LEFAY).

## Code and tests

- `src/world/lefayMonument.js` - spots, carve, model, throw and tribute
- `src/world/lefayArt.js` - the stone and plaque textures
- `src/scenes/lefayMonumentHost.js` - the pools in the world host
- `test/world/lefay1_monument.test.js` - the way in, both spots, carve, stone, art, throw, tribute, pool and save; on
  ARENA2, Gothway Garden's own cell
- `tools/lefayProbe.mjs` - draws the monument in WebGL2 with back faces culled and reads the inscription off the screen
- `tools/mutants/lefay1.json`, `tools/mutants/gothway_monument.json` - the mutants

## Open

- Both spots are measured off the layouts, not checked by eye in the game.
- The exterior bench cannot load the Imperial City's slices, so it never stands Stewart's monument.
- Online, nothing is shared. A shared tally would ride the account service and is not built.
