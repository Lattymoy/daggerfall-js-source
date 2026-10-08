# AUDIT ENVIRONS - the four environment mods audited, their cost measured, 2026-10-08

Mac, of the four mods he handed over that morning (Sands of the Alik'r, Snowfall, Windfall and Heat Haze; ALIKR1,
SNOWFALL1, WINDFALL1, HAZE1 - `03-World/Snowfall.md`, `07-Rendering/Windfall.md`, `07-Rendering/Heat-Haze.md`,
`07-Rendering/Sands-Of-The-Alikr.md`): *"Lets do a comprehensive audit on everything and ensure perfection and
performance doesnt take a hit"*. Five lenses read the branch at `6e8ea589`, each against the mods' own assemblies
(ilspycmd's C#, the IL) and their shaders' DXBC, and each verified its findings with a reproduction before reporting:

- **the snow's controller** (S): DynamicSnowController, its session, its tiers and its host, method by method against
  the decompiled C#, with scripts that print each divergence;
- **the snow's GPU** (G): a differential test that lowers the mod's `DynamicSnow.glsl` to GLSL ES 3.00 and runs it
  beside the port's programs in Chromium's WebGL2 (8 configurations x 4,096 random inputs), and the GL state;
- **the integration** (I): the four mods across both exterior hosts - boot order, the floating origin, teleports,
  loads, the GL seams, the switches, the save records;
- **the wind and the haze** (W): Windfall's and Heat Haze's every law against their IL and their shaders;
- **the cost** (P): the per-frame cost of each mod on this thread and on the GPU (SwiftShader: relative only).

Where two lenses found one fault the ids are joined (G1 = I1). Each fix carries an `AUDIT ENVIRONS <id>` comment and
is pinned in `test/audit_environs.test.js` (21), or in the moved pin it names. It is mutated in
`tools/mutants/audit_environs.json`.

## Fixed

**The snow's controller and its host** (S)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | high | SnowContextData.Prepare scans the map pixels of ITS box (`GetTerrainFromPixel` on each); the port asked for the tiles within a ring of the PLAYER's pixel - 2 for a blanket tile - so every blanket tile three or more pixels out read no Basic Roads tiles of its own: on 56 of the land view's 81 tiles the tracks lay bare and the berms were missing, the line moving at every pixel crossing. | `SnowWorld.terrainsIn(box)`: the box's map pixels row by row (`snowfallHost.js snowPixelBox`, MapsFile.WorldCoordToMapPixel - the settlements' scan shares it), each its loaded tile (`SnowGround.pixelOn`). |
| S2 = I3 | high | A load restored the record and completed the session on the LAST frame's clock (the dungeons restore the mods' records before the save's clock), so a save half a day later than the game it replaced had its tracks wiped by the first refill tick and its snowpack run through the gap. | RestoreTrackData at the clock's nought (CanSimulate is false through a load); CompleteSession on the next frame's clock - OnLoad's, OnStartGame's, the late Initialize's - with the weather's snowing and the refill's first tick half a second on. |
| S3 | medium | On the frame a Surface setting rebuilt the window, `frame` went on with the OLD window object: its stamps and the walkers' were written into the new mask against its unset centre - a phantom track beside the player. | The frame goes on with the window CreateGridResources made (`L = this.local`). |
| S4 | low | The blanket was not queued again when it stood again (SetActive's `lastMapPixel = int.MinValue`): a tile rebuilt while it was off kept its hole until the next pixel crossing. | Standing again, every visible tile queues. |
| S5 | low | A tile's rebuild found while a build read it was delivered INSIDE the build, whose commit then cleared the rebuild it asked for: the window kept the old ground (a metre under or over a cap's carve). | The host queues what it finds and the runtime hears it when its frame is done (OnPromoteTerrainData is the streaming world's event, never the frame's). |
| S6 | low | `snow_status` lacked half of GetRuntimeStatus: the motor's line, the terrain's, the lighting's, the uploads, Basic Roads' word, a dozen fields; C#'s booleans printed as JavaScript's. | Ported line for line; the motor's flags from the frame's own player, the ambient the renderer lights by (`renderer.ambientLight`), the classification's last word. |
| S7 = I4 | low | Every promoted tile was built, but the blanket draws `min(4, TerrainDistance)` rings: at the enhanced land view of 5, 39 tiles built and uploaded on arrival and 11 at each crossing were never drawn, taking the near tiles' budget. | ProcessBuildQueue's own test: a tile not standing in the drawn rings is not built. |
| S8 | nit | CompleteSession's ResetRefillClock (the first tick half a second on) and CreateGridResources' zeroed remainder were missing. | Both. |

**The snow's GPU** (G)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| G1 = I1 | high | The first blanket tile's index buffer was bound with whatever vertex array the last frame left - the HUD's open 2D run - so the HUD's quads drew nothing ("Must have element array buffer bound") for the rest of the session. | The surface owes the renderer the seam before its first bind (`endUiRun`, `markForeignPass`), on every sync and every upload. |
| G2 | medium | The pass's `Offset -0.25, -0.25` was left out (SNOWFALL1 kept the sea's one offset): where the snow stands at the ground's own height - a contact ramp's first texel, a faded rim - it fought the ground; 1.5-2.6% of a real scene's snow pixels lost to it, a speckled band along roads, rocks and shores. | `SNOW_LAYER`, the mod's own offset: a layer of the sea's stack, a quarter step over the ground and under the film (`test/fbsea_water.test.js` holds the world renderer to the two). |
| G3 = I6 | medium | WebGL ignores UNPACK_FLIP_Y_WEBGL for an ImageBitmap, so the albedo stood mirrored north to south. | Decoded bottom row first (`imageOrientation: 'flipY'`), its bytes as authored. |
| G4 | nit | The albedo blended two levels; the mod's is Point-filtered over its seven. | `NEAREST_MIPMAP_NEAREST`. |
| G5 | nit | Both faces were drawn; the pass culls its back faces (no Cull statement). | Culled as the ground is - the grids wind as its grid does. |
| G6 | perf | Every live blanket tile was drawn, about half of them behind the eye: up to 81 draws, 342,000 vertices (three vertex fetches each) and 664,000 triangles a frame. | Culled to the frame's frustum by its bounds - the ground's span and the deepest snow over it (`blanketRise`), as each tile's renderer is culled in the mod (ApplyMeshBounds). |
| G7 | perf | The snow was drawn after the ground, so every ground fragment under it shaded the lane's whole light and was then painted over (the mod's own order, Geometry+10). | The snow before the ground under it - GROUND-LAST's law a layer up: the ground's discard-free program fails the depth test under the snow before it shades. The picture is the same (SNOW_LAYER keeps the snow over the ground either way; measured: no byte differs). |
| G8 | perf | The blanket's vertex program read the window's masks it never uses (two of its three fetches); its fragment read the context it never uses; the ring read the far mask everywhere though it is weighed in its outer band alone. | Each read where it counts - the picture the same (the masks have one level each, read at it). |
| G9 | nit | The blanket's surface offset stood on the static coverage alone; the mod's stands on a painted track edge's too (8 mm). | `snowOnPath` in the law both programs share. |
| G10 | nit | The mipmapped albedo was read after four discards - its derivative undefined in GLSL ES 3.00 (the CLIP_AFTER law). | Its footprint taken at the span's head, read with `textureGrad`. |

