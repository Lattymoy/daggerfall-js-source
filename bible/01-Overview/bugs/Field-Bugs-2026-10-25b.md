# FIELD BUGS 2026-10-25b - loot that says "a newer version of the game" when there is none

One report, handed over in a Claude Code session: "Loot will sometime be unobtainable and say theres a 'new version of
the game' when there isn't and you will have to leave and come back to the dungeon", and then "This was also happening
when solo". Read on main's `ee6b01e551`. Named 25b: main's `Field-Bugs-2026-10-25.md` (ART-DOLL) took 25. The pins are `test/systems/partyloot.test.js`'s two "CHAMP-BASE" cases, the
mutants `tools/mutants/fb1025b_champbase.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Loot will sometime be unobtainable and say theres a 'new version of the game' when there isn't" | A dungeon body the layout marks a champion (LOOT7) had two shared bases in one room: the champion's level gate was read at each player's own level, and a class foe is built at its builder's level. A player under level 3 rolled the plain foe's base, and PARTY-LOOT read the host's word about the body as another build's | CHAMP-BASE |
| 2 | "This was also happening when solo", and "you will have to leave and come back to the dungeon" | A player alone is the room's host, and the only word it can disagree with is the room's memory - an earlier visit's, often its own on the build before an update. A memory word this build could not match locked the container for the visit; the next memory write left it out, so the visit after that rolled it fresh | STALE-MEMORY |

## CHAMP-BASE (1) - `src/scenes/roomLootHost.js`, `src/systems/champions.js`

FOUND. The words are `LOOT_NEWER_TEXT` ("Something in here is from a newer version of the game. Reload to open it."),
which the dungeon's `takeLoot` says for a container in `_lootUnreadable`. PARTY-LOOT's `landRoomWord` puts a body there
when the base signature a word carries (`h`) differs from the one this client computes for the same terms - the law reads
that as another build (`systems/roomLoot.js`, THE TAKES). Reproduced through the two-peer harness over the real
producers before the fix: a level-30 host and a level-2 joiner in one party, six layout bodies of a class foe all marked
champions - three of the six unreadable to the joiner on `ee6b01e551` (five on `df1a2f8d8c`), and the joiner's press said
`LOOT_NEWER_TEXT`. With the joiner at level 3, or with no mark, none.

WHY. Every client marks the same records (`markDungeonChampions`, a hash of the location and the marker), but
`applyChampion` stands no champion under `CHAMPION_MIN_LEVEL` (3), and a class foe is built at its builder's level
(`dungeonContext.js` buildFoeAt: `makeEnemyEntity` at `effectiveLevel`). So the host's copy of a marked class foe was a
champion and a level-1 or level-2 joiner's was not. `roomBodyBase` moved a class foe's level to the room's for the base,
and read the champion mark the build had left. A champion skips PLAIN-LOOT's keep (`hostCombat.js` `eliteLooted`), and
the plain foe draws once a piece there, so the two clients' dice parted and every later piece differed. The mark is held
for the visit: it is cleared only by a readable word about that body, and the host says one only when a piece is taken
(a rebuild's `forgetRoomContainer` leaves `_lootUnreadable` as it was). About one layout foe in fourteen is marked
(`CHAMPION_PER_MILLE`), so a party with a character under level 3 met it on several bodies a dungeon. Alone, the same
gate split a character's visit before reaching level 3 from its visit after (STALE-MEMORY, below).

Daggerfall Unity has no room and no shared base; LOOT7 and PARTY-LOOT are the port's own (Port-Ledger A: THE LOOT ARC,
and PARTY-LOOT's record in `06-Systems/Online-Arc.md`). Nothing here departs from a DFU member.

THE CALL:

- **The room's base judges the mark at the room's level.** `roomBodyBase` already stands a class foe at the party's
  level (`terms.lv`); it now asks the layout's mark (`f.src.champion`) at that level too, through `championTraitFor`
  (`champions.js`) - `applyChampion`'s gate, moved into its own export so the build and the base ask one rule. An elite
  foe is never one, as `applyEliteScaling`'s first arm stands it. Every client computes the same base again: the
  terms and the record are the room's.
- **The build is unchanged.** Each client still stands the mark at its own level, so a level-2 player's copy of a
  marked class foe is no champion in its own fight. The base hands the entity back as its builder stood it (its mark
  restored with the rest of what it set aside).
- **The base stamps its own cap.** A plain copy's build stamps FOE-CAP's `lootCap` on the entity, and a champion's chain
  stamps none, so the base would have carried the build's cap into its record - which the player's own bonus reads
  (`rollRoomBonus`'s `lootCap`). `roomBodyBase` sets the build's cap aside for the roll and restores it after. No death
  handler caps a room body after its base: the kill's `raiseEnemyDeath` skips a room body (`if (!_roomBody)`), and an
  execution's runs before the body is born, which is when its base first rolls.
- **The bonus reads the base's champion.** The base record keeps the trait it rolled a body as (`champion`), and
  `roomBonusOf` hands that to `rollRoomBonus` - not the entity's own mark, which would roll a level-2 player's bonus over
  a champion's base on a plain foe's corpse source.

## STALE-MEMORY (2) - `src/scenes/roomLootHost.js`

FOUND. Alone, a player is the room's host, so no other player's level or build is in the room. The words it lands that it
did not mint are the room's memory (`dungeonContext.js` restoreSharedWorld, a word with no speaker): its own earlier
visit's, kept for the dungeon's respawn time. Any difference between that visit's roll and this one's took the same arm
as another build's word - `_lootUnreadable`, "Reload to open it" - though the word was the room's own. Two such
differences: the character crossed level 3 between visits (CHAMP-BASE's gate - the base now reads the word's own level,
`terms.lv`), or the game updated between visits and the base chain changed (an update a day changes some loot roll; the
word carries no build), so a reload could not help. Not reproduced in the game; reproduced in the harness with a word
signed otherwise than this build signs it.

WHY "LEAVE AND COME BACK" CLEARED IT. The memory is written whole (`dungeonContext.js` sharedWorld: `w.loot` is
`lootRecords` of the containers seen), and a container held unread has no room state, so its word was left out of the
next write. The visit after that found no word for it and rolled it fresh.

THE CALL:

- **The memory's word on the host is started over.** A word with no speaker that this build cannot match makes the host
  let it go (`restartStaleContainer`): the container is unborn again, and its next mint takes the generation after the
  stale word's (`_roomNextGen`; a body's mint through `bodyGeneration`, past its death). A newer generation beats the old
  terms on every client (`roomTermsBeat`), so a partymate who landed the old word takes the new mint. What the earlier
  visit took from the container is back once.
- **A live peer's word stays another build's**, and so does the memory's on a client that is not the host: an out-of-date
  joiner must not start the room's container over for everyone. A client that held a stale memory word unread and then
  takes the seat (`roomTakeSeat`) starts it over then.
- **CORPSE-GOLD is left its second landing.** A body still being rebuilt as the memory's species (`dungeonContext.js`
  `_retyping`, now one handle the module reads) is never started over: its word lands again once the rebuild stands.

FOUND IN PASSING, NOT TAKEN. A gold pile over `LOOT_STACK_MAX` (65,535) is refused by `validLootList`: a dropped purse
(`itemTransfer.js` planDropGold), the open zone's remains (`wildDropLaw.js` takeWildGold) and the legacy remains mint
such piles from a large purse (`test/honestItems.mjs`'s gold sweep: 500,000 and more). Raising the wire's bound for
gold is a call about forged quantities, and those producers are not the dungeon's; it is its own slice.

THE FOUR HOSTS: dungeonContext.js - WIRED (the PARTY-LOOT block, `scenes/roomLootHost.js` `createRoomLoot`, which it
constructs; one handle added, `_retyping`'s getter); worldModes.js - unchanged (both dungeon hosts take dungeonContext.js's
doors); world.js - unchanged (the same); exterior.js - stands no room base (a body there is its owner's one list,
`scenes/bodyLootHost.js`, and a street champion's trait rides its owner's record, `cp`).

PINS. `partyloot.test.js` (20 cases, was 18), two "CHAMP-BASE" cases, each putting the suite's clock back after it (a
body's generation is its death, so a later case's rolls must not move with it):
- a level-30 host and a level-2 joiner over six class-foe bodies the real pick marks two of - one pick on both machines,
  the host's copies champions and the joiner's not; after the fall, no body unreadable, every plaque the host's base, a
  marked body's base a champion's (no plain cap) and an unmarked one's a plain foe's, the joiner's bonus rolled over a
  champion, the joiner's press on a marked body taking, and each entity handed back as its builder stood it (mark and
  cap); then a party under level 3, where the mark is no champion in the base either. Red before the fix
  (`FB1025B-CHAMPBASE-the-builders-mark`).
- a pile's memory word signed otherwise: the host starts it over one generation on and the joiner who held it unread
  takes the new mint, one base for both; a live peer's mismatched word stays unread on both; a client that takes the
  seat starts its held word over, a body laid dead at the word's own death minted one past it, and a body being rebuilt
  held unread through the seat.

The harness's build follows the dungeon's own now: the layout's marks (`markDungeonChampions` by the room's LocationId,
which marks none of the six in the other cases) and `applyEliteScaling` sliced from dungeonContext.js, before the loot.
Pins moved, each marked: `test/net/partyloot_wire.test.js` and `test/scenes/fb1018d_seatloop.test.js` hand their mount of
the room block its new import (`championTraitFor`) and the host's `_retyping`; `partyloot.test.js` "PARTY-LOOT by source"
reads the base keeping its champion. At the merge past main's AUDIT UPDATE L1, whose harness marks one layout foe an
elite: that foe is one of the two the case's pick marks, so the harness marks the elite on its record and the build's own
`applyEliteScaling` promotes it (as the game does - an elite is never a champion), and the case holds the elite's base to
no champion. MUTANTS: `tools/mutants/fb1025b_champbase.json` (16, all dead - the elite arm too, since the merge);
`tools/mutants/loot7.json`'s LOOT7-stands-off, LOOT7-stands-under-level-3 and LOOT7-stands-an-ally re-aimed at
`championTraitFor` by content, and that list re-run whole (44, all dead).

NOT SEEN IN GAME. Checked through the two-peer harness over the dungeon host's real loot doors and the real producers,
not with two real players, and not across a real update. The harness itself runs the host's source text under stubs - a
text pin by the repository's standing rule (behavioural tests over text pins); a harness that calls `createRoomLoot`
directly is its own slice.
