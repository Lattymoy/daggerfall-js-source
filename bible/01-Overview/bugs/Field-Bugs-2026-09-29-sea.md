# FIELD BUGS 2026-09-29 (the sea) - five reports from the Discord, through Mac

From the Discord's user reports, through Mac (verbatim):

> 1. The player sprite doesnt seem mounted to the deck when the ship moves around
> 2. Aquatic creatures cause collison
> 3. You should be able to scroll and zoom out farther
> 4. Water flickers from a distance
> 5. Add a ship combat test menu option

And: *"And just to make sure, I want the performance to be absolutely flawless."*

| # | Report | Root cause | Fix | Pins | Mutants |
|---|--------|------------|-----|------|---------|
| 1 | the sprite not on the deck | the helmsman never said where they stood (drawn from a lagged world pose while their boat was led ahead); a passenger stood in the root's frame while the owner's deck rocked; a body carried by a deck read as walking | the helm word; the deck pose under the glue; pace and the moving bit measured on the deck | `test/net/peer/fbsea_deck.test.js` (4) | 7 |
| 2 | aquatic creatures collide | a swimmer frozen while the player is aboard read GROUNDED (`velY === 0`), its ray down met the hull from inside, and Come Sail Away made it a rider | the rider reads the motor's own CharacterController.isGrounded | `test/characters/enemy/fbsea_aquatic.test.js` (2) | 3 |
| 3 | zoom out farther | both cameras stopped at their references' foot distances beside ships 44-93 m long, and the helm's own rig pinned the camera | a helm's zoom reaches three of the hull's half-extents by a ratio a notch; the camera passes her own buckets | `test/player/fbsea_zoom.test.js` (3) | 6 |
| 4 | water flickers from a distance | Come Sail Away's frames have one mip level (the breakers boiled); the sea's sheets 3-10 cm apart fought in a 24-bit buffer from a raised eye | the frames' chains; the sea's stack in window depth | `test/render/fbsea_water.test.js` (8), `tools/fbseaWaterProbe.mjs` | 15 |
| 5 | a ship combat test option | none existed | the Test Room's Sea battle | `test/systems/fbsea_testroom.test.js` (4) | 6 |

`tools/mutants/fbsea.json`: 37 records, all dead (two survivors on the first run - the deck key and the Bay's stage - each
closed by a pin that could fail it). Four older records re-aimed by content (`csa_together.json` CSAK-aboard-glue-axis
and CSAK-host-ahead-real-clock, `htwaist.json` HT-WAIST-BACK-the-walker-pace-unmeasured, `macbugs.json` MAC-A), all dead.

## #1 THE SPRITE ON THE DECK

**Reproduced first.** `test/net/peer/fbsea_deck.test.js` over the real Small Ship: a passenger said at rest and stood in her
root's frame is 0.3 m and more off her rocking deck at the bow; the helmsman had no word at all, so a reader drew them
from their world pose; a peer carried at 6 m/s standing read a 6 m/s stride.

**Why.** Only the others aboard said where they stood; the player at their own helm was drawn from their world pose - a
send behind - while their boat was LED ahead by its way (`scenes/comeSailAway/comeSailAwayPeers.js`), so they trailed the wheel by
their speed times the lag. A passenger's place was stood about the boat's root, and Come Sail Away rocks the MeshObject
under it (the bob), so on the owner's own screen the deck moved out from under them. And the moving bit and the pace
were read off the world, where the deck's own way is a stride.