**The integration** (I)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| I2 = I7 | high | A teleport, a load, a fast travel and a respawn re-anchor the scene through `state.init`, whose move (`initOffset`) the boats and the camps ride but the four mods did not: the snow's window and ring held the old place's tracks round the arrival, its first stamp a 13 m trench from the departure written into the save at the arrival's places; the leaves in the air blew on at the new pixel; the haze's layer, held while airborne, missed a recentre's height. | `snowfall`, `windfall` and `hazeGl` ride `initOffset` beside `csaReanchor`; the arrival's haze reads its layer afresh (`heatHaze.reset`); the layer rides a recentre (`heatHaze.offsetOrigin`). |
| I5 | medium | The snow's program was compiled inside the first snowy frame, and none of the new per-frame calls was guarded: a driver that would not link it stopped the world loop every frame. | The program is built with the snow's surface (`renderer.prepareTerrainSnow`); a build, a draw or a frame that throws costs the snow or the wind, once, never the frame. |
| I8 | nit | `windfall gust` replayed the frame's gusts already played (`takeEvents` answered the frame's own list). | A frame hands its gusts over with it; the console's start a list of their own. |

**The wind and the haze** (W)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| W1 | medium | Windfall ran on the real clock: with any window open its gusts, sounds, sway and leaves went on, where WindMod.Update's `Time.deltaTime` holds them; the travel's time scale did not reach it. | The game's seconds, held by a pause and scaled with the world (`worldTimeScale`, `hccTimeScale`). |
| W3 | nit | The shadow and AO replays of a crossing frame used the old frame's anchor for the mod's law: every swaying tree's shadow twitched for a frame or two (7 cm calm, half a metre in a storm). | A billboard record's anchor moves back by the shift, as the host's does (`windfallAnchorAfterShift`). |
| W4 | nit | The haze shimmered on the page's clock: on while paused, unmoved by the time scale. | Its own clock of the game's seconds (`_Time.y`); the strength's ease stays on the real clock (`unscaledDeltaTime`). |
| W5 | nit | `windfall leaves` burst its sixty at the flow's place after the frame had moved it back (13 m upwind, 7 up). | The burst keeps its own place (`emitAt`): 8 m upwind, 4 up, as TriggerLeafTest emits them. |
| W6 | doc | The departure said the mod's particles take the sun and the ambient probes; its pass is the sun's light alone through a camera-facing normal (no ambient: black toward the sun, near black at night). | `07-Rendering/Windfall.md` corrected; the port's light (the flats') stands. |
| W7 | perf | Allocations every outdoor frame: a climate's settings for one field, three arrays for the flows' places, the haze's settings read whole, two arrays for its phase, the emitter's box destructured a particle. | The nature set read when the climate or the season changes, the places written in place, the haze's keys read when one is written (`hazeFrameSettings`), its phase written in place, the box read once. The snow host reads the climate's base type the same way. |

