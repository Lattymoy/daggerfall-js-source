# AUDIT CHAP4 - the Chapters arc read a fourth time, end to end, 2026-10-09

Mac, of everything the Chapters arc holds - CHAP0 (`11-Multiplayer/Chapters-Arc.md`, the design record), CHAP1 to
CHAP5b, the three audits before this one (`01-Overview/Audit-Chapters.md`, `Audit-Chapters-2.md`, `Audit-Chapters-3.md`)
and two merges of main since the last: *"Lets do a deep audit on everything so far"*. Six lenses read the tree at
`d227cf2d5`, each on its own and each told to prove what it reported, and none edited the tree while any of them was
reading (Home.md, DO NOT FIX WHILE THE VERIFIER IS READING):

- **the service** (S): `server-account/src/npcRoll.js`, `npcHalls.js`, `npcReceipts.js`, `npcMerit.js`,
  `npcChapters.js` (the Turning, the seats, the titles, the Focus, the Chronicle), the Chapters' parts of
  `professions.js`, the routes, migrations `0095` to `0100`;
- **the economy and its abuse** (E): a modified client, alts and rings, Merit's cap against the seats, the Focus, a
  seat's gifts;
- **the client** (C): `src/net/npcRollTracker.js`, `chapterSheet.js`, `npcHallBook.js`, the board's Work tab, the hall's
  shelf and roll, the Hall of Records, the living world's evenings and talk, the hosts' wiring;
- **Daggerfall's law** (D): the books (mortal and vampire), the ranks above 7 and what DFU gives with them, a rank's
  title, the shelf's refusal, a hall's families - against DFU's C#;
- **the record** (R): the arc's page, the three audits' pages, the ledger, the indexes, the migrations' and the
  modules' comments;
- **the pins** (T): the arc's test files and mutation lists - flakes, weak pins, wrong equivalences, gaps.

