# Ship Refit (SHIP-REFIT, 2026-10-29)

Mac, 2026-10-29: the author of two vendored mods asked for them to be taken out - "we need to do comprehensive
replacements and also remove any mention or credit of him". One furnished the ships a player owns, the other the
flooded dungeons. This page is the ships' replacement; `03-World/Dungeon-Flora.md` is the dungeons'. Both are the
port's own work, built from Daggerfall's own models and flats.

A departure from Daggerfall Unity (SCOPE1, `01-Overview/Port-Doctrine.md`): DFU stands the two ships as the classic
records build them, almost bare below decks. The port furnishes them.

## What stands

Both ships a player can buy - the small (`SHIPAA00.RMB`, block 390) and the large (`SHIPAA01.RMB`, block 630) - are
furnished with Daggerfall's own furniture (the 41000 models) and flats (archives 200 to 218). The small ship has a
captain's cabin, two rows of berths, a mess, bow stores, an arms locker beside a chart room, a sail locker and a cargo
hold. The large ship has a great cabin, officers' quarters, crew berths, a chart room, a mess and galley stores, an arms
locker, a sail locker and a cargo hold. Lamps hang from the beams. On the open deck, crates and chests stand along the
rails, with the waist and the companionway left clear.

| ship | below decks | the hold | the open deck | containers |
|---|---|---|---|---|
| small | 41 models, 21 flats (7 of them lamps) | 12 models, 10 flats (2 lamps) | 10 models | 41 |
| large | 105 models, 40 flats (16 lamps) | 20 models, 11 flats (3 lamps) | 15 models | 83 |

Every chest, crate, wardrobe and dresser is a house container (`systems/containers.js` `isHouseContainerModel`), safe
storage as a house's is. The classic record's own pieces - the shell, its crates - stay where Daggerfall put them. No
sailors stand: the refit is furniture.

## How it is built

`world/shipRefit.js` holds each piece in metres in the ship's own frame: where it stands, which way it faces, and how
far up it is stacked. At load it writes the building file DFU would read (`SHIPAA00.RMB-390-building0.json`) from the
player's own `BLOCKS.BSA`: the classic record first and whole, the pieces after it, both halves' headers counted
(`shipRefitJson`). The loader serves both files through the world-data door
(`modWorldData.js:"installShipRefit(boundWorldDataBlocks());"`). A `BLOCKS.BSA` with another block at the index logs
once, and that ship stands as Daggerfall built it.

Four readings decide where a piece lands, each pinned by `shipRefit.test.js`:

- a prop model's `YPos` is its foot (`interiorLayout`), and its turn is `-YRotation / 5.6889` degrees;
- an interior flat's `YPos` is its centre, so a flat is written half its height over its floor or its table
  (`REFIT_FLAT_PX`, measured off the TEXTURE files), and a lamp half its height under its ceiling;
- an exterior model's `YPos` is its origin, so a deck piece is lifted by its foot (`REFIT_MODEL_FOOT`, measured off
  ARCH3D);
- an exterior flat ignores its subrecord's turn in DFU, so the deck carries models only.

Warm Ashes' raid variants copy the classic ship record and lay their own file beside it; they compose with the refit
(`wa1_warmAshesShips.test.js`).

## Saves

A house chest is kept by its model and where it stands (HOLD-KEPT, `scenes/chestRecords.js`). A chest the old layout
stood that no longer stands has what it held set down at the player's feet, with "A chest that stood here is gone".
Nothing is lost. A decoration a player placed from a picture that only the ships carried keeps a picture
(`03-World/Beautiful-Towns.md`, TOWN-ITEMS).

## The four hosts

None is wired: the building files are data. The interior host (`worldModes.js`) lays the rooms from them. The two
exterior hosts (`world.js`, `exterior.js`) lay the deck through `rmbLayout`. The dungeon host stands no ship.

## Online and Tamriel

There is no switch, so every client stands the same ships. Every owner's ship stands at the same map pixel - (2,2)
small, (5,5) large (`banking.js` `SHIP_COORDS`) - so a room's sailors share one deck, and online the world-data door
is open whatever a player's Replace Game Artwork says. Below decks opens no room. A ship is the same ship in every
province: its building file names no place.

## Checked

`node tools/shipRefitCheck.mjs <arena2>` lays both ships out through the port's own builder and asks every piece: no
wall through it at three heights, a floor or its stack under it, no overlap, every floor still walkable from the
entrance, every container reachable, every flat on a floor or a table, every lamp under its ceiling, and the decks the
same against the hull. `shipRefit.test.js` runs it with ARENA2; `tools/mutants/shiprefit.json` holds eleven mutants,
all dead.
