# AUDIT GUILD-WORDS (2026-10-16) - the guild system's words, audited twice: SEAT-LINE, SEAT-WORDS and STANDING-WORDS

Mac, of the two slices that made the online guild system say what it does (`01-Overview/bugs/Field-Bugs-2026-10-15g.md`:
SEAT-LINE at b0979d15, SEAT-WORDS and STANDING-WORDS at e66827ac): **"Lets audit everything"**. This page is the audit
of both - the law they read, the online pipeline that says the standing, every word in English and in the thirteen
whole languages, the tests and the mutants, the records - and of the one report the first record left open (report 3,
a Mages Guild quest's -25). Each finding has its verdict here; what it changed is written into the pages it touched,
marked `AUDIT GUILD-WORDS` with the finding's id, and in the code each fix carries the same mark. Then Mac, of the audit
itself: **"Audit this and ensure perfection"** - AUDIT GUILD-WORDS II, below, which read round I's fixes cold and
withdrew one of them (QSCRIPT-FREE, for REPUTE-GATE).

## How it was run

Six lanes, each a cold adversarial reader of a FROZEN head (e66827ac, a detached worktree - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING), told to reproduce a finding before reporting it and to end on what it checked and found sound:

| Lane | Over | How |
|---|---|---|
| L1 | the law: `guilds.js` rankNeeds/reviewDaysLeft/updateRank, `guildServiceFlow.js` serviceAccess/rankNeedsLines/probationWords, `knightlyGifts.js`, `affiliations.js`, the hosts' lines | 7 findings, each through the real modules in node |
| L2 | the online pipeline: `npcRollTracker.js`, `standingOwed.js`, `rollNoticeHost.js`, world.js's wiring, the service's answers (`server-account/src/npcRoll.js`) | 7 findings, simulated over the real tracker with an io applying the real `rollCredit`/`rollDrain` |
| L3 | is every word true: the 20 English strings against the law, and the records | 13 findings |
| L4 | the translations: 20 keys x 13 languages - placeholders, CLDR plurals, meaning, each file's own terms and register, the tutorial pages' fit | 23 findings; 260 rows checked by script, every plural rendered |
| L5 | the tests and mutants: 35 new one-site mutants beyond the 37 recorded, fixtures against their producers, loose pins | 17 survivors, 8 findings |
| L6 | report 3, fresh: any path that drops the Mages Guild 25 or holds it at -20 | the cause found; one service defect |

Besides the lanes, the touched modules' own campaigns were run again on the changed tree (594 dead, 8 equivalent as
recorded, none survived). 66 findings came back - L1 7, L2 7, L3 13, L4 23, L5 8, and L6's cause, its service defect
and six false claims in the first record (AUDIT GUILD-WORDS II C-12: this page said five, and listed six); each was
verified against the code before anything was fixed. All were fixed but two RECORDED (L1-3's law, L2-6) - and round II
withdrew one fix, QSCRIPT-FREE, and superseded L2-1's and L2-6's (below).

## What it found, and what was done

**Report 3 - found (L6).** The Mages Guild offers its quests by the player's LEVEL, not the guild rank (`offerFlow.js`:
`if (guild.isSatisfyQuestReqByLevel?.() && level > rank) rank = level;` - DFU's `MagesGuild.cs` override), so a new
apprentice of level 1 is offered "Guard the Guild" (N0B10Y03, minReq 1) and at level 2 "Protect an Honored Mage"
(N0B20Y02). Guard the Guild places a magic item in the hall and costs `change repute with _qgiver_ by -30` when it is
taken outside the guard's window (GUARD-ONLINE: closed the first fifty real seconds, open five minutes, closed again);
the questor `_qgiver_` is MG_Quests (63), and a propagating change reaches the guild whole (the tree's root and a
questor take the full amount - `factionRep.js` propagateReputationChange). -30 against a +5 earned before reads -25;
one later success leaves -20 (II C-11: this page said two - -25 and two +5s is -15), under rank 1's 10 - the report, to
the point. The first record's "not found" read only the rank-0 quests and the questor's share as half; it is corrected
there. FIXED, Mac's call (asked of three shapes - waive own-guild losses, gate the two quests on reputation, keep the
scripts): "Waive own-guild losses" - QSCRIPT-FREE, which round II WITHDREW: Mac, shown what it waived, chose **"Gate by
reputation"** (REPUTE-GATE, II below). L6's service defect (a join recorded only on the standing after the claim) -
FIXED.

