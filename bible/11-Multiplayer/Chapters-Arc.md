# The Chapters

Daggerfall's NPC guilds, held online. Online, a character's reputation with the twenty-two guild factions is kept by
the account service; each guild has a chapter in every region it keeps a hall in, with a Strength that members' work
raises and neglect lowers. Its halls post writs, its top two ranks are contested seats, and each Season every chapter
draws a story. A player meets it at a guild hall: its prices, its shelf, its notice board writs, its roll of seat
holders and the town's talk about it. Offline is DFU's guild law, untouched.

## How it works

**The Roll** (`src/net/npcChapterLaw.js`, `server-account/src/npcRoll.js`, `src/net/npcRollTracker.js`). The service
holds each online character's reputation with `ROLL_FACTIONS` - the four guilds, eight temples and ten knightly orders,
DFU's own ids. The save's copy is overwritten online. A gain is paid at `ROLL_GAIN_DAY_MAX` a day and the rest owed; a
loss lands whole. A character crossing into the realm brings at most `ROLL_CUSTOMS_CAP`. Memberships and ranks 0-7 stay
DFU's law on the client (`src/systems/guild/guilds.js`), run over the service's numbers: a rank never passes what the
Roll's reputation needs (`rollRankCapOf`). The client reports reputation deltas as bounded claims
(`/v1/chapters/claim`).

**Hall writs** (`server-account/src/npcHalls.js`, `src/net/npcHallBook.js`). A town's guild halls are witnessed by
players' reports (`/v1/chapters/witness`, `HALL_WITNESS_KIND`). Each chapter posts writs on its town's Notice Board in its
guild's character, paying Marks and `HALL_WRIT_REP` reputation. The Thieves Guild and Dark Brotherhood are hidden halls
(`HIDDEN_HALL_FACTIONS`). Gate and raid receipts also pay `RECEIPT_REP`.

**Merit** (`server-account/src/npcMerit.js`). A member's own writ earns `MERIT_WRIT`, a receipt `MERIT_RECEIPT`, to
`MERIT_CAP_WEEK` a week. Merit is witnessed work only, never a quest's claim.

**Strength** (`strengthAfter`). Each chapter starts at `STRENGTH_START` and settles at the week's Turning: the week's
Merit against `STRENGTH_TARGET` moves it up to `STRENGTH_STEP_MAX`; an idle week loses `STRENGTH_IDLE`. A Season's end
moves it halfway back to 50. Its band (`CHAPTER_BANDS`) sets the halls' training price, writs and shelf:

| Band | Strength | Price | Writs | Shelf |
|---|---|---|---|---|
| Failing | 0-19 | x1.25 | half | 4 qualities shallower |
| Steady | 20-69 | DFU's | DFU's | DFU's |
| Thriving | 70-89 | x0.9 | half again | 4 deeper |
| Ascendant | 90-100 | x0.8 | half again | 4 deeper |

A Failing chapter loses `CHAPTER_FAILING_FALL` more a week unless its Merit meets twice the target. The chapter sheet
(`/v1/chapters/list`, read by `src/net/chapterSheet.js`) carries every chapter's Strength, band, seats, Season and
patron; a hall the sheet does not name is DFU's own.

**Seats** (`CHAPTER_SEATS`, `SEAT_RANK`). Rank 9 is one Master and rank 8 three officers per chapter, placed at each
Turning by the last `SEAT_MERIT_WEEKS` weeks of Merit. A candidate must be a member at the seat's reputation line
(`ROLL_SEAT_LINE`) with `SEAT_TENURE_S` on the Roll and an account `SEAT_ACCOUNT_AGE_S` old (`seatEligibleAt`). The
book's rank stops at `ROLL_BOOK_RANK_MAX` online; a seat's rank holds at its chapter's halls. Seats carry titles on the
token (Master, Councillor for an officer, Former Master for the rest of a lost Season; High Master while Ascendant; a
Season's Master). A hidden guild's seat gives no title. A Master sets the chapter's
Focus on its hall writs (`/v1/chapters/focus`). The Hall of Records reads a region's Chronicle (`/v1/chapters/history`).

**Seasons** (`CHAPTER_EVENTS`, `server-account/src/npcChapters.js`). At a Season's first Turning each chapter draws
one event, weighted by what its members did (`CHAPTER_EVENT_EFFECTS`): Calm, Schism, Succession, Crackdown or Rivalry.

- Schism: two candidates stand for two of the chapter's doctrines (`chapterDoctrinesFor`: cheaper training, a deeper
  shelf, more writs). Members back a side (`/v1/chapters/back`); the side whose backers earned more Merit wins, the
  Master breaking a tie, and its doctrine holds next Season.
