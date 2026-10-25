# AUDIT UPDATE (2026-10-25) - the update of 2026-10-25, audited after it merged onto main

The owner handed over an update (`dfo-update-2026-10-25.zip`: a patch and its files, cut on #1209's merge) - GOLD-ALL,
OW-TOWN-ROUND, COMPANION-VOL, HEARTY-MEAL and ENDLESS-ARROWS (Port-Ledger A's five rows of 2026-10-23) and LOOT-GATE
with the Reforge's Imbue (Dudey, 2026-10-25) - and it was applied onto main past the Sky-Ketch (70fd6dadc). Then:
**"Audit this"**. This page is the findings, each with its verdict. What the audit changed is written into the record's
sections as they now stand, each change under its finding's id (AUDIT UPDATE L1 and on), and the code says the same at
every site. LOOT-GATE's levels, factors and chances are given nowhere on this page (CLAUDE.md LOOT-GATE).

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN SNAPSHOT of the branch at 70fd6dadc (Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING): told to reproduce every finding with a probe and its saved output before reporting it, and to
cite the code by its text. The fixes were made in the working tree beside them and no lane read a line of them. Every
finding was then met by a pin that fails without its fix and a mutant record that proves it
(`tools/mutants/audit_update.json`: 68 records, 67 dead, one recorded equivalent).

| Lane | Over | How |
|---|---|---|
| L - the loot | LOOT-GATE and the Imbue: the gate's law, every door that rolls a tier, the drought, the room's shared roll, the Imbue's price, refusals, law and worth | 12 probes: a level-30 host and a level-3 joiner on one room's dice, the whole PARTY-LOOT block with each peer's own level registered, 200 imbued pieces against the item law and the wire, a counter's price before and after, a scene's first foes before any host frame |
| T - the road | OW-TOWN-ROUND: the middle, the spot put out on the ring, the ends' rings, the host's click | the player's own ARENA2: 15,251 locations' rects rebuilt as the host builds them, real towns clicked at their centres, 1,755 FREE walks beside a hamlet, 48 coastal towns, 15 hand mutants |
| E - the shop, the meal, the voice, the purse | ENDLESS-ARROWS, HEARTY-MEAL, COMPANION-VOL, GOLD-ALL | 6 probes and a mutant loader: a steal-then-buy loop offline and online, a back shelf, a caravan, a three-day journey after a meal, a peer's companion |
| P - the pins and the record | every test, mutant record and claim of the change | the change's 34 committed records run (all dead), 108 one-character mutants of its own, the 418 test files that name the touched modules, the Ledger's rows and the pages against the code |

**WHAT THEY FOUND.** Four HIGH: a room's shared loot read each client's own level, so a party member's elite bodies
stood unreadable (L1, P1); the Imbue made Rare pieces the judge holds (L2); a click in a town's very middle was sent out
to its ring (T1). Alongside them the merge's own breakages (S1-S5) and a decision that is not the audit's to make (U1).
Each is FIXED below, LEFT and said, or OPEN.

## U - the owner's call

- **U1 OPEN - LOOT-GATE moves a standing law of Mac's.** `06-Systems/Loot-Arc.md` law 1, "The source sets the odds,
  never the player" (LR1, Unleveled Loot's law), is listed as a standing call of Mac's that "no slice moves", and
  LOOT-GATE scales the top tiers by the roller's level. The audit did not rewrite the law: law 1, `Loot-Rarity.md`, the
  LR1 row and the LOOT1-11 row each now say that LOOT-GATE departs from it, OPEN for Mac's ruling, and the gate's own
  Ledger row is a DEPARTURE. Mac rules it kept (the pages' law reworded) or the gate dropped.

## S - the merge (the suite on the update)

- **S1 MEDIUM - the gate's leaf never deployed.** `lootLevelGate.js` is bundled into the account Worker (lootRarity.js
  imports it), and `account-deploy.yml`'s path filter did not name it (ACC1-CI, DISCORD-CODE). FIXED: named.
- **S2 LOW - TIME1's census** quoted the counter's commit as it stood before ENDLESS-ARROWS. FIXED (the row's text, and
  E-N7 put the commit back as it was).
- **S3 LOW - three pins the gate moved** (LR1's pile and corpse door, WORLD8's pile, ELITE-RARE's line). FIXED: PIN MOVED.
- **S4 LOW - thirteen languages owed the update's words** (L10N1b, L10N6b): drafted in session (`tools/l10nInSession.mjs`),
  the machine's rows, with the audit's own words changed beside them.
- **S5 LOW - two pins the update broke at its own base**: the Imbue's page wrote English the text core never saw (L10N4:
  routed through `t()`, the file's count where it was) and LR1's pile.
- IT1, WD1 and FOUNDER5 fail on main as they do here - not the update's.

## L - the loot (LOOT-GATE and the Imbue)

- **L1 HIGH - a room's base read each client's own level.** Every gate under `rollRoomBase` - the corpse door, the kit,
  an elite's and a revenant's share - fell through to the local player's registered level, so the base's signature
  differed between a host and a joiner of different levels and the joiner's body stood unreadable ("Something in here
  is from a newer version of the game"): 17% of elite bodies on one pair of levels. FIXED: `withRollerLevel` (the leaf's
  scope) and the base rolled inside it at the room's level (`roomLootHost.js`). Pinned (partyloot: each peer's own level
  registered as lootPowers.js registers it, an elite among the layout's bodies; audit_update_loot L1),
  AUDIT-UPDATE-L1-*.
- **L2 HIGH - the Imbue made Rares the judge holds.** A found Magic piece's technique line was kept at the Magic band
  and a won sigil below the Rare's floor, so 178 of 200 such pieces came out unlawful: held at every realm checkpoint,
  refused on every wire. FIXED: the technique rolled again in the new band (its id kept), the sigil at least at the new
  tier's floor, and the item law asked before anything is paid - a piece it would hold is put back exactly, nothing
  taken. Pinned (audit_update_loot L2), AUDIT-UPDATE-L2-*.
- **L3 MEDIUM - the Imbue wrote over the Item Maker's rows.** FIXED: a found Magic piece carrying a row that is not its
  curse's is not the Imbue's. Pinned, AUDIT-UPDATE-L3-*.
- **L4 MEDIUM - a scene's first foes rolled ungated**, before any host had published the player's door - a new
  character's first dungeon, the report the gate was written for. FIXED: the corpse door names its roller's level
  (`hostCombat.js` spawnEnemyLoot, `rollCorpseLoot`'s `level`), and a tavern's pile the player's. Pinned, AUDIT-UPDATE-L4-*.
- **L5 LOW - an imbued Rare sold as a plain piece**, below the Magic it was. FIXED: the Imbue records what it added
  (`imbueWorth`) and a counter takes that alone off. Pinned, AUDIT-UPDATE-L5-*.
- **L6 LOW - a young character's Legendary left the drought standing.** FIXED: a Legendary taken empties it at any
  level. Pinned, AUDIT-UPDATE-L6-a-Legendary-held-too.
- **L7 LOW - LEFT: doors the gate does not hold.** The world's shared and receipt-seeded spoils (the Gate, the Abyss,
  the raids, the Ketch, the serpent, the starfall) roll ungated, and a revenant's Rare is its rank's. A gate there read
  off one client's level would break what the room or the service agrees on (L1's class); each member's share gated by
  that member's level is the way, and the owner's call.
- **L8 NOTE - the player's words said "never your level".** FIXED: the loot row's note says the gate in the words it may
  be told in and no number (pinned: LR1, no digit in the note); the leaf's comments corrected; the pages per U1.
- **L9 NOTE.** FIXED: one reading of a level (a number's string gates as its number). Noted, no change: a realm-bound
  copy can be imbued and gains nothing; a fast double press is charged once; Mentor Mode gates at the mentored level and
  a room's pile at the party's level, as the rest of a room's loot is.

## T - the road (OW-TOWN-ROUND)

- **T1 HIGH - a click in a town's very middle went to its ring** whenever it did not take the town (FREE, the
  neighbourhood, a fine-move key): four of five real towns' dead centres moved some 330 m out, a centre click from the
  east wall walked 1.3 km round to the west band. FIXED: the click remembers its middle, and a middle click or a
  fine-move click is walked to as clicked. Pinned (ow_town_round wired, tv2), AUDIT-UPDATE-T1-the-middle-forgotten.
- **T2 MEDIUM - with Travel Options' places alone, a click on a town's edge was refused** as "Click a town". FIXED: in
  that setting a click anywhere on the town is the town's. AUDIT-UPDATE-T2-*.
- **T3 MEDIUM - a sea spot beside a town could land the boat mid-sea** (AUDIT OW5 S4 again). FIXED: a spot on the sea
  hands no end. AUDIT-UPDATE-T3-*.
- **T4 MEDIUM - a FREE plan pulled taut missed its end rings** (31% of walks beside a hamlet still crossed it): the step's
  sign alone aimed the crossing test. FIXED: the step's own length. Pinned, AUDIT-UPDATE-T4-*.
- **T5 LOW - the start ring read the end's afloat rule**: a landfall's start was ringed from the water, an embark's
  crossed its town. FIXED, AUDIT-UPDATE-T5-*.
- **T6 LOW - the laws the pins left loose** (the west and north bands, the crossing test, the step's sign, an end under
  sail, the tie, a spot on the wall, a traveller beside the town by one axis). FIXED: pinned, AUDIT-UPDATE-T6-*.
- **N1, N2 NOTE** - two comments said what the code never does. FIXED. **N3 NOTE - LEFT, before this change**: a FREE
  plan pulled taut drops the towns it passes through. An undiscovered town (no plate) is entered by a fine-move click.

## E - the shop, the meal, the voice, the purse

- **E1 MEDIUM - a theft and one arrow bought filled the quiver**: +925 gold in five cycles offline, the STOLEN-GOODS
  circle again. FIXED: a purchase puts back what it took, up to the whole. Pinned, AUDIT-UPDATE-E1-*.
- **E2 LOW - any shelf of a General Store became an endless quiver.** FIXED: the counter's shelf alone; and the host's
  extra entry out again (E-N7: `createWorldModes` 11,040 -> 11,039). AUDIT-UPDATE-E2-any-shelf-a-quiver.
- **E3 LOW - mutants the pins let live** (the whole read as exactly it, a mixed lot, the meal's holds summed, one coin
  greyed). FIXED: pinned. The fresh quiver's `mintCondition` is recorded EQUIVALENT (the arrow arm sets its condition).
- **E-N4, E-N5 - the meal's hold.** FIXED: no record holds longer than one meal; a journey past the replayed span owes
  nothing for the hours the meal held.
- **E-N6 - the companions' row said "your companions"** and quiets every companion heard (a peer's puppet carries the
  mark too). FIXED: its note says so; the Ledger row's hosts corrected.
