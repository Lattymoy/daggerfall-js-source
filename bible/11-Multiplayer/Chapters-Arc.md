# THE CHAPTERS ARC - Daggerfall's guilds, held online (CHAP0, the design record)

**Status: DESIGN RECORD, every question decided (2026-10-07): Mac's four calls (the table below), and the rest by the
record at his instruction ("You make the best decisions" - section 14). CHAP1 BUILT (2026-10-07, Mac: "Continue"; its
record is at the foot, and where it narrowed section 3 the section says so); AUDIT CHAP (2026-10-07, Mac: "Lets do a deep
audit on everything so far before we continue") read CHAP0 and CHAP1 through five lenses and fixed what they found
(`01-Overview/Audit-Chapters.md`) - one narrowing of Mac's own Authority call is his to confirm (R1, below). CHAP2 is
next.** Every claim about today's code was read off the tree at
`9ed5a681` and is cited by file and symbol, never by line, so the page survives the next merge.

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

**FOR MAC (AUDIT CHAP R1): the Authority call as built.** The service owns the twenty-two REPUTATIONS. It does not own
the guild book: a join, an expulsion and the rank review are acts of DFU's law on the client (`guilds.js`), so the book
stays the save's, and the service RECORDS each membership with its own clock (the tenure) and bounds each rank by its
own reputation (`rollRankCapOf` - a rank never past what the Roll's number needs). The rank law therefore runs on the
service's numbers, but it runs on the client. This narrows your "online rank and reputation live on the account
service", and is yours to confirm or overrule; the alternative, writing the service's book over the client's, breaks
DFU's guild objects for nothing a rival can lose.

## How to read this page

| Mark | Meaning |
|---|---|
| **DECIDED (Mac)** | One of the four calls above. |
| **DECIDED** | The record's decision, made at Mac's instruction ("You make the best decisions"). Binding for the build slices; Mac may overrule any of it, and a slice that changes one records the change here first. |
| **FACT** | What the tree does today, read off the file named. |
| **CALL n** | One of the eight calls section 14 decides, with its reason. |

Every number lives in ONE pure law module, `src/net/npcChapterLaw.js` (Appendix A), shared by the client and the
account service - so balance is an edit to one file, pinned by its own tests. AUDIT CHAP R11: CHAP1 wrote it with the
Roll's numbers alone; each later slice adds its own there.

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
  each in its guild's own character - paying Marks, reputation and **Merit**.
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
7. **ONE WEEK, ONE SEASON.** The chapters settle inside the Seats' Turning (`seatTurning.js` `settleWeek`, the same
   transaction and the same idempotence key) and count Seasons on the Seats' calendar (`townSeatLaw.js` `seasonOf`,
   the service's `SEASON_ZERO_WEEK`). No second clock, and never a cron.
8. **THE WORD "CHAPTER" IS HALF TAKEN.** `townSeatLaw.js` `hallOfRecordsChapters` is a book's chapter, and GUILD1's
   `guilds` are the players'. The player reads "chapter"; the code says **`npcChapter`**: `net/npcChapterLaw.js`, D1
   tables `npc_*`, endpoints `/v1/chapters/...`.

## 2. What already stands (FACT)

| Foundation | Where | What the arc uses |
|---|---|---|
| DFU's guilds | `systems/guilds.js`: `GUILDS`, `RANK_REQ_REPUTATION` (0-90 in tens), `RANK_REQ_SKILL_HIGH`, `RANK_REQ_SKILL_LOW`, `baseCalculateNewRank`, `updateRank` (the 28-day gate), REP6's probation (`PROBATION_LINES`) | Ten ranks recomputed, never stored; the law ranks 0-7 keep online |
| Temples and orders | `systems/guildVariants.js`: `DIVINES` (8), `ORDERS` (10), `createGuildForGroup` | The other eighteen faction ids |
| Faction reputation | `systems/factionRep.js` `changeReputation` (-100..100, the ally/enemy spread with DFU's truncating halves) | The client's spread, reported as a claim (3.3) |
| The save | `systems/save.js`: `snap.factionRep`, `snap.guildMemberships` | The only home of both today - nothing in `src/net/`, `server/src/` or `server-account/src/` reads either |
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
(AUDIT CHAP S5, `rollRankCapOf`; R1 at the head of this page is Mac's to confirm).

THE KEPT ADOPTION (AUDIT CHAP C1/C2/C4). Every adoption is kept in the save as a mod-save record (`ChaptersRoll`: the
Roll's sequence and its twenty-two). The next page's first read, finding the Roll still at that sequence, knows that
whatever the save holds past it was never claimed, and claims it - the minute between claims, a session played while
the Roll was shut, a stop, and the moves made before a slow first read all reach the service. A Roll that moved on since
(a claim the save never saw) keeps only what moved on the page itself: nothing is claimed twice. It replaces CHAP1's
claim as the page went, which never landed - the realm session gives its lease up first, and the service clears it.

### 3.3 What moves a reputation

| Source | Trust | Reputation | Cap |
|---|---|---|---|
| A hall writ delivered (section 4) | Service-witnessed (the Stores took the units) or relay-signed (a receipt) | +2 with the posting guild | The writ supply and the account's 3 a day |
| Anything DFU's law moves on the client - a guild quest (DFU's +5; QFAIL-FREE: a failure costs nothing online), a donation, the ally and enemy spread | Client-reported, bounded | What moved | 15 a guild faction a character a UTC day, from every claim together |
| A gate, raid or serpent receipt in a region where the character's guild keeps a chapter | Relay-signed | +1 with each guild the character belongs to | Under `MARKS_COMBAT`'s day |
| Any LOSS of reputation (a crime against a guild, a probation, an expulsion) | Client-reported | DFU's law | None - a client that lies against itself is believed |

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
  claim replayed is counted once by the head's `last_rid` (BUILT, CHAP1: the record keeps no uniqueness of its own).

### 3.4 Ranks 0-7 - DFU's law over the server's numbers

DECIDED. `baseCalculateNewRank` and `updateRank` run unchanged, over the Roll's reputation and the save's skills.
FACT: the skills are the client's word until Realm phase 3 checks a save; a lied skill buys a rank that costs no rival
anything, which law 3 allows. BUILT (CHAP1): the 28-day gate and REP6's probation stay DFU's, on the client's own
calendar, untouched; the Roll records the rank the client reports.

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
rank survives the review; every other realm character - born online, or brought in before the epoch - is seeded whole,
its standing earned online. THE SEED IS THE SAVE'S WORD (AUDIT CHAP S2): what a client wrote into its save before its
first read is taken as a claim is, and buys what any claim buys - a personal rank, and a standing at the gate - while the
tenure begins at the seed, so a seat is still fourteen days and witnessed Merit away. Realm phase 3 closes it.

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
  already struck its silver under `MARKS_COMBAT`'s day. Both pay reputation (3.3) and **Merit** (5.1).
- **Limit** (DECIDED, CALL 8): hall writs and Court writs share **one** allowance - `COURT_WRITS_PER_DAY`, 3 an account
  a UTC day, whichever board posted them. A hall writ adds no Marks the economy model (PROF0 Appendix C) has not
  already counted; it changes what the day's writs are for.
- **Where it is delivered**: the units are the Stores', witnessed; the board they are delivered at is the client's word
  as a guild writ's is today (PROF0 11, AUDIT 31 R6). A delivery earns Merit only where it is witnessed as a seat
  writ's must be (Seats-Arc 4.2); until then it pays Marks and reputation alone.

## 5. Merit and Strength (CHAP3)

### 5.1 Merit

DECIDED. Merit is counted per character, per chapter, per week - from **witnessed sources alone**: a hall writ
filled for that chapter, a receipt in that chapter's region while a member. Never from a quest claim.

- **Tenure**: a character in the guild fewer than **7 days** on the Roll earns no Merit (Seats-Arc 4.2's new member).
- **One chapter a guild an account a week**: the first chapter of a guild an account's character earns Merit in is that
  account's chapter of that guild for the week; its other characters earn none in another chapter of the same guild
  (Seats-Arc's per-account war, applied to a guild).
- **Cap**: **600 Merit an account a chapter a week**, whatever number of its characters play.

### 5.2 Strength

DECIDED. Each chapter has a **Strength**, 0 to 100, starting at 50. At each Turning it moves toward what its members
did: `+ min(10, merit / target)` where `target` scales with the region's active accounts, and `- 3` for a week with no
Merit at all. Between Seasons it moves halfway back toward 50 (as a seat's Standing does - Seats-Arc 9.1).

| Band | Strength | What the chapter's halls give |
|---|---|---|
| **Failing** | 0-19 | Training and spells cost a quarter more; the shelf shrinks; half the writs |
| **Steady** | 20-69 | DFU's prices and services |
| **Thriving** | 70-89 | A tenth off training and spells; the shelf a tier deeper; half again the writs |
| **Ascendant** | 90-100 | As Thriving, and the Season's event weighted toward Ascendancy (7) |

DFU's own price law stays the base; Strength is a multiplier laid over it online, never written into it.

### 5.3 The chapter sheet

DECIDED. `/v1/chapters/list` publishes every chapter: its Strength and band, its seats' holders, its Season's event
and that event's standing. The client caches it as it caches the seats' list. It is the one thing the living world
reads from the service (9).

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
| A modified client dodges a loss by never claiming it | Nothing on the service can bound a loss it is never told of (AUDIT CHAP S8); the save's copy keeps it, and a later page claims it unless a claim has moved the Roll since (the kept adoption, 3.2) |
| Alts pad a chapter's Merit | 7 days' tenure; one chapter a guild an account a week; 600 an account a week (5.1) |
| One account holds a guild's seats through its alts | One seat an account a guild (6) |
| A fresh account takes a seat | 14 days in the guild, an account 7 days old (6) |
| A seat farmed by a friendly pair | Seats follow four weeks' Merit, and Merit comes from witnessed work, not from each other |
| A writ's Marks inflate the purse | Hall writs share the Court's 3 a day, and a receipt writ mints nothing the receipt did not (4) |
| Two readers settle a week at once | The Seats' one transaction, keyed by the week (law 7) |

## 11. The server's shape

DECIDED.

- **Account service (D1)**: BUILT (CHAP1, migration `0088_npc_roll`): `npc_roll_heads` (char_id, player, cap, seq,
  last_rid, seeded_at, updated_at - a claim moves `seq` on and names `last_rid`); `npc_roll` (char_id, faction_id,
  player, rep, gained_day, gained, member, rank, joined_at); `npc_rep_events` (seq, char_id, player, faction_id, asked,
  credited, rid, at). Still drawn: `npc_chapters` (key -
  guild faction and region - strength, event, event_state JSON, doctrine, focus); `npc_chapter_merit` (week, key,
  account, char_id, source, amount, ref - `UNIQUE (source, ref)`); `npc_chapter_seats` (key, seat, char_id, since);
  `npc_chapter_history` (seq, key, week, kind, data JSON).
- **Endpoints** (`/v1/chapters/...`): `roll` and `claim` BUILT (CHAP1, behind `CHAPTERS_OPEN`, shipped `dev`; each
  names the realm character and the playing tab's lease); `list` (the sheet), `standings` (a chapter's Merit),
  `history` still drawn; the hall writs ride the board's own writ endpoints.
- **The settle**: inside `settleWeek`, after the seats' steps - Merit summed, Strength moved, seats placed, and at a
  Season's boundary the events resolved and drawn.
- **The relay**: AUDIT CHAP R5 - this said "no change: the gate, raid and serpent receipts already name an account and a
  region". Only the raid's names a region (`w`); a gate's region is taken from its claims, as the Seats take it (Seats-Arc
  4.2: the region three of the day's receipts agree on), and a serpent's has none - so CHAP2 credits a gate in the Seats'
  way, a raid by its `w`, and a serpent to no chapter, with no relay change; a relay change is CHAP2's to propose if a
  chapter needs the serpent.
- **Law modules, pure, shared**: `net/npcChapterLaw.js` (Appendix A, the bands, the event weights, the rivals - BUILT
  for the Roll, CHAP1); the playing tab's side is `net/npcRollTracker.js` (CHAP1; the first draft named it
  systems/npcChapters.js, which the sheet's reader, CHAP3, may still be); DFU's guild faction ids live in the leaf
  `systems/guildFactions.js`, which the service can reach and `guilds.js` cannot be.

## 12. The slices, in order

1. **CHAP1 - the Roll.** BUILT (2026-10-07). The service owns the twenty-two factions' reputation and records the
   memberships for realm characters; the layer; the bounded claims and the daily ceiling; customs' cap. Port-Ledger
   section A row added.
2. **CHAP2 - hall writs.** The chapters derived and witnessed; their writs on the board; the pay.
3. **CHAP3 - Merit and Strength.** The week's Merit, the Turning's Strength, the bands on the halls' prices, the sheet.
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
  book as it always did, and online the reputation it reads is the Roll's.
- `scenes/world.js` (the streets) - the living world's read of the sheet and the Notice Board's hall writs (CHAP2,
  CHAP5).
- `scenes/exterior.js` (the fixed city) - no online, so no Roll: flagged by name, DFU's guilds as today.
- `scenes/dungeonContext.js` - no hall; the receipts a dungeon's foes give are the relay's already: none.

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
| Writ delivered, reputation | +2 | 3.3 |
| Quest success, reputation | +5 (DFU's), failure 0 online | 3.3 |
| The day's pace | 15 a guild faction a character a UTC day, net (`ROLL_GAIN_DAY_MAX`; CHAP1 folded the first draft's 3 quests a day into it); the rest owed (`npc_roll.owed`), paid at the same pace, never past 100 (AUDIT CHAP D2) | 3.3 |
| The record's keep | 90 days (`ROLL_EVENTS_KEEP_S`), pruned by the character's own claims (AUDIT CHAP S7) | 3.3 |
| The kept adoption | the mod-save record `ChaptersRoll` (`ROLL_KEPT_VENDOR`): the Roll's sequence and its twenty-two (AUDIT CHAP C1) | 3.2 |
| A claim's line | 1 to 200 either way (`ROLL_DELTA_MAX`) | 3.3 |
| A claim's pace | at most one a minute (`ROLL_CLAIM_MS`), asked again after 30 seconds doubling to 15 minutes | 3.3 |
| Receipt, reputation | +1 a guild | 3.3 |
| Customs reputation cap | 40 (`ROLL_CUSTOMS_CAP`), for a customs crossing made from `ROLL_EPOCH_S` - 1,791,417,600, 2026-10-08 00:00 UTC - and never under a member's rank's need (AUDIT CHAP C3, D1) | 3.6 |
| A recorded rank | never past what the Roll's reputation needs (`rollRankCapOf` over `RANK_REQ_REPUTATION`, AUDIT CHAP S5) | 3.2 |
| Writs an account a UTC day | 3, hall and Court together (`COURT_WRITS_PER_DAY`) | 4 |
| Receipt writ's own Marks | 0 | 4 |
| Writ supply | `6 x max(1, ceil(active / 100))`, x0.5 Failing, x1.5 Thriving | 4 |
| Merit tenure | 7 days | 5.1 |
| Merit cap | 600 an account a chapter a week | 5.1 |
| Strength | 0-100, start 50; `+ min(10, merit / target)`; -3 an idle week; halfway to 50 at a Season's end | 5.2 |
| Bands | Failing 0-19, Steady 20-69, Thriving 70-89, Ascendant 90-100 | 5.2 |
| Failing price | x1.25 | 5.2 |
| Thriving and Ascendant price | x0.9 | 5.2 |
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
- **The service.** `server-account/src/npcRoll.js` over migration `0088_npc_roll`: `POST /v1/chapters/roll` reads the
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
page-leave one retired with the code it held). One narrowing of Mac's Authority call is his to confirm (R1, at the
head of the page).

