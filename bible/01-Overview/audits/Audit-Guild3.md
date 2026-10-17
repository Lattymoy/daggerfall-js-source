# AUDIT GUILD3 (2026-10-11) - the guilds made plain, audited

The owner, of GUILD3 (`11-Multiplayer/Guilds-Made-Plain.md`, the player guild's and the Chapters' words, ledger, rank
list, disband list, chapter card and five Season events - PR #780): **"Do a comprehensive audit and ensure absolute
perfection"**. This page is the findings, each with its verdict. What the audit changed is written into the record's
sections as they now stand, each marked AUDIT GUILD3 and its id.

## How it was run

Six lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree apiece at a55a74c1b, the PR's head -
Home.md's DO NOT FIX WHILE THE VERIFIER IS READING), told to reproduce every finding (a scratch test through the real
Worker, a surviving mutant, a render, a grep) before reporting it, with main without GUILD3 (118313d43) beside them for
differentials:

| Lane | Over | How |
|---|---|---|
| S - the service | `guilds.js` (the holds, the view, the refusals, the ledger's `raw`/`out`), `index.js`, `npcChapters.js` | 106 seeded states through the real Worker in both trees (every hold alone and together, every rank leaving); `EXPLAIN QUERY PLAN` over every migration; the High Master's row-value read |
| L - the Chapters' law | `npcChapterLaw.js`, `chapterEvents.js`, `lines.js` and every reader | 22 factions x 4 bands of every line; 4 bands x 4 events x doctrine x patron x service of every price; stored rows with retired events through every reader; 138 of the arc's records re-run |
| C - the client | `guildPowers.js`, `socialPanel.js`, `noticeWindow.js`, the door and the book | each rank sentence against the law AND the service's enforcement; a fuzz of the rank list over random tables; the Settings page in every rank and state; the board probe and the Guild tab photographed at 1280 and 390 px |
| W - the words | every string a player reads, `src/` and `server-account/src/` | an acorn sweep of every string literal; every new sentence rendered; the patch notes against the code |
| T - the pins | the 45 test files GUILD3 changed, its 53 records and the 37 it re-aimed | each moved pin diffed for lost grip; 86 scratch mutants over every changed function; the retired records' laws traced |
| R - the record | the design record, the pages it edited and the ones it did not, Testing.md, the indexes, the PR | every claim against the code at the snapshot; the records re-counted from the diff; the bible's gates |

Every finding was re-read in the tree before a line moved. No lane found a crash, silver or gold minted or lost, or a
refusal that let a guild go wrongly: the service's `error` matched the old service's in all 106 states. The findings
are words that said something false (some HIGH - a player told a thing that is not so), a hold read twice and a copy
of the gate that could drift from it, one mechanic GUILD3 dropped against its own law, pins that could be switched off,
and the record.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| W1 / S1 / C2 | HIGH | An OPEN writ or contract holds its pay in escrow, so `guildHolds` listed it twice - "Withdraw the guild's writs first" and "A withdrawn writ's ... pay is still waiting ... the treasury, which is full": a guild with one open writ was told its treasury was full (the old service returned at the first and never said it) | FIXED: the escrow holds count a CLOSED writ's or contract's alone (`state IN ('filled', 'withdrawn', 'expired')`); pinned, both kinds; first codes unchanged in all 106 states |
| S2 | MED | Those two reads walked the realm's `idx_guild_writs_unreturned`/`idx_guild_contracts_unreturned` (no statistics, as D1 has none) - every unreturned writ in the realm on every guildmaster's view, 309 us where 4 | FIXED: `+returned` keeps SQLite on the guild's own `(guild_id, state)` index; the whole statement's plan pinned (no scan, no realm-wide index) |
| T1 | HIGH | `guildHolds` was a second copy of `guildKeepsSql` typed by hand, and since GUILD3 the page's buttons wait on it: seven of its reads (a Store's `qty > 0`, a contract's and a bid's state, a battle's pending, an escrow's `> 0`, a contract's escrow, the dedupe) could be broken with no test failing | FIXED: ONE LIST (`GUILD_HOLDS`) read by the gate (`guildKeepsSql`) and the view (`GUILD_HOLDS_SQL`); a parity pin seeds every table in every cleared and every holding state and asks both; the seven survivors dead |
| W2 / C3 | HIGH | GUILD3b made the ledger's `who` each silver line's subject, and the service writes a label there for every line it made: "A Sellsword hired a Sellsword for 1,500 silver", "<an auction's id> collected a Tithe of 12 silver", "log:oak posted a guild writ of 300 silver", "The registry had a struck Charter's fee refunded"; the pin named a `who` the service never writes | FIXED: the member is the subject only where the service writes their name (`GUILD_SILVER_MEMBER_KINDS` - read off every writer); every other line is the guild's ("The guild hired a Sellsword for 1,500 silver"), its words worded for it |
| W3 / C6 | HIGH | "Everything a Member may" was false for the Officer and the Guildmaster: a Member fills its guild's own writs and is paid by its contracts, an Officer and the Guildmaster never (`writDeliverMay`, `contractPaidMay`) | FIXED: rows read off those rules; the list says what a rank may NOT do - "Everything the Member may except fill the guild's own writs for their pay or be paid by the guild's own contracts, and: ..." |
| C1 / T2 | HIGH | One `marks-full` refusal held Disband and Leave off for the session: a code no view re-reads stayed listed, the list held the buttons, and the press that would have asked again was the one it disabled (a regression: before GUILD3 the buttons read gold, hall and vault alone) | FIXED: a refusal's word is LISTED, never a lock - only what the view and the page can see again hold the buttons; pinned with two presses |
| W4 / C6 | MED | Acts the service gates by rank outside the four tables were unworded: a Sellsword hired (the guildmaster's), any writ or contract withdrawn (the guildmaster's; an Officer its own), the guild's call for members on a town board (`invite`) | FIXED: worded, read where the service gives them |
| C4 | MED | "set how much silver may be spent on guild writs each week" - the budget binds the Officers alone, counts contracts too, and stands at 0 until set | FIXED: the Officer posts "within the weekly budget the guildmaster sets"; the guildmaster sets "the Officers' weekly budget" |
| S3 / R9 | LOW | The silver the guildmaster's account has no room for was said only once nothing else held, after a press - one reason a press, what GUILD3c says it ended | FIXED: a hold of the one statement (`marks_full`, the sweep's own test), last; the view and every refusal carry it; the page says it in the going's own terms (`GUILD_KEEPS_WORDS`) |
| S4 / T3 | LOW | Which way a line between two guilds runs was unpinned: `out` without "this guild" would read a received Conscription as paid | FIXED: a Conscription received and a fealty share paid, through the real Worker |
| R1 | MED | The record called the Decline a duplicate of Failing - it is not: the Decline took 2 Strength a week unless the week's Merit met twice the target, and the Failing band moves no Strength. GUILD3e DROPPED the fall, against its own law 1 (CUT A DUPLICATE, NEVER DEPTH) | FIXED IN THE LAW (decided): the fall is the Failing band's - every week a chapter begins Failing, 2 more after the step unless the Merit meets twice the target, never under 0 (`failingWeekAfter`, the service's every Turning), said on the band's line - as the Ascendant band holds the Ascendancy's tenth every Ascendant week |
| L1 | MED | Two older records survived: `CHAP6A-SVC-LIVE` (an event read whatever its Season) had died only on the retired Decline's pin, and the case is real (a chapter not confirmed at the draw keeps last Season's row - at its end a stale Crackdown would shut its halls, a stale Rivalry swing 10); `CHAP6E-SVC-COUNTED` mutated a variable nothing read | FIXED: a pin - last Season's Crackdown and Rivalry shut nothing, swing nothing, write no row; the dead variable gone and its record retired |
| L2 | MED | The Duties line promised "and Merit" to a member who cannot earn it (before a week in the guild, at the cap, the week's Merit another chapter's) - against AUDIT CHAP3 C8 and the card's own Merit line | FIXED: one rule (`meritEarnsOf`), the writ card's and the line's |
| L3 | MED | A shut hall's card said its band's prices, shelf and writs beside "The chapter's halls are shut this Season" | FIXED: none of them where the halls are shut; a Failing chapter's fall and an Ascendant's High Master still said |
| L4 | LOW | Steady's "usual prices, shelf and writs" promised a shelf and prices to halls that keep none (the Fighters Guild, Kynareth, the orders, the hidden guilds) | FIXED: the usual of what the hall HAS |
| L5 / W8 / T14 | LOW | "and its Master is High Master" was said with the chair empty and `CHAPTER_TITLES` off, while the hall's roll said "Master of the chapter" | FIXED: a rule of the band ("whoever holds its Master's chair is its High Master"); the roll names an Ascendant chapter's "High Master of the chapter" |
| L6 | LOW | A patron's members paid Thriving's price or better, and nothing said so; the band's line was false for them | FIXED: the patron line says what the patronage buys where the hall sells training |
| W5 | MED | "Tribute" meant the seat's and a vassal's 5% to its liege on one page - told apart by a capital | FIXED: the vassal's is its "fealty share" on the ledger and "in fealty to" in the Chronicle |
| W6 | MED | "arms" (the page, GUILD3's rank list) and "heraldry" (two sentences) for one thing | FIXED: arms |
| W7 | MED | At a temple DFU titles rank 8 "Master" and rank 9 "Patriarch" (`TEMPLE_RANK_TITLES`), so the board's "The Temple of Arkay's Master asks for ..." named another rank | FIXED: "the ... chapter's Master"; DFU's titles stay DFU's (Port-Doctrine), said in the words table |
| W9, W10, W13 | LOW | "Elsewhere": a Chronicle is read, not run; the primer's dashes, and "win the towns" where only seats can be won; "Before the guild can go" named no act on the page | FIXED: each reworded; "Before the guild can be disbanded" |
| W11 | LOW | One act, two words in one panel ("grant or revoke"/"grant or take back"; "as many as they like"/"any number"; "pacts"/"Pact"; "its works"/"a fortification") | FIXED: one each - the page's own ("the Works", "any number") |
| W12 | LOW | The card's lines without full stops beside ones with; "half again the writs" where only the chapter's move; the patron's tag `[GLN]` where every guild's is `<GLN>` | FIXED |
| W14 | LOW | The chairs' fallback was the retired word "a seat" | FIXED: "a chair" |
| W15 / C10 | LOW | One rule, three sentences: the Treasury's "a new name", the rename's "a new name or tag", the Hall section's "a hall" alone; and the Treasury told a guild with a hall it "can buy a hall" | FIXED: one sentence (`guildRealmGoldText`; `guildHallGoldText` its alias); a guild with its hall, the name alone |
| C5 | LOW | The vault half of the rank composer lied under two table shapes (a rank with no place above one that puts in; a rank with no gold deposit never had its vault said) | FIXED: the vault its own row; the composer pure over its acts (`rankLinesOf`) and fuzzed over 3,000 random tables, each line parsed back into the acts it claims |
| C7 | LOW | The article guessed: "a Honoured Blade", "an Unit Captain", "a The Unsworn" | FIXED: "the Officer"; a name that begins "The" as written |
| C8 | LOW | Disband waited on a list read only when the tab opened (every 30 s): a hold cleared elsewhere kept the button off | FIXED: the Settings page reads the guild again as it is turned to |
| C9 / T8 | LOW | Unpinned: a refusal's list kept for another guild, the rank list folded, a lone guildmaster's Leave's reason, the press clearing the list | FIXED: pinned |
| T4, T5, T6, T7 | LOW | Unpinned: a guildmaster with members told the hand-over AND the rest; the gold before the hall; an Officer's view carrying no list; the client's hold codes against the service's; the door's bound of sixteen | FIXED: pinned (the codes swept against `GUILD_HOLD_KEEP_CODES`) |
| T9 / R14 | LOW | The primer, Elsewhere and its heading pinned only against themselves; 7 of the 25 silver words exact, an incoming kind worded "paid" passing; the record called a hand list a sweep | FIXED: literals; the record says what the list is |
| T10 | LOW | `CHAP3A-CARD-LINES` died only on a regex GUILD3 wrote | FIXED: killed on the rendered board too |
| T11 | LOW | `CHAP6E-SVC-ASC-SEASON` named a Season no longer in the law; the High Master read's narrowing (never every Ascendant row) unpinned | FIXED: `CHAP6E-SVC-ASC-NARROWED`; the read's plan pinned by the chapters' key, two records |
| T12 | LOW | Testing.md's mutant counts (chap5a, chap6a, chap6c, chap6d, chap6e) and the chap6a/chap6e rows' clauses still the retired law | FIXED |
| T13 | NOTE | `GUILD3e-the-ascendant-succession-gone` was `CHAP6A-W-ASC-SUCC` again | FIXED: retired (guild3.json 52) |
| T15 | NOTE | Two rank-composer branches no table reached; `guildKeepsOf`'s `leave` option never passed by the page | FIXED: the composer rewritten and fuzzed; the option gone - the hand-over is the Leave button's alone, never on the list |
| R2, R3, L7 | MED | Chapters-Arc's status note said every change stood "below"; fourteen passages still read as the law of before (the five events, Ascendant's 0.9 and its High Master by Season, the patron's 0.9, the chairs and council, the receipt cards) | FIXED: each marked "(GUILD3: ...)" where its law moved; Appendix A's Decline row the Failing band's fall |
| R4 | MED | Eight files moved pins unmarked; the list omitted the eighteen `acct112` files | FIXED: marked; the list whole |
| R5 | MED | "thirty-three ... thirty-two re-aimed", and "eight more" - the diff holds thirty-seven re-aimed and one kept | FIXED: thirty-eight, twenty-nine and eight re-aimed, one kept |
| R6, R7, R8, R10, R12, R13 | MED-LOW | The Treasury's function named wrong; "three lines" of two; law 5's "one answer that grows" of three; section 1 present-tense of the old; "section 4" for 5; "through `marksText`" of a sentence with no amount | FIXED |
| R11 | LOW | Seats-Arc's other Stores-chest places and the result card's "50 Marks" | FIXED |
| R15 | NOTE | "pinned equal" of two constants each pinned to the epoch's formula; the Guild-Overhaul page table; two stale host comments | FIXED; the PR's "26 files, 342/342" and "61 run, two lived" are runs' counts, not the tree's - RECORDED |
| L-N1 | NOTE | The price floor fell slightly (training with its doctrine 0.72 against 0.729) - no arbitrage: the band reaches training and spells alone, neither resold; the shelf is priced by DFU and the seat | RECORDED |
| L-N2 | NOTE | The mint's `chapterTitlesOfAccount` reads Strength without settling a due Turning first: for the minutes between a week's end and the first settling read, a High Master can sign off the week before | LEFT: `CHAPTER_TITLES` is off; the sheet settles first; minutes |
| L-N3, L-N4 | NOTE | The draw walks five weights however many it is handed (no caller hands more); a richer shelf moves nothing at a hall already at quality 20 (DFU's clamp, before GUILD3) | RECORDED |
| C6 (the rest) | NOTE | The vault and a home's placements need an online character of the realm - unworded on the rank list | LEFT: a character's kind, not a rank's; the refusal says it ("Only an online character of the realm can do that.") |
| W notes | NOTE | "seat" at a card table and a family's seat; "Ascendant" the Sigil's top stage; "patron" the card tables'; the town talk's "officer" (the watch) | RECORDED in the words table: ordinary speech, no guild's |

## Decided

At the owner's standing word ("These are all of your decisions"), each his to overrule:

- **R1 - the Decline's fall is the Failing band's.** GUILD3e folded two events into the bands they stood for; the
  Ascendancy's tenth and High Master went to Ascendant every week, but the Decline's fall went nowhere. Moved, not
  cut: a Failing chapter loses 2 more each week its members' Merit lifts it by less than 2. It was drawn a Season at a
  time (about one Failing Season in four); it is now every Failing week, as Ascendant's boon is every Ascendant week.
  The Chapters are the developers' (`CHAPTERS_OPEN = "dev"`): no live chapter moves.
- **W2 - a line the service made is the guild's.** Naming the member who pressed (the escrows' `actor`) would read
  the ledger's accounts into the view; "The guild hired a Sellsword" is true and needs nothing more.
- **S3 - the silver's room is a hold.** Said before the press with the rest; the older client's `error` stands.
- **C1 - a refusal's word is listed, never a lock.** The page's buttons wait on what it can see again.

## What stands

- `test/net/audit_guild3.test.js` (16); `tools/mutants/audit_guild3.json` - 55 records, all dead (two survived the first
  run - the leave's account read through the elimination fallback, and the dedupe - and their pins were made to fail
  them).
- `tools/mutants/guild3.json` - 52, all dead (`GUILD3c-a-disband-asked-a-hand-over` re-aimed at the known map once
  the `leave` option went). The seventeen older records the audit moved, all dead (`CHAP7B-SHEET-TAG` re-aimed again
  when its first re-aim would not parse); `CHAP6A-SVC-LIVE` dies on the new pin too.
- The service is `acct114` - GUILD3's `acct112` renumbered past SCALE4f + SCALE4g + SCALE4h, then GUILD-SEEN's `acct113`, at the merges of main, the audit's service changes riding it (none of GUILD3 has shipped); no migration; no relay change.
- Not verified here: a live account service; the real game with ARENA2 data.