Every finding was re-read here before a line moved. Each fix carries an `AUDIT CHAP4 <ID>` comment and a pin in
`test/audit_chap4.test.js` (28), and is mutated in `tools/mutants/audit_chap4.json`: **71 records, all dead**. Thirty-seven
older records the fixes moved were re-aimed by content and run again, all dead; two were retired with the carry they
mutated (CHAP4a's `CHAP4A-CARRY`, `CHAP4A-SCORE-CARRY` - E1); AUDIT CHAP3's `A3-S2-OFF`, recorded equivalent, dies now
(S2). The service stays `acct98` and the relay `world180` (`acct99` and `world181` since the merge of main past PERMADEATH-HOUSES and TAVERN-TABLES): none of the arc has shipped, so migrations `0095`, `0099` and
`0100` grew in place; nothing here changes what the relay reads.

Decided at Mac's standing word ("You make the best decisions"; "You can decide whatever is best"), each his to overrule:
E1 (a sitting holder's x1.2 made a tie-break), D1 (a dormant membership kept on the Roll, asked by Merit and the seats),
E2 and D2 (what DFU gives once at rank 8 or 9 is not given online), D3 (a seat's title at its own halls), E4 (the
realm's active count kept as the target's measure).

## Fixed

**The service** (`server-account/src/npcChapters.js`, `professions.js`, `npcRoll.js`, `npcMerit.js`, `npcReceipts.js`,
migrations `0095`, `0099`, `0100`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | medium | `npc_chapter_history` had one index, `(faction, region, seq)`: every title mint (twice with a title worn), `/me` and the wardrobe read a character's history, and every Chronicle a region's, by a full scan. | `idx_npc_chapter_history_char (char_id, week)` and `idx_npc_chapter_history_region (region, seq)`; the plans pinned (`EXPLAIN QUERY PLAN`). |
| S2 | low-medium | Weeks the Chapters were shut (`off`) were settled as played once the switch opened: -3 a week, a Season's halving, the seats' window emptied - every holder unseated and every Master given Former Master. | A board read under `off` records each due week `open = 'off'` and moves nothing (`npc_chapter_weeks.open` takes 'off'); a chapter opened after `dev` and `off` weeks starts at 50; the seats' four weeks are the last four the Chapters were open. |
| S3 = E5 = R8 | low | The Chronicle took its newest sixty rows and then left the hidden guilds out: a region busy underground read short or empty, and the count told what the rows hid. | The hidden guilds left out in the SQL, before the newest are counted (`HIDDEN_HALL_FACTIONS`). |
| S4 = E6 | low | Between a week's boundary and its Turning, the Master about to be unseated set the new week's Focus. | The Focus settles the Turnings due first and asks the seat LAST week's Turning placed; the board's Master lines read the same week. |
| S5 | low | A character deleted while its Turning was in flight was seated again by the batch (the seats were read outside it). | The seats' and the Chronicle's inserts ask the realm character standing inside the batch. |
| S6 | low | The first week `on` after `dev` started at 50 only the chapters that week named; the developers' Strength stood on every other. | Every chapter's Strength back to 50 in the opening week's batch. |

**The economy** (`src/net/npcChapterLaw.js`, `npcChapters.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | medium | A sitting holder's Merit counted x1.2 under a 600-a-week cap: a holder at 2000 of the four weeks' 2400 could not be passed - CALL 4's "a challenger who does more takes it" was false. | DECIDED: no carry - `seatScoreOf(merit)`; a sitting holder at an EQUAL standing keeps the seat (`chapterSeatPlan`'s first tie-break). `SEAT_HOLDER_CARRY` gone. |
| E2 | medium | A knightly order's rank-9 house went to a week as Master and was kept for good; a ring passing the seat round housed every one of it. | DECIDED with D2: the order's rank-8 and rank-9 armour and its rank-9 house read the BOOK's rank (`openServiceFlow`'s `kept`). |
| E3 | low | A struck false chapter kept its seats and titles three Turnings more; the strike handed its Master Former Master. | Seats placed only at chapters confirmed now (`allChapters`); titles only at confirmed chapters, seats and former alike. |

**The client** (`src/net/npcRollTracker.js`, `npcHallBook.js`, `src/scenes/world.js`, `worldModes.js`,
`src/systems/livingWorld/lines.js`, `src/ui/noticeWindow.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | medium | The Roll was asked again only when something moved: a seat lost at a Turning held its rank at the halls for the rest of the page, and a new one waited. | With nothing to claim, the Roll is asked again once `ROLL_SEATS_MS` (10 minutes) has passed since it was last heard. |
| C2 | low | Every built town planned its halls' evenings by the region the PLAYER stood in - a town across a border read the other region's bands, and each crossing re-planned every town. | `livingChapterOf(faction, x, y)` reads the town's own pixel; the building's faction resolved as every other reader does (`chapterFactionOf`). |
| C3 | low | Before the Roll's first word DFU's review had no ceiling: a promotion to 8 or 9 was announced, then taken back. | The ceiling holds while the tracker stands, before its first word too. |
| C4 | low | Town talk opened in lower case ("the Fighters Guild here is doing well") and gave the orders "is" ("the Knights of the Dragon here is failing"). | Worded by the chapter: "The chapter of the X here is ...", and the talk's four lines reworded so `{guild}` never opens a sentence. |
| C5, C6 | low | The Hall of Records opened from the board left the Chapters out; the palace's read waited an uncached history after the seat's book, even when that failed. | One `hallOfRecordsRead(seat)` for both doors, the two reads in parallel; a window opened late is disposed. |
| C (unproven, proven) | low | A Focus answered after the board closed was said nowhere. | Said in the chat, as a Take is (`sayLate`). |

**Daggerfall's law** (`src/net/npcChapterLaw.js`, `npcRoll.js`, `worldModes.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 = E7 = R4 | medium | `rollMembersOf` claimed both books, and the seats asked no active membership: a vampire's mortal guilds - dormant in DFU's GuildManager - earned Merit and could hold seats. AUDIT CHAP D6's promise unkept. | DECIDED: a line the active book does not hold is claimed dormant (`d: 1`), kept on the Roll (`npc_roll.dormant`, `0095` grown in place); Merit, the member writ, a receipt's standing and the seats ask `dormant = 0`. |
| D3 | low | A seat's rank title read three ways: the popup's macros, the counter and the affiliations the book's; training's macros and the guild's quest offer the seat's. | A seat's title is the one its own halls say: the popup and its counter read the seated book; the sheet's affiliations name the book's rank (recorded, 3.5). |
| D4 | low | CHAP5a dropped DFU's shelf refusal where the roll opened, and every Fighters Guild and knightly-order member - whose shelves DFU opens to no one - read the roll alone. | The refused read the roll and then DFU's refusal line; the record says who is refused. |
| D2, D5 | low | What DFU gives once at 8 or 9 (texts, maps, locations, gifts) was lost online unrecorded; `hallFamiliesOf`'s reason was wrong (DFU's guilds trade in none of it). | Recorded (3.5, section 4, the ledger); the comment corrected. |

**The pins**

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | high | The titles were pinned only with no Season counted; production counts from week 2 - four survivors. | Pinned with `SEASON_ZERO_WEEK` 2: Former Master's stamp, the account's title, the wardrobe, the mint. |
| T2, T3 | medium | The Chronicle's `zero` and `masterSeatsIn`'s region went unchecked. | Pinned. |
| T4, T9 | medium | The Focus's word (always "set") and its busy guard survived. | Pinned: the set line, a refusal's words, one set for two presses. |
| T5 | medium | A failed sheet read could be asked every frame. | Pinned: one read through an outage. |
| T6, T8 | low-medium | Six orders the record states were unpinned (the plan's tie by key, the Turning's changes, a character's seats, the book's cap, the roll's officers, the titles). | Each pinned. |
| T7 | low-medium | The evenings' seed: the town, the day's slice and the whole day survived. | Pinned. |
| T10 | low | The rolls' justification, the news pools, the Focus's faction guard. | Pinned. |
| T (equivalence) | low | `A3-D2-STEP0`'s reason held for whole qualities only. | Its reason narrowed. |
| T (the arc's run) | low | Every Chapters list run again: one survivor, AUDIT CHAP2's `AUDIT-CHAP2-E1-STRUCK` - since AUDIT CHAP3 S5 the strike is asked again inside the write, so the first check differs only for a witness its age refuses: a young account at a struck town was told `young`, and its hall book kept reporting the town. | Pinned: struck is said before the age. |

**The record** - R1 to R17: the six migrations' deploy line (`acct98`, `acct99` since); the relay's deploy (on the merge to main, by
`relay-deploy.yml`, not by hand); Appendix A (the computed regions for `ALL_CHAPTERS_KEPT_MS`, the book's 7, the
Chronicle's 60, the roll's name, the evenings by band, the talk's days, the seats' beat); AUDIT CHAP's D6 kept; section
11's tables (`open`, `focus`, `focus_week`, the history's `at`, `dormant`); three forward pointers; `service.js`'s
migration numbers (and main's two names); the route list and the sheet's shape; Testing's rows (chap1's version,
audit_chap2's 158 and 8, chap4c's relay, founder5's history); chap4c's header and its relay pin (`world180`, `world181` since; its own
row); Active-Arcs' CHAP4c/4d attribution; the Page-Index line; AUDIT CHAP2's renumbering history; the stock law's
comment (count alone); the tracker's lease stop (that lease alone).

## Recorded

- **E4, DECIDED**: accounts that only play raise the realm's target and pull every chapter's step down - the count stays
  the realm's own measure (Chapters-Arc 5.2).
- **The Thieves Guild's and the Dark Brotherhood's halls** still take no band (5.2, NARROWED, still open).
- **A character holding two officer seats** wears the first by guild then region and cannot choose (section 6's order).
- **The board's shared `busy`**: a Notices load does not ask it first - the board's own pattern, unchanged.

## Pins moved

Each with a `PIN MOVED` note: CHAP4a (the carry to the tie, confirmed chapters, the scene), CHAP4c (confirmed chapters;
the relay's own row), CHAP4d (last week's seat, the Hall's read), CHAP1 (the dormant mark), CHAP3b and CHAP5a
(`chapterLineOf`), BS1's shelf, FB1004d's knightly house (`kept`), SEASON1's records, the seat heraldry, AUDIT-SEATS' Hall of Records from the board, AUDIT SEATS2's
client, CHAP4b (the ceiling), CHAP5b (the host's wiring), MACRO4's guild title.
