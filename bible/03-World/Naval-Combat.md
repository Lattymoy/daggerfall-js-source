# Naval Combat

The sea fight, in the spirit of Assassin's Creed Black Flag: aim and fire broadsides by looking to a side, brace, board
and plunder struck ships, and meet the Iliac Bay's pirates, merchantmen and three crowns' navies sailing the same hulls
as the player. Ships berth, depart and voyage between ports; a named crew lives aboard and follows ashore. Online the
sea is shared. The player meets it at the helm of an armed boat (`Come-Sail-Away.md`).

## How it works

- **The guns** (`src/systems/naval/navalBallistics.js`, `navalGunnery.js`). At the helm the look's bearing off the bow
  picks the battery (`sideForBearing`: bow chasers, stern, port or starboard). Holding Attack lays the guns under the
  look, on the sea or on a ship's point; every muzzle's arc is drawn to its splash or mark, red when it will strike. The
  broadside camera eases out over that side. Releasing fires a ripple down the side. Closed-form ballistics, batteries
  per hull, reload and aim; four shot kinds (`Naval-Refit.md`).
- **Brace.** Crouch at the helm braces: half hull and sail damage while held, no gun fires or loads.
- **What a ball does** (`src/systems/naval/navalDamage.js`, `navalShots.js`). Hull, sails, crew, fire and the waterline;
  a ship goes through its states to struck colours, founders or burns. An enemy's battery runs out visibly before it
  fires, and "BROADSIDE" warns when it bears.
- **The ships of the Bay** (`src/systems/naval/navalShips.js` `SHIP_CLASSES`, `CROWNS`). Nine classes in three trades
  on Come Sail Away's hulls: pirate sloop, brigantine, corsair galley and flagship; coasting trader, merchant galleon and
  merchant carrack; navy cutter and war galley. The navies serve Daggerfall, Wayrest and Sentinel. Names and captains
  come off the region's name bank. Captains sail and fight by their trade and temper (`src/systems/naval/navalAI.js`);
  the traffic is directed by `src/systems/naval/navalDirector.js`.
- **Ship life** (`src/systems/naval/shipLife.js`). A port's harbour is found off the terrain with its berths and mouth.
  Ships keep errands off their seed (moored, depart, voyage, arrive, patrol, lurk) along a bounded path over the water.
  Each hull's water grid keeps her own beam clear, walks the built ground's tiles, and searches coarse cells where the
  fine search runs out. A ship that comes no nearer her mark takes her next point or a detour. A departing ship makes
  for the nearest harbour her grid reaches, else sails out where the water carries her. Ports also keep fishing boats
  (`src/systems/naval/fishingBoats.js`), each working a ring of water her grid reaches.
- **Boarding and plunder** (`src/systems/naval/navalBoarding.js`, `navalPlunder.js`). A struck ship within reach is
  hauled alongside by grapples and boarded; on foot a struck ship's side can be boarded too. Taken, the plunder window
  opens: its hold (DFU's loot tables), one thing to take, and its fate. A struck ship can be claimed as the captor's own
  boat.
- **The law and the quests** (`src/systems/naval/navalLaw.js`). Piracy is `Crimes.Piracy` through `LowerRepForCrime`;
  the crowns keep notoriety. A pirate that grapples a crewed boat brings Warm Ashes' own raid onto its deck; a pirate
  flagship starts `WAQ_SHIP_ATTACK_PIRATE` (`Warm-Ashes-Ships.md`). Warm Ashes' raiders sail as pirate ships near the
  player at sea (`src/systems/naval/navalRaiders.js`).
- **Crew** (`src/systems/naval/shipCrew.js`, `crewLife.js`, `crewCompanions.js`). Named hands with spirits work the
  deck, take posts (`Holdings.md`), repair at sea, keep the watch by night, and follow ashore as companions through
  every door. The player's crew is spared friendly fire.
- **The UI** (`src/ui/naval/navalHud.js`, `navalPlunderWindow.js`). Enhanced Plus on either skin: the ship plate, the
  battery rose, the aim readout, the target card and the plunder window.
- **Sounds and picture** (`src/systems/naval/navalSounds.js`, `src/render/navalRender.js`). Synthesised clips baked to
  DAGGER.SND's format; smoke, muzzle flame, spray, splinters, foam, balls in flight, deck fires on Daggerfall's fire flat.
- **Online** (`src/systems/naval/navalWire.js`). One player stands the sea for everyone near and others see puppets; a
  ship is its seed, the same in every client's sea, handed over by count. Ships, volleys and barrels ride the foes
  frame. A blow on another player's boat goes to its owner; a boarding claims the ship.
- **The host** (`src/scenes/naval/navalHost.js`). Only the world host has a sea; every transition, teleport and load
  empties it.
- **The save.** `NavalCombat` in the mod save registry (`src/systems/modSaveData.js`): each boat's hull, sails, crew,
  fire and state by its deed's UID, the crowns' notoriety and the raids started. The sea's ships are rolled again.

## Rules

- Proper naval combat referencing Black Flag; aim and fire from the side; sailing ships to encounter and pillage,
  integrated into the pirate quest system; Enhanced Plus UI; integrated into online (Mac).
- The Features row **Naval Combat** (group Combat): the switch (`naval`, on, forced on online), Ships at sea (few, some,
  many), Pirates board you, Raiders' plunder, Broadside camera, Ship handling (Responsive or Classic), Crew repairs on
  their own. A shared sea sails at the lowest Ships at sea among its players. With Come Sail Away off there is no sea
  fight.
- The player's boat is wrecked, never sunk. Nothing of the player's goes down with the sea's ships.
- Brace is the Crouch action at the helm: every letter key is spent, and ducking behind the rail is what bracing is.
- Tamriel: ships sail every sea the world streams; ports past the Bay keep the nearest Bay crown (`Captains-Sea.md`).

## Daggerfall Unity

Daggerfall has no sea fight and DFU none either. Departures (NAVAL COMBAT): the whole design; Come Sail Away's way and
sails take the sea fight's word (a shot-up rig's share, sails refused, the haul's brake); Warm Ashes' Leave Ship asks
a gate first; a pirate flagship starts the quest the mod never starts.

## Code and tests

- `src/systems/naval/` - ballistics, gunnery, damage, shots, ships, AI, director, boarding, plunder, law, raiders,
  crew, ship life, wire
- `src/scenes/naval/navalHost.js` - the host; `src/render/navalRender.js` - the picture; `src/ui/naval/` - the UI
- `test/systems/naval/nav_a_guns.test.js`, `nav_b_picture.test.js`, `nav_c_ships.test.js`, `nav_d_boarding.test.js`,
  `nav_g_online.test.js`, `nav_h_host.test.js`, `nav_r_raiders.test.js` - the slices
- `test/systems/naval/shiplife.test.js`, `fishboats.test.js`, `crewcompanions.test.js`, `shipwatch.test.js`,
  `shipclaim.test.js`, `tougherships.test.js`, `seaease.test.js` - ship life, crew and the later systems
