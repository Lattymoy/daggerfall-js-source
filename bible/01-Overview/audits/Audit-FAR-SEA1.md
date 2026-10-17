# AUDIT FAR-SEA1 - the sea's cost measured, its seam made the water's, 2026-10-11

Mac, of FAR-SEA1 (`07-Rendering/Water-Arc.md`, PR #765 - "Anyway we can fix the draw distance for oceans without
affecting performance?"): *"Audit this"*. Five lanes read the frozen branch (`1f63ab10`, main merged in), each
independently, each verifying its own findings - with the repository's GLSL evaluator (`test/glsl.mjs`) on the real
shaders, node probes on the real modules, or Chromium (SwiftShader) - before reporting:

- **the GL** (A): the shaders, their compile and link, the vertex attribute, the depth, the water's branch;
- **the hosts** (B, H): the frame's order, the brackets that call `beginFrame` mid-frame, the game states, the four hosts;
- **the record** (C): the pins against their own mutations, the producers, one home, every claim in the docs;
- **the seams** (D, L): the streamed sea against the ring's, in numbers, by day and night, every Land view tier;
- **the cost** (E, P): what the slice costs on the GPU and the CPU, against its own claim of "no geometry grows".

Where two lanes found the same fault the ids are joined. Each fix carries an `AUDIT FAR-SEA1 <id>` comment and is
pinned in `test/render/audit_farsea1.test.js` (4) or `test/render/farsea1.test.js` (10, rewritten), or in the moved pin it names;
it is mutated in `tools/mutants/audit_farsea1.json`: **20 mutants, 20 dead**. The slice's own campaign,
`farsea1.json`, is **14, 14 dead** after the fixes (seven re-aimed by content at the code they rewrote), and so are the
records in other campaigns the fixes moved: `perfsun.json` (25, one re-aimed) and `eldistance.json` (5). PIN MOVED, each
marked in place: `test/render/el1_enhancedlighting.test.js` and `test/render/perf2.test.js` (the ring at the far plane by its
pass's `depthRange`, no depth write), `test/world/terrain/water.test.js`, `test/render/waternext.test.js` and `test/render/waterlit1.test.js` (the
water's light, Fresnel, lobe and glints through the open sea's one text), and `test/ui/automap/roadc_panelframe.test.js` (the
bracket names the sea's haze).

## What it costs

| | before FAR-SEA1 | FAR-SEA1, as audited | after the audit |
|---|---|---|---|
| Ring fragments shaded, raised eye over the sea (300 up, 10 degrees down, 1080p) | 5% of the frame | **58%** (the fill, with the shader run before its depth test) | the ring's 5% and the fill's counted cells - 0 at Land view 5 from the pixel's centre, a corner's 12 at 6 |
| Mean fill shaded over 300 random views | - | 54.6% of the screen | 3.4% (no shown pixel lost) |
| The ring's own fragments behind the streamed world | shaded (gl_FragDepth) | shaded | rejected before the shader (`depthRange(1, 1)`) |
| A land fragment of the ring | the ground's light | + the sea's Fresnel and sky, weighted to nothing | the ground's light (a branch on the sea's weight) |
| A water fragment | the world's fog | + a sqrt, two divides and a smoothstep, every fragment | + a smoothstep under a uniform branch |
| A pixel crossing | one index buffer | three (221 KB to 445 KB of garbage at Land view 6) | one |
| Per frame, the Enhanced water off | - | a sky object | nothing |

SwiftShader timings (relative only): the lane's ring from 300 up at Land view 5, 9.8 ms without the fill, 39.6 ms with
it whole, 11.3 ms counted.

## Fixed

| id | lanes | what was wrong | the fix |
|---|---|---|---|
| P1 | A1 = E1 | The ring wrote `gl_FragDepth = 1.0`, so its fragment shader ran before its depth test (no early or hierarchical rejection), and the fill rasterized the whole streamed sea: 55-60% of a raised view shaded to show in under 1% of it. PERF2's "they shade only the pixels nothing nearer has claimed" was never true of the ring. | `depthRange(1, 1)` around the draw places every fragment at the far plane by the viewport - the same picture byte for byte (both lanes measured it), the test before the shader. The fill's cells sorted farthest first (`reach`: the farthest corner from the hole pixel's centre) and a frame draws only those that can lie past the world's far plane from the eye: `seaFillCount` - a point's view depth is never more than its distance, and a cell's points are no farther than hypot(reach + offset, h); the far plane read from the world's own lens (`perspectiveFar`), with 1% in hand for its float32 storage; none with the eye under the sea. |
| L1 | D1, A2 | The ring's sea was the overworld's ocean tint lit with the full sun, the water's a climate texel under the water's tint lit with 0.6 of it. With the sky terms equal, the bodies were the step: about 3 units at the default edge, and worse than before the slice where the edge stands inside the fog's ramp (Land view 1-3 under Dynamic Skies' Sunny: up to 24 in blue at Land view 3). On the lane the body also went through the ground's tonemap and eye. | `SEA_LOOK_GLSL` - the open sea's light, one text - which the water's fragment shader calls, and `ringSea`, the ring's sea at a flat normal from the same body: the camera climate's water texel (`seaGroundArchive`, the archive Iliac Puddle No More's sea already used, one home) fetched in the vertex shader, under `WATER_TINT` and the mod's open-sea tint. The lane computes it in the water's own space from the frame's light as given. Run on both shaders, the seam meets to under half a unit. |
| L2 | D2 | The water's sun and moon glints survived to the grid's edge at the hold (up to 9 units on a low sun ahead) and stopped there; the ring had none. | The ring's sea takes the water's own lobes and weights (`seaSunLobe`, `seaMoonLobe`, `seaGlints`) with the normal up. |
| L3 | A, D (unconfirmed) | The water's arm was a step at the band's edge: water running down to the sea across sea level + 1 jumped from the hold to solid fog along a line. | The arm fades over the band's outer half (smoothstep 0.5 to 1). |
| P3 | E3, C4 | The water's arm recomputed the distance and the ramp (a second copy of FOG_GLSL's linear law, with another guard) on every water fragment, and its rim term can never reach the streamed sea (the rim opens at 16.8 km, the grid's farthest corner is 8.1 km). | The arm is the world's own factor floored: `fw = mix(fw, max(fw, 1.0 - hold), seaW)` - identical to the law there, pinned against FOG_GLSL's own `fogFactorAt`. `uSeaHaze` is the hold and the sea's height. |
| P2 | E2 | The sea's look ran on every ring fragment, land included, weighted to nothing. | A branch on the sea's weight. |
| P4 | E4 | A crossing built the ring's indices and the fill's in two arrays and copied both into a third. | One buffer, the fill written after the ring into the hole's own room. |
| H1 | B1 | `panelFrame`'s own `beginFrame` cleared the sea's haze and its restore did not bring it back, so a decorator's preview drawn between the water and Iliac Puddle No More's open sea dropped the haze from the open sea for the frame. | The bracket saves and restores `_seaHaze` beside the sea's fog; `test/ui/automap/roadc_panelframe.test.js` names it. |
| H2, P5 | B3, E5 | With the Enhanced water off the ring's sea still took the water's look beside Daggerfall's flat tile, and the sky was read for it every frame. | The sky is read only with the water on; without it the ring's sea is the ground's, as before the slice. |
| H3 | B2 = C6 | The record named only the streaming host (THE FOUR HOSTS RULE). | Water-Arc's FAR-SEA1 names all four. |
| C1-C3, C7-C11 | C | Pins that could not fail: the ring's fog inversion and a dead sea line survived (only substrings were pinned); the facing's inputs were pinned on hand-built values, not the vertex shader's lines; `indexOf(...) < at` passed on -1; the band's value, the horizon's upload, the clamp of a negative facing and the open sea's four components were unpinned; the renderer test hand-built the water's uniforms. | `test/render/farsea1.test.js` rewritten: whole lines in order, the producer's lines, the found index, the band's 1, both of the sky, a facing of -0.3, all four components, `waterUniforms`' own shape. |
| C5 | C | `03-World/Sea-Update.md` still said the ring's sea reads a shade darker. | Retired there, as Deep-Waters.md's was. |
| C12 | C | `seaSky` restated the water's Fresnel and sky lines. | One text (L1). |
| C13 | C | Claims not true of the code: "no geometry grows" (a 9,409-byte buffer and the fill's triangles), "lit as the water is" (only the Fresnel was), "the land's seam unchanged" (inside the ramp it closed), the Deep-Waters retirement without its conditions, and the hole's "skips every cell" in farRing.js and EV8's record. | Each amended in place. |

## Recorded for Mac, not changed

- **D3 - the land in the band.** Past 0.85 of the fog's end the sea now holds at 85% while the streamed land, the
  islands, the boats and the coast beside it go on to solid fog, so far land reads as a pale flat shape on a darker
  sea (about 10 units). Before, the band hid both. Applying the cap to every streamed linear fog on a frame the ring
  draws would close it, and EV8's land seam with it, but it would show the streamed world's own edges (the far
  plane's clip over land, a pixel streaming in) through the haze - a look to choose, not a fix to ride in.
- **D4 - how far the sea reads.** The slice makes the sea continuous to the horizon; it does not make it more
  visible. At 85% the sea's contrast to the fog is about 9 units at 5 km and 4 at 20 km, and the ring's sea now
  reflects a sky close to the fog's colour, as the water does, where its flat ocean tint read darker. A sea that
  reads further is a lower hold for the sea (the seam no longer amplifies a body mismatch, so it is safe to choose),
  and it widens D3's contrast.
- **D5 - the travel view.** The ring measures its haze from the raised camera, the world's fog from the traveller.
  At Land view 5 and 6 the seam sits in the hold and the difference is nothing; at 3-4 under Sunny it is up to 30
  units at the travel view's 450 m, pre-existing and smaller than before.
- **L4 - the shallows past the fog's end** read up to 6 units toward the fog: what is seen through the water keeps
  the world's fog (the premultiplied law), the water's own share the hold. Deep sea is unaffected.
- **A low island straddling the far plane** in the grid's corner shows the fill's sea where its clipped part stood,
  where it showed the sky before; beyond the rect the ring always behaved so.
- **Coast and land cells in the clipped corners** still show the sky: only cells with four sea corners fill (a land
  cell could stand above the streamed silhouette - the case the hole exists for).
