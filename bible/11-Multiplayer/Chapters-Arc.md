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
the foot). CHAP4a BUILT (2026-10-08, Mac: "Your decision", on "Whats next"; the seats placed at the Turning, the book's
rank stopped at 7 - sections 3.5 and 6, its record at the foot); CHAP4b BUILT (2026-10-08, the same word; the book
held at 7 online, a seat's rank at its chapter's halls, the seats said - the same sections, its record at the foot);
CHAP4c BUILT (2026-10-08, Mac: "Your call"; the seats' titles on the token, behind `CHAPTER_TITLES`, the relay's
`world182` first - section 6, its record at the foot); CHAP4d BUILT (2026-10-09, Mac: "Continue"; the Master's Focus on
its chapter's hall writs, the Chronicle read in the Hall of Records - section 6, its record at the foot). CHAP5a BUILT
(2026-10-09, the same word; the sheet carries the seats' holders, and each hall's shelf names them - sections 5.3 and 9,
its record at the foot). CHAP5b BUILT (2026-10-09, the same word; the hall's people and the town's talk by the band -
section 9, its record at the foot). AUDIT CHAP4 (2026-10-09, Mac: "Lets do a deep audit on everything so far") read
all of it again through six lenses and fixed what they found (`01-Overview/Audit-Chapters-4.md`, its record at the
foot); CHAP6a BUILT (2026-10-09, Mac: "continue"; the Season's event drawn, a Decline's weeks, the Season's end - section
7, its record at the foot); CHAP6b BUILT (2026-10-09, the same word; the Schism's backing and doctrine, the
Succession's heir, the Master's vote - section 7, its record at the foot); CHAP6c BUILT (2026-10-09, the same word;
the Season's words and a member's choices on the client - sections 7 and 9, its record at the foot); CHAP6d BUILT
(2026-10-09, the same word; the Season on the halls - an Ascendancy's prices, the doctrines' training and shelf, the shut
halls - sections 7 and 9, its record at the foot); CHAP6e BUILT (2026-10-09, the same word; the Season's two titles - a
High Master in an Ascendancy, a Season's Master for good - sections 6 and 7, its record at the foot); CHAP7a BUILT
(2026-10-09, the same word; the patrons on the service - a guild's sealed bid in escrow, the Season's opening Turning
burning the highest and sending the rest home, the patron on the sheet, the board and in the Chronicle - section 8, its
record at the foot); CHAP7b BUILT (2026-10-09, the same word; the patrons on the client - the board's bid, the banners at
the chapter's halls, the members' Thriving prices - section 8, its record at the foot). The arc's seven slices stand. Merged with main
past the Super Dungeons arc, then past SCALE4 and TAVERN CARDS (2026-10-08), then past SERVER-POST and HOURS-FIRST
(2026-10-09), then past PERMADEATH-HOUSES and TAVERN-TABLES, then past TV-BEYOND (2026-10-09): the arc's migrations are `0095_npc_roll` to `0100_npc_seats`, its service `acct99` and its relay `world182` - the records below name each
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

BUILT (CHAP4a, the service's half): the Roll records no rank past 7 (`ROLL_BOOK_RANK_MAX`, `rollBookRankOf` - a seed's,
a claim's, and a claim with no book's, AUDIT CHAP2 E8's path), so a rank 8 or 9 the book reports is recorded 7, and a
character's seats ride the Roll's answer beside its memberships (`seats: [{ f, region, seat, since }]`). The book itself
is the client's, and CHAP4b holds it at 7 while the Roll does.

BUILT (CHAP4b, the client's half): online, while the Roll holds (the tab's `held`, not `stopped`), the book's own rank
stops at 7 twice over - every adoption of the Roll's word sets a row above 7 to 7, in both books
(`rollBookCap`, through the tab's `cap` door; said once a hold: "The Fighters Guild keeps ranks 8 and 9 as its
chapters' seats, won by Merit - your rank there is 7."), and DFU's own review (`updateRank`) takes the host's ceiling
(`ctx.rankCeiling`, the hall popup's push effects): a member DFU would make 8 or 9 is promoted to 7, one at 7 stays
unmoved and unannounced, and the review never demotes for it - so DFU's demotion record is never shown for a seat's rule.
Offline the ceiling is none and every review is DFU's whole. AUDIT CHAP4 C3: the ceiling holds from the page's first
frame - before the Roll's first word DFU's review promoted to 8 and 9, then the word took them back.

AUDIT CHAP4 (D2, E2), RECORDED: what DFU GIVES ONCE at rank 8 or 9 and the character keeps is not given online - a seat
is held, not a rank earned for good. A knightly order's rank-8 and rank-9 armour and its rank-9 house read the BOOK's
rank (`worldModes.js` openServiceFlow's `kept`; E2: one week as a chapter's Master was a house held for good, and a ring
passing the seat round housed every one of it); the promotion's own texts and gifts (the Thieves Guild's map at 8, the
Dark Brotherhood's location at each promotion, the Mages Guild's 8, an order's and a temple's 9) come with DFU's review,
which online stops at 7. A seat's SERVICES are its while it is held (the teleport, the summoning, the repair's scale,
the quests). AUDIT CHAP4 D3: a seat's TITLE is the one its chapter's halls say - the popup and its counter read the
seated book, as the hall's services and quests do; the character sheet's affiliations name the book's rank.

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
  Brotherhood's herbs, the orders' metals and wood, the Thieves' all four - the port's own choice, AUDIT CHAP4 D5: no
  DFU guild trades in materials, and DFU's Mages Guild and two of its temples sell no potions), the whole table where the
  region yields none of them; each chapter's own dice (`gateHash` under `HALL_WRIT_SALT`, keyed by its faction), never the Court's -
  chapters drawing from one table (the temples' herbs) can still post the same writ on a day (AUDIT CHAP2 R2: this said
  no two chapters could). AUDIT CHAP2 E5: a chapter's writs are the Court's law's slots AFTER its first, which is the
  table's top tier - two a chapter had made every other hall writ that one, a quarter richer than a Court writ. A writ's
  id is `h:day:region:faction:slot`; it rides the Court's `writs` table (kind `hall`, its `faction`) and its day's
  posting is `hall_writ_days` (migration `0096_npc_halls`). Receipt writs (a gate, a raid, the serpent, a camp) and the
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
  `0097_npc_receipts`: a receipt's `gate:<day>` or `raid:<key>`, a member's day's writ `wgate:<day>`, `wraid:<day>`), so
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
- **Still drawn**: `standings`, a chapter's whole Merit (the sheet carries no Merit; the Turning sums `npc_chapter_merit`
  itself - AUDIT CHAP3 R11 - and CHAP4a's seats sum it themselves, AUDIT CHAP4 R7), its reader not yet named.
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
  realm of a thousand needs ten. AUDIT CHAP4 E4, DECIDED (at Mac's standing word): registered accounts that only play
  raise the target realm-wide - a ring of them pulls every chapter's step down, its own too; the count stays the
  realm's own measure of who plays, the one the hall writs and the Court's scale read, rather than a second, witnessed
  count the Chapters alone would keep. A ring that large costs its accounts' registrations and moves every chapter
  alike, its own with them.
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
  `KnightlyOrder.CanAccessService`: quests, armor, a house) - their band is felt in their writs alone (and, CHAP5b, in
  their halls' evenings and their towns' talk), until CHAP6 gives an order's hall a band of its own (AUDIT CHAP4 R7). AUDIT CHAP3 D4: RefinedTraining's five-day package moves by less than
  the factor - its own per-session upkeep (RR's `(cost + level x 8 + 72) x 5`) is RR's, unbanded.
- **The price shown is the price charged** (AUDIT CHAP3 C1): each window reads the hall's factor once as it opens -
  training's flow, the spellbook and the spellmaker alike - and the hall's chapter is read in the politic map's region
  the chapters are keyed by (C6). The rounding is the law's one `chapterPriced` (R12); training's service law keeps its
  own copy, as DFU's service law reads no network module.
- **Where no Strength is known the hall is DFU's own**: offline (no sheet), and for a chapter the sheet does not name -
  the Thieves Guild's and the Dark Brotherhood's (5.3), and a hall whose town is not yet confirmed. NARROWED: the
  underworld's halls take no band until a sheet can be read by their members alone (CHAP5 read the sheet again for its
  seats and band and left this open - AUDIT CHAP4 R7: still open).

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
(AUDIT CHAP3 C2); its readers ask it synchronously and are answered as it last stood. BUILT (CHAP5a): each chapter's
`seats` - `[{ seat, name }]`, its Master first, then its officers by their tenure, each by the name its character carries
now - and the tab keeps them as the roll reads them (`chapterOf`). BUILT (CHAP6a-6c): its Season - `event`, a Rivalry's
public `rival`, `shut`, the `doctrine` holding, a Schism's `sides`, a Succession's `heir` and the `season` their
candidates are named on - kept as `chapterSeasonOf` reads it (each field checked). NARROWED: the event's STANDING (a
Schism's sides' Merit, a race's lead) is not published - the sheet says what the Season is, not who leads it.

## 6. The seats - ranks 8 and 9 (CHAP4)

DECIDED (Mac): limited, contested seats; the shape below is the record's.

- **Per chapter** (CALL 4): one **Master** (rank 9) and three **officers** (rank 8). A seat no Eligible member has
  Merit for stands **vacant** - it is never filled from below.
- **Who may hold one**: an Eligible member (3.5) with **14 days** in the guild on the Roll, whose account is at least
  7 days old.
- **How it is held**: at each Turning, the seats go to the Eligible members with the most Merit at that chapter over
  the **last four weeks**; a sitting holder's Merit counted x 1.2 until **AUDIT CHAP4 E1 (decided at Mac's standing
  word, his to overrule): a sitting holder keeps an EQUAL standing**, never a larger one. The x1.2 (the 1.2 a seat's holder
  carries after a held siege, Seats-Arc 5.2 step 3) met the week's cap: no challenger shows more than 4 x 600 Merit, so
  a holder earning 2000 of 2400 could not be out-earned at all, and a ring at five-sixths of the cap kept every seat.
  Ties break by the sitting holder, then the longer tenure, then the lower character id.
- **Limits**: one seat an account a guild (an account's alts cannot hold two seats of one guild); one Master's seat a
  character.
- **What a seat gives**: the rank and its title, signed on the token as a derived title (`server-account/src/titles.js`'s
  way); the rank's DFU services at every hall of the chapter; the Master chooses the chapter's weekly **Focus** (which
  of its writ kinds it posts more of) and casts the chapter's vote in its Season's event (7).
- **Losing a seat**: the holder returns to rank 7, Eligible, and keeps "Former Master of the <Region> Chapter" for the
  rest of the Season.
- **The Chronicle**: every change of seat is a history row, read by the Hall of Records as the seats' are.

BUILT (CHAP4a, 2026-10-08), and where building it asked, narrowed here:

- **Placed at the Chapters' own Turning** (`server-account/src/npcChapters.js` settleChapterWeek, in its one batch after
  the week's key): every chapter's seats placed again from the Merit of the four weeks to the week it settles
  (`SEAT_MERIT_WEEKS`), a gate's only where its day's claims agree (AUDIT CHAP3 E1's law) - and, once the Chapters are
  everyone's, none of a week settled while they were the developers' alone, nor the seats those weeks placed (S2's law).
- **Eligible at the Turning** (`seatEligibleAt`, at the week's end, never at the read that settles it): a member on the
  Roll, its reputation there at 80, `joined_at` fourteen days before the Turning, its account (`players.registered_at`)
  seven, its character standing (a dead one sits nowhere). The reputation and the membership are the Roll's as the read
  finds them.
- **The order** (`chapterSeatPlan`, pure): standing in whole tenths of Merit (`seatScoreOf`); at an equal standing the
  sitting holder at THIS chapter first (AUDIT CHAP4 E1: its x 1.2 carry, `SEAT_HOLDER_CARRY`, gone); then the longer
  tenure, then the lower character id. Every chapter's Master's seat first, realm-wide, then its officers: so a character the
  Master of one chapter may sit as another guild's officer, never two Masters; an account's characters hold one seat a
  guild between them, in every region (an alt in the Master's chapter sits nowhere).
- **The seats' table** (`npc_chapter_seats`, migration `0100_npc_seats`) is written whole again each Turning; a seat
  keeps its `since` - the week its character first sat at the chapter without a break, through a move between Master and
  officer. A character deleted takes its seats with it (`realm.js` deleteRealm, undoCustoms); one that dies keeps its
  seat until the next Turning places it nowhere.
- **The Chronicle** (`npc_chapter_history`): a row of kind `seat` for each character whose seat moved, `{ from, to }`
  (null for none) - a week that moved no seat writes none; kept when the character is deleted. Its reader - the Hall of
  Records - CHAP4d's, BUILT below.
- **Hidden guilds** are placed as any chapter is; nothing of their seats is public (the sheet and the board name none).
- **AUDIT CHAP4** (the seats read again): D1 - an ACTIVE membership alone is Eligible (and earns Merit, a member writ,
  a receipt's standing): a line the character's active book does not hold - a vampire's mortal guilds - is claimed
  dormant (`rollMembersOf`'s `d`, `npc_roll.dormant`), as AUDIT CHAP D6 promised CHAP4 would ask; E3 - seats only at a
  chapter confirmed now (a struck chapter's holders sit nowhere, and titles nobody); S2 - the weeks the Chapters are
  shut ('off') are recorded and move nothing, and the four weeks are the last four the Chapters were open; S5 - a
  character deleted while its Turning was in flight is never seated again; S4 - the Focus is the Master's whom LAST
  week's Turning placed, after the Turnings due.
- **Still to build**: the titles on the token and "Former Master" (CHAP4c - a new title id and claim reach the relay
  first, Seats-Arc 7.4, worded without gender) - BUILT, below; the Focus and the Chronicle's reader (CHAP4d) - BUILT,
  below; the Master's vote in its Season's event (CHAP6) - BUILT (CHAP6b, section 7: a Schism's tie, a Succession's
  heir).

BUILT (CHAP4d, 2026-10-09, Mac: "Continue"), the Focus and the Chronicle's reader:

- **The Focus, NARROWED** from "which of its writ kinds it posts more of": a chapter posts one kind - hall writs, drawn
  from its guild's material families (CHAP2a) - so the Master chooses one of those FAMILIES (`chapterFocusesOf`: its
  guild's own, where it has more than one to choose - the Fighters metals or wood, the Mages herbs or metals; a guild of
  one family, a temple or the Brotherhood, has no Focus). It holds for the seats' week it was chosen in
  (`npc_chapters.focus`, `focus_week`) and lapses at the Turning; chosen again, it replaces the week's.
- **What it moves** (`npcChapterLaw.js` hallWrits): every other hall writ, from the first, is drawn from the Focus's
  family alone, by the same slot's dice - the rest exactly as they were; a Focus not the guild's, or one the region's
  table yields none of, moves nothing. The day's writs are posted once, so a Focus set after a day's post moves the next
  day's.
- **Set on the Notice Board** (`/v1/chapters/focus`, `setChapterFocus`): the Work tab says each chapter's Focus under its
  line ("The Fighters Guild's Master asks for metals this week.") and offers its Master - the character the board is
  read for, a standing character of the account - the families, the one held marked. One write, the seat asked inside
  it: an officer, another account's character, a dead Master are refused ('not-master'), a family not its guild's
  ('no-focus').
- **The Chronicle's reader** (`/v1/chapters/history`, `chapterChronicle`): a palace's Hall of Records reads, after the
  seat's own Chronicle, "The Chapters of <Region>" - its region's newest sixty seat changes, oldest first, each a
  sentence worded without gender ("In the third week of the Season of Morning Star, Alda took the Master's seat of the
  Fighters Guild.": took, rose to, gave up and kept an officer's, lost), a character gone since "A member since gone";
  never a hidden guild's. Read only where the Roll holds (online, the Chapters open to the account); a refusal leaves the
  seat's book as it was.

BUILT (CHAP4c, 2026-10-08, Mac: "Your call"), the seats' titles:

- **Three generic ids** on the token (`net/identityToken.js` CHAPTER_TITLES, the closed list's last): `chaptermaster`,
  `chapterofficer`, `formermaster` - each with the seats' bounded claim (`ts`, [the chapter's key, the Season]; the key
  its guild faction x 100 + its region, `chapterTitleKey`), refused without it and the claim refused beside any title
  that rides alone (`titleClaimed`). The relay stamps and reads the claim as a seat title's (`net/wire.js` badged,
  readBadge) - a relay change: `world182`, NOT YET DEPLOYED.
- **Worded without gender** (Seats-Arc 7.4) - "Master of the Fighters Guild, Anticlere", "Officer of the Mages Guild,
  Daggerfall", "Former Master of the Knights of the Dragon, Daggerfall" (`chapterTitleText`); NARROWED from the draft's
  "Former Master of the <Region> Chapter": a region keeps a chapter of every guild with a hall there, so the guild is
  named. The guild's own rank titles (Archmage, Patriarch and Matriarch) stay the hall's own window's, where DFU knows
  the character. A hidden guild's seat gives no title (its seats are its members' alone).
- **Derived at the mint** (`server-account/src/npcChapters.js` chapterTitlesOfAccount): an account holds a title while
  one of its standing characters holds that seat, and a Master's seat it lost this Season (the Chronicle's rows from the
  Season's first week - the counted Season, or the eight-week block with none counted) while it does not hold that
  Master's seat again; a token signs it, with its claim, only for a character that holds it.
- **Two more** (CHAP6e, section 7): `highmaster`, signed in a Master's place in its chapter's Ascendancy, and
  `seasonmaster`, a Season's Master's for good - the same claim, the same relay version grown in place.
- **The order of the deploy** (the SHADOW-FANG order): the relay `world182` first - deployed by
  `.github/workflows/relay-deploy.yml` on the merge to main, as the live relay's version differs (it drops every
  connected player; AUDIT CHAP4 R2: this said "by hand") - a token with a title the live relay does not know is refused
  at the hello - then `CHAPTER_TITLES = "on"` (`server-account/wrangler.toml`, shipped `"off"`; `chapterTitlesOpenFor`),
  once that relay is live.

BUILT (CHAP4b, 2026-10-08), the seat on the page:

- **A seat's rank at its own chapter's halls alone** (`seatRankAt`, the host's `chapterSeatRank` - the playing
  character's seat at the hall's guild in the politic region it stands in, as the sheet's): the hall's service gate, its
  services and the temples' free healing read the book SEATED (`seatedBook`: the row reads the seat's rank where its own
  is lower; every other read and every write - a knightly order's gifts, a probation - the row's own). The review, the
  join and the title read the book itself. NARROWED: the "rank's DFU services" are the hall's - a knightly order's
  rank-9 house and its armour, the Mages Guild's teleport, Zenithar's summoning, the hall's quests; what DFU reads off a
  rank anywhere else (Akatosh's travel discount, Kynareth's breath, the arrest rescue, a quest's reward) reads the book's
  7. The one exception: the Mages Guild's paid teleport (Travel Options) is pushed from the hall's own service, so its fee
  reads the seat where the character stands (`magesGuildRank`).
- **The seats said** (`seatLinesOf`, worded without gender - Seats-Arc 7.4): every seat held at the page's first word of
  the Roll ("You hold the Master's seat of the Fighters Guild in Anticlere."), then each seat gained or moved and each
  lost, as the Roll's answers carry them (the tab's `seats`, `onSeats`).

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

BUILT (CHAP6a, 2026-10-09, Mac: "continue"), the roll and the weeks - `src/net/npcChapterLaw.js` (`CHAPTER_EVENTS`,
`CHAPTER_EVENT_EFFECTS`, `CHAPTER_RIVAL_PAIRS`, `chapterEventWeights`, `chapterEventOf`, `declineAfter`, `rivalryEnd`,
`crackdownPay`, `crackdownShuts`, `chapterSeasonLine`), `server-account/src/npcChapters.js` (`seasonEnded`, `seasonDrawn`,
`regionEvents`), migration `0099` grown in place:

- **The draw** is the Turning that opens a Season - the one that settles the week before its first, which ends the
  Season before it in the same batch - for every chapter confirmed then, in every counted Season (Season 0 too, as the
  Tides roll in it); with no Season counted, no event: every chapter is Calm. A chapter confirmed later in a Season, or
  a Season that opened while the Chapters were shut ('off'), draws nothing until the next. Its weights' inputs,
  NARROWED where the table left them open: the band is the chapter's Strength as its last Season ENDED (its last week's
  step, its Decline, its ending resolved - before the halving); "the Master's seat changed hands" counts the Chronicle's
  rows that put a new holder in the Master's seat at the Turnings that placed the last Season's seats; "a rival chapter
  in the region is Thriving" is Thriving or Ascendant (Ascendant is "as Thriving"), read off the strongest rival
  keeping a chapter there - the one a Rivalry races (`chapterRivalPick`, the lower guild at a tie); "the region's seat
  holder's Edict is Curfew" is a seat of the region with the Curfew as law in the week the drawing Turning closes.
- **A Decline** costs its 2 at each of the Season's Turnings, after the week's own step, unless the week's Merit met
  twice its target; what it took is kept in the chapter's state (`fell`).
- **The Season's end**, in order: the week's step (and a Decline's); every Rivalry raced on the whole Season's Merit (a
  gate's where its day's claims agree, as every sum) - the loser gives 10 (never below 0), the winner takes them (never
  past 100), a tie moves neither, a pair that drew each other races once, a rival no longer confirmed races no one; then
  each Crackdown's line (under 30, its halls shut for the next Season - the Season's end whole, the Rivalries' swings
  in it); then the halving; then the next Season's draw.
- **A Crackdown's writs** - the chapter's hall writs and a member's own - pay half again (`crackdownPay`, Marks), inside
  the same three a day (CALL 8: a bounded raise on writs the day already counts, no new faucet). **Shut halls** post
  neither for the Season; what the client shuts with them (the halls' people, their services) is CHAP6c's - BUILT
  (CHAP6d), below.
- **The Chronicle** writes an 'event' row for each chapter whose event was no Calm, with how it ended ("At the end of
  the Season of Morning Star, the Fighters Guild won its rivalry with the Thieves Guild." - a hidden rival is "its rival
  in the shadows": a public line naming the underworld's chapter would say where it keeps its halls), and a 'season'
  row for each Master placed at or before the Turning that opened the Season and sitting still at its end ("Through the
  Season of Morning Star, Alda held the Master's seat of the Fighters Guild." - never Season 0's, which crowns no one, as
  the seats' own); the Hall of Records reads both. The title the 'season' row earns is CHAP6e's (a relay change) -
  BUILT, below.
- **The sheet and the board** carry each chapter's Season's event (`event`), a Rivalry's rival where it is public (a
  hidden rival to its members alone, on the board), and `shut`. The opening week ('on' after 'dev') clears every
  developers' event and shut hall with their Strength.
- **Still to build**: the Schism's backing, the Succession's heir, the doctrine and the Master's vote (CHAP6b) - BUILT,
  below; every event on the client - the board's and the roll's words, the town's talk, an Ascendancy's prices, the shut
  halls, the doctrines' training and shelf, the candidates' names, the titles (CHAP6c) - the words and the names BUILT
  (CHAP6c), the halls (CHAP6d), the titles (CHAP6e) - all BUILT, below.

BUILT (CHAP6b, 2026-10-09, Mac: "continue"), the members' part - `src/net/npcChapterLaw.js` (`CHAPTER_DOCTRINES`,
`CHAPTER_DOCTRINE_EFFECTS`, `schismDoctrinesOf`, `chapterBackOk`, `schismWinner`, `successionHeir`,
`doctrineWritCount`), `server-account/src/npcChapters.js` (`backChapter`, `successionNamed`, the Schism in
`seasonEnded`), migrations `0099` and `0100` grown in place:

- **A Schism's two candidates** each stand for a doctrine - two of the three ("cheaper training, or a deeper shelf, or
  more writs"), the third left out by the event's own roll (`schismDoctrinesOf`, on its own salt), side 0 the first in
  the doctrines' order. **A Succession's candidates** are three of the hall's residents; the service knows them by
  their index (0 to 2), the client names them off the hall's census (9, CHAP6c).
- **The backing** (`POST /v1/chapters/back { character, faction, region, side }`): the account's standing character,
  an ACTIVE member of the guild on its Roll (AUDIT CHAP4 D1's dormant lines refused), backs one side of its chapter's
  Schism or names one candidate of its Succession - one backing an account a chapter a Season (an account's alts are
  one voice), changed until the event is decided; the event and the membership asked inside the write. NARROWED: any
  active member of the guild may back any of its chapters' events; only its Merit at that chapter weighs.
- **The Schism, decided at the Season's end**: each side's weight is its backers' accounts' Merit at the chapter that
  Season (a gate's where its day's claims agree, as every sum); the heavier side wins; at a tie the Master's side - the
  Master's backing is the chapter's VOTE (section 6), the backing of the character in the Master's seat as the Season's
  last Turning finds it; a tie with no Master's backing carries neither, and no doctrine follows. The winner's doctrine
  holds the next Season: one hall writ more a day ("more writs", the service's, BUILT); a further tenth off the hall's
  training and a shelf two qualities deeper (the client's, BUILT CHAP6d).
- **The Succession, named at the Season's third Turning** (the one that closes its third week; a service asleep then
  names at the first Turning after): the Master's naming (the backing of the character in its Master's seat then); else
  - NARROWED, section 7 said "with no Master" - the choice of the backer whose account earned the chapter the most Merit
  that Season so far (the lower account at a tie; a backer with none weighs nothing), so a Master's silence is no veto;
  else the hall's own first. Named once; a backing after its third week is refused (`closed`).
- **The board and the sheet** carry a Schism's two doctrines (`sides`), a Succession's `heir` once named and the
  `doctrine` holding this Season; the board, the reader's own `backed` side. The Chronicle's lines: "the Fighters
  Guild's schism ended, and it holds to more writs for the Season after" (or "with neither side carried"); "the
  Fighters Guild's hall took a new head" (the heir's name is the census's, read in the hall's town). The opening week
  clears a developers' doctrine with the rest.

BUILT (CHAP6c, 2026-10-09, Mac: "continue"), the words and the choices on the client - `src/net/chapterEvents.js`
(`chapterCandidateName`, `chapterSeasonLines`, `chapterBackChoices`, `chapterBackedLine`), `npcChapterLaw.js`
(`chapterSeasonOf`, `chapterDoctrineWords`):

- **The candidates are named by the event's roll**: DFU's FullName on the region's name bank (MapsFile.RegionRaces), on
  a seed the Season, the chapter and the candidate's place make - the census's own `residentName`, so DFU's global
  stream is put back as it stood - the same name for every reader. NARROWED: named, not yet walking the hall's streets.
- **The board** says each chapter's Season under its line - "The chapter is split this Season: Alda Copperham stands
  for cheaper training, Bryn Hearthwing for more writs."; a Succession's three or its heir; a Crackdown, a Rivalry (a
  hidden rival "a rival in the shadows"), a Decline, an Ascendancy; the doctrine holding; shut halls - and offers a member
  of the guild (its Merit line stands on the board) its choices: "Back a side:" or "Name who follows:", the one it backs
  marked; a press backs it through the door, says so ("You back Alda Copperham, for cheaper training."), reads the list
  again, and an answer after the board closed is said in the chat. **The hall's roll** says the Season after its seats.
  **The town** talks of a chapter's Season before its band (9).
- **Still to build**: what the events do to the halls on the client - an Ascendancy's prices, the training's and the
  shelf's doctrines, the shut halls (CHAP6d) - BUILT, below; the titles - a Master's "High" in an Ascendancy, the
  Season's Master's title for good (CHAP6e, a relay change) - BUILT, below.

BUILT (CHAP6d, 2026-10-09, Mac: "continue"), the Season on the halls - `src/net/npcChapterLaw.js` (`chapterHallFactor`,
`chapterHallShelf`, `chapterHallShut`, `CHAPTER_HALL_SHUT_LINE`, `CHAPTER_EVENT_EFFECTS.ascendancyPrice`), the hall's
services window (`src/scenes/worldModes.js`), the host's `chapterHere` (`src/scenes/world.js`), the living world's
`hallGuildDays` (`src/systems/livingWorld/dayPlan.js`):

- **The prices**: the band's factor (5.2, CHAP3c), times 0.9 in an Ascendancy - training, a spell bought and a spell
  made alike, as the table's "the halls' prices" are the band's three - times 0.9 again on TRAINING alone where
  "cheaper training" holds the Season; rounded once, never under 1, as the band's (`chapterPriced`). An Ascendant
  chapter in an Ascendancy trains at 0.9 x 0.9 x 0.9 of DFU's price.
- **The shelf**: the band's step and "a deeper shelf"'s two more, inside the band's own bounds (`chapterShelfQuality`'s
  `extra`: 1-20, a world-data hall past 20 never lowered) - a Failing hall's four less is two less with it; minted once
  a day, as the band's (GUILD-SHELF).
- **The shut halls**: a hall whose chapter's halls a Crackdown shut answers every service of its window - training, the
  spells, the shelves, repair and the rest alike - with one line, "The hall is shut this Season, by the watch's order.",
  in the town's talk, before any window opens; its two `guildsman` keep their working day at home, and no resident
  spends an evening there - nor a sellsword's or an adventurer's daily visit (their day's own draws kept, so the rest of
  the day stands as it was). NARROWED: the door stays DFU's - its opening hours, its shelf of books and the hall's roll
  on it (9) - the Crackdown shuts the chapter's work, not the building.
- **The host** hands the window the hall's whole chapter off the sheet (`chapterHere`, the band's `chapterStrength` it
  replaced); none known - offline, the classic skin, a hidden guild, a chapter the sheet does not name - every hall is
  DFU's own, as the band's.

BUILT (CHAP6e, 2026-10-09, Mac: "continue"), the Season's two titles - `src/net/identityToken.js` (`CHAPTER_TITLES`'s
`highmaster` and `seasonmaster`), `src/net/npcChapterLaw.js` (`chapterTitleText`, `chapterTitlesOf`'s `high` and
`kept`), `server-account/src/npcChapters.js` (`chapterTitlesOfAccount`), the mint (`server-account/src/index.js`), the
badge (`src/ui/playerBadge.js`):

- **The High Master**: a Master's seat at a chapter whose Ascendancy is this counted Season's (the event the chapter drew
  for it) is signed `highmaster` on the token in the Master's place, with the Master's own claim - "High Master of the
  Fighters Guild, Anticlere". NARROWED: no title of its own in the wardrobe - an account wears its Master's title and
  the mint adds "High" for the Season, so the Master who wore it before keeps wearing it, and nothing is left worn and
  unheld when the Season ends; a character with two Masters' seats signs its Ascendancy's first. No Season counted,
  every chapter Calm: no High Master.
- **The Season's Master**: every 'season' row of the Chronicle (CHAP6a: a Master placed at or before the Turning that
  opened the Season and sitting at its end) titles its character for good - `seasonmaster`, "Master of the Mages Guild,
  Daggerfall, Season 3", its claim the chapter and the Season it held. NARROWED: one title in the wardrobe, its newest
  Season signed (then by guild and region); held with no seat now, at a chapter struck since (for good is for good);
  never a hidden guild's, a dead character's (the seats' own law), nor Season 0's.
- **The relay**: the two ids join the closed list last, riding with the seats' claim (`titleClaimed`) - `world182` grown
  in place (undeployed, its law re-hashed), deployed before `CHAPTER_TITLES` is turned on, as CHAP4c's three.
- **The badge**: the High Master in the banner's blue made bright (#5d9cec), the Season's Master the same blue aged to
  slate (#6f8fb8); "High Master" and "Season Master" where the claim names no chapter this client knows.

## 8. Rivals and patrons (CHAP7)

- **Rivals** (DECIDED, CALL 5): the port's own table in the law module, never FACTION.TXT. Each pair is a Rivalry's
  draw (7) where both keep a chapter in the region:

  | Chapter | Its rivals | Why |
  |---|---|---|
  | Fighters Guild | Thieves Guild | The sword for hire against the hand in the purse |
  | Dark Brotherhood | Temple of Arkay; Temple of Stendarr; every knightly order | Murder against the god of death's order, the god of mercy, and the oath-bound knights |
  | Mages Guild | Temple of Julianos | Two claims to learning, one of them a god's |

  The watch is no chapter: it is a Crackdown's hunter alone (7). BUILT (CHAP6a): `CHAPTER_RIVAL_PAIRS`, fourteen pairs.
- **Patrons** (DECIDED, CALL 6): a player guild (GUILD1) may be a chapter's **patron** for a Season - one patron a
  chapter, the highest Marks bid at the Season's first Turning, the winner's bid burnt and every other bid returned.
  A patron's banner hangs in the chapter's halls, its members pay the Thriving band's prices there whatever the
  chapter's Strength, and the Chronicle names it. **A patron gains no seat influence**: a gate kill already raises
  influence (Seats-Arc 4.2), as an Orc Raid's camp does (9.3), and letting the same act raise Merit, Strength and
  influence for one guild would count it three times into a war the Seats' caps were balanced without (AUDIT CHAP R6:
  this named a raid receipt, which raises none, and said twice where CALL 6 said three times).

BUILT (CHAP7a, 2026-10-09, Mac: "continue"), the patrons on the service - `src/net/npcChapterLaw.js`
(`CHAPTER_PATRON_MIN`, `patronBidOk`, `patronEscrowId`, `patronWinnerOf`, `chapterPatronOf`, `chapterPatronLine`),
`server-account/src/npcChapters.js` (`bidPatron`, the Turning's `patronsDrawn` and `patronStatements`, `regionPatrons`,
`guildPatronBids`), `src/net/marksLaw.js` (`patron-escrow`, `patron`, `patron-return`), migrations `0099` and `0100`
grown in place:

- **The bid** (`POST /v1/chapters/patron { character, faction, region, marks, rid }`): the account's character the
  guildmaster of its player guild (GUILD1: the treasury is the guildmaster's to spend), for the Season AFTER this one,
  the whole the guild will pay, in silver (Marks) from the guild's Marks treasury - at least 1,000
  (`CHAPTER_PATRON_MIN`, an eighth of a palace's claim fee), raised by the difference and held in the ledger's escrow
  (`patron:<Season>:<chapter's key>:<guild>`), never lowered nor taken back. Refused for a hidden guild's chapter (a
  patron's banner would say where the underworld keeps its halls), a chapter not confirmed now, with no Season counted,
  with the Marks shut, and once the Turning that opens that Season has settled; a request made twice is made once.
  NARROWED: sealed - each guild's board says its own bid, never another's (8 named no open book; a sealed bid wants no
  watch on a rival's sum and leaves nothing to snipe at the last hour).
- **The Season's patrons, at the Turning that opens it** (inside its one batch): each chapter's highest bid of a guild
  still standing, at a chapter confirmed now, wins - at a tie the one that stood at its sum first, then the lower guild
  (`patronWinnerOf`); its escrow is burnt (`patron`), every other goes home (`patron-return`) - burnt where its guild is
  gone, or where its treasury would pass the cap (reckoned across every bid going home to it, so the batch never fails
  on it). A bid still open for an earlier Season - one that opened while the Chapters were shut - goes home with them;
  a bid that lands between the Turning's read and its batch fails the batch, and the next read settles the week with
  it. The chapter keeps its patron for the Season (`npc_chapters.patron`, `patron_season`); the opening week clears a
  developers' patron.
- **The Chronicle** writes a 'patron' row - "For the Season of First Seed, Grey Lanterns took the patronage of the
  Fighters Guild." - the guild's name as it stood (`chapterPatronLine`); the Hall of Records reads it. **The sheet and
  the board** carry each chapter's `patron` this Season (`{ id, name, tag, heraldry }`; a guild gone since is none);
  the board, to a guildmaster alone, its own guild's bid for the Season after (`patronBid`, `{ season, marks }`).
- **No seat influence** (CALL 6): nothing of it touches the Seats' tables.
- **Still to build** (CHAP7b): the board's bid and its words, the patron's banner in the chapter's halls, its members'
  Thriving prices there - BUILT, below.

BUILT (CHAP7b, 2026-10-09, Mac: "continue"), the patrons on the client - `src/net/npcChapterLaw.js`
(`CHAPTER_PATRON_BAND`, `CHAPTER_PATRON_PRICE`, `chapterPatronMember`, `chapterHallFactor`'s `guildId`,
`CHAPTER_PATRON_RAISES`, `chapterPatronBidsOf`, `chapterPatronSheetLine`, `chapterPatronBidLine`, `chapterPatronBidSaid`),
`src/net/chapterSheet.js` (the patron kept), `src/scenes/chapterBanners.js` (new), `src/scenes/world.js`,
`src/scenes/worldModes.js`, `src/ui/noticeWindow.js`, `src/net/accountClient.js` (`accountRoll.patron`):

- **The members' prices**: a hall's price factor for a reader whose player guild is its chapter's patron this Season is
  the Thriving band's (0.9) whatever the chapter's Strength - a Failing chapter's patron's members pay 0.9, not 1.25 -
  and an Ascendancy's and the training doctrine's tenths lie on it as on anyone's; the shelf is the band's (8 named
  the prices alone). The host hands the hall the playing account's guild (its GuildBook's).
- **The banners**: the sheet keeps each chapter's patron and its arms (`heraldryOf` - arms that are not, none); a town's
  guild halls and temples, by their guild, are kept at its build (`chapterHalls`), and a hall whose chapter - the hall's
  guild in the pixel's politic region (AUDIT CHAP3 C6) - has a patron with arms hangs them, two banners beside its door,
  on the halls' and the seats' own pass (`hallBannerAnchors`, `bannerKeyOf`; the nearest of all of them drawn). A patron
  with no arms, a door unmeasured, a chapter the sheet does not name: none. NARROWED: beside the door, outside - DFU's
  hall interiors are its own blocks, as a player guild's hall's banners are its street's.
- **The board** names each chapter's patron ("Its patron this Season: Grey Lanterns [GLN]."), and to its guild's
  guildmaster alone (the board sends the bid to it alone) its bid for the Season after - "Your guild bids 1,500 silver for
  its patronage in the Season of First Seed." - and what it may bid: none standing, 1,000, 2,000 or 5,000; standing,
  500, 1,000 or 5,000 more, under the cap (`chapterPatronBidsOf`). A press bids through the door (`/v1/chapters/patron`,
  a Marks request id of its own), says so, and reads the list again; a refusal in its words; an answer after the board
  closed is said in the chat. A press answered twice escrows once: a bid no higher than it stands is refused.

## 9. The living world shows it (CHAP5)

DECIDED. LW0 decision 2 narrows by one input: the living world is a pure function of the world's data, a seed, the
clock **and the chapter sheet**. Every player reading the same sheet sees the same hall. With no sheet - offline, the
classic skin, the row off, the service unreachable - the living world is exactly today's.

- **The hall's people** (AUDIT CHAP R7): the census's two `guildsman` keep the hall by day, and `guildDay` sends a
  resident whose trade or class ties it to the guild there for an evening, two days a week; a Thriving chapter gives
  `guildDay` a third, a Failing one a single day, and a chapter whose halls are shut sends nobody - its two `guildsman`
  idle at home. BUILT (CHAP5b): `guildDay(res, day, days)` keeps the first `days` of the member's own day and three and
  five after it (`GUILD_DAY_OFFSETS` - the two are today's two, the one the first of them), `days` the hall's chapter's
  band's (`GUILD_DAYS_BY_BAND`: Failing 1, Steady 2, Thriving and Ascendant 3; `hallGuildDays`), the trades' evenings
  and a courtier's at its order's alike; a sellsword's and an adventurer's daily hall untouched. The living town reads
  the bands once a clock minute (`LivingTown._chapterRead`, the host's `chapterOf` over the sheet) and makes a day's
  plans again when they move, so a reader whose sheet landed after it entered the town keeps the same hall as one whose
  sheet was there first. Shut halls wait for the Crackdown that shuts them (7, CHAP6). BUILT (CHAP6d): a shut hall
  keeps no evenings (`GUILD_DAYS_SHUT`, the band `shut` the living town reads off the sheet's `shut`), its `guildsman`
  idle at home, a sellsword's and an adventurer's daily visit dropped (7).
- **The Schism's candidates and the Succession's heir** are residents of the hall, drawn from the census by the event's
  roll, and are known to every player by the same name. CHAP6b: the service holds them by index - a Schism's side 0 and
  1, a Succession's candidate 0 to 2 - and the census's names are the client's (CHAP6c). BUILT (CHAP6c): named by the
  event's roll on the region's bank (`chapterCandidateName`, section 7); NARROWED, not yet walking its streets.
- **Their words**: `systems/livingWorld/lines.js` gains the chapter's lines, keyed by the event and its standing ("They say
  the Wayrest Mages are split over who leads them"); the rumour mill (`systems/rumorMill.js`) carries the Season's
  chapter news. BUILT (CHAP5b), the standing's: `CHAPTER_NEWS` by a chapter's band - Failing, Thriving, Ascendant; a
  Steady chapter is no news - told as the town's news (`LivingTown.chapterNews`, beside the roads', the deeds' and the
  house's) on two days of the week, its own drawn on the seed by the town and the guild, for each chapter of the town's
  guild halls and temples the sheet names; `{guild}` the chapter's guild ("the Fighters Guild"). The event's lines and
  the rumour mill's Season news are CHAP6's, with the events. BUILT (CHAP6c): `CHAPTER_EVENT_NEWS` by the Season's
  event and shut halls, told before the band's news on the same two days (`LivingTown.chapterNews`: shut halls first,
  then its event - Calm none - else its band); the host's `livingChapterOf` reads the whole chapter off the sheet.
- **The hall's roll**: the seats' holders, named on a board inside each hall. BUILT (CHAP5a), NARROWED: a DFU guild hall
  has no board, and placing one in DFU's own block geometry is a decor change of its own; its BOOKSHELF is the hall's
  reading (DFU's `DaggerfallBookshelf`, as the palace's shelf is the Hall of Records), so the roll is the shelf's first
  book - "The Roll of the Fighters Guild, Anticlere": the chapter's state (the board's line), "Master of the chapter:
  Alda.", "Its officers: Bryn, Cael and Dara." (or the seats empty), worded without gender (`npcChapterLaw.js`
  chapterRollTitle, chapterRollLines; `ui/chapterRoll.js`). The roll is public, so whoever DFU's shelf refuses - a stranger to the guild, a
  member below its rank, and every member of the Fighters Guild and the knightly orders, whose shelves DFU opens to no
  one (`canAccessLibrary`) - reads the roll alone, and after it DFU's own refusal line, as the shelf says it offline
  (AUDIT CHAP4 D4). A temple's shelf carries its chapter's roll too. Online only, off the sheet the tab holds
  (5.3): offline, for a hidden guild, a chapter the sheet does not name, the shelf is DFU's.
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

- **Account service (D1)**: BUILT (CHAP1, migration `0095_npc_roll`): `npc_roll_heads` (char_id, player, cap, seq,
  last_rid, tag, seeded_at, updated_at - every write moves `seq` on under its own `tag`, a claim names `last_rid`);
  `npc_roll` (char_id, faction_id, player, rep, gained_day, gained, owed, member, rank, joined_at; AUDIT CHAP4 D1, grown in
  place: dormant); `npc_rep_events` (seq,
  char_id, player, faction_id, asked, credited, rid, at - AUDIT CHAP2 S6: a claim with no reputation line leaves a line
  of faction 0, its id). BUILT (CHAP2a, migration `0096_npc_halls`): `world_witness` kind `npchall`; `writs` rebuilt
  with `kind` ('court', 'hall'; CHAP3a: 'member'), `faction` and (CHAP3a) `owner`, `UNIQUE (day, region, kind,
  faction, owner, slot)`; `hall_writ_days` (day,
  region, posted, at); AUDIT CHAP2: `npc_hall_strikes` (map_id, by, at) and `npc_roll_heads.kseq`, the claim sequence
  (C1). BUILT (CHAP2b, migration `0097_npc_receipts`): `npc_receipt_credits` (char_id, faction_id, ref, player, amount,
  tag, at - one line a guild a receipt, one a guild a member a day for its writ). BUILT (CHAP3a, migration
  `0098_npc_merit`): `npc_chapter_merit` (week, faction, region, account, char_id, source - 'writ', 'gate', 'raid' -
  amount, ref, at; `UNIQUE (char_id, faction, source, ref)`, the draft's `(source, ref)` narrowed to one line a
  character an act a guild). BUILT (CHAP3b, migration `0099_npc_chapters`): `npc_chapters` (faction, region, strength,
  week, merit, at) and `npc_chapter_weeks` (week, active, target, chapters, open, at). BUILT (AUDIT CHAP3 S3, `0096`
  grown in place): `npc_hall_regions` (region, chapters, ver, done, at) - a region's chapters computed once a change.
  BUILT (CHAP4a, migration `0100_npc_seats`): `npc_chapter_seats` (faction, region, char_id, account, seat, since, week,
  at - the draft's `key` the chapter's own pair) and `npc_chapter_history` (seq, faction, region, week, kind, char_id,
  data JSON, at). BUILT (CHAP4d, `0099` grown in place): `npc_chapters`' `focus` and `focus_week`; CHAP6a (grown in
  place): its `event`, `event_season`, `event_data` JSON and `shut_season`, and the Chronicle's 'event' and 'season'
  rows; AUDIT CHAP4 S2: a week's `open` is 'dev', 'on' or 'off' (an off week recorded, nothing moved). BUILT (CHAP6b,
  grown in place): `npc_chapters`' `doctrine` and `doctrine_season`; `npc_chapter_backing` (faction, region, season,
  account, char_id, side, at - one an account a chapter a Season). BUILT (CHAP7a, grown in place): `npc_chapters`'
  `patron` and `patron_season`; `npc_chapter_patron_bids` (faction, region, season, guild_id, amount, at, state - 'open',
  'won' or 'lost'; one a guild a chapter a Season); the Chronicle's 'patron' rows.
- **Endpoints** (`/v1/chapters/...`): `roll` and `claim` BUILT (CHAP1, behind `CHAPTERS_OPEN`, shipped `dev`; each
  names the realm character and the playing tab's lease); `witness` BUILT (CHAP2a); `halls` and `strike` BUILT (AUDIT
  CHAP2 E1, a developer's); `list` BUILT (CHAP3b, the sheet; CHAP5a its seats' holders); `focus` and `history` BUILT (CHAP4d, a Master's Focus and a region's Chronicle); `back` BUILT (CHAP6b, a member's
  backing in its chapter's Season); `patron` BUILT (CHAP7a, a guild's bid for a chapter's patronage); `standings` (a chapter's Merit) still drawn; the hall writs
  ride the board's own writ endpoints, and (CHAP3a) a member's own writ and the account's Merit lines ride its list.
- **The settle**: inside `settleWeek`, after the seats' steps - Merit summed, Strength moved, seats placed, and at a
  Season's boundary the events resolved and drawn. NARROWED (CHAP3b): the Chapters' own Turning on the seats' week,
  keyed on its own row (`npc_chapter_weeks`, migration `0099_npc_chapters`), beside `settleWeek` rather than in it -
  5.2. BUILT (CHAP3b): `npc_chapters` (faction, region, strength, week, merit, at - the draft's event and doctrine are
  CHAP6's to add; focus and focus_week CHAP4d's) and `npc_chapter_weeks` (week, active, target, chapters, open, at).
- **The relay**: AUDIT CHAP R5 - this said "no change: the gate, raid and serpent receipts already name an account and a
  region". Only the raid's names a region (`w`); a gate's region is taken from its claims, as the Seats take it (Seats-Arc
  4.2: the region three of the day's receipts agree on), and a serpent's has none - so CHAP2b credits a gate in the Seats'
  way, a raid by its `w`, and a serpent to no chapter, with no relay change; a relay change is CHAP2's to propose if a
  chapter needs the serpent.
- **Law modules, pure, shared**: `net/npcChapterLaw.js` (Appendix A - BUILT for the Roll, CHAP1, the halls and their
  writs, CHAP2a, the receipts, CHAP2b, Merit, CHAP3a, Strength and the bands, CHAP3b and CHAP3c; the event weights and
  the rivals, CHAP6a; the patrons, CHAP7a); the playing tab's side is `net/npcRollTracker.js` (CHAP1; the first draft named it
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
4. **CHAP4 - the seats.** Ranks 8 and 9 contested; the titles; the Focus; the Chronicle's rows. CHAP4a BUILT
   (2026-10-08): the seats placed at the Turning, the Roll's rank stopped at 7, the Chronicle's rows (section 6). CHAP4b
   BUILT (2026-10-08): the book held at 7 online, a seat's rank at its chapter's halls, the seats said (3.5, 6). CHAP4c
   BUILT (2026-10-08): the seats' titles on the token, behind `CHAPTER_TITLES` (6). CHAP4d BUILT (2026-10-09): the
   Master's Focus on the hall writs, the Chronicle read in the Hall of Records (6).
5. **CHAP5 - the living world reads the sheet.** The hall's people, the lines, the roll. CHAP5a BUILT (2026-10-09): the
   sheet's seats, the hall's roll on its shelf (5.3, 9). CHAP5b BUILT (2026-10-09): the hall's evenings and the town's
   talk by the band (9).
6. **CHAP6 - the Seasons' events.** The roll, the seven events, their endings. CHAP6a BUILT (2026-10-09): the roll,
   the Decline's weeks, the Season's end (the Rivalries, the Crackdowns' shut halls, the Chronicle's lines), the events
   on the sheet and the board (7). CHAP6b BUILT (2026-10-09): the Schism's backing and its doctrine, the Succession's
   heir, the Master's vote (7). CHAP6c BUILT (2026-10-09): the Season's words on the board, the roll and in the town,
   the candidates named, a member's choices on the board (7, 9). CHAP6d BUILT (2026-10-09): an Ascendancy's prices, the
   doctrines' training and shelf, the shut halls and their people (7, 9). CHAP6e BUILT (2026-10-09): the High Master and
   the Season's Master on the token (6, 7).
7. **CHAP7 - rivals and patrons.** Last, because it reads the Seats' guilds. The rivals BUILT with the Rivalry (CHAP6a,
   8). CHAP7a BUILT (2026-10-09): the patrons on the service - the bid, the Season's decision, the patron on the sheet,
   the board and in the Chronicle (8). CHAP7b BUILT (2026-10-09): the board's bid, the banners at the chapter's halls,
   the members' Thriving prices (8).

