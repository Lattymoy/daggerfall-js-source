# AUDIT EV - the Enhanced Visuals arc, audited whole (2026-08-31)

Mac: "do a comprehensive audit on everything so far." Three adversarial
lanes read every line EV1-EV8 shipped - simulation/async, rendering,
and test/pin/doc integrity - with the arc's own record
(`07-Rendering/Enhanced-Visuals-Arc.md`) as the statement of intent to
attack. Every CONFIRMED finding below is fixed in the same change that
records it; the pins named moved with the fixes.

## Findings, fixed

- **F-R1 (severe): moonlight leaked into every interior and dungeon.**
  ONE Renderer serves the whole session, the exterior hosts set the
  moon per frame, and the modal frames never cleared it - so a tavern
  entered on a clear full-Masser night kept a warm ~0.22 directional
  term at the moon's exterior bearing (about 2x the interior ambient
  on moonward faces) for the whole visit, flats and automap beacons
  included through the `_clockLit` tint. The EXACT bug class AUDIT 26
  F001 recorded and fixed for windowEmission one screen away; the EV5
  record's "interiors never call setMoonlight" was only true of a
  fresh renderer. FIX: both modal arms and the automap's camera pass
  now call `setMoonlight(null)` explicitly, and the same-family
  pre-existing leak went with it - the R12 player-following INDIRECT
  light, also never cleared indoors, is zeroed at the same two sites.
  Pinned in moonlight.test.js (only-ever-null counts per file).
- **F-SIM1 (severe): a teleport overlapping an in-flight build
  double-built the pixel.** EV7 stretched a build across a worker
  round trip; `state.init` marks the whole destination grid loaded at
  enqueue time, so an in-flight pixel inside it survived the audit-24
  recheck AND sat in the fresh queue - the second `built.set`
  overwrote the first entry, leaking its terrain VAO, tilemap texture
  and batches on the GPU for the session, doubling the collider
  bucket and door registry, and able to orphan a mill's hum into an
  unstoppable loop. (A leave-and-return crossing hit the same window;
  pre-EV7 it was microtask-thin.) FIX: one build per pixel ever in
  flight - buildPixel is now a cache-then-in-flight-map front over
  buildPixelNow, so pump, boot and the teleport share one promise per
  key. Pinned in terrainworker.test.js.
- **F-SIM2: a stale far-ring stride could stand forever.** The ring
  class was chosen at job-send time; the pixelChanged restride sweep
  cannot see an unpublished pixel, so a crossing during the round trip
  left a wrong-class chunk until the NEXT crossing - which a player
  who stops walking never makes. FIX: the class re-checks at publish.