**Fix.** `scenes/comeSailAway/comeSailAwayAboard.js` `helmWord`: the helmsman is said as a passenger is - the helm (DrivePosition) at
rest in her root's frame (the chain composed in doubles, her bob left out), the feet half a height under the pinned
transform, one word whatever her bob. `deckPose`: the root composed with the bob about the MeshObject's place, so a
place said at rest is stood where the rocked hull holds it (the wire unchanged - the bob is the glue's). The glue hands
`deck` and `deckKey`; `net/peer/peerBodies.js` and `net/peer/peerRiders.js` read a body's pace off its place on the deck, afresh
on a new deck; the host's moving bit is measured on what carries the player (a deck aboard, the boat sailed).

## #2 AQUATIC CREATURES

**Reproduced first.** `test/characters/enemy/fbsea_aquatic.test.js`: a slaughterfish frozen 2.5 m under the sea line with the real Small
Ship over it - its ray down its height meets her hull from inside (the port's meshes answer from either face), and the
world's rider handle, lifted from its source, read it grounded.

**Why.** A swimmer is frozen while the player is aboard (Iliac Puddle No More hands DFU a water level only while the
player swims; WaterMove moves nothing without one), so a hull sailing over one passes around it. The port read it as
GROUNDED - `velY === 0`, which WaterMove never touches - and Come Sail Away's FixedUpdate took it as a rider, carried
inside the ship. **Fix.** The rider handle reads `ai.isGrounded`, the motor's own CharacterController.isGrounded:
whether its last Move stood it on something (false if it never moved), written by every one of the motor's Moves
(`characters/enemy/enemyMotor.js`, `ai/enhancedMotor.js`).

## #3 THE ZOOM AT A HELM

**Reproduced first.** `test/player/fbsea_zoom.test.js`: the Morrowind camera stops at its reference's 800 units (11.4 m) and
Eye of the Beholder at its -10; at the galley's wheel her own rig pins the camera a few metres out.

**Fix.** `player/seaZoom.js` (the one home both cameras read): at a helm the zoom reaches SEA_ZOOM_REACH (3) of the
sailed hull's largest half-extent (her mesh's own bounds - a Small Ship 66 m, the galley 140 m), each notch past the
foot's far end a ratio (1.2), so the reach is a dozen notches (HELM-ZOOM, 2026-09-30, Mac: "increase the sensitivity of the scrolling for zooming out and in when on the wheel": 1.5 a notch, and at a helm the whole range by it - the Morrowind camera's from its nearest ring, Eye of the Beholder's from its own base; their foot ladders of ten units and 0.2 m had taken 77 and 40 notches before the ratio began, and from first person to a Small Ship's reach is 13 now); off the helm the reference's far end returns and the
save keeps no more. The camera's casts pass the sailed boat's own collider buckets (`csaCameraFilter`). A departure
from both references (Port-Ledger, the Eye of the Beholder and MAC-A camera rows).

## #4 WATER FLICKERS FROM A DISTANCE

**Reproduced first, on a real pipeline.** `tools/fbseaWaterProbe.mjs` draws a synthetic coast with the port's own passes
on SwiftShader (a 24-bit depth buffer): Iliac Puddle No More's floor and top, Come Sail Away's waves from
`buildWaveMesh` in the author's own two paints, under the world's lens (0.2 to 6000). The camera bobs by centimetres,
as a deck carries it; a pixel whose colour changes between bobs of a still scene is a flicker. Before, the share of
each band's pixels that changed (the strip at 150 m and more from the eye):

| camera | coast | the breakers | the beach under the top |
|--------|-------|--------------|-------------------------|
| the helm's eye (5 m) | 300 / 700 / 1500 m | 78% / 98% / 91% | 0 |
| third person (12 m) | 300 / 700 / 1500 m | 72% / 81% / 99% | 0 |
| sea zoom, Small Ship (66 m) | 300 / 700 / 1500 m | 40% / 62% / 94% | 0 / 17% / 100% |
| sea zoom, galley (140 m) | 300 / 700 / 1500 m | 32% / 42% / 79% | 69% / 23% / 97% |

With the breakers painted flat (`--solid`) they held still at 300-700 m: their flicker was their texels.

