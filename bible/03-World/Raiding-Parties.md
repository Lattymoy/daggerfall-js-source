# Raiding Parties

A port of Kamer's **World Events - Raiding Parties 1.1**, made for this port. Each game day towns are raided by
knights, bandits or orcs; a player in a raided town fights them off beside the watch, for reputation, Renown, gold and
the raiders' own Aetheric sets. Online the relay keeps each raid's count. The player meets raids on the HUD's event
board, the held map and in the streets of towns across Tamriel.

## How it works

- **The day's roll** (`src/systems/raidingParties.js`, `src/net/raid/raidLaw.js`). On the Bay a region is picked evenly
  among those holding a city, hamlet or village, then a town evenly in it; a town is raided at most once a day. Each
  province past the Bay is a lane of its own (`raidDayRandom(day, lane)`), its towns the registry's grouped by area
  (`raidLaneGroups`). A raid starts between 00:00 and 22:00, lasts two game hours, brings one party (knights; bandits:
  Rogue, Thief, Burglar; orcs: Orc, Sergeant, Warlord) and needs 15 to 25 deaths to drive it off. The roll is the
  shared day's, so every client names the same raids.
- **In the town.** Raiders come in packs of 3 to 5 about each player in turn, the town's defenders one at a time while
  fewer than 8 stand. The cap is 25 alone, 5 more for each other player, to 40. A spot stands only on a street of the
  town's walk grid that meets the player's (`src/scenes/raidSitesHost.js` `reachable`).
- **Kinds** (`src/systems/raidKinds.js` `raidKindOf`, hashed off what the day drew, never a draw of its own):
  - Raid (`classic`): the mod's raid.
  - Assault (`waves`): three or four waves with a 12 s breather, the last the party's leader, an elite with two boss
    traits.
  - Siege of the Standard (`defend`): a watchman standard-bearer at the square (`src/scenes/cityGuards.js`
    `standBearer`), raiders sent at him in packs every 4 s; if he is killed the town is sacked and the raid goes on.
    Every third death counts toward the target.
  - Exodus (`escort`): three refugees walk from the town's edge to its square behind a guide while raiders hunt them.
- **The end.** At the target the town "has been cleansed". A player who fought there gains legal reputation and
  standing with the region's People, its first knightly order and the Fighters Guild. A town whose objective was kept
  is held (`raidHeld`): more reputation, and more in its thanks. A raid that runs out its two hours withdraws.
- **Online** (`src/world/raidShared.js`). One runner a town by the claim law (`raidRunnerOf`). The relay keeps each
  raid's ledger in the town's cell (`raid:<key>`), counts deaths, holds the cleanse and the participants even if
  everyone leaves, and signs a receipt.
- **Rewards.** The account service pays Renown for a receipt once a raid and account, at most 6 a game day
  (`server-account/src/raids.js`, `src/net/raid/raidClaims.js`). The client rolls the town's thanks off the receipt's
  seed (`src/systems/raidSpoils.js` `rollRaidSpoils`): gold by level, one known piece Magic or better, and a quarter of
  the time a piece of the party's own set (the knights' Broken Oath, the bandits' Thief-Taker's Garb, the orcs'
  Orcsbane Harness; `11-Multiplayer/Sigil-Sets.md`).

## Rules

- Mac's design answers: the relay keeps the raid; keep the mod's behaviour; add Renown and the raids' own Aetheric and
  armour sets; Kamer made the mod for this port.
- Raids have kinds with mechanics: waves, defend, escort and classic skirmish (the owner). The puzzle is excluded.
- Town raids stand their raiders as the staff event does: packs, the pack scale, a stalled pack moving on, no spawns in
  a wall (the owner).
- Cyrodiil, the open PvP zone, stands no raid: no site-bound world event in the open zone (the owner).
- Online, only the day's two front provinces are raided past the Bay (`World-Wide.md`, FRONTS).
- The mod's lines open the HUD's event board (`10-UI/Event-Board.md`) and are filed in the journal.

## Daggerfall Unity

Kamer's mod (`vendor/world-events-raiding-parties/`) is the reference; the port does not keep its bugs. Departures:
raid kinds, packs about every player in place of one raider about the runner, the relay's ledger and receipts, the
rewards, and the lanes past the Bay.

## Code and tests

- `src/systems/raidingParties.js` - the roll, the runner, the kinds' play
- `src/systems/raidKinds.js` - a raid's kind
- `src/net/raid/raidLaw.js`, `src/net/raid/raidReceipt.js`, `src/net/raid/raidClaims.js` - ledger law, receipts, claims
- `src/scenes/raidSitesHost.js` - the town's square, streets and reachable spots
- `test/systems/raid1_raidingParties.test.js`, `test/systems/raid2_raidsOnline.test.js`,
  `test/net/raid3_raidLedger.test.js`, `test/net/raid4_rewards.test.js`, `test/systems/raid4b_sets.test.js`,
  `test/systems/raid5_kinds.test.js`, `test/systems/raidroll.test.js`, `test/systems/raidpacks_town.test.js`

## Open

- The towns table's pin (`RAID_TOWNS_SHA256`) is for the operator to set from real game files (`tools/raidTowns.mjs`);
  until then the relay checks the day's slots alone.
