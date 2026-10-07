# Online Waits - what is still long in the shared world, and four of them built

WAITS (2026-10-07). Mac: *"So with online mode being world based. What are some elements that are still far too
lengthy?"*, then, over the answer: *"Take care of this, you have autonomy"*.

**Status: BUILT 2026-10-07 - WAIT1 (OL6), WAIT2 (WAVE-WAIT), WAIT3 (SUMMON-NAME), WAIT4 (BANISH-SKY).** What the sweep
found that was already somebody's recorded call is left, with the call named (section 6); what is still a call is OPEN.
Offline nothing moves: DFU's one clock, its hours, its waves, its summoning day and REP3's thirty days, byte for byte.

## 1. The sweep

Five read-only lanes over the tree, 2026-10-07: the quests; what happens to the character; the shared world's
schedules; the economy, the crafts, travel and the calendar; and the records - every complaint and open call about
online time in this bible. Every figure is the code's own constant; the ones that led to a build were read again by
hand. The clocks are `Online-Time-Arc.md`'s three: the SKY (TimeScale 24, a day every real hour since SKY-SLOW), the
EVENT clock (TimeScale 12, a day every two real hours) and the character's OWN (TimeScale 12 while they play, moved by
a night, a Loiter, a journey - and online it is the one nobody else waits on).

Anything on the character's own clock can be spent: a night, a Loiter or a journey moves it. What is long is what sits
on a clock nobody moves - the sky, the event clock, real time, a UTC day - or on time played. Longest-felt first:

| Wait | Real time | Clock | What shortens it | Now |
|---|---|---|---|---|
| A Daedra prince at a temple or the Mages Guild | one real hour in fifteen days; between Vaernima's day (190) and Nocturnal's (248) nobody, for 58 hours; at a coven a given prince about 30 hours on average | sky (the year); event (the coven's draw) | nothing | WAIT3 |
| The bank (8-15), the palace (10-16), the library (9-23) | shut 42.5, 45 and 25 minutes of every real hour | sky (the hour) | nothing | WAIT1 |
| The King of Worms' messenger (S0000021, `send _zombie_ every 1410 minutes`) | up to 117.5 minutes of play, about an hour on average, before the main quest's giver speaks | played time | nothing (a rest spends none) | WAIT2 |
| A banishment | 60 real hours, while the calendar the player is shown runs thirty days in thirty hours | event | nothing (a pardon ends it) | WAIT4 |
| A guild's rank (Guild.cs's 28 days) | 56 hours of play; 11 or more with a night every ten minutes; about fifteen minutes of Loiter-and-night presses | own | a night, a Loiter, a journey | left - REST's OPEN 1 and 2; OPEN 1 here |
| A holiday (the cure days, the Witches Festival, the price days, Heart's Day) | each one real hour in fifteen days | sky | nothing | left - TIME 6.5; OPEN 2 |
| The full moon | thirty minutes held in the beast; two such nights four hours apart, then none for twenty-eight | sky | a Hircine ring | left - TIME 6.1, SKY-SLOW; OPEN 3 |
| The Sea Serpent | every four real hours, a fifteen-minute door, a ship needed; at worst 3 h 45 min | event (the relay's law) | nothing | left - OPEN 5 |
| An Oblivion gate | every two real hours, ten minutes' entry; at worst 1 h 50 min | event (the relay's law) | nothing | left - TIME OPEN 6 |
| The respawn of a dungeon's foes and chests | one real hour (`wire.js` RESPAWN_MS) | real (the relay's law) | nothing | left - TIME OPEN 8 |
| The Sigil Broker's Regalia | twelve stones: twelve gates, a real day at every one | event; the stock a UTC day | nothing | left - SS2 (Mac doubled the prices) |
| A Motherlode | three a UTC day, two hours each; gaps of up to about twelve hours | UTC | nothing | left - `Professions-Arc.md` |
| A profession's nodes, harvests and specialisation | a node back at UTC midnight, sixty harvests a day, a respec seven real days | UTC, real | nothing | left - `Professions-Arc.md` |
| A Seat | real weeks, a Season of eight | real | nothing | left - `../11-Multiplayer/Seats-Arc.md` |
| A `daily from` window, a target only at night | up to 55 minutes (M0B11Y18), 52.5 (A0C01Y01) | sky | nothing | left - TIMEFREE: schedules, not waits |
| A quest letter | waits for the sky's daylight: up to about thirty minutes | sky | nothing | left - REST8 |
| The Honored Mage's punishment (N0B20Y02's `_S.09_`, `Field-Bugs-2026-09-26b.md`'s open call) | seven days of play when it was opened, about fourteen hours | own, played | - | already answered: REST8 reads it a delay, the short wait (about two minutes of play) |
| Naval notoriety | from 100, about ten hours hunted and eighteen to nought | event | nothing | left - a punishment |
| A market buy carried across the Bay | fifteen minutes and a minute per ten map pixels - up to about two hours, twice that in a Bandit Summer | real | nothing | left - `Professions-Arc.md` (the market) |

