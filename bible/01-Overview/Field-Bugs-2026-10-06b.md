# FIELD BUGS 2026-10-06b - players running in place

Mac's report, from the field:

> I think the newly integrated spell effects are causing issues and theres a lot of player desync online, including
> players appearing to run in place

| | Report | What it was | Done |
|---|---|---|---|
| 1 | players appearing to run in place | every on-foot body strides off its drawn pose's `mv`, and the play-out stands a peer at the end of its path whenever its next pose is late - with the last pose's `mv` still on it. A peer whose poses stopped (a tab in the background, a reconnect, a crash that never closed its socket) ran and stepped in place for up to `PEER_TIMEOUT_MS`, 80 s. AUDIT DISC7 B3 had stood a RIDER in that case; nobody on foot | RUN-IN-PLACE: the drawn pose reads standing once the drawn place has stood `SHOWN_MOVE_HOLD_MS` - AUDIT 637: the place the law itself last drew, from the first frame it draws a peer (C1), and a far peer from a slow sender walks (C2) |
| 2 | the newly integrated spell effects | IMPACTFX (#627, 10-05) touches nothing on the wire and nothing the relay sees; what it costs the caster's frame is measured below | SPELL-COST below |
| 3 | a lot of desync | a peer is drawn behind its poses by design (SCALE2b's play-out: the line's fastest + one interval + its jitter - 120-270 ms in the harness below) and a late pose stands it, then catches it up at up to twice its pace or snaps it when it is past the snap. What makes poses late is listed below; the relay's budgets were checked and fit an honest client | the list below |

Nothing here was seen in a live room: the play-out was driven in node through two real `OnlineSession`s over fake
sockets on a fake clock (a sender through the real `sendPose` gate and stamp, a watcher ticking at 60 fps -
`tools/playoutProbe.mjs`, committed at AUDIT 637), and the spell costs were measured in node over the real modules and
in headless Chromium over the real module on a bare WebGL2 context - a micro-benchmark, not the game's frame (AUDIT 637
D12: this sentence said "in the real game").

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
the hold must never read as a stop; AUDIT 637 D7: one constant now, world.js takes it from net/online.js), and so is its
edge: standing on the frame the hold has passed (`>=`, AUDIT 637 C3), as the sender reads moving while now < moved + the
hold. One home: the play-out makes the drawn pose, so every body and the footsteps take the law with nothing of their
own changed - the riders too (`net/remotePlayers.js` reads `shown.mv` for a rider's gait, so a rider stands at the hold,
before DISC7 B3's 1 s pose-age test silences its hooves; AUDIT 637 D15a). The rider's pose-age test stands beside it.

AUDIT 637 C1 (lens C and D, MEDIUM/HIGH): the first cut measured the hold against `p.shown` - which a peer's
introduction (`_peer`: a welcome's roster, a join, a stranger's first pose) and a snap write themselves. A peer drawn
first at its introduction's pose that never moved after was never clocked: `now - (p.drawnAt ?? now)` stayed 0, and it
ran in place for the whole `PEER_TIMEOUT_MS` - the field report again, for anyone who walked into a room after a player's
tab went to the background mid-stride (500 frames of 500 in a 5 s probe). The law keeps its own record of the place it
last drew (`p.drawn`): the clock starts at the first frame it draws a peer, whoever wrote `shown` first, and a snap is a
step (C4).

**Measured** by `tools/playoutProbe.mjs` (AUDIT 637 D13: the first table came from a harness in the session's scratch;
`TREE=<main's worktree>` plays the before): the sender at 60 fps walking 5 m/s at POSE_HZ, a line of 40-70 ms, 30 s a
row with the first 3 s not counted; frames drawn in place while reading moving, and the longest such run. Before is main
at `44e4995fc`, after this branch:

| the sender | before (timed / untimed) | after (timed / untimed) |
|---|---|---|
| a tab in the background 3 s of every 10 | 483 frames, the longest 4,033 ms / 355, 2,967 ms | 28, 233 ms / 28, 233 ms |
| a 250 ms hitch every 2 s | 138, 183 ms / 129, 183 ms | the same - under the hold, the stride kept |
| a 120 ms frame every 0.7 s | 170, 83 ms / 167, 100 ms | the same |
| steady 60 fps | 0 / 0 | the same |

The longest run before is the whole silence and, timed, a second more: the first pose after a silence comes over a
second after the last, so SCALE2b's play-out stands the peer for the silence past GAP_MAX_MS before it walks the step,
and that stand read moving too (AUDIT 637 D15d: this table said "the whole silence" of 2.9-4.0 s for a 3 s one). After,
each silence is one stand and one walk cycle started over, which is what a player who stopped and set off again looks
like. A gap under the hold still stands the body for that moment - the stride carrying on over it - which is what the
hold is for.

**A far peer from a slow sender** (AUDIT 637 C2, lens C, LOW - a regression this branch exposed). Past POSE_FAN_MAX a
listener hears one pose in POSE_FAR_SHARE, sized so a crowd's floor of POSE_HZ_MIN comes to one a second, GAP_MAX_MS
exactly (`net/wire.js` POSE_FAR_SHARE). But the sender's gate (`sendPose`) rounds every interval up to a whole frame: a
sender at 12 fps says a pose every 333 ms, so the far tier hears it every 1,333 ms; at 10 fps every 1,200. SCALE2b's
play-out counted those intervals as GAP_MAX_MS - it walked a second of each, stood the rest, and steered its cursor a
second behind poses that came a third of a second later - so the peer stood 350-570 ms at every pose. Before this
branch that stand ran in place; with RUN-IN-PLACE it started the walk cycle over 43-48 times a minute. A timed interval
is the sender's own spacing, with no jitter in it, so it now counts as itself up to PAUSE_MS, and a moving peer's own
interval is walked whole (`net/online.js` `_arriveTimed`). The same probe, a crowd of 60 (4 Hz, one in four):

| the sender | before (timed) | after (timed) |
|---|---|---|
| 60 fps, 20 fps | 0 | 0 |
| 15 fps | 159 frames in place, the longest 133 ms | 0 |
| 12 fps | 661, 567 ms | 1, 17 ms |
| 10 fps | 470, 350 ms | 0 |
| 15 fps, +-30% a frame | 288, 333 ms | 36, 133 ms |
| 10 fps, +-30% a frame | 474, 500 ms | 38, 133 ms |

The far peer is drawn as far behind as its own interval - 1,343 ms at 12 fps where it was 1,296 - and every near, hitch
and stop row of the probe is the same as before. NET-SMOOTH's untimed fallback keeps its clamp: an arrival interval
carries the line's jitter. No live relay takes that path (the relay passes the send time from world162 on, SCALE2b's -
`bible/11-Multiplayer/Scale-Arc.md`; the source is at `world172`), and on it a 12 fps far peer still stands - 378 frames
in place before, 290 and 20 walk cycles started over after. The POSE_FAR_SHARE doc in `net/wire.js` still says the
interval is clamped; that file's bytes are the relay's version (SLAM8), so its correction rides the next relay window.

