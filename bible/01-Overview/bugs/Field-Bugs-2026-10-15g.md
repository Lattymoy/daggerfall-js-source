# FIELD BUGS 2026-10-15g - a Wizard at a hundred

One Discord thread in #bug-reports, "why did my rank on mages guild fall if i got max reputation", handed over by Mac as
a screenshot. Read on the code as it stands at main's `458340b1`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Dracula/Valentin: "why did my rank on mages guild fall if i got max reputation" (the flair: The Mages Guild, Wizard, +100) | CHAP4b as built (`11-Multiplayer/Chapters-Arc.md` 3.5): online, while the Roll holds, ranks 8 and 9 are the chapters' seats, won by Merit. Every adoption of the Roll's word sets a book above 7 to 7 (`rollBookCap`), and DFU's review stops at 7 (`updateRank`'s `rankCeiling`). Wizard is the Mages Guild's 7 | by design; the hall now says so (SEAT-LINE) |
| 2 | Temegast: "I was Archmage and now I cant seem to ever get back past the Wizard rank, locking me out of using Mages Guild teleport. All the other guilds tell me what the next rank is and what I need but the Mages Guild does not" | The same hold: Archmage is the Mages Guild's 9, and its Teleport asks rank 8 (`MagesGuild.cs` CanAccessService, `guildServices.js` magesCanAccessService) - a seat's service while the seat is held (3.5). And the hall's line (PROMO-NOW, `Field-Bugs-2026-10-15.md`) answered nothing at the Roll's 7: `rankNeeds` returned null past the ceiling, so a member at 7 was told nothing while a member below it was told the next rank | changed (SEAT-LINE), Mac's call: "Explain the seat" |
| 3 | Reign Droid: "Im forever trapped as apprentice and cant grow past -20 reputation with the mages guild. The very first quest i did for them dropped my rep by 25 points" (the message runs on past the screenshot) | Daggerfall's own quest script, offered by the player's level: "Guard the Guild" (N0B10Y03) costs the Mages Guild 30 for its guarded treasure taken - found by AUDIT GUILD-WORDS (L6), below | changed (REPUTE-GATE), Mac's call: "Gate by reputation" (QSCRIPT-FREE first, withdrawn by AUDIT GUILD-WORDS II) |

## SEAT-LINE: at the Roll's 7, the hall says the next rank is a seat (2)

`src/systems/guild/guilds.js` rankNeeds; `src/systems/guild/guildServiceFlow.js` rankNeedsLines; `src/scenes/worldModes.js`
openGuildService (the wiring).

ASKED (Mac, of three shapes - explain the seat; explain it and open the Mages Guild's Teleport at 7; retire the cap and
let DFU's review give 8 and 9 again): "Explain the seat". The seats stand as CHAP4 built them.

CHANGED. A member AT the host's ceiling (online, 7 while the Roll holds) is answered by `rankNeeds` as a seat -
`{ rank: 8, seat: true, reputation, reputationNeed: 80 }`, rank 8's reputation being the seat's line (`ROLL_SEAT_LINE`)
- and the hall's line says it, on the enhanced skin, above the popup's buttons:

- "Next rank: Master Wizard" (the guild's own title, as below 7);
- "Ranks 8 and 9 are each chapter's council and Master, won by Merit - no review gives them";
- "Reputation 72 of 80", while the reputation is short of the seat's line (AUDIT GUILD-WORDS L1-2: at 62 a Wizard's own
  70 is short too, and the review's demotion is said first, with its days - "Your review at your next visit to the
  guild's hall lowers you to Warlock: Wizard needs reputation 70.");
- "Each Sunday's Turning gives the chairs to the most Merit of the last 4 weeks, among members 14 real days in the guild,
  on accounts 7 real days old" (L3-4: the seats' days are real ones; AUDIT GUILD-WORDS II C-2: ranks 8 and 9 are
  "chairs" in every word the player reads - a seat is a town's) - the numbers the law's own (`SEAT_MERIT_WEEKS`,
  `SEAT_TENURE_S`, `SEAT_ACCOUNT_AGE_S`, `npcChapterLaw.js` seatEligibleAt), so a retune moves the words.

The host reads the line off the book SEATED (`seatedBook`, as the hall's services and title already read it), so a
seat's holder at its own chapter's halls reads 8 or 9 and is told nothing more. A member below 7, a stranger and
everyone offline see what PROMO-NOW gave them. The skills DFU's rank 8 asks are not listed: a seat asks none (AUDIT CHAP
R2, AUDIT CHAP5 D1 - it lifts only a book DFU's own review holds at 7). The classic window is DFU's own and draws
nothing new (THE NATIVE-WINDOW RULE). Two port strings (`guild.rankNeeds.seat`, `guild.rankNeeds.seatMerit`), drafted
in-session in the thirteen whole languages, "the Turning" in each as the seats' refusal already words it.

THE FOUR HOSTS: the guild popup is worldModes.js's alone (openGuildService) - WIRED; world.js opens no popup of its own;
exterior.js constructs no GuildServiceWindow; dungeonContext.js stands no guild hall. Pinned by
`test/systems/fb1015g_seatline.test.js` (4); `tools/mutants/fb1015g_seatline.json` (8, all dead). PINS MOVED:
`test/systems/guild/fb1015_promonow.test.js`'s ceiling pin reads the seat where it read null, and its host pin reads the seated book
(`tools/mutants/fb1015_promonow.json`, 10, all dead, unchanged).

What the reporters are owed: online, Master Wizard and Archmage are the chapters' seats - one Master and three
councillors a chapter, placed at each Sunday's Turning by Merit (a member's own hall writ, and a gate's or a raid's
receipt in the chapter's region - never a quest; Chapters-Arc 5.1).
Rank 7 is the highest the guild's own review gives; the hall now says what a seat asks. A seat's holder has its
rank's services at its chapter's halls, the Teleport among them.

## Report 3 - found by AUDIT GUILD-WORDS (L6), answered by REPUTE-GATE

This record first read report 3 as not found: it read only the Mages Guild's rank-0 quests, and the questor's share of a
propagating change as half. Both were wrong (`01-Overview/audits/Audit-Guild-Words.md`, L6):

- The Mages Guild offers its quests by the player's LEVEL (`offerFlow.js`, DFU's `MagesGuild.cs`
  IsSatisfyQuestReqByLevel), so a new apprentice of level 1 is offered "Guard the Guild" (N0B10Y03, minReq 1), and of
  level 2 "Protect an Honored Mage" (N0B20Y02).
- Guard the Guild places a magic item in the hall and runs `change repute with _qgiver_ by -30` when the player takes
  it (`clicked item _treasure_`) - "I couldn't resist it. I took the _treasure_ I was supposed to guard" - and later
  makes it the player's for good (`make _treasure_ permanent`). The questor is MG_Quests (63), and the tree's root and a
  questor take a propagating change whole (`factionRep.js` propagateReputationChange) - the guild takes 30. Protect an
  Honored Mage takes 10 from the guild for a click on its sleeping mage, and 50 for killing it ("If you kill me, you
  will be thrown out of the Mages Guild!").
- -30 beside a +5 earned before reads -25; one later success leaves -20, under rank 1's 10 (AUDIT GUILD-WORDS II C-11:
  this page said two). The standing's other movers stand as the first reading found them: DFU's drift, a point every
  seven days toward zero for a standing below it, with REP4's recovery beside it; a quest's own reward; a crime through
  the faction tree; and online the Roll's pace (15 a real day, the rest owed). A donation and a raid do not reach a
  guild's standing (L6: the first reading claimed they did).

DECIDED (Mac, twice). Asked first of three shapes - waive own-guild losses, gate the two quests on reputation, keep the
scripts - "Waive own-guild losses": QSCRIPT-FREE spared, online, a script's loss to the quest's own guild. AUDIT
GUILD-WORDS II (A-1, C-1) showed it spared the theft and the killing above, and the Thieves Guild's and the Dark
Brotherhood's own penalties, for nothing; asked again with that shown, Mac chose "Gate by reputation" - REPUTE-GATE,
`06-Systems/Standing-Arc.md`: online, Guard the Guild and Protect an Honored Mage are offered only once the guild's
standing reaches what their own headers name (`-- Repute: 10`, `-- Repute: 20`; `quest/onlineRepute.js`, read by
`quest/offerFlow.js`). QSCRIPT-FREE is withdrawn; the penalties are Daggerfall's. What the reporter is owed: online, a
new Mages Guild apprentice is no longer handed either quest; the -30 they took stands (the Roll keeps every loss). A
member on probation below -10 is expelled at a review (REP6); the hall's line and the Standing page say the
probation's stakes and its days - and since round II a probation the next review would begin, with its days - and
every move of a guild's standing on the Roll is said as the Roll takes it, online.

## SEAT-WORDS and STANDING-WORDS: what the guild system left unsaid (2026-10-16)

ASKED (Mac, "With the new guild system, are there any other descriptions or UI elements we need to further make this
palatable for players", then of four gaps found on the code - "Seat-locked services", "Standing changes shown",
"Probation warning", "Tutorial + guide words" - all four).

FOUND. Online the Roll and the seats changed how a guild plays (Chapters-Arc 3.3-3.5), and four places still spoke as
DFU does:

- A service a seat's rank opens (the Mages Guild's Teleport at 8, Zenithar's summoning at 8) refused a member at the
  Roll's 7 with record 3100, which promises a review that online never comes; and a knight asking for the order's house
  was told DFU's rank-9 record, though online the house reads the book's rank, which stops at 7 (AUDIT CHAP4 E2).
- The book held at 7 was one chat line, once a hold. Nothing said a guild's standing moved - a quest's +5, a crime's
  loss through the faction tree, a hall writ's +2 - and after the pace's one line ("rises no further today") nothing said
  how much was still owed.
- A probation said "on probation" on the Standing page, and nothing of the review that expels below -10 or ends it.
- The tutorial's Guilds page said "to rank up, raise the skills it cares about and keep working for it"; no page said the
  standing's pace or the seats, and the notice board's "How chapters work" named the chairs but never that a guild's own
  review stops below them.

CHANGED:

- **SEAT-WORDS - the gate.** `guildServiceFlow.js` serviceAccess takes the host's book ceiling: online a member refused
  a service no rank up to it opens but a chair's does is told "Rank 8 offers this. Online, ranks 8 and 9 are chapter
  chairs won by Merit, and a chair's services are at its own chapter's halls, for a member at rank 7. A notice board
  explains chapters." - at any rank (AUDIT GUILD-WORDS L1-1, L1-5; II C-2's word). Offline, for a chair's holder at its
  own halls (the book read seated) and for a service no rank opens, DFU's answers stand. The classic window wraps it on
  the screen (II F-2).
- **SEAT-WORDS - the house.** `knightlyGifts.js` receiveHouseDecision, online: "Online, ranks 8 and 9 are the order's
  chapter chairs, held while won by Merit - and a chair brings no house." A house already given says so, as before.
- **SEAT-WORDS - the hold.** `scenes/rollNoticeHost.js` (the streaming host's module, HOST-SPLIT): the hold's line
  stands and pops the new Chapters tutorial page with it; a member of any of the twenty-two coming online is shown the
  page the first time too (once on the device, always again from Menu > Tutorials).
- **STANDING-WORDS - the moves.** `net/npcRollTracker.js` hands each adoption's moves to `onStanding`
  (`npcChapterLaw.js` rollMovesOf: the standing and the owed moved together - a quest's whole reward, a loss the owed
  absorbed - and what the answer paid of what was owed, the service's own word since AUDIT GUILD-WORDS II B-4: readRoll
  and claimRoll answer `paid`; a page's first word says what its read paid, and nothing an earlier page said - II B-1,
  B-2, B-5), and the host's module says them in one line, the guilds by the port's own names in the player's language
  and in the language's own list (II B-6, B-7): "Standing: Mages Guild +25 (now 40, 10 more to come)", "Mages Guild:
  10 of what was owed arrived (now 50)", "Mages Guild -5, and 10 of what was owed arrived (now 55)". The guilds the
  character belongs to are named, the rest counted (L2-3).
- **STANDING-WORDS - the pace.** AUDIT CHAP D2's line, said only where the owed grew by the cut and with how much -
  "Mages Guild: quests raise your standing no further today. 10 more is owed, and follows in the days to come." - and a
  gain the most a standing holds turned away said lost (II B-3, C-4).
- **STANDING-WORDS - the owed.** The tracker keeps the Roll's owed in a leaf (`systems/standingOwed.js`; cleared when
  the Roll ends - not when the page only hides, II E-14), and the hall's reputation row says it ("Reputation 72 of 80
  (10 more to come)"), as does a note under the guild on the enhanced Standing page ("10 more standing on the way, at
  most 15 a real day (days turn at midnight UTC).").
- **STANDING-WORDS - the probation.** `guilds.js` reviewDaysLeft - the days to the next review on the character's own
  date - and `guildServiceFlow.js` reviewWarnings: "On probation: your review is at the guild's hall in 8 days or later.
  Below -10 you are expelled there, below 0 it runs 28 days more, and at 0 or more it ends." - online "- sooner if you
  earn the next rank" (II C-7). A guild that never expels, and guild skills short of a member's, have words of their own
  (L1-3; II A-6: the skills' words say the standing too); a probation the next review would begin is warned (II A-7),
  and a demotion before it lands (L1-2), each with when (II A-8). First in the hall's line (said even where nothing else
  is short or no next rank is), in a well of its own that scrolls so the popup's buttons stay in view (II F-1), and
  under the guild on the Standing page, both lanes.
- **The words.** The tutorial's Guilds page, whole in the player's language (II F-7), gains a point ("Online, a review
  stops at rank 7: ranks 8 and 9 are chapter chairs. See Guild Chapters."), and a new online page, Guild Chapters, says a
  quest's pace in real days (days turning at midnight UTC) and the chairs. The notice board's guide gains "Your rank" (a
  review promotes to 7; a chair's services are at its own chapter's halls, for a member at 7) and "Standing" (the pace
  and the owed, a chapter writ's 2 - yours or the chapter's - and a receipt's 1 beyond the pace, 2 more for the day's
  first receipt where the chapter asks it). Every number is the law's own constant (AUDIT GUILD-WORDS L3-7: the seats'
  ranks too).

Twenty-six port strings with SEAT-LINE's two, drafted in-session in the thirteen whole languages and redrafted by the
audit against each language's glossary (L4); round II redrafted the 45 it changed or added (the twenty-two guild names
among them) and the rows its D lane found wrong. The classic guild window draws nothing new (THE NATIVE-WINDOW RULE): its
refusals are boxes the classic window already draws, and its hall line stays the enhanced skin's. Offline the Roll, the
seats and the pace do not run; the review's warnings on the Standing page and the tutorial show on both lanes (L3-8).

THE FOUR HOSTS: the guild popup's gate, house and line are worldModes.js's (openGuildService, openServiceFlow) - WIRED;
the Roll's tracker is world.js's alone - WIRED through `rollNoticeHost.js`; exterior.js, the offline fixed city, keeps
no Roll and constructs no GuildServiceWindow; dungeonContext.js stands no guild hall. The Standing page and the notice
board are windows every host opens. Pinned by `test/systems/fb1015g_guildwords.test.js` (24, rewritten by both audits);
`tools/mutants/fb1015g_guildwords.json` (138 since round II, `Audit-Guild-Words.md`). PINS MOVED (AUDIT GUILD-WORDS L3-11, the whole list):
`test/systems/guild/chap4b_seats.test.js`'s gate pin reads the ceiling handed on, its hold pin reads the module, and its review-ceiling
pin is held to the review's own line (the gate, the house and the hall's line now carry the ceiling too, and the loose
pin let CHAP4B-WM-CEILING live); `test/systems/guild/fb1015_promonow.test.js` and `test/systems/fb1015g_seatline.test.js`'s host pins read the
date and the review's book handed on; `test/systems/guild/guildrep.test.js`'s book reads the owed and the warnings, and its menu pin the
character's date; `test/systems/legacy/plainui.test.js`'s guide reads the rank and the standing; `test/systems/l10n3e_names.test.js` counts
`rollNoticeHost.js`'s name (until round II, whose names are the port's own); `test/net/audit_chap1.test.js`'s kept record
carried its owed (main's `{ seq, factions }` again since round II). Mutants re-aimed: CHAP4B-WM-SEATED,
SEAT-LINE-the-reputation-always-said, L10N3d2's serviceMembersOnly, and the audit's nine (`Audit-Guild-Words.md`).
