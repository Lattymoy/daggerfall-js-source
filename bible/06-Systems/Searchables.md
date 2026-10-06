# SEARCHABLES AND THE PLAIN FOE'S LOOT (SEARCH1, SEARCH1-PARTY, FOE-CAP - 2026-10-03)

The port's own; classic Daggerfall searches none of these objects and caps no drop.

## SEARCH1 - what can be searched

Mac: "can you make those objects interactable? with a 33/33/33 check to spawn either and undead enemy (even undead
elites 50%) or ... loot ... 1-4 random items 1 of them always gold ... or a message that you found nothing valuable".

`systems/searchables.js` is the whole law. The models were read off the player's own ARCH3D.BSA and BLOCKS.BSA by
the texture archive each wears and where it stands; the ids are DFU's model numbers, no art ships:

| kind | models | evidence |
|---|---|---|
| coffin | 41315-41318 | TEXTURE.092 "coffins organ", low (16-20 units) |
| sarcophagus | 41319-41327 | TEXTURE.092, lidded (36-50 units); 41120 wears it too and is the organ |
| shelf | DFU's ShopShelves list (`shopStock.js`) + 41010, 41025, 41027, 41043, 41045, 41807, 41809 | the 71/72/81 shelf fronts (books, skulls, potions) |
| tombstone | 43011-43082, 43101-43104, 43117-43136, 43142-43145 | TEXTURE.073 "Gravestone fronts", a grave's footprint; the pedestals, obelisks and vaults excluded |
| chest | 41811, 41812, 41816, 41817, 41826, 41829 | TEXTURE.090 record 2, the framed box |
| crate | 41815, 41818, 41822, 41824, 41825, 41827, 41828, 41830-41834 | TEXTURE.090 records 3, 13, 14 |

41003/41004 (TEXTURE.090 8-11) are cupboards, not shelves, and are not searched.

- Reach: `SEARCH_REACH`, half of DoorActivationDistance (64 classic units, 1.6 m).
- The roll: a third each underground; at a Graveyard location's headstone two in three nothing, a sixth each.
- Foe: a grave, a coffin or a shelf wakes an undead by the player's level; a chest or a crate draws from the
  dungeon's own layout roster. The named foe is an elite half the time (systems/eliteFoes.js) - offline too, as asked.
- Find: one to four items, the first always gold, from the kind's goods, then the rarity ladder at the place's pile tier.
- The message: a parchment box the player clicks away; the foes stand, or the find opens, only from its `onClose`
  (ui/actionText.js - deferred past the dismissal, once, never for a replaced box).
- Locks: one chest or crate in three, lock 1..15, a hash of where it stands; picked in Steal mode by the interior door
  formula, Lockpicking tallied. A picked lock stays picked.
- Five game hours (`SEARCH_COOLDOWN_MINUTES`) per object, on the save (`modSaveData` vendor `Searchables`).

## SEARCH1-PARTY

Mac: "2 per player and if the room is too small then in a floor connected to the door to the room. When one player in
the party interacted with it no one else can again for 5 hours ... visible for everyone in the party the same the
looter sees".

- Two foes for every player of the party standing there (`SEARCH_FOES_PER_PLAYER`); only the named one may be elite.
- Underground they stand in a ring about the object with a clear line from it; what the room cannot hold stands on
  the floor beyond the nearest action door, on the side away from the object.
- A dungeon search is said to the room as a WORLD4 container, `srch:<i>` (the layout's searchables order, the same on
  every client): every search, whatever it rolled, so the room's word starts everyone's five hours from its stamp, and a
  find is the room's list - a partymate opening the object inside the five hours opens the same items, less what was
  taken. An older build ignores the key.

## FOE-CAP

Mac: normal foes "never drop more then 3 items in total max. Gold included. Bosses/worldbosses are not affected";
"champions are not normal"; Elite Dungeons "max drop 5 ... Aside from this same rules"; the plain foe's drops white,
blue rare, yellow very rare, orange almost impossible, Elite Dungeons excepted.

`systems/foeLootCap.js`: a plain foe (no elite, champion, revenant, named or world-boss mark, and not a boss by
`corpseSource`) is stamped `lootCap` at `spawnEnemyLoot` - 3, or 5 in an Elite Dungeon - capped there and again after
every OnEnemyDeath handler (`raiseEnemyDeath`). Gold is folded into one stack and kept, a quest's items are never
dropped, the rest kept best first: a Magic-or-better piece by its tier, then a supply - a potion, a rest supply - then
the rest, the dearer first within each (CAP-SUPPLIES, LOOT-EASE). Outside an Elite Dungeon it rolls
`PLAIN_FOE_RARITY_WEIGHTS` - since LOOT-EASE (2026-10-05, `Loot-Arc.md` section 19) blue 5% + 0.5 a tier (19% at most),
yellow 0.6% + 0.12 (3.8%), orange 0.015% + 0.0075 (0.3%) - and at its death its dropped kit rolls the same ladder
(KIT-ROLL, `rollCorpseKit`: LR4 never ladders what a foe wears, and a plain humanoid's gear was all kit, all Common).

## CHAMP-LOOT

Mac: champions "should have less chances to drop items than elite cause elites are stronger", then "champions should
have half the rates what elite drop the legendary rate are good already", then "no more champion guaranteed rare".

- NOTHING IS FORCED onto a champion's body: LOOT7's guarantee (`ensureChampionLoot`, a Rare made or minted when its
  roll found none) is deleted with its call and its pins.
- Its own pieces roll Magic and Rare at half a plain foe's thresholds (`CHAMPION_SOURCE.ladder`, applied after the
  caps); its Legendary threshold is unchanged - two tiers more and a quarter again (`CHAMPION_SOURCE.tier`/`quality`,
  through `rarityChances`' `legendaryTier`/`legendaryQuality`). `championSource` is the one home.

With two eligible pieces on the body, a Rare or better: champion 3.3% / 6.2% / 8.5% / 11.4% against an elite's
34.1% / 38.1% / 41.2% / 45.0% at levels 3 / 8 / 12 / 17; a Legendary 1.7% / 3.2% / 4.4% / 5.9%. The pin holds every
champion chance under half the elite's at every level. Champions stay outside the 3-item cap.

## ELITE-RARE

Mac: an elite's Rare "should be half of" a champion's blue. `systems/eliteFoes.js` `eliteRareChance(level)` is the
elite's extra Rare roll: half the chance a champion's body of that level carries a Magic or better, with two eligible
pieces on it, at Luck 50 - 7.0% / 10.4% / 13.0% / 16.2% at levels 3 / 8 / 12 / 17, and 25.5% from 18 (a boss's source).
It was a flat 25%. The level is the one the elite's drop is minted at, the player's (`effectiveLevel`). The rest of the
elite's extra drop is unchanged: two Magic pieces, one common, a 6% Legendary, gold.

## The four hosts

- `scenes/dungeonContext.js` - WIRED (both dungeon hosts route `search:` - worldModes.js and dungeon.js).
- `scenes/world.js` + `scenes/worldModes.js` - WIRED for a Graveyard location's headstones (`grave:`): the roll, the
  two-per-player ring, the find, the five hours. NOT shared with the party above ground: the act channel is a world
  room's (`online.sendAct`) and a street cell is not one, so each player's headstones keep their own five hours and finds.
- `scenes/exterior.js` (the one-city bench) - stands no headstone: it registers no `graveTargets`.
- `scenes/worldModes.js` interiors - none: searching is dungeons and graveyards only, as asked.
