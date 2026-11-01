# Delve II - Dungeon Encounters

Rooms a party comes upon in a dungeon and fights through or works out, each opening a vault chest. Seven kinds: three
wave fights (the Hold, the Wellsprings, the Vigil) and four puzzles (the Litany, the Brazier Rite, the Weighing, the
Seals). Game-made dungeons can also take curated blocks. The player meets them in dungeons in every province, behind
the Features row **Dungeon encounters** (`dungeon-encounters`, on by default, forced on online).

## How it works

- **Sites** (`src/world/dungeon/delveSites.js`). A site is a 4 m disc of level floor in a room the layout already has:
  candidates on a 4 m grid over every non-border block, a ceiling within 12 m, walls on four rays, no mover, door or
  piece reaching in. It keeps clear of doors (4.5 m), start, treasure and quest markers (4 m), a foe marker's own spot
  (2 m), the way in (20 m), every campfire (12 m) and water. A 3 m small-room disc fills in where large rooms leave the
  count short. One site for two inner blocks, one to three, deepest first then spread 60 m apart. The second site takes
  the family the first did not. None stands in a palace, Privateer's Hold, a made level or the Abyss Hollow.
- **The law** (`src/net/delve/delveLaw.js`). Kinds, numbers, the ledger machine and its words. `n` is the party in the
  ward (1 to 8, `DELVE_PARTY_MAX`). Foes come from the dungeon's own encounter table at the player's level and the
  dungeon's tier; a dungeon whose table stands no foe stands no Hold.
- **Waves.** The Hold: three waves of `3 + 2(n - 1) + (w - 1)` foes, at most 12 (`HOLD_WAVE_MAX`), a 5 s breath between,
  a wave giving way after 90 s, then a captain with a boss trait (two in an Elite dungeon). The Wellsprings: two to four
  sources each pouring a foe every 12 s, three alive at most; break them all, then the captain. The Vigil: a relic with
  the Starfall's light that foes go for first; three waves end in a win. Every member out of the ward for 30 s ends the
  attempt and its foes crumble.
- **Puzzles.** The Litany: four plates (five in an Elite dungeon) light in order, then the party steps them in that
  order; a wrong plate darkens all and replays (in an Elite dungeon it also wakes two foes). The Brazier Rite: carry the
  flame, slowed, to three or four braziers before it gutters (20 s off the heart). The Weighing: hold three plates for
  3 s by standing on them or with carried stone weights. The Seals: break `2 + ceil(n / 2)` seals within 40 s plus the
  route floor. No puzzle hurts a player for a wrong answer.
- **The vault** (`src/systems/delve/delveVault.js`). A sealed chest (model 41811) opens when the encounter is won. It
  holds the dungeon's own pile (`rollPileItems`), one known piece Magic or better laddered at the dungeon's pile source,
  and gold at 40 a level (`DELVE_VAULT_GOLD_PER_LEVEL`, 0.8 to 1.2 of it). Online each earner rolls its own share.
- **In the game.** `src/scenes/delve/delveHost.js` makes the plan as the dungeon is built and runs the encounters;
  `src/scenes/dungeonContext.js` wires it in a few lines. The HUD's words are `src/systems/delve/delveWords.js`.
- **Online** (`server/src/delveRoom.js`, `src/net/delve/delveLink.js`, `src/scenes/delve/delveOnline.js`). A page says
  its plan and hash until the room answers; the room keeps up to four plans side by side, so a forged or older plan
  plays alone. The room keeps one ledger a started site in its storage, judged by the client's own law. The first
  speaker's party owns the site; only that party may work its puzzle. Steps are judged at the pose the room last heard.
  The room names the foes' machine, which stands them under the `delve` grant kind. Won, the ledger names its earners:
  the owning party's members at the site in its last 15 s. A relay older than `DELVE_RELAY_MIN` stands no site online.
- **Curated blocks** (`src/world/dungeon/curatedBlocks.js`, `src/world/dungeon/curatedSplice.js`). A real BLOCKS.BSA
  interior block as base, with objects dropped by name, Daggerfall's models, flats, markers and lights added, and one
  encounter's anchor. The records are `src/assets/delve/`: `crypt-hall`, `desecrated-chapel`, `mine-gallery`,
  `throne-hall`. A game-made dungeon whose type's pool holds one takes it at `CURATED_CHANCE` (a half), in place of one
  non-start interior block, drawn off its map id. Its room tag names the block. The lab (`?dungeon=lab`,
  `src/scenes/delve/delveLab.js`, the `delve.html` page) builds and exports drafts.

## Rules

The owner's decisions:

- Encounters appear in every dungeon, the same on every machine, no layout changed.
- Curated blocks stand only in game-made dungeons: spawned (`src/world/spawnedDungeons.js`), Elite and the lairs past
  the Bay (`src/world/tamrielDungeons.js`). Daggerfall's own dungeons keep their layouts.
- Online the server tracks and the party owns: the relay keeps each encounter's progress and says who earned its vault;
  only the party that started a puzzle can work it.
- The reward is a vault chest, not looks, titles, questline progress or shortcuts.
- The clock puzzle and the Orrery of Endings are excluded.

Standing laws:

- The layout stays: no block added, moved or removed in Daggerfall's dungeons, so every marker stands where it did.
- Never in the way: no site on a door, mover, way in or marker. A puzzle guards a vault, never a passage. A ward holds
  no player.
- One to eight: every encounter is won by one character of the floor build and scales to eight.
- The same on every client: sites are a pure function of the layout, the collider and the dungeon's seed.
- Nothing faster, nothing unfair: a timed window is never under its route walked at `DELVE_PACE_MPS` plus 1.5 s.
- Once a respawn: a won site stays won until its dungeon's respawn (`src/systems/dungeon/dungeonRespawn.js`).
- POWER-CEILING holds: nothing here is a new line, rung or band. LOOT-GATE applies to the vault as to any chest.
  Player-facing text may say a vault holds gold, a Magic or better piece and treasure, never its odds.
- A stranger may fight a wave's foes and earns nothing (default until the owner says otherwise).
- Tamriel: sites read the layout only, so lairs past the Bay stand encounters as Daggerfall's dungeons do.

## Daggerfall Unity

DFU's dungeons hold no encounter rooms. This is the port's own departure (DELVE II). Curated blocks are built from a
base block rather than a whole World Data JSON, so no block of the game's enters the repository.

## Code and tests

- `src/world/dungeon/delveSites.js` - the site law; `tools/delveSiteProbe.mjs` - the census over every dungeon
- `src/net/delve/delveLaw.js` - kinds, numbers, ledger, earned
- `src/scenes/delve/` - the host, kinds, pieces, bodies, online half and lab
- `src/systems/delve/delveVault.js` - the vault's roll
- `server/src/delveRoom.js` - the relay's ledger
- `test/net/delve/dlv1_law.test.js`, `test/net/delve/dlv4_law.test.js` - the law, every kind
- `test/world/dlv1_sites.test.js` - the site law
- `test/scenes/delve/dlv2_host.test.js`, `test/scenes/delve/dlv4_host.test.js` - the host offline
- `test/net/delve/dlv3_relay.test.js`, `test/scenes/delve/dlv3_online.test.js`, `test/scenes/delve/dlv3_e2e.test.js` -
  online, through the real Room
- `test/world/dlv5_curated.test.js`, `test/world/dlv6_blocks.test.js`, `test/world/dlv56_audit.test.js` - curated
  blocks
- `test/systems/delve/delvevault.test.js` - the vault
- `tools/delveProbe.mjs` - wins encounters in the real game over the freeware data