**Pinned** in `test/runinplace.test.js` (5): for each play-out, a peer whose poses stop while it walks stands within
the hold and reads standing for the rest of its silence, and its first step after walks again (on the code before:
286 frames of 286 drawn in place); a sender's lost pose every second stands it a moment and never reads it standing;
and the one home - the drawn pose made in `tick`, the hold the sender's own constant, `peerMoving` reading it.
`tools/mutants/runinplace.json`: 5, all dead. AUDIT 637's in `test/audit637_runinplace.test.js` (9): a peer drawn
first at its welcome's, join's or first pose's place, running or walking, timed or not; a pose-less introduction; a
snap after a stand; a runner; a walk along z and a climb along y; the exact frame the body stands on; the far peer from
a 10 fps sender, never read standing; and a moving peer's silence still stood past GAP_MAX_MS or its own longer
interval. `tools/mutants/audit637.json` C1a-C3f, all dead.

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

**First use, and how often it comes.** The light's GL pass (`SpellImpactPass`: two shaders compiled and linked) is built
inside the frame that first DRAWS a landing (`drawFx`) - not warmed at idle, as the renderer's own on-demand programs
are (`render/warmPrograms.js`, PERF-WARM: "the compile that happens mid-frame"; AUDIT 637 D9: not "every other on-demand
program" - the aura ring and the gate court's passes are built in their first frame too). The sounds are baked on each
look's first play. Both belong to the cast ENGINE (`createPlayerMagic`), and an engine is made by the street's host and
again by every dungeon entered (`buildDungeonContext`): each dungeon's first landing compiles the pass again, each
look's first landing bakes its sound again, and each new engine fetches the heal's clip again. A peer's landing is drawn
too, so one player's first spell is the first-use frame of every client that sees it. Small as each is - a few
milliseconds, once a look an engine - they belong to the context and the audio engine, which live for the page, not to
the engine; that is open (Performance-Next.md's list).

**What the spell effects DO do to another player: the camera's kick.** Every missile that lands within about 13.3 m of
the player kicks their camera, 13.5 for a blast (`landFx`'s `shake`, 3 for a bolt and 4.5 for a blast, falling off over
14 m in `landFx` itself, and a kick under 0.15 dropped before `betterAmbience.weaponKick`; AUDIT 637 D15b) - the
player's own, and with no test of whose it is, a peer's drawn missile and every fireball of the sun baby's wrath. In a
crowd that casts, the screen shakes with everyone's spells. Whether another's spell should move my camera is a call
about the feel, not a fault in the code: open, for Mac.

**So the spell effects are not what made players desync**: they say nothing on the wire, and what they cost a frame is
milliseconds. What they share with the desync is the look - a frame that runs long anywhere stands that player on every
screen, and until RUN-IN-PLACE every such stand looked like running on the spot.

## What makes a pose late (3)

The relay's budgets were read against an honest client and fit it: a socket's pose bucket is `POSE_HZ_MAX` (20) a
second, and what spends it is the client's poses (`POSE_HZ`, 10 at most, fewer in a crowd), its blows on another's
foes (`HIT_HZ_MAX`, 10, gated at home and queued, never more), the host's memory (once in `WORLD_PUBLISH_MS`) and a
ping only when a standing socket says one (the runtime answers it in the object's sleep). Past `POSE_FAN_MAX` (32
nearest) a listener hears one pose in `POSE_FAR_SHARE` (4): at the crowd's floor of `POSE_HZ_MIN` that is one a
second, which is `GAP_MAX_MS` exactly - the far tier was sized on a sender whose interval is exactly 1000/hz, and the
sender's gate rounds each up to a whole frame: from a sender under 20 fps the far tier's interval passed GAP_MAX_MS and
the timed play-out stood the peer at every pose (AUDIT 637 C2, above - fixed: a timed interval counts as itself).

A pose is late, and the peer stands then catches up, when:
- **the sender's frame hitches** - its loop sends nothing while it runs; the play-out's cushion is one interval and the
  line's jitter, so a hitch longer than about one interval stands the peer on every screen that watches it. First-use
  costs (a shader built on first sight, a sound baked on first play) are milliseconds - well under an interval, so on
  their own they stand nobody (AUDIT 637 D15c: this line called them hitches of this kind);
- **the sender's tab is in the background** - nothing is said until it comes back (RUN-IN-PLACE stands it now);
- **a reconnect** - a relay deploy drops every socket (`relay-deploy.yml`, on every merge that moves `RELAY_VERSION`),
  and a backoff of `BACKOFF_MIN_MS`-`BACKOFF_MAX_MS` passes before the welcome stands everyone again;
- **the line stalls** - the play-out takes a stall's backlog at up to `PLAY_RATE_MAX` (2x), and a peer past the snap
  is snapped.

None of these is new with the spell effects, and none was changed here but the first's look: a peer whose poses are
late now stands still rather than running on the spot.
