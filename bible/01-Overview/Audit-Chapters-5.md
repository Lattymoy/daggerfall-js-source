# AUDIT CHAP5 - the Chapters arc read a fifth time, end to end, 2026-10-09

Mac, of everything the Chapters arc holds - CHAP0 (`11-Multiplayer/Chapters-Arc.md`, the design record), CHAP1 to
CHAP7b, the four audits before this one (`01-Overview/Audit-Chapters.md`, `Audit-Chapters-2.md`, `Audit-Chapters-3.md`,
`Audit-Chapters-4.md`) and the merges of main since: *"I think we do a deep comprehensive audit across everything"*. Six
lenses read the tree at `7db019895`, each on its own and each told to prove what it reported, and none edited the tree
while any of them was reading (Home.md, DO NOT FIX WHILE THE VERIFIER IS READING):

- **the service** (S): `server-account/src/npcRoll.js`, `npcHalls.js`, `npcReceipts.js`, `npcMerit.js`,
  `npcChapters.js` (the Turning, the seats, the Season's draw and end, the backing, the patrons, the titles, the
  Chronicle), the Chapters' parts of `professions.js` and `guilds.js`, the routes, migrations `0096` to `0101` (`0098` to `0103` since the merge of main past INT1-INT6 and BAG-CRAFT);
- **the economy and its abuse** (E): a modified client, alts and rings, the Season's draw, a Crackdown's writs, the
  Rivalries, the patrons' escrow, a Season's Master;
- **the client** (C): `src/net/chapterSheet.js`, `chapterEvents.js`, the board's Work tab, the hall's popup and its
  windows, the patron's banners, the living world's halls, the hosts' wiring;
- **Daggerfall's law** (D): what DFU's halls sell (training, shelves, spells - by guild, temple and order), the ranks a
  seat lifts, the popup's own effects, the spellbook's haggle - against DFU's C#;
- **the record** (R): the arc's page, the four audits' pages, the ledger, the indexes, the versions, the migrations'
  and the modules' comments;
- **the pins** (T): the arc's test files and mutation lists - drifted records, wrong-reason kills, weak pins, gaps.

