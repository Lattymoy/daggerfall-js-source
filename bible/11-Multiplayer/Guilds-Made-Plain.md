# THE GUILDS MADE PLAIN - one word, one thing, every rule before the press (GUILD3, 2026-10-11)

The port's own. Both guild systems online - a player's guild (GUILD1, GUILD2: `06-Systems/Online-Arc.md`,
`Guild-Overhaul.md`; its seats, `Seats-Arc.md`) and Daggerfall's guilds held online (the Chapters, `Chapters-Arc.md`) -
read whole as a player meets them, and made easier to understand without taking a mechanic away that does its own job.
Offline is DFU 1:1 and untouched (Port-Doctrine; Chapters-Arc law 1).

AUDITED the same day (the owner: "Do a comprehensive audit and ensure absolute perfection"): `01-Overview/audits/Audit-Guild3.md`,
six cold lanes over a frozen snapshot. What it changed is written into the sections below as they now stand, each
marked AUDIT GUILD3 and its finding's id.

## Asked

The owner: "I want to talk about simplifying the player guild and npc guild system from being too overcomplicated.
Keeping depth, but making it easier to understand." Then, of the four questions put back (who is getting lost; the
Chapters' cuts; the renames; a design record first): "These are all of your decisions. Be extremely thorough and do
your best work."

## 1. What a player met before GUILD3 (FACT, 2026-10-11, at 118313d43)

Three layers, each with its own room to move:

| Layer | Switch | Room |
|---|---|---|
| DFU's guilds - the four, the eight temples, the ten orders (`systems/guild/guilds.js`, `guildVariants.js`, `guildServices.js`) | always | None: Port-Doctrine's 1:1 list. Nothing here touches them. |
| A player's guild and its seats (GUILD1, GUILD2, SEAT1-SEAT2, CROWN1-2, SEASON1) | `SEATS_OPEN = "on"`, `MARKS_OPEN = "on"` | Words and pages freely; a mechanic's change moves live rows and needs a migration. |
| The Chapters (CHAP1-CHAP7) | `CHAPTERS_OPEN = "dev"`, `CHAPTER_TITLES = "off"` (`server-account/wrangler.toml`) | Free: the developers' rows alone. |

Some seventy nouns stand between a new member and the whole of it - about forty-five of the player's guild and its seats,
twenty-five of the Chapters. The depth is not what makes it hard. Four things are:

