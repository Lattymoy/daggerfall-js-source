# Searchables and the Plain Foe's Loot

Coffins, sarcophagi, shelves, chests and crates in dungeons, and headstones in graveyards, can be searched: each search
wakes undead or the dungeon's own foes, finds loot, or finds nothing. The same page holds the caps on what a plain foe,
a champion and an elite drop. Classic Daggerfall searches none of these objects and caps no drop; both are the game's
own.

## How it works

**What can be searched** (`src/systems/searchables.js`, the whole law). Objects are known by DFU's model numbers, read
off the player's own ARCH3D.BSA; no art ships:

| Kind | Models |
|---|---|
| coffin | 41315-41318 |
| sarcophagus | 41319-41327 |
| shelf | DFU's shop shelves list, and 41010, 41025, 41027, 41043, 41045, 41807, 41809 |
| tombstone | 43011-43082, 43101-43104, 43117-43136, 43142-43145 |
| chest | 41811, 41812, 41816, 41817, 41826, 41829 |
| crate | 41815, 41818, 41822, 41824, 41825, 41827, 41828, 41830-41834 |

Cupboards (41003, 41004) are not searched. Searching is for dungeons and graveyards only.

**The search.** Reach is half a door's activation distance (`SEARCH_REACH`, 1.6 m), measured from the player's body to
the nearest point of the object's box. Underground, the roll is a third each: foes, a find, or nothing. At a graveyard's
headstone it is two in three nothing, a sixth each. A grave, coffin or shelf wakes an undead by the player's level; a
chest or crate draws from the dungeon's own roster, minus its water species, standing on dry floor. The named foe is an
elite half the time (`SEARCH_ELITE_CHANCE`). A find is one to four items, the first always gold, from the kind's goods,
then the rarity ladder at the place's pile tier. A parchment box tells the result; the foes stand or the find opens only
when it is closed. A searched object's find is in Detect Treasure's walk while it lies there.

**Locks.** One chest or crate in three is locked (lock 1-15, by where it stands), picked with a Lockpick in Steal or
Grab mode (`06-Systems/Lockpicking.md`). A picked lock stays picked.

**Five hours.** An object searched cannot be searched again for five game hours (`SEARCH_COOLDOWN_MINUTES`), kept in the
save (`modSaveData` vendor `Searchables`).

**In a party.** Two foes stand for every party member there (`SEARCH_FOES_PER_PLAYER`); only the named one may be
elite. Underground they ring the object; what the room cannot hold stands beyond the nearest door. The five hours belong
to the searcher's party, and the lock is per account, whichever character. A partymate is told "Already searched by"
and the searcher's name. Underground, the search is said to the dungeon's room as `srch:<i>`, naming its searcher; only the searcher's
party lands it, and a partymate opening the object within the five hours sees the same find, minus what was taken
(`src/scenes/searchRoom.js`). Above ground, the street cell's relay keeps a headstone's search for five hours with the
searcher's verified account and character name (`src/net/overworldLaw.js` `owFoldGraves`), and each game locks its own
party's stones (`src/scenes/searchPartyHost.js`). A stranger's search locks nothing of the player's. The headstone's find
stays the searcher's own pile.

**The plain foe's loot** (`src/systems/foeLootCap.js`). A plain foe (no elite, champion, revenant, named or world-boss
mark, and not a boss) drops at most 3 items, gold included (`PLAIN_FOE_LOOT_CAP`), or 5 in an Elite Dungeon
(`ELITE_DUNGEON_FOE_LOOT_CAP`), capped at spawn and again after every death handler. Gold is folded into one stack and
kept; quest items are never dropped; the rest are kept best first (a Magic-or-better piece, then a supply, then the
dearest). Outside an Elite Dungeon its ladder is `PLAIN_FOE_RARITY_WEIGHTS`: Magic 5% plus 0.5 a tier to 19%, Rare
0.6% plus 0.12 to 3.8%, Legendary 0.015% plus 0.0075 to 0.3%. Its worn kit rolls the same ladder at death.

**Champions** roll Magic and Rare at half a plain foe's thresholds, their Legendary unchanged, nothing forced onto the
body, and stay outside the cap (`championSource`). **Elites'** extra Rare roll is half a champion's Magic chance at that
level (`src/systems/eliteFoes.js` `eliteRareChance`).

## Rules

- **Searchable objects: a third foes (undead elites half the time), a third loot of one to four items with gold always
  one, a third nothing** (Mac).
- **Two foes a player; when one party member searches, no one else can for five hours; the party sees what the looter
  sees** (Mac). The five hours are the party's, not the room's: a stranger is no one of the party.
- **Reach is 1.6 m from the body**, a departure from measuring from the eye as a door does.
- **A plain foe drops at most 3 items, 5 in an Elite Dungeon; white, blue rare, yellow very rare, orange almost
  impossible; bosses are not affected** (Mac).
- **Champions drop at half an elite's rates, with no guaranteed Rare** (Mac); **an elite's Rare is half a champion's
  blue** (Mac).

## Code and tests

- `src/systems/searchables.js` - kinds, models, the roll, finds, locks, the five hours
- `src/scenes/searchRoom.js`, `src/scenes/searchPartyHost.js` - the party's search underground and above
- `src/net/overworldLaw.js` - the cell's headstone ledger
- `src/systems/foeLootCap.js`, `src/systems/eliteFoes.js` - the plain foe's cap and ladder, the elite's Rare
- `test/systems/search1_searchables.test.js`, `test/systems/searchfindloot.test.js`

## Open

- A headstone's find is not shared with the party above ground: a street cell keeps no container.