Every finding was re-read here before a line moved. Each fix carries an `AUDIT CHAP5 <ID>` comment and a pin in
`test/audit_chap5.test.js` (29), and is mutated in `tools/mutants/audit_chap5.json`: **71 records, all dead** (three
survived the first run - S1's chapter, S3's active membership, T8's confirmed rival - and their pins were made to fail
them). Twenty-two older records the fixes moved were re-aimed by content and six the pins lens found misaimed (T1 to
T3) re-aimed, all thirty-two run again, all dead; two were retired with the Marks' half again they mutated (CHAP6a's
`CHAP6A-POST-PAY`, `CHAP6A-MEMBER-PAY` - E1); CHAP6b's `CHAP6B-HEIR-TOP`, recorded equivalent, dies now (T17). The
service stays `acct100` and the relay `world183` (`acct102` since, past INT1-INT6's `acct100` and BAG-CRAFT's `acct101` at the merge of main): none of the arc has shipped, so migration `0101` (today's `0103`) grew in place;
nothing here changes what the relay reads.

Decided at Mac's standing word ("You make the best decisions"; "You can decide whatever is best"), each his to
overrule: E1 (a Crackdown's half again is its members' Merit, never Marks), E3 (the draw scaled; no secret salt), E5
(one race a chapter a Season), D1 (a seat lifts only a book held at 7), D2 (a shut hall refuses its services, its quests
among them, and keeps DFU's popup), D3 (a guild's doctrines are what its DFU hall sells), S6 (the opening is the first
week ever 'on'), C3 (a shut temple's worship goes on), E6 (a Season's Master's title outlives a strike).

## Fixed

**The service** (`server-account/src/npcChapters.js`, `guilds.js`, `index.js`, migration `0101`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 = E2 | medium | A seat's `since` is the character's at the chapter, kept from an officer's seat to the Master's: an officer who rose to the Master's seat in a Season's last week was written its 'season' row and its Season Master's title for good. | The 'season' rows ask the Chronicle too: no 'seat' row putting that character in that chapter's Master's seat at the Season's Turnings after its first (`seasonEnded`). |
| S2 = D4 | medium | The Hall of Records sent each 'event' row's raw data: a public chapter's Rivalry with a hidden one named the Thieves' or the Brotherhood's guild id to any reader. | `chapterChronicle` drops a hidden rival from the row it sends, as the line already did. The table's own elimination recorded (below). |
| S3 | medium | `backChapter` read the event before the membership: for a hidden guild its `no-event`, `no-side`, `closed` and `not-member` told a stranger which regions keep the underworld's halls. | A hidden guild's chapter asks the active membership first; a stranger is answered `no-event`. |
| S4 | medium | The Turning's patron statements were correlated reads over the bound list - O(bids x bids): 4,000 bids took the batch 7.7 s, past D1's time, and a Season's Turning would never settle. | A row-value `IN` over an uncorrelated list and an `UPDATE ... FROM` (each list read once): 4,000 bids well under one second. |
| S5 | low | A board's backings, a Season's backings, the draw's Masters' count and a guild's bids scanned their tables; `regionPatrons`' `?2 IS NULL OR` read every chapter for one region. | `idx_npc_chapter_backing_season (season, region, account)`, `idx_npc_chapter_history_week (week, kind)` (the week first: led by the kind it drew a token's mint off its character's index), `idx_npc_chapter_patron_bids_guild (guild_id, season, state)`; the region's read on its own index. |
| S6 | low | A developers' trial after the opening ('on', 'dev', 'on') was another opening - every chapter's Strength, seats and PAID patronage wiped mid-Season; a Season with a developers' week crowned their Master for good; the opening drew the developers' bids as patrons. | The opening is the first week ever settled 'on'; no 'season' row for a Season any week of which was 'dev' or this one not 'on'; at the opening every open bid goes home, none won. |
| E4 | low | A guild with a patron's bid standing could disband: its escrow, burnt at the Turning (its guild gone), went with it. | `guildKeepsSql` keeps a guild with an open bid; its refusal `guild-patron` (409, its sentence). |

**The economy** (`src/net/npcChapterLaw.js`, `server-account/src/professions.js`, `npcChapters.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | high | A Crackdown's writs paid half again in MARKS - any account fills a hall writ, with units bought, so a Crackdown chapter's writs paid x1.8 of their units' cost every day against PROF0's x1.2 (Appendix C rejected x1.5). | DECIDED: its writs pay as any; a member's own writ for the chapter earns half again its MERIT at delivery (`crackdownMerit`, 150) - the members' help to a hunted chapter, inside the week's cap. |
| E3 | medium | The draw took its roll's REMAINDER over the weights' sum: any modifier (a Curfew's edict, a Master's seat churned, a rival's band) re-drew most chapters, so a region's events could be steered. | DECIDED: scaled over the sum (`drawOf`), as the Schism's pick; a modifier moves the chapters its own share reaches. The roll stays public (below). |
| E5 | low | The Dark Brotherhood is every order's and two temples' rival: each Rivalry drawn against it raced it, ten Strength a race, seven or eight a Season. | DECIDED: a chapter races once a Season, the first of its rivalries in the chapters' order; any other ends even. |

**The client** (`src/scenes/world.js`, `worldModes.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | medium | The hall's price read the reader's guild off its GuildBook, which looks first at the Guild tab: on a fresh page a patron's member paid the band's price. | Asked again when old (the seats' own `guildId`'s way), and at once where the hall's chapter has a patron - the popup asks the chapter as it opens, so the book has looked before a window's price. |
| C2 = D5 | low | A temple carrying its templar order's faction (a 92 under Akatosh's 26) hung no patron's banner: the banners asked the sheet by the building's raw faction. | Read as its chapter's (`chapterFactionOf`), the living town's law. |
| C5 | low | Every pixel's build drew its halls' names (`buildingSummaries`, DFU's stream reseeded) offline too, for banners that never hang. | Online alone. |

**Daggerfall's law** (`src/net/npcChapterLaw.js`, `src/scenes/worldModes.js`, `src/ui/spellbookWindow.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | medium | A seat lifted any book row to 8 or 9 at its halls, and a seat's Eligible is the Roll's reputation alone: a rank-2 Mages member seated was handed Teleport, Summoning and the magic items DFU's skills gate. | DECIDED: `seatedBook` lifts only a row DFU's own review holds at 7. |
| D2 | medium | A shut hall refused its whole popup: DFU's OnPush (the rank review, a temple's free healing, the Mages' free recharge), Talk and the join with it. | DECIDED: the services refused on the popup - every service (its quests too), the Reforge's and the temple's rows - with the line; the popup stands. |
| D3 | medium | A Schism's doctrines and the patrons' prices promised what DFU's hall cannot give: a knightly order trains nothing and keeps no shelf, the Fighters Guild keeps no shelf, Kynareth's temple sells no shelf; a hidden guild's hall is DFU's own on every sheet. | DECIDED: `chapterDoctrinesFor` - an order and a hidden guild more writs alone (one doctrine: no Schism, its weight Calm's), the Fighters Guild and Kynareth training and writs, the rest all three; the Schism's two of its guild's own. An order's patron buys its banner and line alone (recorded). |
| D6 | low | The spellbook's haggle line weighed the hall's chapter-priced cost against DFU's list: a Thriving hall's price read as a bargain struck. | Weighed against the cost the chapter lists (`chapterPriced` of the presented cost). |

**The pins**

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | high | `CHAP6C-BACK-LATE` and `-RELOAD` ran on into the next function's header after CHAP7b - they mutated `bidPatron`'s board door and the list failed for it. | Re-aimed on the backing's own text. |
| T2 | medium | `T-HALLS-WITNESS-FORGET`'s mutant did not parse (a dangling `else`): killed by a syntax error. | Its new text a statement that parses and forgets nothing. |
| T3 | low | `CHAP3C-SPELLMAKER-SP` (a removed name) and `CHAP4C-RELAY-STAMP`/`-READ` (a name `wire.js` never imports) died of a ReferenceError, never the law. | Each mutant written in names its file holds. |
| T4 | medium | The opening's patron clear and the Turning's undecided-bid guard were pinned by regex alone. | Pinned on the service: the developers' patron cleared; a bid landing between the read and the batch fails it, the next read decides it. |
| T5, T9 | medium | A raise's `at`, the repeated bid's answer: unpinned. | Pinned: a raise stands at its own time (the tie to the first at its sum); the repeat's whole answer. |
| T6 | medium | The sheet's patron arms checked as `typeof 'object'` - true of null. | The arms deepEqual. |
| T7 | medium | No test settled the Turning that opens Season 0 (its `ended` guard). | Pinned. |
| T8 | medium | The draw's Curfew read (law, the edict) and its confirmed rival: unpinned. | Pinned - the rival over thirty regions, a rival's Ascendancy otherwise moving some. |
| T10 | low-medium | A Season ending at the opening crowned no one - by the trial alone after S6, never the opening. | Pinned on a Season of no developers' week with the developers' last week before it. |
| T11, T12 | medium | The banners' placement, their cap and order; the board's one bid press at a time. | Pinned. |
| T13 | low-medium | A hidden chapter's bid offer, the board's with no Season, the guildmaster's rank. | Pinned on the board. |
| T14 | low | The malformed-bid pin's amount passed for whole. | 9000.5 - none even as the highest. |
| T17 | low | `CHAP6B-HEIR-TOP`'s equivalence was false for a top that is no whole. | `successionHeir(null, 1.5)` pinned 0; the record dies. |
| T15, T18 | low | The client's doors were pinned by regex where they could be driven. | `accountRoll.patron` and `.back` driven through the real service. |

**The record** - R1 to R20: the titles' relay is `world183`, five ids (`wrangler.toml`, `chapterTitlesOpenFor`,
`service.js`); the six migrations' deploy line (`acct100`); the carry's x1.2 no more (`service.js`, Active-Arcs); the
service comment's missing AUDIT CHAP4, CHAP6e and AUDIT CHAP5 lines and its "0094-0097 then"; Active-Arcs' versions and
AUDIT CHAP4's migration numbers (`0096`, `0100`, `0101`), CHAP4b's attribution; AUDIT CHAP2's and CHAP3's renumbering
history and their counts; AUDIT CHAP4's versions; Testing's rows (chap1's and founder5's `acct100`, chap4c's `world183`,
chap3b's region row) and chap4c's header; section 9's rumour mill and section 0's candidates NARROWED; 5.2's orders'
band still open; Appendix A (a member's writ a GUILD a day, the patron's raises, band and price, the Crackdown's Merit,
the draw, the doctrines, the race); section 13's hosts (`chapterHere`, CHAP6c to CHAP7b); section 11's law modules
(`chapterEvents.js`) and its tables; the mutant counts; 5.3's board line; the law's misplaced import note; the Roll's
recorded rank (`min(reported, cap, 7)`); the ledger's sections. C4 and D7: "the classic skin" was never one; an
Ascendant chapter in an Ascendancy trains at 0.81, 0.729 with the training doctrine; the ledger's shut hall sends the
census's residents away, and "cheaper training" lowers training alone.

## Recorded

- **C3, DECIDED (NARROWED)**: a shut temple's worship goes on - the living town reads the guild halls' bands alone; its
  priests keep their day and the pious their visits. The Crackdown shuts the counter, not the altar.
- **D4 (S2's residue, CALL 5)**: a public chapter's Rivalry with "its rival in the shadows" still says, by the rivals'
  table, which hidden guild keeps a chapter in its region (the Fighters' only rival is the Thieves). Open.
- **E3's residue**: the draw is a pure function of public inputs - a reader can foresee the next Season's events and
  weigh its modifiers. A server secret would end it; none is added (the Tides' law, one public roll).
- **E6, DECIDED**: a Season's Master's title at a chapter struck since stands - for good is for good.
- **An order's patron** buys its banner and its Chronicle line: its hall sells nothing the price touches (D3).
- **The pins lens's other gaps** (T19): defensive guards no realistic input reaches - `patronsDrawn`'s hidden and order
  reads, the ledger's day and actor, the repeat's order, `bidPatron`'s doors asked before (body, account, request id,
  rate, settle, rank bind), the guild bids' Season and state, the titles' early return, sort and lost week, the Season's
  Masters' order and filters, the event view's checks, the law's input guards (a weight not whole, a pick's faction, the
  words' guild checks), the sheet's heraldry copy, the banners' phase and guards, the board's bid Season and fallback
  words and the backing's busy and fallback - survivors recorded, each a guard of its own line.

## Pins moved

Each with a `PIN MOVED` note: CHAP6a (the Crackdown's flat pay and its effect, the underworld's weights, the scaled
draw's two goldens), CHAP6b (the Schism's distribution on the Mages, its golden), CHAP6c (the Crackdown's words), CHAP6d
(the shut gate on the services, the host's `chapterHere`), CHAP7a (the opening's draw), CHAP7b (the banners' guild, the
book asked again), CHAP3c (`chapterHere` kept).