## The cost (P)

Measured at `6e8ea589`: Node 22 on one thread of a shared four-core VM, the real host, runtime and surface over
world.js's ground adapter, the ground from DFU's own kernel, Basic Roads on 13 of 49 pixels, 30 walkers and 6 bodies,
the shipped 2 ms budget; the GL in headless Chromium on SwiftShader (relative only).

- **Heat Haze**: 1.4 us a tick and 3.9 us of draw JS (24 GL calls). Its one GPU cost is the viewport's copy, 8.3 MB a
  frame at 1080p, and bounding it to the ring would save nothing: the ring covers 98% of the rows at every pitch.
- **Windfall**: 0.03 ms a frame, 0.10 in a winter storm's 920 particles; one draw, at most 11.4 KB of instances.
- **Sands of the Alik'r** and the snow's packaged ground: 64x64 records, as Daggerfall's own - nothing a frame.
- **Snowfall**: 0.10 ms a frame standing, 0.79 walking, 1.9 on a horse (2.1 in a storm). The middle ring's
  progressive build is most of it: its rebuild every 20 m sampled all 169,090 points again, 88% of them unchanged.
  The draw pass cost 1.18 ms of main-thread GL (1,867 calls for 50 draws), and the frame left 5-100 MB/s of garbage.

The lens prototyped its savings beside the code and proved each changed nothing. The snow's are ported, with the
contact ramp's (P7), the track field's whole buckets (P4) and the pace a rider outran (P8, one of the lens's risks)
beside them - each answering what it answered before:

| ID | Where | Change |
|---|---|---|
| P1 | `renderer.js` `drawSnowBegin` / `drawSnowEnd`, `snowfallSurface.js` `draw` | ONE DRAW PASS: the tiers and the blanket's tiles drawn between the two, the state they share set once - a uniform uploaded when the float GL keeps moves (bit for bit), a snow unit bound when its picture moves, a tier's generic channels when its set does, the layer's offset on once - and handed back at the end as a lone draw leaves it. The surface fills one uniforms object a tier in place (the runtime's `localUniforms` / `midUniforms` / `blanketUniforms` / `depthUniforms` write into `snowUniforms()`), not 52 KB of objects a frame. |
| P2 | `snowfallSurface.js` `sync` | The local window's uploads wait for a frame that draws it (the ring stands over it most of the time): its flags and its rectangle kept, all of it up the frame it stands again. |
| P3 | `snowfallRuntime.js` `_midBegin` / `_midProcess` / `_midCommit`, `SnowContext.sameGround` | THE RING'S REBUILD COPIES THE LAST ONE'S SAMPLES where its points fall on the same place (a vertex's offset is dyadic, so a whole-cell move lands each on the last build's own number; a texel's place is asked bit for bit) of the same tile (a ground rebuilt is a new one) over the same roads and settlements under the same settings, and samples the new strips. Each copy spends the sample budget a sample does, so a build completes on the mod's own frame; the blanket's channels are built beside the committed ones, as the mesh is (5 MB more). A floating origin's move ends the copying; a settings change ends a build's. |
| P4 | `snowfall.js` `applyToMask`, `refill`, `stampMaskPoint` | The track field walked over its slots in the Dictionary's order (no generator, no copy of the keys); a bucket, or a cell, whose every disc lies in the preserved rectangle skipped (its first and last cells' reach, as StampMaskPoint reckons it). |
| P5 | `snowfall.js` `turnX` / `turnY`, `interpolateQuad(out)`; `snowfallRuntime.js` `SnowContext.sample`, `pathTile(out)` | No pair, view or object a sample; the context's global place read once for its three weights. |
| P6 | `snowfallRuntime.js` `_blanketContext`, `SnowCoverage.fullByTile`, `SnowContext.roadOf` | A blanket tile's context off one table of its archive and its own Basic Roads tile, read once (were 16,384 map lookups and a walk of the roads a texel): 3.85 ms a tile to 0.93. |
| P7 | `snowfall.js` `snowContactRamp` | The contact ramp's distance in bytes of its own (the alpha's stride a quarter as dense), a bare pixel left as it stands. |
| P8 | `snowfallRuntime.js` `_cancelForRetarget`, `_processRecenter` | THE PORT'S PACE REFINED: a whole window the player outran goes again at the mod's own pace, its sample counts alone. On a machine that makes fewer samples in the two milliseconds than a ride asks - some 2.5 times slower than the lens's - a rider's window never stood, nor the ring and the blanket, which wait on it. |