**QSCRIPT-FREE - WITHDRAWN.** Round I waived, online, a quest script's negative `change repute with` aimed at the
quest's own guild (`quest/actions.js` ownGuildLoss, `factionRep.js` factionRootOf). Round II (A-1, C-1) found what that
reached: the guarded treasure of N0B10Y03 kept for nothing - the -30 is for taking it, and the quest makes it permanent
- the honoured mage of N0B20Y02 killable for nothing ("If you kill me, you will be thrown out of the Mages Guild!"), the
Thieves Guild's keep-the-goods penalties and the Dark Brotherhood initiation's. Both modules are main's again; REPUTE-GATE
replaces it.

| Id | Finding | Verdict |
|---|---|---|
| L1-1 | The seat's refusal fired only at exactly rank 7; a member at 0-6 asking for Teleport still got 3100's promise of a review that never reaches 8 online | FIXED: serviceAccess says the seat whenever no rank up to the ceiling opens the service and a seat's does |
| L1-2 | The review's demotion went unsaid - the record's own "Reputation 62 of 80" at rank 7 is a demotion to 6 at the next review; a mended probation that also demotes said only "it ends" | FIXED: `guilds.js` reviewedRank (updateRank's own computation, one law) and `guildServiceFlow.js` reviewWarnings - first in the hall's line and under the guild on the Standing page; with its days since II A-8: "Your review at your next visit to the guild's hall lowers you to Warlock: Wizard needs reputation 70." |
| L1-3 | A probation whose guild skills fail rank 0's bars (Roleplay & Realism's underworld join) never ends at 0; a guild that never expels ends one at any standing - both said "at 0 or more it ends" | FIXED in the words (probationWords' kinds: 'skills', 'ends'). RECORDED for Mac: REP6 puts a member on probation for any failed review, the skills' included |
| L1-4 | The probation's words vanished where no next rank is (a seat's own hall, a stopped Roll's rank 9) | FIXED: the warnings come before the next rank and stand alone |
| L1-5 | A seat's services are its own chapter's halls', for a member at 7 (seatedBook); nothing said so | FIXED: the refusal and the guide say it |
| L1-6 | "rises at most 15 a day" - writs and receipts credit beyond the claims' pace | FIXED: "Quests raise it at most 15 a real day", "Beyond that pace, a chapter writ (yours or the chapter's) adds 2..." (II C-5's term); the owed's note "at most 15 a real day (days turn at midnight UTC)" (II C-8) |
| L1-7 | "at your review in N days" - the review is the first hall visit from N days on; "here" on the Standing page; the renewal unsaid | FIXED: "your review is at the guild's hall in 8 days or later. Below -10 you are expelled there, below 0 it runs 28 days more, and at 0 or more it ends." |
| L2-1 | The owed a login's first read paid was never said - the first word compared with nothing | FIXED - and SUPERSEDED by II B-1, B-2, B-5: the comparison with the save's kept record invented gains from an older record and repeated a stale save's moves; the service now says what each answer paid (`paid`), and the first word says that alone - "Mages Guild: 10 of what was owed arrived (now 50)". The kept record is main's `{ seq, factions }` again |
| L2-2 | A loss the owed absorbed was never said, and a larger one was said short (-25 as -20) | FIXED: `npcChapterLaw.js` rollMovesOf - a move is the standing and the owed together; where only the owed turned to standing, `paid` |
| L2-3 | DFU's drift and REP4's recovery made a line of up to twenty-two names | FIXED: the guilds the character belongs to are named, the rest counted ("and 2 other guilds") |
| L2-4 | "now" included a gain not yet claimed | FIXED: the Roll's word |
| L2-5 | A reseed made a second first word | FIXED: once a page |
| L2-6 | A capped gain is said twice - the chat's line and the strip's "rises no further today" (English, `rollCeilingLine`) | RECORDED then; SUPERSEDED by II B-3, C-4: the pace's line is said only where the owed grew, with how much, in the player's language (`rollNoticeHost.js`), and `rollCeilingLine` is retired |
| L2-7 | A line of several guilds hard to read | FIXED: one item a guild; since II B-6, B-7 in the port's names and the language's own list - "Mages Guild +5 (now 35) and Fighters Guild -25 (now -20)" |
| L3-1 | "a failed quest costs nothing" - a quest's script still cost standing online (N0B10Y03's -30, N0B20Y02's -60) | FIXED then by QSCRIPT-FREE and "no quest costs you standing with the guild that gave it"; QSCRIPT-FREE WITHDRAWN by round II, and the clause with it (II C-3) - the pages say no such thing now |
| L3-2 | = L1-6 | FIXED |
| L3-3 | = L1-5, and a seat's rank lifts only a book at 7 | FIXED |
| L3-4 | "days" and "weeks" meant two clocks - the seats' and the pace's are real (UTC), the probation's the character's | FIXED: "real days", "a real day", "each Sunday's Turning" |
| L3-5 | A receipt's 1 understated - 2 more for the day's first where the chapter asks it | FIXED |
| L3-6 | = L1-7 | FIXED |
| L3-7 | "Every number is the law's own constant" - 8 and 9 were literals in three strings | FIXED: `SEAT_RANK` handed in |
| L3-8 | "Offline nothing changes" - the probation's words and the tutorial show offline | FIXED in the record |
| L3-9 | Report 3's movers left out REP4's recovery | FIXED in the record |
| L3-10 | "every standing a quest or a crime moves is said" overclaimed | FIXED in the record: the twenty-two, online, as the Roll takes them |
| L3-11 | PINS MOVED incomplete; plainui's Testing.md row stale | FIXED |
| L3-12 | A stale sentence amended, not deleted (`Field-Bugs-2026-10-15.md`) | FIXED: rewritten |
| L3-13 | "(E2 above)" | FIXED: below |
| L4-1-L4-23 | fr and bg in the informal you where their files are formal; da's and ro's chapter word not the file's (kapitel, filială); garbled seat lines in cs, de, fr; the realm, hall writ, standing, Master, quest and online words not each file's own; agreement with an arbitrary {owed}; a Korean particle; a French pronoun on the wrong noun; Russian idiom; da/nb articles | FIXED: all 28 keys redrafted in the thirteen languages against each glossary and file - placeholders and plurals checked by the pipeline's `checkDraft`, the tutorial pages measured in every language (at most 12 rows of 16) |
| L5-1 | The standing's door was never tested saying anything (4 survivors) | FIXED: the door said, a quiet answer silent, the entity's name, the first-word gate |
| L5-2 | The membership fixture was a flat book the game never mints | FIXED: built through `activeMemberships` and `joinGuild` (TEST THE SHAPE THE PRODUCER MINTS) |
| L5-3 | The tracker's fixture answered one faction, no first owed, no fall (4 survivors) | FIXED: all twenty-two, the first word's owed, a reward with its owed, a loss the owed absorbed |
| L5-4 | The seat line's owed, probation and the 80's boundary untested (3 survivors) | FIXED |
| L5-5 | The Standing page's notes pinned by a source prefix (2 survivors) | FIXED: the page rendered |
| L5-6 | The streets' wiring pins passed with a door of the host's own after the module's | FIXED: the call sliced, no `onCapped:`/`onStanding:` after the spread |
| L5-7 | The house test built a Mages Guild row and a hand-set flag | FIXED: an order's row (`orderOf('Dragon')`), `claimHouse` |
| L5-8 | The record's examples pointed at untested arms | FIXED with L5-1, L5-4 |
| L6 | Report 3's cause; the join recorded on the standing after the claim alone (a join at 0 and a quest's loss in the same minute left a member off the Roll, and off its own writ); six false claims in the first record's report 3 (the rank-0 quest set, the rank gate, the questor's half, "none is 25", the drift's interval, a donation's and a raid's reach) | FIXED: QSCRIPT-FREE (withdrawn by round II for REPUTE-GATE); `server-account/src/npcRoll.js` judges the join on the standing before the claim's lines or after them, with what was owed (pinned by II E-10); the record's section rewritten |

