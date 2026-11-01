# Shipyards, Crew Halls and Lighthouses

Every port town on the open sea has a shipyard with a shipmaster who sells and buys every hull, repairs and refits
ships, a crew hall with a daily roster of named sailors to sign on, and a beacon tower with a keeper that the player can
climb. They are found on the town map, on the Overworld and by asking townsfolk. The piers are dressed with timbers and
fittings.

## How it works

- **Which towns** (`src/systems/portPlaces.js` `isPortTown`). A city, town or village that is a port by its data
  (Travel Options' harbours, `src/systems/travel/travelPorts.js` `hasPort`, or Daggerfall's port byte) and that the
  open sea bears on: a pixel of sea reaching the map's border within two pixels (`src/world/portSites.js`
  `portTownOnSea`, `openSeaOf`). Past the Veil the Eltheric Ocean's water counts as open sea.
- **Where** (`src/world/portSites.js`). On the town's own open ground at its seaward edge, placed on the ground the
  Stables and Wagon Yard leave (`Merchant-Yards.md`), before the Joinery. Like the yards, a port's places take no
  building record, deed or quest place.
- **The shipmaster's window** (`src/ui/shipyardWindow.js`, host half `src/scenes/shipyardHost.js`). Rows: **Ships for
  sale**, **Your fleet**, **Shipwright**, **Refits**. Ships for sale (`src/systems/shipyards.js` `SHIPYARD_HULLS`): the
  Rowboat (sold as parts into the pack), the Large Boat, the Small Ship, the Carrack and the Large Galley (sold as deeds
  entered in the Fleet's book at this port), at Come Sail Away's prices (`HULL_PRICES`). A purchase asks a second press.
  With Come Sail Away off nothing is sold.
- **The price** is a yard's counter (`YARD_QUALITY`, `YARD_PRICE_INDEX`), haggled by the counter's one law. Online a
  sale is capped at half the least ask, so buying and selling back never pays.
- **Your fleet.** Every ship of the player's, where she lies, her worth (`shipWorth`: what she was bought for, never
  more than a new hull, by her state) and the offer. Bring her here, lay her up, rename, sell. The shipmaster buys only a
  ship that is here, empty of cargo and cabin goods, not at her helm, fighting or crewed by another player, and never
  one that came into the realm through customs (`src/systems/realmCustoms.js`).
- **The crew hall** (`src/systems/crewHall.js` `recruitsOf`). `RECRUITS_A_DAY` (6) sailors a day, seeded on the town's
  map id and the day so every client meets the same roster: a name, a class of the crews', a grade (Green, Able,
  Seasoned, Veteran) and a trade (the post he signs on for). The fee is his grade's times his trade's premium, never
  under a shipwright's hand. The player picks who joins which ship at which post (`enlistPlan`).
- **The beacon tower** (`src/world/lighthouseModel.js`). A medieval tower of grey ashlar with string courses, slit
  windows in leaded panes, a corbel table carrying a battlemented parapet, and an open eight-arched lantern under a slate
  cone with a fire on its head. The keeper lets the player climb to the gallery.
- **The lamp** (`src/scenes/portHost.js`). In the town's lantern hours (17:00 to 08:00) the beacon's fire is a scene
  light, and two beams sweep a circle every `BEAM_PERIOD_S` (14 s), seen from 2.6 km at sea. Each lighthouse's phase is
  off its key and the wall clock, the same on every client. By day, nothing.
- **The piers** (`src/systems/naval/quays.js` `pierDress`, `src/world/quayModel.js`). Timbers under the decks and small
  fittings drawn but not collided, kept out of the gangway's lane.
- **Found.** Each place is a row of the town's talk directory, drawn and lettered on the town map and marked on the
  Overworld, as the yards are.

## Rules

- Ports get the same treatment as wagons and horses: a detailed shipmaster and crew recruitment, ship upgrading and
  buying, an overhaul of piers and a new lighthouse, all on the map and Overworld and askable of NPCs (Mac).
- Mac's choices: at the town's seaward edge; ship sales at the shipyard only (no shop shelf sells Come Sail Away's deeds or
  parts); pick named recruits; a climbable lighthouse with a keeper.
- The lighthouse fits Daggerfall's lore, not the age of steam (Mac): bare stone with a fire on its head.
- A port by its data alone is no coast: a town must bear on the open sea. A seat's members' harbour stands no shipyard,
  so every client stands the same one.
- Tamriel: every port town on the open sea, on the Bay, past it and in the Eltheric Ocean.

## Daggerfall Unity

Daggerfall has no ships for sale and no lighthouses; Come Sail Away sells a hull off a shop's shelf. The places are the
port's own departure (SHIPYARDS, SHIPYARDS-FOUND, THE PIER'S DRESS).

## Code and tests

- `src/systems/portPlaces.js`, `src/world/portSites.js` - which towns and where
- `src/systems/shipyards.js`, `src/ui/shipyardWindow.js`, `src/scenes/shipyardHost.js` - the shipmaster
- `src/systems/crewHall.js` - the roster and signing on
- `src/scenes/portHost.js` - the places' pool, lamp and beams
- `src/world/shipyardModel.js`, `src/world/lighthouseModel.js`, `src/world/portArt.js`, `src/world/quayModel.js` -
  models and art
- `test/systems/shipyards1.test.js`, `test/systems/shipyards1_host.test.js`, `test/systems/shipyards1_found.test.js`,
  `test/systems/shipyards1_audit.test.js`, `test/systems/shipyards1_audit_port.test.js` - sales, fleet, hall, found and
  audit
- `test/world/shipyards1_place.test.js` - placement
- `test/world/beacontower.test.js` - the beacon tower