- **E-N1, E-N8 - the pages and a reason.** FIXED: `Arrow-Supply.md`, the docblock. **LEFT**: a caravan's counter stocks
  the whole quiver and sells out (N2); a refill stops at the whole, not DFU's merged draw (N3); offline, DFU's own spread
  (N9).

## P - the pins and the record

- **P1 = L1; P2 = L5** (and the kept technique's price: the line rolled again carries its own).
- **P3 MEDIUM - the gate as the game runs it was pinned nowhere**: the registry, Mentor Mode, every door's level, the
  drought's level, an elite's and a revenant's shares, the Imbue's purse, its refusal words and its marks. FIXED:
  `test/systems/audit_update_gate.test.js`, AUDIT-UPDATE-P3-*; and the mutants the update's titles named and nothing ran
  now run (LOOT-GATE-*, HEARTY-MEAL-*, COMPANION-VOL-*).
- **P4 MEDIUM - the pages that state the laws the update moved** (LR1, Loot-Rarity, Loot-Arc law 1 and the drought,
  LOOT1-11). FIXED per U1; LOOT-GATE and the Imbue have their own Ledger row, THE FOUR HOSTS named.
- **P5, P6, P7 - comments, ENDLESS-ARROWS' and COMPANION-VOL's rows, Travel-View's A5.** FIXED.
- **P10 NOTE - the update's own commit message gave one of the gate's levels.** Pushed before the audit; not rewritten
  (the levels stand in the shipped source). No patch note, release note or Discord post may.
- **P11 NOTE** - `buildDungeonContext` 8,399 -> 8,400 logical lines (the pile's `level`), under its ceiling.
- **P13 NOTE - LEFT**: the Imbue's rollback is now the law guard's (L2); salvaging an imbued piece and a patron's worth
  of one print nothing at the Imbue's prices.

## R - the real game

Not run: no lane booted the game in Chromium on this audit. Every finding above was reproduced on the code itself,
the map's own data where it mattered (lane T).