CALL 1 retired the eighth slice the first draft carried (the other factions to the service): they wait on Realm phase 3.

## 13. The four hosts

THE FOUR HOSTS RULE, named before the first slice (and CHAP1's, as built: the tracker lives in `world.js`, the one
host online runs in - the interiors and the dungeons are that same page and that same entity):

- `scenes/worldModes.js` (interiors) - the hall's service window: the rank from the Roll, the prices from Strength
  (CHAP1, CHAP3), and the hall's roll (CHAP5). CHAP1: nothing to wire - the window reads the entity's reputation and
  book as it always did, and online the reputation it reads is the Roll's. CHAP3c BUILT: the hall's chapter's band
  on its training, spells and shelf, through the host's `chapterStrength` (world.js's sheet; none offline). CHAP4b
  BUILT: the hall's services read the book seated (the host's `chapterSeatRank`), its review the host's ceiling
  (`rollRankCeiling`, 7 while the Roll holds). CHAP5a BUILT: the hall's shelf - its chapter's roll first (the host's
  `chapterRoll`), and alone for whoever the shelf refuses - DFU's refusal line after it (AUDIT CHAP4 D4).
- `scenes/world.js` (the streets) - the living world's read of the sheet and the Notice Board's hall writs (CHAP2,
  CHAP5). CHAP3c BUILT: the sheet the playing tab holds (`net/chapterSheet.js`), asked at a town's entry and handed to
  the interiors. CHAP4b BUILT: the tab holds the book at 7 and says the seats (`onCapped`, `onSeats`), and names a seat's
  rank where the character stands (`seatRankHere` - the hall's and the paid teleport's). CHAP4d BUILT: the board's Focus
  door (`setFocus`) and the palace's Hall of Records reading its region's chapters' Chronicle. CHAP5a BUILT: the hall's
  roll off the sheet the tab holds (`chapterRoll`, the politic region, as `chapterStrength`). CHAP5b BUILT: the living
  town's `chapterOf` - a chapter's band and its guild named, off the same sheet in the same region (`livingChapterOf`).
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
   chapter's top worth contesting; four weeks keep a single week's surge from taking one - and (AUDIT CHAP4 E1, this
   said "let a holder miss a week without losing a seat": against a challenger at the cap no window does that) a holder
   who misses a week keeps the seat only against challengers who earned no more over the four. Vacant over
   filled-from-below, so a seat is never a gift.
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
| A recorded rank | never past what the Roll's reputation needs (`rollRankCapOf` over `RANK_REQ_REPUTATION`, AUDIT CHAP S5), and never past 7 (`ROLL_BOOK_RANK_MAX`, `rollBookRankOf`, CHAP4a) | 3.2 |
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
| The Turnings a read settles | 8 at most (`CHAPTER_WEEKS_MAX`, `server-account/src/npcChapters.js`); every region's chapters read from their computed rows (`npc_hall_regions`, AUDIT CHAP3 S3), one row a region (AUDIT CHAP4 R3: this named `ALL_CHAPTERS_KEPT_MS`, gone with S3); the weeks the Chapters are shut recorded `off`, nothing moved (AUDIT CHAP4 S2) | 5.2 |
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
| Patron | one a chapter a Season, highest Marks bid, burnt, every other home; at least 1,000, sealed, raised never lowered (`CHAPTER_PATRON_MIN`, `patronBidOk`, `patronWinnerOf`; CHAP7a) | 8 |
| Holder's Merit | no carry - a sitting holder keeps an EQUAL standing (`chapterSeatPlan`'s first tie-break; AUDIT CHAP4 E1, decided: the x1.2 it carried made a holder at 2000 of the four weeks' 2400 unbeatable) | 6 |
| Event weights | Calm 30, Schism 15, Succession 10, Crackdown 10, Rivalry 15, Decline 10, Ascendancy 10; moved as section 7's table says (AUDIT CHAP R11; `CHAPTER_EVENTS`, `chapterEventWeights`, drawn on `CHAPTER_EVENT_SALT`) | 7 |
| Decline's weekly fall | 2 Strength, unless the week's Merit meets twice the target (`CHAPTER_EVENT_EFFECTS.declineFall`, `declineMeets`) | 7 |
| Ascendancy's prices | a further tenth off training, a spell bought and a spell made (`CHAPTER_EVENT_EFFECTS.ascendancyPrice`, `chapterHallFactor`) | 7 |
| Rivalry's swing | 10 Strength, the loser's whole, the winner's never past 100 (`rivalrySwing`) | 7 |
| Crackdown's pay | half again, whole (`crackdownPay`) | 7 |
| Crackdown's shut line | Strength 30 - under it, the halls shut for the next Season (`crackdownShut`) | 7 |
| The doctrines | training a further tenth off, the shelf two qualities deeper inside the band's bounds, one hall writ more a day (`CHAPTER_DOCTRINE_EFFECTS`, `chapterHallFactor`, `chapterHallShelf`); a Schism two of the three (`schismDoctrinesOf`, `CHAPTER_SCHISM_SALT`) | 7 |
| A Succession | three candidates, named at the Season's third Turning (`SUCCESSION_CANDIDATES`, `SUCCESSION_TURNING`) | 7 |
| The Chronicle the Hall reads | a region's newest 60 rows, the hidden guilds' left out first (`CHAPTER_CHRONICLE_ROWS`, `server-account/src/npcChapters.js`; AUDIT CHAP4 S3) | 6 |
| A name on the hall's roll | 32 characters at most, the realm's own cap (`CHAPTER_ROLL_NAME_MAX`) | 9 |
| The Season's titles | a High Master for its chapter's Ascendancy, signed in the Master's place; a Season's Master for good, its newest Season signed (`chapterTitlesOf`, `chapterTitlesOfAccount`; CHAP6e) | 7 |
| The hall's evenings by band | none shut (`GUILD_DAYS_SHUT`, CHAP6d), Failing 1, Steady 2, Thriving and Ascendant 3 a week, from the member's own day and three and five after it (`GUILD_DAYS_BY_BAND`, `GUILD_DAY_OFFSETS`, `src/systems/livingWorld/dayPlan.js` - the living world's own law module, as LW0 keeps it) | 9 |
| The town's talk of a chapter | on 2 days of the week, its own, three apart (`CHAPTER_NEWS_DAYS`, `src/systems/livingWorld/lines.js`); none Steady | 9 |
| The seats' beat on the tab | 10 minutes with nothing to claim before the Roll is asked again (`ROLL_SEATS_MS`, AUDIT CHAP4 C1) | 6 |

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
- **The service.** `server-account/src/npcRoll.js` over migration `0095_npc_roll`: `POST /v1/chapters/roll` reads the
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
  with the Roll's +2 in the same batch. `npcRoll.js`: the join's floor. Migration `0096_npc_halls` rebuilds
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
- **The service.** `server-account/src/npcReceipts.js` over migration `0097_npc_receipts`: `creditReceipt`, run by the
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
- **The service.** `server-account/src/npcMerit.js` over migration `0098_npc_merit` (and 0096's writs rebuild, grown in
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
- **The service.** `server-account/src/npcChapters.js` over migration `0099_npc_chapters`: every region's chapters in one
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
  order. Migrations `0096`-`0099` grown in place (nothing shipped): `npc_hall_regions`, two indexes, the `open` column.
- **The client.** `world.js`: a kept gate claim waits for the scan (90 s at most); a raid's line on its fighter's page;
  a late writ said in the chat; a stale build's Roll stop said; the hall's chapter by the politic region. `worldModes.js`:
  a window's factor read once. `chapterSheet.js`: a stop forgets. `noticeWindow.js`: a refused Take reads the list again,
  a member's own writ promises Merit only where it can earn. `npcChapterLaw.js`: a receipt's Merit in its line; the
  shelf's quality untouched where the band moves nothing.
- **E4 DECIDED** (Mac: "Your decision", after the audit): `npcChapterLaw.js` `STRENGTH_SHORT` in `strengthAfter` (a
  week short of its target, above 50, three back toward 50) and `meritOfReceipt` (a receipt's 50 shared among its
  chapters), read by `npcReceipts.js` creditReceipt. CHAP3a's receipt pin moved (25 each, PIN MOVED).
- **Pins.** `test/audit_chap3.test.js`, 18 tests, one a finding or a group; `tools/mutants/audit_chap3.json`, 45 mutants:
  40 dead, 5 equivalent as recorded (AUDIT CHAP4: 41 and 4 since - `A3-S2-OFF` dies with S2). Thirty older records re-aimed at the code the fixes moved, all dead - two of them
  (AUDIT CHAP2's `T-LAW-ADOPT-BASE-HAS`, CHAP3c's `CHAP3C-SHEET-BUSY`) no longer equivalent, killed by new pins. The
  pins the fixes moved say PIN MOVED.

## CHAP4a - the seats placed, as built (2026-10-08, Mac: "Your decision", on "Whats next")

The fourth slice's service half; sections 3.5 and 6 carry the law and what building it narrowed (BUILT, CHAP4a).

- **The law.** `src/net/npcChapterLaw.js`: the seats' numbers (`CHAPTER_SEAT_KINDS`, `CHAPTER_SEATS`, `SEAT_RANK`,
  `SEAT_TENURE_S`, `SEAT_ACCOUNT_AGE_S`, `SEAT_MERIT_WEEKS`, `SEAT_HOLDER_CARRY` - gone, AUDIT CHAP4 E1), the book's cap (`ROLL_BOOK_RANK_MAX`,
  `rollBookRankOf`), Eligible (`seatEligibleAt`), a standing (`seatScoreOf`), the placing (`chapterSeatPlan`) and what it
  changed (`seatChangesOf`).