- **F-R2: the far ring's hole was half a pixel asymmetric.** Ring
  cells sit on a centre lattice offset half a pixel from the streamed
  footprint; the first rule skipped the east/south straddle cells too,
  opening a 409.6-unit strip on those rims covered by NEITHER surface
  (the exact sky gap the code's comment claimed the rule prevented).
  FIX: skip exactly the fully-inside cells - one straddler survives on
  every side, symmetric, painter's order eats the overlap; the
  residual half-pixel spike exposure is recorded in the module and
  watched. Test now checks the invariant against world-space spans,
  not a re-statement of the rule.
- **F-R3: the rim fade never closed at the square mesh's edge
  midpoints** - it keyed on the corner-covering far plane, so tall
  ring terrain ended against the sky as a faint ~11%-unblended
  straight edge at the four cardinal directions. FIX: uRimEnd keys on
  the worst-case NEAREST rim (radius minus the rebuild drift); pinned
  by captured uniform values under the Proxy-GL stub.
- **F-R4: the ring ignored the moon** - a full-Masser night stepped in
  brightness at the exact boundary the hole machinery hides. FIX: the
  ring takes the frame's own moon term (dir/scale/colour forwarded
  beside the sun's).
- **F-SIM4: a spawned worker whose init post threw was stranded
  alive.** FIX: the constructor's catch terminates it.
- **F-DOC1: the worker shell was never executed by any test**, and its
  hand-copied job field list was the one place a kernel input could be
  dropped with every test green (drop `hasLocation` and location
  pixels build with avg=0 - floating buildings - in the browser only).
  FIX: the job now crosses as a SPREAD (structurally rot-proof), the
  real shell's both error arms execute in node through captured
  `globalThis.postMessage`, and the client's reply mapping proves avg
  and nature survive the wire.
- **F-DOC2: the kernel-equivalence test was a tautology** -
  generateSamples now CALLS sampleKernel, so f(x) was compared to
  f(x), while the independent numeric pins are data-gated and skip in
  exactly the container the arc says tests must carry the load in.
  FIX: an independent re-statement of the whole sampler loop (windows,
  inverted column order, fractions, scales, clamp) is the oracle now.
- **F-DOC5: beginFrame's reset-bind-upload order was only half
  pinned** - uniforms uploaded before `_use` would land in a foreign
  program with every test green. FIX: order source-pinned.
- **F-DOC7: the byte*8 base term lived in two homes** - the ring's
  "streamed law itself" claim rode overworldModel's private copy of
  the 8. FIX: terrainSampler exports BASE_HEIGHT_SCALE, overworldModel
  re-exports it; one home.
- **F-SIM5 (doc drift): the EV1 comment said rays/audio stay on
  player.eye; they read cam.pos (= eyeAt) and that is deliberate** - a
  pick should hit what is on screen. Comment now says so.
- **F-SIM6 (probe): `__streamIdle` ignored teleport builds.** Now
  `inFlight.size === 0` covers every build.
- Small ledger: the 1:1 lane no longer builds the strided index twin
  it can never use; the arc's EV2 plan line said "thirteen" literals
  where the sweep found twenty-two (corrected in place).

## Recorded, not fixed (watched)

- **F-SIM3:** SNAP_SPAN(2) vs terminal fall speed - past ~6s of free
  fall the per-step span exceeds the snap guard and eyeAt returns the
  stepped eye, so EV1's fix stands down during the fastest motion.
  Edge-of-edge; needs a runtime to judge; the dial is one constant.
- **F-R5:** the hole's spike-safety is half a pixel shallow on all
  four sides (the symmetric trade F-R2 chose over sky gaps).
- The three escape hatches, in one place: `?cull=off` (EV3 frustum),
  `?terrainthread=off` (EV7 worker), `?ring=off` (EV8 horizon) - each
  read once at scene build, each falling back to the pre-slice path.
- Pre-existing and out of this arc's scope: `no-unused-vars` is off in
  eslint (16 stale imports across the two exterior hosts predate EV);
  renderalloc's multiply-allocation pin matches only the old spelling.

## From the field, after the audit

- **F-FIELD1 (crash): the first windmill drawn took the frame loop
  down** - `TypeError: can't define property "_evTex": Object is not
  extensible` (Firefox, live site, reported by Mac mid-play). The
  windmill bake ships its sub-meshes as FROZEN module constants
  (windmillMesh.js), createMesh reused them by reference, and EV2's
  sub-mesh texture cache stamps `_evTex`/`_evGen`/... - a strict-mode
  throw on a frozen object. Neither the audit nor the suite saw it
  because every drawMesh fixture was a hand-built plain object. FIX:
  createMesh COPIES the sub-meshes - the renderer stamps
  renderer-private fields only on objects it OWNS - and the
  regression test drives the REAL frozen BODY bake through the
  Proxy-GL stub. The lesson joins the audit's F-DOC lessons: a cache
  that writes into caller-supplied objects is a latent crash against
  every producer the tests didn't imagine.

## What held

The lanes' clean lists are long and worth reading in the arc record's
context: the EV6 shadow discipline survived every mid-frame trace
(automap, travel map, sprite RT, both skies, precipitation, the ring);
EV3 cannot cull anything dynamic (every post-build drawable rides
per-frame arrays); the EV7 wire protocol held every fault injection
(init failure, death mid-job, per-job errors, transfer/detach); the
EV1 recenter family, the EV4 fog scaling and blend-surviving restride,
and the atomic publish contract all verified end to end.