## 2. WAIT1 - OL6: the bank, the library and the palace keep the shared world's hours

`systems/buildingLocks.js onlineReliefBuilding` names the bank, the library and the palace beside OL4's shops and
OL5's guild hall, and the ladder's other-structures arm threads `online` as OL5 threaded the guild arm. Everything that
asks `buildingHoursState` follows: the door (`scenes/worldModes.js resolveBuildingUnlocked`), the hover's closed line
(`systems/worldTooltips.js`, off the same `unlocked`), and the people - AddPeople's tail and UpdateNpcPresence
(`characters/interiorPeople.js`) read the effective hours, so the bank's clerk, the library's scholar and the court
stand on the shift where DFU is shut. Suns Rest stays a shop's closure. Still R1's: the houses and the house for sale
(a residence is not a service), temples and taverns (they never closed), ships (ownership).

Why: OL4's reason, unchanged. The hours are read on the sky since TIME1 and a sky day is one real hour since
SKY-SLOW, so DFU's 8-15 shut the bank from :37:30 to :20 - forty-two and a half minutes of every real hour, and with it
deposits, loans, letters of credit, the Marks exchange and a ship's sale; the palace's 10-16 shut its court, its
quest-givers and the main quest's S0000012 messenger forty-five; the library's 9-23 twenty-five. OL4's own record named
the bank and the library a follow-up ("Recorded, not carried", `Online-Arc.md` OL4); this carries it, with the palace.

Pins: `test/ol6_service_hours.test.js`; `test/lockpicking.test.js` PIN MOVED (the palace's and the bank's online
answers). `tools/mutants/ol6.json` 7, all dead; OL4's list 15, all dead, OL5's record re-aimed by content.

## 3. WAIT2 - WAVE-WAIT: a wave the quest waits on comes on the short wait

A wave (`create foe` / `send ... every N minutes`) runs on played time online - WORLD7's step, QCLOCK-WORLD's lived
charge, a rest spends none of it - and REST8 kept its interval whole as pacing. Pacing it is, for a wave that harasses:
its gap is the player's breathing space. One wave in the corpus is not pacing but the quest's next page: the King of
Worms (S0000021) is mute until his zombie messenger is killed (`killed 1 _zombie_` -> `when _S.02_ and _S.15_` -> his
offer), and it was sent `every 1410 minutes`.

- **The reading** (`systems/quest/clock.js waveIsAwaited`): a wave whose foe's KILL the quest waits on - its `killed`
  task, and what that reaches through a positive `when` (`reached`, the clock reading's own walk), offers the quest (a
  Prompt) or settles it (a reward, TrainPc, the next quest). An `injured` task is the foe's own cry, not read; a kill
  that reaches a word at most (`say`) is not the quest's page.
