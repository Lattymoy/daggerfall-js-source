# Immersive Travel

A port of kkgobkk's Immersive Travel 1.5: fast travel by carriage. A carriage, its team and a driver stand
outside the gates of walled cities; talking to the driver opens the driver's map, and a trip there is Daggerfall's fast
travel with a daily carriage fee on top of the inn nights. Online it is the way to fast travel over land, at a fare. The
port carries the mod 1:1, its bugs included, with the departures below. The carriage stand is our own; the release's
record is in `01-Overview/Own-Work.md`.

## How it works

### The mod (`src/systems/immersiveTravel.js`)

Read off the shipped DLL's IL, cited by offset in the 1.5 assembly in the module.

- **Init** registers two factions, Carriage Drivers (8642) and Sailors (8643), as merchants with a Fast Travel service.
  The mod is latched for the game when Init runs; a switch flipped mid-game waits for the next start.
- **The service** refuses with enemies nearby; otherwise it opens the driver's map.
- **The driver's map** refuses a place by its type (`isDestinationValid`, the AllowedDestinations settings; as shipped,
  cities, hamlets and villages) or, with RegionLockedCarriages, by region (`carriageRefusal`: capital to capital
  anywhere, else the bordering region only, `borderingRegionIndex`). Otherwise it opens the mod's popup: DFU's travel
  popup with the mod's calculator.
- **A ship captain's map** (the docks, a voyage priced by the day) is carried whole, though no block the mod ships stands
  a sailor.
- **Disable Normal Travel** makes the carriage the only fast travel. The port ships it off.
- **Carried bugs**: the home types read the Dungeons dial; `borderingRegionIndex` asks one neighbour twice and never
  answers region 0.

`src/systems/immersiveTravelTables.js` holds the mod's tables: 40 capitals, 15 large docks, 382 dock pixels.

### The gates

A gate needs one thing for Fast Travel: a driver in faction 8642 outside it, on open ground and off its way out. Our
own stand (`src/world/immersiveTravelGates.js` `CARRIAGE_STAND`) puts a carriage, two horses, hay, a signpost and the
driver 26 m along each gate's wall, set in the gate's frame (`IT_GATE_FRAMES`). No gate block is edited. Every Bay
city is walled on its outline (`03-World/Town-Shapes.md`), and the walls carry the stand to their gates
(`src/world/townWalls.js` `gateFurniture`), as they carry it to a city's past the Bay and a capital's.

### Past the Bay

On the enhanced sheet a driver's map picks a city, town or village past the Bay, and the mod's laws ask it as a Bay
place: its type, and region-locked its province's region, capital to capital both ways (a capital past the Bay is its
pixels). The seven provincial capitals stand carriages at their road gates (`src/world/capitalCarriages.js`), placed on
open ground beside each gate, or just inside where the ground outside is too narrow. A captain's map keeps the Bay's
docks, and the classic skin's map is the Bay's alone.

### Online

The mod is the room's (`src/systems/online/onlineLane.js`): on, with Disable Normal Travel held off and every fare and
rule at the mod's value. A driver's trip calls `fastTravelTo`: the fare paid, the arrival in the world's present, the
trip's days on the character's own clock. A sun-averse traveller is refused a carriage by day online, as the travel map
refuses them.

### Surfaces

`src/ui/travel/travelMapWindow.js` and `src/ui/travel/travelPopUp.js` draw the classic map and popups;
`src/ui/heldMap.js` draws the enhanced sheet's card, which names the ride. `src/scenes/world.js` opens the maps
(`openImmersiveMap`), and `src/scenes/worldModes.js` stands a street merchant's popup in the street's slot.

## Rules

- Instant travel online is an option with a cost: the carriage (the owner).
- Every walled city has carriages at its gates (the owner); the stand is our own (OWN-WORK, the owner).
- A driver's trip is Daggerfall's fast travel online, with the fare paid (the owner).
- How travel works in the Bay is how it works everywhere (the owner): every capital and city past the Bay has carriages
  at its gates.
- A hired carriage is the hirer's: never a party travel round.
- Online the driver's fare is the mod's, not halved.

## Daggerfall Unity

The mod's classes (`CarriageMap`, `SeafarersMap`, `ImmersiveTravelPopUp`) extend DFU's travel map and popup. Departures:
Disable Normal Travel off by default; our own stand at every gate, no gate block edited; settings read when a map opens;
Disable Normal Travel refuses the popup for a place only; the enhanced card names the ride; refusal boxes wrap; a street
merchant's popup in the street; online refusal by day for the sun-averse; the WALLAA09 driver given a face
(`IT_DRIVER_FACE`); towns and capitals past the Bay.

## Code and tests

- `src/systems/immersiveTravel.js`, `src/systems/immersiveTravelTables.js` - the mod
- `src/world/immersiveTravelGates.js` - the stand at the gates
- `src/world/capitalCarriages.js` - carriages at the provincial capitals
- `test/systems/auditit1.test.js` - the mod's laws
- `test/systems/it1_classicmap.test.js` - the classic map
- `test/formats/worldData/it1_worlddata.test.js` - the stand at every gate;
  `test/systems/guild/it1_immersivetravel.test.js` - the tables by literal digests
- `test/ui/travel_everywhere.test.js` - a driver's trip past the Bay
- `test/systems/fb1009b_driverface.test.js` - the WALLAA09 driver's face

## Open

- The permission record for the ported law is open (`01-Overview/Own-Work.md`).
