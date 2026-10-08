# AUDIT CHAP2 - the Chapters arc read again, end to end, 2026-10-08

Mac, of everything the Chapters arc holds so far - CHAP0 (`11-Multiplayer/Chapters-Arc.md`, the design record), CHAP1
(the Roll) and its first audit (`01-Overview/Audit-Chapters.md`, AUDIT CHAP), and CHAP2a (the halls witnessed and their
writs): *"Lets do a deep comprehensive audit on everything so far"*. Six lenses read the tree at `915043c5`, each on its
own and each told to prove what it reported (a node probe over the real migrations, the real modules, DFU's C#), and
none edited the tree while any of them was reading (Home.md, DO NOT FIX WHILE THE VERIFIER IS READING):

- **the service** (S): `server-account/src/npcRoll.js`, `npcHalls.js`, the hall parts of `professions.js`, the routes,
  migrations `0090` and `0091` (`0088` and `0089` before the merge of main that renumbered them past CRAFT2-CRAFT5's);
- **the client** (C): `src/net/npcRollTracker.js`, `npcHallBook.js`, the door, the board, `scenes/world.js`'s wiring;
- **Daggerfall's law** (D): the leaf, the join, the halls each town keeps, the reveal - against DFU's C#;
- **the economy and its abuse** (E): a modified client, colluding accounts, the numbers;
- **the record** (R): every page, the ledger, the indexes, the comments;
- **the pins** (T): 122 new mutants over the slice in a worktree of its own (53 dead, 61 real survivors, 8 equivalent),
  and the fakes against the service's real answers.

Every finding was re-read here before a line moved; where lenses found one fault the IDs are joined (C2 = D1). Each fix
carries an `AUDIT CHAP2 <ID>` comment and a pin in `test/audit_chap2.test.js` (34), and is mutated in
`tools/mutants/audit_chap2.json` - the fixes' own mutants and the pins lens's 122, re-aimed by content where the fixes
moved their lines, and one for Mac's decision: **166 records, 157 dead, 9 equivalent as recorded** (each with its
reason). The first run judged a few records dead that a flaky pin had failed - the audit's own end-to-end pin waited two
turns for a real round trip, which a loaded runner does not always give - so the pin waits on what the trip moves, and
every record judged on one failing test was run again: four the pins lens had called equivalent stand so. The arc's older lists hold
too: `chap1.json` 25, `audit_chap1.json` 49 and `chap2.json` 39, all dead. The service stays `acct94`: none of it has
shipped, so migration `0091` grew in place.

## Fixed

**The Roll's sequence and the playing tab** (`server-account/src/npcRoll.js`, `src/net/npcRollTracker.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 (= S U2, E, R11) | medium | A hall writ's +2 moved the head's one `seq`, which AUDIT CHAP's kept adoption compares - so a delivery whose answer was not followed by a landed claim (a repeat answer, the board closed while Take was out, a lost answer, a stopped tab) made the next page drop everything its save held unclaimed. Probe: a quest's +5, a checkpoint, a hall writ answered as a repeat, the page gone - the next page held 40 = 10, the +5 lost. | The CLAIM sequence: `npc_roll_heads.kseq`, moved only by a claim that credits a line; the answer's `seq` and the read's `from` are it. Owed paid and a hall writ's credit are additive, so the kept base still stands. And the board hands a filled writ to the host before it asks whether it still stands; a repeat answer refreshes too. |
| C2 = D1 | medium | The tab compared its book with the Roll's RECORD of it - and the Roll records by its own law (a rank above its reputation between DFU's 28-day reviews; a join under the floor) - so it claimed every minute for as long as the two differed: 30 claims in 30 minutes, one of them writing. | The book as SENT is what the next claim compares with. |
| E2 | medium-high | The claims' minute was the client's word alone: 300 claims of ±1 on all twenty-two in a second landed 236 and 5,192 record lines. | The service's own hour: 120 claims a character (`ROLL_CLAIMS_HOUR`, `roll-rate`, 429) - an honest tab sends sixty and three refreshes. |
| E3 | medium | A claim could name all eight temples and all ten orders as memberships, each at 0 - DFU's book holds one of each a book. | `rollMembersOk`: at most two temples and two orders (`ROLL_BOOKS`: the mortal's book and the vampire's). |
| C3 | low | A claim sent before a refresh and answered after it cleared the refresh, adopting the older Roll: the +2 never asked for. | A refresh generation: only a claim sent after it answers it. |
| C4 | low | A `lease` stop outlasted its lease: the page gives its lease up as it hides and takes a new one as it shows, and a claim caught between ended the Roll for the page. | The stop is the refused lease's alone; a new lease resumes, the same claim sent again. |
| S6 | note | A claim carrying only a membership left no line in the record, so it replayed after a newer one was no repeat (a rank set back, a tenure restarted). | Every writing claim leaves its id: a line of faction 0 where it credited none. |
| S7 (= C U, D2's case) | note | The join's floor read the reputation after the day's pace: an initiation whose own reward the pace cut was not recorded until a later day. | The floor reads what the Roll holds and owes (`rep + owed`). |
| E8 | low | A claim with no book (`members: null`) skipped AUDIT CHAP S5's rank bound: after a loss a recorded rank 9 stood over 35. | The bound holds on that path too. |

**Daggerfall's law** (`src/net/npcChapterLaw.js`, `src/systems/guildHallReveal.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D2 | low | "DFU's join asks no less" is false for two of the twenty-two: the Thieves Guild and the Dark Brotherhood join by their initiation quests at ANY standing (`GuildManager.cs:53-66`; `ThievesGuild.cs:180-187` has no eligibility test; L0A01L00's own path joins the Brotherhood at -95). The Roll refused to record such a member - who then never saw its own chapter's writs. | `joinRecordable(rep, faction)`: the underworld two at any standing. |
| D3 | low | A crossing member seeded exactly ON its rank's line was demoted at the review after DFU's own 112-day drift (`PlayerEntity.cs:2235-2242`), and looped C2 meanwhile. | `rollRankKeepOf`: its rank's band up to the next line less one, never past 79 (`ROLL_SEAT_LINE` - 1) - no new seat eligibility; a rank 8 or 9 crossing too (E6, decided). |
| D4 | low | OFFLINE, a DFU 1:1 gap under the arc: the hidden guilds' halls were revealed for the ACTIVE book's membership alone, where DFU restores both books and registers each (`SerializablePlayer.cs:431-432`, `ThievesGuild.cs:253-257`) - a vampire's mortal Thieves Guild membership revealed nothing. | `revealingMemberships`: the active book with the two revealing guilds of the other, in both exterior hosts. |

**The halls and their writs** (`server-account/src/npcHalls.js`, `server-account/src/professions.js`, `src/net/npcHallBook.js`, migration `0089`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 = S4 = R4 | medium (blocks `on`) | Hall witnessing had none of the seats' moderation it claimed to copy: three week-old accounts filled all 62 regions with all twenty-two chapters in three hours (44 hall writs a board), or reported a real town first with the wrong region and guilds - and nothing could remove it. | The seats' tools: an account whose answers three times in a week stand alone against confirmed towns is ignored for a week (`seatIgnoredAccounts`, read over the region's reports); a developer's audit list (`/v1/chapters/halls`, `/hall audit`) and strike (`/v1/chapters/strike`, `/hall strike <map id>`, `npc_hall_strikes` - the reports go, the town is never witnessed again). |
| E5 | low-medium | Every chapter's slot 0 was the Court's law's top-tier slot, so half of all hall writs were top-tier and paid a quarter more than a Court writ - a Court writ plus +2, strictly better. | A chapter's writs are the Court's law's slots AFTER the first; the day's top writ stays the Court's. |
| E7 | low-medium | An account's first answer stands for ever, and a report's key was the bare map id: any later change to what counts as a hall could never reach a town already witnessed, and old and new answers would split. | The key carries the hall law's version (`1:<mapId>`, `HALL_REPORT_V`); a later rule is a new version. |
| E9 | low | Every counted account re-reported every town every day, each report a rate row and the region's kept chapters thrown away. | The book marks a counted or struck town done for good (`HALL_DONE`); the service drops the kept chapters only for a report that changed something. |
| S1 | medium (load) | A region with no chapter never writes `hall_writ_days`, so every board read there re-read the region's whole witnessed ground and the week's active accounts - STORM-SHED's class. | The chapters (kept a minute) are asked before the ground; a region whose Court day is written and has no chapter reads nothing more. |
| S2 | low | A stranger walking the writ ids told a hidden guild's writs apart: `no-writ` open, `writ-taken` filled, `writ-expired` yesterday's - where the underworld keeps confirmed halls. | The hidden guild's question is asked before the writ's day and fill: the same `no-writ`. |
| S3 = R22 | low | A hall writ refused for the switch answered 400 on `/v1/writs/deliver`, every other door 403. | `PROF_STATUS['chapters-closed']`: 403. |
| S5 | note | A hall writ's credit was the one Roll write no death guarded. | The head's bump asks the character standing (`dead_at IS NULL`); the delivery carries no lease (the board's), recorded. |
| C5 | low | The board said "Court writs today" where the count is every writ the account filled - hall writs elsewhere included. | "Writs today", always. |
| C7 | note | "The X will remember it." was said to a deliverer with no Roll, who is paid and nothing more. | Said only while the tab holds the Roll. |
| C8 | note | An account under a week old was answered `counted: false` and kept reporting 24 towns an hour. | `why: 'young'` stops the book for the page. |
| U1 (C) | unproven, closed | A client whose town's pinned layout was not heard yet, or whose pack did not load, read another town's buildings - and its first answer stands. | The witness asks the homes' own gate (`homeLayoutsOnline`, `_homeLayoutsApplied`, `worldDataPacksMissing`). |
| U2 (C) | unproven, closed | The report named MAPS.BSA's region; the board reads the politic map's at the town's pixel. | The report names the board's region. |

**The record** - the arc page, the ledger, the indexes, the comments

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1 | medium | The arc page's status said CHAP2 was next and every claim read off `9ed5a681`. | CHAP2a and this audit named; each slice's claims off its own parent. |
| R2 | medium | "so no two chapters post the same day" - false: chapters drawing one table (the temples' herbs) post the same writ on 19 days in 100. | Said truly. |
| R3 | medium | The design table names receipt writs for the Fighters, the Brotherhood and the orders; CHAP2a gave every chapter delivery writs, and called it a narrowing. | Recorded as a widening. |
| R5 | low-medium | "the Roll records a NEW membership only where..." - the seed records what the save reports. | Said: a CLAIM's floor; the seed is the save's word. |
| R6 | medium | The ledger's ROLL row did not record the hall writs themselves, the hidden guilds' rule or the one allowance; the PROF1 row still read three Court writs. | Both rows say it. |
| R7 | low | "at most once a minute", in three places - a refresh claims at once. | Said, with the service's own hour (E2). |
| R8 | low-medium | Section 11's tables lacked `tag`, `owed` and every CHAP2a table; its endpoints lacked `witness`; "CHAP2 credits a gate". | Brought to the tree; CHAP2b. |
| R9 | low | "Every number lives in ONE pure law module" - `CHAPTERS_KEPT_MS` and the hall book's key and bound live with their stores. | "Every balance number"; Appendix A names the homes. |
| R10 | low | The arc page and AUDIT CHAP quoted the table's gloss of Mac's call ("online rank and reputation live on the account service") as his words, and said "your" to him. | Mac's word is "Server-owned"; the gloss is the table's. |
| R11 | low | "unless a claim moved the Roll since" - a hall writ's credit moved it too. | The claim sequence (C1). |
| R12, R13 | low | Testing.md said `acct93`; CHAP2a's record left two version records, seventeen version pins and a table list unnamed, and overwrote CHAP1-TAB-MINUTE's note. | Named, and both notes kept. |
| R14 | low | Section 2's FACT, "nothing in `src/net/` reads" the save's guild standing - CHAP1's tab reads both. | Dated, and the second home named. |
| R15, R16 | low | Professions-Arc said three Court writs a day; Seats-Arc 3.2 did not know the kind `npchall`. | Each says it. |
| R17 | low | Comments: the law's header ("nothing a server saw", "BOTH ends" naming two files); the writ count's reason against the page's; three docblocks and the board's header saying Court writs alone; the switch's comment naming the Roll alone. | Each says what the code does. |
| R20 | note | AUDIT CHAP S7's `dev` load has a second source: the hall book. | Recorded there. |
| R24 | note | Section 3.3 credited a serpent's receipt; law 8 said every table is `npc_*`. | Said. |
| D5 | note | A probation and an expulsion listed as reputation losses (they move none); 3.4 said the Roll records the rank as reported (it bounds it); "Temple of Zenithar" called DFU's caption. | Said truly; the temple's name is the port's label. |

**The pins** - `test/audit_chap2.test.js`, and the arc's own files where a pin was weak

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | high | No test sent a full twenty-two (the only shape production sends): refusing it stopped every real tracker, and nulled every real kept record. | A full seed, claim and kept record pinned. |
| T2 | high | No test had a rank-0 member - every fresh join. | Pinned. |
| T3 | high | No test read a claim answer's `seq` - one behind, the kept adoption dropped everything. | Pinned against the head (now `kseq`). |
| T4 | med-high | The seeded base passed either way: `values0` was the same object. And the chap1 fake door answered no `seq`, `from` or `seeded`, and wrote a null book over the Roll's. | The case pinned; the fake shaped as the service answers (PIN MOVED). |
| T5-T25 | med to low | The Thieves Guild's half of the hidden rule; a seed with no book; the host's wiring (the kept record, the character, the doors' storage); the witness door end to end; the region subquery; the board's posting against the law's draw and its count at 201 active; the read's edges; the stop list (8 of 10 unpinned); the head's guards on a delivery; the heads' key; the fallback's count; the halls' hour; the sort; the filled arm; the shapes' edges; the order names; the dice; the book's key, bound, order and shape; the hall card in a DOM; refresh before the first read. | Each pinned in `test/audit_chap2.test.js`; the wiring and hall-book pins of `test/chap2_halls.test.js` tightened (PIN MOVED). |

## Recorded

- **E6 - DECIDED (Mac: "You can decide whatever is best", 2026-10-08).** A rank-8 or rank-9 member crossing through
  customs kept its 80 or 90 (AUDIT CHAP D1) - the reputation half of CHAP4's Eligible, which CALL 3 says an offline
  grind cannot buy. Built as the record recommended: such a crossing keeps 79 (`rollRankKeepOf`), recorded at rank 7 and
  reviewed to it, as 3.5 does to everyone at CHAP4 (pins moved in `test/audit_chap1.test.js`;
  `AUDIT-CHAP2-E6-HELD-AT-79`).
- **E4 - DECIDED for CHAP3 (Mac: "You can decide whatever is best").** Hall writs are first come, first served,
  deliverable from anywhere: once they are Merit, the seats would be a race at 00:00 UTC. CHAP3's Merit writs are each
  member's own (Chapters-Arc 5.1), its units the member's own (E13). Nothing changes before CHAP3.
- **E10 - the numbers, for section 10.** A cheating client reaches 80/90 on a guild in about six UTC days of paced
  claims (or at once by the seed of a character born online, AUDIT CHAP S2), and CHAP4's Eligible needs fourteen days'
  tenure besides - seats stay safe while Merit is witnessed.
- **E11 - ranks 8 and 9 today.** DFU's law on the client grants them, and the Roll records up to 9; 3.5's plan stands
  (CHAP4 holds them at 7 for everyone). `npc_roll.rank` is the client's word, bounded, and must never be read as a seat.
- **E12 - writs are never pruned.** Neither Court nor hall writs (PROF1's table, now up to seven times the rows a
  region); `active` counts any account with a play beat. The three a day still bounds minting. A prune is the
  Professions' to add.
- **E13 - Marks buy reputation.** Units bought on the market fill a hall writ for +2 (three a day). Intended for the
  pay; CHAP3 must count Merit on own units only, as Seats-Arc 4.2 does.
- **E14 - the +2 is raw SQL** in `deliverWrit`, outside the law module, and leaves no `npc_rep_events` line (the
  writ's row is its trace). A change to the Roll's row is made in both places.
- **E15 - +2 is a garnish** beside a quest's +5 until CHAP3's Merit rides on hall writs. Intended.
- **S4 - a report's breadth.** A report may name all twenty-two; a cap would need the real maps to set. The strike and
  the audit list answer it.
- **S5 - the lease.** A hall writ's credit carries no lease (the board's request, not the playing tab's); the death is
  asked inside the write.
- **C6 - an offline save carries `"ChaptersRoll": null`.** The port's mod-save convention (LivingWorld's too); DFU
  writes no record for a null. No behaviour moves.
- **C8 - the hall book is the device's.** A second account on one device skips the towns the first reported that day.
- **R19 - the hidden writs read both books** (`npc_roll.member`, `rollMembersOf`'s two books, AUDIT CHAP D6) - and
  since D4 so does the reveal, as DFU's does.
- **R23 - the orders' names** repeat `systems/topicTree.js` REGIONAL_BUILDING_NAMES' ten: that module's graph is the
  client's, never the service's.
- **Unproven, open.** Whether D1 counts a batch's statements against a request's query bound (a region with every
  chapter at 2,000 active posts 1,002 in one batch); which real towns carry factions 42 and 108 and on what building
  types; whether FACTION.TXT's spread pushes underworld standing below 0 in ordinary play (D2 common or rare). Each
  needs the game data or D1 itself, neither in this container.
