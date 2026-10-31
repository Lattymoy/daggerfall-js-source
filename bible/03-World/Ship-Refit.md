# Ship Refit

The two ships a player can buy are furnished below decks and on the open deck with Daggerfall's own furniture and flats.
The player meets the refit aboard their own ship and in Come Sail Away's sailing cabins, which read the same two
blocks (`src/scenes/sailingCabin.js`).

## How it works

- The small ship (`SHIPAA00.RMB`, block 390) has a captain's cabin, two rows of berths, a mess, bow stores, an arms
  locker beside a chart room, a sail locker and a cargo hold. The large ship (`SHIPAA01.RMB`, block 630) has a great
  cabin, officers' quarters, crew berths, a chart room, a mess and galley stores, an arms locker, a sail locker and a
  cargo hold. Lamps hang from the beams, clear of the classic lanterns. Crates and chests stand along the open deck's
  rails, with the waist and the companionway clear.
- The pieces are the 41000 furniture models and flats from archives 200 to 218. The classic record's own pieces stay
  where Daggerfall put them. No sailors stand.
- `src/world/shipRefit.js` holds each piece in metres in the ship's frame (`SHIP_REFIT`). At load,
  `installShipRefit` writes the building file DFU would read (`shipRefitJson`, named by `buildingReplacementFilename`)
  from the player's own `BLOCKS.BSA`: the classic record first and whole, then the pieces.
- The file is served as a port building (`src/formats/worldData/worldDataReplacement.js` `registerPortBuilding`):
  behind no switch, so turning Replace Game Artwork off stands the same ships, and no mod's file can replace it. A live
  mod's own file of the same name answers first. A `BLOCKS.BSA` with another block at the index logs once and stands
  the classic ship.
- Placement readings (`REFIT_FLAT_PX`, `REFIT_MODEL_FOOT`): a prop model's `YPos` is its foot and its turn is
  `-YRotation / 5.6889` degrees; an interior flat's `YPos` is its centre; an exterior model's `YPos` is its origin; an
  exterior flat ignores its subrecord's turn, so the deck carries models only.
- Every chest, crate, wardrobe and dresser below decks is a house container (`src/systems/containers.js`
  `isHouseContainerModel`), safe storage like a house's. Deck crates are cargo, not containers.
- Warm Ashes' raid variants copy the classic ship record and compose with the refit (`Warm-Ashes-Ships.md`).

## Rules

- Comprehensive replacements, built from Daggerfall's own models and flats, not a vendored mod (Mac).
- Saves: a house chest is kept by its model and position (`src/scenes/chestRecords.js`). What an old-layout chest held
  with no chest now standing for it is set down where the player arrives ("A chest that stood here is gone"). A pile
  inside furniture is lifted out. Both wait until the player stands inside (`src/scenes/arrivalSetDown.js`). Nothing is
  lost.
- Online: there is no switch, so every client of one build stands the same ships. Every owner's ship is at the same map
  pixel, (2,2) small and (5,5) large (`src/systems/banking.js` `SHIP_COORDS`), so a room's sailors share one deck.
- Tamriel: the building file names no place, so the ship is the same in every province.
- The hosts are not wired: the building files are data. The interior host lays the rooms and the arrival set-down; the
  exterior hosts lay the deck through `src/world/rmbLayout.js`.

## Daggerfall Unity

DFU's ships are the classic records as `BlocksFile` reads them, nearly bare below decks, and
`WorldDataReplacement.GetBuildingReplacementData` serves a building file only from a mod. Departure (SCOPE1): the port
furnishes both ships and serves its own file whatever a mod or a switch says.

## Code and tests

- `src/world/shipRefit.js` - the pieces and the building file
- `src/scenes/arrivalSetDown.js` - setting down what a moved chest held
- `test/world/shipRefit.test.js` - the readings, and with ARENA2 the full check
- `test/systems/wa1_warmAshesShips.test.js` - the raid variants composed with the refit
- `tools/shipRefitCheck.mjs` - with ARENA2: no wall through a piece, a floor under each, no overlap, every floor
  walkable from the entrance, every container reachable, flats on floors and lamps under ceilings
- `tools/mutants/shiprefit.json`, `tools/mutants/arrivalsetdown.json` - the mutants
