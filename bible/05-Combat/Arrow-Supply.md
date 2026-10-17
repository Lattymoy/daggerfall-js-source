# ARROW-SUPPLY - arrows that stay where they strike, come back from foes, are made and are sold (2026-10-11)

Mac, in one message: *"So 3 things - 1. allow arrows to stick in walls/ground wherever shot and be retrieved. 2. Allow
arrows to sometimes be retrieved from enemies 3. Allow crafting of arrows 4. Buff the shop's stock of arrows"*.

Four slices, one record: STUCK-ARROWS, ARROW-LODGE, FLETCH and SHOP-ARROWS. Every one is a departure from Daggerfall
Unity, whose bow loses a shaft that misses, keeps every one that strikes, crafts none and shelves twenty at most. The
departures are Ledger A's (`01-Overview/Port-Ledger.md`, ARROW-SUPPLY). Pins: `test/systems/arrowsupply.test.js`. Mutants:
`tools/mutants/arrowsupply.json`.

## 1. STUCK-ARROWS - a shaft that meets the world stays there, and is taken back

FOUND. `combat/arrowFlight.js` (the flight of world.js, exterior.js and worldModes.js's interiors) and
`scenes/dungeonContext.js` (the dungeon's own missile lane) both kept DFU's law for a shaft that meets geometry: it is
LOST (DaggerfallMissile.DoCollision destroys it). A miss cost the arrow.

THE LAW. The player's shaft that meets a wall, a floor, a tree's cover or the bare ground stays where it struck. It is
drawn as the 99800 shaft along the line it flew (`arrowMatrix`), with a quarter of its length in the surface
(`STUCK_ARROW_EMBED`). The tip is the front of the mesh's own bounding sphere along +Z, and the length is the
sphere's diameter (`stuckArrowSetBack`). No measurement of the model is carried, so the embed follows the data that is
loaded. The shaft is a container of one Arrow (`bowDamageArrow`, the one minter) in the host's own dropped-loot pool
(`scenes/droppedLoot.js` `seedPile`):

- **pressed as a pile.** Every host already presses its piles. The ray's target is the pool's `droppedLoot:<id>` key,
  quick loot takes it in one press, the plaque names it "Arrow" (`labelFor`), and Detect Treasure finds it. No host
  learned a new key. The pile's box (0.6 tall) is centred on the shaft (`STUCK_ARROW_LIFT`). The reach is the
  treasure's, so a shaft high on a wall is out of reach, as a pile on a shelf is.
- **drawn by the flight** (`drawn: false`, DW-E5's door). `ArrowFlight.draw` draws each standing shaft with the 99800
  mesh, fetched once, after the first shaft stands. The dungeon's list of meshes is its `dynamicDraws`, so a stuck
  shaft is an entry there for as long as its pile stands (`syncStuckArrowDraws`, run before `updateMissiles`'s
  no-missile return). The pile is read live, so a recentre (`offsetAll`) or the ground's move carries the shaft.
- **unsaved.** WOD5's LoadID-0 container rides no save and no scene cache. `snapshotWorld` already filtered it;
  `snapshotScene` (the interiors' cache) and the dungeon's save now filter it too. A stuck shaft outlives no scene. In
  the open world it lies on the player's map pixel at the loose (`pixelKeyAt`) and dies with it (`collectPixel`).
- **storing nothing.** WILD1's `noStore` door means the inventory window puts nothing on a stuck shaft
  (`STUCK_ARROW_NO_STORE`). An invisible, unsaved pile holding a sword would have been a lost sword.
- **forty to a pool** (`STUCK_ARROWS_MAX`). The oldest goes when another sticks. A taken shaft's pile is freed on the
  next frame (`pruneStuckArrows`): a scene-built container is only ever deactivated, and nothing re-mints a stuck shaft.

WHAT NEVER STICKS (`stickable`):

- an enemy's shaft;
- a peer's drawn echo (`visual`), which the player who loosed it holds;
- the gun's spent Dwemer Pellet (`orbArchiveFor`, FIELD-GUN14's leaf);
- a CONJURED round (below);
- a shaft loosed in an arena bout (`shotTallyOpen`). The healers refund the bout's shots (ARENA-ARROWS), so the sand
  keeps the LOST law and the refund stays the whole account. A shaft stuck on the sand would have been an arrow paid
  twice.

THE CONJURED ROUND. DFU carries `isArrowSummoned` from WeaponManager's loose (WeaponManager.cs:404-407) to the
missile, where it skips the target's recovery (WeaponManager.cs:554-559). The port never carried it. `inventory.js`'s `spendArrow`
note said so: it "lands with the recovery rule it exists to qualify", and that note is retired here. `spendAmmoFor`
answers it now (`shot.summoned`, its boolean return unchanged), and every loose hands it to the shaft:

- the three ArrowFlight loose sites;
- the dungeon's `fireArrow` `extra`;
- the four technique doors (`techniques.js`): Piercing Shot's one round, and each Volley shaft its own.

So a conjured shaft is neither stuck nor recovered from a foe. Before this slice, a foe struck by one carried a real
Arrow.

THE FOUR HOSTS:

- **world.js:** its flight takes its pool and its pixel.
- **exterior.js:** its flight takes its pool.
- **worldModes.js:** the interiors' flight takes the building's pool (`interiorDropped`).
- **dungeonContext.js:** sticks at its wall seam (`impact`, the ray's own point) and draws in `dynamicDraws`. The
  dungeon has no bare ground; its floors are meshes.

## 2. ARROW-LODGE - a shaft sometimes comes back from the foe it struck

FOUND. BowDamage put every player shaft that struck into the foe's pack (`playerArrowHitFoe`), so DFU's recovery stood.
But FOE-CAP (`systems/foeLootCap.js`) caps a plain foe's body at three items at its death. An arrow stack is the
cheapest Common thing on a body, so the cap threw it away FIRST. A plain foe already at its three pieces (most of them,
at LOOT-EASE's rates) gave back none of the arrows it was shot with. That is the "sometimes" Mac could not find.

THE LAW:

- **AN ARROW IS NO FIND** (`capLootList`'s `isQuiverArrow`). The player's shafts in a body, and an archer's own
  quiver, are ammunition, not the body's loot. They ride past the cap, kept and uncounted, and never take a piece's
  place. FOE-CAP's "never more than three" still holds for everything a body drops but arrows (DECIDED, the record's
  call under Mac's words; the PR says so).
- **SOMETIMES.** A real shaft that strikes a foe survives to lodge in its pack `ARROW_LODGE_CHANCE` (one in two) of the
  time. The roll is the blow's own stream, drawn LAST, so every roll the damage draws is drawn as before. A conjured
  one never lodges. The ARENA-ARROWS tally takes back only a shaft that lodged.

NAMED, not changed: a shaft into ANOTHER player's foe (a puppet, WORLD6b-iii(e)) lodges in the owner's copy at that
copy's own law (`ar: 1`, HIT_ARROWS_MAX a body). The roll is this client's, and the owner's door adds what the wire
says.

## 3. FLETCH - arrows whittled from wood the player carries

FOUND. Online, arrows are Carpentry's: twenty at a workbench (`net/recipeLaw.js`, `06-Systems/Professions-Arc.md`
9.3, 25 and 29), decided by the account service. Offline nothing made one.

THE LAW (`systems/fletching.js`). In the inventory's Use mode, a piece of wood becomes ITS OWN WEIGHT IN ARROWS. DFU's
UseItem asks a registered handler first (ItemHelper.RegisterItemUseHandler, `systems/item/itemTemplates.js`), and
`useItem.js` loads this module:

| Wood | Weight | Arrows |
|---|---|---|
| Twigs (PlantIngredients1/2, 8) | 0.5 kg | 2 |
| Pine Branch (14) | 1 kg | 4 |
| Wood Bundle (Foraging's 1604, a Wood-Axe's chop) | 2.5 kg | 10 |

The counts are the templates' weights over the Arrow's 0.25 kg (`fletchYield`), never a table - the CLASSIC Arrow's
(`ITEM_TEMPLATES`), never a mod's patch (BENCH-ARROWS, `01-Overview/bugs/Field-Bugs-2026-10-15c.md`: Roleplay & Realism:
Items' 0.1 kg Arrow, on by default and forced online, had made a Twig five arrows - four Twigs the workbench's twenty
without its plank and its ingot). Each Use takes one
piece, as a potion is one bottle. The arrows are CreateWeapon's (the shelf's, the corpse's, the workbench's), go into
the PACK (`localItems`, so wood used off a pile fletches into the pack), and join the quiver as one stack. The window
says "You fletch 2 arrows from the Twigs." in its own box. A quest's piece keeps the ladder's answer. Online and
offline alike: the arrows list on no market (`marketLaw.js`, "never arrows"), and the workbench's twenty stay the
better trade.

## 4. SHOP-ARROWS - a quiver on the counter

FOUND. DFU's stock law shelves arrows as any weapon: a Weapons-chance draw per shelf at rarity 1, one stack of
Range(1, 21) (`enemyEquipment.js` createWeapon's arrow arm). A Weapon Smith's counter held twenty at most, 70% of the
time, and a General Store's one day in five.

THE LAW (`systems/shopStock.js`). Every shop that sells weapons also carries a quiver on its counter's shelf
(shelfIndex 0). It is drawn from NO roll, after every draw of DFU's and before the pellets. It is SHOP-PELLETS' own
law, one export now (`shopAmmoStack`), at `SHOP_ARROWS_MAX` 100:

| Shop | Quality 1 | Quality 10 | Quality 20 |
|---|---|---|---|
| Weapon Smith | 50 | 74 | 100 |
| Armorer, General Store | 14 | 21 | 29 |
| Pawn Shop | 7 | 11 | 14 |

The quiver is minted as the shelf mints arrows, its stack roll answered by a constant, so it merges with DFU's own
draw when there is one. Pins moved, each marked PIN MOVED (SHOP-ARROWS):

- `test/systems/shopstock.test.js`: the counter's list;
- `test/systems/roada2_itemseconomy.test.js`: DFU's Range(1, 21) read off a shelf behind the counter;
- `test/systems/shoppellets.test.js`: the Weapon Smith's counter is the next shelf plus the shot AND the quiver.

## 5. The process laws, applied

- **THE FOUR HOSTS RULE:** named in section 1.
- **ONE DFU MEMBER, ONE EXPORT:** one arrow mint (`createWeapon`'s arm, `bowDamageArrow`) and one counter law
  (`shopAmmoStack`). The stuck shaft's matrix is `arrowMatrix`.
- **A PIN MUST FAIL:** `tools/mutants/arrowsupply.json`, every record dead (`node tools/mutate.mjs`).
- **TEST THE SHAPE THE PRODUCER MINTS:** the suite flies real shafts through `ArrowFlight` into a real
  `createDroppedLoot` pool, stocks real shelves, and fletches real templates.
- **EVERY ALLOCATION HAS AN OWNER:** a stuck shaft owns no GPU allocation. Its pile is a plain record, and the mesh is
  the pipeline's cached 99800, the one the flying shafts wear.
- **A SLICE CLOSES ITS LEDGER ROW:** Ledger A's ARROW-SUPPLY row. Section C names no arrow-recovery or arrow-crafting
  member.
- **PINS MOVED** (each marked PIN MOVED in its file, with what moved it):
  - ARROW-LODGE: a recovery pin now hands the blow a roll under the chance - `test/systems/arrowflight.test.js`,
    `test/scenes/audit39_worldmodes.test.js`, `test/systems/audit58_combat.test.js`, `test/systems/arena/fb1004e_arena.test.js`.
  - STUCK-ARROWS: the hosts' source pins read the flights' pool and the loose's word - `test/systems/arrowflight.test.js`,
    `test/scenes/audit39_worldmodes.test.js`, `test/systems/thunderlock.test.js`, `test/systems/audit23.test.js` (the dungeon's save).
  - FLETCH: the Wood Bundle's one Use is the fletching's - `test/systems/forage2_tools.test.js`.
  - SHOP-ARROWS: the three in section 4, and `test/systems/audit18_systems_items.test.js` (the Armorer's counter).
  - Mutant records re-aimed by content: `fieldgun14.json` (6, 7), `tech1.json` (a shaft untallied, the shot at plain
    speed), `shoppellets.json` (the two that read the counter's law).
