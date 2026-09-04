# AUDIT 56 - THE WIND AND THE WEATHER (2026-09-03)

Mac: "do another audit on all our wind/weather changes." GR3, GR4,
WIND1 - none of them seen by a human yet.

## Two faults in WIND1, both mine, both fixed here (WIND2)

**F1 - the clouds streamed at every front.** Every cloud consumer
formed its drift as **wind x time**: the sky's JS `deckCover` did
`wind[0] * time`, its GLSL twin `wind * uTime`, and the terrain's
shadow deck `uCloudWind * uCloudTime`. With a fixed per-weather wind
those were harmless - the offset only moved at a weather change, and
the 14-second ease slid it. WIND1 made the wind move **every frame for
three hours**, so the offset jumped by (delta wind) x (seconds since
the sky began) - hours in, a small change of wind threw the whole
field across the sky. The rain and the windmills never had this fault:
the rain accumulates `windOff` (the lab's design) and the mills
integrate their angle ("THE ANGLE IS INTEGRATED, NOT COMPUTED",
windmills.js:199). The sky and the ground now do the same: the
controller integrates one `driftXZ += wind * dt` where the wind and the
clock meet, hands it to the sky state, and every deck reads the drift.
`uDrift` beside `uWind`, `uCloudDrift` beside `uCloudWind`; a caller
without a drift gets the old product, so nothing else moved.

**F2 - the sky turned before the wind rose.** WIND1's ease stretched
only while the front's factor was *strictly between 0 and 1*. At the
change the factor is exactly 0, so the sky crossed in its old fourteen
seconds and THEN the wind built over three hours: the storm arrived
and the wind followed it - the reverse of what Mac asked for, and of
what WIND1's record claimed. The headless time-lapse showed it (the
wind at 64 at the change, 133 an hour later) and I read it as the
build rather than as the lag. `inLead()` is true from the change until
the front arrives, factor or no factor, and the ease stretches on that.

Pinned: the drift integrated once, no deck multiplying wind by time,
`inLead()` true at the change while the factor is still 0. Four
mutants, four dead - one of them WIND1's own condition.

## The consumers, one by one

| Consumer | Reads | Rate or product | Verdict |
|---|---|---|---|
| Cloud deck (sky) | `state.drift` | integrated (WIND2) | fixed |
| Cloud shadows (ground) | `cloudShadow.drift` | integrated (WIND2) | fixed |
| Grass lean | `uWindV` magnitude | instantaneous - a lean, not a position | right |
| Grass gust | `sky.gustAt(t)` | shaped by strength | right |
| Rain / snow | `windOff` | integrated by the host | right |
| Windmills | `sky.wind()` | angle integrated | right - **see the note** |

**The note.** The rotor law was calibrated on the OLD fixed sunny
(0.0108 -> 13 deg/s). The model's sunny afternoons span 0.0062-0.0159
across 39 seeds, so a mill turns from ~3 to ~24 deg/s on a fair day,
and a thunder front (0.0308) spins it near 58 deg/s - **4.5x the
classic rate**. That may read as frantic. It never stalls on a sunny
day (floor 0.0062, stall 0.005); a calm fog can, which is right. Left
for Mac's eyes rather than re-tuned blind.

## What AUDIT 49 actually verified

AUDIT 49 (2026-09-02) audited "the lab's grass and weather in the
game" and passed the lab rain. It did so with `precip.enhanced` FALSE
- GR3 found the controller never carried `cloudShadow`, so the flag
had never been true and the lab rain path (`drawLab`, `uEnh`) had
never once run in the game. The same holds for EE5's ground shadows,
verified with a null deck (amount 0). Both are live now for the first
time and neither has been seen. AUDIT 49's findings stand; its
verification of those two paths does not, and its page should say so.

## What stands unseen

GR3 (wind, lab rain, ground shadows), GR4 (roots on real tiles), WIND1
+ WIND2 (every consumer at once). Each is a never-rendered path under
the Incident's law. Two ways to look: a day boundary with a stormy
tomorrow for the front; a calm one for the drift, where the clouds
should now move steadily rather than slide.
