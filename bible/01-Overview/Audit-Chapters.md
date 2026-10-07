# AUDIT CHAP - the Chapters arc's record and its Roll audited, 2026-10-07

Mac, of CHAP0 (`11-Multiplayer/Chapters-Arc.md`, the design record) and CHAP1 (the Roll - a realm character's standing
with Daggerfall's guilds kept by the account service): *"Lets do a deep audit on everything so far before we continue"*.
Five lenses read the tree at `1100fec1`, each on its own and each told to prove what it reported (a node probe over the
real migrations, the real modules, DFU's C# or the quest scripts the port loads), and none edited the tree while any of
them was reading (Home.md, DO NOT FIX WHILE THE VERIFIER IS READING):

- **the service** (S): `server-account/src/npcRoll.js`, its routes, the migration, the realm's deletes;
- **the playing tab** (C): `src/net/npcRollTracker.js`, its wiring in `scenes/world.js`, the door, the realm session;
- **Daggerfall's law** (D): the leaf's move, the twenty-two, the memberships, DFU's real reputation changes;
- **the record** (R): the arc page, the ledger, the indexes, the comments;
- **the pins** (T): 43 extra mutants over the slice (2 dead, 41 survived), and the fake door's shape.

Every finding was re-read here before a line moved; where two lenses found one fault the IDs are joined (C1 = T1). Each
fix carries an `AUDIT CHAP <ID>` comment and a pin in `test/audit_chap1.test.js` (22), and is mutated in
`tools/mutants/audit_chap1.json`: **49 mutants, 49 dead**. CHAP1's `tools/mutants/chap1.json` holds **25, all dead** -
eleven re-aimed by content at the code the fixes rewrote, one (CHAP1-TAB-LEAVE-HURRY) retired with the code it held, and
CHAP1-LOSS-WHOLE now naming the audit's pins too (with the net day a loss down the gain path moves the same reputation,
and differs only where something is owed).

## Fixed

**Daggerfall's law** (`src/net/npcChapterLaw.js`, `src/systems/guildFactions.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D2 = D3 | high | The day's 15 THREW AWAY what it cut, and Daggerfall pays far more in one act: S0000106 (the King of Worms' ending of "Who Gets the Totem") +100 to twelve of the twenty-two, A0C0XY04 +25 to the Mages Guild, K0C00Y05 +20 to the Fighters Guild; a temple donation took the gold and the Roll took the point back. The world.js line said "today", as if the rest came tomorrow. | What the room does not take is OWED (`npc_roll.owed`) and paid at the same pace by the next read or claim (`rollDrain`), never past 100; a loss takes from the owed first. The line: "... rises no further today. The rest will follow in the days to come." |
| D1 | high | The customs cap demoted: a rank-9 Mages Guild member seeded at 40 was put to rank 4 by its next review - the arc promised CHAP1 moves no rank. | A guild the crossing character is a member of keeps what its rank needs (`rollSeedOf`'s `ranks`, `RANK_REQ_REPUTATION` moved into the leaf and handed on by `guilds.js`). |
| D4 | medium | A fourth quest's +5 was lost outright, and a loss did not give the day's room back - a crime and its penance on one day was refused. | The day counts its NET rise: a loss lowers it. The fourth quest's +5 is owed (D2). |

**The service** (`server-account/src/npcRoll.js`, `server-account/migrations/0088_npc_roll.sql`, `server-account/src/realm.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 = C8 | medium | A claim sent twice at once (the honest tab's own pagehide twin of a slow claim) wrote its lines TWICE: the guard asked for the head at the next `seq` under the claim's id, and the winner left it standing exactly so. Probe: a +5/-20 claim landed as +10/-40, four ledger rows, answered `roll-busy`. | Every write moves the head under a `tag` minted for it alone, and every other statement asks for that tag; the loser writes nothing and is answered as a repeat. |
| S4 | low | The lease and the death were asked before the write and not in it: a claim was credited on a character dead, under a lease another tab held. | The head's UPDATE asks `HELD_SQL` (the caller's own character, standing, under its lease) inside the batch; the loser is told `lease` or `dead`. |
| S3 | low | `undoCustoms` left the Roll behind (probe: 66 rows, 3 heads, nobody's), and a Roll could be seeded before the first save landed. | No Roll before a save lands (`no-data`, 404); `undoCustoms` deletes the three tables. |
| S5 | low | A seed's ranks were taken as given: 22 memberships at rank 9 with a reputation of 0, each tenure stamped. | A recorded rank is never past what the Roll's own reputation needs (`rollRankCapOf`), at the seed and at every claim. |
| S6 | note | Only the head's last id was a repeat: an older claim replayed after a newer one was credited again. | A repeat is any id the record holds (`npc_rep_events_rid`). |
| S7 | note | A claim that changed nothing still wrote the head; the record grew for ever; a claim re-read all 23 rows after writing them. | A no-op writes nothing; the record is kept 90 days (`ROLL_EVENTS_KEEP_S`), pruned by the character's own claims; the answer is built from the rows in hand. |
| S8 | note | A claim's `members: []` ended every tenure, whatever the reason the book read empty; a seed that lost its race was told `seeded`. | `members: null` (no book to read) leaves the memberships; `seeded` is the winner's alone (the tag). |

**The playing tab** (`src/net/npcRollTracker.js`, `src/scenes/world.js`, `src/net/accountClient.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 = T1 | medium-high | The page's last claim never went: `whenPageGoes` gives the realm lease up before the tracker's pagehide runs, and the service clears it besides - so every close, reload, title exit and Legacy switch dropped what moved in the last minute, and a loss could be dodged by closing the tab. The pin passed with a constant lease. | Every adoption is KEPT in the save (`ChaptersRoll`, the Roll's sequence and its twenty-two); the next page's first read, finding the Roll still at that sequence, claims what the save holds past it. The page-leave claim and the door's keepalive branch are gone. |
| C2 | medium | A first read wrote the Roll over every move made before it landed - every move during a failed read's backoff was erased (probe: 10 -> 25 -> back to 10, never claimed). | The first read adopts over the kept adoption (when the sequence holds) or the standing as the page first saw it (`values0`), so the page's own moves are kept and claimed. |
| C4 | low | A session played while the Roll was shut, or after a stop, was reverted the next time. | The kept adoption carries it (C1). |
| C3 | medium | The cap was read off the character's age alone, so a character born online after the epoch that played under the shut switch lost all but 40 the day it opened. | The cap is a customs crossing's (`origin_id`) made from the epoch; one born online earned its standing online and is seeded whole. |
| C5 | low | A faction this client's FACTION.TXT has no row for was claimed as a loss of the Roll's whole number. | `rollDeltasOf` and `rollAdopt` touch only factions both sides hold. |
| T5 | low | The host's glue (the store read, the write through SetReputation, the memberships, the line) was held only as text. | `rollEntityDoors` and `rollCeilingLine` - the tracker's and the law's own, pinned there; world.js spreads them. |

**The pins** (`test/audit_chap1.test.js`, `test/chap1_roll.test.js`)

| ID | Finding | Fix |
|---|---|---|
| T2 | `accountRoll` was run by no test - a seed dropped, a path misspelt, all survived. | The real tab through the real door to the real Worker, end to end. |
| T3 | No tab test ever got a Roll that differed from its save. | A capped seed adopted over the save's. |
| T4, T12 | "Never two at once" and "no lease, no ask" were unpinned. | Three ticks unsettled ask once; a null lease and no store ask nothing. |
| T6, T10 | A promotion alone was never claimed by any pin; `<=` for `<` said the line for every uncut gain. | Both pinned, and a repeat's answer (no `credited`) says nothing. |
| T7, T13 | A seed of exactly 100 and a claim id's pad were unpinned (the pad a coin flip). | Pinned against fixed bytes. |
| T8, T9 | The backoff's doubling, cap and reset, `roll-unseeded`'s re-read and a read with no Roll were unpinned. | Each pinned step by step. |
| T11, T13 | The service's shape refusals, the seed race's INSERT OR IGNORE, the route's 405, its 409 and the order of its checks were unpinned. | Each pinned. |
| T1 (getter) | `realmSaves.js`'s lease getter was held only by a source regex. | Run: the lease while it plays, null once lost. |
| - | `assert.deepEqual(ROLL_STOPS.includes('chapters-closed'), true)` restated a constant; the memberships fixture held a rank -1 nothing produces. | Removed. |
| X1 | CHAP1 shipped two source pins RED: `test/chat1.test.js` and `test/auditdrops.test.js` each list the lines `onlineFrame` may hold before the dead return, and `rollTracker?.tick()` was not among them. CHAP1's run took the 312 files its change named; the audit's took 665, every test that reads `world.js`. | Both pins admit the Roll's tick beside Renown's (PIN MOVED). |

**The record** (`11-Multiplayer/Chapters-Arc.md`, `01-Overview/Port-Ledger.md`, `01-Overview/Port-Status-2026-09-02.md`,
`09-Testing/Testing.md`, the indexes, `server-account/src/index.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R2 | high | Law 3 said a seat never leans on a claim, while a seat's Eligibility rested on a reported rank, and the law module's header said a seat would ask "never a claim". | Law 3 says what is true: a seat goes by witnessed Merit; what a claim reaches is the gate before it, each bounded; CHAP4's Eligible is the Roll's reputation and tenure. |
| R3 | med-high | Section 10, CALL 3 and 3.2/3.6 still said the save is never read, a customs cap applied to every crossing, 3 quests a day, a zero start. | Each now says what is built (3.2's first read, 3.6's seed, the threats table). |
| R4 | medium | The ledger row said the classic skin keeps DFU's standing - the skin is the player's choice online and the Roll runs under either. | Offline and a shut switch keep it. |
| R5 | medium | "No relay change: the receipts already name a region" - only the raid's does. | CHAP2 credits a gate the Seats' way, a raid by its `w`, a serpent to no chapter. |
| R6 | low-med | Section 8 and CALL 6 named a raid receipt's influence, which does not exist, and disagreed on twice and three times. | A gate kill's and an Orc Raid camp's; three times. |
| R7 | low-med | Section 2 named `guildHallOf` for the hall's two days a week, which are `guildDay`'s, for different residents; the paths lacked `systems/`. | Corrected, and section 9's plan with it. |
| R8 | low | Two Port-Status identifiers CHAP1's row moved were not moved (`:938`, `:751`). | `:939`, `:752`. |
| R9 | low | CALL 5 gave a chapter with no rival Calm; section 7 spread Rivalry's weight over every event. | Calm's, in both. |
| R10 | low | "A repeat never credited twice" overclaimed (only the last id). | True now for any id the 90-day record holds (S6), and said so. |
| R11 | low | The law-module line, Appendix A's missing numbers, the founder5 row's version, the chap1 row's mutants, "a second seed refused", the Page-Index line. | Each corrected. |
| R12 | low | `ROLL_STATUS`'s comment grouped `lease` with "asked again" - it is a stop. | Said. |

## Recorded

- **R1 - CONFIRMED BY MAC ("Approved", 2026-10-07).** Mac's Authority call reads "online rank and reputation live on the account service". As built the
  service owns the twenty-two reputations and RECORDS the memberships and ranks (tenure by its own clock, each rank
  bounded by its reputation); the book and the rank review stay DFU's law on the client, run over the service's
  numbers. Writing the service's book over the client's would break DFU's guild objects for nothing a rival can lose.
  Asked, Mac approved it; the arc page carries it at its head as his decision, with the line it draws: a reward that
  membership or rank alone would earn asks the service's numbers, never the client's book.
- **S2 - the seed is the save's word.** A character's first read seeds from what its own client wrote into its save,
  as every claim is the client's word. What it buys is bounded as a claim's is - a personal rank and a standing at the
  gate - and the tenure begins at the seed, so a seat is still fourteen days and witnessed Merit away. Realm phase 3,
  which checks a save, closes it.
- **S8 - a loss never claimed.** A modified client can keep a loss from the service by never claiming it; nothing on
  the service can bound what it is never told. The save keeps it, and a later page claims it unless a claim moved the
  Roll since.
- **S8 - `cap`.** The head's `cap` column is written and read by nothing: it is the record of the cap the seed was
  taken under, kept for a moderator.
- **D5.** The pace falls on the twenty-two alone, so a temple's templar order (a child faction, the save's) can stand
  above its divine until the owed is paid. No DFU law reads the two together for a decision.
- **D6 = C7 - both books.** `rollMembersOf` reads the mortal and the vampire book, where DFU's GuildManager reads the
  active one: a vampire's mortal guilds are dormant, not lost (a cure swaps them back), so the Roll keeps their tenure
  running. CHAP4's seat asks its own question of an active membership.
- **C6.** An underworld initiation from a negative standing - the quest's +5 and RR1's floor of 2 in one line - can
  pass the day's 15; the rest is owed now (D2) and lands the next day, well inside the 28-day review.
- **S7 - load.** While shipped at `dev`, a non-developer's realm page costs a session's reads to be told
  `chapters-closed`, once a page (the tracker stops). Recorded, not changed: the switch needs the account to know a
  developer.
- **The typecheck.** `npm run types` read 139 errors in this container through every audit run until the devDependencies
  CI installs (`acorn`, `rollup`, `vite`) were put in without saving; with them it reads none. None was ever this slice's.
