# FIELD BUGS 2026-10-16d - the way back into a guild

One Discord message in #general, handed over by Mac as a screenshot ("Glade's comment"). Read on the code as it stands at
main's `0ce25a8e` (main took `Field-Bugs-2026-10-16b.md` and `-16c.md` for the Discord's other reports meanwhile, so
this record is `-16d` and its pins `fb1016d_*`). Then Mac: "Audit this" - AUDIT WAY-BACK (`01-Overview/audits/Audit-Way-Back.md`) read the slice cold,
and what it changed is written in below, marked with its finding's id.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Glade: "Can you take a look at ways to recover negative guild rep? I failed a quest for the Mages Guild yesterday that put me down to -55 rep, now I'm at -53 rep, but they kicked me out so I can't do any quests to recover. It's unclear to me whether I'll have to remake my character or wait IRL weeks just to get back to 0" | The roads back were open, and nothing on the screen named any. A stranger may still take a guild's work, and each quest done pays the guild +5. Below 0, a standing recovers a point a week of the character's own time, and online across a log-off too. Online a chapter writ pays the guild +2 beyond the Roll's pace. The hall showed a non-member no line, DFU's join refusal (the Mages Guild's record 612) says only that the standing will not do, and the Standing page gave the number alone | changed (WAY-BACK): the hall, the classic skin's join refusal and the Standing page say the way in, with the law's numbers |

## WAY-BACK: what the way back in costs, said

`src/systems/guild/guildServiceFlow.js` wayBackLines and wayBackQuestLine; `src/scenes/worldModes.js` openGuildService
(the wiring); `src/ui/enhanced/enhancedPorts.js` the guild port; `src/ui/enhanced/enhancedMenu.js` statsEveryStanding
(the Standing page, which finds a row's guild by `guilds.js` guildOfFaction - GuildManager.GetGuild - and guildVariants'
resolveVariantGuild for a temple or an order).

FOUND. The report reads as a dead end, and it was not one. Every part of the road below already shipped:

- **A stranger's quests.** DFU's popup gives a non-member the guild's Get Quest (NonMemberGuild.CanAccessService answers
  Quests true - `guildServices.js` baseCanAccessService). The pool is the list's non-member rows at minReq 0
  (`questLists.js` getGuildQuestPool): the Mages Guild's Missing Book, Grab an Ingredient, The Loose Pet Imp and An
  Ancient Scroll (QuestList-Classic `N0C00Y10`-`13`), the Fighters Guild's four, the temples' four and the orders' four.
  Reputation does not gate a stranger's pool. Each quest done pays the guild's own faction DFU's +5 (Quest.cs EndQuest,
  `quest.js` QUEST_SUCCESS_REP), and the Roll credits it to a stranger as to a member - ROLL-PACE already says so: "the
  stranger banked it before the membership began". Online a quest that ends unfinished costs nothing (QFAIL-FREE).
- **The drift.** Below 0 every faction's standing comes back a point every 7 days of the character's own time (REP4,
  `court.js` RECOVERY_INTERVAL_MINUTES). Rests and journeys move that clock (LIVED1), and online a load pays the
  absence on the world's clock as well (`worldTick.js` normalizeAcross, from `save.js` payAbsenceWhenHeard - AUDIT
  WAY-BACK L1-2). Glade's -55 to -53 in a day is this. Online, untouched, a game day is about two real hours, so a week
  is about fourteen: -53 is about 31 real days.
- **Online, the Roll's pace.** The Roll pays what the claims carry - quests and the drift - at most 15 a UTC day
  (`npcChapterLaw.js` ROLL_GAIN_DAY_MAX), and owes the rest. A chapter writ delivered at a notice board pays its guild
  +2 beyond that pace, member or not (`professions.js`, CHAP2a's HALL_WRIT_REP - AUDIT WAY-BACK L1-1), up to the
  Court's three writs a day. So from -53, eleven quests take at least four UTC days, and with three chapter writs a
  day it is three.

No character has to be remade. What was missing is on the screen: Glade read a closed door ("they kicked me out so I
can't do any quests") where the hall's own quest-giver still had work for them. The guild popup draws a member's line
alone (PROMO-NOW), and that line is online only. DFU's refusal names no remedy. EVERY-STANDING put the number on the
Standing page and nothing beside it.

CHANGED. `wayBackLines(guild, entity, book, store, { online, paced, shut })` answers, for a guild whose join the player is
offered and refused on the standing:

- "Your standing here is -53. It takes members at 0 or more." (`RANK_REQ_REPUTATION[0]`);
- where the guild skills fall short of rank 0's bars, as the join also asks (`isEligibleToJoin`): "It also asks one of
  its guild skills at 22 and a second at 4: ..." with the guild's own skills (AUDIT WAY-BACK L1-4, L3-1);
- "As a stranger you may still ask its quest-giver for work: each quest done raises your standing 5 - 11 more quests
  reach 0." (QUEST_SUCCESS_REP, the count rounded up, and what the Roll still owes counted toward it - with 10 owed it
  says 9, and with the owed reaching the line on its own the count is left out);
- at a hall a Crackdown shut this Season (CHAP6d): "This hall is shut this Season - the guild's halls in other regions
  still give work." (AUDIT WAY-BACK L1-3);
- "Below 0 your standing also recovers a point every 7 days of your own time - rests and journeys count, and so does
  time logged off." (RECOVERY_INTERVAL_MINUTES; the log-off clause online alone);
- online while the Roll paces the guild: "Online, quests and the recovery raise it at most 15 a real day (days turn at
  midnight UTC) - 10 more standing on the way. Beyond that pace, a chapter writ of the guild's on a notice board adds 2."
  (ROLL_GAIN_DAY_MAX, the owed when there is some, HALL_WRIT_REP).