**Why - the breakers.** The mod's 32 frames ship as one level each, point-filtered (the bundle's Texture2Ds:
m_MipCount 1, m_FilterMode 0), tiled ten times over strips hundreds of metres long: from a few hundred metres a pixel
covers dozens of texels and picks one - another each bob. DFU draws them so too.
**Why - the sheets.** The sea is a stack of sheets centimetres apart - the beach at the sea's own 34 m, Iliac Puddle No
More's top 3 cm over it, the breakers 10 cm up. Unity parts them on a reversed floating-point buffer at any range; this
port's world pass is the GL convention's 24-bit buffer, where a step of depth is z^2 / (0.2 x 2^24) metres of eye
depth, and from a raised eye the top over the beach was a fraction of a step at a few hundred metres - the rounding's
to decide, and it moved with every bob. WATER1 had met the law first (WATER-AUDIT M3's offset); the top and the
breakers came later and never took it.

**Fix.** `systems/comeSailAway/comeSailAwayWaves.js` `boxLevels` / `wavePaintLevels`: each paint is uploaded as a chain - level 0 the
paint itself, past it the mean of the frame it composes, premultiplied, the snow record at its mean colour (a level's
texel spans 2^L of the record's). The wave shader picks the level NEAREST_MIPMAP_NEAREST would (GL ES 3.0 3.8.10): at
level 0 - a texel a pixel and nearer - the mod's own read and cut, texel for texel; past it one fetch of the chain, its
coverage dithered by the material's own Bayer table. A departure (Port-Ledger, the Come Sail Away row).
`render/waterSurface.js WATER_LAYER_UNITS`: the sea's stack in WINDOW depth - the surface film (Iliac Puddle No More's top, WATER1) two
resolvable steps over the ground, the breakers four over the film, the constant term alone; the breakers are drawn
before the film, written, so the film tests against them.

After, the same probe:

| camera | coast | the breakers | the beach under the top |
|--------|-------|--------------|-------------------------|
| the helm's eye (5 m) | 300 / 700 / 1500 m | 0.9% / 8% / 0% | 0 |
| third person (12 m) | 300 / 700 / 1500 m | 5% / 4% / 17% (a three-row strip) | 0 |
| sea zoom, Small Ship (66 m) | 300 / 700 / 1500 m | 8% / 3% / 6% | 0 / 0 / 0 |
| sea zoom, galley (140 m) | 300 / 700 / 1500 m | 5% / 5% / 3% | 0 / 0 / 0 |

What remains is a point-sampled level's own texel edges under a moving eye, the look every point-filtered texture has.
(The helm's eye 700 m row reads 100% before and after: one pixel row at that grazing angle, straddling the top's edge.)

## #5 THE SEA BATTLE

**Fix.** `systems/testRoom.js` TEST_SEA: the Test Room's "Sea battle" card - the baseline preset landed on the open Bay
south of Daggerfall (FIELD-CSA2's pixel, 209, 216, proven to float a Small Ship on the retail data), put at the helm of an
armed Small Ship there and a pirate brig launched on open water off her bow (the naval host's own `spawnShip`), Come Sail
Away and Naval Combat turned on at the door. A spawn outdoors, as the ride is (`testStartsOutdoors`). World.js's
`seaTest` stands it a stage a frame from the spawn gate: the Bay reached (the teleport's own build awaited), her hull put
on the sea along the way with the most water before land, her helm taken, and only at her helm the pirate. Every door
that finds no fight says so and leaves the player standing.

## Performance

- #1 to #3: no allocation and no draw per frame. The helm word and the camera filter are cached (`csaSeaReach` a
  WeakMap by boat, the filter by boat and the bucket count); the deck pose composes a few quaternions for a boat drawn.
- #4, the sheets: the polygon offset is two GL calls per pass - timed on the probe, Iliac Puddle No More's surfaces 16
  ms before and after on SwiftShader (the software rasterizer's own scale).
- #4, the frames: built once, at boot beside the paints' decode (about 12 ms a paint warm); +0.55 MB of GPU texture a
  paint. The wave shader past level 0 makes ONE fetch where the mod's makes one or two, and a level's texels are a
  cache's whole working set where level 0's random reads were not. It adds the level's arithmetic - two derivatives, a
  log2 and a few multiplies a wave pixel: SwiftShader, which emulates derivatives and every sample in software, times
  the waves' pass +30% (35 ms to 46 ms, the strip over half the screen); a GPU runs them in the texture unit's shadow.
  No real GPU could be timed in this session.
- #5: the stages run from the spawn gate once each and then never.

## Residuals

- The Sea battle was driven over stubs and its pieces over their own suites; no retail ARENA2 in the session, so it was
  never booted in a browser.
- The breakers' last 1-8% (a level's texel edges under a moving eye); the naval pass's own marks (foam 4 cm, the zone 6
  cm over the sea) are within the guns' reach and were not put in the stack.
