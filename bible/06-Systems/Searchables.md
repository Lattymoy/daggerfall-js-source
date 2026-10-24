# SEARCHABLES AND THE PLAIN FOE'S LOOT (SEARCH1, SEARCH1-PARTY, FOE-CAP - 2026-10-03; GRAVE-PARTY - 2026-10-16)

The port's own; classic Daggerfall searches none of these objects and caps no drop.

## SEARCH1 - what can be searched

DETECT-FINDS (2026-10-05, `03-World/Delve-Arc.md`): a searched object's find, while it lies in it, is in the dungeon's
Detect Treasure walk (`scenes/shared.js nearbyLootRecords`'s `searched`); unsearched, it holds nothing and is no treasure.
The look round (SENSE1) lights a searchable the plaque names, in the finds' colour.

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

- Reach: `SEARCH_REACH`, half of DoorActivationDistance (64 classic units, 1.6 m) - since GRAVE-PARTY (below) measured
  from the BODY to the nearest point of the object's box (`searchReachFor`), not from the eye to where the ray meets it.
- The roll: a third each underground; at a Graveyard location's headstone two in three nothing, a sixth each.
- Foe: a grave, a coffin or a shelf wakes an undead by the player's level; a chest or a crate draws from the
  dungeon's own layout roster, less its water species (SLAUGHTER-BOX, `01-Overview/bugs/Field-Bugs-2026-10-15c.md`: the
  foe stands on the dry floor beside the box; RDBLayout's Slaughterfish, Dreugh and Lamia stand in the roster only for
  a marker under water - `characters/dungeonEnemies.js` WATER_SPECIES, the one home). The named foe is an elite half the
  time (systems/eliteFoes.js) - offline too, as asked.
- Find: one to four items, the first always gold, from the kind's goods, then the rarity ladder at the place's pile tier.
- The message: a parchment box the player clicks away; the foes stand, or the find opens, only from its `onClose`
  (ui/actionText.js - deferred past the dismissal, once, never for a replaced box).
- Locks: one chest or crate in three, lock 1..15, a hash of where it stands; picked in Steal mode by the interior door
  formula, Lockpicking tallied. A picked lock stays picked.
- Five game hours (`SEARCH_COOLDOWN_MINUTES`) per object, on the save (`modSaveData` vendor `Searchables`) - with the
  searcher's name when it was a partymate's (GRAVE-PARTY), the later search holding the hours.

## SEARCH1-PARTY

Mac: "2 per player and if the room is too small then in a floor connected to the door to the room. When one player in
the party interacted with it no one else can again for 5 hours ... visible for everyone in the party the same the
looter sees".

- Two foes for every player of the party standing there (`SEARCH_FOES_PER_PLAYER`); only the named one may be elite.
- Underground they stand in a ring about the object with a clear line from it; what the room cannot hold stands on
  the floor beyond the nearest action door, on the side away from the object.
- A dungeon search is said to the room as a WORLD4 container, `srch:<i>` (the layout's searchables order, the same on
  every client): every search, whatever it rolled, and a find is the list - a partymate opening the object inside the
  five hours opens the same items, less what was taken. (AMENDED 2026-10-17, OUTDOOR-LOOT: the word is not the list any more -
  a find is a CARRIED PARTY-LOOT container, minted once at the search, its word the takes against it, every take a claim the
  dungeon's host judges; `06-Systems/Online-Arc.md` OUTDOOR-LOOT.) ~~An older build ignores the key.~~ (AUDIT OUTDOOR-LOOT L6, 2026-10-18: an
  older build reads a new find word as a newer version's - unreadable, "Reload to open it" - and its own whole list is landed
  here as a birth or that peer's diff; Online-Arc's mixed builds.) A rival party's find of the same object is that party's own
  list, judged by the dungeon's host apart (AUDIT OUTDOOR-LOOT D1). GRAVE-PARTY (below): the word
  names its searcher and starts the five hours, and lands the find, in the searcher's PARTY alone - no longer everyone's
  in the room.

## GRAVE-PARTY - the search is the party's, above ground and below (FIELD BUGS 2026-10-16b)