It answers null for a member of the slot (this guild, or another temple or order in it - showsJoinButton's own test,
so Mara's member is told nothing at Arkay's), for the Thieves Guild and the Dark Brotherhood (joined by invitation
alone - no walk-in, no stranger at their halls), with no faction store, and at a standing the join takes. Every number is
read from the law, so a retune moves the words. DFU's two quest-end constants (Quest.cs:36-37) moved into a leaf,
`quest/questRepute.js`, which `quest.js` re-exports. The hall's words read the +5 there without putting the quest machine
on the HUD's import walk (AUDIT GUIDE O6 failed on the first cut, which imported `quest.js`).

It is said in three places:

1. **The hall** (enhanced skin, both lanes): a stranger's popup shows the lines in the scrolling well a member's
   next-rank line uses, above Join, Talk and the NPC's own service. The classic window is DFU's own and draws nothing new
   (THE NATIVE-WINDOW RULE).
2. **The join's refusal** on the classic skin, both lanes: DFU's record (the Mages Guild's 612, the Fighters Guild's 679,
   a temple's 745, an order's 751) and then the lines, on the same box - a refusal for the guild skills alone (rep at 0
   or more) is DFU's alone. The rows wrap to the screen (SS5 fitBoxRows) and the box centres them as it centres the
   record's. On the enhanced skin the refusal is DFU's record alone: the hall's well behind it already says the way in,
   and the enhanced notice would set the lines left of a centred record and clip a long box on a landscape phone
   (AUDIT WAY-BACK L2-2, L2-4, L2-5).
3. **The Standing page** (enhanced, with EVERY-STANDING's row on, its default): under a guild, temple or order the join
   refuses, the quests line (`wayBackQuestLine`), the owed counted as at the hall. A first cut declared a second
   `guildOfFaction` in `factionStanding.js`; CI's one-home ratchet (`audit24_onehome.test.js`, ONE DFU MEMBER, ONE EXPORT)
   failed it, and the page reads GetGuild's own.

THE FOUR HOSTS: the guild popup is worldModes.js's alone (openGuildService: the `wayBack` hook and the join's refusal) -
WIRED. world.js builds the modes with its Roll (`rollPace`) on the shared clock; exterior.js, the offline fixed city,
builds them with no Roll, so its halls say no pace and no log-off; dungeonContext.js stands no guild hall. The Standing
page is enhancedMenu.js's (AUDIT WAY-BACK L2-1, L4-5).

Not changed: the law. No standing moves faster, and no new road was opened. Two calls for Mac, if the words are not
enough:
- **Amends for gold at the hall**: REP4's temple penance, but for a guild (five points toward 0 for a price that rises
  each use).
- **A faster drift for a guild's standing**: a point a game day instead of a week.

Neither is built. The probation's words (STANDING-WORDS) still say the stakes and not the remedy. A member's quests pay
the same +5, which the hall's line could say before the review that expels.

Six port strings (`guild.wayBack.standing`, `.skills`, `.quests`, `.shut`, `.drift`, `.paced`), drafted in-session in
the thirteen whole languages. `test/systems/guild/fb1016d_wayback.test.js` (7) - the words and their gates, the skills
and the shut hall, the stranger's pool through the vendored lists, the real offer flow and the bridge's own guild
surface for all four walk-in guild kinds, the hall's well, the host's wiring, the Standing page (its book, its owed, a
kingdom's row). `tools/mutants/fb1016d_wayback.json` (24, 24 dead). Ledger A: THE WAY BACK INTO A GUILD, SAID. Not seen in
play here (this container has no ARENA2); the pins drive the real law, lists and windows.
