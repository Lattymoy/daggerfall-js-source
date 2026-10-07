# AUDIT LIVED1 - your own time online, read before it merges, 2026-09-29

Mac: *"Lets do an audit on this"*. The subject is LIVED1 (`06-Systems/Lived-Time.md`): the two clocks online, commit
`1e12a3e6` on `ccr-db2623d6-6g44d6`, 207 files past main's `f4dc60ce`. Six lanes read that FROZEN tree (nothing was
fixed while a lane read - Home.md, 17l), each reproducing what it reported by driving the real modules (and, for the
offline parity lens, the base tree beside it with a recorded `Math.random`):

- **K** the clock core (`systems/worldTick.js`: the two windows, the raise, the arrival, the rise, offline parity);
- **R** every reader and every stamp in `src/` on the right clock (a stamp on one clock read on the other);
- **S** the save and the lifecycle (every door a session starts, ends, saves, loads or switches through);
- **P** party, shared state and exploits (anything crossing between two characters' clocks; what a rest can buy);
- **U** the words and the UI (both skins, online and offline; the patch notes against the code);
- **T** the record, the pins and the mutants (a law with no pin, a pin that passes on broken code, a stale record).

**What held.** Offline is DFU's, byte for byte: K ran base and head in separate processes with one recorded random
stream over frames, an 8-hour RestSession, multi-day advances across the 7-, 38- and 112-day boundaries, a 20-day
journey, both collapses, the fortnight, a mixed run (a disease, a poison, two spells, two loans, a room, a conjured item,
needs), a werewolf through a full moon and a vampire - the rolls (count and values), the entity, the snapshot and the
restore were identical. `setSharedClock` is called once, at the boot. Every revival goes through `reviveForPlay` ->
`skipDeadMinutes`; the sentence, the turn's fortnight, the collapse's hour and the journey land on the character's
clock; partner buffs, duels, conjured items (refused in trades), repairs, the party mirror's and party travel's clocks,
shared quests and every world-owned reader (shelves, prices, respawns, spawned dungeons, raids, fires, torches, the
Daedra days) hold. The numbers the words claim are true (a week's room is 14 hours of play; the longest daylight wait
is an hour; a rested hour is 0.45 real seconds; SURV7's grace is one world day, two real hours).

## Fixed

Every finding was reproduced against the frozen tree before it was fixed, pinned in `test/auditlived1.test.js` by a
test that fails on the unfixed tree for the finding's reason, and mutation-proven: `tools/mutants/auditlived1.json`,
67 records, all dead (and the 34 older ones it re-aimed or leaned on - `lived1.json` whole and eight re-aimed by content - re-run: all dead). Each fix carries an `AUDIT LIVED1 <ID>` comment. A finding more than one lane found carries every ID.

| ID | Lanes | Sev | Finding | Fix |
|---|---|---|---|---|
| A | K2, S1, R3 | high | THE DUNGEON'S REST READ THE SKY OFF THE CHARACTER'S CLOCK. Its rest arm runs the player's rounds itself (`dungeonContext.js` `_restAdvance`) and passed no `skyMinutes`, so the rounds' sky fell back to the window's end - the character's minute. A werewolf resting in a dungeon under their OWN calendar's full moon was forced into the beast (hands emptied, healed) while the world's moon was not full; a vampire resting there under the world's night took the day's -20. Above ground the ticker's rounds read the world's. | The arm hands its rounds the world's reading, as the tick does. |
| B | P1, S2, R1 | high | A QUEST'S "MAKE PC ILL" STAMPED THE DISEASE ON THE WORLD'S DAY (`world.js` `makePcDiseased`, `gameDaysNow()` off `playerTicker.classicMinutes`) while its rounds walk the character's. Five shipped quests use it, the main quest's Caliron's Curse (S0000007) among them. A character behind the world (every absence; a brought-in one by years) lost the incubation and gained the gap in symptom days (Wizard Fever 11 -> 41 over a 30-day gap; 11 -> 95 over 84); one ahead took the whole gap's daily damage in one round (Witches' Pox 30 days ahead: STR -208, dead within the second; 20 of 40 runs dead at 8 days ahead, 40 of 40 at 12). | The day is `ownMinutes() / 1440`. |
| C | R4, P4 | med | THE TEMPLE'S HOLIDAYS READ THE CHARACTER'S CALENDAR. LIVED1 moved the guild services' `now` to the character's clock for training's cooldown, and the cure flow's one read of it is `GetHolidayId` - the free cure on South Winds Prayer, the half price on First Harvest. A player rested or loitered onto their own holiday for a free cure; on the world's announced holiday the temple charged 306 gold. Every other holiday reader is on the world's calendar. | The cure flow reads the world's clock; training keeps the character's. |
| D | R2, P5 | low | QUEST TRAINPC STAMPED THE TRAINING TIME ON THE WORLD'S MINUTE (`quest/actions.js`, from `nowSeconds`) while the guild's twelve-hour gate reads the character's: 84 days behind, training refused for 84 days of their time; ahead, no cooldown. No shipped quest trains the player - a mod's would. | A quest hook `ownMinutes` (machine deps -> the world host); TrainPc stamps it, before its three hours, as DFU does. [AUDIT LIVED1b D1: the bridge dropped the member - D never reached the game until the bridge forwarded it.] |
| E | S3, R5, S5, U4 | med | COPY TO OFFLINE CARRIED THE WORLD'S STAMPS INTO A LANE WITH ONE CLOCK. The copy set the offline clock from `classicMinutes` - the character's - and kept every stamp on the world's: a quest clock's sample, a CreateFoe's last wave, the rumours' limits, the spawned dungeons' ledger, a fire's hours. Offline a quest clock charges its raw gap: four days ahead, a 3-day clock failed on the first frame; six months behind, it gained six months; an 8-hour fire burned 100 days. The copy's enhanced card read the world's date while it loaded at the character's. | `systems/offlineCopy.js offlineCopyOf`: the world's stamps move once by the distance between the two clocks (a zero stays "never"), and `worldMinutes` goes. Every card reads the one clock a local slot loads at. [AUDIT LIVED1b R1, R3, D2: and missed three - the raids' schedule (now dropped), a journal step's date and a cached building's stock days (now rebased).] |
| G | R6 (S) | low | BRING ONLINE READ THE OFFLINE CALENDAR AS AN ABSENCE. An offline envelope has no `worldMinutes`, so the first join measured TM-1's recovery and SURV7's grace from its offline date to the world's (a legal -15 came in at -12); its world stamps met the shared clock unmoved. | `onlineCopyOf`, the mirror: the world's stamps move onto the shared clock and the envelope says it joined at the world's minute. |
| F | K3, S4 | low | A SAVE FROM BEFORE LIVED1 COULD HOLD A DAY AHEAD OF ITS CLOCK. RESTX2's online rest ran the rounds on a session counter, and the checkpoint saved under the rest window, so a disease's day could be written a night ahead of `classicMinutes`; the old arrival clamped it, LIVED1's shifts nothing, and the first round gave the day back and rolled it again (seam 1, once more). | `save.js clampMarkersAheadOf`, on the online load of a save with no `worldMinutes`: a disease's day, a poison's minute and the curses' clocks are brought back to the restored clock. [AUDIT LIVED1b S2: the clamp removes the day given back, not the night re-lived - one extra roll per simulated midnight remains, once; recorded for Mac.] |
| H | P2 | med | THE PARTY REST'S MIRRORED NIGHT WAS ROLLED ON WAKING. The mirror moves the follower's clock and rolls no encounter (PSCALE1 COUNT-1), but left the encounter loop's marker at the night's start, so the first frame up walked the whole night as WALKING minutes: an encounter stood on 73% of wakings for the party's elected roller (the leader had already rolled the night), and a follower below -10 took up to 480 guard rolls. | The mirror moves the marker with the night. [AUDIT LIVED1b P1: moving the marker past the night skipped the follower's own watch; the mirror now walks the loop with the wanderers left out.] |
| I | K1 | med | A BACKWARD WORLD STEP WALKED THE WORLD'S POWER AND CONDITION ARMS TWICE. The reading re-anchors down when the source steps back (C2) or a correction lowers it, and the world's arms then walked the minutes between again - the 7-day and 38-day walks are not idempotent, so the player's faction state left the shared day's. The base was guarded by the one clock's monotonic marker; the world's arms had none. (The correction path also re-walked in the base.) | A world-arms high-water mark: only ever raised, and the world's arms (the tick's and the rise's) start at it. [AUDIT LIVED1b P3: one mark counted as walked minutes no walk covered (a fast machine clock at the boot lost the next power day and midnight); SUPERSEDED by the walked spans.] |
| J | K6 | low | A COLLAPSE FIRED FROM INSIDE A ROUND RAN A NESTED TICK AHEAD OF THE WINDOW IN HAND. A poison draining fatigue to nothing inside a rest's or a journey's rounds fired the collapse, whose `advance(60)` re-entered the tick: its hour's rounds ran before the outer window's, a disease day rolled there was given back by the outer round and rolled again. (Offline the same re-entry is older than LIVED1 and is left as it was - recorded below.) | Online, an advance while a tick is in flight is a bare move of the character's clock (DFU's RaiseTime), walked in order by the next tick (`tickInFlight`). [AUDIT LIVED1b K1: the next tick is the one the collapse's box holds - a draining poison collapsed again under every round; the ticker now walks the raise at once, under the box's guard.] |
| L, P, Q | K5, U5, U6, R7 | med | THE DUE-BYS DID NOT FIT, AND ONE WAS A DATE ON THE CHARACTER'S CLOCK. The classic bank's label ran 99 native px past the parchment ("in 359 days 22 hours of your time (720 hours of play)"); an overdue loan read "in 0 minutes of your time (0m of play)"; the classic character sheet's loan column printed a calendar date on the character's clock - the reading the bank window had been changed to avoid. | `ownTimeLeftShort`: the short form for the classic labels ("in 359 days of your time"; the sheet "in 359 days"), "due now" once due; the enhanced face keeps the whole words under "Loan due". |
| M | U1 | med | THE CLASSIC HUD CUT THE DAYLIGHT REFUSAL - the answer to the Discord complaint - off both edges of the screen: one unwrapped row of about 485 native px, the minutes lost at 1024x768. | The map door says the nightfall on its own HUD row (`sayWithNightfall`); the chat's PARTY-TRAVEL refusal wraps and keeps one line. |
| N | U2 | med | THE CLASSIC TAVERN'S OWN-TIME OFFER WAS WIDER THAN THE SCREEN (a renewal's row 550 native px). | Two rows, split at the play's bracket. |
| O | U3 | med | THE DEFAULT SKIN NEVER SHOWED THE REST LINE: its rest card - every enhanced rest and every party mirror - had no clock line. | The card writes `restClockLine` beside the vitals, the same way. |
| S | U8 | low | A loiter said "you rest on your own clock"; the enhanced bank said "Loan due by \| in 360 days". | A loiter waits; the row is "Loan due". [AUDIT LIVED1b U4: the relabel reached the offline card too; offline it says "Loan due by" again.] |
| V | P6 | low | A dungeon foe's poison minute, published with its effects, was restored by the next host against ITS clock: three days apart, the whole remaining poison landed in one round. | A record off the wire resumes its poison at the restoring host's now. |
| T1 | T | high | THE WORLD'S HALF OF THE TWO-WINDOW SPLIT HAD NO PIN: walking the world's day block or arms over the character's window (a rest re-rolling the six zones and the faction powers) survived 294 test files. | Pinned: a rest across the character's own power minute and midnight moves no power and rolls no zone; a world boundary in play walks once. |
| T2 | T | high | THE RISE'S WORLD HALF LOST EVERY BEHAVIOURAL PIN IN THE RE-AIM (`const last = now` survived). | Pinned: a death across the world's power minute walks it once at the rise, and a second rise - or a correction and a rise - walks nothing. |
| T3-T8 | T | high/med | THE HOSTS' RE-POINTED READS WERE PINNED BY NOTHING OR BY SHAPE ALONE: the save composer's clock, the journey's advance (a two-line guard survived), the moon's and the sun-damaged career's sky, and sixteen personal reads (MorphSelf, the letters, both vampire rest gates, the cure's hour, a quest's join date, a drink, the rank wait, the loan stamp, a conjured item, the smith's booking - MAC-BUG3's intent - the rest's own landlord, the rest place's hours, the turn's satiation and the feeding stamp - DISC10 V9's intent - the dungeon's meals); the feeds of the sky and the calendar (the spawn table's hour, both taverns' Heart's Day, the kitchen, a meal's holiday, the dungeon's air, the smith's words). | Pinned: the moon, the sun and the feeding stamp by behaviour; the rest by source, each a mutant that flips its clock. [AUDIT LIVED1b T4: nineteen more host reads had no pin - the journey's encounter marker, the smith's other five, exterior's six among them; pinned now.] |
| K, U9, T9-T12 | K4, U9, T | low | Stale words: source comments and bible sections still describing the retired mechanisms as live (the dead span's drift, "no such fortnight", "online the clock is nobody's", "the arrival is now and the day count is zero", the prison release's revival), Testing.md rows stating retired laws, test titles saying the reverse of their assertions, a record naming a law its mutant no longer hits. | Re-worded or stamped SUPERSEDED where written; the rows re-aimed. |

## Recorded, not fixed

- **P3 - an enchanted item's leech and reroll stamps cross a trade on the giver's clock** (`timeHealthLeechLastUsed`,
  `timeEffectsLastRerolled`: declared wire fields, moved whole by the realm's settle). A receiver days ahead takes the
  weekly leech at once; one days behind is leech-free for the gap. The fix makes the two fields volatile on the wire
  and at the realm's settle (`net/realmTradeLaw.js TRADE_VOLATILE_FIELDS`, which the realm service runs too) and reads
  a missing stamp as now - a change to the realm service, for its own pass. Low: it needs a Health Leech item.
- **P7 - food's `rotDay` rides a trade on the carrier's rot counter** (older than LIVED1): a stripped stamp would read
  as fresh food, so this wants its own design.
- **K6's offline twin** (older than LIVED1): offline the collapse's nested tick re-anchors the broker backwards - one
  round more per fatigue-band collapse (243 for 240 minutes) and the whole window again for one fired inside a round
  (1265 rounds for 665 minutes). DFU's RaiseTime is a bare move; making the port's one is an offline parity change,
  owed its own pass.
- **Suspects not verified, carried for their own passes** [AUDIT LIVED1b settled five: the travel line (U1), the smith's
  rounding (U2) and the two dead words (U6) reproduced and fixed; the boot's absence reproduced as an exploit and fixed
  (P4); the born-online local slot unreachable (O)]: the classic travel popup's online line measures about
  348 native px against the 320-px panel (whole at 16:9, a few pixels lost at 4:3 - U); a born-online session's
  local slot, if one is ever written before the realm holds the character, would carry `worldMinutes` into the
  offline lane unrebased (U); the enhanced smith's row rounds its days up where its detail line floors them (U);
  `realTimeText` and `sharedRealTimeText` have no caller left in `src/` (the gates read `sharedWallMs` directly -
  U); the vampire's fortnight is measured to the world's evening while it moves the character's clock (a day's
  variance, K); a foe I own takes my whole rest window, and a partner's Paralyze on it ends in the rested night (P,
  older than LIVED1); the boot's absence is measured on this machine's clock before the relay's offset arrives (S).
- **Process (T13):** `tools/mutate.mjs --jobs` judges a record IN PLACE when one of its named tests fails in a
  workspace (`citedrift.test.js` needs the repository's own `.git`): a lane that assumes the tree is never touched is
  wrong, and an unrelated failure there reads as "dead". Documented in the tool's own header; said here for whoever
  runs a lane next.

## For Mac

1. **Quest countdowns on the character's clock** (Lived-Time's OPEN 1): journeys and rests still charge a quest's timer
   nothing, so a deadline ignores the travel it asks for.
2. **An accelerated walk** (Travel Options) costs the character's clock 1x online and Nx offline; fast travel now
   charges the whole trip. TO1 recorded the acceleration's online arithmetic and was asked to make no online rule, so
   whether a walked journey should charge its compressed time is yours. [ANSWERED: *"Dont worry abour DFU."* (FIELD
   BUGS 2026-09-29h, WALK-CLOCK) - online an accelerated journey's minutes past the world's are raised on the
   character's own clock, so it charges its compressed time as offline.]
3. **The waits a rest can shorten**: training is now limited by gold alone (a session per 20 real seconds against one
   per real hour before), and a rank's 28 days are about five minutes of resting - as offline, and as OPEN 3 (a rest
   cooldown) asks.
4. **Calendar-gated services can no longer be waited out**: a Daedra prince's day is one 2-hour window every 30 real
   days, on the world's calendar. [ANSWERED by SUMMON-NAME (2026-10-07, `06-Systems/Online-Waits.md` WAIT3): online
   the temple's and the guild's summoner calls the prince the player names, on any day. Found still marked open by
   AUDIT WAITS (S3).]
5. **A hidden tab** (requestAnimationFrame paused) bills its whole hidden span to the character on the first frame back
   (as the base did): "stands while away" holds for a logout, not a background tab.
6. **A new vampire turned online** wakes in the world's present, possibly by day - the fortnight is the character's,
   the sky is not.