The Discord's "A few things": "graveyard loot on headstones are able to be looted by others, objects in tombs are un
lootable (have not tried dungeons yet)" (`01-Overview/bugs/Field-Bugs-2026-10-16b.md`). A "tomb" is the Graveyard's Cemetery
dungeon (dungeonType 18, the M0000000-8 crypt blocks), its room `dungeon:m<id>`.

- **ABOVE GROUND THE STONE IS THE PARTY'S.** A headstone's search was its searcher's game's alone (the act channel is a
  world room's, and a street cell is not one), so every partymate searched it again and found again. The cell keeps it
  now - the overworld ledger's third kind, `gr` (`net/overworldLaw.js` `owFoldGraves`, the relay's `_owGraves`,
  world212): the searcher's game says `[px, py, n]` (the stone's pixel and its number in the build,
  `world.js` graveTargets' `loc`/`key`), the relay stamps it with its own minute, the searcher's VERIFIED account (the
  token's subject, never the word's) and the searching character's name (the token's - AUDIT GRAVE-PARTY G5, below) -
  `[px, py, n, minute, acct, name]` - and keeps it the search's five hours (`OW_GRAVE_KEEP_MIN`, pinned to
  `SEARCH_COOLDOWN_MINUTES`), says it to everyone in the cell and in every later welcome. The relay knows no party: each
  game lands the rows of its own party (and its own account's - another tab, an earlier visit, another character) on the
  ledger's five hours, by the searcher's name (`scenes/searchPartyHost.js`, `searchToldBy`), and keeps every row in a
  small book read again at the stone - so a partymate who searched before the party was made, or before the hub's picture
  came, locks it too. A stranger's row locks nothing of mine, and mine nothing of theirs. A relay before world212 is told
  nothing (`relaySupportsOwGraves`, `OW_GRAVE_RELAY_MIN` 211 - it would close the socket on the word: main's INSTANCES
  world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 among them, AUDIT GRAVE-PARTY G1); there each game keeps
  its own five hours, as before. A LAYER keeps its own graves (a party plays in one layer), where the spent and the spawns
  are the place's. BOUNDED BY ITS SEARCHER (AUDIT GRAVE-PARTY G3): a cell keeps at most `OW_GRAVE_ACCT_ROWS_MAX` (32,
  pinned to the stones a game owes, `GRAVE_OWED_MAX`) rows of one account, its own oldest out past it, and past
  `OW_CELL_GRAVES_MAX` (128) the oldest of whichever searcher holds the most - never another's row for a flooder's; the
  word rides a bucket of its own (`owGraveGate`, a word a second, four deep - the honest game's own pace, kept at home in
  `sendOverworld`), and a word that takes nothing writes nothing. A row's key is its stone and its searcher, and a stone's
  number runs to 4,095, so before it one account saying fresh numbers at the `ow` frames' four a second wrote the whole
  ledger 241 times a minute (3.3 MB) and evicted every honest row.
