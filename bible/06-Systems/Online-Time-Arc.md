# Online Time

Online, time runs on three clocks. The sky turns a day every real hour, so nights, dawns and full moons come round
often; the event clock keeps Daggerfall's pace for everything the world schedules for everyone; and each character
keeps their own clock, which rest and travel spend (`bible/06-Systems/Lived-Time.md`). Players meet it as the time and
date the menus show, the light, the moons, a werewolf's night, and the Online pane's sentence about how long a day is.
Offline there is one clock, DFU's `TimeScale` 12.

## How it works

### The three clocks

| Clock | Rate online | Moved by | Read by |
|---|---|---|---|
| The sky | `TimeScale` 24: a day each real hour | nobody; a function of wall time | the hour, the date, the moons, light, the season, holidays, opening hours, night spawns, a quest's hour window, the date the menus show |
| The event clock | `TimeScale` 12: a day each two real hours | nobody; a function of wall time | what the world schedules, stocks, prices and meters for everyone: gates, raids, prices, shelves, faction powers, daily caps, weather rolls, time away |
| Your clock | `TimeScale` 12 while you play | rest, loitering, travel, a sentence | your body, magic, needs, contracts and standing |

Which clock a law reads: what the world looks like is the sky's; what the world schedules for everyone is the event
clock's; what happens to you is yours. Nothing walks the sky: it holds no state and is only read, so its rate is a dial
that moves nothing else.

- **The sky**: `src/net/skyLaw.js` `skyClassicMinutes`, from `SKY_SEGMENTS`. Each segment starts at an aligned
  instant, so a change of rate never jumps the hour; at 24 midnight falls on the hour UTC. `tools/skyCutover.mjs` lists
  the aligned instants. The file stays outside the relay's bundle.
- **The event clock**: `src/net/wire.js` `sharedClassicMinutes`, the relay's clock.
- **Your clock**: `src/systems/worldTick.js` `ownMinutes`.

`setSharedClock` in `worldTick.js` installs the event and sky sources; `skyMinutes()` answers the sky online and the
one clock offline, `worldMinutes()` the event clock. `src/systems/skyCalendar.js` gives an event minute's sky season
and hour.

### What changes online

- **The full moon is a night.** A lycanthrope's forced change holds from dusk on the full-moon day to the next dawn
  (`src/systems/gameDate.js` `isFullMoonNightFromMinutes`, read by `src/systems/lycanthropy.js`). Changing back at
  dawn is the power, ungated. Offline DFU's whole calendar day stands.
- **The vampire**: no rule changes; the sun is the sky's. The nightfall words use the sky's rate
  (`worldNightfallText`).
- **Weather keeps its pace**: zones roll and evolve on the event clock; the sky's season picks the table.
- **Seasons and the calendar** run with the sky.
- **Quest timers** run on the world's clock while you play; resting and travel do not spend a quest's days. Delays
  wait on the short wait (`bible/06-Systems/Online-Waits.md`, `bible/06-Systems/Rest-Arc.md`).
  `src/systems/quest/clock.js` `clockIsDeadline` reads which clocks are deadlines; `src/systems/quest/questStamps.js`
  stamps them by clock.
- **Gates and raids** stay on the event clock; their words give real local times only.

### On screen

The menus and the rest window's world time show the sky. The Online pane says how long a day is, true when it opens
(`src/ui/enhanced/enhancedMenu.js` `skyDayWords`).

## Rules

- A day online is a real hour (Mac).
- The full moon holds a lycanthrope for its night, not a day (Mac).
- Your clock and the event clock keep `TimeScale` 12, so spells, needs, travel and the economy keep DFU's pace (Mac).
- Weather stays on the event clock (Mac).
- Quest timers run on the shared world clock while you play (Mac).
- The year climbs as the sky runs; let it (Mac).
- Respawns run on real time and are not moved by the sky (`src/systems/dungeon/dungeonRespawn.js`).
- `src/net/wire.js` is the relay's: the sky never goes in it.

## Daggerfall Unity

DFU has one clock at `TimeScale` 12 (`DaggerfallDateTime`, `WorldTime`). Offline is unchanged. Online splits it in
three and runs the sky at 24.

## Code and tests

- `src/net/skyLaw.js` - the sky
- `src/net/wire.js` `sharedClassicMinutes` - the event clock
- `src/systems/worldTick.js` - `setSharedClock`, `skyMinutes`, `worldMinutes`, `ownMinutes`
- `src/systems/skyCalendar.js` - an event minute's sky
- `src/systems/gameDate.js`, `src/systems/lycanthropy.js` - the full-moon night
- `src/systems/quest/clock.js`, `src/systems/quest/questStamps.js` - quest clocks online
- `test/systems/time1_sky.test.js` - the sky's segments, aligned switches, kept out of the relay
- `test/systems/time2_moon.test.js` - the full-moon night
- `test/scenes/time1_census.test.js` - every reader on its clock (`test/fixtures/time1_census.json`)

## Open

- Time zones (an hour offset by east-west position) are not built (Mac's idea, left for its own slice).
- GUARD-ONLINE, a guarded quest's window from the player's arrival, stays until play shows it can go.
