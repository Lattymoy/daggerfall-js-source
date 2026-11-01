# The Rocket (a live event)

A comic live event a developer stages with `/event rocket`. Mounds push up out of the ground round every player and
shoot poop into the sky; a great fat horse gallops across the sky neighing and farting, followed by six foals; then
Daggerfall erupts into a diarrhea frenzy. Every player online sees the same show at the same second. It is drawn and
heard only: nobody is hurt, slowed or soiled. It ends with `/event off`.

## How it works

**The word.** The live event door's third word after the dread and the sun baby: `src/net/wire.js` `LIVE_EVENTS`
(appended, never reordered). The relay's hub stages, keeps and fans the word; what the event looks and sounds like is
the client's. A relay older than `LIVE_EVENT_RELAY_MIN.rocket` would refuse it, so the client sends it only through a
relay that knows it (`relayKnowsLiveEvent`). `/event rocket [on|off]` is read by `parseEventCommand` from the list.

**The cycle** (`src/world/rocketEvent.js` `ROCKET_PHASES`). One cycle of `ROCKET_CYCLE_S` (125 s), read off the stage's
moment on the shared clock, so a joiner comes in on the same second. It wraps while the event stands.

| Phase | Seconds | What happens |
|---|---|---|
| rise | 0-6 | mounds push up round every player |
| erupt | 6-60 | they shoot poop; at 14 s the great horse crosses the sky; from 30 s its six foals follow |
| lull | 60-72 | the poop subsides; the sky starts to brown |
| frenzy | 72-117 | geysers 2.6 times as tall, a brown churning sky, poop falling, a herd of horses every 1.1 s, a brown wash |
| ebb | 117-125 | the mounds sink back |

A line is said at each cue to a player watching (`ROCKET_LINES`, through `t()`); the show fades in and out over
`ROCKET_FADE_S`.

**The world.** Mounds stand on a `ROCKET_MOUND_CELL_M` (22 m) grid of world coordinates, in 42% of cells within 150 m,
seeded per cell, so two players together see the same mounds. Each mound throws `ROCKET_JET_CHUNKS` chunks whose places
are a function of the shared clock in the shader (`src/render/rocketPass.js`): one instanced draw, no per-frame work.
Horses fly the sky `ROCKET_SKY_R` from the eye on seeded bearings; each is a side-on galloping shape drawn in the shader
in one of six coats, fat (`ROCKET_HORSE_GIRTH`, `ROCKET_HORSE_LEGS`). Each fart hangs as a cloud for `ROCKET_PUFF_S`.

**The sound.** The neigh is Daggerfall's own (DAGGER.SND `AnimalHorse`), pitched by the horse's size and panned along
its way. The farts are made at runtime (`rocketFartSamples`, three variants), at most 8 a second. Mounds splash with
`SplashLarge` pitched down, and the ground rumbles at the rise and the frenzy.

**The host** (`src/scenes/rocketHost.js` `createRocketHost`). Wired by `scenes/world.js`. Interiors, dungeons and the
fixed-city bench stand no show, as they stand no dread or sun baby; the show keeps its place on the clock and is there
again outside.

## Rules

- `/event rocket` makes mounds shoot poop, a horse and smaller horses fart across the sky, and then a diarrhea frenzy
  (the owner).
- Every horse is fat (the owner).
- Drawn and heard only: nothing is applied to any player.
- New behaviour lives in a host module (HOST-SPLIT).

## Daggerfall Unity

DFU has no live events; not a DFU member. The horse is drawn in the shader rather than Daggerfall's horse art, so a sky
full of them reads at any angle.

## Code and tests

- `src/world/rocketEvent.js` - the cycle, mounds, flights, lines and made farts
- `src/render/rocketPass.js` - the instanced pass
- `src/scenes/rocketHost.js` - the host module
- `test/world/rocket1_event.test.js` - the wire, a relay Room staging it, the cycle, the world, the sounds, the pass, the host