- **The law** (`systems/quest/actions.js CreateFoe._firstArrivalSeconds`): online, an awaited wave's FIRST arrival
  lands within the short wait (`ONLINE_DELAY_SECONDS`, 24 of the character's minutes - about two real minutes of play):
  DFU's one Range draw, its span the short wait. Until it first comes nothing puts it further away - a resume, a load
  that stamps `now` (restoreSaveData's quirk, a whole interval), a failed roll. Once it has come, the waves after it
  keep the script's interval. Played time still: a rest brings it no sooner.
- **The corpus** (241 waves): 28 read as awaited, 26 of them already no longer than the short wait (the law moves
  nothing there); the two it moves are S0000021's messenger (1410 minutes) and N0B20Y02's Nightblades (55 - still
  inside GUARD-WINDOW's three hours). Every wave the quest does not wait on keeps DFU's pacing whole: K'avar's archers
  (2000 minutes), the knights on the totem (1300), the Sx100 ambushes and S0000103's vampires, S0000012's Nightblade
  after Aubk-i, the bribe path's knights and barbarians, the posse, the thief - shortening a harasser's gap brings the
  harm sooner, not the story.

Pins: `test/wavewait_quests.test.js` (the real scripts, parsed and ticked). `tools/mutants/wavewait.json` 13, all dead.

## 4. WAIT3 - SUMMON-NAME: online the summoner calls the prince you name

DFU's temple and Mages Guild answer one prince on his own day of the year and nobody on the other 344
(`systems/daedraSummoning.js daedraForSummoner`, unchanged); a single player waits a rest of seconds for the day. Online
the day is the sky's and no rest moves the sky. For OL4's reason - a schedule nobody can rest through is a real-time
lockout - online the temple's and the guild's summoner lists the sixteen by name (`summonsByName`, `PRINCES_BY_NAME`,
`summonByNameBoxes`; the host's summoning branch in `scenes/worldModes.js` opens them as a flow), then asks DFU's
question about the one picked: record 481 from "Do you" (`SUMMON_BY_NAME_ROWS` - its breaks and its "you life" kept;
its "Today is %dat, the day of summoning for %dae" would be false on every day but his). The Yes is DFU's summoning of
that prince, whole: the price off the summoner's regard (200,000 less a thousand a point), the chance off the prince's
own regard and his weather, Sheogorath's gatecrash, the prince met before, the gold gone before the roll, the quest he
offers and his film.

A witches' coven keeps its own law - one prince a day, drawn (the event clock's day online, TIME1) - and Glenmoril its
Hircine; the coven's popup hands its own summoner, so it never opens the list. Without the list's art loaded the
summoner falls back to DFU's day. Offline: DFU's day.

Pins: `test/summonname_online.test.js`. `tools/mutants/summonname.json` 11, all dead; DAEDRA1's two records in the
moved Yes re-aimed by content.

## 5. WAIT4 - BANISH-SKY: a banishment's thirty days are the calendar's the player sees

REP3 (2026-09-29, Mac: "Timed or pardoned" - "Lifts after about 30 game days (~2.5 real days)") counted the thirty days
on the world's event clock, which was then the calendar every menu showed. TIME1 (2026-10-01) gave the menus the sky's
calendar, and SKY-SLOW made its day one real hour: the two halves of REP3's call came apart - a player told "banished
for 28 more days" watched twenty-eight days go by on the calendar and was banished as long again. BANISH-SKY keeps the
thirty days the call named, of the calendar the player sees:

- `systems/standing.js banishmentTermMinutes`: thirty days of the sky, in the world's (event) minutes - fifteen
  event days, thirty real hours. Stamped on the event clock as every term is (TIME's rule: no stamp is taken on the sky);
  sized by the sky's rate against it, `systems/worldTick.js skyPerWorldMinute`, which the shared clock's install hands
  to `setBanishmentCalendar` - read off the sky's own inverse, so a later rate is read as it stands.
- `banishmentDaysLeft`: the days left in the sky's calendar. The temple's offer says them, and online what they are on
  the wall (`worldSpanRealWords`): "You are banished from Wayrest for 30 more days." / "(about 30 hours)". The Standing
  page: "banished, 30 days left, about 30 hours (a pardon: 2500 gold)".
- A banishment stamped before BANISH-SKY keeps its stamp; a term not known at the arrest (AUDIT REP F2) takes the new
  term at its first trusted read. Offline the rate is one: REP3's thirty days whole.

The other reading of REP3 - keep its "~2.5 real days" and say sixty days on the calendar - is OPEN 4.

Pins: `test/banishsky_standing.test.js`; the census row (`test/fixtures/time1_census.json`, the sky's rate).
`tools/mutants/banishsky.json` 13, all dead (with REP3's and AUDIT REP's lists, two records re-aimed by content: 41).

## 6. Left, and why

Each of these is somebody's recorded call; the sweep only measured it again (section 1 has the numbers).

- **Guild ranks, the night interval** - REST's OPEN 1 and 2: Mac chose a night with ten real minutes between, with
  "a 28-day rank wait takes at least 11 hours of play" in front of him. See OPEN 1.
- **Holidays** - TIME 6.5: the calendar runs with the sky, "every holiday once a week for half an hour" at the first
  rate; SKY-SLOW halved the rate and doubled the year. Bonuses, not gates. See OPEN 2.
- **The full moon** - TIME 6.1 (the change holds while the moon is up) and OPEN 2 there; SKY-SLOW's record lists the
  night's thirty minutes. See OPEN 3.
- **The gate, the respawn, the serpent** - TIME OPEN 6 and 8, and the serpent's own arc: their laws are in the relay's
  bundle (`net/gateLaw.js`, `net/wire.js` RESPAWN_MS, `net/serpentLaw.js`), so any change is a relay deploy that drops
  every connected player. See OPEN 5.
- **The Broker's prices** (SS2), **the professions' UTC days and respec** and **the Seats' weeks** - their arcs' calls,
  each an economy's pace rather than a wait.
- **`daily from` windows and night-only targets** - TIMEFREE (`Online-Time-Arc.md` 6.3b): schedules, not waits;
  forcing them open breaks the quests that split a day between places. GUARD-ONLINE stands (TIME OPEN 5).
- **Letters by daylight** - REST8 kept "a letter waits for town and the sky's morning".

## OPEN - Mac's calls

1. **Loiter and the night interval.** LOITER-ANYWHERE (2026-10-04) put DFU's Loiter back online - 1.25 real seconds a
   game hour up to the Loiter limit (3 hours by default, 12 at most) - and a loiter moves the character's own clock.
   REST's night interval counts that clock (`systems/restAct.js nightDue`), so a three-hour loiter makes the next
   night due at once: Loiter, night, Loiter, night passes a rank's twenty-eight days in about fifteen minutes of
   presses, and REST's bound of eleven hours of play does not hold. Either it stands - the own clock is the player's to
   spend - or the interval counts lived minutes alone and the rank wait is eleven hours of play again. Recommended:
   leave both as they are until play reports the rank wait; if it is to be shorter, shorten the gate itself online
   rather than leave Loiter's presses as the way.
2. **Holidays.** Recommended: leave. The alternative: online a holiday holds its sky week (seven real hours).
3. **The full moon.** Recommended: leave - the moon is up all night. The alternative: online the lock holds from dusk
   to midnight, fifteen minutes, TIME's first figure.
4. **Banishment's length.** Built: REP3's thirty days, of the calendar the player sees (thirty real hours).
   The alternative: REP3's "~2.5 real days", said as sixty days of that calendar.
5. **The cadences the relay keeps** - the serpent's four hours and fifteen-minute door, the gate's ten minutes'
   entry, the hour's respawn. Recommended: leave until a relay deploy happens for its own reason, then decide with it.

## Record

- 2026-10-07: the sweep (section 1) and the answer to Mac's question; then, at "Take care of this, you have autonomy",
  WAIT1-WAIT4 built and pinned, each with its mutant list all dead; the bible's pages that said otherwise corrected
  (`Online-Arc.md` OL4's follow-up, `Online-Time-Arc.md` 5.1, 5.2 and 6.3d, `Standing-Arc.md` REP3,
  `Field-Bugs-2026-09-26b.md`'s open call, Port-Ledger A).
