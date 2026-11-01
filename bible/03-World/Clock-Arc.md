# The Clock

The sky, the weather and day and night all run on the world clock. The player sees it most when resting: on the
enhanced skin a rest is a time-lapse, the sun sweeping, clouds streaming and fronts passing under a veil, not a freeze
and a jump.

## How it works

- **One clock.** The sky's presentation walks on game minutes: the controller differences the host's `classicMinutes`
  (`src/scenes/shared.js`), the same number the sun and the wind model read. A clock that goes backwards (a load of an
  earlier save) costs no minutes. Online the carrier is two minutes: the event clock walks the clouds, wind and weather
  ease, and the sky's own clock dates the moons and the season (`06-Systems/Online-Time-Arc.md`).
- **Ease and drift.** A weather change eases over `WEATHER_EASE_MINUTES` (2.8 game minutes,
  `src/render/enhancedSky.js`). The cloud drift integrates the row's wind through one constant,
  `WIND_SECONDS_PER_MINUTE` (5), so every deck keeps the speed it was tuned at. The clouds' drift and recenter shift
  are wrapped to the field's common period at upload, where float32 begins; the state keeps them raw.
- **Weather within the day** (enhanced lane). On each game-hour boundary each climate zone is re-rolled from the same
  weather table with `EVOLVE_CHANCE_PER_HOUR` (12%) by a generator seeded on the day, hour and zone
  (`src/systems/weather/weatherSim.js`). A changed slot raises DFU's drain flag: a front when the player stands under
  it, a jump when it happened out of sight. The stale clock is the player's own zone's. `?evolve=off` is the kill
  switch.
- **The moon.** `src/systems/gameDate.js` `lunarPhaseFraction` adds the minute of the day to DFU's 32-day ratio, so the
  enhanced dome's moon moves continuously. Every system (the lycanthrope's full moon, enchantments, Dynamic Skies' own
  moons) keeps DFU's day step. The world's moonlight ramps on the light rig's daylight curve.
- **The rest window.** On the enhanced skin every page of the rest window draws over a veil (`src/ui/restWindow.js`,
  `REST_VEIL`), so the world shows behind it. The classic skin keeps DFU's opaque black.

## Rules

- The weather and day and night are in sync with the world clock (Mac). A rest is a time-lapse, not a freeze and jump
  (Mac).
- The clock is `classicMinutes` and nothing else: exactly one module accumulates minutes.
- The row's wind units do not change; one constant converts.
- Some things stay on real seconds by decision: the lightning schedule (DFU's real-second law, and a flash is an
  instant), the gusts, the mill rotors, the grass sway, the precipitation and Dynamic Skies' frame. At time-lapse
  speeds they would strobe.
- The hourly weather evolution is an enhanced-lane departure with its own generator. The classic lane keeps DFU's
  random sequence and its once-a-day roll.
- Tamriel: the evolution rolls each climate zone, so it runs wherever the player stands.

## Daggerfall Unity

DFU rolls the six climate zones once a game day, with its hourly poll commented out; the classic lane keeps that.
`GetLunarPhase` steps the moon by day. `DaggerfallRestWindow` sets an opaque black background, kept on the classic
skin. Departures: the hourly evolution, the continuous moon on the dome, and the veil.

## Code and tests

- `src/scenes/shared.js` - the sky controller on the game clock
- `src/render/enhancedSky.js` - `WEATHER_EASE_MINUTES`, `WIND_SECONDS_PER_MINUTE`
- `src/systems/weather/weatherSim.js` - the hourly evolution
- `src/systems/gameDate.js` - `lunarPhaseFraction`
- `src/ui/restWindow.js` - the veil
- `test/render/clockArc.test.js` - the clock, the evolution, the moon and the veil on every rest page
- `test/scenes/restlodging.test.js` - the rest window's native pages
- `tools/mutants/restveil.json` - the veil's mutants

## Open

- Not looked at in a real browser: the rest time-lapse, the veil, an hourly front, the moon's walk.
- Under a rest the sky map's eight stripes can disagree by up to ten minutes of wind, and after a load or travel the
  map carries the old sky for eight frames.
- The 12% hourly chance is a judgement for Mac to tune.
