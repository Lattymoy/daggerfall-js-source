# The Abyss Dungeon, rebuilt: visual spec

STATUS (2026-10-08): the plan of SD-LOOK, Mac's "go all in and make this something special" for the Rift, its portal and
the Hour (decided: keep the lore, rebuild the fidelity; one pull request at the end). Three art directors proposed
(cinematic, Daggerfall-faithful, systems), judges scored each set piece, and this is the synthesis. It is a PLAN: what
shipped of it, and how, is recorded slice by slice in `Super-Dungeons.md` section 16 (SD-LOOK), and that record wins
where the two differ. Mac's three rulings below were taken at their law-safe defaults (the Orrery's rings in mode A, no
safe wedges, the Return where it stands) until Mac says otherwise.

This is the buildable visual spec for the Super Dungeon arc: the Hollow's Rift and Return, the step through, and the Shattered Hour with its set pieces. We decided with Mac to **keep the lore and rebuild the fidelity**. The brass and clockwork of the Warp in the West (3E 417, the Dragon Break, the Numidium's walk) stay. So do the Hour's set pieces and every law they run on (`bible/11-Multiplayer/Super-Dungeons.md` sections 5-11). How they look and feel is rebuilt.

Three proposals were scored: a cinematic one, a Daggerfall-faithful one and a systems one. For each piece this spec takes the strongest approach and grafts the best ideas from the other two. For the fight and the Steps, readability and performance decided. For the Rift and the arrival, spectacle decided. The table shows what came from where.

