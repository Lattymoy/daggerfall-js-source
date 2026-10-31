# Arrow Supply

Four ways an archer keeps a quiver full: a shaft that misses sticks where it struck and can be taken back; a shaft that
hits a foe sometimes lodges in its pack; wood can be fletched into arrows; and every shop that sells weapons keeps a
quiver on its counter. The player meets them when shooting, looting, using wood and shopping.

## How it works

- **Stuck arrows** (`src/combat/arrowFlight.js`, and the dungeon's own missile lane in `src/scenes/dungeonContext.js`).
  The player's shaft that meets a wall, floor, tree or ground stays there, a quarter of its length in the surface
  (`STUCK_ARROW_EMBED`), drawn as the 99800 arrow mesh along its line. It is a one-Arrow pile in the host's
  dropped-loot pool (`seedPile`, `src/scenes/droppedLoot.js`), so every host's press, quick loot and Detect Treasure
  take it. It is not saved and outlives no scene; it stores nothing. At most `STUCK_ARROWS_MAX` (40) a pool, the
  oldest going first.
- **What never sticks** (`stickable`): an enemy's shaft, a peer's drawn echo, a gun's Pellet, a conjured round, a shaft
  loosed in an arena bout (the healers refund those).
- **Conjured rounds.** `spendAmmoFor` reports a summoned shot (`shot.summoned`) and every loose carries it, so a
  conjured shaft neither sticks nor lodges, as DFU's `isArrowSummoned` skips recovery.
- **Lodged arrows.** A real shaft that strikes a foe lodges in its pack half the time (`ARROW_LODGE_CHANCE`), rolled
  last on the blow's stream so the damage rolls are unchanged. Arrows are ammunition, not loot: they ride past the
  three-item foe cap (`isQuiverArrow`, `src/systems/foeLootCap.js`).
- **Fletching** (`src/systems/fletching.js`). In the inventory's Use mode, a piece of wood becomes its own weight in
  arrows over the classic Arrow's 0.25 kg (`fletchYield`): Twigs 2, a Pine Branch 4, a Wood Bundle 10. Each Use takes
  one piece; the arrows go into the pack and join the quiver.
- **Shop arrows** (`src/systems/shopStock.js`). Every shop that sells weapons carries a counter quiver, drawn from no
  roll after DFU's own draws (`shopAmmoStack`, at most `SHOP_ARROWS_MAX` 100), scaled by shop kind and quality: a
  Weapon Smith 50 to 100, an Armorer 14 to 29, a Pawn Shop 7 to 14. A General Store's counter quiver is always a full
  100, and a purchase puts back what it took, offline and online.

## Rules

- Arrows stick and can be retrieved, are sometimes retrieved from enemies, can be crafted, and shops stock more (Mac).
- General stores always have arrows players cannot exhaust (the owner). Only what a purchase took is put back:
  stolen arrows stay gone.
- The fletching yield reads the classic Arrow's weight, never a mod's patched one.
- Online, Carpentry's workbench recipe (twenty arrows) stays the better trade, and arrows list on no market.

## Daggerfall Unity

DFU's bow loses a shaft that misses (`DaggerfallMissile.DoCollision` destroys it), keeps every one that strikes in the
foe's pack, crafts none, and shelves at most twenty a stack. All four are departures, each named above.

## Code and tests

- `src/combat/arrowFlight.js` - stuck and lodged arrows
- `src/systems/foeLootCap.js` - arrows past the foe cap
- `src/systems/fletching.js` - fletching
- `src/systems/shopStock.js` - the counter quiver
- `test/systems/arrowsupply.test.js` - all four
