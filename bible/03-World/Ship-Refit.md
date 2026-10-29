# Ship Refit (SHIP-REFIT, 2026-10-29)

Mac, 2026-10-29: "we need to do comprehensive replacements". Two vendored mods were taken out that day: one furnished
the ships a player owns, the other the flooded dungeons. This page is the ships' replacement; `03-World/Dungeon-Flora.md`
is the dungeons'. Both are the port's own work, built from Daggerfall's own models and flats, and both were audited the
same day (`01-Overview/audits/Audit-Ship-Refit.md`).

A departure from Daggerfall Unity (SCOPE1, `01-Overview/Port-Doctrine.md`): DFU's two ships are the classic records as
`BlocksFile` reads them - almost bare below decks - and its `WorldDataReplacement.GetBuildingReplacementData` serves a
building file only from a mod. The port furnishes them, and serves its own file whatever a mod or a switch says.

## What stands

Both ships a player can buy - the small (`SHIPAA00.RMB`, block 390) and the large (`SHIPAA01.RMB`, block 630) - are
furnished with Daggerfall's own furniture (the 41000 models) and flats (archives 200 to 218). The small ship has a
captain's cabin, two rows of berths, a mess, bow stores, an arms locker beside a chart room, a sail locker and a cargo
hold. The large ship has a great cabin, officers' quarters, crew berths, a chart room, a mess and galley stores, an arms
locker, a sail locker and a cargo hold. Lamps hang from the beams, clear of Daggerfall's own lanterns. On the open deck,
crates and chests stand along the rails, with the waist and the companionway left clear. Come Sail Away's sailing
cabins read the same two blocks (`scenes/sailingCabin.js`), so they stand the same rooms.

| ship | below decks | the hold | the open deck | containers |
|---|---|---|---|---|
| small | 41 models, 21 flats (7 of them lamps) | 12 models, 10 flats (2 lamps) | 10 models | 31, and the classic record's own crates |
| large | 103 models, 40 flats (16 lamps) | 20 models, 11 flats (3 lamps) | 15 models | 67 |

Every chest, crate, wardrobe and dresser below decks is a house container (`systems/containers.js`
`isHouseContainerModel`), safe storage as a house's is. The open deck's crates are cargo: an exterior model is never a
container, in DFU or here. The classic record's own pieces stay where Daggerfall put them. No sailors stand: the refit
is furniture.

## How it is built

`world/shipRefit.js` holds each piece in metres in the ship's own frame: where it stands, which way it faces, and how
far up it is stacked. At load it writes the building file DFU would read (`SHIPAA00.RMB-390-building0.json`) from the
player's own `BLOCKS.BSA`: the classic record first and whole, the pieces after it, both halves' headers counted
(`shipRefitJson`). It is served as a port building file (`worldDataReplacement.js` `registerPortBuilding`): behind no
door, so Replace Game Artwork off stands the same ships, and in a list of its own, so no mod's file can take its place.
A live mod's own file of the same name answers first, as a player's own texture pack does. A `BLOCKS.BSA` with another
block at the index logs once, and that ship stands as Daggerfall built it.

Four readings decide where a piece lands, each pinned by `shipRefit.test.js`:

- a prop model's `YPos` is its foot (`interiorLayout`), and its turn is `-YRotation / 5.6889` degrees;
- an interior flat's `YPos` is its centre, so a flat is written half its height over its floor or its table
  (`REFIT_FLAT_PX`, measured off the TEXTURE files), and a lamp half its height under its ceiling;
- an exterior model's `YPos` is its origin, so a deck piece is lifted by its foot and its stack (`REFIT_MODEL_FOOT`,
  measured off ARCH3D);
- an exterior flat ignores its subrecord's turn in DFU, so the deck carries models only.

Warm Ashes' raid variants copy the classic ship record and lay their own file beside it; they compose with the refit
(`wa1_warmAshesShips.test.js`).

## Saves

A house chest is kept by its model and where it stands (HOLD-KEPT, `scenes/chestRecords.js`). What a chest of the old
layout held that no chest now stands for is set down where the player arrives, with "A chest that stood here is gone".
So is a pile left on a floor that furniture now stands on: one inside a closed solid (the ray up and three of four level
rays meet faces from behind) is lifted out, with its own line. Both wait for the player to be stood inside
(`scenes/arrivalSetDown.js`) - the restore runs first, and a set-down at the old position put a save loaded on board
outside every room. Nothing is lost. A decoration placed from a picture the removed mod carried keeps it
(`03-World/Beautiful-Towns.md`, TOWN-ITEMS).

## The four hosts

None is wired: the building files are data. The interior host (`worldModes.js`) lays the rooms from them and wires the
arrival set-down. The two exterior hosts (`world.js`, `exterior.js`) lay the deck through `rmbLayout`. The dungeon host
stands no ship.

## Online and Tamriel

There is no switch, so every client of one build stands the same ships. Every owner's ship stands at the same map pixel
- (2,2) small, (5,5) large (`banking.js` `SHIP_COORDS`) - so a room's sailors share one deck. A tab still on an older
build stands the old deck's crates until it updates, and draws a sailor on one a crate's height off. That is furniture,
not ground: `GROUND_LAW` (`net/wire.js`) holds the land's heights to a print, and no town's buildings have moved it.
Below decks opens no room. A ship is the same ship in every province: its building file names no place.

## Checked

`node tools/shipRefitCheck.mjs <arena2>` lays both ships out through the port's own builder and asks every piece: no
wall through it at three heights, and no shell surface inside its box (every shell triangle sampled every 4 cm - a foot
may settle 6 cm into a curved floor, a wall none); a floor or its stack under it; no overlap; every floor still walkable
from the entrance; every container reachable; every flat on a floor or a table and every lamp under its ceiling; every
billboard - the refit's and the classic record's lanterns - clear of every piece; the decks the same against the hull.
`shipRefit.test.js` runs it with ARENA2; `tools/mutants/shiprefit.json` holds fifteen mutants and
`tools/mutants/arrivalsetdown.json` eight, all dead without ARENA2.