**Held.** Three rides on the mod's own sample budgets - a walk, a ride through falling snow, a run through a storm
over a full track field of 65,536 cells - hashed the exact bytes each draw reads (a GL that keeps every buffer's and
texture's content), every draw's uniforms, the runtime's committed arrays and the field: the same as the tree before
on all three. In the suite: P3's ring against a twin that never copies, frame for frame through a rebuilt ground, an
origin's move, a slope limit changed mid-build and a feather changed; P1's per-draw GL state; P2's GPU bytes; P5-P7
against the reads as they were.

**Measured** (the same VM, the tree before and after, the shipped 2 ms budget; ms a frame, the snow's CPU):

| Ride | avg | p99 | frames over 8 ms | scavenges / 1000 frames | uploads |
|---|---|---|---|---|---|
| walk, 4.4 m/s | 0.74 -> 0.38 | 2.79 -> 2.21 | 3 -> 0 in 3,600 | 46 -> 11 | 6.2 -> 4.4 MB/s |
| horse, 13 m/s | 2.07 -> 1.09 | 6.06 -> 4.50 | 7 -> 1 in 3,600 | 103 -> 34 | 11.8 -> 9.1 MB/s |
| run in a storm, a full field | 1.61 -> 0.69 | 13.4 -> 3.7 | 46 -> 0 in 2,400 | 81 -> 19 | 10.3 -> 7.7 MB/s |

What is left a frame is the ring's commit every 20 m (some 4 ms here: the contact ramp of its 321 x 321 statics, its
history's scroll, the bodies' projection) and its 9 MB upload - the mod's own shape, its ring committed whole.

## Examined, not changed

- **The lens's other prototypes**: a mask's changes uploaded as 32 x 32 tiles (1.7 MB/s less walking, a call a tile -
  left with the one rectangle); a normals table for the ground's samples (faster only with the grass off, 400 KB a
  pixel at stride 1 - left); the ring's mesh streamed to the GPU through its build (6.6 MB out of the commit frame -
  not prototyped; the mod commits its ring whole); the haze's copy bounded to rows its rays can reach past the ground
  (an estimate of 20-50% of the copy - not prototyped; the ring's own bound saves nothing).
- **W2: the particles' turbulence.** The lens read the module's damping (on by default) as dividing its strength by
  its frequency (0.35), which would make the port's leaves about 2.9x too calm. Unity's two documents disagree on
  the damping's direction, and the engine's lattice noise and its normalisation cannot be measured here, so the
  strength is not changed on a reading. The scale holds: the port's main sine turns over every 6.3 m, a lattice
  noise at that frequency about every 5.7 m (a bump a 2.9 m cell). The departure stands as written - turbulence of
  the module's scale and pace, not its field.
- **The command's gate** (S6's second half): DFU registers `snow_status` whatever the mod's General.Enabled; here the
  Features row IS that switch and the command is there while the mod is (AUDIT 28 F7's law for every mod).
- **The far mask's mapping** (c - 320, 1/640 over 641 texels) is the mod's own quirk, kept.
- **Sands of the Alik'r**: its precedence over a player's desert pack that sorts earlier is Vanilla Enhanced's rule.
