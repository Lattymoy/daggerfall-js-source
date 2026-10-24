# The Rocket - mounds, farting horses and a diarrhea frenzy, a live event (ROCKET1)

> Design page and record, written 2026-10-23 with the build. The owner: "Alright I wanna develop a new /event.
> Basically, when I type /event rocket I want mounds to appear and shoot poop up from the ground and a horse to fart
> across the sky neighing and then smaller horses farting across the sky. At some point the poop subsides and
> daggerfall erupts into a giant diarrhea frenzy."

## 1. The door

EVENT1's door, a third word on it, after the dread (EVENT1) and the sun baby (SUNBABY1, `06-Systems/Online-Arc.md`).
A dev stages it with `/event rocket` (the dev glyph; online players only), every player online sees it, and it ends
when a dev ends it with `/event off`. The relay carries the word and nothing else: what the event looks and sounds
like is the client's.

- **The word.** `net/wire.js` `LIVE_EVENTS` is `['dread', 'sunbaby', 'rocket']` - appended, never reordered.
  `LIVE_EVENT_RELAY_MIN.rocket` is 253: an older relay answers the word `bad stage` and closes the socket, so the client
  sends it only through a relay at world253 or past (`relayKnowsLiveEvent`) and says "The server cannot stage that event
  yet." otherwise.
- **The relay.** world253 (`RELAY_VERSION`). No file joins the bundle; the hub stages, keeps and fans the word as it
  does the others. NOT YET DEPLOYED: deploy the relay first, then the site. A client that does not know the word shows
  no event.
- **The command.** `net/chatCommands.js` `parseEventCommand` reads `LIVE_EVENTS`, so `/event rocket [on|off]` needed no
  code of its own.

## 2. The cycle (`src/world/rocketEvent.js`)

One cycle of 125 s, read off the stage's own moment (the hub's `at`) on the shared clock, so every player online is
at the same second of it and a joiner comes in on it (SUNBABY2's law). It wraps while the event stands.

| Phase | Seconds | What happens |
|---|---|---|
| rise | 0-6 | Mounds push up out of the earth round every player |
| erupt | 6-60 | They shoot poop into the sky (the jets come up over 3 s). At 14 s the GREAT HORSE gallops across the sky neighing and farting (16 s); from 30 s its six FOALS follow on its way, 2.2 s apart |
| lull | 60-72 | The poop subsides over 6 s; the sky starts to brown over the last 4 s |
| frenzy | 72-117 | Daggerfall erupts: every mound a geyser 2.6 times as tall, the sky brown and churning, poop falling everywhere round the player, a herd of horses farting across the sky every way (one every 1.1 s), a brown wash over the picture |
| ebb | 117-125 | The frenzy passes and the mounds sink back into the earth |

A line is said at each cue to a player who is watching (`ROCKET_LINES`, through `t()`): the stage's own line on a live
stage, the next ones as the cycle reaches them, nothing to a joiner about what they never saw. The show fades in and
out over 4 s (`ROCKET_FADE_S`); a welcome is whole at once.

## 3. The world

- **The mounds are the world's.** They stand on a 22 m grid of the world's own coordinates (42% of its cells, within
  150 m of the traveller), each cell's mound by its seed. The host hands in where the scene's origin stands in the world
  (`state.worldCoords`), so a recentre moves none of them, and two players standing together see the same mounds erupt
  in the same second. Each sits on the terrain's height at its centre, with a skirt below the ground for a slope.
- **The poop is worked out, never simulated.** Each mound throws 28 chunks in a fountain; a chunk's place is a function
  of the shared clock in the shader (`render/rocketPass.js`), so a thousand chunks cost one instanced draw and no
  per-frame work.
- **The horses are the sky's.** A flight crosses 2.6 radians of the sky on its own bearings, 900 m from the eye (the
  Starfall's law: a sky thing goes where the eye goes), seeded by the stage's moment and the cycle - every player sees
  the same horse cross the same quarter of the sky. Each farts on its own seconds; each fart hangs as a cloud for 3.5 s.
- **The horse is drawn, not read.** A side-on galloping horse in one of six coats, cut out of a signed-distance shape
  in the shader. Not Daggerfall's horse art: a sky full of them at any angle wants one shape that reads at a distance.
- **Every horse is FAT** (the owner, the same day: "have it make all the horses go into fatass rendering mode"): a
  barrel 1.7 times a horse's depth (`ROCKET_HORSE_GIRTH`), its belly jiggling with the gallop, on legs 0.6 of a horse's
  (`ROCKET_HORSE_LEGS`), farting from where the barrel ends.

## 4. The sound

- **The neigh is Daggerfall's own**: DAGGER.SND `AnimalHorse` (99), pitched down for the great horse, up for a foal,
  placed along the horse's way so it pans as it crosses.
- **The farts are made** (`rocketFartSamples` - Daggerfall has none): a buzzing pulse whose pitch slides and wobbles,
  fluttering as it sputters, low-passed, three variants, registered with the audio engine under `rocket:fart0-2`
  (`registerSamples`). At most 8 a second from the herd.
- **A mound splashes** near the traveller (DAGGER.SND `SplashLarge`, pitched down) while the jets are up, faster in the
  frenzy; the ground rumbles (a long low fart) at the rise and at the frenzy.

## 5. The hosts

`src/scenes/rocketHost.js` is the host module (HOST-SPLIT: `fishHost.js` is the shape). `scenes/world.js` wires it in
four lines - `rocketHost.js:"export function createRocketHost("` built after the streaming world it anchors to, the
hub's word beside the dread's and the sun baby's, the exterior frame after the sun baby's fire, the draw after the
Starfall's sky - and its ceiling rose by those four (`test/scenes/hostceiling.test.js`).

THE FOUR HOSTS (Home.md 17e): `scenes/world.js` wired. The other three stand no show by design, as they stand no dread
and no sun baby - so none is an open flag: `scenes/exterior.js` (the fixed city) holds no hub link, so no live event
reaches it; `scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` (dungeons) have no sky and no ground of
the world's under a roof - their frames return before the exterior's, and the show holds its place on the shared clock
and is there again outside.

DRAWN AND HEARD ONLY: nothing is applied - no player is hurt, slowed or soiled by an event.

## 6. Departures

Not a DFU member - DFU has no live events. Ledger A row: THE ROCKET (ROCKET1).

## 7. The pins

`test/world/rocket1_event.test.js` - the wire, a real relay Room staging it, the session's word gate and the command,
the cycle, the lines, the fade, the mounds' grid, the flights, the sky and its sounds, the made fart, the pass (nothing
drawn with nothing to draw, each part's depth and blend, every state put back, every allocation freed, the colours from
the tables), the host (the line, the pass built once, the mounds through a recentre, the neigh and the farts) and
world.js's four lines. `tools/mutants/rocket1.json`: 15 mutants, all dead. The shaders were compiled, linked and drawn
in Chromium (SwiftShader) at every phase before they shipped.