- **The service.** `server-account/src/npcChapters.js`: the Turning's seats (`seatsPlaced`, in settleChapterWeek's
  batch) and a character's (`chapterSeatsOf`, on the Roll's answer - `index.js`); `npcRoll.js`: the recorded rank
  through `rollBookRankOf`; `realm.js`: a deleted character's seats; migration `0100_npc_seats`. Still `acct95` (`acct99`
  since the merges of main past SCALE4's, TAVERN CARDS', SERVER-POST's and PERMADEATH-HOUSES').
- **Pins.** `test/chap4a_seats.test.js`, 13 tests: the law against literals (the numbers, the cap, Eligible at each
  edge, the standing, the plan's order, vacancy, ties, carry and limits, the changes); the Turning through the real
  migrations (who is placed and who never - under the line, a second short, an account too new, dead, gone; the window;
  the carry against a newcomer; `since` through a move; the Chronicle; a gate's agreement; the developers' weeks;
  Eligible at the Turning); the Roll's rank and seats through its routes; a delete through its route.
  `tools/mutants/chap4a.json`: 44 mutants, 43 dead, 1 equivalent as recorded (AUDIT CHAP4: 42, 41 and 1 since - the carry's two retired with it, E1). ACC1b's table list moved (PIN MOVED).

## CHAP4b - the seats on the client, as built (2026-10-08, Mac: "Your decision", on "Whats next")

The fourth slice's client half; sections 3.5 and 6 carry the law and what building it narrowed (BUILT, CHAP4b).

- **The law.** `src/net/npcChapterLaw.js`: a Roll answer's seats (`rollSeatsOf`), a seat's rank at a hall
  (`seatRankAt`), the book seated (`seatedBook`) and held (`rollBookCap`), the lines (`seatLineOf`, `seatLinesOf`,
  `bookCappedLine`).
- **DFU's review.** `src/systems/guilds.js` updateRank takes `ctx.rankCeiling` - promoted to it, never past it, never a
  demotion for it; `src/systems/guildServiceFlow.js` onPushEffects hands the host's through.
- **The client.** `src/net/npcRollTracker.js` (the `cap` door, `onCapped`, `onSeats`, `seats`); `src/scenes/worldModes.js`
  (the hall popup's seated services and ceiling); `src/scenes/world.js` (`seatRankHere`, `chapterSeatRank`,
  `rollRankCeiling`, the teleport's fee, the lines). No service change.
- **Pins.** `test/chap4b_seats.test.js`, 8 tests: the law against literals (the seats kept, a seat's rank by guild and
  region, the seated book's reads, its write-through and its guards, the hold in both books, every line); DFU's review
  under the ceiling through updateRank and the push effects; the teleport's gate at a seat's rank; the tab holding the
  book and saying the seats through two answers; the hosts' wiring. `tools/mutants/chap4b.json`: 34 mutants, all dead.
  G8's wiring pin moved (the ceiling beside the reveal, PIN MOVED).

## CHAP4c - the seats' titles, as built (2026-10-08, Mac: "Your call")

The fourth slice's titles; section 6 carries the law and what building it narrowed (BUILT, CHAP4c).

- **The token and the relay.** `src/net/identityToken.js`: CHAPTER_TITLES, last in TITLES, and `titleClaimed` (a seat's
  and a chapter's title ride with `ts`); `src/net/wire.js` badged and readBadge carry it. RELAY_VERSION `world182` (`world177`, `world178`, `world179`, `world180` then `world181` on its branch, renumbered past main's Wrothgarian zone, Tavern Cards, Hour's First, Tavern Tables and TV-BEYOND at the merges), its
  law recorded in `test/relayversion.test.js`; forty-one tests' version pins moved with it (PIN MOVED).
- **The law.** `src/net/npcChapterLaw.js`: the key (`chapterTitleKey`, `chapterOfTitleKey`), the words
  (`chapterTitleText`) and the titles a character's seats give it (`chapterTitlesOf`).
- **The service.** `server-account/src/npcChapters.js` (`chapterTitlesOpenFor`, `chapterTitlesOfAccount`);
  `titles.js` holds them off the row's `chapterTitles`; `index.js` lays them on the wardrobe's and the mint's row and
  signs one only for its character. `wrangler.toml`: `CHAPTER_TITLES = "off"`. Still `acct96` (`acct99` since the merges of main past TAVERN CARDS', SERVER-POST's and PERMADEATH-HOUSES').
- **The client.** `src/ui/playerBadge.js`: the words off the claim, the plain words, three colours.
- **Pins.** `test/chap4c_titles.test.js`, 7 tests: the vocabulary and the claim's law, the relay's stamp and read; the
  key and the words (and none for a hidden guild, no guild, no region); the titles a character's seats give it (the
  order, the Former Master's guards, the hidden); the badge; the service shut and open (the wardrobe, the signed claims,
  another character's none, a hidden guild's none), a Former Master through the Season's floor, held again, an officer's
  seat lost, a dead character; the wiring. `tools/mutants/chap4c.json`: 28 mutants, all dead. Pins moved: the
  vocabulary's newest (acc3titles, aegis, primarch, crystalfist), SHADOW-FANG's widest token (the longest claimed title
  now a chapter's), SEAT1c's mint line.

## CHAP4d - the Focus and the Chronicle's reader, as built (2026-10-09, Mac: "Continue")

The fourth slice's last; section 6 carries the law and what building it narrowed (BUILT, CHAP4d).

- **The law.** `src/net/npcChapterLaw.js`: `hallWrits` takes the week's Focus; `chapterFocusesOf`, `chapterFocusOk`,
  `chapterFocusLineOf` (the board's line); `chapterChronicleLine` (a Chronicle row in words, the seats' `chronicleWhen`).
- **The service.** `server-account/src/npcChapters.js`: `setChapterFocus` (one guarded write), `regionFocuses`,
  `masterSeatsIn`, `chapterChronicle` (`CHAPTER_CHRONICLE_ROWS`, 60); `professions.js`: the day's hall writs posted with
  each chapter's Focus, the list's chapter lines carrying it and, for its Master, the families; `index.js`: the two
  routes, 'not-master' a 403. Migration `0099_npc_chapters` grown in place (`focus`, `focus_week` - nothing of it
  shipped). Still `acct97` (`acct99` since the merges of main past SERVER-POST's and PERMADEATH-HOUSES').
- **The client.** `src/net/accountClient.js`: the chapters door's `focus` and `history`, the two refusals' words;
  `src/ui/noticeWindow.js`: the Focus under its chapter's line, its Master's choice; `src/ui/hallOfRecords.js`: "The
  Chapters of <Region>" after the seat's own rows (and under the empty seat's word); `src/scenes/world.js`: the board's
  `setFocus`, the Hall's read.
- **Pins.** `test/chap4d_focus.test.js`, 9 tests: the families (a guild of one none); the focused writs (every other, the
  same slot's dice, the guards); the Chronicle in words (each arm, the Season's, the hidden, a gone member, no week); the
  Hall's section; the Focus set (the seat asked, the account, the dead, the family, the week); the board's lines and the
  post's writs (the week's, a lapsed one, a stored one not its guild's, an officer's none); the Chronicle's read (the
  region, the hidden, the order, the bound); the Work tab; the wiring. `tools/mutants/chap4d.json`: 52 mutants, all
  dead. Pins moved: CHAP3b's board line (a block now), SEASON1's and HERALDRY-SHOWN's Hall read and window; eight
  mutants re-aimed by content (AUDIT CHAP2's post count and top slot, CHAP2's own dice, CHAP3b's switch and board line,
  RECORDS' empty book and read, HERALDRY-SHOWN's Roll unpassed).

## CHAP5a - the hall's roll, as built (2026-10-09, Mac: "Continue")

The fifth slice's first; sections 5.3 and 9 carry the law and what building it narrowed (BUILT, CHAP5a).

- **The service.** `server-account/src/npcChapters.js` chapterSheet: each chapter's `seats`, `[{ seat, name }]`, off
  `npc_chapter_seats` and the characters' names now - its Master first, then its officers by `since`. No migration;
  still `acct97` (`acct99` since the merges of main past SERVER-POST's and PERMADEATH-HOUSES').
- **The law.** `src/net/npcChapterLaw.js`: `chapterRollSeatsOf` (the seats as the roll reads them: the Master's first,
  at most the chapter's seats, a name at the realm's cap), `chapterRollTitle`, `chapterRollLines`.
- **The client.** `src/net/chapterSheet.js`: the seats kept, `chapterOf(faction, region)` a copy; `src/ui/chapterRoll.js`:
  the roll as a book (the Hall of Records' face); `src/scenes/worldModes.js` openBookshelf: the roll the shelf's first
  book, and alone for a stranger the shelf refuses; `src/scenes/world.js`: the host's `chapterRoll`.
- **Pins.** `test/chap5a_roll.test.js`, 6 tests: the seats as the roll reads them (the order, the caps, the guards); the
  roll's words (the title's guards, each line, the list); the book; the sheet the tab holds (the seats kept, a copy,
  forgotten at a stop); the service's seats (its Master first, its officers by tenure, named as now, never a hidden
  guild's, another region's its own); the wiring. `tools/mutants/chap5a.json`: 35 mutants, all dead. Pins moved: CHAP3b's
  sheet (its seats), BS1's shelf (the books after the roll, the refusal); CHAP3c's sheet-key mutant re-aimed by content.

## CHAP5b - the hall's people and the town's talk, as built (2026-10-09, Mac: "Continue")

The fifth slice's second; section 9 carries the law and what building it narrowed (BUILT, CHAP5b). The living world's
decision 2 narrows by the one input it names (`06-Systems/Living-World.md`).

- **The law.** `src/systems/livingWorld/dayPlan.js`: `guildDay`'s `days`, `GUILD_DAYS`, `GUILD_DAY_OFFSETS`,
  `GUILD_DAYS_BY_BAND`, `hallGuildDays`; `dayPlan`'s `bandOf`. `src/systems/livingWorld/lines.js`: `CHAPTER_NEWS`,
  `CHAPTER_NEWS_DAYS`, the `{guild}` token; `meetups.js` fills it.
- **The town.** `src/systems/livingWorld/livingTown.js`: `townChapters`, the `chapterOf` option, the bands read once a
  clock minute and a day's plans stamped with them (`_chapterRead`, `_chapterStamp` - a plan with no stamp is today's),
  `chapterNews` in the line context.
- **The host.** `src/scenes/world.js`: `livingChapterOf` (the sheet's Strength in the politic region, banded, its guild
  named) handed to the living town where there is a sheet.
- **Pins.** `test/chap5b_people.test.js`, 8 tests: the guild's days by the band (the offsets, the count, the default);
  a hall's days by its own guild (the guards, the table); the town's evenings, the trades' and the court's, and every
  plan today's with no sheet; the town's chapters; the living town's plans by the sheet's bands, made again the minute
  they move - the same day asked again too - as a reader that read them first; the town's talk (not Steady, two days
  its own, every reader the same, none offline); the words; the wiring. `tools/mutants/chap5b.json`: 38 mutants, all
  dead. Four LW-ERRANDS mutants re-aimed by content (the days, the trades' and the court's evenings, the members).

## AUDIT CHAP4 - everything so far read again (2026-10-09, Mac: "Lets do a deep audit on everything so far")

Six lenses read CHAP0 to CHAP5b and two merges of main (`01-Overview/Audit-Chapters-4.md` is the record, every finding
and its fix). What it changed here: 3.5 (the ceiling before the Roll's first word; what DFU gives once at 8 or 9, not
given online; a seat's title at its halls); section 4 (the families the port's own choice); 5.1 (`standings`' reader);
5.2 (the active count DECIDED, E4; the orders' band in their evenings and talk; the underworld's halls still open);
section 6 (no carry - a holder keeps an equal standing, DECIDED E1; an active membership alone, confirmed chapters, the
shut weeks, last week's Master's Focus, the Chronicle counted after the hidden guilds; the relay's deploy); section 9
(whoever the shelf refuses reads the roll and DFU's refusal line); section 11 (`open` with 'off', `focus`, the history's
`at`, `dormant`); Appendix A (the computed regions, the book's 7, no carry, the Chronicle's 60, the roll's name, the
evenings by band, the talk's days, the seats' beat).

- **The service.** `npcChapters.js`: the shut weeks recorded and moving nothing, the opening week's Strength from 50
  everywhere, the seats' four weeks the last four open; seats only at confirmed chapters for a standing character, an
  active membership; titles at confirmed chapters; the Focus after the Turnings due, by last week's Master; the
  Chronicle's hidden guilds left out in its SQL. `professions.js`: an `off` board read records the shut weeks.
  `npcRoll.js`: the dormant line kept; `npcMerit.js`, `npcReceipts.js`: an active membership alone. Migrations `0095`
  (`dormant`), `0099` (`open` takes 'off') and `0100` (two indexes) grown in place (nothing shipped).
- **The client.** `npcChapterLaw.js`: no carry; the dormant mark (`rollMembersOf`, its check, its key); a chapter's line
  by the chapter. `npcRollTracker.js`: the seats asked again on a beat (`ROLL_SEATS_MS`). `npcHallBook.js`:
  `chapterFactionOf`. `world.js`: a town's evenings by its own region; the ceiling before the first word; one Hall of
  Records read. `worldModes.js`: a seat's title at its halls; a knightly order's gifts by the book; the refused shelf's
  line. `lines.js`: the talk reworded. `noticeWindow.js`: a late Focus said in the chat.
- **Pins.** `test/audit_chap4.test.js`, 28 tests, one a finding or a group; `tools/mutants/audit_chap4.json`, 71
  mutants, all dead. Thirty-seven older records re-aimed at the code the fixes moved, all dead; CHAP4a's two carry
  records retired with it (42 there now); AUDIT CHAP3's `A3-S2-OFF` no longer equivalent. The pins the fixes moved say
  PIN MOVED.

## CHAP6a - the Season's event, as built (2026-10-09, Mac: "continue")

The sixth slice's first; section 7 carries the law and what building it narrowed (BUILT, CHAP6a).

- **The law.** `src/net/npcChapterLaw.js`: `CHAPTER_EVENT_SALT`, `CHAPTER_EVENTS`, `chapterEventOk`, `chapterEventName`,
  `CHAPTER_EVENT_EFFECTS`, `CHAPTER_RIVAL_PAIRS`, `chapterRivalsOf`, `chapterEventWeights`, `chapterEventOf`,
  `chapterRivalPick`, `declineAfter`, `rivalryEnd`, `crackdownPay`, `crackdownShuts`, `chapterSeasonLine` (and
  `chapterChronicleLine` routes a Season's rows to it).
- **The service.** `server-account/src/npcChapters.js`: the Turning carries each chapter's event (`heldEvent`), a
  Decline's week, the Season's end (`seasonEnded`, over `chapterMeritBetween`) and the draw (`seasonDrawn`) in its one
  batch, the opening week's reset; `seasonNumberAt`, `regionEvents`; the sheet's `event`, `rival`, `shut`.
  `server-account/src/professions.js`: a shut hall posts no writs nor its members their own; a Crackdown's pay half
  again; the board's chapter lines carry the event. Migrations `0099` (the event columns) and `0100` (the Chronicle's
  two new kinds, a comment) grown in place - nothing shipped; still `acct99`.
- **Pins.** `test/chap6a_events.test.js`, 16 tests: the events and their numbers; every weight's modifier; the draw
  (its sameness, its spread, a weight of none, its golden rolls); the rivals and the pick; a Decline's week, a
  Rivalry's end, a Crackdown's pay and line; the Season's lines; the draw at a Season's opening with every input
  moved; no draw mid-Season, uncounted, unconfirmed or shut; a Decline's Season; the Season's end (one race a pair, the
  whole Season's Merit, a rival gone, the shut line after the races, the rows); the Season's Master; the opening's
  reset; the Chronicle's read; the board's and the sheet's events (a hidden rival unnamed, last Season's none); the
  shut halls and a Crackdown's pay. `tools/mutants/chap6a.json`: 89 mutants, all dead. Nine older records re-aimed by
  content (CHAP3a's, CHAP3b's, CHAP4d's, CHAP5a's, AUDIT CHAP4's S6), all dead.

## CHAP6b - the Schism, the Succession and the doctrine, as built (2026-10-09, Mac: "continue")

The sixth slice's second; section 7 carries the law and what building it narrowed (BUILT, CHAP6b).

- **The law.** `src/net/npcChapterLaw.js`: `CHAPTER_DOCTRINES`, `chapterDoctrineOk`, `CHAPTER_DOCTRINE_EFFECTS`,
  `CHAPTER_SCHISM_SALT`, `schismDoctrinesOf`, `SUCCESSION_CANDIDATES`, `SUCCESSION_TURNING`, `chapterSidesOf`,
  `chapterBackOk`, `schismWinner`, `successionHeir`, `doctrineWritCount`; `chapterSeasonLine` words the Schism and the
  Succession.
- **The service.** `server-account/src/npcChapters.js`: `backChapter` (`/v1/chapters/back`), `regionBackings`,
  `accountMeritBetween`, `seasonBacking`, `successionNamed` (at the Season's third Turning, or the first after), the
  Schism decided in `seasonEnded`, the doctrine carried on the chapter's row and cleared at the opening; the sheet's
  and the board's `sides`, `heir`, `doctrine`, the board's `backed`. `server-account/src/professions.js`: "more writs"
  one hall writ more a day. `index.js` and `service.js`: the route and its refusals (`no-event` and `closed` 409,
  `not-member` 403). Migrations `0099` (`doctrine`, `doctrine_season`) and `0100` (`npc_chapter_backing`) grown in place -
  nothing shipped; still `acct99`.
- **Pins.** `test/chap6b_backing.test.js`, 11 tests: the doctrines and their roll (golden); the sides; a Schism's winner
  and a Succession's heir; the lines; a backing (one an account a chapter a Season, changed, the alt's the account's,
  through the route); every refusal and its status (the grace before the third Turning settles among them); the
  Succession named (the Master's, the richer backer's in the Season and the chapter alone, an officer's a member's, the
  tie, the hall's, named once, a missed third Turning); the Schism decided (the sums, the Master's tie, none carried,
  the doctrine's Season, the rows and the Chronicle's line); the opening's reset; the board and the sheet; "more
  writs". `tools/mutants/chap6b.json`: 64 mutants, 63 dead, 1 equivalent as recorded. Eleven older records re-aimed by
  content (AUDIT CHAP2's, CHAP3b's, CHAP4d's, AUDIT CHAP4's S6, CHAP6a's six), all dead; three older pins moved (PIN
  MOVED: CHAP4d's writs' count, CHAP6a's Schism line, ACC1b's table list). `src/net/accountClient.js`: the four
  refusals' words (ACC1e walks the service for every one).

## CHAP6c - the Season's words and a member's choices, as built (2026-10-09, Mac: "continue")

The sixth slice's third; sections 7 and 9 carry the law and what building it narrowed (BUILT, CHAP6c).

- **The law.** `src/net/npcChapterLaw.js`: `chapterSeasonOf` (a chapter's Season as the sheet or the board says it, each
  field checked), `chapterDoctrineWords`. `src/net/chapterEvents.js` (new, the client's): `CHAPTER_CANDIDATE_SALT`,
  `chapterCandidateName`, `chapterSeasonLines`, `chapterBackChoices`, `chapterBackedLine`.
- **The tab.** `src/net/chapterSheet.js`: each chapter's Season kept, a copy. `src/ui/noticeWindow.js`: the Season's
  lines under each chapter, a member's choices, `backSide` (the door, the word, the read again, the late word in the
  chat). `src/net/accountClient.js`: `accountRoll.back`. `src/scenes/world.js`: the board's `back` door; the roll's
  Season lines; `livingChapterOf` the whole chapter, its event and shut halls. `src/systems/livingWorld/lines.js`:
  `CHAPTER_EVENT_NEWS` and the news pool's reading of it; `livingTown.js`: `chapterNews` the Season first.
  `server-account/src/npcChapters.js`: the sheet's and the board's `season` for a Schism and a Succession.
- **Pins.** `test/chap6c_words.test.js`, 9 tests: the Season as the sheet says it; the candidates' names (golden, the
  stream put back); every line; a member's choices and what a backing says; the sheet's Season; the board (the lines,
  the choices to a member alone, the mark, the press, the word, the read; a Succession's names, a refusal, a late word);
  the town's talk (shut first, then the event, else the band; the words); the wiring. `tools/mutants/chap6c.json`: 62
  mutants, all dead. Eleven older records re-aimed by content (CHAP3c's, CHAP4d's, CHAP5a's, CHAP5b's, AUDIT CHAP4's),
  all dead; three older pins moved (PIN MOVED: CHAP5a's sheet and roll, CHAP5b's host); CHAP6a's and CHAP6b's boards
  pin the `season` sent.

## CHAP6d - the Season on the halls, as built (2026-10-09, Mac: "continue")

The sixth slice's fourth; sections 7 and 9 carry the law and what building it narrowed (BUILT, CHAP6d).

- **The law.** `src/net/npcChapterLaw.js`: `CHAPTER_EVENT_EFFECTS.ascendancyPrice` (0.9), `CHAPTER_HALL_SERVICES`,
  `chapterHallFactor` (the band's, an Ascendancy's, "cheaper training"'s on training alone), `chapterHallShelf`
  (`chapterShelfQuality` gains `extra`, the doctrine's two inside the band's bounds), `chapterHallShut`,
  `CHAPTER_HALL_SHUT_LINE`.
- **The hall.** `src/scenes/worldModes.js`: the window reads the hall's whole chapter (`chapterHere`), prices each window
  by its own service (`chapterFactor`), stocks the three shelves by it (`shelfQuality`), and refuses a shut hall's every
  service before any window. `src/scenes/world.js`: the host's `chapterHere` (the sheet's chapter of the hall's guild in
  the player's region) for the band's `chapterStrength`. `src/systems/livingWorld/dayPlan.js`: `GUILD_DAYS_SHUT`, the
  `shut` band, the `guildsman` at home, a sellsword's and an adventurer's visit gated with their draws kept.
  `livingTown.js`: `_chapterRead` reads a shut chapter as the band `shut`.
- **Pins.** `test/chap6d_halls.test.js`, 6 tests: the price factor (none, the band, an Ascendancy on both services, the
  doctrine on training alone, both, the names it does not know); the shelf (the doctrine's two, the bounds, DFU's own);
  the shut read and its line; a shut hall's evenings and guildsmen in a synthetic town; the living town's read; the
  wiring. `tools/mutants/chap6d.json`: 24 mutants, all dead. Three older records re-aimed by content (CHAP3c's host,
  training and hook), all dead; four older pins moved (PIN MOVED: CHAP3c's host, factor, training and hook; CHAP6a's
  effects table, the Ascendancy's price).

## CHAP6e - the Season's two titles, as built (2026-10-09, Mac: "continue")

The sixth slice's last; sections 6 and 7 carry the law and what building it narrowed (BUILT, CHAP6e).

- **The token and the relay.** `src/net/identityToken.js`: `highmaster` and `seasonmaster` join CHAPTER_TITLES and
  TITLES, last, each with the seats' claim. RELAY_VERSION `world182` grown in place - undeployed, its law re-hashed in
  `test/relayversion.test.js` (bytes `3012337d...` before it).
- **The law.** `src/net/npcChapterLaw.js`: `chapterTitleText` words both (a Season's Master's Season 1 to 9999);
  `chapterTitlesOf` marks a Master's seat in an Ascendancy `high`, first among the Masters', and adds each Season held
  whole (`kept`), last, newest first, once.
- **The service.** `server-account/src/npcChapters.js` `chapterTitlesOfAccount`: the Ascendancies of the counted Season
  read off `npc_chapters`, the Chronicle's 'season' rows read for good; `index.js`: the mint signs `highmaster` in the
  Master's place. `titles.js`: the wardrobe's comment. Still `acct99`; `CHAPTER_TITLES` still shipped "off".
- **The client.** `src/ui/playerBadge.js`: the two plain words and colours.
- **Pins.** `test/chap6e_titles.test.js`, 6 tests: the vocabulary, the claim and the relay's carry; the words (the
  Season's guard, a hidden guild's none, the plain words, the colours); the law (the mark, the order, the kept Seasons'
  guards); the High Master through the service (the mint, never worn alone, another Season's or event's, an officer's,
  no Season counted); the Season's Master (shut, none yet, with no seat, a struck chapter, hidden, unreadable, another
  character's, dead, the newest signed); the wiring. `tools/mutants/chap6e.json`: 34 mutants, all dead. Ten older
  records re-aimed by content (CHAP4c's eight, AUDIT CHAP4's two), all dead - AUDIT CHAP4 T8's survived once: its pin
  passed the unsorted list whenever the random ids fell in the characters' own order, so it now gives the later
  character the lower id (PIN MOVED). Older pins moved (PIN MOVED): the vocabulary's newest (acc3titles, aegis, primarch,
  crystalfist, hoursfirst), CHAP4c's three ids and colours, SEAT1c's mint line.

## CHAP7a - the patrons on the service, as built (2026-10-09, Mac: "continue")

The seventh slice's first; section 8 carries the law and what building it narrowed (BUILT, CHAP7a).

- **The law.** `src/net/npcChapterLaw.js`: `CHAPTER_PATRON_MIN`, `patronBidOk`, `patronEscrowId`, `patronWinnerOf`,
  `chapterPatronOf`, `chapterPatronLine` (and `chapterChronicleLine` reading a 'patron' row). `src/net/marksLaw.js`: the
  ledger's `patron-escrow`, `patron` and `patron-return`.
- **The service.** `server-account/src/npcChapters.js`: `bidPatron` (`/v1/chapters/patron`), the Season-opening
  Turning's `patronsDrawn` and `patronStatements` in its one batch, `regionPatrons` (the sheet's and the board's
  `patron`), `guildPatronBids` (the guildmaster's `patronBid`); `professions.js`: the board's lines; `index.js` and
  `service.js`: the route and its refusals; migrations `0099` (`patron`, `patron_season`) and `0100`
  (`npc_chapter_patron_bids`, the Chronicle's 'patron' kind) grown in place. Still `acct99`. `src/net/accountClient.js`:
  the three new refusals' words.
- **Pins.** `test/chap7a_patrons.test.js`, 7 tests: the law (the bounds, the escrow's id, the winner's order, the
  kinds); the words (the patron's fields, the Chronicle's line and its guards); a bid (escrowed, raised by the
  difference, never lowered, made once, each refusal); the Turning (the highest burnt, the rest home, a struck chapter's,
  a gone guild's, an earlier Season's, the patron written, the Chronicle's rows, the sheet's patron and one gone since,
  the ledger adding up with the escrow counted); the board (this Season's patron, a guildmaster's own bids, none to
  another rank or on a hidden guild's chapter); a guild near the cap; the wiring. `tools/mutants/chap7a.json`: 63
  mutants, all dead - eight survived the first pins and have their own now (an earlier Season's bid that would have won
  this one, a gone guild's highest at a live chapter, a treasury that never held a Mark, a raise another raise beat to
  the table, a request id another act spent, a raise past the cap, more than one move at once). Six older records re-aimed by content (CHAP6a's three, CHAP6b's two, AUDIT CHAP4's reset); two kept one site
  by giving the bid's shape check its own order. One older pin moved (PIN MOVED: ACC1b's tables).

## CHAP7b - the patrons on the client, as built (2026-10-09, Mac: "continue")

The seventh slice's last; section 8 carries the law and what building it narrowed (BUILT, CHAP7b). The arc's seven
slices stand.

- **The law.** `src/net/npcChapterLaw.js`: `CHAPTER_PATRON_BAND`, `CHAPTER_PATRON_PRICE`, `chapterPatronMember`,
  `chapterHallFactor`'s `guildId`, `CHAPTER_PATRON_RAISES`, `chapterPatronBidsOf`, `chapterPatronSheetLine`,
  `chapterPatronBidLine`, `chapterPatronBidSaid`.
- **The tab.** `src/net/chapterSheet.js`: each chapter's patron kept, its arms checked, a copy. `src/scenes/chapterBanners.js`
  (new): a patron's banners at its chapter's halls. `src/scenes/world.js`: each town's halls by their guild at its build,
  the banners on the halls' pass, the modes host's `guildId`, the board's `patron` door. `src/scenes/worldModes.js`: the
  hall priced with the reader's guild. `src/ui/noticeWindow.js`: the patron's line, a guildmaster's bid and its choices,
  `bidPatron`. `src/net/accountClient.js`: `accountRoll.patron`.
- **Pins.** `test/chap7b_patrons_client.test.js`, 6 tests: the members' price (a Failing chapter's, the Season's tenths
  on it, another guild's, none); the board's words and offers (the cap); the sheet's patron (its arms, a copy); the
  banners (two a hall, the region, the arms, the door, no region); the board (the lines, the offers, a press and its word,
  a refusal, a late answer, no door, no bid); the wiring. `tools/mutants/chap7b.json`: 44 mutants, 43 dead and one
  equivalent as recorded (the banners' anchors' guard and `?.` hang the same) - two survived the first pins and have
  their own now (no guild against a patron with no id; no chapter asked for no region). Six older records
  re-aimed by content (CHAP3c's, CHAP5a's, CHAP6c's two, CHAP6d's two). Older pins moved (PIN MOVED): CHAP5a's and
  CHAP6c's sheets (the patron), CHAP3c's and CHAP6d's price factor (the reader's guild), AUDIT SEATS-3 C4's banners'
  pass (a patron's banners on it).