1. **One word, several things.** "Seat" is a town's Charter and a chapter's rank 8 or 9. "Officer" is a player guild's
   rank 1 and a chapter's rank 8. "Hall" is a guild's hall, a chapter's hall, a palace's Charter Room and the "hall
   writ" on a board. A chapter's writ, a member's own writ and a receipt's ask are three cards on one board, two of them
   called "Hall writ". "Marks" still stood in three of the sentences that say silver everywhere else
   (`siegeLink.js` `siegeHonourLine`'s "Your Honour: 50 Marks", the registry's struck seat in `townSeatLaw.js`
   `chronicleLine`, the day's reset in `systems/eventTimers.js`).
2. **Two mechanics doing one job.** Two of the Chapters' seven Season events stand for a band: a **Decline** (2
   Strength more a week unless the week's Merit meets twice the target - drawn most by a Failing chapter) is the falling
   a **Failing** chapter is in, which the band never said, and an **Ascendancy** (a tenth off, "High" on the Master's
   title) is what **Ascendant** should say - and did not, Ascendant's prices standing exactly at Thriving's (`CHAPTER_BANDS`:
   0.9 both). A player reading "Ascendant" on the board and "the chapter is ascendant this Season" under it was reading
   two systems for one idea. (AUDIT GUILD3 R1: this said the Decline "is what Failing already says" - it is not: the
   band moved no Strength. Its fall is the band's now - section 5, GUILD3e.)
3. **A rule the screen never says.** A guildmaster pressing Disband is told ONE reason (`whyNotGone`: the first of
   a dozen, in its order), clears it, presses again, and is told the next - the Settings page itself names three. The
   silver treasury's ledger words every line it does not know as a deposit (`GUILD_MARKS_LINE_KIND ?? 'deposit'`): a
   Tribute, an upkeep, a claim fee, a writ's escrow and a patron's bid - each silver LEAVING the treasury - read "Alda put
   in 1,000 silver". What each rank may do is four tables in four modules (`GUILD_POWERS`, `HALL_POWERS`,
   `WRIT_POWERS`, `SEAT_POWERS` and `SEAT_LEVER_RANKS`) and no page says any of them; a Member and a Recruit hold the
   same powers and nothing says so. Only the gold realm characters put in buys a hall or a new name (`realm_gold`), and
   the Treasury page - where the gold is - never says it (the Overview says it only to a guild with no hall).
4. **The board's Work tab is a wall.** Every chapter's Strength, Focus, Season, backing and patron stood as loose lines
   above the cards, every member's Merit line above those, with nothing saying which chapter a line belonged to past
   its own sentence - and nothing at all saying what a band DOES to a hall.

The board's Seat tab was held already plain here (BOARD-UI, 2026-10-06: panels by name, the week on a strip, "How the
seat war works" folded under its line). A player said otherwise the next day ("extremely vague ... doesnt explain
anything"): the guide stood folded below the first screen, and most of the tab's words were defined nowhere on it.
PLAIN-UI (`10-UI/Plain-Words.md`) put what a seat is, the reader's next step, the guide and the tab's words first, and
How chapters work over the Work tab's chapter cards.

## 2. The laws this arc keeps

1. **CUT A DUPLICATE, NEVER DEPTH.** A mechanic goes only where another already does its job; what it said that the
   other did not moves to the other (an Ascendancy's tenth off and its High Master go to the Ascendant band; a Decline's
   weekly fall and its line in the town's talk go to Failing's - the fall dropped at first, and moved by AUDIT GUILD3 R1).
2. **ONE WORD, ONE THING - IN WHAT A PLAYER READS.** The words change; the ids on the wire and in the tables do not
   (`seat`, `chapterofficer`, `npc_chapter_seats` stand). A rename that moved a wire id would be a relay bump for a
   word.
3. **EVERY RULE A REFUSAL ENFORCES IS SAID BEFORE THE PRESS** - and where the client cannot know it, the refusal says
   EVERYTHING that stands, never the first thing.
4. **A LEVER SHOWS WHERE IT CAN BE PULLED.** Already the Seat tab's law (BOARD-UI); the Guild tab's rank table says the
   rest.
5. **OFFLINE IS DFU; LIVE ROWS DO NOT MOVE.** No live table changes shape. The answers that grow - the silver lines
   (`raw`, `out`), the guildmaster's view (`keeps`), a refused going (`keeps` beside its `error`) - keep every field they
   had, so a client from before reads each as before (AUDIT GUILD3 R8: this said one answer grew).

## 3. The four calls, decided (the owner: "These are all of your decisions")

| The question | Decided | Why |
|---|---|---|
| Who is getting lost - a new member, or a guildmaster running it? | **Both, by disclosure.** Nothing a guildmaster uses is cut; what a member does not need is folded or said once, where it is used. | The depth is the guildmasters'; the confusion is everyone's. |
| The Chapters' cuts | **Seven Season events to five** (Calm, Schism, Succession, Crackdown, Rivalry); **three writ cards to two** (a chapter writ and your chapter writ; the receipts' asks become the chapter's Duties line). | Decline and Ascendancy each stand for a band, and what they do moves into it (law 1): the Decline's weekly fall to Failing (AUDIT GUILD3 R1), the Ascendancy's tenth and High Master to Ascendant. NARROWED from the four first put to the owner: Schism and Succession were to merge into one "Contest" - read whole, they are the owner's own "schisms, ... new guildmasters" (Chapters-Arc, his words), share their backing already (`chapterBackOk`), and differ in what they decide (a doctrine; the hall's head) - both stay. |
| The renames | **Silver everywhere a player reads**; a chapter's ranks 8 and 9 are its **Master's chair** and three **council chairs**, its rank 8 a **Councillor**; a chapter's writ a **chapter writ**. | NARROWED from "offices" first put: "an officer's office" reads as nothing, and "officer" stays the player guild's rank 1 alone. "The Roll", first put to go, STAYS - the one place a player reads it is the hall's book naming the chapter's Master and council, which is what a roll is; the service's reputation track was never shown by that name. |
| A design record first | **Yes** - this page, then the slices. | The arcs' own way (Seats-Arc: "Make sure we're documenting everything before building"). |

Considered and NOT done, each with its reason:

- **Merit and seat Influence as one currency.** Both are witnessed work, capped, settled at the Turning - but Merit is a
  character's at a chapter and Influence a guild's at a town, and a member does both at once (a gate is 300 Influence
  and 50 Merit). One currency would make one act pay twice from one pool, or once to one of them. Kept two; each is now
  said where it is earned.
- **Standing and Strength as one "Favour" meter.** Their lines differ (Standing: Unrest under 20, Loved at 80; Strength:
  Failing under 20, Thriving at 70, Ascendant at 90) and Standing is live. One word over two scales would be a third
  thing to learn.
- **The vault and the guild Stores as one store.** Items and materials obey different laws (a slot a piece and a
  grant per member; a count a material and "your own deposit back"), on two live tables. They stay two pages; the
  chests already open the vault with the Stores a page beside it (section 5, GUILD3a).
- **The four power tables merged in code.** Each lives beside the law that asks it (`guildMay`, `hallMay`, `writMay`,
  `seatMay`) and the service reads them there; merging moves four modules' imports for no player's gain. A composed
  view says them instead (GUILD3c), and a sweep fails the suite on a power with no words.
- **A price's reasons in a hall's own window.** The training and spell windows are DFU's native windows (Home.md, THE
  NATIVE-WINDOW RULE): no element without its DFU source. The board's chapter card says what the band does instead
  (GUILD3d).
- **`SEAT_WEEK_ZERO_S` (writLaw) and `SEAT_WEEK0_MS` (townSeatLaw) as one export.** One instant, twice - each pinned to
  the epoch's own formula (`test/net/audit31_law.test.js` the writs', `test/net/seat1a_client.test.js` the seats'), so one through
  the other (AUDIT GUILD3 R15: this said "pinned equal"); importing townSeatLaw into writLaw would carry the seats' graph
  into every writ reader. Left, pinned.

## 4. The words - one word, one thing

| A player reads | It means only | It used to mean too |
|---|---|---|
| **silver** | the online currency (code: `marks`, `MARKS_*`) | "Marks" in three sentences; "Drakes" in older records |
| **seat** | a town's Charter - a palace or a crown (Seats-Arc) | a chapter's rank 8 or 9 |
| **the Master's chair**, **a council chair** | a chapter's rank 9 and rank 8 (code: `seat`, `master`, `officer`) | "the Master's seat", "an officer's seat" |
| **Councillor** | a chapter's rank-8 title ("Councillor of the Fighters Guild, Anticlere"; the token id stays `chapterofficer`) | "Officer of the ...", beside the player guild's Officer |
| **Officer** | a player guild's rank 1 | a chapter's rank 8 |
| **chapter writ** | a chapter's shared delivery writ (code: kind `hall`) | "Hall writ" |
| **your chapter writ** | a member's own writ for its chapter, which earns Merit (kind `member`) | "Your writ" |
| **Duties** | what a chapter asks of its members in its region - a gate held, a raid defended - and what each earns them (code: the receipts' asks and credits) | a "Hall writ" card with no Take; "Honours" stays the sieges' alone (Seats-Arc 6.8) |
| **hall** | a guild's hall - a player guild's (GUILD1d), or one of Daggerfall's guilds' halls | the board's "Hall writ" |
| **Tribute** | what a guild pays at the seat it pledged (Seats-Arc 7.3) | a vassal's 5% to its liege - its **fealty share** now, on the ledger and in the Chronicle (AUDIT GUILD3 W5) |
| **arms** | a guild's heraldry, the Guild tab's "Arms" page | "heraldry" in two of its sentences (AUDIT GUILD3 W6) |
| **the Works** | a held seat's building projects, the Seat tab's own heading | "a fortification" on the ledger (AUDIT GUILD3 W11) |
| **the chapter's Master** | the holder of a chapter's Master's chair - so the Focus line says "the Fighters Guild chapter's Master" | DFU's own rank titles stay DFU's: a temple's rank 8 is titled "Master" and its rank 9 "Patriarch" (`guildVariants.js` `TEMPLE_RANK_TITLES`) - Port-Doctrine keeps them (AUDIT GUILD3 W7) |

"Seat" stays ordinary speech where it is no game term - a seat at a card table, a family's seat - and "Ascendant" the
Sigil's top stage beside the band's; neither is a guild's (AUDIT GUILD3's words lane, NOTED).

## 5. The slices

### GUILD3a - the words

- The chapter's chairs: every sentence a player reads of a chapter's rank 8 or 9 (`npcChapterLaw.js` `seatLineOf`,
  `bookCappedLine`, `chapterChronicleLine`, `chapterSeasonLine`'s 'season' row, `chapterRollLines`,
  `CHAPTER_TITLE_WORDS`; `ui/playerBadge.js` `TITLE_TEXT`'s two fallbacks).
- The writ cards (`ui/noticeWindow.js` `writNode`): "Chapter writ", "Your chapter writ".
- Silver: the three sentences that still said Marks - the Honour and the refund through `marksText`, the day's reset
  by its word (AUDIT GUILD3 R13).
- The record: Seats-Arc 7.2 and 8.2 said the hall's cupboards and the throne room's chest are the guild Stores; since
  GUILD2b every one opens the guild's VAULT, the Stores a page beside it (`scenes/world.js` `openStores`). Said there.

### GUILD3b - the ledger says which way

- The service's silver lines (`server-account/src/guilds.js` `viewOf`) carry, beside the `kind` they always carried,
  the ledger's own kind (`raw`) and its direction (`out`: the line left the guild's treasury). A client from before
  reads `kind` as it did.
- The tab words a line by its own kind where it has words for it (`GUILD_SILVER_LINE_WORDS`: a Tribute, an upkeep, a
  claim fee, an Edict, a fort's work, a writ's or contract's or bounty's or Sellsword's or Royal Tourney's or patron's
  escrow and its return, a Tithe and a Conscription come in, a patron's bid), and by its direction where it has none
  ("paid", "received") - never "put in" for silver that left. Its subject is the member who acted only where the service
  writes their name (`GUILD_SILVER_MEMBER_KINDS`: a deposit, a withdrawal, the arms, a deed, a contract put up, a Tribute,
  a patron's bid); every other line is the guild's ("The guild hired a Sellsword for 1,500 silver") - AUDIT GUILD3 W2: the
  service's own labels ('A Sellsword', 'The Turning', a writ's material, an auction's id) had read as the sentence's
  subject. The test pins words for each of the 25 guild-touching kinds of `marksLaw.js` `MARKS_KINDS` it names, every one a
  literal (AUDIT GUILD3 R14/T9: a hand list, not a sweep of the ledger's kinds, which name no guild end).

### GUILD3c - every rule before the press

- **What stands in the way of going.** The service reads everything that holds a guild in ONE statement
  (`guildHolds`: gold, the guild Stores, a standing writ or contract or a CLOSED one's pay still on its way home, the
  hall, the vault, a Charter, a battle, a patron's bid, and last the silver the guildmaster's account has no room for),
  and the guildmaster's view carries it (`keeps`), so the Settings page says it under "Before the guild can be
  disbanded" BEFORE any press, each in the refusal's own sentence, and Disband - and a lone guildmaster's Leave - wait on
  it, saying why ("clear the list above first"). A refusal names the whole list too (`keeps` beside its `error`, the
  first as it always was): the hand-over a leave needs, and every code to a page whose service is older than its view's
  list. A disbanding asks no hand-over (it takes the members with it - the Leave button says its own). First built from
  the refusal alone; the photographs showed a guild whose gold held the button never learned the rest without clearing
  the gold first, so the view carries it now. The refusal's reads went from up to twelve statements to two.
  AUDIT GUILD3: the holds are ONE LIST (`GUILD_HOLDS`), read by the gate (`guildKeepsSql`) and the view alike (T1 - the
  view's had been a second copy typed by hand); an OPEN writ's escrow is its own hold, never also "the treasury full"
  (W1/S1); every read walks the guild's own index, its plan pinned (S2); the silver's room is said before the press (S3);
  a code a past refusal said that nothing re-reads is listed but never holds the buttons (C1/T2); and the page reads the
  guild again as Settings is turned to (C8).
- **What each rank may do.** `src/net/guild/guildPowers.js` composes the four power tables and the vault's defaults into one
  list in words (`GUILD_RANK_ACTS`, `guildRankActsText`), each line's ranks read off its own table at the call - a
  table moved moves the page. The Members page folds it under "What each rank may do": each rank's acts, the
  guildmaster's grants of the vault named as what can change a member's. A sweep fails the suite on a power any of the
  four tables holds that the list does not word. AUDIT GUILD3: what a rank may NOT do is said ("Everything the Member
  may except fill the guild's own writs for their pay or be paid by the guild's own contracts" - W3, off `writLaw.js`
  `writDeliverMay` and `contractPaidMay`); the acts the service gives the guildmaster by rank alone (a Sellsword hired,
  any writ withdrawn) and the town board's call for members are worded (W4); the writ budget is the Officers' (C4); the
  vault is its own line (C5); a rank is named as its guild wrote it, never with an article guessed (C7). The composer is
  pure over its acts (`rankLinesOf`), and a fuzz of 3,000 random tables parses each line back into the acts it claims.
- **The treasury's two golds.** The Treasury page says, at its top, how much of the gold can buy a hall, or a new name
  or tag (`guildRealmGoldText` - HALL-GOLD's sentence grown; AUDIT GUILD3 R6 named the wrong function here) - where the
  gold is, not only where a hall is bought; a guild that holds its hall is told the name alone (C10), and the Hall
  section says the same sentence (`guildHallGoldText` its alias - W15: one rule, one sentence).
- **A guild in one look.** With no guild, the tab says in two lines (AUDIT GUILD3 R7: this said three) what one is for:
  its members' two treasuries, a vault and, once bought, a hall under its own arms; the seats of the Iliac Bay to hold.
  In one, the Overview says where the rest of it is run: seats and sieges from a seat town's Notice Board (its Seat tab,
  where its Chronicle is read - W9); guild writs and contracts from any board's Work tab.

### GUILD3d - the chapter card (the Chapters, 'dev')

- The Work tab draws each chapter of the region as one panel (`notice-chapter-card`), its guild's name and band its
  heading: the band's line and, new, **what the band does** (`chapterBandEffectsLine`: "Training and spells a tenth
  cheaper, a richer shelf, half again the chapter writs."); the reader's Merit there; its Focus; its Season and the
  sides to back; its patron and the guildmaster's bid; and its **Duties** - a gate held and a raid defended, what each
  earns, and the reader's first of each today done or still to come (`chapterDutiesLine`). The receipts' asks leave the
  grid of cards: they had no Take, and a card that cannot be taken is no writ.
- AUDIT GUILD3: the Duties promise Merit only where the reader's Merit row says it earns some (L2 - AUDIT CHAP3 C8's rule,
  `meritEarnsOf`, one law for the writ card and the line); halls shut this Season say no band of prices, shelf or writs
  (L3); Steady says the usual of what the hall HAS (L4); the High Master is a rule of the band ("whoever holds its
  Master's chair is its High Master" - L5/W8), and the hall's roll names an Ascendant chapter's Master its High Master;
  the patron line says what the patronage buys where the hall sells training, its tag `<TAG>` as every guild's (L6/W12);
  the band names the CHAPTER's writs, a Court's moving by no band (W12); and the Focus line names "the chapter's Master" (W7).
- A Merit line for a chapter the board draws no card for (a service from before) stands above them, as before.

### GUILD3e - five events (the Chapters, 'dev')

- `CHAPTER_EVENTS` holds Calm 30, Schism 15, Succession 10, Crackdown 10, Rivalry 15; `CHAPTER_EVENT_EFFECTS` loses the
  Decline's and the Ascendancy's numbers; `declineAfter` goes as an event's.
- **The Failing band carries the Decline's fall** (AUDIT GUILD3 R1 - GUILD3e had dropped it, against law 1): a chapter
  that begins its week Failing falls `CHAPTER_FAILING_FALL` (2) more after the week's own step, unless the week's Merit
  meets `CHAPTER_FAILING_MEETS` (2) times the target, never under 0 (`failingWeekAfter`, the service's every Turning);
  the band's line says it ("- and it loses 2 Strength more each week its members' Merit lifts it by less than 2"). The
  Decline drew a Season at a time, most of all for a Failing chapter; the band holds it every Failing week, as the
  Ascendant band holds the Ascendancy's tenth every Ascendant one.
- **The Ascendant band is its own** (`CHAPTER_BANDS`): training, a spell bought and a spell made **a fifth off** (0.8 -
  the Ascendancy's further tenth over Thriving's, rounded to a fraction a player can hold), the shelf and the writs as
  Thriving's. Its Master is **High Master** while the chapter stands Ascendant (the service reads the Strength the sheet
  carries, `CHAPTER_ASCENDANT_FROM`, where it read the Season's event), and High Master stays a title only
  `CHAPTER_TITLES` can sign.
- **A patron's members pay the better** of the chapter's band and Thriving's (`chapterHallFactor`): an Ascendant
  chapter's patron is never charged more than a stranger.
- **What was said of them goes to the band.** The town's talk of a Decline joins Failing's lines, of an Ascendancy
  Ascendant's (`systems/livingWorld/lines.js` `CHAPTER_NEWS`).
- **A Season already drawn.** The developers' rows may hold a Decline or an Ascendancy for the Season under way: read
  back, an event the law no longer names is none (`heldEvent`'s `chapterEventOk`), so the chapter's Season is Calm from
  the next read and its Turning moves its Strength by the week alone. The Chronicle keeps its words for both
  ("At the end of the Season of Morning Star, the Fighters Guild stood ascendant.") - a row written is history. An
  event is THIS Season's alone at its end (AUDIT GUILD3 L1: a chapter not confirmed at the draw keeps last Season's
  row, and only the Decline's pin had held that its event acts no more).

## 6. The threats, and the answers

| Threat | Answer |
|---|---|
| A word changed on the wire breaks an older relay or client | No id moves (law 2): the token's titles, the tables' kinds, the writs' kinds stand; only sentences change |
| A ledger line an older client reads wrong | `kind` stands as it was; `raw` and `out` are new fields an older client never reads |
| A refusal's list read as a law by a client | `keeps` is words for a page; the service's batch still refuses on its own reads (`guildKeepsSql`) |
| The guildmaster's view one read heavier | One statement, the guildmaster's alone, each EXISTS on the guild's own index - its plan pinned (AUDIT GUILD3 S2: two escrow reads had walked the realm's unreturned writs) |
| The page and the gate disagree | One list of holds read by both (AUDIT GUILD3 T1), and a parity pin over every table in every state |
| A refusal's word the page cannot re-read locks its buttons | Listed, never a lock: only what the view and the page see hold them (AUDIT GUILD3 C1/T2) |
| A cut that takes depth | Each cut's mechanics move to the band it stood for (law 1), and the record names where each went - the Decline's fall to Failing (AUDIT GUILD3 R1) |
| A developers' Season under way with a retired event | Read as none, its Strength the week's alone; its Chronicle row, if one was written, keeps its words |
| An Ascendant chapter's patron paying more than a stranger | The better of the two (`chapterHallFactor`) |
| A new power added to a table with no words | The sweep (`test/net/guild3_plain.test.js`) fails the suite |

## 7. The four hosts (THE FOUR HOSTS RULE)

| Host | GUILD3 |
|---|---|
| `scenes/world.js` | nothing new to wire: the Guild tab (`ui/socialPanel.js`) and the board (`ui/noticeWindow.js`) it already opens carry every slice |
| `scenes/worldModes.js` | nothing new to wire: a hall's prices read `chapterHallFactor` as before (GUILD3e's patron rule inside it) |
| `scenes/exterior.js` | FLAGGED, nothing to wire: the single-location bench has no online guild, board or chapter |
| `scenes/dungeonContext.js` | FLAGGED, nothing to wire: the standalone dungeon has no guild tab and no board; a castle's throne room (CROWN-HALL) is the streaming host's dungeon mode (`worldModes.js` `openCrownPiece`), whose chest opens the vault as every hall's does |

## 8. Pins

`test/net/guild3_plain.test.js` (the words, the ledger's words and direction, the rank list and its sweep, the disband
list on the service through the real Worker and on the page, the treasury's line, the no-guild primer, the chapter card,
the five events, the Ascendant band and its High Master, the patron's price) and `tools/mutants/guild3.json`; the audit's
pins, `test/net/audit_guild3.test.js` and `tools/mutants/audit_guild3.json` (`01-Overview/audits/Audit-Guild3.md`).

**The pins GUILD3 moved, each said where it stands** (`PIN MOVED: GUILD3...` - AUDIT GUILD3 R4: eight files had moved
unmarked, marked since): the chairs' and the council's words
(`chap4b`, `chap4c`, `chap4d`, `chap5a`, `chap6a`, `audit_chap4`); silver (`seat2a_siege_play`, `audit_seats_client`,
`audit_seats_service`, `cap_off`); the writ cards (`audit_chap2`, `chap3a`); the chapter card (`chap2b` - the asks are
Duties now, `chap3a`, `chap3b`); the five events (`chap6a` - the weights and the draw's goldens over five, a retired
Decline moving nothing, the Chronicle's reader over a Crackdown; `chap6c`; `chap6d`); the Ascendant band (`chap3b`,
`chap3c`, `chap7b`) and its High Master by the band through the real Worker (`chap6e`); the refusals' whole list
(`guild1`, `guild2_service`, `audit28_marks`, `auditrealm2_service`); the silver lines' site (`auditguild1d`); and the
service's version, `acct112` then `acct113` then `acct114` (renumbered past SCALE4f-h and then GUILD-SEEN at main's merges), in eighteen files (`chap1_roll`, `chap2_halls`, `duel_record`, `fb1004d_knight_house`,
`founder5`, `guild1c`, `legacy7_service`, `mail1`, `notice1`, `prof9_service`, `prof10_service`, `prof12_service`, `realm1`,
`renown1`, `renown4`, `renown_char`, `serpentset_service`, `wb5b_gate_claim`).

**The mutant records**: thirty-eight of the older records quoted text GUILD3 moved - thirty-seven re-aimed BY CONTENT
at their law's new site (twenty-nine in the first pass, the receipt card's two at the Duties line and the board's at
the card among them; eight after it, below), and `AUDIT-CHAP5-D3-OWN` kept by naming the band line's own read `sold`, so
its site stays one; every one of them killed again (AUDIT GUILD3 R5: this said thirty-three, and thirty-two plus eight). Twelve retired
with the law they tested - `CHAP6A-W-ASC-ASC`, `CHAP6A-W-FAILING`, the Decline's five (`CHAP6A-DECLINE-MEETS`,
`-TWICE`, `-FLOOR`, `CHAP6A-SVC-DECLINE`, `-FELL`), `CHAP6C-LINE-DECLINE`, `CHAP6C-LINE-ASCENDANCY`,
`CHAP6D-ASC-PRICE`, `CHAP6D-FACTOR-ASC` and `CHAP5A-LINE-PLURAL` (the council is one word for one or three).
`tools/mutants/guild3.json`: fifty-three records over every slice, every one killed - fifty-two since AUDIT GUILD3 T13
retired `GUILD3e-the-ascendant-succession-gone`, which was `CHAP6A-W-ASC-SUCC` twice. Their survivors on the way were each a pin the suite lacked or a line the code no longer needed: a refused press whose list the page never kept (pressed now), a battle's hold that no pin read (a Charter, a battle and a patron's bid through the real Worker now), and the buttons' own gold, hall and vault checks once the list held them (the buttons wait on the list alone; `GUILD1b-a-disband-with-gold-in-it` re-aimed at the list's gold line). Eight more older records moved with the code after the first pass - the version pins (`KNIGHT-HOUSE-version-unmoved`, `TECH1-AUDIT-the-service-behind-the-law`, `GATEKEYS-the-empty-var-back`), the two GUILD1b buttons, and the holds' one read (`AUDIT31-svc-escrow-word`, `AUDIT-CHAP5-E4-WORD`, `GUILD1-the-leaving-refusal-misnamed`) - each re-aimed by content and killed.

The service is `acct114` (`acct112` then `acct113` on its branch, renumbered past SCALE4f + SCALE4g + SCALE4h and then GUILD-SEEN at the merges of main): its law moved (the ledger's lines, the refusal's list, the Turning's Decline the Failing
band's, the High Master by the band). No migration, no relay change. AUDIT GUILD3's service changes (the holds' one
list, the silver's room, the escrow's state) ride the same version: none of it has shipped.