- **BELOW, THE ROOM'S WORD IS THE SEARCHER'S PARTY'S.** SEARCH1-PARTY's `srch:<i>` started the five hours of EVERYONE in
  the room, whatever it rolled - in a Cemetery every coffin a stranger had touched answered "You have already searched
  here." for five game hours to a player who had never seen it. The word names its searcher now (`by`, the account), and
  a client lands it (its hours, its find) only when the searcher is itself or of its party (`scenes/searchRoom.js`, the
  one home for whose a word is; a word with no `by` - an older build's - is its live speaker's, through the hub's map of a
  partymate's tabs). A stranger's word is KEPT, unlanded: read again at the object (a party made since locks it), and
  carried on in the room's memory this client publishes, so the stranger's own partymates who walk in later still hear
  their party's search - bounded hard, since it rides that memory (512 KB a dungeon): an honest find's alone
  (`SEARCH_LOOT_MAX` pieces through the wire's projection, its own four fields, under `SEARCH_FOREIGN_BYTES`),
  `SEARCH_FOREIGN_PER_OBJECT` an object and `SEARCH_FOREIGN_MAX` in all, the newest kept, each let go at the room's hour -
  its stamp kept NEVER AHEAD OF NOW, an unstamped word's now (AUDIT GRAVE-PARTY G4, the WORLD7/8 C2 law applyLoot keeps
  for a landed word: a forged far-future stamp was kept as said, never let go, and filled the 24 slots in the room's
  memory for good). Each party's find is its own list; a stranger in the same crypt rolls their own. The word names the
  searching character too (`bn`, the session's issued name - G5).
- **"Already searched by <name>."** (`searchedText`, `t('search.searchedBy')`) for an object a partymate searched; my own
  answers SEARCHED_TEXT as before. The ledger keeps the name through the save (`[key, minute, picked, name]`), and the
  LATER search holds the hours - a memory or a welcome about an earlier one never winds a search back.
- **THE FIVE HOURS ARE THE ACCOUNT'S, AND ITS CHARACTER IS NAMED** (AUDIT GRAVE-PARTY G5, chosen). The lock is per
  account - one player, whichever character: an alt searching the stone or the coffin again is the same player's second
  find, which is what Mac's "no one else can again for 5 hours" closes. But a search on character A answered character B
  of the same account "You have already searched here." of an object B never touched. A row (the relay's, from the
  token's name) and a word (`bn`) carry the searching character's name, and `searchToldBy` answers it: a search of my
  account by ANOTHER character is told by that character's name ("Already searched by Ann."); this character's own, or
  one whose name nobody said, the old words. Two characters of one account wearing one name - an account that wears its
  own name (NAME-AS 'account'), or a character's name the service refused (`accounts.js` wornNameOf) - are told the old
  words: they are one name to everyone in the room too.
- **THE REACH IS THE BODY'S.** From the eye, SEARCH_REACH met a coffin's lid a metre and more below it: a coffin on the
  floor answered "You are too far away." unless the player stood within ~0.9 m of its side. The distance is now from the
  upright segment the player stands as (the feet to the capsule's top - the frame's `lastPlayerFeet`/`lastPlayerHeight`
  underground, `player.pos`/`player.eye` on the street) to the nearest point of the object's box; within SEARCH_REACH the
  target's reach is the ray's own, past it SEARCH_REACH (which the eye's ray then already exceeds, so the refusal is
  spoken as ever). The bound is Mac's 1.6 m, half a door's - DEPARTURE from SEARCH1's "half of the interact range as
  doors" measured as a door's is (from the eye), named here.
- **DEPARTURE, named:** SEARCH1-PARTY's "the room's word starts everyone's five hours" (above) is struck - Mac's ask was
  the PARTY's ("When one player in the party interacted with it no one else can again for 5 hours"), and a stranger is
  no one of the party.
- **NOT SHARED, above ground: the find.** The headstone's find is still the searcher's pile at their feet; a partymate is
  told who searched the stone, not handed its pile (a cell keeps no container - the find would be a container protocol on
  the street cell, a slice of its own).

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

- `scenes/dungeonContext.js` - WIRED (both dungeon hosts route `search:` - worldModes.js and dungeon.js); GRAVE-PARTY's
  search room (`scenes/searchRoom.js`) and the body's reach are its own, so both have them. dungeon.js's standalone
  dungeon has no room and no party lens: every word there is its own.
- `scenes/world.js` + `scenes/worldModes.js` - WIRED for a Graveyard location's headstones (`grave:`): the roll, the
  two-per-player ring, the find, the five hours - the search itself `scenes/searchPartyHost.js` (GRAVE-PARTY, moved out of
  bootWorld), which says the stone to the cell and hears the cell's (world.js routes its `gr` word there and ticks it
  every online frame) and registers the party lens the dungeon reads too; worldModes stands the stones at the body's
  reach. The five hours are the party's above ground now; the find is still the searcher's own (GRAVE-PARTY, above).
- `scenes/exterior.js` (the one-city bench) - stands no headstone: it registers no `graveTargets`.
- `scenes/worldModes.js` interiors - none: searching is dungeons and graveyards only, as asked.
