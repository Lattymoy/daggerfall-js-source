# AUDIT 57 - THE FRONT REACHES THE GROUND, AUDITED (2026-09-03)

Mac: "do a comprehensive audit on this" - WX2, the slice that carries
rain and snow onto WIND1's front and rolls their strength. Shipped an
hour before, seen by no one, and touching four systems at once: the
weather sim, the wind model, the sky controller and both exterior hosts.

## Five findings, all mine, all fixed here (WX2a)

**F1 - the storm flashed under a clear sky.** The `LightningPlayer` is
built in `applyWeather`, on the frame of the sim's cut. Before WX2 that
was also the frame the rain began, so the flash and the drops arrived
together. WX2 moved the drops to the front's last stretch and left the
player where it was: for the whole three-hour lead the strobe lit a sky
that was still mostly clear, and after the storm's cut to sunny it went
on flashing while the last drops drained. The thunder ONE-SHOTS never
had this fault - they ride the ambience preset, which WX2 had already
pointed at the shown mode. The flash follows the same word now: under
the enhanced front it is withheld until `fx.shown === 'storm'`. The
player itself still ticks every frame on both skins (AUDIT 39 #14's
law: it is the clip schedule), and `?flashtest` still pins it on.

**F2 - no kill switch.** EE4 has `?ground=drawn`, EE7 `?grass=off`,
ES1 `?sky=classic`; WX2 had nothing, so a gate or a shot that wanted
WX1's whole volume under the enhanced sky had no way to ask. `?front=off`
returns the row's numbers whole and DFU's cap on the cut.

**F3 - the player arriving is not the weather arriving.** The big one,
and older than WX2: WIND1 builds a front at EVERY change of the sim's
word, and the word changes on paths that are not weather moving in but
the player moving: `restoreWeather` on a load, `applyClimateWeather` on
a fast-travel landing (OnInitWorld's apply), `weatherRespawn` on a
teleport to a new climate base, and `tickWeather`'s drain landing a
day's roll on the first frame back out of a dungeon - a roll that
happened hours ago, out of sight. With WIND1 alone the cost was a sky
that took fifteen real minutes to become the one the save held. WX2
made it visible: a rainy save loaded DRY, and stayed dry for a quarter
of an hour while the front built toward weather that was already
there. The fix is at the root, in the sim, which is the one place that
knows how a word changed: a jump stamp (`weatherJumpStamp`) that a load
always bumps, and a landing, a respawn roll and a STALE drain (more
than `STALE_DRAIN_MINUTES` after its roll) bump when they change the
word; a LIVE drain - the day turning while the player stands under the
sky - never does, and is still the front WIND1 meant. Both hosts read
the stamp once a frame and, when it moved, tell the controller first
(`sky.weatherJump()`: the eased row is dropped so the first-call law
takes the new one whole, and the wind model drops its front and builds
none for the change) and the front on the same tick (`jump: true`: the
word is taken as a first word is - nothing crosses, nothing tapers, the
drops down on the frame, arrival 1 by contract). The classic path,
which snaps on every change, reads none of it.

**F4 - `?wseed` did not reach the wind.** The WX2 record said `?wseed`
replays a day's rolls. It reached the sky's Rain1/Rain2 pick and the
episode's peak; the wind model was built with its default seed and
rolled its own calm and fronts regardless. The controller seeds it from
the same door now, so a replayed day blows, clouds and rains alike.

**F5 - the record's numbers were loose.** The Rendering entry and the
Ledger row quote the peak ranges and the two arrival windows; nothing
held them to `PRECIP_PEAK`, `PRECIP_IN` and `PRECIP_OUT`, which is the
drift ledger.test.js's header warns of - a row wrong in its numbers
rather than its substance. Pinned both ways.

## The lanes walked, and what held

- **Clocks.** The front's arrival is the wind's, in game minutes; the
  smoothing and the wander are real seconds off `performance.now`; `dt`
  is the frame's, capped at 0.1 s. A hidden tab resumes with one small
  step. `?timescale` speeds the arrival with the sky, as it should.
- **Order on the frame.** The front ticks before `sky.use`, so it reads
  the wind model one frame behind the deck - a frame, not a lag. On a
  jump the sky is told first and the front on the same tick, and the
  front takes arrival 1 by contract rather than reading a model that
  may still hold last frame's front.
- **Boot.** The hosts' baseline is the stamp at boot, so a boot is never
  a jump; the wind model has no front at its first tick, so the arrival
  is 1 and the first sample lands whole - a boot into rain is rain.
- **`?weather=`.** Pins the sim in both hosts and the controller; the
  wind model sees one word forever, builds nothing, and the drops stand
  at the episode's peak under its wander. A shot is deterministic for a
  given clock and `?wseed`; a shot that wants WX1's whole volume asks
  `?front=off`.
- **The classic path.** `weatherTerms()` whole, every frame; the frozen
  fog row by identity; DFU's cap on the cut; `rainGain` 1 and never
  written; `lightningShown` is the player. Pinned in the WX2 suite.
- **WX1's pins.** The lab's shaders untouched; the fade is in the count.
- **Both hosts.** Wired alike, pinned alike; the exterior host has no
  grass and passes dim 1.
- **The ear.** `soundWeather` for every shown/word pair; the gain
  written once per move and tolerated by a handle without the setter,
  which the older test stubs are.
- **A change of kind mid-fall**, rain into storm, a second cut inside a
  front (the terms cross from what was on screen), a season turning
  mid-front (the sun's winter arm moves the target and the blend follows
  - classic snaps the same, so no worse).

## What stands unseen

All of it, in a browser, with ARENA2: no game data here and no eyes on
the sky. The timing itself is reasoned, not watched - at the default
timescale a front is a quarter of an hour, rain arriving around minute
eight and whole by fourteen. If that reads slow in play, `PRECIP_IN` and
`PRECIP_OUT` are the two numbers. Suite counted in Testing.md; lint
clean; build green.
