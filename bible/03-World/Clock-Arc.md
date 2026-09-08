# The Clock - the arc (CLK, opened 2026-09-08)

**Mac (2026-09-08, after the volumetric clouds shipped): "this works
really well, but I think we need to change our weather/day and night
system to be in sync with the world clock to enhance everything."**
Asked which way: the presentation on the clock AND the weather evolving
within the day on the enhanced lane; during a rest the sky animates at
the clock's rate - a time-lapse, not a freeze-and-jump.

## What the tree had when the arc opened

Mapped before a line was written (an Opus explorer, cites in the
record). ON GAME MINUTES already: the world clock itself
(`worldTick.js` - real dt x `CLASSIC_MINUTES_PER_SECOND`, jumps at
rest/loiter/travel/jail/training/load with no real seconds), the sun's
direction, the light rig's curve, the ambient, the moons' phases, the
stars' wheel, the classic panorama's frame, the weather SIM (the six-
zone roll on the day change, the drain on the first exterior frame, the
respawn re-roll - DFU's own machine, its hourly poll shipped commented
out), the wind model's calm and front (`wind.js`, WIND1), the
precipitation front's arrival. ON THE WALL'S SECONDS: the sky
controller's own `performance.now()` difference (`shared.js use()`),
and on it the weather EASE (14 s), the front's stretch of the ease
(with the time scale HARD-CODED at 12 in the divisor), the cloud DRIFT
integral (a game-minute wind vector times a real-second dt, never reset
by a jump), the cloud PROFILE's ease, the lightning schedule, the
gusts, the mill rotors, the grass sway, the precipitation's smoothing
and wander, the Dynamic Skies mod's fog timer. The consequence Mac
saw: an eight-hour rest sweeps the sun across the sky in six real
seconds while the clouds stand still and a weather change still takes
fourteen real seconds; a pause stops the clock but not the sky's ease;
a jail term or a fast travel to the same weather moves the clock by
days and tells the sky nothing. No hour event exists in the port
(DFU's `WorldTime.OnNewHour` has no equivalent; the day is a poll in
the tick).

## The plan

| Slice | What | State |
|---|---|---|
| **CLK1** | THE ONE CLOCK. The sky's presentation walks on GAME MINUTES: the controller differences the host's `classicMinutes` (the same number the sun and the wind model read) and never the wall; a clock gone backwards (a load to an earlier save) costs no minutes, the jump stamp taking the row whole as before. `WEATHER_EASE_MINUTES` = 2.8 replaces the fourteen seconds (fourteen real seconds at the default TimeScale 12 - the look ES1c shipped, at the default scale); the front's stretch is the ease's span over the lead's length, minutes over minutes, no time scale between them; the drift integrates the row's wind through ONE constant, `WIND_SECONDS_PER_MINUTE` = 5, so every deck (the dome's, the clouds', the ground's shadows, the grass, the rain, the mills) keeps the speed it was tuned at and follows the clock; the cloud profile eases on the same minutes. The clouds' two unbounded integrals - the drift and the recenter shift - are WRAPPED to the field's common period (240 pixels: the four noise periods all divide it) at upload, since a year of game time is tens of thousands of kilometres of wind and the shader takes float32. The sky lab keeps the same shape (a game-minute clock, its own integral, `?still` stopping both). LEFT ON THE WALL, by decision: the lightning schedule (DFU's own real-second law, 1:1, and a flash is an instant - a time-lapse of a storm flashes at the film's rate), the gusts, the mill rotors, the grass sway and the precipitation (physical motions with no motion blur to draw; at 665x they would strobe), the Dynamic Skies mod's frame (1:1 on Time.deltaTime). | SHIPPED 2026-09-08 |
| **CLK2** | THE WEATHER EVOLVES WITHIN THE DAY (enhanced lane). DFU rolls the six climate zones once per game day and shipped its hourly poll commented out (Port-Ledger W1 row); the classic lane keeps that verbatim. The enhanced lane adds an HOURLY evolution: on each game-hour boundary, wherever the player is (the tick's own place, beside the day roll), each zone is re-rolled from the same WeatherTable for the climate and season with a per-hour chance, by a SEEDED generator keyed on the day, the hour and the zone (never the classic lane's random sequence; replayable), and a changed slot raises DFU's own drain flag so the change lands through the existing machine - a front when the player stands under it, a jump when it happened out of sight (the stale-drain law). Behind Enhanced Environments; `?evolve=off` the kill switch. A Ledger row: it is a departure. The chance is 12% per zone per hour (a zone's sky turns every eight hours or so on top of the day's roll); a jump walks at most its last 24 hours (the earlier ones were the day roll's); a load re-anchors; the stale stamp is the change's OWN hour, not the tick that found it - so a rest's ten-minute sub-tick lands a front and a day inside lands a jump. Two behavioural pins: a walked day evolves a few times and never on the classic lane, replayable whichever way the clock is stepped; live/stale/jump-of-days/load each land as the law says. | SHIPPED 2026-09-08 |
| **CLK3** | DAY AND NIGHT ON THE CLOCK - the remaining steps. The moon's phase is a day-granularity step (DFU's `GetLunarPhase`); the enhanced dome interpolates it within the day so the lit fraction and the moon's place move continuously (the classic lane's flats keep DFU's step). The dome's sun elevation and the rig's `daylightScale` are checked against each other at twilight and pinned to one curve where they disagree. | |
| **CLK4** | THE CLOSE. The adversarial review; the pins; the Ledger row; Testing.md; this page closed. | |

## Design decisions, and why

1. **The clock is `classicMinutes`, and nothing else.** AUDIT 21 F2's
   rule - exactly one module accumulates minutes - is the port's law
   already; the presentation had quietly kept a second clock. It reads
   the host's carrier now, so a pause, a rest, a travel and a
   `?timescale` all reach the sky by construction.
2. **The row's units do not change.** The wind vectors were tuned per
   real second at the default scale (WIND1's slider calibration); one
   constant converts, so nothing downstream is retuned and the default
   scale looks exactly as it did.
3. **A rest is a time-lapse.** Mac's choice. The sub-tick (ten game
   minutes per 0.075 real seconds) is an ordinary clock delta to the
   presentation: the sun sweeps, the clouds stream, a front builds and
   passes.
4. **Some things stay on the wall.** A flash is an instant; a mill and
   a blade of grass move at their physical rate; rain falls at its
   speed. Drawn at 665x without motion blur they strobe, and DFU's
   lightning schedule is real-second law. Recorded here so the next
   audit does not "fix" them.
5. **The wrap is the shader's, not the state's.** The integrals stay
   raw (a test can read them); the modulo is taken where float32
   begins.
6. **The weather evolution is an enhanced-lane departure**, rowed, with
   its own generator: DFU's random sequence is the classic lane's to
   consume (ECV1's rule).
