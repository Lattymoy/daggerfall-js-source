# FIELD BUGS 2026-10-15 - a promotion that never came

One Discord thread, handed over by Mac with: "This is a comment from the discord. We need to change the way promotions
behave online". Read on the code as it stands at main's `545cf70e`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "have traveled back and forth from daggerfall passed 200 days still no promotion i meet the requirements i checked on uesp is this a bug" | DFU's review as built: 200 days of travel cleared the 28-day wait many times over, and nothing told the player which of the review's other asks held them - the Roll's reputation, worn by DFU's drift, or a second guild skill from the port's own lists | changed (PROMO-NOW), Mac's call: "No wait" |

## PROMO-NOW: online, a promotion does not wait, and the hall says what the next rank asks (1)

`src/systems/guild/guilds.js` updateRank, rankNeeds; `src/systems/guild/guildServiceFlow.js` onPushEffects, rankNeedsLines;
`src/ui/enhanced/enhancedPorts.js` the guild port's view; `src/scenes/worldModes.js` openGuildService (the wiring).

THE REPORT. A player who passed 200 days travelling to and from Daggerfall, and who met the rank's requirements as UESP
lists them, was never promoted.

FOUND. No fault on the path the report names. A rank moves only at DFU's review, UpdateRank (`Guild.cs` :76-96), which
runs when a guild-service NPC's popup opens (OnPush, `DaggerfallGuildServicePopupWindow.cs` :158-205) and moves nothing
until 28 days have passed since the last rank change. Online those days are the character's own (LIVED1,
`06-Systems/Lived-Time.md`): they run with the world at TimeScale 12 - 56 real hours - and ahead of it on a journey or a
rest, so 200 days of travel opened the gate. What the review then reads, nothing on screen said:

- the guild's reputation - online the Roll's (CHAP1, `11-Multiplayer/Chapters-Arc.md` 3.3), paced at 15 a guild a day,
  and worn down a point every 112 days of the character's own time by DFU's drift (`court.js` normalizeReputations - two
  points over the reporter's 200 days, enough to drop a member who stood on the line);
- two guild skills, one at the rank's high bar and a second at its low one (`numHighLowSkills`), from the port's lists -
  the Fighters Guild's carries Hand-to-Hand since FGH2H - not a wiki's.

The reporter's own numbers were not given, so which of them held the reporter is not known.

CHANGED (Mac, asked of four shapes - no wait, a review anywhere, both, or DFU's law with the line alone - "No wait"):

- **No wait.** Online (the shared clock, `sharedClockOn`), a promotion does not wait the 28 days: the hall's review
  promotes the moment the member qualifies (`updateRank`'s `promoteWhenEarned`, handed in by the host). The Roll
  already paces the ranks - a rank is ten reputation and the Roll credits at most 15 a guild a day. A demotion, a
  probation and an expulsion still wait the 28 days, so a bad day costs no rank; a promotion restarts the clock they
  read. The Roll's ceiling holds inside the wait: a member at 7 is not announced 8 or 9 (CHAP4b). Offline every review
  is DFU's whole. DFU's gate is kept as DFU tests it - `!(today < lastRankChange + 28)` - so a stamp that does not read
  as a number opens it as before (`guilds.test.js`'s AUDIT 21 F1 hands the review a bare number).
  ROLL-PACE (`01-Overview/bugs/Field-Bugs-2026-10-15f.md`, the same day) found the premise short: the Roll paces the
  REPUTATION, and a stranger's quests bank it before the membership begins, so the first review turned a week's
  standing into seven ranks. Online a review now promotes no further than the Roll's pace since the membership began,
  and the no-wait stands only while the Roll paces it.
- **The hall's line.** Online, the guild popup tells a member what the next rank asks that they do not have
  (`rankNeedsLines` over `rankNeeds`, which reads the next row exactly as `baseCalculateNewRank` reads it): "Next rank:
  Swordsman", "Reputation 14 of 20", "A guild skill at 31 - your best, Axe, is 25", "A second guild skill at 9", and,
  when a skill is short, the guild's own skills by name. No line for a stranger, at DFU's nine, or when nothing is
  short and no review warns; at the Roll's 7 the seat's lines, and a probation's stakes or a coming demotion always
  first (SEAT-LINE and STANDING-WORDS, `Field-Bugs-2026-10-15g.md`; AUDIT GUILD-WORDS L3-12). It stands above the popup's buttons on the enhanced
  skin, the default; the classic window is DFU's own and draws nothing new (THE NATIVE-WINDOW RULE). Its words are the
  port's own strings (`guild.rankNeeds.*` - six keys at first; twelve now, with six `guild.probation.*` beside them,
  AUDIT GUILD-WORDS II C-13), drafted in-session in the thirteen whole languages.

THE FOUR HOSTS: the guild popup is worldModes.js's alone (openGuildService, every interior, online and offline) - WIRED;
world.js opens no popup of its own (its exteriors enter their halls through worldModes); exterior.js, the offline fixed
city, constructs no GuildServiceWindow; dungeonContext.js stands no guild hall. Recorded in Port-Ledger section A
(PROMO-NOW). Pinned by `test/systems/guild/fb1015_promonow.test.js` (8); `tools/mutants/fb1015_promonow.json` (10, all dead). PIN
MOVED: `test/systems/guild/guildreveal.test.js`'s G8 seam pin reads the flag beside the ceiling, and `tools/mutants/chap4b.json`'s
CHAP4B-FLOW-CEILING is re-aimed at the same line (34, all dead).

What the reporter is owed: online a promotion no longer waits 28 days. Talk to a guild-service NPC at the hall and you
are promoted the moment you qualify; if you are not, the popup now says what is missing - the reputation, or a second
guild skill at the rank's bar - and names the guild's own skills.
