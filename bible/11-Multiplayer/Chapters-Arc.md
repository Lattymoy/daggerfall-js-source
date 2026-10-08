# THE CHAPTERS ARC - Daggerfall's guilds, held online (CHAP0, the design record)

**Status: DESIGN RECORD, every question decided (2026-10-07): Mac's four calls (the table below), and the rest by the
record at his instruction ("You make the best decisions" - section 14). CHAP1 BUILT (2026-10-07, Mac: "Continue"; its
record is at the foot, and where it narrowed section 3 the section says so); AUDIT CHAP (2026-10-07, Mac: "Lets do a deep
audit on everything so far before we continue") read CHAP0 and CHAP1 through five lenses and fixed what they found
(`01-Overview/Audit-Chapters.md`) - one narrowing of Mac's own Authority call, which he confirmed (R1, below: "Approved").
CHAP2a BUILT (2026-10-07, Mac: "Do it"; the halls witnessed and their delivery writs - section 4, its record at the
foot); AUDIT CHAP2 (2026-10-08, Mac: "Lets do a deep comprehensive audit on everything so far") read all of it through
six lenses and fixed what they found (`01-Overview/Audit-Chapters-2.md`) - its two questions decided at Mac's word
("You can decide whatever is best": 3.6, 5.1). CHAP2b BUILT (2026-10-08, Mac: "Keep going with the arc/slices"; a
receipt's standing and the receipt writs - section 4, its record at the foot). CHAP3a BUILT (2026-10-08, the same
words; a member's own writ and the week's Merit - section 5.1, its record at the foot). CHAP3b BUILT (2026-10-08, Mac:
"Continue"; Strength at the Turning, its band on the hall writs, the sheet - sections 5.2 and 5.3, its record at the
foot). CHAP3c BUILT (2026-10-08, the same word; the bands on the halls' prices and shelf - section 5.2, its record at
the foot). CHAP4 (the seats) is next. Merged with main past the Super Dungeons arc (2026-10-08): the
arc's migrations are `0091_npc_roll` to `0095_npc_chapters` and its service `acct95` - the records below name each
migration by its current number and the service by the version it was built under. AUDIT CHAP3 (2026-10-08, Mac:
"Let's audit everything we have so far before we continue") read all of it through six lenses and fixed what they found
(`01-Overview/Audit-Chapters-3.md`); the sections below say where it narrowed them.** CHAP0's claims about the code were read off the tree at `9ed5a681`, each slice's off its own
parent, cited by file and symbol, never by line, so the page survives the next merge.

Its neighbours: `11-Multiplayer/Seats-Arc.md` (SEAT0 - the week, the Season, the Tides and the witnessed influence this
page reuses rather than rebuilds), `06-Systems/Professions-Arc.md` (PROF0 - Marks, the Notice Board and the writs),
`06-Systems/Realm-Arc.md` (REALM - the online character's truth on the account service), `06-Systems/Living-World.md`
(LW0 - the residents), `06-Systems/Standing-Arc.md` (REP1-REP6 - the law's own overhaul) and
`11-Multiplayer/Guild-Overhaul.md` (GUILD2 - the players' own guilds, which this page does not touch).

## Mac's words

- "Curious but how could we split away from DFU, completely overhaul the NPC guild system and reputation system to not
  only modernize it, but also allow for way for replayability and detail. Making it more immersive and tying into the
  world more and maybe even the living world system"
- "This is mostly with online in mind"
- His four calls, asked the same day (and on the eight left open: **"You make the best decisions"**):

| | The question | Mac's call |
|---|---|---|
| Authority | Online, should guild rank and faction reputation move to the server, changed only by acts it witnessed? | **"Server-owned"** - online rank and reputation live on the account service, as Renown does; the save's copy is ignored online; offline keeps DFU's |
| Top ranks | Should the top guild ranks be limited, contested seats? | **"Limited seats"** - each chapter has one Master and a few officers that players contest, under the alt rules; lower ranks are open to all |
| Seasons | Should chapter state shift in seasons? | **"Seasonal events"** - schisms, coups, new guildmasters each Season, driven by what players did; personal rank carries over |
| Offline | What does offline play get? | **"DFU 1:1"** - offline stays exactly as it is; the overhaul is online's alone, as the Professions are |

**DECIDED (Mac), 2026-10-07: "Approved" (AUDIT CHAP R1) - the Authority call as built.** The service owns the twenty-two REPUTATIONS. It does not own
the guild book: a join, an expulsion and the rank review are acts of DFU's law on the client (`guilds.js`), so the book
stays the save's, and the service RECORDS each membership with its own clock (the tenure) and bounds each rank by its
own reputation (`rollRankCapOf` - a rank never past what the Roll's number needs). The rank law therefore runs on the
service's numbers, but it runs on the client. This narrows Mac's "Server-owned" (the table's "online rank and reputation
live on the account service"), and Mac confirmed it ("Approved"; AUDIT CHAP2 R10: this said "your", left from the draft); the alternative, writing the service's book over the client's, breaks DFU's guild
objects for nothing a rival can lose. The line it draws for every later slice: a reward that membership or rank ALONE
would earn asks the service's numbers (the Roll's reputation, its tenure), never the client's book.

## How to read this page

| Mark | Meaning |
|---|---|
| **DECIDED (Mac)** | One of the four calls above. |
| **DECIDED** | The record's decision, made at Mac's instruction ("You make the best decisions"). Binding for the build slices; Mac may overrule any of it, and a slice that changes one records the change here first. |
| **FACT** | What the tree does today, read off the file named. |
| **CALL n** | One of the eight calls section 14 decides, with its reason. |

Every balance number lives in ONE pure law module, `src/net/npcChapterLaw.js` (Appendix A), shared by the client and the
account service - so balance is an edit to one file, pinned by its own tests. AUDIT CHAP R11: CHAP1 wrote it with the
Roll's numbers alone; each later slice adds its own there. AUDIT CHAP2 R9: a store's own numbers live with the store -
`CHAPTERS_KEPT_MS` in `server-account/src/npcHalls.js`, the hall book's key and bound in `src/net/npcHallBook.js` - and
Appendix A names their homes.

---

## 0. The change on one page

- **Your standing is the server's.** Online, a character's reputation with the twenty-two guild factions is kept by
  the account service and moved only by acts the servers witnessed or by claims it bounds; its memberships and ranks
  are DFU's law on the client, run over the service's numbers and recorded by the service (R1, above). The save's
  twenty-two reputations are overwritten by the service's online. Offline is DFU, untouched.
- **A guild has chapters.** Each of Daggerfall's guilds is one chapter per region it keeps a hall in. A chapter has a
  **Strength** that its members' witnessed work raises and neglect lowers, and Strength is what its halls give: the
  training price, the shelf, the services, the hours.
- **The hall posts work.** Each chapter posts **hall writs** on its town's Notice Board - deliveries, defences, hunts,
  each in its guild's own character - paying Marks and reputation, and (CHAP3a) a member's own writ **Merit** (5.1).
- **The top two ranks are seats.** Rank 9 (one Master) and rank 8 (three officers) of each chapter are held by the
  players with the most Merit there, settled at the Seats' weekly Turning. Ranks 0-7 are DFU's law over the server's
  reputation, open to everyone who earns them.
- **Every Season, every chapter has a story.** At each Season's first Turning a chapter draws one event - a Schism, a
  Succession, a Crackdown, a Rivalry, a Decline, an Ascendancy - weighted by what its members did, and the Season's
  Merit decides how it ends.
- **The living world shows it.** The account service publishes one **chapter sheet**; the living world reads it as one
  more input of its pure function, so every player sees the same hall: crowded or empty, quarrelling or proud, its
  Schism's two candidates walking the same street.

## 1. The laws this arc keeps

1. **ONLINE ONLY; OFFLINE IS DFU 1:1** (DECIDED (Mac)). `systems/guilds.js`, `systems/guildVariants.js`,
   `systems/factionRep.js`, `systems/court.js` and `systems/standing.js` keep every law they hold, and every parity
   pin on them (`guilds.test.js`, `factionrep.test.js` and their kin) stays green unchanged. Guilds are on
   `01-Overview/Port-Doctrine.md`'s ported 1:1 list, so the arc is a declared departure: its Port-Ledger section A row
   is added by CHAP1, as SEAT1a added the seats'.
2. **THE SERVICE OWNS IT ONLINE** (DECIDED (Mac)). Realm-Arc's first decision - "Truth: Account service" - applied to
   the guilds. The pattern is Renown's (`net/renown.js`: "A TRACK PER CHARACTER, kept by the account service ... and
   never in the save"), and the client's side is Renown's layer (`systems/renownLayer.js`): put on when the character
   comes online, never written into a save the service does not own.
3. **NOTHING A RIVAL LOSES IS DECIDED BY THE CLIENT'S WORD** (Seats-Arc law 3). A seat goes by witnessed Merit alone.
   AUDIT CHAP R2: what a claim reaches is the GATE before it - a membership (a join is DFU's act on the client), its
   tenure, a standing - each bounded (the day's pace, the customs cap, the rank's own need), and a lie past the gate
   still wins nothing without the witnessed work that Merit is. A personal rank, which costs nobody anything, leans on
   bounded claims the same way.
4. **DAGGERFALL'S GUILDS, NOT NEW ONES.** The four guilds (`GUILDS` in `guilds.js`: Fighters 41, Mages 40, Thieves 42,
   the Dark Brotherhood 108), the eight temples (`DIVINES`) and the ten knightly orders (`ORDERS`, both
   `guildVariants.js`): twenty-two faction ids, every one a constant of DFU's MIT code. The servers hold those ids and
   nothing of FACTION.TXT (Seats-Arc law 5: the servers never hold game data).
5. **THE QUESTS STAY SEPARATE** (`11-Multiplayer/Multiplayer.md`, decision 1). DFU's guild quests run on each player's
   own machine as they do today. What one pays online is a bounded claim (3.3), never Merit.
6. **THE WORLD IS SHARED; HOW IT FEELS ABOUT YOU IS YOURS** (LW0 decision 6). A resident's regard
   (`systems/livingWorld/relations.js`) stays the character's, client-side, and gates nothing the service keeps.
7. **ONE WEEK, ONE SEASON.** The chapters settle on the Seats' week by the Seats' lazy law and count Seasons on the
   Seats' calendar (`townSeatLaw.js` `seasonOf`, the service's `SEASON_ZERO_WEEK`). No second clock, and never a cron.
   NARROWED (CHAP3b): their own Turning beside `seatTurning.js` `settleWeek`, keyed on its own row (`npc_chapter_weeks`,
   5.2), not inside the seats' transaction.
8. **THE WORD "CHAPTER" IS HALF TAKEN.** `townSeatLaw.js` `hallOfRecordsChapters` is a book's chapter, and GUILD1's
   `guilds` are the players'. The player reads "chapter"; the code says **`npcChapter`**: `net/npcChapterLaw.js`, D1
   tables `npc_*` (AUDIT CHAP2 R24: a region's day of hall writs rides the Court's own, `hall_writ_days`), endpoints
   `/v1/chapters/...`.

## 2. What already stands (FACT)

| Foundation | Where | What the arc uses |
|---|---|---|
| DFU's guilds | `systems/guilds.js`: `GUILDS`, `RANK_REQ_REPUTATION` (0-90 in tens), `RANK_REQ_SKILL_HIGH`, `RANK_REQ_SKILL_LOW`, `baseCalculateNewRank`, `updateRank` (the 28-day gate), REP6's probation (`PROBATION_LINES`) | Ten ranks recomputed, never stored; the law ranks 0-7 keep online |
| Temples and orders | `systems/guildVariants.js`: `DIVINES` (8), `ORDERS` (10), `createGuildForGroup` | The other eighteen faction ids |
| Faction reputation | `systems/factionRep.js` `changeReputation` (-100..100, the ally/enemy spread with DFU's truncating halves) | The client's spread, reported as a claim (3.3) |
| The save | `systems/save.js`: `snap.factionRep`, `snap.guildMemberships` | The only home of both today - nothing in `src/net/`, `server/src/` or `server-account/src/` reads either (at `9ed5a681`; AUDIT CHAP2 R14: since CHAP1 the Roll is a second home online - `net/npcRollTracker.js` reads both) |
| The realm | `server-account/src/realm.js` | Holds an online character's save, opaque: it checks the first save's level and wealth (`REALM_BIRTH_WEALTH_MAX`) and nothing after. Realm-Arc phase 3 (validation) is unbuilt |
| Renown | `net/renown.js`, `server-account/src/renownTracks.js`, `systems/renownLayer.js` | The service-held track and the online layer - the pattern for the Roll |
| Marks | `net/marksLaw.js`: `MARKS_FAUCETS`, `MARKS_KINDS`, `MARKS_COMBAT` (150 a UTC day across gate, raid and serpent), the guild `deed` | The pay of a hall writ; witnessed faucets, capped |
| Court writs | `net/professionLaw.js` `courtWritCount`, `COURT_WRITS_PER_DAY` (3); PROF0 section 11 | An NPC poster, a service-witnessed delivery, a daily cap - the shape of a hall writ |
| The Notice Board | `net/boardLaw.js` | One board a town; where hall writs are posted |
| The Turning and the Season | `server-account/src/seatTurning.js` `settleWeek`; `net/townSeatLaw.js` `seasonOf`; `net/tideLaw.js` | The week a chapter settles in, the Season its story runs on, and the pure-roll pattern for its events |
| The living world | `systems/livingWorld/census.js` (two `guildsman` residents to every guild hall, with the hall's `faction` - at the hall all day, it being their work), `systems/livingWorld/dayPlan.js` (`guildHallOf` picks a resident's hall; `guildDay`, two days a week three apart, sends a resident whose trade or class ties it to a guild there for an evening's hour - AUDIT CHAP R7: this said `guildHallOf` kept the hall's members there two days a week), `systems/livingWorld/relations.js` (`EVENTS`, `EASE_PER_DAY`), `systems/livingWorld/livingSwitch.js` `livingWorldOn` | The hall's people, and the one place the sheet is read |
| The law's overhaul | `systems/standing.js` (REP1-REP6); `06-Systems/Standing-Arc.md` QFAIL-FREE: online, a failed quest costs nothing, a success still pays +5 | The online quest's reputation, kept |
| The gap | grep, 2026-10-07 | No `systems/livingWorld/` file calls `changeReputation` or reads `guildMemberships`; the world and the guilds have never met |

## 3. The Roll - standing on the service (CHAP1)

### 3.1 What moves

DECIDED. For a realm character, the service keeps **the Roll**: the character's memberships in the guild groups
(the mortal and vampire books of `newMembershipStore`) and its reputation with each of the twenty-two guild factions.
Every other faction - the regions' people, the nobles, the witches, the Daedra - stays the save's, as today (CALL 1).
BUILT (CHAP1), narrowed: the last rank review and REP6's probation stay the save's, where DFU's law keeps them - the
Roll holds what a seat will ask (the reputation, the membership, its rank as the client reports it, and the tenure).

### 3.2 The layer

DECIDED. Coming online, the client fetches its Roll and writes it over the entity's `factionRep` rows for those
twenty-two ids, as Renown's layer adds its health and magicka. Online, the save's copy of those rows is overwritten by
the service's at the first read (AUDIT CHAP R3: this said "never read" - the first read's seed IS the save's, 3.6); the
save may keep writing them (a realm character never loads offline - Realm decision 2), so the save's shape is
unchanged. BUILT (CHAP1), narrowed: the MEMBERSHIPS are not written over. A join, an expulsion and the rank review are
acts of DFU's law on the client, so the book stays the save's and the Roll records it with the service's own clock -
the tenure is the thing only the service can vouch for - and each recorded rank is bounded by the Roll's own reputation
(AUDIT CHAP S5, `rollRankCapOf`; R1 at the head of this page, which Mac confirmed).

THE KEPT ADOPTION (AUDIT CHAP C1/C2/C4). Every adoption is kept in the save as a mod-save record (`ChaptersRoll`: the
Roll's sequence and its twenty-two). The next page's first read, finding the Roll still at that sequence, knows that
whatever the save holds past it was never claimed, and claims it - the minute between claims, a session played while
the Roll was shut, a stop, and the moves made before a slow first read all reach the service. A Roll whose CLAIMS moved
on since (a claim the save never saw) keeps only what moved on the page itself: nothing is claimed twice. AUDIT CHAP2 C1:
the sequence the save keeps is the CLAIM sequence (the head's `kseq`, moved only by a claim that credits a line) - the
service's own credits (owed paid, a hall writ's +2) are additive and never make the next page drop what its save held
unclaimed, which CHAP2a's hall writ, moving the one `seq`, had made it do. It replaces CHAP1's
claim as the page went, which never landed - the realm session gives its lease up first, and the service clears it.

### 3.3 What moves a reputation

| Source | Trust | Reputation | Cap |
|---|---|---|---|
| A hall writ delivered (section 4) | Service-witnessed (the Stores took the units) | +2 with the posting guild | The writ supply and the account's 3 a day (AUDIT CHAP3 R9: a receipt writ is the next row's, outside the 3) |
| Anything DFU's law moves on the client - a guild quest (DFU's +5; QFAIL-FREE: a failure costs nothing online), a donation, the ally and enemy spread | Client-reported, bounded | What moved | 15 a guild faction a character a UTC day, from every claim together |
| A gate or raid receipt in a region where the character's guild keeps a chapter (AUDIT CHAP2 R24: a serpent's names no region - section 11) | Relay-signed | +1 with each guild the character belongs to (BUILT, CHAP2b - and +2 more for the chapter's receipt writ, its first of the day there, section 4) | The receipt's own day (a gate one a day, a raid `RAID_CLAIMS_DAY_MAX` - AUDIT CHAP3 E2: six a game day of two real hours, so up to seventy-two raids a UTC day, each a witnessed act; their +1 stands outside the 15 a day, as DECIDED, and their Merit is bounded by the 600) |
| Any LOSS of reputation (a crime against a guild; AUDIT CHAP2 D5: a probation and an expulsion move no reputation - `Guild.cs` only drops the membership) | Client-reported | DFU's law | None - a client that lies against itself is believed |

BUILT (CHAP1), narrowed: the first draft gave the quest and the donation caps of their own (3 quests and 1 donation a
day). A claim is what moved since the Roll's last word, and the source it named would be the client's word too, so the
service bounds the one thing it can: the day's pace, which three quests already fill. The two service-side sources -
a hall writ and a receipt - need the chapters, and arrive with CHAP2.

THE PACE, NOT A CEILING (AUDIT CHAP D2-D4). CHAP1 credited what the day's 15 left and threw the rest away - and Daggerfall
pays far more in one act: S0000106, the King of Worms' ending of "Who Gets the Totem", pays +100 to the Fighters, Mages
and Thieves Guilds, the Brotherhood and all eight temples; A0C0XY04 +25 to the Mages Guild; K0C00Y05 +20 to the Fighters
Guild; a fourth quest in a day lost its +5; a temple donation took the gold and the Roll took the point back. Now what
the day's room does not take is OWED (`npc_roll.owed`) and paid at the same pace on the days after - by the next read or
claim, never past 100 - and a loss is taken from what is owed first. The day counts its NET rise, so a loss gives its
room back (a crime and its penance on one day). A lie is paid no faster than an honest claim, and an honest reward
arrives whole. The ceiling's line says so: "... rises no further today. The rest will follow in the days to come."
RECORDED (D5): the pace falls on the twenty-two alone, so a temple's templar order (a child faction, the save's) can
stand above its divine on the Roll until the owed is paid; no DFU law reads the two together for a decision.

- **The spread.** DFU spreads a change to a faction's allies and enemies, and the allies and enemies are FACTION.TXT's,
  which the service never holds. DECIDED (CALL 2): the client computes the spread with `factionRep.js`'s own law and
  reports each touched guild faction's share in the same claim; a spread to a faction outside the twenty-two stays the
  client's. **Every claimed gain is bounded** by **15 a guild faction a character a UTC day** from claims of every kind
  together (three quests' worth), so a spread cannot carry a lie past what the quests themselves could.
- **The ledger.** Every line of every claim is a row of `npc_rep_events` - what it asked and what it was credited. A
  claim replayed is counted once by the head's `last_rid` (BUILT, CHAP1: the record keeps no uniqueness of its own) - and
  (AUDIT CHAP S6, AUDIT CHAP2 S6) any id the 90-day record holds, a claim with no reputation line leaving its faction-0
  line.

### 3.4 Ranks 0-7 - DFU's law over the server's numbers

DECIDED. `baseCalculateNewRank` and `updateRank` run unchanged, over the Roll's reputation and the save's skills.
FACT: the skills are the client's word until Realm phase 3 checks a save; a lied skill buys a rank that costs no rival
anything, which law 3 allows. BUILT (CHAP1): the 28-day gate and REP6's probation stay DFU's, on the client's own
calendar, untouched; the Roll records the rank the client reports, bounded by its own reputation (3.2; AUDIT CHAP2 D5:
this said the rank as reported) - so between DFU's reviews, or for a Thieves Guild or Brotherhood member (they never
expel), the recorded rank may sit BELOW the book's: the Roll's bound, not a demotion. AUDIT CHAP2 C2 (= D1): the tab
compares its book with the book it last SENT, never with the Roll's record of it, so that difference is claimed once,
not every minute.

### 3.5 Ranks 8 and 9 are seats

DECIDED. A character whose own law would reach rank 8 or 9 holds rank 7 and is **Eligible** until it holds a seat
(section 6) - from CHAP4, with the seats: CHAP1 moves no rank, so nobody loses a rank before there is a seat to win it
back in. AUDIT CHAP R2: the service holds no skills, so CHAP4's Eligible is the half it does hold - a member whose
reputation ON THE ROLL meets rank 8's need (80), its tenure on the Roll fourteen days - and the seat itself is Merit's. The rank-8 and rank-9 titles are the guild's own (`guilds.js`'s rank titles; `guildVariants.js`'s for the
temples and the orders), worn only by a seat's holder.

### 3.6 Customs and a new character

DECIDED. A character crossing into the realm through customs keeps its memberships, and its reputation with each
guild faction is carried capped at **40** (rank 4's need), so an offline grind cannot buy a seat's eligibility (CALL 3).
A new realm character starts where chargen leaves it (DFU's zero and its biography's few points).
BUILT (AUDIT CHAP C3, D1 - CHAP1 read the cap off the character's age alone, so a character born online after
2026-10-08 that played under the shut switch lost all but 40 the day it opened, and a crossing member above rank 4 was
demoted by its next review): the cap is a customs crossing's - `origin_id` set - made from 2026-10-08 00:00 UTC
(`ROLL_EPOCH_S`); a guild the crossing character is a member of keeps what its rank needs (`RANK_REQ_REPUTATION`), so its
rank survives the review - AUDIT CHAP2 D3: and its rank's band above, up to the next rank's line less one
(`rollRankKeepOf`), since a member seeded ON the line was demoted at the review after DFU's own 112-day drift; never past
79 (`ROLL_SEAT_LINE` - 1), so the band buys no seat's 80; every other realm character - born online, or brought in before the epoch - is seeded whole,
its standing earned online. THE SEED IS THE SAVE'S WORD (AUDIT CHAP S2): what a client wrote into its save before its
first read is taken as a claim is, and buys what any claim buys - a personal rank, and a standing at the gate - while the
tenure begins at the seed, so a seat is still fourteen days and witnessed Merit away. Realm phase 3 closes it.

**DECIDED (Mac: "You can decide whatever is best", 2026-10-08) - AUDIT CHAP2 E6.** Since AUDIT CHAP D1 a rank-8 or
rank-9 member crossing through customs kept its rank's 80 or 90 - the reputation half of CHAP4's Eligible, which CALL 3
says an offline grind cannot buy. Built: such a crossing keeps 79 (`rollRankKeepOf`, never past `ROLL_SEAT_LINE` - 1),
its recorded rank 7, and DFU's own review takes the book to 7 - which 3.5 does to everyone at CHAP4 anyway. It is the
one rank CHAP1's "moves no rank" gives up: a seat's rank is a seat's (3.5), never a grind's.

## 4. Hall writs - the chapter's work (CHAP2)

DECIDED. A **chapter** is one guild in one region where that guild keeps at least one hall (the client derives the
halls from each building's faction id, as `guildHallReveal.js` does, and the service learns the list through the witnessed registry
as it learned the seats - Seats-Arc 3.2). Each chapter posts writs on the Notice Board of each town it keeps a hall in,
on the Work tab beside the Court's.

| Guild | Its writs | Trust |
|---|---|---|
| Fighters Guild | Defend a raided town; hold a gate; clear a camp | Receipts (raid, gate); a camp is bounded (Seats-Arc 9.3's five a day) |
| Mages Guild | Deliver reagents, gems and ores from the Stores; hold a gate | The Stores; receipts |
| Thieves Guild | Deliver goods from the Stores to a fence's board in another town | The Stores |
| Dark Brotherhood | A contract on a named foe at a gate or a raid | Receipts |
| The temples | Deliver herbs and remedies; hold a gate | The Stores; receipts |
| The knightly orders | Hold a gate; face the serpent; defend a raided town | Receipts |

- **Supply**: each chapter posts `chapterWritCount(active, strength)` a UTC day - the Court's
  `6 x max(1, ceil(active / 100))` shape, halved for a Failing chapter and raised half again for a Thriving one.
- **Pay** (DECIDED, CALL 8): a **delivery** writ pays Marks as the Court's does (minted only for a witnessed act -
  PROF0's law 8); a **receipt** writ (a gate, a raid, the serpent) mints no Marks of its own, because the receipt
  already struck its silver under `MARKS_COMBAT`'s day. Both pay reputation (3.3); NARROWED (AUDIT CHAP2 E4, CHAP3a):
  Merit comes of a member's OWN writ and of a receipt's own line (5.1), never a shared hall writ nor a receipt writ.
- **Limit** (DECIDED, CALL 8): hall writs and Court writs share **one** allowance - `COURT_WRITS_PER_DAY`, 3 an account
  a UTC day, whichever board posted them. A hall writ adds no Marks the economy model (PROF0 Appendix C) has not
  already counted; it changes what the day's writs are for.
- **Where it is delivered**: the units are the Stores', witnessed; the board they are delivered at is the client's word
  as a guild writ's is today (PROF0 11, AUDIT 31 R6). A delivery earns Merit only where it is witnessed as a seat
  writ's must be (Seats-Arc 4.2); until then it pays Marks and reputation alone.

BUILT, CHAP2a (2026-10-07, Mac: "Do it") - the delivery half, and where it narrowed the above:

- **A chapter is a region's.** A guild with a confirmed hall in ANY town of a region is a chapter there, and its writs
  stand on every board of the region beside the Court's - the Court's writs are a region's already, and a board that
  showed a guild's writs in one town and not the next would ask the player to learn the map's halls first.
- **The halls witnessed** (`npchall`, as a seat is - Seats-Arc 3.2): a town's report is `[mapId, region, factions]`,
  the guild factions it keeps a hall of, read off the town's own buildings - a Guild Hall or a Temple whose faction
  resolves to a guild through DFU's group dispatch (`createGuildForGroup` over `guildGroupOfFaction`), and for the
  Thieves Guild and the Dark Brotherhood a building carrying their own faction (what their reveal reads); never a
  GeneralPopulace door. The client reports a town once a UTC day as it walks in (`net/npcHallBook.js`), only once the
  faction file is read (half an answer would stand against the whole one), and a town with no hall reports nothing.
  Three registered accounts a week old confirm it (`WITNESS`); each account's first answer stands; 24 towns an hour an
  account. AUDIT CHAP2 E1/R4: CHAP2a took the seats' three and their age but not their moderation, so this said "the
  limit is the seats'" of a registry a liar could fill with all twenty-two in every region, for good. It now has the
  seats' tools: an account whose answers three times in a week stand alone against confirmed towns is ignored for a
  week (`seatIgnoredAccounts`); a developer reads a region's audit list (`/hall audit` - every town confirmed by exactly
  three, and every disputed one) and strikes a false town (`/hall strike <map id>`, `npc_hall_strikes`): its reports
  go and it is never witnessed again. A report is keyed by the hall law's version (`1:<mapId>`, E7), so a later rule is
  a new version and never a split with the old answers. U1/U2: a client reports only off the layout every client
  stands in (the homes' own gate - a pinned layout heard, every pack loaded) and names the region its town's board
  reads. The limit that remains: three colluding week-old accounts, until a developer strikes them - the writs a false
  chapter posts pay inside the same three a day.
- **Supply narrowed**: `hallWritCount(active)` = `2 x max(1, ceil(active / 100))` a chapter a day, not the Court's 6 -
  a region can hold a dozen chapters, and six each would bury the Court's. Strength's bands wait on CHAP3.
- **Their kinds**: the Court's law (`courtWrits`) over the region's witnessed table, narrowed to the guild's own
  families (`hallFamiliesOf`: the Fighters' metals and wood, the Mages' herbs and metals, the temples' and the
  Brotherhood's herbs, the orders' metals and wood, the Thieves' all four), the whole table where the region yields none
  of them; each chapter's own dice (`gateHash` under `HALL_WRIT_SALT`, keyed by its faction), never the Court's -
  chapters drawing from one table (the temples' herbs) can still post the same writ on a day (AUDIT CHAP2 R2: this said
  no two chapters could). AUDIT CHAP2 E5: a chapter's writs are the Court's law's slots AFTER its first, which is the
  table's top tier - two a chapter had made every other hall writ that one, a quarter richer than a Court writ. A writ's
  id is `h:day:region:faction:slot`; it rides the Court's `writs` table (kind `hall`, its `faction`) and its day's
  posting is `hall_writ_days` (migration `0092_npc_halls`). Receipt writs (a gate, a raid, the serpent, a camp) and the
  Thieves Guild's fence in another town are CHAP2b's.
- **Widened** (AUDIT CHAP2 R3): every chapter posts delivery writs in its own families - the Fighters, the Brotherhood
  and the orders too, whose rows in the table above name receipt writs alone - and the Thieves Guild's are ordinary
  deliveries on the region's boards until CHAP2b's fence.
- **Pay**: as a Court writ - its Marks, its Renown, twice the pay in the material's profession's XP - and `+2`
  (`HALL_WRIT_REP`) to the posting guild on the deliverer's Roll, in the delivery's own batch: a witnessed act (the
  Stores gave the units), so outside the claims' pace, never past 100, what is owed trimmed to the room left. The Roll's
  head moves under the delivery's tag, so a claim that read it before is refused its write (`roll-busy`) and asked
  again; the playing tab asks the Roll's word at once (`npcRollTracker.js` `refresh`). A deliverer with no Roll is paid
  and nothing more. No Merit: a shared hall writ never earns it (AUDIT CHAP2 E4); a member's own writ does (CHAP3a, 5.1).
- **The hidden two**: the Thieves Guild's and the Dark Brotherhood's chapters post their writs to their members on the
  Roll alone (`hallHidden`; a standing is no membership) - DFU keeps their halls from everyone else until they join, so
  a board that named them to a stranger would tell what Daggerfall hides. To anyone else such a writ is no writ
  (`no-writ`). A character with no Roll never sees them.
- **The limit as decided**: one allowance, `COURT_WRITS_PER_DAY` - the decision's own `writs` count, which already
  counted every kind.
- **The join** (3.4): a CLAIM records a NEW membership only where the Roll's standing with that guild meets DFU's join
  (`joinRecordable`: `RANK_REQ_REPUTATION[0]`, 0); a member already on the Roll stays whatever its standing since. The
  seed records the memberships the save reports, as it takes its standing (3.6, the save's word - AUDIT CHAP2 R5: this
  said the Roll asked the floor of every membership). AUDIT CHAP2 D2: the Thieves Guild and the Dark Brotherhood join by
  their initiation quests at ANY standing (`GuildManager.cs` adds the membership on the quest's success, with no
  eligibility test), so their joins are recorded as DFU makes them; S7: the standing counts what the Roll owes (an
  initiation's own reward the day's pace cut is the Roll's already).
- **Behind `CHAPTERS_OPEN`** with the Roll: witnessing, a hall writ's listing and its delivery each ask it; shipped
  `dev`. Offline nothing changes: DFU 1:1.
- **No spread** (AUDIT CHAP2 D6): a hall writ's +2 moves its guild alone - DFU's quest reward spreads to allies, enemies
  and down the faction tree (`PersistentFactionData.cs` ChangeReputation), which the service, holding no FACTION.TXT,
  cannot compute. Its trace is the writ's row (`filled_char`), not a line of `npc_rep_events`.
- **DECIDED for CHAP3 (Mac: "You can decide whatever is best", 2026-10-08) - AUDIT CHAP2 E4.** Hall writs are first
  come, first served: two a chapter a day, deliverable from anywhere, taken at 00:00 UTC by whoever polls first. Once
  Merit rides on them the seats would become that race, so CHAP3's MERIT writs are drawn PER MEMBER (5.1): each member's
  own daily writ for its chapter, rolled over the character, inside the account's three. The shared writs stay as built
  for their pay and standing; nothing changes before CHAP3.

BUILT, CHAP2b (2026-10-08, Mac: "Keep going with the arc/slices") - the receipt half, and the record's calls in it:

- **A receipt's standing** (3.3, as decided): a gate closed or a raided town defended, by a realm character in a region
  where a guild it is a member of on the Roll keeps a chapter, is +1 to that guild (`RECEIPT_REP`) - every such guild,
  whatever its row asks. A gate's region is the claim's (the client's, as the seats take it - Seats-Arc 4.2), a raid's
  its key's (`contractRegionOfRaid`); a serpent's receipt names no region and credits no chapter (section 11).
- **The receipt writs** (the table's receipt rows): each chapter whose guild's row asks receipts posts its asks on the
  region's Work tab - "Hold the gate in Anticlere, for the Fighters Guild", "Defend a raided town of Anticlere, for the
  Knights of the Dragon" (`hallReceiptKindsOf`: the Fighters a raid and a gate, the Mages a gate, the Brotherhood's
  contract at either, the temples a gate, the orders both). DECIDED: a member's FIRST such receipt of the UTC day in the
  region fills its guild's ask for that member - `HALL_WRIT_REP` more (+2) - each member its own (E4's rule, never a
  race); no Marks of its own (the receipt struck its silver); OUTSIDE the three a day, which bound what mints (CALL 8),
  since the receipt is bounded by its own day (a gate one an account a day, a raid `RAID_CLAIMS_DAY_MAX`). So a member's
  gate or raid in a chapter's region is worth +3 to the guild the first time that day and +1 after; a non-member's,
  nothing. The card has no Take - the receipt is the relay's - and says the member's own state ("Done today", "Your next
  one here fills it", "For members of the ..."); a hidden guild's asks are its members' alone, as its writs are.
- **After the receipt, never instead of it** (`server-account/src/npcReceipts.js` creditReceipt): the claim's own row
  first, the credit after it in the claim's answer (`chapters`), as the seats' gate influence is; a credit that fails is
  answered `counted: false` and the claim stands. Each line is kept once by its id (`npc_receipt_credits`, migration
  `0093_npc_receipts`: a receipt's `gate:<day>` or `raid:<key>`, a member's day's writ `wgate:<day>`, `wraid:<day>`), so
  a receipt claimed again credits nothing. The Roll's head moves under the credit's own tag (a claim that read it
  before is refused its write), the claim sequence untouched (AUDIT CHAP2 C1); never past 100, what is owed trimmed; only
  while the character stands; the tab refreshes and says "The Fighters Guild will remember it." (`hallRememberLine`).
- **The fence, DECIDED against**: the Thieves Guild's row asked delivery "to a fence's board in another town". The
  service cannot witness which board a delivery is made at (PROF0 11, AUDIT 31 R6), so the other town adds nothing a
  modified client could not say; the Thieves' chapters keep their delivery writs, and ask no receipt.
- **Merit** rides these from CHAP3 (5.1): a receipt in the chapter's region while a member, and the member's own writ.

## 5. Merit and Strength (CHAP3)

### 5.1 Merit

DECIDED. Merit is counted per character, per chapter, per week - from **witnessed sources alone**: a hall writ
filled for that chapter, a receipt in that chapter's region while a member. Never from a quest claim. DECIDED (AUDIT
CHAP2 E4; Mac: "You can decide whatever is best"): the hall writ that earns Merit is the member's OWN - one a member a
chapter a day, rolled over the character (the shared writs, first come first served, would make the seats a race at
00:00 UTC) - inside the account's three a day; its units the member's own, never bought (E13: Seats-Arc 4.2's rule).

- **Tenure**: a character in the guild fewer than **7 days** on the Roll earns no Merit (Seats-Arc 4.2's new member).
- **One chapter a guild an account a week**: the first chapter of a guild an account's character earns Merit in is that
  account's chapter of that guild for the week; its other characters earn none in another chapter of the same guild
  (Seats-Arc's per-account war, applied to a guild).
- **Cap**: **600 Merit an account a chapter a week**, whatever number of its characters play.

BUILT (CHAP3a, 2026-10-08), and where building it asked, narrowed here:

- **A member's own writ.** Kind `member` on the board's `writs` table, its `owner` the realm character: one a day for
  each of the character's guilds keeping a chapter in the region whose board it reads, written down on that read
  (`memberWrit` - the chapter's law over the guild's own kinds, the day's top slot left the Court's, AUDIT CHAP2 E5 -
  from the member's own dice, keyed by its realm id). Shown to its owner alone and only while it is the guild's member
  on the Roll; delivered by it alone (`no-writ` to any other, its account's other characters too); paid as a hall writ
  is - Marks, Renown, XP and the guild's +2 - inside the account's three a day.
- **Its Merit**: `MERIT_WRIT`, 100, for its units - the share of them the member's own: the bought are spent first
  (`professions.js` spendStatements), so what they leave is the own share, rounded down; a writ filled with bought units
  alone pays and earns none (E13).
- **A receipt's Merit**: `MERIT_RECEIPT`, 50, shared among the chapters whose own receipt line a gate or a raid credits
  (CHAP2b's +1; the receipt writ's line earns none of its own) - every receipt, as its +1 is. DECIDED (AUDIT CHAP3 E4,
  Mac: "Your decision"): one receipt is one act, its 50 shared, rounded down (`meritOfReceipt`: two guilds 25 each, eight
  6) - never 50 a guild; a share its chapter's line cannot take (a new member's, another region's this week) is unpaid.
- **The bounds are the line's own.** Each Merit line is one INSERT in its act's own batch
  (`server-account/src/npcMerit.js` meritStatement), so the act and its Merit stand or fall together and two of an
  account's acts cannot race past a bound: the tenure from `npc_roll.joined_at` - the service's first sight of the
  membership, so a member brought in from a save waits its week from its first claim; the character standing; the
  account's one chapter of a guild a seat week (`meritWeekOf` is townSeatLaw.js `seatWeekOf`, so CHAP3b's Turning
  settles both); the 600, the line cut to the room left. Whole Merit only (the SQL's CAST).
- **The board says it.** Beside the writs, `merit`: for each of the reader's guilds keeping a chapter there, its
  account's Merit in that chapter this week of the 600, or why it earns none here - the week's chapter of the guild is
  another region's, or the day its tenure ends (`meritLineOf`). A delivered writ says its Merit with the guild's memory.
- **Merit outlives the character.** A realm character's delete and an undone customs leave its lines: the acts were
  witnessed and the chapter's, and the account's week's bounds stand on them - as a seat's influence lines stay.
- **Still drawn**: `standings`, a chapter's whole Merit, whose reader is CHAP4's seats (the sheet carries no Merit; the
  Turning sums `npc_chapter_merit` itself - AUDIT CHAP3 R11).
- **AUDIT CHAP3 E3**: a member's own writ is one a member a GUILD a UTC day, wherever posted - the first board of the day
  with a chapter of its guild (a member reading every region's board had one a region: the shared writs' race E4 closed,
  opened again a region at a time). The decided "one a member a chapter a day" narrowed so.
- **AUDIT CHAP3 E1**: a gate's Merit counts at the Turning only in the region three of its day's claims agree on (the
  seats' `agreedGateRegions`, `GATE_REGION_AGREE`) - a claim's region is its client's word - and a gate of another seat
  week counts for no chapter at all (`old-week`, the seats' `creditGate`'s law: a week of gates banked and claimed in one
  was a week's Merit for a gate of the last). A gate's +1 and its receipt writ's +2 stand on the claim's word, as before
  (small, one gate a day).

### 5.2 Strength

DECIDED. Each chapter has a **Strength**, 0 to 100, starting at 50. At each Turning it moves toward what its members
did: `+ min(10, merit / target)` where `target` scales with the region's active accounts, and `- 3` for a week with no
Merit at all (AUDIT CHAP3 E4: and, above 50, `- 3` toward 50 for a week short of its target). Between Seasons it moves halfway back toward 50 (as a seat's Standing does - Seats-Arc 9.1).

| Band | Strength | What the chapter's halls give |
|---|---|---|
| **Failing** | 0-19 | Training and spells cost a quarter more; the shelf shrinks; half the writs |
| **Steady** | 20-69 | DFU's prices and services |
| **Thriving** | 70-89 | A tenth off training and spells; the shelf a tier deeper (NARROWED, AUDIT CHAP3 D1: more items, never better - DFU reads a hall's quality for the shelf's count alone); half again the writs |
| **Ascendant** | 90-100 | As Thriving, and the Season's event weighted toward Ascendancy (7) |

DFU's own price law stays the base; Strength is a multiplier laid over it online, never written into it.

BUILT (CHAP3b, 2026-10-08), and where building it asked, narrowed here:

- **The target**: `STRENGTH_TARGET`, 60 Merit a point of Strength for each hundred accounts active in the week
  (`strengthTarget`, the hall writs' own scale) - the realm's accounts, not the region's: the service keeps no region
  an account plays in. Its active accounts are the registered ones that played in the week before its Turning or
  since (a player's last play is all it keeps). One account at its 600 moves a quiet realm's chapter the whole 10; a
  realm of a thousand needs ten.
- **The step** is whole: `+ min(10, floor(merit / target))` - a week of some Merit under the target holds a chapter at
  or under 50 where it stands, and moves one above 50 `STRENGTH_SHORT` (3) back toward 50, never past it (DECIDED, AUDIT
  CHAP3 E4: a band above Steady is held by meeting the target); a week of none at all is the `- 3` anywhere. A chapter starts at 50 at its first Turning (`STRENGTH_START`).
- **The Season's end**: the Turning that ends a Season moves every chapter halfway back toward 50 after its week's own
  step (`strengthSeasonEnd`, rounded toward 50 as the seats' Standing is).
- **The Turning is the Chapters' own** (`server-account/src/npcChapters.js` settleChapterWeek, settleChaptersDue), on the
  seats' week by the seats' lazy law - the week settled the first time anything asks after its boundary, one batch keyed
  on the week, at most eight weeks a read, a week that fails the next read's first - but keyed on its own row
  (`npc_chapter_weeks`), not inside `settleWeek` (section 11 drew it there): neither switch waits on the other. It is
  asked by the sheet, by a board read where the Chapters are the reader's, and before a region's hall writs are written
  down for the day (so a chapter's writs are its band's whoever reads first). The week's chapters are every one confirmed
  when it settles, every one with Merit that week, every one already on the sheet. AUDIT CHAP3: a week settles
  `CHAPTER_TURNING_GRACE_S` (300 seconds) after its boundary, so a credit in flight across it lands in its week first
  (S1); nothing settles, and no hall writ posts, while the Chapters are `off`, and the first week settled `on` after
  weeks at `dev` starts every chapter from 50 - the developers' trial weeks leave none Failing, nor Ascendant, the day
  the Chapters open (S2, `npc_chapter_weeks.open`). AUDIT CHAP3 E4, DECIDED (Mac: "Your decision",
  2026-10-08): in a quiet realm one account at its 600 still makes a new chapter Ascendant in about five weeks - one
  member's real work, the realm's whole - but no longer holds it with a single receipt a week: a week short of its target
  moves a chapter above 50 three back toward 50 (`STRENGTH_SHORT`), so a band above Steady is held by the target met;
  and a receipt's 50 Merit is shared among the chapters it reached (`meritOfReceipt` - a member of eight guilds earned
  400 a gate, now 6 a chapter), so a gate lifts one act's worth of chapters, never every guild the character joined.
- **The bands' writs** stand now (`hallWritCountIn`): a chapter's hall writs a day halved Failing (never none), half again
  Thriving and Ascendant. Their prices and shelf are CHAP3c's - the numbers are the law's (`CHAPTER_BANDS`) already.

BUILT (CHAP3c, 2026-10-08), and where building it asked, narrowed here - online, the band laid over DFU's own laws in
the hall the player stands in (its guild's faction, as the hall's service window reads it, and its building's region):

- **The prices**: training (DFU's `trainingPrice` - both DFU's chain and RefinedTraining's, offer and gold check), a
  spell bought (DFU's trade price) and a spell made (the spellmaker's gold cost; its spell points DFU's) - x1.25
  Failing, x0.9 Thriving and Ascendant, rounded, never under 1 (`chapterPriceFactor`, `chapterPriced`). The rest of the
  hall's services - repair, identify, a donation, a cure, recharge, the item maker, a summoning, a teleport - stay DFU's:
  5.2's table names training and spells alone.
- **The shelf**: the guild's soul gems, potions and magic items stocked as a hall four qualities poorer Failing, four
  richer Thriving and Ascendant, inside DFU's 1-20 (`chapterShelfQuality` - DFU's stock law reads the hall's quality
  for the COUNT alone: fewer items Failing, more Thriving, never better ones - an item's level is the player's; AUDIT
  CHAP3 D1). AUDIT CHAP3 D2: a band that moves nothing leaves the quality as DFU reads it, a world-data pack's past 20
  too. A shelf is minted once a day (GUILD-SHELF), so a band that moves mid-day reaches it the next day; its prices are
  the shop's own law, untouched.
- **What a band reaches, by DFU's own halls** (AUDIT CHAP3 D3): only what a hall sells. The Mages Guild and the temples
  sell spells and shelves; the Fighters Guild training alone; the ten knightly orders none of these (DFU's
  `KnightlyOrder.CanAccessService`: quests, armor, a house) - their band is felt in their writs alone, until CHAP5 or
  CHAP6 gives an order's hall a band of its own. AUDIT CHAP3 D4: RefinedTraining's five-day package moves by less than
  the factor - its own per-session upkeep (RR's `(cost + level x 8 + 72) x 5`) is RR's, unbanded.
- **The price shown is the price charged** (AUDIT CHAP3 C1): each window reads the hall's factor once as it opens -
  training's flow, the spellbook and the spellmaker alike - and the hall's chapter is read in the politic map's region
  the chapters are keyed by (C6). The rounding is the law's one `chapterPriced` (R12); training's service law keeps its
  own copy, as DFU's service law reads no network module.
- **Where no Strength is known the hall is DFU's own**: offline (no sheet), and for a chapter the sheet does not name -
  the Thieves Guild's and the Dark Brotherhood's (5.3), and a hall whose town is not yet confirmed. NARROWED: the
  underworld's halls take no band until a sheet can be read by their members alone (CHAP5 reads the sheet again).

### 5.3 The chapter sheet

DECIDED. `/v1/chapters/list` publishes every chapter: its Strength and band, its seats' holders, its Season's event
and that event's standing. The client caches it as it caches the seats' list. It is the one thing the living world
reads from the service (9).

BUILT (CHAP3b): `/v1/chapters/list` answers `{ week, chapters: [{ f, region, strength, band }] }` (`chapterSheet`), the
Turnings due settled first, behind `CHAPTERS_OPEN`; the client's door is `accountRoll.list`. Its seats and events are
CHAP4's and CHAP6's to add, and its cache CHAP3c's, the halls' first reader. NARROWED: the Thieves Guild's and the Dark
Brotherhood's chapters are never on it - a public sheet would name where the underworld keeps its halls, which their
writs and receipt asks keep to their members (AUDIT CHAP2 S2). The board says the region's chapters' state beside its
writs ("The Fighters Guild here is Thriving (Strength 74)", `chapterLineOf`), a hidden guild's to its members alone.
BUILT (CHAP3c): the playing tab holds the sheet (`src/net/chapterSheet.js` createChapterSheet over `accountRoll.list`),
read at a town's entry and again once ten minutes old (`SHEET_KEPT_MS`, the seats' list's beat), one read at a time, a
refusal that is the account's stopping it for the page - and forgetting what it held, so every hall is DFU's own again
(AUDIT CHAP3 C2); its readers ask it synchronously and are answered as it last stood.

## 6. The seats - ranks 8 and 9 (CHAP4)

DECIDED (Mac): limited, contested seats; the shape below is the record's.

- **Per chapter** (CALL 4): one **Master** (rank 9) and three **officers** (rank 8). A seat no Eligible member has
  Merit for stands **vacant** - it is never filled from below.
- **Who may hold one**: an Eligible member (3.5) with **14 days** in the guild on the Roll, whose account is at least
  7 days old.
- **How it is held**: at each Turning, the seats go to the Eligible members with the most Merit at that chapter over
  the **last four weeks**; a sitting holder's Merit counts **x 1.2** (the 1.2 a seat's holder carries after a held siege, Seats-Arc 5.2 step 3).
  Ties break by the longer tenure, then the lower character id.
- **Limits**: one seat an account a guild (an account's alts cannot hold two seats of one guild); one Master's seat a
  character.
- **What a seat gives**: the rank and its title, signed on the token as a derived title (`server-account/src/titles.js`'s
  way); the rank's DFU services at every hall of the chapter; the Master chooses the chapter's weekly **Focus** (which
  of its writ kinds it posts more of) and casts the chapter's vote in its Season's event (7).
- **Losing a seat**: the holder returns to rank 7, Eligible, and keeps "Former Master of the <Region> Chapter" for the
  rest of the Season.
- **The Chronicle**: every change of seat is a history row, read by the Hall of Records as the seats' are.

## 7. Seasons - the chapter's story (CHAP6)

DECIDED (Mac): seasonal events, driven by players; personal rank carries over. The events below are the record's.

At the Turning that opens a Season, each chapter draws one event - a pure function of the Season, the chapter's key
and a salt, as a Tide is (`net/tideLaw.js`) - from weights its last Season moved:

| Event | Base weight | Moved by | The Season |
|---|---|---|---|
| **Calm** | 30 | - | Nothing beyond the week |
| **Schism** | 15 | +10 if the Master's seat changed hands twice last Season | Two of the hall's residents stand for the chapter's doctrine. Members back one with their Merit; at the Season's end the winner's doctrine holds the next Season (a perk set in the law module: cheaper training, or a deeper shelf, or more writs) |
| **Succession** | 10 | +10 if the chapter was Ascendant | The hall's head steps down. The Master names the successor from the hall's residents at the Season's third Turning; with no Master, the most-Merit member's choice stands |
| **Crackdown** | 10 | Thieves and Brotherhood x2; +10 if the region's seat holder's Edict is Curfew | The watch or a rival hunts the chapter: its writs pay half again, and a chapter under 30 Strength at the Season's end shuts its halls for the next |
| **Rivalry** | 15 | +10 if a rival chapter (section 8) in the region is Thriving; with no rival chapter in the region its weight is Calm's (AUDIT CHAP R9: a weight of 0 spread its share over every event, where CALL 5 gives it to Calm) | Two chapters in one region race on Merit; the winner takes 10 Strength from the loser at the Season's end |
| **Decline** | 10 | +15 if Failing | Strength falls 2 more each week unless the week's Merit meets twice the target |
| **Ascendancy** | 10 | +15 if Ascendant | The halls' prices a further tenth off; the Master's title gains "High" for the Season |

- **At the Season's end** (the Turning that closes week 8): the event resolves; Strength moves halfway back toward 50;
  the seats stand; the Master who held all eight weeks keeps "Master of the <Region> Chapter, Season N" for good; the
  Chronicle writes the Season's line.

## 8. Rivals and patrons (CHAP7)

- **Rivals** (DECIDED, CALL 5): the port's own table in the law module, never FACTION.TXT. Each pair is a Rivalry's
  draw (7) where both keep a chapter in the region:

  | Chapter | Its rivals | Why |
  |---|---|---|
  | Fighters Guild | Thieves Guild | The sword for hire against the hand in the purse |
  | Dark Brotherhood | Temple of Arkay; Temple of Stendarr; every knightly order | Murder against the god of death's order, the god of mercy, and the oath-bound knights |
  | Mages Guild | Temple of Julianos | Two claims to learning, one of them a god's |

  The watch is no chapter: it is a Crackdown's hunter alone (7).
- **Patrons** (DECIDED, CALL 6): a player guild (GUILD1) may be a chapter's **patron** for a Season - one patron a
  chapter, the highest Marks bid at the Season's first Turning, the winner's bid burnt and every other bid returned.
  A patron's banner hangs in the chapter's halls, its members pay the Thriving band's prices there whatever the
  chapter's Strength, and the Chronicle names it. **A patron gains no seat influence**: a gate kill already raises
  influence (Seats-Arc 4.2), as an Orc Raid's camp does (9.3), and letting the same act raise Merit, Strength and
  influence for one guild would count it three times into a war the Seats' caps were balanced without (AUDIT CHAP R6:
  this named a raid receipt, which raises none, and said twice where CALL 6 said three times).

## 9. The living world shows it (CHAP5)

DECIDED. LW0 decision 2 narrows by one input: the living world is a pure function of the world's data, a seed, the
clock **and the chapter sheet**. Every player reading the same sheet sees the same hall. With no sheet - offline, the
classic skin, the row off, the service unreachable - the living world is exactly today's.

- **The hall's people** (AUDIT CHAP R7): the census's two `guildsman` keep the hall by day, and `guildDay` sends a
  resident whose trade or class ties it to the guild there for an evening, two days a week; a Thriving chapter gives
  `guildDay` a third, a Failing one a single day, and a chapter whose halls are shut sends nobody - its two `guildsman`
  idle at home.
- **The Schism's candidates and the Succession's heir** are residents of the hall, drawn from the census by the event's
  roll, and are known to every player by the same name.
- **Their words**: `systems/livingWorld/lines.js` gains the chapter's lines, keyed by the event and its standing ("They say
  the Wayrest Mages are split over who leads them"); the rumour mill (`systems/rumorMill.js`) carries the Season's
  chapter news.
- **The hall's roll**: the seats' holders, named on a board inside each hall.
- **What does not change**: a resident's regard. Being a chapter's Master may warm a member of that hall to you, on your
  own machine, as any `relations.js` event does; it never gates anything the service keeps (law 6).

## 10. The threats, and the answers

| Threat | Answer |
|---|---|
| A modified client writes any reputation into its save | After the first read the save's twenty-two are overwritten by the service's; the seed itself is the save's word, taken as a claim is (3.6, AUDIT CHAP S2) - a personal rank and a gate, never a seat |
| A modified client claims quests it never finished | At most 15 a faction a day rises on the Roll, the rest owed at the same pace (3.3), and never Merit (5.1) |
| A modified client lies about skills to reach rank 7 | It costs no rival anything (law 3); Realm phase 3 closes it |
| An offline grind carried in through customs | Reputation capped at 40 at a crossing from the epoch, a member's rank kept (3.6) |
| A modified client dodges a loss by never claiming it | Nothing on the service can bound a loss it is never told of (AUDIT CHAP S8); the save's copy keeps it, and a later page claims it unless a claim has moved the Roll's claim sequence since (the kept adoption, 3.2; AUDIT CHAP2 C1: never the service's own credits) |
| Alts pad a chapter's Merit | 7 days' tenure; one chapter a guild an account a week; 600 an account a week (5.1) |
| One account holds a guild's seats through its alts | One seat an account a guild (6) |
| A fresh account takes a seat | 14 days in the guild, an account 7 days old (6) |
| A seat farmed by a friendly pair | Seats follow four weeks' Merit, and Merit comes from witnessed work, not from each other |
| A writ's Marks inflate the purse | Hall writs share the Court's 3 a day, and a receipt writ mints nothing the receipt did not (4); AUDIT CHAP2 E5: a hall writ never takes the day's top-tier slot, which stays the Court's |
| A forged hall - three accounts name a town's halls that are not there, or poison a real town's first | The seats' moderation (AUDIT CHAP2 E1): a liar's lone answers ignored, the audit list, a developer's strike (4); its writs pay inside the same three a day |
| A modified client sends claims as fast as the door allows | The service's own hour: 120 claims a character (`ROLL_CLAIMS_HOUR`, AUDIT CHAP2 E2) - the tab's minute was the client's word |
| A modified client names memberships its book cannot hold | One temple and one order a book, two books (`ROLL_BOOKS`, AUDIT CHAP2 E3); the tenure and the floor as before |
| A stranger walks a hidden guild's writ ids | The same `no-writ` whatever the writ's day or fill (AUDIT CHAP2 S2) |
| Two readers settle a week at once | The Chapters' own batch, the week's key first - a second settle fails on it and rolls back (5.2; law 7 NARROWED) |

## 11. The server's shape

DECIDED.

- **Account service (D1)**: BUILT (CHAP1, migration `0091_npc_roll`): `npc_roll_heads` (char_id, player, cap, seq,
  last_rid, tag, seeded_at, updated_at - every write moves `seq` on under its own `tag`, a claim names `last_rid`);
  `npc_roll` (char_id, faction_id, player, rep, gained_day, gained, owed, member, rank, joined_at); `npc_rep_events` (seq,
  char_id, player, faction_id, asked, credited, rid, at - AUDIT CHAP2 S6: a claim with no reputation line leaves a line
  of faction 0, its id). BUILT (CHAP2a, migration `0092_npc_halls`): `world_witness` kind `npchall`; `writs` rebuilt
  with `kind` ('court', 'hall'; CHAP3a: 'member'), `faction` and (CHAP3a) `owner`, `UNIQUE (day, region, kind,
  faction, owner, slot)`; `hall_writ_days` (day,
  region, posted, at); AUDIT CHAP2: `npc_hall_strikes` (map_id, by, at) and `npc_roll_heads.kseq`, the claim sequence
  (C1). BUILT (CHAP2b, migration `0093_npc_receipts`): `npc_receipt_credits` (char_id, faction_id, ref, player, amount,
  tag, at - one line a guild a receipt, one a guild a member a day for its writ). BUILT (CHAP3a, migration
  `0094_npc_merit`): `npc_chapter_merit` (week, faction, region, account, char_id, source - 'writ', 'gate', 'raid' -
  amount, ref, at; `UNIQUE (char_id, faction, source, ref)`, the draft's `(source, ref)` narrowed to one line a
  character an act a guild). BUILT (CHAP3b, migration `0095_npc_chapters`): `npc_chapters` (faction, region, strength,
  week, merit, at) and `npc_chapter_weeks` (week, active, target, chapters, open, at). BUILT (AUDIT CHAP3 S3, `0092`
  grown in place): `npc_hall_regions` (region, chapters, ver, done, at) - a region's chapters computed once a change.
  Still drawn: a chapter's event, event_state JSON, doctrine and focus (CHAP4, CHAP6); `npc_chapter_seats` (key, seat,
  char_id, since);
  `npc_chapter_history` (seq, key, week, kind, data JSON).
- **Endpoints** (`/v1/chapters/...`): `roll` and `claim` BUILT (CHAP1, behind `CHAPTERS_OPEN`, shipped `dev`; each
  names the realm character and the playing tab's lease); `witness` BUILT (CHAP2a); `halls` and `strike` BUILT (AUDIT
  CHAP2 E1, a developer's); `list` BUILT (CHAP3b, the sheet); `standings` (a chapter's Merit), `history` still drawn; the hall writs
  ride the board's own writ endpoints, and (CHAP3a) a member's own writ and the account's Merit lines ride its list.
- **The settle**: inside `settleWeek`, after the seats' steps - Merit summed, Strength moved, seats placed, and at a
  Season's boundary the events resolved and drawn. NARROWED (CHAP3b): the Chapters' own Turning on the seats' week,
  keyed on its own row (`npc_chapter_weeks`, migration `0095_npc_chapters`), beside `settleWeek` rather than in it -
  5.2. BUILT (CHAP3b): `npc_chapters` (faction, region, strength, week, merit, at - the draft's event, doctrine and
  focus are CHAP4's and CHAP6's to add) and `npc_chapter_weeks` (week, active, target, chapters, at).
- **The relay**: AUDIT CHAP R5 - this said "no change: the gate, raid and serpent receipts already name an account and a
  region". Only the raid's names a region (`w`); a gate's region is taken from its claims, as the Seats take it (Seats-Arc
  4.2: the region three of the day's receipts agree on), and a serpent's has none - so CHAP2b credits a gate in the Seats'
  way, a raid by its `w`, and a serpent to no chapter, with no relay change; a relay change is CHAP2's to propose if a
  chapter needs the serpent.
- **Law modules, pure, shared**: `net/npcChapterLaw.js` (Appendix A - BUILT for the Roll, CHAP1, the halls and their
  writs, CHAP2a, the receipts, CHAP2b, Merit, CHAP3a, Strength and the bands, CHAP3b and CHAP3c; the event weights and
  the rivals still drawn); the playing tab's side is `net/npcRollTracker.js` (CHAP1; the first draft named it
  systems/npcChapters.js), `net/npcHallBook.js` (CHAP2a) and `net/chapterSheet.js`, the sheet's reader (CHAP3c); DFU's guild faction ids live in the leaf
  `systems/guildFactions.js`, which the service can reach and `guilds.js` cannot be.

## 12. The slices, in order

1. **CHAP1 - the Roll.** BUILT (2026-10-07). The service owns the twenty-two factions' reputation and records the
   memberships for realm characters; the layer; the bounded claims and the daily ceiling; customs' cap. Port-Ledger
   section A row added.
2. **CHAP2 - hall writs.** The chapters derived and witnessed; their writs on the board; the pay. CHAP2a BUILT
   (2026-10-07): the halls witnessed, the delivery writs, the +2, the join's floor (section 4). CHAP2b BUILT
   (2026-10-08): a receipt's standing and the receipt writs; the fence decided against.
3. **CHAP3 - Merit and Strength.** The week's Merit, the Turning's Strength, the bands on the halls' prices, the sheet.
   CHAP3a BUILT (2026-10-08): a member's own writ and the week's Merit (5.1). CHAP3b BUILT (2026-10-08): the Turning's
   Strength, the bands on the hall writs, the sheet (5.2, 5.3). CHAP3c BUILT (2026-10-08): the bands on the halls' prices
   and shelf (5.2).
4. **CHAP4 - the seats.** Ranks 8 and 9 contested; the titles; the Focus; the Chronicle's rows.
5. **CHAP5 - the living world reads the sheet.** The hall's people, the lines, the roll.
6. **CHAP6 - the Seasons' events.** The roll, the seven events, their endings.
7. **CHAP7 - rivals and patrons.** Last, because it reads the Seats' guilds.

CALL 1 retired the eighth slice the first draft carried (the other factions to the service): they wait on Realm phase 3.

## 13. The four hosts

THE FOUR HOSTS RULE, named before the first slice (and CHAP1's, as built: the tracker lives in `world.js`, the one
host online runs in - the interiors and the dungeons are that same page and that same entity):

- `scenes/worldModes.js` (interiors) - the hall's service window: the rank from the Roll, the prices from Strength
  (CHAP1, CHAP3), and the hall's roll (CHAP5). CHAP1: nothing to wire - the window reads the entity's reputation and
  book as it always did, and online the reputation it reads is the Roll's. CHAP3c BUILT: the hall's chapter's band
  on its training, spells and shelf, through the host's `chapterStrength` (world.js's sheet; none offline).
- `scenes/world.js` (the streets) - the living world's read of the sheet and the Notice Board's hall writs (CHAP2,
  CHAP5). CHAP3c BUILT: the sheet the playing tab holds (`net/chapterSheet.js`), asked at a town's entry and handed to
  the interiors.
- `scenes/exterior.js` (the fixed city) - no online, so no Roll and no sheet: flagged by name, DFU's guilds and DFU's
  prices as today.
- `scenes/dungeonContext.js` - no hall, so no sheet; the receipts a dungeon's foes give are the relay's already: none.

## 14. The calls, decided (Mac: "You make the best decisions")

The first draft left eight calls open. Mac handed them to the record; each is decided here with its reason, and each
is Mac's to overrule.

1. **The other factions stay the save's.** The regions' people, the nobles and the rest are read by no seat, no Merit
   and no Strength, so law 3 asks nothing of them; and their spread runs through FACTION.TXT, which the servers never
   hold. Moving them buys no protection until Realm phase 3 checks a save - so they move then, not before.
2. **The spread is the client's, bounded.** A registry of the twenty-two factions' ally and enemy columns is a second
   witnessed registry to build and dispute for a number that only moves personal ranks 0-7. The daily ceiling (3.3:
   15 a guild faction a character a day) bounds the spread as hard as it bounds the quests.
3. **Customs carries reputation capped at 40.** Rank 4's need: a crossing character keeps a real place in its guild,
   and a seat - which needs the law's rank 8, reputation 80 - is still earned online. AUDIT CHAP D1: never below what a
   member's rank needs - a cap that demoted the member at its next review took the rank this call promised it keeps -
   and only for a crossing made from the epoch (C3).
4. **One Master and three officers a chapter, on four weeks' Merit; an unearned seat stands vacant.** Four seats keep a
   chapter's top worth contesting; four weeks let a holder miss a week without losing a seat and keep a single
   week's surge from taking one. Vacant over filled-from-below, so a seat is never a gift.
5. **The rivals** are section 8's table: three pairings Daggerfall's own guilds already imply, and every chapter that
   has none draws Calm in a Rivalry's place.
6. **A patron gains no seat influence** (8): one act - a gate kill, an Orc Raid's camp - would count three times for one
   guild: Merit, Strength and influence.
7. **Legal standing stays the client's.** A crime is seen by the client's watch (`standing.js`, `standingHost.js`);
   moving the number to the service would hold a client's claim in a different place, not witness it. Nothing a rival
   loses reads it (the Curfew Edict's doubled cost is "each player's own, client-side" - Seats-Arc 7.6).
8. **No new Marks faucet.** Hall writs share the Court writs' 3 a day, and a receipt writ mints nothing of its own (4),
   so PROF0's economy model stands without a re-run.

## Appendix A - every number (`net/npcChapterLaw.js`)

| Constant | Value | Section |
|---|---|---|
| Guild factions on the Roll | 22 (4 guilds, 8 temples, 10 orders) | 3.1 |
| Writ delivered, reputation | +2 (`HALL_WRIT_REP`; no spread - AUDIT CHAP2 D6) | 3.3 |
| Quest success, reputation | +5 (DFU's), failure 0 online | 3.3 |
| The day's pace | 15 a guild faction a character a UTC day, net (`ROLL_GAIN_DAY_MAX`; CHAP1 folded the first draft's 3 quests a day into it); the rest owed (`npc_roll.owed`), paid at the same pace, never past 100 (AUDIT CHAP D2) | 3.3 |
| The record's keep | 90 days (`ROLL_EVENTS_KEEP_S`), pruned by the character's own claims (AUDIT CHAP S7) | 3.3 |
| The kept adoption | the mod-save record `ChaptersRoll` (`ROLL_KEPT_VENDOR`): the Roll's sequence and its twenty-two (AUDIT CHAP C1) | 3.2 |
| A claim's line | 1 to 200 either way (`ROLL_DELTA_MAX`) | 3.3 |
| A claim's pace | at most one a minute (`ROLL_CLAIM_MS`) - CHAP2a: at once, even with nothing moved, after a hall writ (`refresh`) - asked again after 30 seconds doubling to 15 minutes; AUDIT CHAP2 E2: the service's own bound, 120 claims a character an hour (`ROLL_CLAIMS_HOUR`, `roll-rate`) | 3.3 |
| The memberships a claim may carry | one a guild faction, at most two temples and two orders (`ROLL_BOOKS` - the mortal's book and the vampire's, AUDIT CHAP2 E3) | 3.2 |
| Receipt, reputation | +1 a guild (`RECEIPT_REP`); +2 more for the chapter's receipt writ, a member's first of the kind a UTC day in the region (`HALL_WRIT_REP`) | 3.3, 4 |
| Customs reputation cap | 40 (`ROLL_CUSTOMS_CAP`), for a customs crossing made from `ROLL_EPOCH_S` - 1,791,417,600, 2026-10-08 00:00 UTC - and never under a member's rank's band (`rollRankKeepOf`: its need up to the next rank's line less one, never past 79 - a rank 8 or 9 too, AUDIT CHAP2 E6 - AUDIT CHAP C3, D1; AUDIT CHAP2 D3) | 3.6 |
| A recorded rank | never past what the Roll's reputation needs (`rollRankCapOf` over `RANK_REQ_REPUTATION`, AUDIT CHAP S5) | 3.2 |
| Writs an account a UTC day | 3, hall and Court together (`COURT_WRITS_PER_DAY`) | 4 |
| Receipt writ's own Marks | 0 | 4 |
| Writ supply | `6 x max(1, ceil(active / 100))`, x0.5 Failing, x1.5 Thriving - CHAP2a: `2 x max(1, ceil(active / 100))` a chapter (`hallWritCount`); CHAP3b: by its band, x0.5 Failing (never none), x1.5 Thriving and Ascendant (`hallWritCountIn`) | 4 |
| A hall witnessed | kind `npchall`, keyed `1:<mapId>` (`HALL_REPORT_V`), three accounts a week old (`WITNESS`), 24 towns an hour an account (`HALL_WITNESS_HOUR`), a town once a UTC day a device until counted, then never again (`npcHallBook.js` `HALL_DONE`, AUDIT CHAP2 E9), kept on the device under `HALL_REPORTED_KEY` (`chap2.halls`), 200 towns at most (`HALL_REPORTED_MAX`); an account ignored for a week after three unmatched answers in one (the seats' `SEAT_WITNESS_UNMATCHED_MAX`) | 4 |
| A region's chapters kept | 60 seconds an isolate (`CHAPTERS_KEPT_MS`, `server-account/src/npcHalls.js`) | 4 |
| The join's floor | 0 (`RANK_REQ_REPUTATION[0]`, `joinRecordable`) | 3.4 |
| A member's own writ, Merit | 100 for its units, its own units' share, rounded down (`MERIT_WRIT`, `meritOfWrit`); one a member a chapter a UTC day (`memberWrit`, `memberWritId`, `MEMBER_WRIT_SALT`) | 5.1 |
| A receipt, Merit | 50 shared among the chapters its own receipt lines credit, rounded down (`MERIT_RECEIPT`, `meritOfReceipt`; AUDIT CHAP3 E4) | 5.1 |
| Merit tenure | 7 days on the Roll (`MERIT_TENURE_S`, from `joined_at`) | 5.1 |
| Merit cap | 600 an account a chapter a week (`MERIT_CAP_WEEK`); one chapter of a guild an account a seat week (`meritWeekOf`) | 5.1 |
| Strength | 0-100, start 50 (`STRENGTH_START`); `+ min(10, floor(merit / target))` (`STRENGTH_STEP_MAX`, `strengthAfter`); -3 a week with no Merit (`STRENGTH_IDLE`); above 50, -3 toward 50 a week short of its target (`STRENGTH_SHORT`, AUDIT CHAP3 E4); halfway to 50 at a Season's end (`strengthSeasonEnd`) | 5.2 |
| Strength's target | 60 Merit a point for each hundred active accounts (`STRENGTH_TARGET`, `strengthTarget`) | 5.2 |
| The Turnings a read settles | 8 at most (`CHAPTER_WEEKS_MAX`, `server-account/src/npcChapters.js`); every region's chapters kept 60 seconds an isolate (`ALL_CHAPTERS_KEPT_MS`) | 5.2 |
| Bands | Failing 0-19, Steady 20-69, Thriving 70-89, Ascendant 90-100 (`CHAPTER_BANDS`, `chapterBandOf`) | 5.2 |
| Failing price | x1.25 on training, a spell bought, a spell made (`CHAPTER_BANDS`, `chapterPriceFactor`, `chapterPriced`) | 5.2 |
| Thriving and Ascendant price | x0.9 on the same | 5.2 |
| The shelf by band | 4 qualities poorer Failing, 4 richer Thriving and Ascendant, inside 1-20 (`HALL_QUALITY_MIN`, `HALL_QUALITY_MAX`, `chapterShelfQuality`) | 5.2 |
| The sheet held by the tab | 10 minutes (`SHEET_KEPT_MS`, `src/net/chapterSheet.js`) | 5.3 |
| A week's grace before it settles | 300 seconds (`CHAPTER_TURNING_GRACE_S`, `server-account/src/npcChapters.js`, AUDIT CHAP3 S1) | 5.2 |
| A kept gate claim's wait for the scan | 90 seconds at most (`GATE_SCAN_WAIT_MS`, `src/scenes/world.js`, AUDIT CHAP3 C3) | 3.3 |
| Seats | 1 Master, 3 officers a chapter | 6 |
| Seat eligibility | 14 days in the guild, account 7 days old | 6 |
| Merit window | 4 weeks | 6 |
| Unearned seat | vacant | 6 |
| Patron | one a chapter a Season, highest Marks bid, burnt | 8 |
| Holder's Merit | x1.2 | 6 |
| Event weights | Calm 30, Schism 15, Succession 10, Crackdown 10, Rivalry 15, Decline 10, Ascendancy 10; moved as section 7's table says (AUDIT CHAP R11) | 7 |
| Decline's weekly fall | 2 Strength, unless the week's Merit meets twice the target | 7 |
| Ascendancy's prices | a further tenth off | 7 |
| Rivalry's swing | 10 Strength | 7 |
| Crackdown's shut line | Strength 30 | 7 |

---

## CHAP1 - the Roll, as built (2026-10-07, Mac: "Continue")

The first slice: a realm character's standing with Daggerfall's guilds moves to the account service. Section 3 carries
the law and every place this slice narrowed it (BUILT, CHAP1).

- **The leaf.** `src/systems/guildFactions.js` - no imports - holds DFU's four guild ids (`GUILD_FACTION_IDS`), the
  divines (`DIVINES`), the orders (`ORDERS`) and the reputation's bounds (`MIN_REPUTATION`, `MAX_REPUTATION`).
  `guilds.js` builds GUILDS on it; `guildVariants.js` and `factionRep.js` hand its tables on. ONE DFU MEMBER, ONE
  EXPORT: each was written once before and is written once now, in a home the account service can import (its graph
  stops at the leaf; `guilds.js`'s reaches the skills and the prefs).
- **The law.** `src/net/npcChapterLaw.js`: the twenty-two (`ROLL_FACTIONS`), the day's ceiling and its credit
  (`rollCredit` - a loss whole, a gain under 15 a faction a UTC day, the day counting what moved), the seed and its
  cap by age (`rollSeedCapOf`, `rollSeedOf`), the shapes, the adoption (`rollAdopt` - the service's number plus
  whatever moved while the claim was out) and the memberships off both books (`rollMembersOf`). AUDIT CHAP moved the
  credit to a pace with what it leaves owed (`rollDrain`), the cap to a customs crossing's and a member's rank's need,
  and the adoption to the factions the client holds; it added `rollRankCapOf` and `rollKeptOf`.
- **The service.** `server-account/src/npcRoll.js` over migration `0091_npc_roll`: `POST /v1/chapters/roll` reads the
  Roll, seeding it the first time from the save's standing (twenty-two rows and a head, one batch, each INSERT OR
  IGNORE); `POST /v1/chapters/claim` credits what moved, in one batch whose first statement moves the head's `seq` on
  and whose every other write stands only at that `seq` under the claim's id - a lost race writes nothing and says
  `roll-busy`, a claim already taken is answered `repeat`. Every act names a realm character of the session's account,
  standing, under the playing tab's lease. A realm character's delete takes its head, rows and record. Behind
  `CHAPTERS_OPEN` (`server-account/wrangler.toml`), shipped `dev`: the developers' characters first, everyone else's
  standing still the save's until the line says `on`. The service is `acct93`; deploy it before the site. No relay
  change. AUDIT CHAP: a write's guard is a tag of its own, not the next `seq` (a claim's twin wrote its lines twice);
  the lease and the death are asked inside the write; a repeat is any id the record holds; a claim that changes nothing
  writes nothing; a character with no landed save has no Roll (`no-data`), and an undone customs takes its Roll.
- **The playing tab.** `src/net/npcRollTracker.js`, built in `scenes/world.js` online for a realm character alone and
  ticked in the online frame beside Renown's: the first read carries the seed and adopts the answer over the save's
  standing (`setReputation`, DFU's own door); then what moved is claimed at most once a minute, a claim the network lost
  is sent again as it was, a shut Roll or a lost lease ends the asking, and the page's going sends the last claim by
  `keepalive` - AUDIT CHAP C1/T1: it never did (the realm session gives its lease up first, and the service clears it);
  the kept adoption replaced it (3.2). A gain the day's ceiling cut is said: "Your standing with the Mages Guild can rise
  no further today." - AUDIT CHAP D2: now "... rises no further today. The rest will follow in the days to come."
  `systems/realmSaves.js` gained one read-only getter, the session's lease.
- **Pins.** `test/chap1_roll.test.js`, 19 tests: the twenty-two and the leaf as the one home; the credit, the seed and
  the shapes against literals; the service over the real migrations - the switch at off, dev and on, the seed's cap
  either side of the epoch, a second seed ignored (AUDIT CHAP R11: this said refused), the day's bound and its rollover, the record line by line, a repeat,
  a lost race, the tenure, the lease, a stranger, a tombstone, the delete; the tab against a fake door - the seed, the
  minute, the cut said, a lost claim sent again unchanged, a shut Roll, a membership claimed alone, the page's last
  claim; and the wiring. `tools/mutants/chap1.json`: 26 mutants, 26 dead - one (CHAP1-TAB-RESEND) survived the first
  run, because the pin compared the last call with itself when no new call had been made, and the pin now counts the
  calls. Sixteen tests that pin the service's version moved to `acct93` with it.

## AUDIT CHAP - CHAP0 and CHAP1 read again (2026-10-07, Mac: "Lets do a deep audit on everything so far before we continue")

Five lenses - the service, the playing tab, Daggerfall's law, the record and the pins - read the tree at `1100fec1`;
`01-Overview/Audit-Chapters.md` holds every finding and its fix. Its marks on this page are AUDIT CHAP <ID>. The Roll as
it now stands: a pace with what it leaves owed, a cap that is a customs crossing's and keeps a member's rank, the kept
adoption in the save in place of a claim as the page goes, a write that stands under its own tag with the lease asked
inside it, a rank bounded by the Roll's reputation. `test/audit_chap1.test.js` (22) pins every fix, and
`tools/mutants/audit_chap1.json` (49) mutates it; `tools/mutants/chap1.json` holds 25 (eleven re-aimed by content, the
page-leave one retired with the code it held). One narrowing of Mac's Authority call, which he confirmed (R1, at the
head of the page: "Approved").

## CHAP2a - the halls and their writs, as built (2026-10-07, Mac: "Do it")

The second slice's delivery half; section 4 carries the law and every narrowing (BUILT, CHAP2a).

- **The law.** `src/net/npcChapterLaw.js`: the hall report and its canonical text (`hallReportOf`, `hallReportText`,
  `parseHallReport` - one answer a town, so witnesses agree byte for byte), the hidden two (`hallHidden`), a chapter's
  writs (`hallWritCount`,
  `hallFamiliesOf`, `hallWrits` over `nodeLaw.js` `courtWrits`, whose dice became an argument), their ids, the +2, the
  join's floor (`joinRecordable`) and a chapter's name on its writs (`hallPosterName` - DFU's captions, a temple by its
  divine's whole name).
- **The service.** `server-account/src/npcHalls.js`: `POST /v1/chapters/witness` (a registered account's report, under
  the Chapters' switch and its own hour) and `regionChapters` (every guild a confirmed town of the region names, each
  town read over all its reports, kept by the isolate a minute). `professions.js`: the day's hall writs written down
  beside the Court's (`hall_writ_days`), listed to an account the Chapters are open to (a hidden guild's to its
  members on the Roll), delivered as a Court writ is
  with the Roll's +2 in the same batch. `npcRoll.js`: the join's floor. Migration `0092_npc_halls` rebuilds
  `world_witness` (the kind) and `writs` (the kind and the faction). The service is `acct94`; deploy it before the
  site.
- **The client.** `src/net/npcHallBook.js` (a town's halls off `buildingSummaries`' rows, reported once a day a town),
  built in `scenes/world.js` online and asked at the town's entry edge off the guild-hall reveal's own buildings;
  `ui/noticeWindow.js` (a hall writ's card under the guild's seal: "Wanted: 30 Oak Logs, for the Fighters Guild in
  Anticlere", paying "... and standing with the Fighters Guild"); `world.js` `profWritTaken` ("The Fighters Guild will
  remember it.") and the tracker's `refresh`.
- **Pins.** `test/chap2_halls.test.js`, 16 tests: the law against literals; a town's halls off a fake faction file
  (a hall by its group, a temple through its templar order, the hidden two by their own faction, a commoner's door and
  a shop never, none before the file); the hall book's day and its stops; the service over the real migrations - a
  guest, the switch at the route and in the module, the age, the first answer, the hour; a region's chapters
  (confirmation, a split, a town confirmed elsewhere, the minute's keep); the board's hall writs at dev, the hidden
  two's to their members alone; a delivery's
  pay, its +2, the head, the cap and the owed, the shared three; the join; the tab's refresh; and the wiring.
  `tools/mutants/chap2.json`: 39 mutants, 39 dead - four (a chapter's own dice, the module's switch, the region a town
  is confirmed for, a standing read as a membership) survived their first run, and each has its pin. Three older
  records (`board_ui.json`, `chap1.json`, `prof6.json`) re-aimed by content at the lines this slice moved; the
  `writ-cap` sentence names the writs, not the Court's (`test/prof1_client.test.js`, PIN MOVED); the reveal's call at
  the entry edge carries the witness (`test/audit63_guilds_court.test.js`, `test/hub1.test.js`, PIN MOVED). AUDIT CHAP2
  R13: and two version records (`gatekeys.json`, `fb1004d_knight_house.json`) and seventeen version pins moved to
  `acct94`, and `test/accountworker.test.js`'s tables gained `hall_writ_days`.

## AUDIT CHAP2 - everything so far read again (2026-10-08, Mac: "Lets do a deep comprehensive audit on everything so far")

Six lenses - the service, the client, Daggerfall's law, the economy and its abuse, the record and the pins - read the
tree at `915043c5`; `01-Overview/Audit-Chapters-2.md` holds every finding and its fix, and its marks on this page are
AUDIT CHAP2 <ID>. What moved, in a line each: the kept adoption names the CLAIM sequence, so a hall writ's +2 no longer
makes the next page drop the save's unclaimed moves (C1); the tab compares the book it sent, so a rank the Roll bounds
is claimed once (C2 = D1), and a lease refused ends the asking for that lease alone (C4); the service bounds the claims'
hour itself (E2) and the memberships to what DFU's two books hold (E3); the halls have the seats' moderation - ignored
liars, the audit list, a developer's strike - and a versioned key (E1, E7); the join records the underworld two at any
standing and counts what is owed (D2, S7); a crossing member keeps its rank's band (D3); a hall writ never takes the
Court's top slot (E5); a board read in a region with no chapter reads no ground (S1); a hidden guild's writ is the same
`no-writ` to every stranger (S2); offline, a hidden guild's halls are revealed for a membership in either book, as DFU
reveals them (D4). Two questions were Mac's: a rank-8 or rank-9 crossing's 80 or 90 (3.6, E6) and CHAP3's Merit writs
(section 4, E4) - DECIDED as the record recommended (Mac: "You can decide whatever is best"): a rank-8/9 crossing keeps
79, and CHAP3's Merit writs are each member's own. `test/audit_chap2.test.js` (34) pins every fix and the pins lens's gaps; `tools/mutants/audit_chap2.json`
mutates it.

## CHAP2b - the receipts' standing and the receipt writs, as built (2026-10-08, Mac: "Keep going with the arc/slices")

The second slice's receipt half; section 4 carries the law and its calls (BUILT, CHAP2b).

- **The law.** `src/net/npcChapterLaw.js`: the kinds (`RECEIPT_KINDS`), a guild's asks (`hallReceiptKindsOf`), a
  receipt's own and its writ's ids (`receiptRef`, `receiptWritRef`), what one receipt credits (`receiptCreditsOf`) and
  the line it says (`hallRememberLine`).
- **The service.** `server-account/src/npcReceipts.js` over migration `0093_npc_receipts`: `creditReceipt`, run by the
  gate and raid claim routes after the receipt's own row (`server-account/src/index.js`), and `receiptAsks`, the board's
  asks beside its writs (`professions.js` listWrits). A realm character's delete and an undone customs take its lines.
  Still `acct94` - nothing of the arc has shipped.
- **The client.** `src/ui/noticeWindow.js` (an ask's card, no Take); `src/scenes/world.js` (the gate and raid carriers
  hand a credited answer to the tab's refresh and say the guilds' memory).
- **Pins.** `test/chap2b_receipts.test.js`, 12 tests: the law against literals; a gate and raids through the real
  routes over the real migrations (the credit, the head and the claim sequence, a repeat, the writ once a day, a raid's
  region, a region with no chapter); nothing for a non-member, no chapter, the switch shut or a gate with no region;
  the bounds (100 and the owed, another account's character, a dead one, a receipt credited once, a store that throws);
  a lost race; the board's asks (the rows, a member's state, the hidden two, the switch); the delete; the card in a DOM;
  the wiring. `tools/mutants/chap2b.json`: 29 mutants, 28 dead, 1 equivalent as recorded. The host's gate and raid
  carriers' wiring pins moved (`test/auditonline2.test.js`, `test/raid4_rewards.test.js`, `test/wb5b_gate_claim.test.js`,
  PIN MOVED); their mutant lists hold, 70 dead. The full suite: 22977 tests, 0 failing once they moved.

## CHAP3a - a member's own writ and the week's Merit, as built (2026-10-08, Mac: "Keep going with the arc/slices")

The third slice's first half; section 5.1 carries the law and what building it narrowed (BUILT, CHAP3a).

- **The law.** `src/net/npcChapterLaw.js`: Merit's numbers (`MERIT_WRIT`, `MERIT_RECEIPT`, `MERIT_TENURE_S`,
  `MERIT_CAP_WEEK`, `MERIT_SOURCES`), its week (`meritWeekOf`), a writ's own share (`meritOfWrit`), a member's own writ
  (`memberWrit`, `memberWritId`), a chapter's writ (`isChapterWrit`) and the board's line (`meritLineOf`).
- **The service.** `server-account/src/npcMerit.js` over migration `0094_npc_merit` (and 0092's writs rebuild, grown in
  place - nothing of it shipped - by the kind `member` and its `owner`): `meritStatement`, the Merit line with its every
  bound, in the act's own batch; `meritOfAct`, an act's lines; `meritAsks`, the board's. `professions.js` posts, lists
  and delivers a member's own writ (postMemberWrits, listWrits, deliverWrit); `npcReceipts.js` creditReceipt adds a
  receipt's Merit and answers it. Still `acct94` - nothing of the arc has shipped.
- **The client.** `src/ui/noticeWindow.js` (a member's own card - "Your writ" - and the Merit lines under the day's
  count); `src/scenes/world.js` (a member's own writ refreshes the Roll as a hall writ does, and says its Merit).
- **Pins.** `test/chap3a_merit.test.js`, 13 tests: the law against literals (the numbers, the week, the share, the
  draw and its dice, the line); the board's own writ through the real routes over the real migrations (one a guild with
  a chapter, written once, its owner's alone - another account's reader, the account's other character and a second
  member of it each see their own or none - gone once no member, the switch shut before and after it was posted); a
  delivery (its pay, the +2, the Merit and its repeat, the three a day, the board's line); bought units; the owner and
  the tenure; a receipt's Merit; the week's bounds through a receipt (the cap across an account's characters, the
  week's chapter, last week's no bar); the Merit line's every clause against the real schema; the card in a DOM; the
  wiring. `tools/mutants/chap3a.json`: 73 mutants. CHAP2a's and CHAP2b's pins the member's own writ moved (the host's
  refresh, the board's poster, a receipt's answer, the table list - PIN MOVED); AUDIT CHAP2's `T-MIG-WRITS-UNIQUE`
  re-aimed at the key with its owner.

## CHAP3b - Strength and the chapter sheet, as built (2026-10-08, Mac: "Continue")

The third slice's second half; sections 5.2 and 5.3 carry the law and what building it narrowed (BUILT, CHAP3b).

- **The law.** `src/net/npcChapterLaw.js`: Strength's numbers (`STRENGTH_START`, `STRENGTH_MIN`, `STRENGTH_MAX`,
  `STRENGTH_STEP_MAX`, `STRENGTH_IDLE`, `STRENGTH_TARGET`), a week's target and step (`strengthTarget`, `strengthAfter`),
  a Season's end (`strengthSeasonEnd`), the bands (`CHAPTER_BANDS`, `chapterBandOf`), a chapter's writs by its band
  (`hallWritCountIn`) and the board's line (`chapterLineOf`).
- **The service.** `server-account/src/npcChapters.js` over migration `0095_npc_chapters`: every region's chapters in one
  read (`allChapters`), a week's Turning (`settleChapterWeek` - one batch, the week's key first, every chapter in one
  statement over a bound JSON array), the Turnings due (`settleChaptersDue`), a region's Strengths (`regionStrengths`)
  and the sheet (`chapterSheet`, `/v1/chapters/list` in `server-account/src/index.js`). `professions.js` settles before a
  region's hall writs and a board read, posts a chapter's writs by its band, and answers the region's chapter lines.
  Still `acct95` - nothing of the arc has shipped.
- **The client.** `src/net/accountClient.js` (`accountRoll.list`); `src/ui/noticeWindow.js` (the chapters' lines under
  the Merit lines).
- **Pins.** `test/chap3b_strength.test.js`, 11 tests: the law against literals (the numbers, the step, the cap, the idle
  week, the bounds, a Season's end, the bands, the writs by band, the line); every region's chapters at once (an
  unconfirmed town, a town confirmed for another region, the isolate's minute); a week settled (the week's Merit alone, a
  chapter with Merit and no town, the key - never twice - and the next week from the last); the week's scale (the accounts
  that played, never a guest, the window); the Turnings due (the first, the order, the eight, a week that fails stopping
  the count); a Season's end; the sheet through its route (the settle, the hidden two left off, a chapter no Turning has
  settled, the switch at the route and in the module); the board (the writs by band, the lines, the hidden rule, a Turning
  passed after the day's writs, the writs by band for a reader the switch keeps out); the wiring.
  `tools/mutants/chap3b.json`: 58 mutants, 58 dead. AUDIT CHAP2's `T-POST-COUNT-ACTIVE` and CHAP2a's `CHAP2-WRIT-SCALE`
  re-aimed at the writs' count by band and the hall writs' scale (`strengthTarget` repeats its text), both dead.

## CHAP3c - the bands on the halls, as built (2026-10-08, Mac: "Continue")

The third slice's last part; section 5.2 carries the law and what building it narrowed (BUILT, CHAP3c). CHAP3 stands
whole: the week's Merit, the Turning's Strength, its band on the writs and the halls, the sheet.

- **The law.** `src/net/npcChapterLaw.js`: the bands' shelf step (`CHAPTER_BANDS`' `shelf`), a hall's price factor and a
  price laid over (`chapterPriceFactor`, `chapterPriced`), a shelf's quality (`chapterShelfQuality`, `HALL_QUALITY_MIN`,
  `HALL_QUALITY_MAX`).
- **The client.** `src/net/chapterSheet.js` (the sheet the playing tab holds); `src/scenes/world.js` (built online over
  the halls' door, asked at a town's entry, handed to the interiors as `chapterStrength`); `src/scenes/worldModes.js`
  (the hall's chapter read off its guild and building, its factor to training, the spellbook and the spellmaker, its
  quality to the three shelves); `src/systems/guildServiceActions.js` and `src/ui/guildServiceWindows.js` (training's
  offer and gold check by a factor, DFU's own at 1); `src/ui/spellbookWindow.js` and `src/ui/spellMakerWindow.js` (the
  trade price and the gold cost by a factor). No service change; still `acct95`.
- **Pins.** `test/chap3c_halls.test.js`, 9 tests: the law against literals (the factor by band and unknown, a price laid
  over and its rounding, the shelf's quality, its bounds, DFU's potion count read through it); the sheet over a fake door
  (nothing before its read, one read at a time, the beat, a failed read keeping the last, a door that throws, the stops,
  a row naming no guild); training's offer and gold check, DFU's chain and RefinedTraining's; a spell bought; a spell
  made (its gold, never its spell points); the hosts' wiring. `tools/mutants/chap3c.json`: 36 mutants, 35 dead, 1
  equivalent as recorded. TIME1's census row for the soul gems' shelf moved with its line (`test/fixtures/time1_census.json`), and GUILD-SHELF's
`GUILD-SHELF-potions-mint-a-throwaway` was re-aimed at the potions' line (dead).

## AUDIT CHAP3 - everything so far read again (2026-10-08, Mac: "Let's audit everything we have so far before we continue")

Six lenses read CHAP0 to CHAP3c and both merges of main (`01-Overview/Audit-Chapters-3.md` is the record, every finding
and its fix). What it changed here: law 7 and section 10 (the Chapters' own Turning); section 3.3's rows (a receipt writ
outside the 3, a raid's real pace, the record's replay); section 4's pay (Merit of a member's own writ alone); 5.1 (one
member writ a guild a day, a gate's Merit where its day's claims agree, a gate of another week none); 5.2 (the grace,
the switch, the developers' weeks forgotten, what a band reaches, the price shown the price charged, more items never
better, what the numbers allow); 5.3 (a stopped sheet forgets); section 11 (`npc_chapters`, `npc_chapter_weeks.open`,
`npc_hall_regions`, the law modules); section 13 (the sheet's hosts); Appendix A (the grace, the gate wait, the hall
book's key and bound).

- **The service.** `npcHalls.js`: a region's chapters computed once a change (`npc_hall_regions`, `allRegionChapters`),
  the strike asked inside a witness's write. `npcChapters.js`: the grace, the switch and its column, the agreed gate
  region at the Turning. `professions.js`: hall writs only while the Chapters are open, in one statement and their own
  batch; a member's own writ once a guild a day. `npcReceipts.js`: a gate of another week refused; a character's guilds in
  order. Migrations `0092`-`0095` grown in place (nothing shipped): `npc_hall_regions`, two indexes, the `open` column.
- **The client.** `world.js`: a kept gate claim waits for the scan (90 s at most); a raid's line on its fighter's page;
  a late writ said in the chat; a stale build's Roll stop said; the hall's chapter by the politic region. `worldModes.js`:
  a window's factor read once. `chapterSheet.js`: a stop forgets. `noticeWindow.js`: a refused Take reads the list again,
  a member's own writ promises Merit only where it can earn. `npcChapterLaw.js`: a receipt's Merit in its line; the
  shelf's quality untouched where the band moves nothing.
- **E4 DECIDED** (Mac: "Your decision", after the audit): `npcChapterLaw.js` `STRENGTH_SHORT` in `strengthAfter` (a
  week short of its target, above 50, three back toward 50) and `meritOfReceipt` (a receipt's 50 shared among its
  chapters), read by `npcReceipts.js` creditReceipt. CHAP3a's receipt pin moved (25 each, PIN MOVED).
- **Pins.** `test/audit_chap3.test.js`, 18 tests, one a finding or a group; `tools/mutants/audit_chap3.json`, 45 mutants:
  40 dead, 5 equivalent as recorded. Thirty older records re-aimed at the code the fixes moved, all dead - two of them
  (AUDIT CHAP2's `T-LAW-ADOPT-BASE-HAS`, CHAP3c's `CHAP3C-SHEET-BUSY`) no longer equivalent, killed by new pins. The
  pins the fixes moved say PIN MOVED.