## Pins (round I)

`test/systems/fb1015g_guildwords.test.js` (15, rewritten - 24 since round II) and `tools/mutants/fb1015g_guildwords.json` (72, all dead - with the
re-aimed lists, 360 dead and 8 equivalent as recorded, none survived); the join's
`test/net/chap2_halls.test.js` (17 - one added, and its "a member stays" pin taken below the floor both sides of a claim,
which the join's new reading would otherwise let CHAP2-MEMBER-STAYS live through). PINS MOVED: `fb1015g_seatline`
(the seat line at 72, the real days), `fb1015_promonow` and `fb1015g_seatline`'s host pins (the review's book),
`guildrep`'s book (`warnings`), `audit_chap1`'s kept record (its owed - main's again since round II). Mutants re-aimed: ACHAP-C1-KEPT, -SEQ, -KEEP,
AUDIT-CHAP2-S7-OWED-JOIN, CHAP2-JOIN, CHAP2-MEMBER-STAYS, CHAP4B-CEILING, CHAP4B-CEILING-DEMOTES and
SEAT-LINE-the-merit-line-dropped.

## AUDIT GUILD-WORDS II (2026-10-16) - round I's fixes, read cold

Mac, of round I: **"Audit this and ensure perfection"**. Six lanes again, each a cold adversarial reader of a FROZEN head
(3ff185a4, a detached worktree), each told to reproduce before reporting and to end on what it found sound: A the law,
B the online pipeline, C every word and record, D the translations (28 keys x 13 languages), E the tests and mutants (66
new one-site mutants: 31 dead, 35 survived - 9 equivalent, 26 real), F the rendering, the save, the service and the
merge with main (which had moved under the branch: ROLL-PACE, the instances, three more field-bug pages). 60 findings
came back - A 8, B 7, C 14, D 9, E 14, F 8 - each verified before anything was fixed. Mac decided one (QSCRIPT-FREE,
twice asked); every other is FIXED, or MOOT with the code it was about.

**REPUTE-GATE (Mac: "Gate by reputation") - online, two Mages Guild quests wait for the standing their own headers
name.** A-1 and C-1 showed QSCRIPT-FREE waiving deliberate choices, not accidents (above). Asked again with that shown -
only the two traps, gate them, or keep the waiver - Mac chose first "Only the two traps", then, told those two ARE the
thefts, "Gate by reputation": `quest/onlineRepute.js` (a leaf) holds `{ N0B10Y03: 10, N0B20Y02: 20 }` - each quest's
own `-- Repute:` header, pinned against the vendored text - and `quest/offerFlow.js` offerGuildQuest filters the guild
pool through it when the bridge hands it the shared clock (`scenes/quest/questBridge.js`). Online, a level-2 apprentice at
standing 0 is no longer drawn either; at 10 Guard the Guild comes back, at 20 Protect an Honored Mage. The penalties
are Daggerfall's, whole; offline the pool is DFU's (GetGuildQuestPool). Port-Ledger A (replacing QSCRIPT-FREE's row);
`06-Systems/Standing-Arc.md`; `test/systems/quest/fb1015g_reputegate.test.js` (4: the headers, the real Classic and DFU lists through
the real offer flow at 0, 9, 10, 19 and 20, the filter, the bridge's door); `tools/mutants/fb1015g_reputegate.json` (8).

| Id | Finding | Verdict |
|---|---|---|
| A-1 | QSCRIPT-FREE waived "betray the guild, keep the loot": the Thieves Guild's keep-the-goods, the Brotherhood's initiation, a temple's bribe | FIXED: withdrawn for REPUTE-GATE (Mac's call) |
| A-2, A-3, A-5 | The orders' arm dead code, the questor arm blind to the giving guild, the temples' and orders' arms unpinned | MOOT: withdrawn with QSCRIPT-FREE |
| A-4 | "A loss to any other faction, every gain ... stay DFU's" was false (the whole propagating call was dropped) | MOOT/FIXED: the claim gone with the code, the records rewritten |
| A-6 = C-6 | 'skills' probation words: "It ends once one reaches 22 and a second 4" - false while the standing is below 0 | FIXED: "...it ends only once one skill reaches 22, a second 4, and your standing is 0 or more" |
| A-7 | The start of a probation was never warned | FIXED: "Your review at the guild's hall in 19 days or later puts you on probation: your standing is below 0." (or the guild skills short of a member's); a guild that never expels is warned of the fall to rank 0 instead |
| A-8 | Demotion, 'ends' and 'skills' words gave no timing | FIXED: every warning says when, off reviewDaysLeft - "at your next visit to the guild's hall", "at the guild's hall in N days or later" |
| B-1 | A kept record from an older build made the first word invent a gain | FIXED: the first word no longer reads the kept record at all (B-5) |
| B-2 | The first word repeated moves an earlier page said, when the save trailed (another device, a crash, a refused checkpoint) | FIXED: as B-1 |
| B-3 = C-4 | The pace's line promised an owed the Roll threw away (a gain past 100 with the owed), and a lost gain went unsaid; "rises no further today" beside a writ's +2 | FIXED: the tracker hears the line only where the owed grew, net of the claim's own payment, and `onFull` where some of it was lost (a claim that moves nothing answers `paid` too, so a gain turned away at 100 is heard as lost); `rollNoticeHost.js` says "Mages Guild: quests raise your standing no further today. 10 more is owed, and follows in the days to come." and "...: your standing and what is owed already reach 100 - the rest of that reward is lost." in the player's language. `rollCeilingLine` and `rollFactionName` retired (their pins moved) |
| B-4 | A payment and a move in one answer said as one; a writ the owed's room trimmed said as a payment | FIXED: readRoll and claimRoll answer `paid` (`{ [faction]: n }`, what the answer paid of what was owed); `rollMovesOf` says a move and a payment both ("Mages Guild -5, and 10 of what was owed arrived (now 55)"), and a standing that rose while the two together stood still as the rise. acct140 (acct139 on the branch, renumbered past main's PRIMARY-TRIPS at the merge) |
| B-5 | A first read whose kept seq differed never said what it paid | FIXED: the read's own `paid` |
| B-6 = D-9 | ", und 2 weitere Gilden" - a comma before the language's "and" | FIXED: `Intl.ListFormat` joins the line; `chapters.standing.others` carries no conjunction in any language |
| B-7 | FACTION.TXT's English names in every language, a temple as "Zen" | FIXED: the twenty-two by the port's own names (`chapters.guild.*`, hallPosterName's), in the player's language |
| C-1 | The records misdescribed what QSCRIPT-FREE waived | FIXED: withdrawn, and every record rewritten |
| C-2 | "chapter seats" broke GUILD3's ONE WORD, ONE THING (a seat is a town's Charter) | FIXED: "chapter chairs", "a chair's services", "a chair brings no house", "gives the chairs to" |
| C-3 | "no quest costs you standing with the guild that gave it" | FIXED: gone with QSCRIPT-FREE |
| C-5 | "a hall writ adds 2" - a retired term, and a member's own writ pays too | FIXED: "a chapter writ (yours or the chapter's) adds 2" |
| C-7 | "in N days or later" while PROMO-NOW can promote sooner, which ends a probation | FIXED: online (the hall while the Roll paces; the Standing page on the online page) "- sooner if you earn the next rank" |
| C-8 | The pace's "real day" is a UTC day; the guide's Merit and chairs said "days" for real ones | FIXED: "(days turn at midnight UTC)", "the day turning at midnight UTC"; "real days" in Merit and The chairs |
| C-9 | Page-Index said 75 findings | FIXED: 66 (C-12) |
| C-10 | Chapters-Arc's refusal "at 7" and an old line shape; the host module's header shape | FIXED |
| C-11 | Report 3's arithmetic (two later successes from -25 is -15), and a dangling "the other movers" | FIXED in both pages |
| C-12 | "five false claims", six listed | FIXED: six, and the total 66 |
| C-13 | `Field-Bugs-2026-10-15.md`: "six keys" | FIXED |
| C-14 | Standing-Arc's "a standing back at zero ends the probation" left standing beside its own correction | FIXED: replaced |
| D-1 | fr seatMerit 1.65 times the English, ungrammatical | FIXED: redrafted with the C-2 wording |
| D-2, D-3 | de and fr `paid` rows singular for 2-15 | FIXED |
| D-4 | `many` missing in es, fr, it, pt-BR plurals | FIXED: every plural block of the redrafted rows, and othersOnly |
| D-5 | nb "Anseelse" where the file says "omdømme" | FIXED |
| D-6 | es "casa gremial" singular against the glossary's "casa del gremio" | FIXED |
| D-7 | cs "na {title}" (accusative) | FIXED: "na hodnost {title}" |
| D-8 | pt-BR "vem ali a expulsão" | FIXED |
| E-1-E-3 | QSCRIPT-FREE's root rule, questor gate and guild set unpinned | MOOT: withdrawn, its seven mutants retired with it |
| E-4 | Three probation-kind branches unpinned (the underworld rule, each half of the skills test, rank 0's bars) | FIXED: pinned |
| E-5 | A fall to rank 0, and the reason's boundary, unpinned | FIXED |
| E-6, E-7 | The Standing page's days and an owed of 0 unpinned | FIXED |
| E-8 | Three tracker behaviours unpinned | FIXED - two with the code they pinned gone (B-1), one by the new tests |
| E-9 | The first word with nothing moved; the vampire's dormant book | FIXED |
| E-10 | The server join's owed operand | FIXED: `test/net/chap2_halls.test.js` |
| E-11 | The wiring regex blind to shorthand and quoted doors | FIXED: `['"]?on(Capped|Standing|Ceiling|Full)['"]?\s*[:(]` |
| E-12 | An unstamped membership's due; rankNeedsLines without a store | FIXED |
| E-13 | The tracker fixture answered what no service mints | FIXED: the tests drive a service built on the law's own rollCredit and rollDrain |
| E-14 | A 'lease' stop cleared what is owed, though the next lease resumes | FIXED: only a terminal stop clears it |
| F-1 | The popup's new rows pushed Talk, Service and Reforge below the fold (0/3 visible in seven languages at 1280x720) | FIXED: the line scrolls in its own well (`.port-text.scroll`, a shorter one on a phone on its side); measured in Chromium on the real sheets: 3/3 at 1280x720 and 390x844 in en, fr, de and ru, 2/3 at 844x390 and 667x375 (0/3 before the branch) |
| F-2 | The classic window's refusal boxes ran past both screen edges | FIXED: `fitBoxRows`, SS5's |
| F-3 | After the merge, the gate and the house read a door main had removed | FIXED at the merge: `host.rollPace?.(guild.factionId)?.book` |
| F-4 | The two halves of the hall's line conflicted | FIXED at the merge: one line, the seated book and the pace both |
| F-5 | The record's name taken on main | FIXED: `Field-Bugs-2026-10-15g.md`; the tests and mutants `fb1015g_*` |
| F-6 | No ACCOUNT_VERSION bump for the service's change | FIXED: acct140 (with B-4's `paid`; acct139 on the branch, renumbered past main's PRIMARY-TRIPS acct139 at the second merge of main) |
| F-7 | The Guilds tutorial page English around a translated point | FIXED: the whole page through `t()` |
| F-8 | The merge's mechanical conflicts | DONE at the merge |

### Pins (round II)

`test/systems/fb1015g_guildwords.test.js` (24, rewritten again); `test/systems/quest/fb1015g_reputegate.test.js` (4, new);
`test/net/chap2_halls.test.js` (19: the service's `paid`, E-10). `tools/mutants/fb1015g_guildwords.json` (138: QSCRIPT-FREE's
seven and the four kept-record mutants retired, 61 kept and re-aimed, 42 added, and lane E's 35 that still apply taken
in - 5 equivalent as recorded, with why), `fb1015g_seatline.json` (8), `fb1015g_reputegate.json` (8): 154, 149 dead and 5 equivalent as recorded, none survived. Main's
mutants on every file this round changed, and every one whose tests this round touched: 475, 467 dead and 8 equivalent as recorded, none survived (T-LAW-ISFAC-TYPE read dead once under the campaign's load and equivalent again alone; AUDIT-PLAINUI's guide records judged after their pin moved). PINS MOVED:
`fb1015_promonow` (the hall's fixture holds rank 1's skills, where the review now warns of a probation; the well's
`scroll`), `guildrep` (the hero holds its rank's skills; the menu's `online`), `audit_chap1` (the kept record main's
again; the pace's words moved to rollNoticeHost), `fb1015g_seatline` ("gives the chairs to"), `l10n3e_names`
(rollNoticeHost names nothing through FACTION.TXT now), `fb1015f_rollpace` (the merged hall line). Mutants re-aimed:
ACHAP-C1-KEPT, -SEQ, -KEEP (main's text again), ACHAP-S7-NOOP, ACHAP-CEILING-LINE and T-LAW-FACTIONNAME (onto rollNoticeHost),
T-TAB-CUT-EMPTY, T-SVC-READ-NOPAY, T-SVC-CLAIM-SEQ, AUDIT-CHAP2-C1-READ-FROM-SEQ, -DRAIN-SEQ, PROMO-NOW-the-line-not-drawn,
and the nine version records (acct140).

## THE FOUR HOSTS

The guild popup (gate, house, line) is worldModes.js's - WIRED; the Roll's tracker is world.js's alone - WIRED through
`rollNoticeHost.js`; exterior.js keeps no Roll and constructs no GuildServiceWindow; dungeonContext.js stands no hall.
REPUTE-GATE lives in the quest offer every host's guild hall reaches (`quest/offerFlow.js`, handed the shared clock by
`scenes/quest/questBridge.js` - THE ONE CONSTRUCTION SEAM every host's quests pass), online only.