- Succession: `SUCCESSION_CANDIDATES` hall residents; the Master names the heir by the `SUCCESSION_TURNING`th Turning.
- Crackdown: weighted twice for the underworld; members' writs earn half again Merit; a chapter under 30 Strength at
  the Season's end has its halls shut the next Season.
- Rivalry: between `CHAPTER_RIVAL_PAIRS` in a region; the winner takes 10 Strength from the loser.

**Patrons**. A player guild bids at least `CHAPTER_PATRON_MIN` Marks in escrow for a chapter's patronage
(`/v1/chapters/patron`). At the Season's opening Turning the highest bid is spent and the rest go home
(`patronWinnerOf`). The patron's banners hang at the chapter's halls and its members pay the Thriving price.

**The living world shows it.** The hall's roll names the seat holders; the hall's people and the town's talk follow the
band and the Season (`src/net/chapterEvents.js` `chapterSeasonLines`).

## Rules

- Online, rank and reputation are the server's; offline stays DFU (Mac). As built, the service owns the twenty-two
  reputations and records memberships with their tenure; the guild book stays the save's and DFU's rank law runs on the
  client over the service's numbers (Mac approved this narrowing).
- The top ranks are limited, contested seats; lower ranks are open to all (Mac).
- Seasonal events driven by what players did; personal rank carries over (Mac).
- Nothing a rival loses is decided by the client's word: a seat goes by witnessed Merit alone.
- Daggerfall's guilds, never new ones; the servers hold their ids and nothing of FACTION.TXT.
- The quests stay separate: a guild quest runs on the player's machine and pays a bounded claim, never Merit.
- One week and one Season, the Seats' own (`src/net/townSeatLaw.js` `seasonOf`); never a cron.
- In code the word is `npcChapter`; "chapter" in the player's text.
- Every balance number lives in `src/net/npcChapterLaw.js`.
- The Chapters are switched on (`CHAPTERS_OPEN` "on", `server-account/wrangler.toml`) (Mac).

## Daggerfall Unity

DFU's guilds (`Guild.cs`, ported in `src/systems/guild/guilds.js`) keep rank and reputation in the save and move rank
by reputation and skills at most once in 28 days (`UpdateRank`). Online this is a declared departure: reputation is the service's, ranks 8 and 9 are seats, and
halls change with their chapter's Strength. Offline keeps DFU's law; its parity pins stay green.

## Code and tests

- `src/net/npcChapterLaw.js` - every number and pure rule: Roll, writs, Merit, Strength, bands, seats, events, patrons
- `server-account/src/npcRoll.js`, `npcHalls.js`, `npcMerit.js`, `npcReceipts.js`, `npcChapters.js` - the service
- `src/net/npcRollTracker.js` - the client's Roll layer and claims
- `src/net/npcHallBook.js` - halls reported
- `src/net/chapterSheet.js` - the sheet held by the playing tab
- `src/net/chapterEvents.js` - the Season's words and choices
- `test/net/` `chap*.test.js`, `audit_chap*.test.js` - each slice and audit

## Open

- A Schism's two candidates are named by every reader alike but do not walk the hall's street.
- Realm save validation (phase 3 of the Realm arc) is unbuilt; the Roll bounds claims rather than validating saves.
