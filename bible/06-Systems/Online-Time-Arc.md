# Online Time - a sky that turns, a clock for the world's business, and your own

TIME (proposed 2026-10-01). Mac: *"I want to talk about how we could change online time, currently I
just feel like people have to wait insanely long, werewolf forms last insanely long, etc"*, then *"I
don't want a band aid, I want a detailed way we can do this."*

**Status: BUILT 2026-10-01 - TIME1, TIME2, TIME3 and TIME4** (Mac: *"And this is the way?"*, then *"Let's do it.
This needs to be perfect"*: every recommendation below, OPEN's calls with them). It extends LIVED1 (`Lived-Time.md`),
which gave every character a clock of their own; it keeps all of it. Offline is untouched: one clock, DFU's
TimeScale 12, byte for byte. **The sky switches at 2026-10-03T17:07:30Z** (`net/skyLaw.js` `SKY_SEGMENTS`); a build
that goes live after that instant must move it to the next aligned one first (`node tools/skyCutover.mjs`), or the
sky jumps once at the deploy (section 4). What was built beyond this design, and why, is in 6.3a and the Record.

## 1. The problem, stated whole

DFU's day is two real hours (TimeScale 12), and a single player can afford that: any wait is a rest of a
few seconds. Online, WORLD5 made the world's clock a function of wall time that nobody can move, at the
same rate. LIVED1 then gave each character their own clock, which a rest, a journey or a sentence does
move, and the waits that belong to the character came back as DFU has them: an infection's turn, a
promotion, training, a letter, a repair.

What LIVED1 could not reach is every wait on the SKY: a wait for a time of day, a date or a moon. No rest
moves the sky, so each of those is a real-time wait at the single-player rate:

| Wait | Real time today | Why no rest helps |
|---|---|---|
| A werewolf on a full-moon day | 2 h in beast form, forced back every game minute; two such days in every 64 h | the moon is the sky's (`lycanthropy.js` reads `skyMinutes`) |
| A vampire waiting for dusk | up to 1 h | the sun is the sky's (`worldTick.js worldNightfallText`) |
| A quest's `daily from` window | up to 2 h | the hour is the sky's (`quest/actions.js DailyFrom`) |
| A quest's countdown ("come back in 3 days") | 2 h of play per game day | charged by played time alone (WORLD7); a rest charges it nothing |
| Night | 1 h of dark | - |

The waits on the character's own clock are not on this list: they are already a rest away. A
promotion's 28 days is about five minutes of resting, an infection's turn under a minute.

And the tree already carries the pattern Mac called a band aid: each sky wait that hurt got a fix of its
own, and each fix is a special case.

- **GUARD-ONLINE** (`quest/onlineGuard.js`): one quest's `daily from 00:00 to 03:00` is replaced, online
  and for that quest alone, by a window that opens a minute after the player arrives, because the real
  window came round once every two hours.
- **The nightfall words** (`worldNightfallText`): a vampire is told how many real minutes until the
  world's dusk, because nothing could shorten it.
- **WORLD7**: quest clocks charge played time, one bounded step a frame, because the world's clock would
  have charged them through every logout and a rest could not charge them at all.
- **OL4 / OL5** (`buildingLocks.js`): shops and guild halls never close online; the code says the shared
  clock is the reason.

The next one would have been the full moon. This page replaces the pattern with a model.

## 2. The model: three clocks

| Clock | Rate online | Who moves it | What reads it |
|---|---|---|---|
| **The sky** (new) | TimeScale 24: a day every real hour (SKY-SLOW; designed at 48) | nobody; a function of wall time | what the world looks like, and every "what time of day, what date, which moon" |
| **The event clock** (WORLD5's shared clock, unchanged) | TimeScale 12: a day every 2 real hours | nobody; a function of wall time | what the world schedules, stocks, prices and meters for everyone; the relay's every read |
| **Your clock** (LIVED1's, unchanged) | TimeScale 12 while you play | you: a rest, a loiter, a journey, a sentence | your body, magic, needs, contracts and standing; and, new, your quests' countdowns (QCLOCK-WORLD: online only as it moves with the world - a raise charges them nothing) |

LIVED1's "world's clock" becomes two: the sky, which is new, and the event clock, which is the clock
LIVED1 already calls the world's. In code `worldMinutes()` keeps its meaning (the event clock online, the
one clock offline) and `skyMinutes()` is added beside it; renaming every reader across the open pull
requests would be churn for nothing.

**The rule for which clock a law reads.** Ask what the law is about.

1. **What the world looks like, or what the hour, the date or the moon is**: the sky. Light, sun, moons,
   stars, the season's ground, holidays, opening hours, night spawns, the curses' sun and moon, a
   quest's hour window, the date and time the menus show.
2. **What the world schedules, stocks, prices or meters for everyone**: the event clock. Gates, raids,
   the overworld's rows, prices, shelves, faction powers, regional conditions, terms, a day's caps, the
   weather's rolls, the time a player was away. None of these may speed up with the sky, or every daily
   reset, reroll and event would come four times as often.
3. **What happens to you**: your clock.

**Nothing walks the sky.** The sky holds no state; it is read, never walked. Every law that walks minutes
(the day block, the calendar arms, the broker's magic rounds, the per-minute loop, the weather's rolls and
evolution, the drawn weather's ease and drift) walks the event clock or yours, exactly as it does today. That is what makes the sky's rate a
dial: changing it changes what players see and how long a wait on the sky lasts, and nothing else. A
census test holds every reader to its clock (section 5).

**Why the event clock and your clock keep TimeScale 12.**

- **Your clock paces combat and the body.** A magic round is a game minute on it (`claimMagicRounds`), so
  a buff, a poison, a disease, regeneration, hunger and thirst keep DFU's real-time feel. Speeding it up
  would quarter every spell's duration.
- **Your clock paces the road.** A game day of walking, a quest's deadline against travel, an inn's
  nights: DFU's ratio of real effort to game time stays.
- **The event clock is the relay's and the economy's.** Leaving it alone means the relay does not change
  and nothing is rebalanced by accident.
- **Today the shared clock and your clock already run at one rate,** so splitting the sky off moves
  nothing that is not sky. The character's window stays "the event clock's movement plus any raise",
  LIVED1's own law, untouched.

## 3. The rate

One constant, `SKY_MINUTES_PER_MS`; every number below follows from it. [As built: the rate is the last row of
`SKY_SEGMENTS` in `net/skyLaw.js`, `24 / 60 / 1000` since SKY-SLOW (2026-10-02, below the table); it was 48.]

| TimeScale | Sky day | Night, and the longest wait for dusk | Full-moon beast form (6.1's rule) | Moon cycle | Year | Season |
|---|---|---|---|---|---|---|
| 12 (today) | 2 h | 1 h | 2 h (DFU's whole day) | 64 h | 30 days | 7.5 days |
| **24 (as built, SKY-SLOW)** | **1 h** | **30 min** | **30 min** | **32 h** | **15 days** | **3.75 days** |
| 36 | 40 min | 20 min | 20 min | 21 h 20 min | 10 days | 2.5 days |
| 48 (the first call) | 30 min | 15 min | 15 min | 16 h | 7.5 days | 45 h |
| 60 | 24 min | 12 min | 12 min | 12 h 48 min | 6 days | 36 h |
| 72 | 20 min | 10 min | 10 min | 10 h 40 min | 5 days | 30 h |

**SKY-SLOW (2026-10-02): 24, not 48.** Players found the 48 sky zoomed by: the sun crossed in 15 minutes and the
hours ran past while they played. The row was replaced before it went live (`node tools/skyCutover.mjs --scale
24`), ahead of its 2026-10-03T16:22:30Z switch. At 24 a day is a real hour, midnight falls on the hour UTC, dawn at :15, noon at
:30 and dusk at :45; a night, a full moon's change and the longest wait for dusk are 30 minutes each; full-moon
nights come four real hours apart, then none for twenty-eight. Every wait the arc set out to shorten is still half
of DFU's. The reasoning below is the first call's, at 48; its shape holds at 24 with every real figure doubled.

**Why 48 (the first call).**

- **No wait for the sun or the moon outlasts a night,** and a night is 15 minutes. No wait for an hour
  of the day outlasts a day, and a day is 30.
- **The schedule is a clock face.** With the cutover aligned (section 4), midnight falls on the hour and
  the half hour for good, so a player can plan without arithmetic:

  | Sky time | Real time, every hour |
  |---|---|
  | 00:00 midnight | :00 and :30 |
  | 06:00 dawn | :07:30 and :37:30 |
  | 12:00 noon | :15 and :45 |
  | 18:00 dusk | :22:30 and :52:30 |

- **Night stays a place.** Fifteen minutes of dark is still long enough for the vampire, the thief and
  the night's spawns to matter; ten starts to lose it.
- **The sky still reads as a sky.** The sun crosses from dawn to dusk in 15 minutes, against 10 at
  TimeScale 72.

## 4. The cutover: one constant, no jump, no relay change

The sky's law is a new leaf, `net/skyLaw.js`, which imports WORLD5's from `net/wire.js`. It must not live in
`wire.js` itself: `wire.js` is in the relay's bundle, and `relayversion.test.js` binds `RELAY_VERSION` to
every byte of that bundle, so one added line would force a relay deploy and drop every connected player
for a law the relay never runs. A test pins the other half: the relay's import graph never reaches
`skyLaw.js`.

```js
/** TIME1: the instant the sky took its own rate, relay-clock ms - one of the aligned instants below. */
export const SKY_CUTOVER_MS = Date.UTC(/* chosen at merge */);
/** TIME1: classic minutes per real ms for the sky - TimeScale 48, a day every thirty real minutes. Mac's dial. */
export const SKY_MINUTES_PER_MS = 48 / 60 / 1000;
const SKY_CUTOVER_MINUTES = sharedClassicMinutes(SKY_CUTOVER_MS);
/** TIME1: the sky's clock, classic minutes, for a wall-clock instant - the event clock's before the cutover. */
export const skyClassicMinutes = (nowMs) => (nowMs < SKY_CUTOVER_MS ? sharedClassicMinutes(nowMs)
  : SKY_CUTOVER_MINUTES + (nowMs - SKY_CUTOVER_MS) * SKY_MINUTES_PER_MS);
/** TIME1: the inverse - the relay-clock ms at which the sky reads a classic minute. */
export const wallMsForSkyMinutes = (m) => (m < SKY_CUTOVER_MINUTES ? wallMsForClassicMinutes(m)
  : SKY_CUTOVER_MS + (m - SKY_CUTOVER_MINUTES) / SKY_MINUTES_PER_MS);
```

[As designed. As built (TIME1): `SKY_SEGMENTS`, a list of `{ fromMs, minutesPerMs }` rows read by `skyLawOf`, so a
later change of rate is a new row that starts where the last one stood - the same law with no jump at any switch.
`skyClassicMinutes`, `wallMsForSkyMinutes` and `skyMinutesPerMsAt` are its doors.]

- **No jump.** At the cutover both laws read the same minute, so the sky does not skip.
- **Aligned.** If the cutover falls where the old sky's time of day already equals the new schedule's,
  the new sky's midnights land on the hour and the half hour forever after. At TimeScale 48 those
  instants recur every 40 minutes: 00:22:30, 01:02:30, 01:42:30, 02:22:30 UTC and so on, the same three
  in every two hours. The slice picks the first one after its merge, and a test pins the alignment.
  (Checked with the epoch's own numbers: at 01:02:30 UTC both skies read 02:00.)
- **The relay does not change.** It reads the event clock (gates through `gateLaw.js`, raids, overworld
  rows) and never the sky. `RELAY_VERSION` does not move.
- **The account service changes one read.** The professions' day (`net/nodeLaw.js dayDate`, which
  `server-account` bundles) takes its season and month from the sky, so a herb blooms in the spring the
  player sees (section 5.1). `nodeLaw.js` imports `skyLaw.js`, `account-deploy.yml`'s path list gains it
  (`accountdeploy.test.js` holds the list to the Worker's import graph), and the service redeploys with
  the merge. That Worker holds no sockets, so the deploy drops nobody. A node's season is the sky's at its
  UTC day's first instant and holds all day (nodes are per UTC day by design), so a herb's season can trail
  the sky's by up to a day.
- **Saves do not change.** `classicMinutes` stays the character's clock, and an online save's
  `worldMinutes` stays the event clock's minute it left at. No stamp changes clock (section 5's rule), so
  no envelope needs a migration and the offline copy's rebase (`offlineCopy.js`) is untouched. [TIME1 and TIME2:
  true. TIME3: superseded for quest envelopes - a countdown's stamps moved to the character's clock, an online
  save from before TIME3 is moved once at the load, and the lane doors move a TIME3 envelope's journal dates
  alone (6.3a).]
- **Release-day skew.** A tab open across the deploy draws the old sky until it reloads; the build
  notice (SRV-N, `Server-Update-Notice.md`) already asks it to. Until then two players side by side see
  different times of day, and each one's night spawns, curse and hour windows follow their own tab.
  Nothing the relay keeps is decided on the sky, so nothing it holds can desync. [AUDIT TIME: the ACCOUNT
  SERVICE does decide on the sky - `nodeLaw.js dayDate` gives a herb's, the Basket's and a writ's season and
  month - so it moved to `acct47` with this build, and a client still on the old build disagrees with it from
  the switch on: a herb it stands, the service may grant as another, refuse as another tier, or refuse as out
  of season. The build notice is the cure, as for the sky; an installed desktop build must update.]

## 5. Every reader, by clock

The census (section 8) makes every line choose. This is the map it starts from, read off the tree on
2026-10-01 and checked against a sweep of every world-clock reader in `src/`, `server/src/` and `tools/`.
It lists the kinds of reader, not every line; TIME1 classifies every line.

**No stamp is taken on the sky.** A reading that is saved or sent is an event stamp or an own stamp. A sky
reading is read for "now", or held for the session to notice the sky's day turn (the season's refresh)
and compared only with another sky reading. That keeps every save, every wire frame
and every server check on a clock whose rate never changes, and it is why a sky reader can move without a
migration.

### 5.1 To the sky

| What | Where it reads today |
|---|---|
| The frame's sky: sun, moons, stars, light, colour | `world.js` and `exterior.js` `minuteNow` (`worldMinutes() % 1440`) |
| The drawn sky's hour and moons, through the frame's `classicMinutes` carrier | `shared.js`' sky feed, `render/enhancedSky.js`, `systems/dynamicSkies.js`, `systems/dynamicSkiesRuntime.js`. The same feed's weather ease and cloud drift stay on the event clock (5.5): the feed takes two minutes where it takes one today |
| Interior light and its night ambient | `interior.js`, `worldModes.js` (`isNight(worldMinutes() % 1440)`) |
| The season's ground, the climate season, the herbs' and the writs' season | `world.js` and `exterior.js` (`refreshSeason`, `climateSeasonFromMinutes`, `seasonValue`); `net/nodeLaw.js dayDate` (with the account service, section 4) |
| The air's month and hour for survival, the forager's month, the hunter's winter | `world.js`, `exterior.js`, `dungeonContext.js` (the air); `monthValue` into `foragingInstall.js`; `world.js` (`winter`) |
| The calendar: holidays and Suns Rest, Heart's Day, the kitchen's hours, the temple's cure days, the Witches Festival's spell price, the holiday's words on entering a town, a Daedra prince's summoning day | `worldModes.js` (`getHolidayId`, `worldNow`, `dayOfYearFromMinutes`, the spellbook's `classicMinutes`), `world.js`. The coven's once-a-day re-roll is a stamp and stays on the event clock |
| Opening hours, locks by the hour, who is inside | `worldModes.js` (`_hour`, `resolveBuildingUnlocked`), `characters/interiorPeople.js` |
| The curses' and the careers' sun and moon | the rounds' `skyMinutes` (`worldTick.js`, the four hosts), `world.js`' sun rungs and party-travel refusal, `dungeonContext.js`' sunlight seam |
| Night's spawns, and the overworld's bands at night | `encounters.js`, `campEncounters.js` (`skyMinutes`); `world.js` `bandNight` |
| Enchantments and loot powers that read the season or the moon | `hostEnchant.js`, `lootPowers.js` |
| A torch doused by day on leaving a dungeon | `worldModes.js` (`rrDouseOnDungeonExit`) |
| The date and time the menus show, the rest windows' world time, the sea map's date marks | `ui/enhancedMenu.js`, `ui/restWindow.js`, `ui/enhancedRest.js`, `shared.js` (`sharedMinutes`), `world.js` (the sea map's `date`) |
| The vampire's nightfall words | `worldTick.js worldNightfallText` (reading, rate and inverse) |
| A quest's hour window and date | `quest/actions.js DailyFrom` (TIME3) |

### 5.2 Stays on the event clock

Nothing in this table changes. It is listed so the census has its other half.

| What | Where |
|---|---|
| Gates: the day, the phases, the arena's window, the court's | `net/gateLaw.js`, `server/src/index.js`, `scenes/gateCourt.js` |
| Raids: the day, the window, the map's marks | `net/raidLaw.js`, `server/src/index.js`, `world.js` |
| The overworld's rows and how long they are kept | `net/overworldLaw.js`, `server/src/index.js` |
| Prices: the day's index and its flags | `worldTick.js` (`setWorldPriceSource`, `runDayChange`'s world half) |
| Faction powers and regional conditions | `worldTick.js runCalendarArms`, the world half |
| Stock by the day or the month: guild shelves, potions, houses for sale, shops | `worldModes.js` (`dayShelf`, `stockGuildPotions`, `housesForSale`), `shopStock.js` |
| The weather's rolls and evolution (6.4) | `worldTick.js`, `weatherSim.js` |
| Terms: a banishment, a pardon | `standing.js`, `arrestFlow.js`, the hosts' `worldNow` (`trustedWorldMinutes`) |
| Absence: TM-1's recovery, SURV7's fresh start, the save's `worldMinutes` | `worldTick.js` (`payAbsenceWhenHeard`), `save.js` |
| The world's half of a dead span | `deathRespawn.js` (`skipDeadMinutes`) |
| Camps: a fire's hours and a kit's | `scenes/camps.js` |
| Dropped torches burning | `scenes/droppedTorches.js` |
| A respawn's due time, through the event clock's inverse | `dungeonContext.js` (`_wallNow`) |
| The day a loot find is dated | `lootCodex.js` |
| Bounty boards: the day's postings, a taken bounty's lapse | `systems/bountyBoard.js`, `scenes/bountyHost.js` |
| Rumours' lifetimes | `systems/rumorMill.js`, swept from `regionPower.js` |
| Spawned dungeons' lifetimes, the shared interiors' loot day | `world/spawnedDungeons.js`, `world/interiorShared.js` |
| The gates' income: receipts, spoils, the Sigil Broker's prices, the account service's `gate_kills` | `net/gateLink.js`, `net/gateClaims.js`, `scenes/spoilsPool.js`, `systems/sigilBroker.js`, `server-account` |
| The day's generators, and the music's daily playlist seed | `worldTick.js` (`DAY_SALT`), the hosts' `gameDaysNow` |
| The naval day: notoriety's decay, the port's grog, today's departures, the traffic seed | `world.js` (the naval `where`), `scenes/navalHost.js`, `systems/naval/` |
| The minute a character joins online at | `ui/enhancedMenu.js` (`onlineCopyOf`) |

### 5.3 Your clock

Unchanged: everything `Lived-Time.md` lists under "Reads the character's clock", and the camp encounter
window (`campEncounters.js`: 180 game minutes, which is the "15 real minutes" Mac asked for only because
your clock keeps TimeScale 12). Added by TIME3: a quest's countdowns, its spawn and sound intervals and
its tombstones (6.3). [QCLOCK-WORLD (6.3c): online the countdowns and the spawn interval charge only the time
lived with the world - the event clock's movement while you play - and never a raise.]

### 5.4 Real time

Unchanged: respawns (WORLD8, one real hour), the gate's rise and collapse, the gate boss's own beats, the
Seats' weeks, the Sigil stock's and the Marks' UTC days, the renown cap's real hour, a home's rent, the
bands' and the sea raiders' lives, a held torch's burn.

### 5.5 Every conversion names its rate

A conversion between game minutes and real time is the one place a faster sky can hide, so each one names
its clock:

- **the nightfall words:** the sky's rate; this changes;
- **`ownTimeLeftText`'s "of play":** your clock's rate, TimeScale 12; unchanged;
- **`gateCourt.js COURT_ROUND_MS`:** a magic round, your clock's; unchanged;
- **`overworldLaw.js OW_ROW_KEEP_MIN`:** the event clock's; unchanged;
- **the gate panel's local times** (`sharedWallMs`): the event clock's inverse; unchanged;
- **the drawn weather's step:** the sky feed measures `dt` in game minutes for the weather's ease
  (`WEATHER_EASE_MINUTES`), the cloud drift (`WIND_SECONDS_PER_MINUTE`, written as 60 / 12), the wind
  model's leads, the volumetric clouds' churn and the distant storms' strikes. That `dt` stays the event
  clock's, so every one of those TimeScale 12 constants stays true and a front takes as long as it does
  today. Only the dome's hour and moons take the sky's minute;
- **`walkRaise` and `CLASSIC_MINUTES_PER_SECOND`:** your clock's and the event clock's TimeScale 12;
  unchanged, and never the sky's;
- **a stamp and its reading on one clock:** `dungeonContext.js`' `_wallNow` turns the event clock's minute
  into real ms for a foe's death and a looted chest, and the respawn compares it against real time. Both
  directions stay the event clock's; a sky minute through the event clock's inverse would mis-time every
  respawn.

## 6. The rules that change online

### 6.1 The full moon is a night

Online, the forced change holds while the full moon is UP: from dusk on the full-moon day to the next
dawn, the sky's night that begins on that date. At TimeScale 48 that is 15 real minutes. Masser and
Secunda are full four days apart (`gameDate.js lunarPhase`: offsets +3 and -1 on a 32-day cycle), so a
werewolf meets two such nights two real hours apart, then none for fourteen hours. DFU's rule, the whole
calendar day, stays offline.

- **The law:** `isFullMoonNight(skyMinutes)` (built as `gameDate.js isFullMoonNightFromMinutes`). A night belongs to the date of its dusk: the hours before
  06:00 are the previous date's night. `lycanthropyMagicRound` forces the change when it holds and no
  Hircine ring is worn; offline it keeps `isFullMoonFromMinutes`.
- **At dawn the lock ends.** Changing back is the power, ungated, as DFU has it. The once-a-day gate on
  changing INTO the beast stays on the character's clock, so a rest clears it.
- **The words:** DFU's own line, "You dream of the moon.", as the change takes them, unchanged.
- **Why the night and not a fixed real-time lock:** the moon is in the sky. Look up, see it full, know
  why you are a wolf. A lock that ran out on a timer would end with the moon still up.

### 6.2 The vampire

No rule changes. The sun is the sky's, so the longest wait for dusk becomes 15 real minutes and the hood
(VAMP-HOOD) still opens the map by day. The nightfall words must compute with the sky's rate: they divide
by `ONLINE_MINUTES_PER_MS` today, which stays the event clock's rate, and would say four times too long.

### 6.3 Quests on two clocks (LIVED1 OPEN 1, answered)

- **A quest's countdowns run on the character's clock:** the Clock resource ("you have N days", "come
  back in N days"), the spawn intervals (`CreateFoe`) and the tombstones. A rest or a loiter spends quest
  days as in DFU, and so does a journey. A three-day wait is a 72-hour rest: about half a minute. [SUPERSEDED BY
  6.3c: online a raise spends no quest days.]
- **WORLD7's played step stays as the bound on the lived part of a frame,** so a hidden tab is still
  forgiven; a raise is charged whole.
- **A quest's hour and date reads use the sky:** `DailyFrom`, and any date a script tests. A `daily from`
  window comes round every 30 real minutes instead of every two hours.
- **A party's shared quest.** QUEST1 copies an accepted quest to each member (`systems/questShare.js`), and
  that copy is the "cross-player-visible state" for which `restSession.js` still stands quest ticks down
  under an online rest. Recommended: each copy runs on its holder's clock, so a member's rest spends only
  their own copy's days. LIVED1 recommended the owner's clock instead; that needs the owner's deadline
  carried in the copy. TIME3 settles which before any code (OPEN 3). [Settled and built: the holder's clock, and
  the rest ticks quests online now (6.3a).]
- **GUARD-ONLINE stays as it is.** Its reason, a two-hour wait, shrinks to at most 26 minutes (a three-hour
  window in a 30-minute day), so Mac may retire it later (OPEN 5).

The machine gets two clocks where DFU has one: `nowSeconds` becomes the character's, and a new
`skySeconds` serves `DailyFrom` and the date. Offline both are the one clock.

### 6.3a As built (TIME3)

- **Two charges, one clock.** The character's clock moves two ways online: with the world while they live in it,
  and ahead of it when they raise time. A quest tells the two apart by the session's count of raised minutes
  (`worldTick.js raisedMinutes`, counted where a raise is made: the ticker's advance and `advanceOwnMinutes`;
  the dungeon host's rest and exhaustion collapse raise through `advanceOwnMinutes` too, where they wrote the
  clock's view before). A Clock charges the raised part of its gap whole and the lived part one played step at
  most (`quest/clock.js chargeSeconds`); never more than the clock moved. A clock restored or received samples
  the session's count at the restore (AUDIT TIME): the time behind its sample is a resume, one step at most, and
  a raise after it is charged whole. CreateFoe's interval keeps the
  same law: a rest spends it, a lived time away past one step is forgiven.
- **The rest ticks the quests online** (`restSession.js`), every sub-tick, as offline. RESTX2's stand-down goes.
- **Whole seconds.** DFU samples `WorldTime.Now.ToSeconds()` - whole seconds of a clock that keeps its fraction -
  so a gap loses nothing. The port sampled the fractional reading and cut each GAP to whole seconds: at ten
  quest ticks a real second a countdown ran a fifth to a third slow, offline too. The Clock samples whole seconds
  now (a fidelity fix found on the way, in TIME3's own code).
- **The journal's dates are the event clock's**, read on the sky's calendar. A quest's start and each logged
  step are stamps, and every stamp is the event clock's or the character's (section 5): `%qdt` turns the event
  stamp into the sky's date at that instant (`skyCalendar.js skySecondsOfEvent`), so the journal agrees with the
  calendar the player saw. The countdowns' stamps are the character's.
- **A quest envelope says which clock its countdowns stand on**: `ownSecondsAt`, the holder's clock as it was
  taken (`quest/questStamps.js`). An online save from before TIME3 has none; its countdowns were the world's, and
  the load moves them onto the character's once, by the distance at the save (`questBlockOnOwnClock`). The doors
  between the lanes move a TIME3 envelope's journal dates alone.
- **A party's copies (OPEN 3: the holder's clock).** A copy's countdowns move from the sender's own clock to the
  receiver's when it lands (`questDataOnThisClock`, a share and every resync). LIVE SYNC overwrites a copy with
  its partner's on every change, so a resync keeps this holder's running clocks - their remainder and samples, as
  it keeps each world's foe counts. A clock the partner's copy started, stopped or ran out takes the envelope's
  state, and the task it fired rides the resync: **a clock that runs out on one copy has run out for the party.**
  A member's rest spends their own copy's days until then. A clock THIS copy has run out stays run out, its task
  fired and its edge kept (AUDIT TIME; the edge in the second round, or the next tick re-fired the task and
  restarted its waves), and a wave's interval and count stay this holder's.

### 6.3c Quest timers on the world's clock (QCLOCK-WORLD, 2026-10-02) [SUPERSEDES 6.3b, and 6.3a's raise charged whole] [its DELAYS SUPERSEDED BY 6.3d]

Mac: "Before we merge. I want to go back to the quest timer tied to the online world clock instead of the changes we
just made". Asked which: TIME3's (a rest spends a quest's days) or the shared world clock's, played time only -
"Shared world clock". So TIMEFREE's quest half is reverted whole (deadlines run out again, delays wait their days,
bounties lapse, letters wait for morning, the curse quests and the crime-guild letters keep their waits; WEAR-ONE
stays), and online a quest's countdowns are WORLD7's again:

- **The time lived with the world is charged, one played step at most; a raise is charged nothing**
  (`quest/clock.js chargeSeconds`: the character's clock still, so 6.3a's seams stand - the session's raises,
  `raisedSeconds`, are what the charge takes OUT of the gap now, not what it adds whole). A rest, a loiter, a journey,
  a sentence, training spend no quest days; the hours played do, at the event clock's TimeScale 12 (a quest day is two
  real hours of play). Time logged off is never counted; a hidden tab is still one step.
- **CreateFoe's interval keeps the same law** (`quest/actions.js`): the raise is forgiven whole with the lived part past
  a step.
- **Offline nothing changes**: the one clock's raw gap, DFU's own - a rest spends a quest's days.
- What 6.3a built stays: the hour, date and season on the sky; the journal's dates on the event clock; a party copy on
  its holder's clock (a member's play spends their copy, a rest spends neither); the save's move onto the character's
  clock. QFAIL-FREE (a failed quest online costs its faction nothing) stays.

Pins: `test/time3_quests.test.js` (the Clock, the wave, the party's copies and the rest re-aimed - a rest spends
nothing, the same mechanics driven by lived play), `test/world7.test.js`, `test/world5.test.js`,
`test/auditworld78.test.js` (the charge's source); `ui/enhancedMenu.js` says it at the door. `tools/mutants/time3.json`
re-aimed (61, all dead): TIME3's law back - the raise charged whole - is a mutant now.

### 6.3d Quest waits on the short wait (REST8, 2026-10-03) [SUPERSEDES 6.3c's delays on played time; 6.3b's DELAY HALF RESTORED]

`Rest-Arc.md` section 8, OPEN 12 (Mac's call: option A). QCLOCK-WORLD's audit measured the waits a rest can no longer
skip online (121 of them: median 0.3 h of play, p90 24.3 h, the main quest's letters 20-26 h each), and under REST a
night is a raise, which 6.3c charges nothing. So 6.3b's reading comes back for its delays, and its freeze does not:

- **The reading is 6.3b's, as AUDIT TIMEFREE left it** (`quest/clock.js` `clockIsDeadline`, `isDeadline`, the hand
  tables `ONLINE_DEADLINES` and `ONLINE_CLOSINGS`, the "at once" clocks, the run-time half and `startedAfterSuccess`):
  262 deadlines, 137 delays over the 399 vendored clocks - and REST8 R1's correction: T3 reads `end quest` by what the
  end ALONE sets off, and now the reward that clears it the same way, so K0C00Y02's gold ("you only have =2mondung_
  days") and S0000502's Direnni tower ("will wait inside for =towertime_ days"), which ended unpaid two minutes in
  under 6.3b's reading, are deadlines: 264 and 135, the main quest's deadlines 31, listed and pinned.
- **Online a delay lands on the short wait** (`Clock.waitsShort`): its remainder is cut once to `ONLINE_DELAY_SECONDS`
  (24 minutes of the character's clock) and then charged as 6.3c charges any clock - the lived step, never a raise -
  so it lands after about two real minutes of play, and a night spends none of it. Its `=x_` count reads "a few"; the
  journal walk (`scenes/questBridge.js questLog`) skips it, so no surface counts a letter down.
- **Online a deadline is 6.3c's, untouched**: played world time, DFU's end (armed at nothing, it fires at once, as
  offline - 6.3b's T7 guard went with the freeze); its count, "Time remains", the rail and the herald's urgency stand.
- **The crime-guild letter** is due 24 of the character's minutes after the tally (`crimeGuilds.js`
  `CRIME_GUILD_LETTER_ONLINE_MINUTES`); **the curse quests** roll every 24 of them while their arm has nothing running
  (`racialQuests.js` `ONLINE_RACIAL_INTERVAL_MINUTES`, `racialArmIdle`; `worldTick.js runCalendarArms`), not every 38 and
  84 days.
- **Kept as 6.3c has them:** a taken bounty lapses and shows its time; a letter waits for town and the sky's morning;
  `daily from` windows on the sky; spawn intervals, QAE RaiseTime and TrainPc's hours as pacing.
- **The edge**: a deadline read as a delay fires its end two minutes in, as under 6.3b; a delay read as a deadline only
  waits its played days now (6.3b froze it). The pins guard the first: `test/rest8_questwaits.test.js` (6.3b's file,
  re-aimed - every vendored clock ticked past the short wait online: all 133 delays land, not one of the 266 deadlines (AUDIT REST-PARTY D1/D2: 264 and 135 as REST8 built it)
  is cut) and `test/rest8_audit_timefree.test.js` (AUDIT TIMEFREE's, and R1's). Campaigns `tools/mutants/rest8.json`
  (22) and `tools/mutants/rest8_audit_timefree.json` (14), all dead.
- Offline: none of it. DFU's clock, whole.

### 6.4 Weather keeps its pace

The six zones roll and evolve on the event clock's days and hours, as today: a roll every two real
hours, an evolution check every five real minutes (CLK2's `EVOLVE_CHANCE_PER_HOUR`). The sky's SEASON
chooses the table, handed in, so a winter sky never rolls summer weather. The sky turning four times as
fast does not make it rain four times as often, and a weather front still takes as long to roll in.

### 6.5 Seasons and the calendar run with the sky

A year every 7.5 days: each season about two days, every holiday once a week for half an hour. The
temple's cure days and Heart's Day keep their share of the year, in shorter, more frequent visits. The
year number climbs about 49 a real year. TIME1 reads every date reader its census finds for one that
counts years, before the years run faster.

### 6.3b Quests are not time (TIMEFREE, 2026-10-02) [SUPERSEDES 6.3a's countdowns online] [SUPERSEDED BY 6.3c - REVERTED] [its DELAY HALF RESTORED BY 6.3d - the reading, the short wait, the curse arms and the crime-guild letters; the freeze, the walk's blackout, the any-hour letters and the bounties' never-lapse stay reverted]

Mac: "we recently adjusted quest timing for online and im really getting tired of it ... Is there a way we can overhaul
online quests to not use time and edit anything questwise to make since that depends on time?" Asked what a waiting step
does online: "Short real wait"; asked whether the bounties, the curse quests and the crime-guild letters go too: yes.

- **A clock is a deadline or a delay, and the script says which** (`quest/clock.js` `clockIsDeadline`, read once per
  clock, `isDeadline`): a deadline's end loses the quest (its task, and what it starts or a positive `when` of it sets
  off, ends the quest with no GivePc, TrainPc or StartQuest), costs a standing (a negative `change repute` or
  `legal repute`), or shuts a reward waiting on `not _clock_`. Everything else is a delay. A clock a clock starts is
  asked on its own (Brisienna's invitation is a delay that starts her fortnight, a deadline). AUDIT TIMEFREE
  (`01-Overview/Audit-Timefree.md`) sharpened the reading: a standing lost or a reward shut counts only by what the
  end or the reader itself DOES, not by a chain of later `when`s (T2); `end quest` is a loss only when the end ALONE
  sets it off, by the engine's own reading of the `when` (T3 - the main quest's endings wait on the story); a quest
  item handed over is progress (T4); `Clock _x_ 00:00` with no travel arm is "at once" (T3); and a CLOSING - a clock
  a task starts after settling the quest (the reward paid, the next quest begun, a deadline already lost) - is a delay
  (T1), as is, at run time, a task-started deadline once the quest is a success, unless it was started after the
  success (a new limit - T5). Penalties the reading cannot see are deadlines by hand (`ONLINE_DEADLINES`: the cure
  quests' hunters, U0C00Y00's escape, M0B11Y18's mark leaving, Brisienna's month - T6), and one closing after a
  failure is a delay by hand (`ONLINE_CLOSINGS`: R0C11Y03). Of the 399 vendored clocks, 262 are deadlines and 137
  delays; the main quest's 30 deadlines are listed and pinned (`test/timefree.test.js`, `test/audit_timefree.test.js` - DELETED by 6.3c).
- **Online a deadline never runs out**: charged nothing, its sample still moving, so a quest taken offline resumes it
  where it stood. QFAIL-FREE stays as the net under anything else that ends a quest unfinished.
- **Online a delay lands on the short wait**: its remainder is cut once to `ONLINE_DELAY_SECONDS` (24 minutes of the
  character's clock, about two real minutes of play at 12:1) and charged as any clock (WORLD7's played step, raised
  time whole).
- **The words**: a clock's `=x_` day count reads "a few" online ("within a few days"); the journal walk
  (`scenes/questBridge.js questLog`) reads no clock online, so no surface shows "Time remains" or herald's urgency;
  the Online pane says so.
- **The rest**: a quest letter waits for town but not the sky's morning (GivePc); a taken bounty never lapses and
  shows no time left (`scenes/bountyHost.js`); the curse quests roll every 24 of the character's minutes while their
  arm has nothing running (`racialQuests.js racialArmIdle`, `worldTick.js`), not every 38 and 84 days; a crime guild's
  letter is due 24 minutes after the tally, not three days (`crimeGuilds.js`).
- **Left on the sky, said so**: `daily from` windows. They are schedules, not waits - A0C00Y12, N0C00Y10 and L0B50Y11
  split the day between a house, an inn and a store; CUSTOM01 and M0B30Y08 read `not` a window - so forcing them open
  would break those quests. They come round every real hour (SKY-SLOW); N0B10Y03 keeps GUARD-ONLINE's arrival window.
  Spawn intervals (`create foe every N minutes`), QAE RaiseTime and TrainPc's three hours are pacing, kept.
- Offline: none of it. DFU's clock, whole.

## 7. On screen

- **The date and time the menus show, and the rest window's "World time":** the sky.
- **The Online pane's rules,** said at the door: "A day in the world is half an hour: midnight on the
  hour and the half hour, dusk at :22 and :52. Your own time runs as Daggerfall's does - resting and
  travel spend it, being away does not." [TIME4, as built: `ui/enhancedMenu.js skyDayWords` says the first
  sentence as it is true when the pane opens - before the switch, "a day in the world is two hours of real time
  until" the switch in the player's own time - and the sentences after it add that a full moon holds a
  lycanthrope for its night alone and that quest timers run on the character's own time, so a rest spends a
  quest's days as in Daggerfall. QCLOCK-WORLD (6.3c): that quest timers run on the world's clock while you
  play, and resting, waiting and travelling don't spend a quest's days.]
- **The vampire's nightfall words:** the sky's rate (6.2).
- **A character's deadlines** ("7 days of your time (14h of play)"): unchanged. They are on the
  character's clock, whose rate does not change.
- **The gates' and raids' words: real local times only.** The gate's chat lines say the event clock's game
  time beside the local one ("opens there at 20:00 (14:32 your time)", `gateLaw.js omenLine`), and a raid's
  map tip says "Withdraws at" a game time (`ui/eventMapMarks.js`). Once the sky turns on its own, those game
  times contradict the clock the player sees, so they go in TIME1, not later. `gateLaw.js` is in the relay's
  bundle, so the client stops calling its word functions and says the lines from a client-side module;
  the old functions retire with the next relay deploy that happens anyway. `World-Bosses.md`'s game-time
  column retires with them. The gate panel already shows real local times.
- **The patch notes,** in the pull request's description: "A day online is now 30 minutes. Nights, full
  moons and quest hours come round four times as often." [TIME4, as built; since REL6 the notes live in the pull request's
  description, never as a file in the tree.]

## 8. The law in code

- **`net/skyLaw.js`** (new leaf): the sky's law (section 4).
- **`net/wire.js`:** untouched. `sharedClassicMinutes`, `wallMsForClassicMinutes` and
  `ONLINE_MINUTES_PER_MS` keep their names and meaning, the event clock's; the comments that say so are
  written in `skyLaw.js` and the bible, not in `wire.js`, whose bytes are the relay's.
- **`net/nodeLaw.js`:** `dayDate` reads the sky (section 5.1); the account service redeploys with it.
- **`systems/skyCalendar.js`** (new leaf, TIME1): an event minute's sky - the weather's season and hour; TIME3's
  `skySecondsOfEvent` the journal's dates.
- **`systems/quest/questStamps.js`** (new, TIME3): the stamps by clock, the walk that moves them, the load's and
  a share's moves (6.3a).
- **`ui/enhancedMenu.js skyDayWords`** (TIME4): the Online pane's sentence, true when it opens - before the switch
  it says when the sky turns.
- **`systems/worldTick.js`:**
  - `setSharedClock(source, wallOf, { sky, skyWall })`: the event clock's source as today, the sky's beside
    it.
  - `skyMinutes()`: the sky online, the one clock offline. `worldMinutes()`, `ownMinutes()` and
    `trustedWorldMinutes()` keep today's meaning.
  - The tick: unchanged windows. `runMagicRoundsFor`'s `skyMinutes` is the sky's reading.
  - `worldNightfallText`: the sky's reading, rate and inverse.
  - The weather's roll and evolution: the sky's season handed in (6.4).
- **`systems/lycanthropy.js`:** `isFullMoonNightFromMinutes` online (6.1), through `moonNight`.
- **`systems/quest/`:** the machine's two clocks (6.3) - built as four seams (6.3a).
- **The install,** `scenes/world.js` (today's line 786):
  `setSharedClock(() => sharedClassicMinutes(Date.now() + _sharedOffsetMs), (m) => wallMsForClassicMinutes(m) - _sharedOffsetMs, { sky: () => skyClassicMinutes(Date.now() + _sharedOffsetMs), skyWall: (m) => wallMsForSkyMinutes(m) - _sharedOffsetMs })`.
- **THE FOUR HOSTS RULE:** `world.js`, `exterior.js`, `worldModes.js` and `dungeonContext.js` each move
  their sky reads (section 5) and leave their event reads; every slice names all four.
- **The census:** `time1_census.test.js` (new), over a table of reader sites (file, a snippet that names
  the site once, its clock). The test finds every line in `src/` that calls `worldMinutes()`,
  `skyMinutes()`, `trustedWorldMinutes()`, `sharedClassicMinutes(` or `wallMsForClassicMinutes(`, or reads
  a ticker's or a context's `classicMinutes` getter (`shared.js`, `dungeonContext.js`: the sky feed, the
  spawned dungeons' clocks and the weather's application read the event clock that way). It fails on a
  line the table does not name and on a row whose snippet is gone, so a new reader has to say which clock
  it means. A table and not a note on each line: the mutant campaigns pin these lines' text
  (`tools/mutants/`, LIVED1's and its audits' above all), and an event reader that does not move should
  not change a byte.
- **The relay:** nothing, and a test that its import graph never reaches `skyLaw.js`.

## 9. Slices

1. **TIME1 - the sky.** The law and its install, `skyMinutes()`, the census, every sky reader moved
   (section 5), the sky feed's two minutes, the weather's season, the nightfall words, and the gates' and
   raids' words in real local times. It ships alone: the sky turns, and every wait on it shrinks fourfold.
2. **TIME2 - the full moon's night** (6.1).
3. **TIME3 - quests on two clocks** (6.3). Supersedes WORLD7's world-clock charge.
4. **TIME4 - the words** (section 7) and the bible: `Lived-Time.md`, `Online-Arc.md` WORLD5,
   `World-Bosses.md`, `Clock-Arc.md`.
5. **AUDIT TIME** over the arc, the house's four lenses.

Each slice is pinned red first, with its own mutant campaign (`tools/mutants/time<n>.json`; TIME4, words alone,
is held by `test/time4_words.test.js` instead; AUDIT TIME's one TIME4 mutant, the pane's minutes, rides
`time1.json`), a Testing.md
row, and its player-facing notes in its pull request's description. TIME2 and TIME3 are independent of
each other once TIME1 has landed.

**TIME1's tests, at least:**

- the law: the sky equals the event clock up to the cutover, is continuous across it, runs at the new rate
  after it, and its inverse round-trips;
- the alignment: after the cutover every sky midnight falls at :00 or :30 UTC;
- offline: `skyMinutes() === worldMinutes() === ownMinutes()`, one clock, every existing offline test
  standing;
- the census;
- the bundles: the relay's import graph never reaches `skyLaw.js`, and the account service's deploy
  list names it;
- a sky read and an event read in each of the four hosts, crossing a sky midnight that is not an event
  midnight: the season, the hour and the moon move, and the prices, the shelves and the weather do not.
  [As built: the four hosts are scenes no test runs headless, so they are held by source - `time1_sky`'s
  four-hosts test names each host's sky reads - and by the census, which fixes every reader line in `src/` to
  its clock both ways. The laws those lines call are executed: the season and the hour (`weatherSim`,
  `weatherMap`, the dome's two minutes), the moon through the tick, the professions' day, the shelves' and
  the prices' event clock (the census's named readers).]

## 10. Alternatives weighed

- **Speed up the one shared clock** (sky, events and characters together). The character's clock runs
  with it (`tickPlayerMinutes`), so every spell, poison and hunger tick quarters in real time. A gate would
  open every 30 minutes for 2.5; a raid would last 2.5 minutes against a target of 15 to 25 kills, with
  raiders arriving one every 1 to 10 real seconds; a taken bounty would lapse in 30 minutes; a banishment would lift in
  15 hours; shelves would restock every half hour. Changed in place on 2026-10-01, the calendar would
  jump about 612 days and every stored world stamp would expire at once. The relay would change too.
  Rejected: it changes everything to fix the sky.
- **A sky per player** (each character's own time of day, as offline). Two players side by side would
  stand in day and night at once; shared weather, light and a party's night spawns stop agreeing.
  Rejected.
- **Skip the night by vote** (Minecraft's beds). It needs a quorum in a world with no edges, and turns a
  pure function of wall time into relay state. Rejected.
- **Patch each wait** (the moon next, then the one after). What the tree has done since WORLD5. Rejected
  by Mac.

## OPEN - Mac's calls

**DECIDED 2026-10-01** (Mac: *"Let's do it"*): the recommendation in each, as built. 5 stays open by its own
terms; 9 is new and not built.

1. **The rate.** [SKY-SLOW, 2026-10-02: changed to TimeScale 24, a day every real hour - see section 3.] Recommended: TimeScale 48, a day every 30 minutes with midnight on the hour and the half
   hour. The alternatives are in section 3.
2. **The full moon.** Recommended: the night, 15 minutes. The alternative is DFU's whole day on the
   faster sky, 30 minutes.
3. **Quest countdowns on the character's clock.** Recommended: yes (LIVED1 OPEN 1), with a party's
   shared copy on its holder's clock. The alternative is one deadline for the party, on the owner's.
4. **The weather's pace.** Recommended: today's, on the event clock. The alternative, weather on the sky,
   changes four times as often.
5. **GUARD-ONLINE.** Recommended: keep it until play shows the 30-minute window is enough, then retire it.
6. **Gates.** Recommended: unchanged, every two real hours with the same real phases. The omen and the
   opening no longer promise a dusk. The alternative re-cuts them onto the sky: one gate every fourth
   night, open for that whole 15-minute night.
7. **The year.** It climbs about 49 a real year. Recommended: let it.
8. **Respawns.** Unchanged: one real hour (WORLD8, `wire.js RESPAWN_MS`). They run on real time, not the
   sky, so this design does not move them; a shorter respawn is its own call.
9. **Time zones** (Mac, 2026-10-01: *"What if we went further and split the sections of daggerfall into time
   zones?"*). NOT BUILT. The sky is one hour everywhere today. Zones fit on top of it: an offset on the sky's
   hour by a place's east-west position, smooth rather than banded, so walking or fast travel never jumps the
   clock at a border. Answered then: finish the faster sky first, try zones as their own slice.

## Record

- 2026-10-01: proposed, this page. Nothing built.
- 2026-10-01: checked against a sweep of every world-clock reader. Added to section 5: the sky feed's two
  minutes, the survival air, the forager and the hunter, the Witches Festival, the bounty boards, the
  rumours, the spawned dungeons, the gates' income, the naval day's laws; the camp window corrected to the
  character's clock. Added to section 7 and TIME1: the gates' and raids' words. The census became a table.
  No reader found saves a sky minute.
- 2026-10-01: BUILT. TIME1: the sky's law (`net/skyLaw.js`), its install and `skyMinutes()`, every sky reader
  moved and every event reader held by the census (`test/time1_census.test.js` over
  `test/fixtures/time1_census.json`), the weather's season, the nightfall words, the gates' and raids' local
  times, `tools/skyCutover.mjs`. TIME2: the full moon's night online. TIME3: quests on the character's clock and
  the sky (6.3a). TIME4: the Online pane's sentence, this page, `Lived-Time.md`, `Online-Arc.md`, `Quest-Arc.md`,
  `World-Bosses.md`, `Clock-Arc.md`, the Port Ledger's departures, the patch notes. The mutant campaigns are `tools/mutants/time1.json`-`time3.json`, all dead.
- 2026-10-02: TIMEFREE (6.3b) - online quests are not time: deadlines never run out, delays land on the short wait,
  no countdowns, bounties never lapse, the curse quests and crime-guild letters on the short wait.
  `test/timefree.test.js`, `tools/mutants/timefree.json` (10, all dead). [DELETED by 6.3c]
- 2026-10-02: AUDIT TIMEFREE (`01-Overview/Audit-Timefree.md`): every vendored clock read by hand, the main quest's
  whole; nineteen misread clocks corrected (T1-T6) - among them Brisienna's close, the main quest's endings and
  letter43, quests that never closed after their reward. `test/audit_timefree.test.js`, [DELETED by 6.3c]
  `tools/mutants/audit_timefree.json` (14, all dead). [DELETED by 6.3c]
- 2026-10-02: AUDIT TIMEFREE II: the real machine ticked online and offline (Brisienna, K'avar's letter, a deadline
  across the switch); main merged in; the patch notes' words corrected.
- 2026-10-02: QCLOCK-WORLD (6.3c): TIMEFREE's quest half reverted before the merge, and online a quest's countdowns
  charge the time played with the world's clock and never a raise - a rest, a wait or a journey spends no quest days.
  `test/time3_quests.test.js` re-aimed, `tools/mutants/time3.json` (61, all dead); its patch notes ride the Rest arc's
  pull request (REL6), "Patch notes: Quest timers on the world's clock".
- 2026-10-02: AUDIT TIME, four lenses (the sky and the moon; the quests; the hosts, saves and wire; the words and
  the tests). Fixed: the coven's daily re-roll was stamped and saved on the sky - its key is the event clock's day
  now, the prince's day the sky's (`daedraSummoning.js rerollDay`); `tools/skyCutover.mjs` could not move the
  switch once its instant had passed - at the last row's own rate it lays the instants on the sky without that
  row; the roaming bands read their life's night at its middle (one in five of a life out of step with the sky,
  the least a twelve-minute life allows; it was two in five); a raise after a restore or a share and before the
  first tick was forgiven - the count is sampled at the restore; a resync from a partner behind un-finished a
  clock this copy had run out, and restarted this holder's wave interval - both are this copy's now; the account
  service moved to `acct47` (it reads the sky's season through `nodeLaw.js`); the Online pane says this
  machine's own minutes (dusk at :22:30, or :37:30 where a clock is a quarter off); GUARD-ONLINE's watch pinned
  to the character's clock; stale words in this page, `Lived-Time.md` and three comments. Each fix has a pin and
  a mutant.
- 2026-10-02: AUDIT TIME, second round (the fixes themselves; offline fidelity, base tree against this one; the
  party end to end; the words and the tests). Fixed: a resync that kept a clock this copy had run out set its
  task fired but took the envelope's EDGE, so the next tick re-fired the task and restarted its waves - the edge
  and the wave's count are this holder's too; `tools/skyCutover.mjs` at another rate laid a new row after a row not
  yet live - it lists instants to REPLACE that row, and says when the sky it lays on already runs at the rate; the
  standalone host's camp roll read the sky's minute offline, the end of a catch-up span for every minute walked
  (a raise across 18:00 rolled the night table) - online only now, as the lone roll beside it; stale words in this
  page (6.3a's restore and resync, the pane), `Quest-Arc.md`, `Travel-View.md`, `Raiding-Parties.md`, the Port
  Ledger (LIVED1's row, ONLINE's, TIME's), Testing.md, two test titles held to their bodies (the tool's "already
  runs", the moon's alternating gaps) and five comments. The party lens found no disagreement between two players
  on this build; the mixed-build skew after the switch is section 4's. Each code fix has a pin and a mutant.
- 2026-10-02: SKY-SLOW. The 48 sky zoomed by; the not-yet-live row was replaced with TimeScale 24 (a day every real
  hour, midnight on the hour UTC) at the aligned instant 2026-10-03T17:07:30Z. The Online pane's sentence, the patch
  notes and the pins (`test/time1_sky.test.js`, `test/time2_moon.test.js`, `test/time4_words.test.js`) moved with it.
- 2026-10-03: REST8 (6.3d, `Rest-Arc.md` section 8, OPEN 12 option A): 6.3b's delay half restored on 6.3c's clock -
  the reading and its two tables whole, a delay cut once to the short wait, a deadline on played time; the crime-guild
  letters and the curse arms on the short wait; R1: K0C00Y02's gold and S0000502's tower read as the deadlines they
  are. `test/rest8_questwaits.test.js`, `test/rest8_audit_timefree.test.js`, `tools/mutants/rest8.json` (22) and
  `tools/mutants/rest8_audit_timefree.json` (14), all dead.