| Piece | Built on | Grafted from the others | Left out, and why |
|---|---|---|---|
| The Rift | Systems (the iris aperture is the state) | Faithful: an hour-ring that ratchets back on the bell, a crater paved with the hall's own floor, frozen dust. Cinematic: the real Hour sky in the window, the longest-line facing, the reveal beat, the events the hall can see | The lens (it borrows `captureUnderWater`, which belongs to water). Turning shadow casters. The FOV ease |
| The Return | Faithful (the lancet arch, a window home) | Cinematic: time running forward (the keystone clock). Systems: a fade that never holds up the law | Sampling the world host's sky panorama underground. A ghostly shimmer |
| The step through | Cinematic (the Dragon Break on screen) | Systems: the iris centred on the Rift on this screen. Faithful: a pixel canvas at about a quarter of today's cost, the broken quarters on the hand, the shatter when forced | The resolve double image. The camera pitch and FOV settle |
| The way back and the way home | Systems (one astrolabe, one timer on both sides, the hand-plate) | Faithful: an interior-mapped Hollow hall in the window. Cinematic: forward rings, the way home assembling inside the heart's column, a beacon | A night sky in the way back (it leads to a hall, not a sky) |
| The sky | Faithful (a painted map at Daggerfall's own sky density) | Cinematic: the face lowered so the Remnant's head stands at its hub. Systems: the sky's clock tells the Reset and the collapse | The walking Numidium (it contradicts sections 7 and 10). One heavy shader for everything |
| Islands, floors, void | Cinematic's diagnosis (the emissive joints and the eye adaptation cause the murk) | Systems: gold rim lines, a compass, inlay as geometry, toothed rims. Faithful: Daggerfall's street on the Threshold, strata in the undersides, the Works as geometry | Brighter fog. Orbiting debris |
| The Orrery | Faithful (heraldry, frozen banners, crown gears, the atlas) | Cinematic: the six rings and their Concord, in a law-safe default mode. Systems: the bezel's settle glow and ember on refusal, fray tabs | The floor "train" (it prints the gearing). Guttering lanterns |
| The Steps | Faithful (a draw atlas per kind, clock-plate frames, crack stages, the weathervane) | Cinematic and systems: pendulum rods. Cinematic: chunks that rewind. Systems: one ghost pass, the blink fix | GL_LINES ghosts. Camera roll. A blink on every cast-back. Dotted arcs |
| The arena | Cinematic (the contrast rule, the flood at the landing, the Reset on the rim) | Faithful: the Stomp's ring as a wall of light. Systems: the Remnant's mark, the hold curtain | Green braziers. Trenches. Floor gears. A balustrade. A Voronoi crack net |
| The Remnant | Systems (built inside the law's cylinder, a tell for every blow, the heart as metronome, crystal Hearts) | Cinematic: seven rig parts kept, the back-dial halo, the fall. Faithful: the Hour-Hand blade, bell pauldrons, joint gears, vents | New forearm parts. Two after-images. The beam's wake |

---

## The visual language

### The idea

**The Hour is one broken clock, seen at a man's scale, that shows you its state.** The Rift is the escapement torn open in a Daggerfall hall. The islands are pieces of the Bay welded to the Numidium's gears, hanging over the clock's own works, which turn far below and are lit from beneath like a forge. The Orrery is its regulator, the Steps its pendulums and pins, and the Last Moment its face laid flat, with the Remnant standing at the hub and its back-dial worn like a halo.

Today's frames are amber soup. The lane's eye adaptation (`AIR_ADAPT_KEY` 0.18, `AIR_ADAPT_MAX` 1.8) lifts the void to grey-brown. Every floor joint glows (`realmFloorArt` joints at 0.18 emission), and so do the root veins (0.35) and the arena's crack net (0.8 Mantella). When everything glows, nothing reads. The rebuild has four rules:

- The void is black.
- Metal and stone are structure, and they do not glow.
- Light appears only where it means something, and what it means is one of five things.
- Every surface reads as Daggerfall pixel art.

### Palette

Textures are painted in code through these ramps (sRGB 0-255). Every material ramp has at least five steps, so modern light does not flatten it.

| Ramp | Steps (dark to light) | Where |
|---|---|---|
| **Void** | `[5,4,3]` `[12,9,6]` `[24,17,10]` haze `[51,38,18]` (= `SD_REALM_FOG.color`) haze-hot `[92,60,24]` | The sky, the deep, the furnace at the nadir. Nothing darker than `[5,4,3]`, so cheap panels do not crush it to black |
| **Basalt** | `[14,12,12]` `[22,20,19]` `[34,30,28]` (= `SD_STONE`) `[50,45,41]` `[70,63,56]` | Island rock, flags, the stones' shafts, pillars |
| **Cobble** (the Bay's street) | `[52,48,44]` `[74,68,60]` `[98,90,78]` `[124,114,98]` | The Threshold only: the street the Hollow swallowed |
| **Brass** | deep `[48,30,12]` dark `[88,58,22]` body `[140,98,40]` `[196,146,64]` (= `SD_BRASS`) rubbed `[228,184,100]` bright `[246,206,120]` (= `SD_BRASS_BRIGHT`) | The works: rims, inlay, the Rift, the Remnant |
| **Verdigris** | `[36,56,46]` `[58,88,70]` `[88,124,98]` | Only in brass recesses and seams |
| **Bronze** | `[40,28,16]` `[62,44,24]` `[86,62,34]` `[112,84,48]` | The arena's plates |
| **Silver** | `[64,68,74]` `[106,112,120]` `[160,166,176]` `[214,220,228]` | The Return's bands, the Silver Echo |
| **Pale stone** | `[120,116,108]` `[150,146,138]` `[182,178,170]` | The Return's arch |
| **Bay sky** | day `[92,140,210]` to `[150,190,235]`; dusk `[210,120,60]` to `[90,60,110]`; night `[14,20,44]` | Only inside the windows home. It is the only blue in the Hour |

### Light: five meanings, and no others

Emission and point-light colours are linear RGB, as the renderer takes them. **Every one reuses a constant that already exists**, so no pinned value moves: `world/sdLook.js` imports these constants rather than re-pointing them.

| Light | Colour (existing constant) | Means | Examples |
|---|---|---|---|
| **GOLD** | `SD_LAMP_COLOR [1.0,0.78,0.4]` / `SD_FX_COLOR.brass` | The machine is live. On something you stand on, it holds. In a telegraph's shape on the floor, the brass is coming | An open Rift, lamps, a solid Beat plate, the bridge, your cast-back waystone, the Remnant's own blows |
| **MANTELLA** | `SD_FX_COLOR.mantella [0.45,1.0,0.6]` | The Hour's soul: what the fight turns on | The heart, the Hearts, the Pulse, the dial's count, the Orrery's gem |
| **EMBER** | `SD_GLOW_COLORS.fray [255,96,40]` | About to fail | A Beat plate's last 0.4 s, a shaking Crumble, fray tabs, the collapse's studs, the Reset's last two numerals |
| **MOON** | `SD_FX_COLOR.pale [0.85,0.9,1.0]` | The way out, and only the way out | The Return, the way back's light, the way home |
| **RED** | `SD_FX_COLOR.end [1.0,0.32,0.26]` | Refused, or the End | Refused for good, the End's fissures, the face cracking |
| *white-gold* (the moment) | `SD_BEAM_CORE [1.0,0.92,0.62]` | A beat lands | The Concord, the fall's flash, the Reset's white heart |

**Never by hue alone.** SD18c lends the Ending's light (`net/sdMarks.js` `SD_ENDINGS[].light`) to the soul family on the heart, the Hearts (`sdHeartColorOf`) and the eyes, and to nothing else. Daggerfall's Ending light `[0.75,0.82,1.0]` is nearly MOON, and Orsinium's `[0.62,1.0,0.3]` is nearly MANTELLA. So every meaning is also carried by **shape, place and motion**:

- The ways out are pointed arches or rings with a sky or hall in them, and they stand still or run forward.
- Soul light lives in crystal.
- Telegraphs keep their pinned shapes, colours and grains (`SD_BLOW_COLOR`, `SD_ELEMENT_COLOR`, `TELEGRAPH_STYLE`).

The lab's grayscale check (`?grey`) must still separate every pair.

### The value ladder

Display luminance, measured in the lab on both lanes.

| Rung | Luminance | What |
|---|---|---|
| L0 void | at or under 0.04 at the zenith; haze band at or under 0.18 | The sky and the deep |
| L1 structure | 0.06-0.25 | Lit stone and metal. **The arena floor stays at or under 0.25 under every light it ever gets** |
| L2 ambient light | 0.25-0.45 | Inlay threads, rim lines, lantern cages, the Rift's lip at rest |
| L3 signals | 0.5-0.8 | An open Rift's window, a solid Beat dial, a lit count, the windows home |
| L4 critical | at least 0.7, peaking at or above 0.85 (`AIR_BRIGHT_THRESHOLD`) | Telegraph cores, the beam, the Hearts, a body tell at its hottest |

Only L3 and L4 may bloom. Nothing on L1 or L2 exceeds 0.5.

### Materials

- **Metal is structure.** Brass, bronze and silver are lit by the lamps and the trilight. Emission is at most 0.04, and only on worn edges, so silhouettes hold on the classic set. Today `realmBrassArt` emits 0.12 of its whole colour.
- **Stone is matte and dark.** Contrast lives in the features (flags, courses, chamfers), not in noise at the scale of one texel.
- **Cloth (the banners) is matte and never emissive.** Its colours stay below the light hues' saturation.
- **Crystal** (the heart, the Hearts, the gem) is self-lit in soul light.
- **Hard light** (membranes, the bridge, ghosts, floor light) is drawn by a shader under the pixel law below.

### Motion

1. **The escapement.** The machine ticks on the realm's anchored second, eased over the first quarter-second and then held. This is the Turning Hour aura's law (`render/auraRing.js` `turningWheelAngle`, `TURNING_STEP_S`), exported once and reused as `sdTick(t)`. It stays in step with the tick and tock in `scenes/sdAir.js`. The Rift's gear, the Orrery's decor turns, the sky's second hand, the back-dial and the chains all tick together.
2. **Smooth motion is danger.** Wind-ups, the beam, the gust's streaks, a falling step and the Remnant's limbs move smoothly, so a threat stands out against the ticking world.
3. **Time runs backwards inside the Hour and forwards on every way out.** Inside, every hand runs anticlockwise as the eye sees it, so a countdown's hand runs *back* to twelve. On the Return, the way back, the way home and the collapse, hands run forward. Check every direction through the camera's one mirror (`world/mat4.js`), as `turningWheelAngle` and `turningDialAngle` are pinned.
4. **Dither, never fade.** Things appear and vanish through an ordered screen-door (`renderer.setDissolve`, SHIP-FADE's Bayer cut) over 0.15-0.8 s.
5. **What the Hour breaks, it rewinds.** Crumbled pins fly back up, and the snap spins the rings back.
6. **The flash ceiling is 3 Hz** (`TELEGRAPH_THROB_MAX_HZ`). Heartbeats stay at or under 2.5 Hz. Today `SD_BEAT_BLINK_HZ` = 8 breaks the project's own law, and slice S0 fixes it.

### The shared vocabulary of states

| State | How it shows | Where |
|---|---|---|
| Live, holds, yours | Gold light on it, and it ticks | An open Rift, a solid Beat plate, the bridge, your waystone |
| Soul: strike it, or it answers you | Mantella (or the Ending's light) in crystal | The heart, the Hearts, the gem, the dial's segments, the Pulse |
| About to fail | Ember, plus one or two falters at 2.5 Hz or less | The Beat's last frames, the Crumble's cracks, fray tabs, the collapse's studs |
| Gone, will return | A 2-px gold ghost outline, its hand still running | Beat plates, your Crumble pins |
| Time left | A hand going to twelve (backwards inside, forwards out) | Beat plates, the Rift's studs, the back-dial (Echo window, stun), the Reset on the rim and in the sky, the collapse in the sky |
| Count | Lamps lit from the bottom: how many, never which | The dial's segments, the gem, the rib lamps, the Rift's studs |
| The way out | Moon light, still or running forward, with a sky or hall in it | The Return, the way back, the way home |
| Closed, cold | Brass with no light, still | A closed Rift |
| Refused, or the End | Red | Refused for good, the Hour Ends |

### The pixel law

- **Textures** are painted in code by the new `world/sdPixelKit.js`, using the ramps above:
  - 1-px bevels (light top-left, shadow bottom-right), dark outlines, 3x3 rivets.
  - Ordered dither between ramp steps; wear scratches.
  - A final `quantize()` that forces every texel into the palette.
  - Emission derived from ramp entries flagged as glowing.
  - Density: about 32 texels a metre on floors and big surfaces (64 px per 2 m), and 64-128 px atlases for models. Painted at 2x under Vanilla Enhanced (`systems/vanillaEnhanced.js` `veWorn`), so the Hour matches the Hollow the player just left.
  - Sampling is NEAREST. **The renderer caps `TEXTURE_MAX_LEVEL` at 0 outside Retro Mode, so there are no mips.** Contrast at the scale of one texel stays low, and the read lives in features 4-8 texels wide, or the floors shimmer.
- **Shader surfaces** (the sky map, the membranes, the veil, floor light, ghosts, halos) go through a new `SD_PIXEL_GLSL` beside `BAYER_GLSL` in `render/orderedDither.js`:
  - Bayer offset, then posterize luminance to N steps (10 on the lane, 8 on classic).
  - The surface coordinate snapped to a texel grid about the size of the nearest wall's texel.
  - Under Retro Mode it snaps to the retro image's own pixels instead, so nothing goes double-chunky.

### The shared kit (code every piece uses)

1. **`world/sdLook.js`** (new, pure). The palette ramps, the five lights (imported from their existing homes), `sdTick(t)` (the escapement, from `auraRing.js`, one export) and `handToTwelve(remaining, total)`. The helpers copied today across `sdRealmArt`, `sdHallArt`, `sdStepsArt` and `sdRemnantArt` (image, put, mix, rng, noiseField) move into `world/sdPixelKit.js`.
2. **The dungeon arm's dynamic loop** (`scenes/worldModes.js`). Today it reads `for (const d of dungeonCtx.dynamicDraws) if (!d.hidden) renderer.drawMesh(d.gpu, d.object.matrix, dungeonCtx.texRemap)`. It learns five optional fields, each read only when present, so no other host pays:
   - `d.texRemap ?? dungeonCtx.texRemap`: state frames by swapping records, with no new shader.
   - `d.dissolve`: `setDissolve` around the draw, back to 1 after the loop. The shadow record already takes the share.
   - `d.noShadow`: `drawMesh`'s own option. It skips `_shadows.recordMesh`, so a part that turns never rebuilds a cube.
   - `d.shadowOnly`: a new `drawMesh` option that records the shadow without the colour draw (a few lines in `_drawMeshBundle`). It is for cheap proxies.
   - `d.culled`: the stage cull below. It is separate from `d.hidden`, which stays the law's (gone steps, hidden bodies).
3. **The stage cull.** Every realm draw is tagged `threshold`, `orrery`, `steps` or `arena`. The static realm mesh is split per stage. Once a frame, each stage's bounding sphere is tested against `render/frustum.js` `frustumPlanes`. The sphere is the stage's radius plus 12 m (a lamp's range) plus 6 m. The stage holding the eye is never culled. A culled stage sets `d.culled` on its draws. Today the arm issues about 110 realm mesh draws wherever you stand; inside one stage that drops to 30-60.
4. **`renderer.setSceneGrade({ adaptKey, adaptMax, bloom, vignette, contrast })`.** It writes `AirPass.adaptParams[1..3]` and `AirPass.grade` for the frame, and every frame that does not call it gets the defaults back (`AIR_ADAPT_KEY` 0.18 and `AIR_ADAPT_MAX` 1.8; `AIR_BLOOM_STRENGTH` 0.6, `AIR_VIGNETTE` 0.28, `AIR_CONTRAST` 1.04). **The Hour uses key 0.12, max 1.15, bloom 0.8, vignette 0.34, contrast 1.08.** It does nothing on classic. The Hollow keeps the defaults: it is a Daggerfall dungeon.
5. **`render/sdHalo.js`** (new foreign pass). Up to 64 camera-facing additive quads in one dynamic VBO (8 KB a frame), with the falloff posterized to 4 steps, depth-tested, no depth write, fogged by `FOG_FACTOR_GLSL`. It is the classic set's bloom for lantern cores, the Rift's core, the way-out lights, the Remnant's eyes, heart and blade tip. Gain is 1.0 on classic and 0.5 on the lane, so bloom does not double it.
6. **The lite tier.** One flag, `ui/touchDevice.js` `isTouchDevice` (or a low GPU tier), read by every piece's phone column.
7. **The lab** (`src/tools/abyssLab.js`). It gains state knobs for every read:
   - `?rift=open|notyet|collapse|closed|refused`, `&left=`, `?riftSize=`
   - `?fight=wake|stomp|hand|volley|pulse|break|reset|stun|end|fell|held`, `&wt=` (wind-up share), `&pt=`, `&rt=`, `&st=`, `&age=`
   - `?collapse=<s>`, `?veil=in|back|home|cast&vt=`, `?hour=`, `?lit=&fray=&concord=`, `?crumble=`, `?grey`, `?law` (draws the law's cylinders and boxes as wire)
   
   It also gains the views named in each piece. Probes frame-sync on `window.__frame` (bible/Home.md Process). Every slice's pull request carries before and after sheets for both `?lane=on` and `?lane=off`.

**The whole bill.** Draw-call counts are for the desktop lane. "Today" is about 104 realm mesh draws issued everywhere (realm 6, hall 22, steps 67, Remnant 9) plus the passes.

| Frame | Today | After |
|---|---|---|
| Threshold, on arrival | ~140 | ~35 (Threshold stage, way back, sky, shards, Works, halo, motes), ~66 with the Orrery ahead in view |
| Arena, Dragon Break | ~160 | ~112, or ~150 if the Steps are in view behind |
| Arena, Reset with eight Hearts | ~150 | ~95 |
| Hollow, at the Rift | 1 billboard batch | 9 mesh + 2 pass + 1 motes + 1 halo |

**Lights:** no net growth anywhere. The arena keeps 8 (4 rim lamps, 4 pillar lanterns) plus the heart. The Orrery goes from 8 to 4 lamps plus the gem.

**New textures:** about 4.8 MB on desktop with Classic textures. That is the sky map at 1 MB, the Remnant at about 1.5 MB, and the rest at 64-256 px. About 1.2 MB is retired: the Rift and Return frames (0.7 MB) and the 256-px dial (0.5 MB). Phones carry about 2.5 MB.

**Painting:** about 40-80 ms of one-time CPU, spread over idle frames at the Hollow's stand and the realm's stand, never in one frame on a phone.

**Added CPU a frame:** under 0.3 ms in all.

---

## 1. The Rift (in the Hollow)

### What the player sees

**Before.** A Hollow has no fires (section 5: the Hour is cold), so the Rift is the only warm light in it. You first see gold on the stone down the last corridor, with brass motes drifting along with you toward the end, and the bell heard under water.

**The reveal.** The first time you have a clear line of sight, the bell tolls once a fourth higher (`tollRiftBell`) and the window brightens for 0.6 s. This happens once a visit.

**The thing itself.** A brass astrolabe stands upright on its edge, as tall as its hall allows (2.6-7 m, `sdRiftFit`), with **its face square to the hall's long line**, so the walk down the hall meets it face-on. From the foot up:

- **The crater.** The hall's own flagstones are heaved up and split around its foot: 12 tilted slabs wearing the dungeon's own floor texture, the splits filled with brass like a mended pot.
- **The plinth and claws.** An octagonal cogged plinth sits in the crater. Two brass claws, like broken clock-hands, grip the ring's lower rim, and the ring hovers a hand's breadth off the floor.
- **The outer gear.** 36 square-cut teeth, ticking **one tooth forward each second** on the escapement.
- **The hour-ring inside it.** Twelve bevelled brass blocks, each embossed with a Roman numeral, held a few centimetres apart so light leaks through the gaps, with two studs on each block's face (24 in all). Each time the bell tolls (`RIFT_BELL_SECONDS` 6.5) it **ratchets one hour backwards**: a 0.25 s jolt with a small overshoot and settle, and a 15% pulse of its light. The two rings disagree, and that disagreement is the Warp.
- **Three broken segments** of ring orbit the rim on tilted paths, tumbling slowly.
- **The iris.** Eight heavy riveted brass leaves, engraved with minute ticks, close from the hour-ring's inner lip. **Their aperture is the Rift's state.**
- **The window.** Through the open iris you see the Shattered Hour's own sky: the same painted sky the Hour draws (piece 5), sampled along your own view ray. It has true parallax, so stepping left shows more of the right. You see the clock-face of stars with its hands turning backwards, the brass aurorae, and a city hanging upside down. It is drawn in chunky pixels about the size of the wall's texels. Gold filaments drag inward from the rim in a slow spiral and meet the brass at a white-gold lip.
- **The core.** A soft gold glow at the centre, which still reads when you see the ring edge-on from a side passage.
- **The floor.** Brass light seeps from the crater across the flagstones in twelve hour ticks and six cracks that stop at the walls, pulsing outward on each toll. Across them turn the gear's 36 tooth-shadows as spokes, so the whole hall sees the gear turn.
- **Stopped time.** Within 4 m, dust hangs perfectly still and does not move as you walk through it. Farther out, motes drift in and stream into the window.

**Its states**, readable from 30 m with no plaque. The words on the plaque and the refusals stay exactly as they are.

| State | When (the law as it stands) | The look |
|---|---|---|
| **Open** | Found, or in the collapse to someone who went through | Iris wide. Gear ticking once a second, hour-ring ratcheting on the bell, full gold light. Studs show the hours left (all 24 lit when more than a day remains) |
| **Not yet** | Risen, or the record not yet heard | Iris shut to a six-point pinhole of sky. Rings still. A thin gold seam breathing between the leaves. Light at 30% |
| **Collapsing** | The 3:00 after the kill | Studs go ember one by one, one every 7.5 s, and the gear ticks twice a second. For someone who entered, the iris narrows from wide to a third as time runs out. For a newcomer it is shut, with ember along the seams |
| **Closed** | Gone, or another slot | Leaves shut, cold brass (the cold record), no light, no bell |
| **Refused for good** | Died in its Hour (SD-ONELIFE) | Shut, with a dull red crack across the leaves and red light at 30% |

**What the hall sees happen.**

- **A refused press:** the ring jerks back one tooth with a clunk (clip 433) and the window clouds to ember for a second.
- **A step through** (yours, or a peer's): the teeth flare, a shock ring runs across the floor light, and the window ripples inward from the point of entry.

### How it is built

**Facing (law: deterministic and pinned).** Today `sdRiftPlace` answers `{ at, size }` and `fitAt` throws away the eight chest-height rays it casts. They are kept. The new `sdRiftFace(at, rays, probe)` in `world/sdDungeon.js` works like this:

- For each opposite pair (k, k+4), sum the two rays, counting a miss as `SD_RIFT_PROBE_M`. The face normal lies along the longest pair, which is the hall's long line. The first pair wins a tie.
- Then cast 4 rays along the ring's own plane at half its height. If one falls short of `size/2 + SD_RIFT_AIR_M`, take the next pair. This guards against pillars, which the chest rays do not see.
- `sdRiftPlace` answers `{ at, size, face }`.
- `sdRiftFit`'s width is already twice the *nearest* wall, so a ring of that size fits at any facing. AUDIT SD IV F36: its height is the ring's top's (`SD_RIFT_TOP` - it hovers), and the size is then swept by the disc in its face's plane (`sdRiftSweep`), so a ceiling beside the axis (a raised bay, a shaft) or a beam across the plane shrinks it.
- `inSdPortal` (the cylinder) is untouched, so the walk-in does not move. The press turns with the ring (AUDIT SD IV F33, `scenes/sdEnd.js` `riftPress`): a box in its own frame, its gear's span across, foot to top, `SD_RIFT_PRESS_M` (0.35 m) either side of its plane, with no surface in the collider. The axis-aligned cube of its whole sweep (half its size every way) took the presses at the bodies and the floor before it.

**The Return's place.** `sdReturnPlace(rift, probe)` orders its bearings by `|dot(dir, face)|`, ascending, ties by index. It stands the Return beside the ring in its plane, never in front of the face. Pin it over the templates `test/sd11f_scenes.test.js` already loads.

**Geometry.** `world/sdRiftModel.js` (new, pure, unit size, `faces()` and `packRealmFaces`):

| Builder | Parts | Triangles |
|---|---|---|
| `buildRiftStatic` | Crater (12 slabs), brass seams, plinth with 16 teeth, two claws (3-segment tapered sweeps) | ~500 |
| `buildRiftGear` | Band and 36 teeth | ~450 |
| `buildHourRing` | 12 blocks, numerals in atlas cells | ~260 |
| `buildRiftStuds(lit, tone)` | Rebuilt only on change, at most every 7.5 s (`scenes/sdHall.js` `setLit`'s pattern) | ~100 |
| `buildIris(aperture)` | One mesh. Its vertices are rewritten through `renderer.updateMeshVertices` only while the aperture eases (0.6 s per state change); static otherwise | ~160 |
| `buildRiftShard(k)` | x3 | ~40 each |

About 1.6k triangles in all.

**The crater's texture.** At stand, take the most-used up-facing sub-mesh texture among the end block's models: the player's own ARENA2, Classic or Vanilla Enhanced as worn. Fall back to the realm's cobble record when it is absent or evicted (PLACE-LRU). Ask again at every stand; never keep it across an eviction.

**Art.** `world/sdRiftArt.js` (new), painted through the kit:

- A 128x128 atlas: twelve 32-px numeral faces, block sides, tooth faces, plinth, claw, the Return's pale stone and silver cells.
- Its emission: the numerals' inner bevel, the gap lips and the studs.
- Three state records: **lit**, **cold** and **red-cracked**. They are swapped per draw through `d.texRemap`, with no shader change.

**Animation** (`scenes/sdEnd.js`). `stand()` takes the dungeon's `dynamicDraws`, as `sdRemnant.stand({ dynamicDraws })` does, and **retires the billboards**: `riftFrame`, `RIFT_FRAMES` and their 16 uploads. Each frame, on the anchored relay clock (world.js `deadlandsSeconds`' anchoring), so every screen ticks together:

- Gear: `base(at, face) · rotZ(sdTick(t) · 2π/36 · rate)`, forward, clockwise on screen.
- Hour-ring: `-floor(t / 6.5) · 30°`, plus an eased 0.25 s jolt with overshoot. `startRiftBell` starts the loop at that clock's phase, so the toll and the jolt land together.
- Shards: orbit and tumble matrices.

**State.** `riftLook(word, phase, entered, fallen, count, now)` is pure, in `world/sdDungeon.js`. It reads only what the page already holds (`sdRiftWord`, `sdPhase`, entered, fallen, `sdRiftCount`) and returns `{ aperture, tickHz, studs, studTone, tone, light }`. `sdEnd` eases the aperture over 0.6 s whenever it changes.

**The portal pass.** `render/sdRiftPass.js` (new) follows the gate membrane's law (`render/gatePass.js`): premultiplied `ONE, ONE_MINUS_SRC_ALPHA`, depth-tested, no depth write, fogged, both faces, every rate a whole number of cycles over its wrapped clock. It has two draws:

- **(a) The window.** A 48-triangle fan at 0.86 of the radius, 1 cm behind the leaves' plane. In the fragment:
  1. Snap the disc's uv to a 128-cell grid.
  2. Ray = `normalize(snapped world point − eye)`, turned by the face's yaw so that looking straight in looks toward the realm's +z, where the clock is.
  3. One NEAREST tap of the Hour's sky map (`render/sdSkyMap.js`, piece 5), plus the live hands (`SD_SKY_FETCH_GLSL`).
  4. Inward flow: 3 octaves of the veil's `pn` in log-polar, at r > 0.55.
  5. The lip, at r 0.96-1.0.
  6. The aperture mask: the iris's own law in polar form, so the leaves and the window always agree.
  7. Refusal ember and the entry ripple (a point and an amplitude) as uniforms.
  8. `SD_PIXEL_GLSL`.
- **(b) The floor light.** A flat disc at `foot.y + 0.02`, additive:
  - Its edge is 8 per-bearing radii: the probe's clear distance at 0.3 m, from 8 rays cast once at stand. It shrinks in 0.5 m steps until 16 floor samples sit within 3 cm of the foot, so it never floats over a stair.
  - Hour ticks and six crack rays drawn as distance fields.
  - **36 tooth spokes turned with the gear**: a gobo drawn on the floor, not a shadow.
  - Pulsed outward on each toll.

The core is one quad in `render/sdHalo.js`.

**The sky map in the Hollow.** When `sdEnd` stands a Rift in a Super Hollow, `render/sdSkyMap.js` paints the Hour's map over idle frames, one quadrant a frame after the level's own warm. It refreshes one quadrant every 4 frames, and only while the window's bounding sphere is on screen. **The same texture is handed to the realm at the step**, so the Hour's sky is already painted when you arrive. `sdSkyMap` owns it and frees it when the player leaves both the Hollow and the Hour (EVERY ALLOCATION HAS AN OWNER).

**Light.**

- One point light, 0.55 of the size in front of the face, range 3 times the size (8-21 m, so it spills down the approach).
- Colour by state: gold, ember, red at 30%, or none. Plus 15%, eased, on each toll.
- It enters the light list through a new `sdEnd.lights()` in `dungeonContext.js`'s mode lights.
- **Casting.** The dungeon arm calls `everyLightCasts()`, so every light keeps a cube. Only the static draw (crater, plinth, claws) casts. It never moves, so SC1's cache builds it once. The gear, hour-ring, iris, studs and shards are `noShadow`, so nothing that turns rebuilds a cube every frame.

**Motes.** `render/sdMotes.js` gains kinds with an origin (`SD_MOTE_*` are realm-only today). The rift kind is 48 frozen specks within 4 m (no velocity) plus 72 inflowing on a sphere of 3 times the size, spiralling into the window and dying at it. One draw.

**The reveal.** One collider ray, eye to ring centre, every 250 ms until it fires, once a visit.

**The peer flare.** It fires when a peer whose last pose stood inside `inSdPortal`'s cylinder leaves the room within 1.5 s (`SD_FX_LATE_MS`). It is decor: a false one costs a sparkle and nothing else.

**The hook.** The `worldModes.js` dungeon arm calls `host.drawSdRift?.({ proj, view, eye })` after the flats when the dungeon is a Hollow, then `markForeignPass()`. Four hosts: `dungeonContext.js` and `worldModes.js` are wired; `exterior.js`, `world.js`'s exterior arm and the interior arm are flagged by name (there is no Rift there).

### Files and new modules

| New | Changed |
|---|---|
| `world/sdRiftModel.js` | `src/scenes/sdEnd.js` (stand into `dynamicDraws`; retire `riftFrame` and the billboards; `lights()`; `pulse(kind)`; read `riftLook`) |
| `world/sdRiftArt.js` | `src/world/sdDungeon.js` (`sdRiftFace`, `face` in `sdRiftPlace`, `sdReturnPlace` by face, `riftLook`) |
| `render/sdRiftPass.js` | `src/render/sdMotes.js` (kinds with an origin), `src/scenes/dungeonContext.js`, `src/scenes/worldModes.js` (`drawSdRift`), `src/scenes/world.js` (pass construction), `test/sd4b_rift.test.js` (`riftFrame` pins retired, new ones written) |
| `render/sdSkyMap.js` (piece 5) | `src/tools/abyssLab.js` |

### Cost

- **Draws:** 9 mesh draws (static as 2 sub-meshes, the floor record and the brass atlas; gear, hour-ring, studs, iris, 3 shards), 2 pass draws, 1 motes draw and 1 halo quad. About 1.6k triangles.
- **Lights:** 1, out of 16 on classic or 48 on the lane. The Hollow has no fires, so the list has room.
- **Textures:** the atlas at 128x128 x 3 records x 2 (about 384 KB). It retires 16 frames x 96x96 x 2 (about 590 KB). The sky map is shared with the Hour.
- **Fragment:** inside the disc only, one texture tap, the hands and 3 octaves of noise.
- **CPU:** about 6 matrices, one `riftLook` and a ray every 250 ms until the reveal: under 0.05 ms.

### Enhanced lane and classic set

- **Lane.** The claws' and plinth's shadows fall on the walls from the Rift's own light. In Better Ambience's fog the light gets its volumetric halo. The lip, the studs and the core peak at L3-L4 and bloom.
- **Classic.** The same pass and the same emission maps; the pass draws in display values on both lanes. The halo quad stands in for bloom. No shadows; 1 of 16 slots.

### Phones

- The sky map refreshes one quadrant every 8 frames; the window grid is 96 cells.
- 60 motes; no floor spokes (the hour ticks and cracks only).
- The light does not cast.

### Lab check (`abyss.html`)

| View | What must be true |
|---|---|
| `hollow` | The face is square to the room's long line. **Parallax:** shots at `&x=-0.5` and `&x=0.5` show different parts of the sky in the window (a probe compares columns). At `?t=N` and `?t=N+1` the window's second hand steps back one tick |
| `hollow-far` (30 m down a corridor) | `?rift=open`, `notyet`, `collapse&left=0.5`, `closed` and `refused` are told apart without a plaque, on both lanes and under `?grey` |
| `hollow-side` (60° off the face) | The claws, plinth and core carry the silhouette |
| `?riftSize=2.6` in a cramped room | No claw, slab or shard pokes through a wall, and the floor light stops at the walls |

---

## 2. The Return

### What the player sees

Beside the gold ring stands the one cold thing in the hall: a narrow **pointed lancet arch**, 1.3 x 2.3 m (`SD_RETURN_SIZE`). It is the shape of the Bay's own dungeon doorways, cut from pale stone banded with tarnished silver. On its keystone is a small silver clock face whose single hand **ticks forward once a second**: here, time runs on.

Its window looks home: **the Bay's sky at this hour of the world**.

- **By day:** blue, with slow pixel clouds.
- **At dusk:** banded orange to violet.
- **At night:** deep blue, crisp stars, red Masser and pale Secunda.

Along its sill stands the silhouette of the city the Hollow rose by, right way up, with a few warm windows.

Its cool silver light makes a second, colder pool on the floor beside the Rift's gold, so you read two colours and two directions before either plaque. A few silver motes rise from its sill. Gold, round, large and turning against silver, pointed, small and still: it never relies on hue.

**Going out** (the boss falls): the window clouds over from the top in a dither over 1.5 s and the silver light dies. Then the arch sinks into the floor over 1 s in a puff of grey grit. Its press target drops at once.

### How it is built

- **Model.** `world/sdRiftModel.js` `buildReturnModel()`: two jambs, the lancet in 8 segments a side, a sill, silver bands and the keystone dial, about 180 triangles. One static draw on the Rift atlas's pale stone and silver cells. The keystone hand is a second draw of 8 triangles, `rotZ` stepping forward on the escapement in real seconds (decor). It faces the Rift's face and stands where the new `sdReturnPlace` puts it, beside the ring.
- **The window.** `sdRiftPass` mode `bay`. **No world panorama is sampled**: underground, the world host's ARENA2 sky may not be built or ticking.
  - The sky comes from **the game clock**, the hour the world host's sky reads, not the realm's anchored clock: a day, dusk or night ramp by hour, posterized and dithered.
  - Clouds are two sheets of value noise snapped to the window's grid.
  - At night: the star hash plus Masser `[0.85,0.3,0.25]` (0.07 rad) and Secunda `[0.85,0.86,0.9]` (0.04 rad) at fixed directions.
  - The skyline is the sky's own skyline GLSL, exported from `render/sdSky.js` as `SD_SKYLINE_GLSL` and drawn right way up. The city is chosen by the Hollow's region: Daggerfall's towers, Sentinel's domes, Wayrest's bridge, or a generic Bay town.
  - `uFade` drives the going out.
- **Light.** Moon light `[0.85,0.9,1.0]` x 0.6, range 4.5, on both lanes. Motes: 16 rising, in the Rift's mote draw.
- **Going out.** `returnOut()` sets `outAt`, and `targets()` drops the key at once, so the law is never delayed. `uFade` runs 0 to 1 over 1.5 s with the light. Then a 1 s translate down: the floor's depth hides what has sunk, with no clip plane. A `gateFx` grit burst, then the draws are freed. `clear()` frees at once, even mid-animation.
- **Retires** the 12 `returnFrame` uploads (`RETURN_FRAMES`, `RETURN_TEX`).

### Files and new modules

- `world/sdRiftModel.js`, `world/sdRiftArt.js`, `render/sdRiftPass.js` (mode `bay`)
- `src/scenes/sdEnd.js`, `src/world/sdDungeon.js` (`sdReturnPlace`)
- `src/render/sdSky.js` (export `SD_SKYLINE_GLSL`), `src/scenes/dungeonContext.js` (region to city)

### Cost

- 2 mesh draws (the arch and the hand), 1 pass draw, 1 light.
- No new textures (atlas cells). It retires about 123 KB.
- CPU: one matrix.

### Enhanced lane and classic set

- **Lane:** the window peaks at L3 (0.6-0.7) and blooms softly.
- **Classic:** the same pass and emission, with a halo quad at the keystone.

### Phones

One cloud sheet; skyline without windows.

### Lab check

- `hollow`: the Return stands beside the ring's plane, never in front of the face.
- `?hour=12`, `?hour=19` and `?hour=0` show day, dusk and night.
- `?rift=fallen` plays the going out: the target drops at its start.
- `?riftSize=2.6`: the arch and the Rift are still told apart, including under `?grey`.

---

## 3. The step through (the veil, both ways)

### What the player sees

**Into the Hour** (the existing law: close 1.2 s, held, open 1.7 s):

1. **The pull (0-0.3 s).** The Rift's ring ticks three times fast and its light swells (`sdEnd.pulse('pull')`). The camera does not move.
2. **The iris closes (to 1.2 s).** Twelve heavy brass blades sweep in from the screen's edges, **pivoting on the point where the Rift stood on your screen**, closing like the Rift's own iris. Each is engraved with minute ticks, with a rivet at its pivot and gold light along its leading edge, and gold pours through the gaps between them. A ratchet click (clip 433) sounds at each third of the close. The blades turn at most 0.3 of a turn.
3. **Shut.** The closed iris is a dial. Its twelve seams are the hours, with chunky Roman numerals. A spade hand at XII sweeps **backwards**. As it passes IX, VI, III and XII the **broken quarters** strike. On the fourth, the tritone, comes **the Dragon Break**: the hand splits into six gold and silver ghost pairs turning at slightly different speeds, and a crack runs across the face. If the hold runs long (up to the 20 s cap, `VEIL_HOLD_MAX_S`), after 3 s the hands slow to one turn in 6 s, so the stillness looks deliberate.
4. **The opening (1.7 s).** The face breaks along its cracks into shards that fall outward while the blades spin back off the screen, shedding gold flakes. Beneath is the Threshold. Its lamps flare once, and the way back behind you exhales (piece 4). **The Hour's music begins as the veil opens**: `sdScore` waits for it, so its own quarters never stack on the veil's.

**Out by the way back or the Return** (`hourBack`): the same iris in silver, the face already cracked, its hand running **forward** and slowing. It opens on stone. Nothing is mended.

**Out by the way home** (`hourHome`): silver, the hand running forward, and **the crack mends** as the mended quarters strike in C major. The face turns white-gold before it opens on the street. This is the victory beat.

**Forced** (death in the Hour, cast out, the collapse: `flash`): the whole face appears at once, cracked red, then **shatters** into about 40 pieces that spin and fall away under gravity, revealing where you land. You know at once that you did not choose it.

**Reduced motion** (`prefers-reduced-motion`, as `ui/windowMotion.js` reads it): no spin and no shatter. The face holds still and a Bayer dither wipes it.

**Steps cast-back:** no veil, unchanged. A gold rewind burst (an `sdFx` kind with sparks converging) plays where you land, with the existing words.

### How it is built

- **Program.** `render/sdVeil.js` is a new program, chosen by theme inside `render/gateVeil.js`'s `GateVeilRenderer`, built lazily and also in `warm()`'s idle build. **The fire program and its pins are untouched.** The existing `brass` theme stays as the fallback if the new program fails to build.
- **Timing.** `veilAt` is reused as is:
  - The aperture comes from the front: `open = (front − VEIL_FRONT_IN) / (VEIL_FRONT_OUT − VEIL_FRONT_IN)`.
  - `cover` is the closure; `heat` is the hand's speed.
  - A cover asked while the veil is opening starts from the current angle (the existing "from where it stands" law).
- **Uniforms:** `uCentre` (screen radii), `uTint`, `uMode` (in, back, home, cast), `uTime`, `uMend`, `uShatter`, `uReduce`.
- **Per pixel:**
  1. Snap `gl_FragCoord` to the veil pixel and take polar coordinates about `uCentre`.
  2. Twelve blade half-plane tests. The topmost covering blade shades the pixel: band shading by distance along it, ticks by `fract()`, edge light within 2 veil pixels of its leading edge.
  3. Inside the closed disc, the face. Numerals and the spade hand come from a **128x64 R8 glyph atlas made in code and uploaded into the veil's own WebGL context** at `warm()`; the veil cannot share the game's textures. The Break loops k < 6 at speed `1 + 0.13k`, alternating gold and silver. The crack is a fixed seeded polyline whose width follows heat on the way in and closes with `uMend`.
  4. Opening shards: the crack's cells, offset outward by `open · 0.4`, fading.
  5. Forced shatter: Voronoi over 40 seeded screen points. Each cell takes a drop delay and spin from a hash and goes to alpha 0 once it falls off the screen.
  6. Posterize to 6 levels with `bayer4`, into the Hour palette.
- **Pixel scale.** `ui/gateVeil.js` sizes the hour themes' canvas at **one veil pixel per 3 device pixels, 360-540 lines** (640x360 at 1080p), with CSS `image-rendering: pixelated`.
- **`ui/gateVeil.js`:**
  - `VEIL_THEMES` gains `hourIn`, `hourBack`, `hourHome` and `hourCast`.
  - `cover(look, { centre })` and `flash(look)`.
  - `VEIL_HOUR_CUES`: the ratchet x3 on the close, the Rift's bell at shut, the four quarters on the hand (pitches exported from `systems/sdScore.js`'s motif; fallback DAGGER.SND bell 107 pitched to them), and the chime (364) on the open.
- **Callers.** `scenes/world.js` and `scenes/dungeonContext.js` pass these looks wherever they pass `'brass'` today. The host projects the portal's centre through `proj · view` at `cover()`, clamped, or uses the screen centre if it is behind the eye.

### Files and new modules

- **New:** `render/sdVeil.js`
- **Changed:** `src/render/gateVeil.js` (theme dispatch), `src/ui/gateVeil.js` (themes, canvas, cues, centre), `src/systems/sdScore.js` (export the quarters; hold the Hour cue until the open), `src/scenes/world.js`, `src/scenes/dungeonContext.js`, `src/scenes/sdFx.js` (the rewind burst)
- **Tests:** the veil's new theme pins; the fire's left as they are

### Cost

- One full-screen triangle on its own canvas, about 230k fragments at 1080p. Today's brass whirl runs two 5-octave fbm stacks over about 518k, so this is roughly a quarter of today's cost.
- ALU: 12 half-planes plus a glyph tap inside the face. Textures: 8 KB in the veil's own context.
- No read-back of the game's frame. It runs only while a step is under way.
- CPU: one projection at `cover()`.

### Enhanced lane and classic set

Identical: the veil is its own canvas, independent of the lane.

### Phones

Identical and cheaper than today; 24 shatter cells.

### Lab check

- `?veil=in&vt=0.6` (closing), `vt=1.4` (shut, the Break), `vt=2.2` (opening); `?veil=back`, `?veil=home&vt=1.4` (the crack mending), `?veil=cast&vt=0.5`.
- With `hollow&yaw=20` (the Rift off-centre), the iris must close on the Rift.
- A line said through the veil stays legible (HUD z-order unchanged).
- A 4K capture shows clean pixel edges.
- With reduced motion forced, nothing spins.

---

## 4. The way back and the way home

### What the player sees

**The way back** stands at the Threshold's back (`SD_WAY_BACK_Z`, size 5, `SD_WAY_BACK_SIZE`).

- It is **the same astrolabe you walked through**, its claws planted on a stepped dais of the Threshold's cobbles, its iris open.
- From the Hour's side, its gear and hour-ring turn **forward**, back into time, and its brass is cleaner (the lit record, no verdigris).
- Through it you see **the Hollow**: a dark hall of coursed Daggerfall stone in deep parallax, lit only from the front in the Rift's gold, cold and small, with a faint silver glow on one wall where the Return stands. You know it is the way you came.
- **Moon light** spills from it onto the Threshold, the Hour's one cool light on arrival.
- When anyone arrives, it **exhales**: one turn of its ring and a short spray of brass sparks toward the Orrery.
- In the collapse, **its studs count the same 3:00** as the Hollow's Rift (one goes ember every 7.5 s), its gear ticks twice a second, and its window dims and flickers as the Hour lets go.

**The way home**, after the kill:

1. The heart tears from the falling chest (piece 10), hangs 3 m up, and breaks into a column of pale light.
2. Inside the column **the Return assembles at 1.5x scale** (1.95 x 3.45 m, so it reads across 26 m of arena) over `SD_HOME_RISE_MS` (1.5 s): two jambs rise out of the floor, the two arch halves swing in and lock, and the keystone clock drops into place and starts ticking forward. Each part clicks under the toll a fourth higher (`SD_HOME_TOLL`).
3. Its window is the Bay's sky at the game's hour over the Hollow's city: **the only blue in the Hour**.
4. A narrow silver beacon 40 m tall stands over it for 10 s, visible from anywhere in the arena and from the Steps, then settles to 6 m while it stands.
5. It is **pressed, never walked into** (the law, unchanged). A silver hand-plate on its sill lights when the activation ray finds it, which teaches the press.
6. The arena's motes drift toward it.

**The collapse in the Hour:** the sky's hands run forward to twelve (piece 5). The whole sky is the timer.

### How it is built

**The way back.** `standSdEnd`'s realm branch stands piece 1's model with face +z, and its state comes from `riftLook` over the realm's record (`sdHost.record()`). The rings' rotation sign flips.

Its window is `sdRiftPass` mode `hollow`, an **interior mapping**:

- The window ray is tested against the planes of a virtual room behind the ring: back wall 6 m deep, floor, ceiling, side walls at ±3 m.
- Each plane is painted as dungeon block courses in the classic dungeon brown ramp: 8-16 texels a course, 1-px mortar, three tones by hash.
- It is lit by a warm falloff from the front, with no flicker (there are no fires), plus a pale ellipse on the right wall for the Return. Snapped and dithered.
- **The stone is code-made only**: the Hollow's own textures may be evicted after the step, and it is never presented as a live view of the real hall.

The other parts:

- **Light:** moon `[0.85,0.9,1.0]`, range 9, added to `realmLights`.
- **The dais:** `world/sdRealm.js` `buildRealmModel`, 2 steps, about 200 triangles, static. `realmClamp` keeps bodies on the disc.
- **The arrival exhale:** a `wayBack` burst kind on the gate's spark pass (`scenes/sdFx.js`, brass, aimed +z) plus one ring turn. It fires for my own arrival, and for a peer's **first pose in the realm stamped within `SD_FX_LATE_MS` of now**, so a late page never fires it for players already there.

**The way home.**

- `sdEnd.standReturn` builds the arch in 4 parts plus the keystone hand (`sdRiftModel.js` splits `buildReturnModel`). The parts animate on matrices over `SD_HOME_RISE_MS` with a 120 ms stagger, then merge into the one arch draw.
- Every stage is timed from `s.fell.at` and `sdHomeAge` (pure), so a page that arrives late finds it standing with its beacon already settled.
- The column is the existing `sdFx` home and column kinds.
- **The beacon** is `render/sdOmenPass.js`'s column at 40 m, then 6 m. The column gains a colour uniform (`SD_OMEN_COLOR` is fixed today) and stands 1.2 m wide in silver, dimmer and thinner than the spoils' gold lines.
- **The hand-plate:** a sub-mesh swapped by `d.texRemap` while `sdEnd.hoverName` answers its key.
- **The motes:** an attractor uniform on the arena kind.
- **Light:** moon, range 6, first in the realm's light sort, so it is never dropped.

**Culling.** `sdEnd`'s draws carry their stage, so the way back is paid only when the Threshold's sphere is in view.

### Files and new modules

- `src/scenes/sdEnd.js`, `world/sdRiftModel.js` (the Return in parts), `render/sdRiftPass.js` (modes `hollow` and `bay`)
- `src/world/sdRealm.js` (the dais; the way back's light), `src/scenes/sdFx.js` (`wayBack`)
- `src/render/sdOmenPass.js` (colour and height uniforms), `src/render/sdMotes.js` (attractor)
- `src/scenes/world.js` (the beacon in `drawSdTelegraph`; a peer's arrival)

### Cost

- **Way back:** the Rift's 9 mesh and 2 pass draws, Threshold stage only. 1 light.
- **Way home:** 2 draws (5 during the 1.5 s rise), 1 pass draw, 1 beacon draw. 1 light.
- No new textures. CPU: at most 5 matrices during the rise.

### Enhanced lane and classic set

- **Lane:** the windows at L3, and the beacon's core blooms.
- **Classic:** the same passes, with halo quads at the hand-plate and the keystone.

### Phones

- Interior mapping without side walls.
- The beacon for 6 s.

### Lab check

| View | What must be true |
|---|---|
| `back` | The hall shows in the window, and two eyes 1 m apart show its parallax |
| `back&collapse=90` | 12 studs are ember and the window dims |
| `back&arrive` | The burst flies toward the Orrery; it does not fire with `&late` |
| `arena-far&fight=fell&age=0.8` | Mid-assembly |
| `&age=3` | Standing, with the beacon seen from the Steps' end |
| `&age=12` | The beacon settled |
| `&hour=` | Day and night windows |

---

## 5. The Hour's sky

### What the player sees

A painted sky you could believe was made in Deluxe Paint in 1996, but alive.

- **The void.** Near-black overhead, falling through about eight dithered bands to a low brass haze at the horizon that meets the fog. Stars are single crisp texels of pale silver, and the brightest carry four-point pixel glints.
- **The aurorae.** Tall banded curtains with fine vertical rays, brass at their crowns and a Mantella hem, posterized to four steps, drifting slowly. Today they are brown smoke.
- **The clock-face of stars, recomposed.** Its centre is lowered to elevation 0.20 rad with a radius of 0.34 rad, so that **from the end of the Crumble, the Remnant's head stands at the dial's hub**, and the face's lower edge sinks behind the arena like a rising sun. Its parts:
  - The rim is a dense band of stars with sixty minute dots.
  - Its twelve hours are **Roman numerals drawn in stars**.
  - Its inner ring carries **the six Endings as constellations** (the lion, the sun, the ship, the tusk, the crown of bone, the dragon), and the Hollow's own Ending burns in its light.
  - Its hour and minute hands are rows of packed stars with spade tips, **running backwards**, and a thin **second hand ticks one step back each second, exactly on the Hour's tock**: the place's heartbeat.
- **The far skylines.** Around the upper sky the Bay's cities hang upside down as black silhouettes with tiny warm windows: Daggerfall's towers, Sentinel's domes, Wayrest's bridge, Orsinium's tusked walls, the Underking's bone spire, the Blades' dragon keep. They turn once per sky period.
- **The near shards.** Four torn pieces of the Bay hang 90-140 m up and 120-200 m out, turning slowly in place, with true parallax as you cross the Hour. Each is an upside-down wedge of rock with a city hanging under it:
  - **Daggerfall's** castle wall with two round towers, their conical roofs pointing down, and a royal banner hanging *up*.
  - **Sentinel's** palace with three onion domes and a minaret.
  - **Wayrest's** bridge arches over the Bay's water, frozen mid-fall and spilling upward.
  - Nearest, **the Hollow's own Ending's kingdom**, lit in its light. If that Ending is one of the three above, the fourth shard is drawn from Orsinium, the Underking or the Blades by the slot's seed.
  
  Their windows glow, Daggerfall's night-window signature.
- **Below the horizon.** Brass mist deepening to black, then a furnace glow at the nadir, against which the Works' gears (piece 6) stand in silhouette.

**The sky tells the fight**, restrained, and always from the same clocks the HUD reads:

- **In a living fight:** a thin red arc grows along the rim from XII over the Hour's length (`s.ends`, the bar's own clock), and in the last minute the rim burns red. The hands keep running backwards.
- **The Reset's 8 s:** both hands sweep back to XII and meet at the landing, at the same moment the arena's rim lights XII (piece 9).
- **The Dragon Break:** the face doubles, a gold face and a silver one slightly apart, their hands turning opposite ways.
- **The Hour Ends:** the face cracks red and the haze grades to the End's red.
- **The collapse:** the hands run **forward** to XII over the 3:00, and the twelve star-numerals go dark one every 15 s.

### How it is built

**Two stages.**

**(a) The painted map.** `render/sdSkyMap.js` (new) holds an **octahedral 512x512 RGBA8 map**, NEAREST: one 2D target through `render/renderTarget.js` `createRenderTarget` and `withTarget`. The renderer has no cube-map plumbing today, and an octahedral map needs none.

- **Density:** a texel is about 0.3-0.5°. Daggerfall's own sky is π/512, or 0.35°, a pixel (`render/skyRenderer.js` `SKY_ANGLE_PER_PIXEL`).
- **Painting:** the paint program (`SD_SKY_PAINT_FS`, today's `SD_SKY_FS` refactored, with the new terms) renders one 256x256 quadrant a frame, so the whole map refreshes every 4 frames, before `beginFrame` or inside `withTarget`, never inside an open 2D run. All four quadrants are painted at stand.
- **Contents:** everything static or slow, all of which moves less than a texel between refreshes:
  - The void ramp, the stars with their glints, and the aurorae (at or under 1.5°/s, posterized 4 steps, with rays).
  - The face's static art: the star ring, the minute dots, numerals plotted in stars through a 5x7 font, and the Ending constellations sampled on a grid from `world/sdHallArt.js` `SD_SIGNS` (one law with the stones), the Hollow's own in its light (`sdMarksOf` by slot).
  - The six far skylines, upside down with window texels (the existing `skylineN` plus `orsinium`, `underking` and `blades`).
  - The mist and the nadir glow.
- **Quantizing:** to the palette with `SD_PIXEL_GLSL` inside the paint. The fog's haze is baked in, and `skyGain` is applied at the fetch.
- **Shapes and sizes:** a new `world/sdSkyArt.js` (512x128 R8, 64 KB) holds the glyphs, signs and skyline strips. The aurora's noise is a 128x128 tileable texture (16 KB) instead of a 4-octave `dfbm` a pixel.

**(b) The fetch.** `SdSkyRenderer` stays one full-screen triangle at the far plane, drawn after the islands (PERF2's law).

- Octahedral decode of the view ray, one NEAREST tap, then `skyGain` and the live haze band.
- **Live overlays** in the clock's frame (`clockFaceAt` kept, `CLOCK_BASIS` rebuilt from the new `SD_CLOCK_FACE`):
  - The hour and minute hands, at today's rates (`hourTurns` 1, `minuteTurns` 12 over `SD_SKY_PERIOD`), stepped on `sdTick`.
  - The second hand, on **the same `floor()` of the anchored clock that `scenes/sdAir.js`'s tick reads**, with a 0.08 s after-glow.
  - All hand inputs are snapped to the map's texel grid, so they are exactly as chunky as the painted stars.
- **Phase overlays** through `uClock = (mode, a0, a1, lit)`, set by the host from the fight state the page holds (`net/sdFightLink.js`: `s.ends`; the Reset's wind-up start; `s.fell.at` plus the collapse), and `uGrade` for the End's red.
- **Lowering the face:** `SD_CLOCK_FACE` goes to `{ az: 0, elev: 0.20, r: 0.34 }`, so `SD_CLOCK_TOP` is about 0.55 and `SD_SHARD_TOP` is recomputed. **AUDIT SD II's law that no shard crosses the face still holds**: far skylines by height, near shards by placement.
- **The key light stays where it is** (high from +z). Lowering the face is composition, not lighting.

**The near shards.** `world/sdShardsModel.js` (new):

- Built like Daggerfall's ARCH3D town models: boxes, gables, cones and 8-sided domes, 500-900 triangles each.
- One 256x256 shard atlas (ashlar, slate, sandstone, dome tile, Bay water, rock) with lit window texels in the emission.
- Dynamic draws turning about their own axes in whole turns per `SD_SKY_PERIOD` on the anchored clock, `noShadow`.
- Placed at azimuths outside the cone from every course point to the face. A test samples course points and checks that each shard's bounding sphere never crosses the face disc.
- Within 300 m of the whole course (the dungeon arm's 500 m far plane).

**The Rift's window** reads the same map through `SD_SKY_FETCH_GLSL` (piece 1).

**Left out:** the striding Numidium. Sections 7 and 10 make the Remnant *what the Warp kept of the Numidium*, and the sky must not upstage the boss.

### Files and new modules

- **New:** `render/sdSkyMap.js`, `world/sdSkyArt.js`, `world/sdShardsModel.js`
- **Changed:** `src/render/sdSky.js` (paint and fetch stages, `SD_SKY_FETCH_GLSL`, `SD_SKYLINE_GLSL`, the new `SD_CLOCK_FACE`, `uClock`), `src/scenes/world.js` (`drawSdSky` gets the phase), `src/scenes/worldModes.js` (paint before `beginFrame`; shards in the realm's draws), `src/scenes/dungeonContext.js` (the map handed from the Hollow to the realm)
- **Tests:** `test/sd5b_sky.test.js` and `test/sd23_sky.test.js` re-pinned (`CLOCK_BASIS`, `SD_SHARD_TOP`, whole turns over the period, the face kept clear)

### Cost

- **Textures:** map 1 MB, atlas 64 KB, noise 16 KB, shard atlas 512 KB.
- **Per frame:** one quadrant of the heavy paint (about 65k fragments) plus the fetch, which is one tap a pixel, and hand tests only inside the face's disc. Today the heavy shader runs on every sky pixel, about 1.2M fragments at 1080p with the sky on 60% of the screen. **The new sky is several times cheaper, and far cheaper on phones.**
- **Shards:** 4 draws, about 3k triangles, no shadows.
- **CPU:** 4 matrices and about 6 uniforms.

### Enhanced lane and classic set

The sky is a display-space pass on both lanes. The brightest stars and the hands' glow sit just above `AIR_BRIGHT_THRESHOLD`, so the lane blooms them. The haze band stays under it, so no horizon blooms. The shards are lit by the realm's light on both lanes, plus their window emission.

### Phones

- Map refresh one quadrant every 4 frames (whole every 16), aurora drift halved.
- Two near shards (the Ending's and Daggerfall's).

### Lab check

| View | What must be true |
|---|---|
| `sky` | The whole map reads as pixel art |
| `sky-hub` (eye at the Crumble's last plate, facing +z) | The Remnant's head is within 0.03 rad of the face's hub |
| `?t=N` and `?t=N+1` | The second hand steps back one tick |
| `?fight=reset&rt=4` | Hands halfway to XII |
| `?fight=break` | Doubled face |
| `?fight=end` | Cracked red |
| `?collapse=90` | Hands forward, six numerals dark |
| A slow pan across the octahedral folds | No seam visible |
| `overview` | No shard crosses the face from anywhere on the course |

---

## 6. The islands, floors and the void

### What the player sees

Every island is **a piece of the Bay torn up and welded to a gear of the Numidium**.

**The tops are dark, and light means something.**

- **The Threshold** is a disc of **Daggerfall's own street**: grey-brown cobbles in the classic town's look, cracked, with brass welded into the cracks as metal, not glowing. It is the street the Hollow swallowed. Inlaid at the arrival spot is a **brass compass rose whose long point aims at the Orrery** and whose tail aims at the way back, so the first thing you see tells you where to go.
- **The walk** is a causeway of dressed flagstones between riveted brass kerbs, with a brass tie-plate every 3 m.
- **The checkpoints** are basalt flags.
- **The Orrery and the arena** are in their own pieces.

Joints are dark. **There is no neon grid.**

**The rims** are thick brass bands with square teeth standing out every 1.2 m, so from the overview, from a Drift step or looking back from the arena, the Hour reads as broken clockwork. **A thin gold line runs along the top of every edge you could fall from**: the one always-lit line in the Hour.

**Undersides.** Each island hangs on a cluster of 3-5 jagged spires of different lengths, cut through with **strata like a cake**: the cobble or flag lip, a band of earth with roots, the dungeon's dark block stone, then raw Dwemer works (brass gear rims and pipes jutting from the rock), down to broken tips that fade into the haze. One or two chains hang from each into the void, swinging on the tick.

**Lamps** are brass cage lanterns hung from curved hooks, with their light where it was.

**Far away**, a dozen small dead islands drift 150-400 m out, fogged into the haze, for scale and parallax.

**The Works.** Far below, 250 m down, enormous brass gears 40-80 m across turn slowly in the haze, neighbours opposite ways, with dim glints at their tooth-tips, black against the furnace glow at the nadir. You see them between islands and you see them come up at you as you fall.

**Light** comes from the lamps, from the furnace below (warm up-light rimming every underside in gold against the black) and from the clock-face's pale key above.

### How it is built

**Floors** (`world/sdRealmArt.js`, repainted through the kit):

- `SD_FLOOR_TILE_M` goes from 4 to 2 at 64 px, which is 32 texels a metre (128 px under Vanilla Enhanced).
- The Threshold gets a cobble record; the walk a flagstone record; checkpoints basalt flags.
- **Joint emission goes to 0.** Today's brass joints at 0.18 *are* the grid in `abyss-threshold.png`.
- `realmBrassArt` emission goes from 0.12 of its colour to worn edges at 0.04.
- `realmRootArt`'s veins (0.35) are gone.
- `realmDialArt` (256 px over 36 m, 7 texels a metre, the stair-stepped orange rim in `abyss-orrery.png`) is retired for geometry (piece 7).

**Inlay is geometry, crisp at every distance.** Thin brass strips 0.08 m wide and 0.01 m proud, laid in `world/sdRealm.js`: the compass rose's 8 points, the Threshold's rim ring, the walk's tie-plates. The compass's +z point carries an L2 gold thread.

**Rims** (`realmIsland`):

- The 48-gon band as today, plus `round(2πr / 1.2)` tooth boxes of 5 quads on its outer face, **their tops 0.05 m under the rim top** and outside the disc, so the motor never meets them.
- `realmClamp` and the colliders' discs are unchanged.
- The gold edge line is a 3 x 3 cm strip of geometry along the rim's outer top edge, on an emissive gold record at L2 (0.3-0.4). It is geometry, not a texel row, so it does not alias without mips.

**Undersides.** `world/sdIslandModel.js` (new), `islandRoot(f, cx, cz, r, seed)`:

- A skirt from the rim 2 m down, splitting into 3-5 spires. Each is a ring sweep, 7 sides x 6 rings, its radius jittered ±18% by a seeded hash, with a slight curve.
- Strata come from the root art's v: a new 64x128 vertical strip going from lip, to earth with roots, to block stone, to brass works, to haze x 0.5 at the tips, so the texture and the fog agree.
- 2-3 half-buried gear rims (`buildGearModel` scaled 2-4 m).
- 1-2 chains of 12 alternating 4-sided links. The chains of a stage share one mesh swung by one matrix on `sdTick`.
- **All of it below y −0.5, outside `realmClamp`, in a separate `noShadow` mesh per stage.** Nothing that looks standable is unknown to the law, and nothing here enters the 20 lamps' cubes.

**Lamps:** in `buildRealmModel` the post bends at 2.2 m into a hook, with a brass cage around the core. `realmLampFeet` and `realmLights` are unchanged.

**Far islands:** one static mesh, 12 islands (an 8-gon top and one spire, about 40 triangles each), on a ring 150-400 m out at ±60 m height, outside the arena-to-face cone, the set turned once per `SD_SKY_PERIOD`. `noShadow`.

**The Works.** `world/sdWorksModel.js` (new):

- 4 gears with 48-96 teeth, about 400 triangles each, on one dark brass record whose emission is limited to the tooth tips (L2).
- At y −240 to −280, under the course's middle, inside the far plane.
- Turning on `sdTick`, neighbours opposite, `noShadow`.

**Light:**

- `SD_REALM_TRILIGHT` becomes sky `[0.20,0.17,0.13]`, equator `[0.16,0.12,0.08]`, **ground `[0.34,0.20,0.08]`**: the furnace from below on every down-facing facet.
- `SD_REALM_KEY_LIGHT` scale goes from 0.5 to 0.65, colour `[0.95,0.90,0.78]`, direction kept.
- **`SD_REALM_FOG` is unchanged** (density 0.0045, colour `[0.2,0.15,0.07]`), so the void stays black.
- The lane's grade comes from the shared kit (key 0.12, max 1.15).

### Files and new modules

- **New:** `world/sdIslandModel.js`, `world/sdWorksModel.js`, `world/sdPixelKit.js` (shared)
- **Changed:** `src/world/sdRealm.js` (`realmIsland` rims and teeth, edge line, inlay, lamps, trilight, key, stage split, far islands), `src/world/sdRealmArt.js`, `src/world/sdHall.js` and `src/world/sdStepsModel.js` (their islands call `realmIsland` and inherit), `src/scenes/worldModes.js` (stage meshes, Works, grade), `src/tools/abyssLab.js`
- **Tests:** `test/sd5a_realm.test.js`, `test/sd11a_scenes.test.js`, `test/sd14c_motes.test.js`

### Cost

- **Static realm:** from about 1.8k to about 9k triangles (tops, rims, teeth, inlay, lanterns). About 5 records per stage, but only the stages in view draw.
- **Roots:** about 10k triangles in 4 `noShadow` draws (one per stage, culled with it).
- **Other draws:** chains 4, far islands 1 (about 500 triangles), Works 4 (about 1.6k triangles).
- **Textures:** about 6 records at 64x64 x 2 (192 KB; 768 KB under Vanilla Enhanced), root strip 64 KB. The dial (512 KB) is retired.
- **CPU:** about 10 matrices plus 5 sphere tests.
- These are static casters for SC1's cache, drawn once; the roots cast nothing.

### Enhanced lane and classic set

- **Lane:** a black void, warm up-light on the undersides, lamp pools on dark floors, the grade holding the eye down, the edge lines at L2.
- **Classic:** the contrast comes from the art itself (dark joints, black void, emissive edge lines) plus halo quads at the lantern cores. The grade does nothing there.

### Phones

- One spire a root; no far islands; 2 Works gears; chains without sway.

### Lab check

| View | What must be true |
|---|---|
| `threshold` (before and after) | No grid. The compass's long point aims at the Orrery through the camera's mirror. A measured floor maximum of 0.25 |
| `overview` | Toothed rims and edge lines read; strata visible on the roots |
| `works` (from a Drift step looking down, pitch −60) | The gears are silhouetted against the nadir glow |
| `?law` | No root, tooth or chain stands inside a collider disc |
| `?lane=off` | The classic set holds its contrast |

---

## 7. The Orrery of Endings

### What the player sees

**The hall.**

- A floor of dark marble flags. At its rim stand **twelve raised brass numerals as tall as a knee**, XII toward the bridge, so the floor reads as a clock-face underfoot.
- A brass bezel encloses the inner ring, whose six segments are **raised plates that rise 3 cm and glow Mantella** as stones come true: how many, never which. A rise flashes the whole inner ring once ("nearer"). A fall dims it with a downward clunk.
- A brass rosette sits at the dial's centre.

**The six Ending-stones** are carved monoliths in the Daggerfall manner:

- A two-step plinth and a chamfered shaft of dark stone, each carrying its kingdom's **heraldry in relief**: Daggerfall's lion, Sentinel's sun, Wayrest's ship and Orsinium's tusk in brass, the Underking's crown in bone, the Blades' dragon in brass.
- From a brass arm off each crown hangs **a heraldic banner in that kingdom's colours, frozen mid-ripple**.
- Each face carries a raised brass dial with a spade hand and a notch at XII.
- On each crown sits **a 1.2 m brass gear that turns when the stone turns**. From anywhere in the hall you see which stones moved, but the gearing shows only as effect, never as linkage.
- **While a stone's gear settles (700 ms) its bezel glows gold**, and it dims as the stone frees. A turn refused by the stones' rights flashes the bezel ember.
- The handles are cast levers with embossed chevrons (forward on the right, back on the left). A press spits brass sparks from the crown gear.

**The Ledger plaques** become brass lecterns, each holding an open bronze ledger. Their words are unchanged.

**The orrery overhead.** Above the stones, hanging from the dark between 18 m and 7 m, are six great brass rings nested about an axle, each carrying its Ending's medallion. At the axle's foot, 7 m above the dial's centre, hangs **a Mantella soul-gem** whose brightness is the dial's count.

- **Mode A** (the default, which ships): the rings hang still at their own tilts and tick together once every 6 s as decor. They **never show a stone's hour**.
- **Mode B** (only on Mac's ruling, see the risks): each ring's angle follows its stone's shown hour.

**The fray.** 48 brass tabs ring the hall's rim (36 under the Fraying). Each turn flips one up, glowing ember, and the last eight pulse at 2 Hz. Past three quarters, the hall's dust jitters and the rings shiver. The lights do not gutter, so the plaques stay readable.

**The snap.** Every tab blazes white and drops, every hand whirls back, the crown gears spin, the rings spin back a whole turn in 0.8 s on the toll, a ring of dust jumps off the dial, and the lashed are struck red, as now.

**The Concord.**

1. The six banners unfreeze and stream in a sudden wind for three seconds, then freeze again.
2. The six rings swing into **one plane** over 1.2 s and lock with one great tock.
3. The gem flares white-green and sends a band of light along the floor from the hub to the rim at +z.
4. **The bridge lays itself out:** twelve plates of hard light, each engraved with an hour, flip into place from the rim out to the first step.

### How it is built

**Stones** (`world/sdHall.js`):

- Plinth, chamfered shaft (about 60 quads), relief slab and a 16-gon bezel, all **within 5 cm of `stoneSolids`' boxes** (`SD_STONE_SIZE` 1.6 x 0.7 x 2.6). `beforeStone`, `stoneInReach` and the handle boxes are unchanged.
- `buildHandModel` becomes a spade of about 30 triangles; `handMatrix` is unchanged.
- **Crown gears:** one mesh, 6 dynamic draws, `rotZ(shown hour · 60°)`: a 2:1 gear, so it visibly moves more than the hand. It follows the hands' existing easing (`SD_HAND_RATE`, `SD_SNAP_RATE`), so it moves exactly when they do and never before.
- **Bezels:** 6 draws of one mesh, each swapped by `d.texRemap` between cold, gold (through `SD_STONE_SETTLE_MS`) and ember (a refusal, from the realm's word to the refused turner).
- **Banners:** one mesh of six two-sided strips (0.9 x 2.2 m, 6x10 quads each), the ripple baked into the vertices. At the Concord, `renderer.updateMeshVertices` animates a wind for 3 s (6 x 77 vertices a frame), then freezes it.

**Floor and dial:**

- Marble flags as a repeating record at 2 m.
- The bezel, the six raised segments (`buildLitModel`'s arcs become boxes 3 cm proud), the 12 numerals (glyph slabs, about 20 quads each, XII toward +z, as `realmDialArt` has it) and the rosette are all geometry.
- **The fray:** `buildFrayModel` becomes 48 tab boxes, rebuilt per count as today. The ember arc is retired.

**The hall atlas:** one 256x256 atlas (shaft stone, six 64-px relief emblems, six banner faces, ledger pages, bezel brass) replaces 16 records, including the twelve emblem and plaque draws.

**Overhead.** `world/sdOrreryModel.js` (new):

- **Rings:** `buildOrbitRing(k)`, radius `6 + 1.2k` m, 0.35 x 0.12 m, 48x4 segments (about 384 triangles), a 0.9 m medallion on the emblem cell, two pins.
- **Hub:** `buildOrreryHub()`, an 8-gon axle from 18 m to 7 m plus the 12-facet gem. Nothing reaches the floor, and the collider is unchanged.
- **Ring matrix:** `T(hub) · R_tilt(k) · Ry(angle_k)`. Tilts are seeded between 12° and 40°.
  - Mode A: `angle_k` is a shared decor tick, plus the shiver (±1.5°, at or under 2 Hz, past three quarters of the fray), plus the snap's turn.
  - Mode B: `angle_k` is the scene's eased `shown[i]`.
  - The Concord eases every tilt to 0, idempotently, so a page arriving after it stands the rings flat with no choreography (the hall's "first word" rule).
- **The gem:** 7 glow records (16x16, count 0-6) swapped by `texRemap`, plus a point light (Mantella, range 14, intensity `max(0.2, count/6)`) in `host.sdRealmLights`.

**The Concord's band:** `render/sdBeam.js` with `uFlat` 1, Mantella running into gold, from the hub to the rim over 1.0 s.

**The bridge:** `buildBridgeModel` becomes 12 plates in one mesh. Per-plate hinge matrices come from `bridgeLayMatrix`'s k, staggered over `SD_BRIDGE_LAY_MS`, and fold back into the one bridge draw once laid.

**Sparks:** a `gateFx` `turn` burst at each moved stone's crown gear (`FX_BURSTS_MAX` 16 holds six).

**Lights:** the rim lamps go from 8 to 4, plus the gem. Each Ending stone's SD18c light is kept.

### Files and new modules

- **New:** `world/sdOrreryModel.js`
- **Changed:** `src/world/sdHall.js`, `src/world/sdHallArt.js` (atlas through the kit; `SD_SIGNS` unchanged), `src/scenes/sdHall.js` (crown gears, bezels, banners, rings and gem, fray, snap, Concord, bridge plates), `src/scenes/sdFx.js` (`turn`), `src/render/sdMotes.js` (dust jitter uniform), `src/render/sdBeam.js` (reused), `src/world/sdRealm.js` (Orrery lamps 8 to 4), `src/tools/abyssLab.js`
- **Tests:** `test/sd6c_hall.test.js` and `test/sd6b_hall.test.js` (art and shape pins retired and rewritten)

### Cost

- **Draws:** hall static about 5 (from 16), plus 6 hands, 6 crown gears, 6 bezels, 6 rings, gem, axle, banners, lit, fray and bridge: **about 31, and 42 during the 1.2 s lay.** Today it is 22-25, issued from everywhere; now only in view.
- **Triangles:** about 5k static, about 2.6k dynamic.
- **Textures:** atlas 512 KB, marble 32 KB, gem records 7 KB.
- **Lights:** net −3.
- **CPU:** up to 18 matrices; the banner upload (about 11 KB a frame) only during the Concord's 3 s.

### Enhanced lane and classic set

- **Lane:** the gem and segments at L3, bloom at the Concord, the stones' lights casting the shafts' shadows (static casters).
- **Classic:** the same emission, with halo quads on the gem and the bezels' gold.

### Phones

- Banners stream through 3 vertex keyframes instead of a per-frame wind.
- Rings at 32 segments.

### Lab check

| View | What must be true |
|---|---|
| `orrery&lit=3` | Exactly three segments raised, and the gem at 3/6 |
| `?fray=40` | 40 tabs up, the last eight pulsing at 2 Hz or less, the rings shivering |
| `?concord=0.5` | Rings mid-swing, banners streaming |
| `?concord=1` | Flat rings, bridge laid |
| A turn probe | The crown gear moves only with its hand. In mode A the rings never move on a turn |
| `?law` | No stone's visual leaves its box by more than 5 cm |

---

## 8. The Unmoored Steps

### What the player sees

Every step shows what it will do next, from across the void, before you jump.

**The Drift.** Each brass platform hangs on **two long rigid rods from a pivot gear floating 18 m above**: a row of giant pendulums. The rods lean with the swing and the gear rocks with them, so you read the swing's period and phase before you jump, with physics you already know.

**The Beat.**

- Each plate is **a brass clock-plate whose one big hand sweeps backwards to XII across its solid 2.4 s**, the ticks lit gold behind it.
- In its last 0.4 s the hand enters an **ember sector**, the plate's light falters once or twice (2.5 Hz), and it dissolves out through an ordered screen-door.
- While it is gone, **a thin gold ghost outline** hangs exactly where it will return, its hand still sweeping, brightening over the last 0.3 s with the tick.
- It dithers back in over 0.15 s.
- Neighbouring plates run half a beat apart, so the rhythm reads down the span.

**Risers.** A toothed brass rack up each face, like rungs, and a lit gold lip along the top: "run up here."

**The Crumble.**

- Cracked basalt pins with dim ember cracks.
- When your foot lands, the cracks **flare and widen in three stages** across the 0.7 s while grit pours from the underside.
- Then it breaks into **four chunks that tumble into the void**, and a gold ghost outline with a hand counts its 5 s return.
- **In its last 0.6 s the chunks fly back up out of the void and click together**: time rewinding. A shudder, and it is whole.
- All of this is yours alone, as the law is.

**The Breath.** A brass weathervane on checkpoint C, its vane the Hollow's Ending's sign, **swings to point the push's way one second before the gust**, with a clack. Then the streaks blow across and the void's sparks bend with them. The camera does not roll.

**Checkpoints.** A small waystone on A, B and C (an Ending-stone in miniature) **lights gold when it is your cast-back point**: one at a time.

**The void below.** The Works and the rising sparks. A thin gold line under each step's rim, so from the hall the course reads as a dotted path of light over the dark.

### How it is built

**Atlas per kind** (`world/sdStepsArt.js` through the kit): top, side and under cells in one record per kind, so each step is 1 draw (today 2-3). Boxes are bevelled at about 40 triangles. **`stepTris` and `stepBox` are untouched.**

**The Drift.** `buildPendulum()` in `world/sdStepsModel.js`:

- Two 0.06 m rods from the platform's x edges, never over the landing, up 18 m to a gear (`buildGearModel` at 1.4), about 300 triangles in the pendulum's own frame.
- Matrix: `T(pivot) · Rz(asin(dx / 18))`, with `dx` the law's sideways offset from `stepAt`. The gear rocks with the rods.
- The platform keeps the law's pure translation. An 18 m pendulum rises only 0.1 m at full swing, which nobody will see.

**The Beat.**

- 12 frame records (64x64, the hand at each twelfth, frames 11-12 in ember) picked per draw by `d.texRemap` from `beatStands` and `beatBlinks`' clock. 12 frames over 2.4 s is 0.2 s a frame, which is motion, not flashing.
- `d.dissolve` runs over the last 0.4 s (out) and the first 0.15 s (in). The emission falter carries the read at 30 m, where a dither alone reads as darkening.
- **`SD_BEAT_BLINK_HZ` goes from 8 to 2.5** (slice S0). The collider's truth stays `beatStands` alone.

**Risers:** `buildStepModel('riser')` adds 11 rack teeth (0.15 x 0.12 m, 0.05 m proud, visual only) and an emissive lip.

**The Crumble:**

- 3 crack-stage records via `texRemap`, chosen by `crumbleAfter`'s shaking share.
- `buildCrumbleChunks()` splits the box into 4 prisms along the art's own seeded crack lines. While my step is gone, the whole step hides and its 4 chunk draws fall (drop, outward drift, spin).
- In the last 0.6 s of `SD_CRUMBLE_BACK` the same motion runs backwards, eased out. **The law's return at 5 s still decides.**
- The grit is the `sdFx` slip kind at the touch.

**The ghost pass.** `render/sdStepsPass.js` (new) draws the whole course in **one additive draw**:

- The ghost outlines of gone Beat plates and of my gone Crumble pins, drawn as screen-width line quads 2 px wide (`telegraphLineW`'s law, wider on short screens; **never `GL_LINES`**, which WebGL caps at 1 px), each with its hand.
- A static VBO of 25 boxes' edge quads, plus uniform arrays `uStep[25]` (x, y, z, kind) and `uState[25]` (phase, alpha, timer share, mine), written in place (AUDIT SD II L2 F9's law).
- The ghost is the law's own box at the law's own anchored time.

**The vane:** one mesh on C, `rotY` toward `gustAt`'s coming direction `SD_GUST_WARN` ahead, eased, checked through the camera's mirror. Its clack is clip 433 pitched up. The motes get `uWind` in the warning second.

**Waystones:** a small mesh on A, B and C, `texRemap` lit or dark from `lastSpan`.

**Cast-back:** the gold rewind burst (piece 3), with no veil.

### Files and new modules

- **New:** `render/sdStepsPass.js`
- **Changed:** `src/world/sdStepsModel.js` (bevelled steps, pendulum, rack, chunks, waystones, vane), `src/world/sdStepsArt.js` (kind atlases, beat frames, crack stages), `src/scenes/sdSteps.js` (`SD_BEAT_BLINK_HZ`, frames, dissolve, chunks and rewind, vane, waystones, the pass), `src/scenes/worldModes.js` (the loop fields), `src/scenes/world.js` (the pass in `drawSdTelegraph`), `src/render/sdMotes.js` (`uWind`), `src/scenes/sdFx.js`
- **Tests:** `test/sd7b_steps.test.js`

### Cost

- **Draws:** 25 steps (from about 67), 8 pendulums, 3 waystones, 1 vane, at most 8 chunks (my falling pins only, at most 2 at once) and 1 pass draw: **about 38-46, from about 71.**
- About 2.5k dynamic triangles.
- **Textures:** kind atlases 4 x 128x64 x 2 (256 KB), beat frames 12 x 64x64 x 2 (192 KB), crack stages 96 KB.
- **CPU:** the 25 `stepAt` calls that already run, about 35 matrix writes and 200 uniform floats: under 0.05 ms.
- **No lamp reaches the Steps, so moving steps rebuild no shadow cube. Keep it that way.**

### Enhanced lane and classic set

- **Lane:** the solid dial at L3, the ghosts reaching L3 at the return, bloom on the lit lips.
- **Classic:** the same records, emission and pass. The dissolve is the mesh program's on both lanes.

### Phones

- 2 chunks instead of 4; pendulum gears without teeth.
- Ghost lines at 3 px or more (`telegraphLineW` already widens).

### Lab check

| View | What must be true |
|---|---|
| `pendulums` (from checkpoint A, facing +z) | At `?t=N` and `N+1` each rod's angle matches its platform's offset |
| `beat` (close) | `?t` chosen so one plate is in its ember frames and one is gone with its ghost and hand |
| `beat-far` (30 m) | Solid, ember and gone are told apart, on both lanes and under `?grey` |
| `?crumble=0.5`, `fall`, `back` | Each stage shows as described |
| `gust` (at `SD_GUST_WARN`) | The vane points the push's way on screen |
| **Flash probe** | A Beat plate's luminance sampled at 60 Hz for 4 s shows at most 3 transitions a second |

---

## 9. The Last Moment's arena

### What the player sees

**The face of a fallen clock, 52 m across, over the works.**

**The floor.**

- Dark bronze plates in concentric rings, low-frequency, **darker and quieter than anything else in the Hour** (at or under 0.25 everywhere), so telegraphs own it.
- A wide brass rim carries **twelve raised Roman numerals** (so a raid can call "to IX!") and sixty minute ticks, with broken brass teeth along its outer edge below foot level and chains hanging into the void.
- A brass boss at the centre where it wakes.

**The fissures are the Pulse's consequence.** Eight bold fissures run from the centre to the rim, dark, with the Mantella barely glowing deep inside. **On every Mantella Pulse, at its landing**, they flood bright green from the centre outward in 0.4 s and fade over 1.2 s. The Hour's heartbeat is felt through the floor, and it never doubles as a second telegraph.

**The Reset is counted on the rim.** Over its 8 s the twelve numerals light one by one, one every 0.67 s, in the Reset's soul-white, the last two in ember. When XII lights, it lands, and in the sky the hands meet at XII at the same moment.

**The Hour Ends:** every fissure and numeral goes red.

**The pillars.** Square clock-tower columns of dark basalt banded in brass, with conduit pipes, on a plinth, under a stepped capital. On each face of the capital is a small clock whose single hand **turns to point at the Remnant**: they watch it. A brass lantern cage at each capital lights the arena from the four corners in **gold**.

**The Stomp's ring** rolls out as **a low wall of brass light 0.6 m tall**, not a line on the floor. It reads "jump this."

**The Remnant's mark.** A brass ring about its feet and a chevron where it faces, always; smaller under each Echo. This is the Warden's WBX4 mark, which the Remnant never got.

**The hold.** When you are joined to a living fight and stand in it, the rim raises a low curtain of gold light, so "you are held here" is seen, not discovered by walking into it.

**The Reset's light.** The lamps and lanterns dim to 40% through the wind-up, so the Hearts are the brightest things in the world. They come back at the landing or the stun.

### How it is built

**Floor** (`world/sdRealm.js`):

- The disc becomes 8 concentric bands of 48 sides, their uv running along each band, so a repeating 64-px bronze plate record at 2 m lays as rings, with painted dark seams and no emission.
- The rim numerals (glyph slabs), ticks, teeth and boss are geometry, about 3k triangles.
- **`realmFloorTris` keeps the flat disc:** the collider is unchanged.
- The 64-px Voronoi `realmArenaArt` is retired.

**Arena light.** `render/sdArenaGlow.js` (new) is **one premultiplied draw**: a flat disc 0.015 m over the floor, plus 12 numeral quads, plus up to 2 sigil quads (piece 10).

- **The fissures' distance field is baked once into a 128x128 R8 texture** (16 KB), so the fragment does one tap, not a segment loop.
- At rest it darkens the crack lines and adds a faint green core.
- **The flood:** an envelope keyed to the Pulse's landing time in the fight state (the same field `sdFx` keys the Pulse burst to), with a radial front at r < front. It runs every 22 s under the Underking.
- **The Reset:** a per-numeral lit count keyed to the Reset's wind-up start.
- **The End:** red.

**Pillars.**

- `pillarQuads` stays the collider and the Hour-Hand's shading square exactly.
- The visual stays inside the square: chamfers, a plinth band flush with it plus a 0.15 m visual-only skirt (under a step's height), 3 brass bands, conduits at most 5 cm proud, a stepped capital and a clock face on each side (one pillar-face record, +1 draw).
- **Capital hands:** 4 draws, yawed each frame toward the body's pose.
- **Lanterns:** gold, range 12, at the capitals. **These 4 replace 4 of the 8 rim lamps**, so the light count does not change.

**The Stomp wall:** `render/sdBeam.js` gains a ring mode, a 64-segment cylinder strip at `stompRingAt`'s radius (the very front the law strikes), additive, fogged, posterized in bands with a bright top lip. The gate telegraph's floor ring stays under it. **`SD_BEAM_MAX` is not raised for the Hearts**; they use the crystal pass (piece 10).

**The mark:** `TELEGRAPH_KIND.mark` (WBX4's) laid by `scenes/sdRemnantBlows.js` under the Remnant and each Echo, in the body's metal.

**The hold:** `render/duelWall.js`'s program at 1.1 m around `SD_ARENA.r`, in gold (its colour, `DUEL_WALL_COLOR` today, becomes a uniform), drawn while `arenaHolds(joined, x, z)`.

**The Reset's dimming:** a phase factor through `realmLightsWith`.

**On Mac's ruling, built but off:** **safe wedges**, cool sectors on the floor behind each pillar while a Hand gathers. They would be built from `behindPillar`'s own geometry (half-arc `atan((SD_PILLAR_W/2)/d)`, from the pillar to the Hand's reach) as a new telegraph sector shape. They noticeably ease the fight.

### Files and new modules

- **New:** `render/sdArenaGlow.js`
- **Changed:** `src/world/sdRealm.js` (bands, rim, pillars' visual, lanterns, lamps 8 to 4 plus 4), `src/world/sdRealmArt.js` (bronze plate, pillar face), `src/render/sdBeam.js` (ring mode), `src/render/duelWall.js` (colour uniform), `src/scenes/sdRemnantBlows.js` (flood and Reset envelopes, the mark, the Stomp wall, the dimming), `src/scenes/sdRemnant.js` (capital hands), `src/scenes/world.js` (`drawSdTelegraph` wiring), `src/tools/abyssLab.js`
- **Tests:** `test/sd8c_remnant_page.test.js`, `test/sd15_read.test.js`, `test/sd20c_render.test.js`

### Cost

- **Static:** about 3k more triangles in the arena stage's records, plus 1 record.
- **Draws:** capital hands 4, glow pass 1, Stomp wall 1 while it rolls, mark 1-3 telegraph quads, hold curtain 1.
- **Textures:** plate 32 KB (128 KB under Vanilla Enhanced), field 16 KB, pillar face 32 KB.
- **Lights:** 8, unchanged, plus the heart.
- **CPU:** 4 yaw matrices and 2 envelopes.

### Enhanced lane and classic set

- **Lane:** the flood and the numerals peak at or above 0.85 and bloom. The lanterns cast the pillars' shadows (static).
- **Classic:** the same pass in display values, plus halo quads at the lanterns.
- On both, the floor is measured at or under 0.25.

### Phones

- The hold curtain at 48 segments; otherwise identical (cheap).

### Lab check

| View | What must be true |
|---|---|
| `arena&fight=stomp` | The wall at 10 m |
| `&fight=pulse&pt=0.2` | The flood front at 40% |
| `&fight=reset&rt=5` | 8 numerals lit, the sky's hands about 5/8 of the way |
| `&fight=held` | The curtain shows |
| `&fight=end` | Red |
| **Contrast probe** (`arena` and `arena-far`, through the fog, both lanes) | Maximum floor luminance at or under 0.25, and every telegraph core (`SD_BLOW_COLOR` and each `SD_ELEMENT_COLOR`) at or above 0.7 |
| `?law` | No pillar visual outside its square |

---

## 10. The Brass Remnant

### What the player sees

**At last it looks like what the Warp kept of the Brass God.** 7.2 m of riveted Dwemer brass in big flat-shaded plates:

- **The head:** a domed helm with a slotted face-plate whose two eye-slits burn in its Ending's light, **crowned with seven broken clock-hands**.
- **The shoulders:** great brass **bell** pauldrons.
- **The chest:** an open **cage of eight curved ribs** around **the heart**, a faceted soul-gem the size of a man's torso in its Ending's light, beating, and lighting the ribs from inside.
- **The back-dial:** behind its shoulders, a 2.2 m-radius **dial**. From the front its rim haloes the head; from behind it is a clock whose hands tick backwards. It is flanked by organ-pipe vents that puff brass sparks when it exerts.
- **The body:** a riveted plate skirt over thick greaved legs with **knee gears that turn as the legs swing**.
- **The arms:** the left a heavy fist with gear knuckles. **The right forearm is the Hour-Hand**: a long brass clock-hand blade with a spade tip, and the beam leaves from that tip.
- **Finish:** patina brass, verdigris in the recesses, bright wear on the edges.
- **Inside the law:** feet and greaves stay inside the law's 2.2 m radius, and nothing below 2 m reaches past it.

**Every blow has a body tell before its floor tell**, in the blow's telegraph colour, heating from off to mid to hot as its wind-up runs:

| Blow | Body tell |
|---|---|
| Stomp | The raised leg's knee gear spins and its sole glows; grit falls |
| Hour-Hand | The blade heats white-gold from root to tip, the back-dial spins up, the heart flares |
| Volley | The gears form in its hands during the gather (not only in flight), and its fists glow |
| Pulse | The ribs flare Mantella and the heart swells |
| Reset | Arms high; the heart turns white; the back-dial's hands spin backwards to XII |

**The heart is the fight's metronome.** It beats slowly after each Pulse and quickens toward the next (0.6 to 2.5 beats a second, never over 3 Hz), flashing as it lands.

**Counts and timers are on the body.**

- **Eight rib lamps** light one per Heart risen and go out as Hearts break.
- **The back-dial carries the timers:** stunned, an ember hand runs its 8 s back to XII. In the Break, the living Echo's back-dial runs its 15 s (10 s under the Blades), and when it reaches XII the fallen one rises from its sigil, which burns on the floor where it fell.

**Phase three:** its plates are cracked, the cracks lit in its heart's light. Under a fifth, sparks and gears drop from its joints (exists).

**The Dragon Break.** The Remnant dithers out of time over 0.8 s in gold and silver sparks. The **Gold and Silver Echoes** each trail **one after-image** a fifth of a second behind: dim, dithered, eyeless, never strikeable-looking.

**Stunned:** it kneels (exists), the heart blazes exposed, and a gold ring lies on the floor round it.

**The Hearts** grow out of the floor as faceted crystals in the heart's light, each feeding a beam into the chest, so wherever you stand the beams point you to them. They crack as they are struck and shatter outward.

**The fall.** It topples (exists). **The back-dial breaks free and rolls**, and **the heart tears out of the cage**, rises above the falling body and bursts into the way home's column (piece 4).

### How it is built

**Model** (`world/sdRemnantModel.js`, rebuilt):

- **The same seven parts** (`SD_REMNANT_PARTS`), so `scenes/sdRemnantRig.js`'s 18 states drive it unchanged. **No forearm parts are added.** The elbows are baked at a fixed bend, with fists at mid-thigh, so poses stay natural without reopening the rig.
- New primitives: `tube` (the gate horn's sweep), `lathe` (helm, bells, gem), `rib` (a 4-segment bent tube) and gear discs from `buildGearModel`, **centred on each joint's pivot** (`SD_RIG_JOINTS` and the pivot table) and owned by the limb below, so they turn for free.
- About 2.6k triangles a body. The Echoes are the same mesh at `remnantScale`.

**Decor draws.** Three scene-driven draws, not rig parts: **heart** (`torso · T(0, heartY, 0) · S(beat)`), **back-dial** and **dial hands**. They are pure functions of the fight state, so a late page shows the right body. `SD_RIG_PARTS` is untouched.

**The blade's tip.** `SD_REM_HAND` moves to the blade's tip. It is only the visual origin of the beam and the gears; the floor band's law does not move.

**Art** (`world/sdRemnantArt.js`). **One 128x128 atlas per metal, one sub-mesh per part.**

- Brass: 6 records (whole or cracked, by off, mid or hot emission).
- Gold and silver: 3 each.
- **The tell's heat is a per-draw `d.texRemap` on the part that tells.** Only that part's UVs sample its glow region, so only the sole, the blade or the fists light.
- Region colours are baked from `SD_BLOW_COLOR`, and the eyes in the Ending's light, at stand, once per Hollow.
- Rib lamps: one small mesh rebuilt on change from `sdHeartsOf`.

**Shadows** (the fight's biggest cost, cut).

- The detailed body draws `noShadow`.
- **A shadow proxy** (today's box body plus eight rib bars, about 300 triangles) draws with `shadowOnly` in its place, so the lamps' cubes pay 300 triangles for a moving body, not 2.6k.
- **The heart's light casts the cage's striped shadow on the desktop lane only**: one body at a time, none in the Break, within 30 m of the eye.

**Light:** the heart's point light in the Ending's light, range 9, pulsing with the beat, x2.5 on the Pulse and the Reset, entered first in `host.sdRealmLights`. In the Break each Echo carries its own (gold, silver), so the floor leans to each without extra lights.

**The Volley's gather:** `sdGearsAt` stands the gears at `SD_REM_HAND` from `volleyGather`.

**The Break:**

- `d.dissolve` on the Remnant's parts over 0.8 s.
- **After-images:** each Echo's 7 parts are drawn again at `remnantRig` and `echoPose` evaluated at t − 200 ms (both pure), with `d.dissolve` 0.3, `noShadow`, and the eyes remapped dark. Desktop lane only.
- Sigils and the Echo window's arc come from `sdArenaGlow`.

**Vents:** `gateFx` `vent` bursts at the pipe tips on wind-ups (`atkWindup`).

**The Hearts:** `render/courtCrystals.js`'s proven pass (WB9c: grow, crack, shatter, the ribbon into the chest; `CRYSTALS_DRAW_MAX` 8 equals the Hearts' maximum of 8), coloured by `sdHeartColorOf`. `buildHeartModel`'s 8-triangle shards are retired.

**The fall:** at `s.fell.at` the heart detaches and rises 3 m over 1.2 s, spinning, then hides as the `sdFx` fall and home kinds fire. The back-dial becomes a free gear rolling for 2 s on a matrix.

### Files and new modules

- **Changed:** `src/world/sdRemnantModel.js`, `src/world/sdRemnantArt.js`, `src/scenes/sdRemnantRig.js` (decor matrices, the gather window, `SD_REM_HAND`), `src/scenes/sdRemnant.js` (draws, remaps, after-images, dissolve, heart light, rib lamps, back-dial timers, the Hearts through `courtCrystals`, the fall), `src/render/renderer.js` (`shadowOnly`), `src/render/courtCrystals.js` (driven from the Hour), `src/scenes/sdFx.js` (vents), `src/scenes/world.js` (heart lights), `src/tools/abyssLab.js`
- **Tests:** `test/sd17_body.test.js` (the hand point, the decor parts), `test/sd8c_remnant_page.test.js`, `test/sd18c_endings.test.js`, `test/sd16_fx.test.js`

### Cost

- **Draws:** 7 parts plus 3 decor = **10 a body** (today 9), plus 1 proxy shadow record.
- **Break:** 2 x 10 plus after-images 2 x 7 = **34 on desktop, 20 on phones** (today 18).
- **Hearts:** up to 8 in the crystal pass's two proven programs.
- **Triangles:** about 2.6k a body.
- **Textures:** 12 records at 128x128 x 2, **about 1.5 MB** (phones paint at 64x64: about 0.4 MB).
- **Lights:** 1 (2 in the Break).
- **CPU:** the rig already runs; add 3 decor matrices a body plus one extra `remnantRig` per Echo: about 0.03 ms.

### Enhanced lane and classic set

- **Lane:** the cage shadow from the heart, the tells and the heart blooming at their peaks (0.85 and up).
- **Classic:** no shadows. Halo quads at the heart, the eyes and the blade's tip, and the emission atlases carry every tell.

### Phones

- No after-images, no heart shadow, 64-px atlases, the back-dial without its hands' detail.

### Lab check

| View | What must be true |
|---|---|
| `remnant-hub` | The head at the face's hub; the silhouette reads at 50 m on both lanes |
| `remnant-turntable&rig=<state>` | All 18 states x 8 yaws pose cleanly |
| `?fight=stomp&wt=0.8` | Sole hot |
| `?fight=hand&wt=0.5` | Blade half-heated |
| `?fight=break` | After-images dim and eyeless |
| `?fight=stun&st=4` | Back-dial hand halfway |
| `?fight=reset&hearts=5` | 5 rib lamps |
| `?fight=fell&age=0.6` | Heart rising, dial rolling |
| `?law` | Nothing below 2 m crosses the r 2.2 cylinder |
| A shadow probe | The lamps' cube faces record only the proxy |

---

## The build order

Each slice is shippable and checkable on its own, ordered with the most impactful first. Every slice:

- Writes its record in `Super-Dungeons.md` section 16, amending sections 6-10's visual sentences, with cites as anchors (`npm run cites -- --apply`).
- Retires and rewrites the pins it moves; every new pin must fail under a one-character mutation.
- Names all four hosts (`exterior.js`, `world.js`, `worldModes.js`, `dungeonContext.js`), each wired or flagged.
- Runs the bible's gates (`test/manifest`, `citeanchor`, `citedrift`, `mutantdrift`, `audit18_bible_docs`, `ledger`), lint, types and the slice's own tests.
- Carries before and after lab sheets for both lanes, and its patch notes, in the pull request's description.

| Slice | What ships | Depends on | Checked by |
|---|---|---|---|
| **S0: The flash law** | `SD_BEAT_BLINK_HZ` from 8 to 2.5. One constant, a real bug against `TELEGRAPH_THROB_MAX_HZ` | nothing | The flash probe on a Beat plate |
| **S1: Grade, light and floors** | `sdLook`, `sdPixelKit`, `SD_PIXEL_GLSL`. `setSceneGrade` (0.12 / 1.15 / 0.8 / 0.34 / 1.08). The trilight and key. Floors repainted with zero joint emission. Inlay and the compass as geometry. Toothed rims and gold edge lines. Brass emission to edges. The arena's dark plate bands. **The biggest win for the least code: it ends the amber soup** | S0 | Before and after `threshold`, `orrery`, `arena`, `overview`; floor at or under 0.25 |
| **S2: The plumbing** | The dynamic loop's `texRemap`, `dissolve`, `noShadow`, `shadowOnly`, `culled`. The stage cull and stage-split realm mesh. `sdHalo`. The lab's state knobs and views | S1 | Draw counts per stage in the lab; a hot-loop no-op test for draws without the fields |
| **S3: The Hour's sky** | `sdSkyMap` (octahedral, painted), the fetch with live hands, the lowered face, star numerals and constellations, six far skylines, four near shards, the phase overlays | S1, S2 | `sky`, `sky-hub`, the phase knobs, the fold-seam pan, shard clearance pins |
| **S4: The Rift and the Return** | `sdRiftFace` and `face` in `sdRiftPlace`, `sdReturnPlace` by face, `riftLook`, the astrolabe, the iris, the window on the sky map, the crater, the floor light, frozen dust, the lancet Return with its window home. Retires the billboards | S2, S3 | `hollow`, `hollow-far`, `hollow-side`, the `?rift=` states, parallax, `?riftSize=2.6` |
| **S5: The step through** | `sdVeil` (iris on the Rift, the Break, opening shards, the out themes, the shatter), cues, score hand-off, reduced motion | S4 (its screen centre; it falls back to the screen centre without it) | The `?veil=` knobs |
| **S6: The way back and the way home** | Interior-mapped window, forward rings, the same studs, the arrival exhale, the assembling Return, the beacon, the hand-plate | S3, S4 | `back` and the `arena-far&fight=fell&age=` series |
| **S7: The arena's reads** | `sdArenaGlow` (fissures at the landing, the Reset on the rim, the End), pillar visuals and watching hands, lanterns replacing rim lamps, the Stomp wall, the mark, the hold curtain, the Reset's dimming. **Safe wedges built behind a flag pending Mac** | S1, S2 | The arena knobs and the contrast probe |
| **S8: The Brass Remnant** | The rebuilt body on seven parts, the atlases and tells, the heart as metronome with its light and cage shadow, rib lamps, back-dial timers, the shadow proxy, after-images, `courtCrystals` Hearts, the fall | S2, S6 (the heart into the way home), S7 (sigils) | The remnant views and the `?law` cylinder |
| **S9: The Unmoored Steps** | Kind atlases, pendulums, the clock-plates and dissolve, the ghost pass, rack risers, crack stages, chunks and rewind, the vane, waystones, the rewind burst | S0, S2 | The steps views and the flash probe |
| **S10: The Orrery** | Heraldic stones, crown gears, bezels, banners, lecterns, dial geometry, fray tabs, the hall atlas, **the rings in mode A**, the gem, the Concord sequence and plated bridge | S2. Mode B only on Mac's ruling | The orrery knobs and the turn probe |
| **S11: The hang and the Works** | Strata spires, gear rims, chains (all `noShadow`), far islands, the Works | S1, S2, S3 (the nadir glow) | `overview`, `works`, `?law` |

**Mac's rulings to ask before the slice that needs each:**

1. **The Orrery's rings following each stone's hour** (mode B). Section 8 says "the gearing is not shown; it is learned by turning." Mode A is the law-safe default.
2. **Safe wedges behind the pillars** during the Hand: they ease the fight.
3. **The Return's new place** beside the ring's plane. It is a small, deterministic change to `sdReturnPlace`.

---

## Risks and what not to do

**What not to do.**

- **No Numidium in the sky.** Section 7's "the last of the Brass God still walks" *is* the Remnant (section 10). A second one upstages the boss and contradicts the bible.
- **Never show the gearing.** No arcs from a turned stone to its partners, and no ring moving on a partner's turn without Mac's ruling. The crown gears move only with their own hands.
- **No lens through `captureUnderWater`.** It is the water's once-a-frame snapshot, lane-only, and goes stale in a hall with water.
- **Nothing that turns may cast.** The dungeon arm calls `everyLightCasts()` (LA-SHADOW3), so a turning caster rebuilds cube faces every frame. Anything that moves is `noShadow`, or casts through a static or proxy stand-in.
- **No `GL_LINES` for anything a player must read.** WebGL caps them at 1 px, so they vanish on high-DPI phones.
- **No camera moves:** no arrival pitch or FOV settle, no gust roll, no FOV nudges on Stomps or the Reset. They cause motion sickness, fight platforming and pull against aim.
- **No resolve split in `airPass`** for a 0.6 s double image. The resolve is heavily pinned.
- **No brighter fog** and no lifted horizon. The fight needs the black void.
- **No green braziers**, trenches, floor gears or full-floor crack nets under the telegraphs.
- **No balustrade:** it suggests a wall the law does not have. The hold curtain shows the hold only when it is real.
- **Do not re-point pinned constants.** `SD_FX_COLOR`, `SD_GLOW_COLORS`, `SD_BLOW_COLOR` and the Ending lights stay where they are, and `sdLook` imports them.
- **No new rig parts.** Seven parts and 18 states stay; the elbow is baked.
- **No visual larger than the law where the law reads shape:** pillars inside their square, stones within 5 cm of `stoneSolids`, the Remnant inside r 2.2 below 2 m, teeth and roots outside every collider disc. Players believe silhouettes.
- **No flash over 3 Hz anywhere.**

**Risks and their guards.**

1. **The hot loop.** The five loop fields go into `worldModes.js`'s dungeon draw loop, the most heavily pinned host in the repo. Read each field only when present, and add a no-op test for draws without them. Run the host's own test files; the change moves most of the suite, so the rest goes to CI.
2. **Facing determinism.** `sdRiftFace` must agree on every client. Pin it over `test/sd11f_scenes.test.js`'s templates, including the half-height plane rays (pillars) and ties.
3. **The sky map is new architecture**, even without cubes. Paint only outside an open 2D run (before `beginFrame` or inside `withTarget`). Keep anything fast (hands, phases, Pulse flashes) in the fetch, never the map. Check NEAREST at the octahedral folds. Hand the map from the Hollow to the realm with a single owner that frees it.
4. **Shadow cost in the fight.** The 20 realm lamps all cast. Stand the Remnant's proxy in for it, keep roots, Works, shards and turning parts `noShadow`, and keep lamps off the Steps. Profile the Break on a phone; drop the after-images first.
5. **Ending colour collisions.** Daggerfall's Ending light is nearly the way out's moon, and Orsinium's is nearly Mantella. Shape, place and motion must carry every read; the `?grey` checks guard it.
6. **No mips.** Floors at 32 texels a metre will shimmer if painted with contrast at the scale of one texel. Paint contrast in 4-8 texel features, and keep edge lines as geometry, not texel rows.
7. **The crater's floor texture.** It reads the player's own ARENA2 at runtime, which is allowed. It must fall back cleanly in the lab and after a PLACE-LRU eviction.
8. **Late pages.** The way home's stages, the heart's flight, the Concord's state, the arrival exhale and the collapse's studs are all pure functions of `s.fell.at`, the word or the anchored clock, never of when the page arrived.
9. **The score.** The veil's quarters must hand off to `sdScore` (it waits for the open), or two broken quarters stack.
10. **The mirror.** The compass, the vane, the second hand, the iris's turn and the "backwards" hands all go through the camera's one mirror (`world/mat4.js`). AUDIT SD II and III both learned this, so pin it with lab probes.
11. **Retro Mode.** Pixel-snapped passes snap to the retro image's pixels, or they go double-chunky.
12. **Allocations.** The Rift's meshes and pass, the sky map, the shard atlas, the beacon and every new record are freed by the module that made them, from the path that ends their life. `sdEnd.clear()` frees mid-animation.
13. **Pins that move.** These slices move `riftFrame` and `RIFT_FRAMES` (sd4b), `SD_CLOCK_FACE`, `CLOCK_BASIS` and `SD_SHARD_TOP` (sd5b, sd23), realm art sizes, emission and `SD_FLOOR_TILE_M` (sd5a), hall art (sd6c), `SD_BEAT_BLINK_HZ` and step meshes (sd7b), the Remnant's model and `SD_REM_HAND` (sd8c, sd17), the Hearts' model (sd16, sd18c) and the arena art (sd20c). Each slice rewrites its own pins, and none rewrites another's.