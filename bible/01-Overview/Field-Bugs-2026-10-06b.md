# FIELD BUGS 2026-10-06b - players running in place

Mac's report, from the field:

> I think the newly integrated spell effects are causing issues and theres a lot of player desync online, including
> players appearing to run in place

| | Report | What it was | Done |
|---|---|---|---|
| 1 | players appearing to run in place | every on-foot body strides off its drawn pose's `mv`, and the play-out stands a peer at the end of its path whenever its next pose is late - with the last pose's `mv` still on it. A peer whose poses stopped (a tab in the background, a reconnect, a crash that never closed its socket) ran and stepped in place for up to `PEER_TIMEOUT_MS`, 80 s. AUDIT DISC7 B3 had stood a RIDER in that case; nobody on foot | RUN-IN-PLACE: the drawn pose reads standing once the drawn place has stood `SHOWN_MOVE_HOLD_MS` |
| 2 | the newly integrated spell effects | IMPACTFX (#627, 10-05) touches nothing on the wire and nothing the relay sees; what it costs the caster's frame is measured below | SPELL-COST below |
| 3 | a lot of desync | a peer is drawn behind its poses by design (SCALE2b's play-out: the line's fastest + one interval + its jitter - 120-270 ms in the harness below) and a late pose stands it, then catches it up at up to twice its pace or snaps it when it is past the snap. What makes poses late is listed below; the relay's budgets were checked and fit an honest client | the list below |

Nothing here was seen in a live room: the play-out was driven in node through two real `OnlineSession`s over fake
sockets on a fake clock (a sender through the real `sendPose` gate and stamp, a watcher ticking at 60 fps), and the
spell costs were measured in node and in the real game in headless Chromium over the freeware ARENA2.

## RUN-IN-PLACE (1)

`src/net/online.js` (`tick`, `SHOWN_MOVE_HOLD_MS`). The drawn pose (`p.shown`) is made once a frame by the play-out
(`poseAlong` over the peer's path at its cursor), and every renderer of a body on foot reads it: the Morrowind bodies
(`net/peerBodies.js`), the class sprites and the dolls (`net/remotePlayers.js`), the Eye Of The Beholder walkers and
the beasts (`net/peerRiders.js`), and the footsteps - each through `net/peerClimb.js` `peerMoving`, `!!shown.mv` off
the wall. The cursor walks the path as far as the newest pose and waits there for the next. While it waits the body is
drawn standing - and `poseAlong` hands it the newest pose's `mv` whole, so a peer whose next pose was late was drawn
running, stepping and footfalling on one spot. When the poses stopped for good the body ran there until the silence law
hid it, `PEER_TIMEOUT_MS` (80 s) after the last pose: a tab put in the background (the game loop stops and nothing more
is said), a socket that died without its close, a reconnect's backoff. AUDIT DISC7 B3 stood a RIDER whose poses
stopped (`PEER_RIDE_STALE_MS`, the riding sound's own test of a pose's age); a body on foot had no such law.

Now the drawn pose reads standing once the drawn place has not moved for `SHOWN_MOVE_HOLD_MS`, and the first drawn step
after that reads the pose's own `mv` again. The hold is the sender's own (`scenes/world.js` `ONLINE_MOVE_HOLD_MS`, 250
ms - ONLINE-MVFLICKER1's: a mobile sprite starts its walk cycle over on every idle-to-moving edge, so a gap shorter than
the hold must never read as a stop). One home: the play-out makes the drawn pose, so every body and the footsteps take
the law with nothing of their own changed. The rider's pose-age test stands beside it.

**Measured** in the scratch harness (sender at 60 fps walking 5 m/s, POSE_HZ, a line of 40 ms or 40-100 ms; 18 s of
watching at 60 fps; frames drawn in place while reading moving):

| the sender | before | after |
|---|---|---|
| a tab in the background 3 s of every 10 | 351-413 frames, the longest 2.9-4.0 s (the whole silence) | 30-39 frames, the longest 250 ms |
| a 250 ms hitch every 2 s | 61-82, the longest 133-183 ms | the same - under the hold, the stride kept |
| a 120 ms frame every 0.7 s | 18-40, the longest 50-67 ms | the same |
| steady 60 fps | 0-11 | the same |

The same with and without the send time (SCALE2b's timed play-out and NET-SMOOTH's fallback): neither law runs a body
in place any longer than the hold. A gap under the hold still stands the body for that moment - the stride carrying on
over it - which is what the hold is for.

**Pinned** in `test/runinplace.test.js` (5): for each play-out, a peer whose poses stop while it walks stands within
the hold and reads standing for the rest of its silence, and its first step after walks again (on the code before:
286 frames of 286 drawn in place); a sender's lost pose every second stands it a moment and never reads it standing;
and the one home - the drawn pose made in `tick`, the hold the sender's own length, `peerMoving` reading it.
`tools/mutants/runinplace.json`: 5, all dead.

## SPELL-COST (2)

IMPACTFX (#627, merged 10-05 20:28 UTC: `render/spellImpactFx.js`, `systems/spellImpactSound.js`, `scenes/hostMagic.js`)
draws a landing spell in light and gives it a sound. **It touches nothing on the wire**: no frame, no pose field, no
relay arm (the merge changed no file under `src/net/` or `server/`), and a peer's cast is still drawn off the pose's
cast count in the frame loop (`world.js` `peerCastVisuals`, under its own try/catch - a throw there drops no pose). The
landing's light rides the candle's slot as a CARRIED light (`SpellImpactFx.light`, `carried: true`), so it never takes
a lantern's shadow map. So the only way it can reach another player's screen is through a client's FRAME: a frame that
runs long says no pose while it runs, and every screen watching that player stands them (RUN-IN-PLACE, above, is how
that looks now).

**Measured in node over the real modules** (this container's CPU):
- a landing's burst: 0.02-0.25 ms (a bolt), 0.1-0.36 ms (an area of radius 4); a frame's step and build with a dozen
  landings live: under 0.9 ms - the particles are bounded (`FX_MAX_PARTS` 1,500, `FX_MAX_INSTANCES` 2,400);
- each look's sound, baked on its first play: 3.1-7.8 ms (fire, frost, poison, shock, magic), 22.8 ms for the heal's
  synthesised stand-in (only until the heal's own clip has loaded).

**Measured in Chromium** (SwiftShader, the probes' own flags, the real module served by Vite): building the light's
pass (`new SpellImpactPass(gl)` - two shaders compiled, linked and the status read) held the calling thread 6.8 ms
cold, beside 2-3.5 ms for a trivial program on the same context; its draw for a dozen landings live, 0.1 ms. A
player's GPU compiles differently and the figure is this one's, but it is the size of a frame's hitch, not a stall a
line's cushion cannot take.

**First use, and how often it comes.** The light's GL pass (`SpellImpactPass`: two shaders compiled and linked) is
built inside the frame that first DRAWS a landing (`drawFx`) - not warmed at idle, as every other on-demand program is
(`render/warmPrograms.js`, PERF-WARM: "the compile that happens mid-frame"). The sounds are baked on each look's first
play. Both belong to the cast ENGINE (`createPlayerMagic`), and an engine is made by the street's host and again by
every dungeon entered (`buildDungeonContext`): each dungeon's first landing compiles the pass again, each look's first
landing bakes its sound again, and each new engine fetches the heal's clip again. A peer's landing is drawn too, so one
player's first spell is the first-use frame of every client that sees it. Small as each is - a few milliseconds, once
a look an engine - they belong to the context and the audio engine, which live for the page, not to the engine; that
is open (Performance-Next.md's list).

**What the spell effects DO do to another player: the camera's kick.** Every missile that lands within 14 m of the
player kicks their camera (`landFx`'s `shake`, 3 for a bolt and 4.5 for a blast, falling off with distance through
`betterAmbience.weaponKick`) - the player's own, and with no test of whose it is, a peer's drawn missile and every
fireball of the sun baby's wrath. In a crowd that casts, the screen shakes with everyone's spells. Whether another's
spell should move my camera is a call about the feel, not a fault in the code: open, for Mac.

**So the spell effects are not what made players desync**: they say nothing on the wire, and what they cost a frame is
milliseconds. What they share with the desync is the look - a frame that runs long anywhere stands that player on every
screen, and until RUN-IN-PLACE every such stand looked like running on the spot.

## What makes a pose late (3)

The relay's budgets were read against an honest client and fit it: a socket's pose bucket is `POSE_HZ_MAX` (20) a
second, and what spends it is the client's poses (`POSE_HZ`, 10 at most, fewer in a crowd), its blows on another's
foes (`HIT_HZ_MAX`, 10, gated at home and queued, never more), the host's memory (once in `WORLD_PUBLISH_MS`) and a
ping only when a standing socket says one (the runtime answers it in the object's sleep). Past `POSE_FAN_MAX` (32
nearest) a listener hears one pose in `POSE_FAR_SHARE` (4): at the crowd's floor of `POSE_HZ_MIN` that is one a
second, which is `GAP_MAX_MS` exactly - the far tier was sized to keep walking on a regular sender and has no room for
an irregular one.

A pose is late, and the peer stands then catches up, when:
- **the sender's frame hitches** - its loop sends nothing while it runs; the play-out's cushion is one interval and the
  line's jitter, so a hitch longer than about one interval stands the peer on every screen that watches it. First-use
  costs (a shader built on first sight, a sound baked on first play) are hitches of this kind;
- **the sender's tab is in the background** - nothing is said until it comes back (RUN-IN-PLACE stands it now);
- **a reconnect** - a relay deploy drops every socket (`relay-deploy.yml`, on every merge that moves `RELAY_VERSION`),
  and a backoff of `BACKOFF_MIN_MS`-`BACKOFF_MAX_MS` passes before the welcome stands everyone again;
- **the line stalls** - the play-out takes a stall's backlog at up to `PLAY_RATE_MAX` (2x), and a peer past the snap
  is snapped.

None of these is new with the spell effects, and none was changed here but the first's look: a peer whose poses are
late now stands still rather than running on the spot.
