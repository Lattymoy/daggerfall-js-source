# Valenwood's graht-oaks (GRAHT1, 2026-10-26)

**The owner (2026-10-25): "Vardenfell needs proper super tall low poly tree sprites with branchs/leaves that expand to
cover the sky. The current simple skybox method is very low quality and band aided".**

**What it named.** The "simple skybox method" covering a sky is VALENWOOD-CANOPY's ceiling of leaves
(`03-World/Tamriel-Biomes.md` "Valenwood's closed canopy"; the owner then: "i want valenwood to have no sky like the trees
will cover it up") - a fullscreen pass at the far plane, value noise on a level ceiling over the eye, drawn over every
sky. Nothing like it stands over Vvardenfell: Morrowind's zones are neither `jungle` nor `canopy`
(`world/tamriel/tamrielBiomes.js`), and no tree, mushroom or canopy of the island's is drawn past Daggerfall's own flats.
So the trees are Valenwood's, and the ceiling is retired for them. If the owner meant Vvardenfell's own giants - the
Telvanni's emperor parasols - those are a slice of their own, which this one's law and host would carry.

**What stands.** The lore's Valenwood is the graht-oaks' - the walking city of Falinesti one of them, Elden Root another's
crown. Over Grahtwood, Malabal Tor and Greenshade a graht-oak stands at most every 102.4 m of the world's lattice: a
trunk 20 to 30 m across at a man's height flaring into its buttresses on the ground, its great limbs leaving it 66 to 98 m
up, climbing and forking, its crown of flat-bottomed leaf masses 134 to 215 m over the ground and reaching 85 to 124 m
from its trunk. The crowns overlap: from the forest floor they close 93% of the sky overhead and 94 to 99% of it lower,
and the light comes through their gaps. Under them Bantha's jungle (`03-World/Bantha-Jungle.md`) stands its four storeys
as before - the graht-oaks are a fifth over them - and the haze lies in the trunks. Low-poly and flat-shaded, in the
port's own pixel-art pictures, they are drawn as the game's other 3D trees are: lit, fogged, hazed and lantern-lit by the
billboard program under either lane.

## The tree (`world/jungle/grahtOakMesh.js`)

Made, not loaded: every vertex is a function of its variant's seed (`grahtSeed`, a mulberry32 stream). Three variants
(GRAHT_VARIANTS), each a SKELETON (`grahtSkeleton`) every LOD is made from, so a far tree is its near tree's shape:

- **The trunk** - a ringed column of `GRAHT_SHAPE.trunk`: 8.6-10.2 m in radius at the ground before its flare, 4.8-5.8 m
  where the crown starts (74-88 m up), 1.6 m at the leader's top (140-158 m), a flare of 3.2 m at the ground falling by e
  every 9 m, a gentle lean (3.5 m) and twist, and flutes in its rings; sunk 9 m, so a slope never shows its foot.
- **The buttresses** - six to eight wedges (`fins`), each from inside the trunk out to its foot (20-24.5 m from the axis),
  meeting the trunk 20-32 m up, thick at the trunk and thin at the edge, snaking sideways up to 3 m; their cross-section
  is one law (`finSection`), the mesh's and the bodies'. Past each foot (LOD 0) a surface root winds over the ground.
- **The limbs** - seven or eight, spiralling up the crown's span (a golden turn a limb, never stacked), 50-70 m long
  (shorter higher), climbing to rise 28-50% of their length, each forking twice (`forks`) at 50% and 82% of its length.
- **The crown** - flat-bottomed masses of leaves (`blob`: 16-24 m in radius, 42-52% as tall, their undersides flattened
  further), two at each limb's end, one over its middle, two at each fork's end and three over the leader: 52 to 59 a
  tree; and two lianas hung from each limb (LOD 0).

**The meshes** (`grahtOakMesh(variant, lod)`, GRAHT_DETAIL): flat-shaded - a face one normal, the low-poly look - in three
submeshes, bark (trunk, buttresses, roots, limbs), leaves (the masses) and cards (the leaf sprays standing out of each
mass's rim and underside, and the lianas, cut by their picture's alpha). Each face is wound so its cross(b - a, c - a)
points out of it: the front face under the renderer's frontFace(CW) through its mirrored projection (measured in the
test), so the solids cull their backs.

| LOD | Reach (m over the tree's scale) | Trunk sides | Limbs | Masses | Faces (variant 0: bark / leaves / cards) |
|---|---|---|---|---|---|
| 0 | under 420 | 16, 14 rings, buttresses and roots | 6 sides, 6 segments, forks | icosphere once subdivided (80 faces), 7 cards each, lianas | 2,337 / 4,720 / 890 |
| 1 | 420 to 1,250 | 10, 8 rings, buttresses | 5 sides, 4 segments, forks | icosahedron (20), 2 cards each | 1,036 / 1,180 / 236 |
| 2 | past 1,250 | 6, 4 rings | 3 sides, 1 segment, no forks | one mass a limb (its masses' middle and reach) | 114 / 180 / 0 |

**The pictures** (`render/grahtOakArt.js`): the port's own, painted from value noise that wraps at each picture's size, so
each tiles - the bark (64 x 128: deep vertical furrows in grey-browns, moss in the cracks), the leaves (64 x 64: clumps
of greens, low in contrast so a far crown never sparkles) and the cards (128 x 64: a spray of leaves on twigs, a liana
hung with leaves that tiles down, cut whole by alpha) - a handful of shades each, nearest-sampled as every 3D tree's,
with their mip chains (the cards' alpha kept at its half cut, so a far spray thins). Each variant's leaves and cards wear
a tint of their own (GRAHT_TINTS).

## Where they stand (`world/jungle/grahtOaks.js`)

The terrain worker stands them, as the jungle's top storey: `jungleLayout` (`world/terrain/jungleNature.js`) runs
`grahtSites` first where the job carries the canopy's field (`canopy` - the jungle host hands it beside the jungle's own,
`scenes/jungleHost.js` job), and they leave the worker beside the flats (`graht`, GRAHT_TREE_FLOATS a tree: x, y, z,
yaw, scale, variant), as the roadside pairs do.

- **The lattice.** A site a cell of GRAHT.cell tiles (102.4 m - a power of two dividing a pixel's 128), its tree somewhere
  in the cell's middle 40% (GRAHT.inset), so the largest foot (29.3 m at the largest scale) keeps 30.7 m from the cell's
  edge: no foot crosses its pixel, and no pixel asks a neighbour. GRAHT.occupancy (90%) of the sites stand at a whole
  canopy, thinning to none at the canopy's line by the canopy's own share (`canopyShare`): the trees are the canopy.
  Every draw is a hash of the site's world tile (`tileDraw`), so a tree stands where it stands on every client, the
  worker and the main thread; its variant, its scale (0.84-1.2) and its turn are its own draws.
- **What it never stands on.** Its whole FOOT - every tile whose middle lies within its buttresses' reach at its scale
  (and half a tile) - on land the jungle keeps (the layout's `footOf`): DFU's dirt, grass and stone and the edges between
  them (`GRAHT_LAND_RECORDS`, the marching squares' records past the water's - where the jungle's own flats grow on the
  three alone, DFU's law; a foot held to them stood on 59% of the Bay's whole jungle's drawn sites, 34.2 trees a pixel of
  57.6, and on 92% over the edges, 52.9 - measured on the freeware, and seen in game: the canopy stood open); no road,
  track or trail tile (the road painter's `paths`, the jungle's trails worn into them), no place's rect or clearing (a
  town's, a dungeon's, a shrine's, a site's), no tile with water in it, no beach, nothing past DFU's 50 degrees; off the
  jungle's trails at its reach (`trailClear`); its
  trunk's own tile no steeper than the jungle trees' 34 degrees; and the ground under its foot no rougher than
  GRAHT.bury (16 m at its scale). A town's trees stand round it, never in it; their crowns reach over its edge, and over
  the roads cut through the forest.
- **Sunk, never floating**: at the lowest ground under its foot, less GRAHT.sink (0.5 m) - the uphill buttresses go into
  the slope, and the trunk's own 9 m under its root takes the rest.
- **The storeys under them** keep off their feet (`grahtFootMask`): every canopy tree, young tree and palm, and every
  roadside pair (its tile test, `standPairs`' `tileOk`), off a graht-oak's whole foot; the floor's plants off its trunk
  (its flare and GRAHT.floorClear, 3 m). Off their feet the jungle stands as it stood; under a canopy tree they took,
  the young trees and the floor take its light.
- **Cost on the worker.** A whole canopy pixel stands about 52 graht-oaks; laying them, and the jungle round their feet,
  costs nothing the layout measures - the jungle's flats they take are fewer than they cost (9.7 ms a pixel against 12.7
  without them, warm, on this machine).

## In the game (`scenes/grahtHost.js`)

A module the jungle's host builds wherever the zones are known (past the Bay) and the trees' host frames
(`scenes/treesHost.js` frame) - HOST-SPLIT: no line of bootWorld's (it stands at its ceiling).

- **The stand** (`stand`, from the pixel's build - `scenes/pixelBuild.js`): the worker's trees, each kept whole or not at
  all off the gate's clearing and the rocks, as every flat; the set rides the built pixel (`grahtOaks`), and its trees'
  BODIES its cover (`grahtBodies` - world/propBodies.js's shape: the player's clamp, `player/bodyClamp.js`, walks the
  player round them): the trunk to where its limbs begin, and each buttress a run of bodies along its line at the
  ground, 2.5 m apart, each on the drawn fin (`finSection`), turned and scaled as the mesh is. They ride the pixel's
  cover set, so a re-skin keeps them and the pixel's release takes them.
- **The GPU** is made when the first tree stands, on the build's own slice clock (`breathe` - a mesh a breath, then the
  pack and the pictures): every variant at every LOD in Low Poly Trees' own buffers (`render/lowPolyTreesRender.js`
  LowPolyTreesGpu - one vertex buffer, one index buffer, the frame's instances), the three pictures through the
  renderer's atlas door, and a caster mesh a variant (its LOD 1's bark and leaves - a card would cast a square). A
  session that never walks in Valenwood makes nothing.
- **The frame** (`frame`): every built pixel's trees, culled to the view (a crown's sphere), to the fog's reach
  (`fogReach` - where the weather's fog leaves 1/256 of their light) and to the jungle's haze (the jungle host's
  `hides`, its own bound, a tree's box at a time), each at its LOD (`grahtLodOf`, by the distance over its scale),
  packed a run a variant and LOD (a counting sort - nothing made a frame) and handed to the renderer's third tree slot
  (`setLowPolyTrees(frame, GRAHT_SLOT)`): the billboard program's mesh mode draws them with the flats' light, fog, haze,
  lanterns and cloud shadow, under either lane - at most nine runs of three submeshes, 24 instanced draws a frame
  whatever the forest's size. They sway a little with the wind (GRAHT_DRAW.sway) and read their sun at their crowns
  (`sunLift`).
- **The sun's casters**: the nearest GRAHT_DRAW.casters (24) within 360 m and a crown's reach of where the cascades stand
  (the eye, or the travel view's traveller) are recorded for the sun's maps (`renderer.recordShadowMesh`), drawn or not -
  so on the enhanced lane the floor, the buildings and the jungle under them stand in their crowns' shade and their
  gaps' light, and the lane's own sun shafts (`render/airPass.js`, its mask the sky the frame left) shine down through
  the gaps where the sun is.
- **Under the travel view** every tree is drawn, and a crown between the eye and the traveller is seen through by the
  trees' fragment half (`06-Systems/Travel-View.md` CANOPY-SEE); it still casts.
- **The teardown** (`destroy`): the buffers, the pictures and the casters. The world holds the host for the session, as
  it holds the trees' doors; destroy is the test host's, and a host torn down while its GPU is made makes none.

**The light under them** is VALENWOOD-CANOPY's (`world/jungle/jungleCanopy.js`): the canopy's top is now the crowns' -
under their underside (80 m) an eye is under the canopy, and over `above` (110 m) more it stands over their tops in the
whole sky's light.

## The four hosts

`scenes/world.js` WIRED - through the jungle's host (built there) and the trees' host's frame and the pixel's build (both
modules it wires), no line of its own. `scenes/exterior.js` FLAGGED - the fixed city is the Bay's map, where no canopy
closes. `scenes/worldModes.js` and `scenes/dungeonContext.js` FLAGGED - an interior and a dungeon stand no wilderness.

## Switches

`?graht=off` (offline - `grahtOaksOn`; online the graht-oaks stand for everyone, since every storey of the jungle under
them keeps off their feet and Logging's trees stand where the room sees them): the graht-oaks gone, the jungle standing
as it did and the canopy's light kept. `?jungle=off` takes them with the jungle.

## Recorded choices

1. **Valenwood, not Vvardenfell.** The owner named Vardenfell; the canopy drawn as a sky was Valenwood's alone, and
   Vvardenfell has no tree of its own past Daggerfall's flats. Built for Valenwood, where the owner's earlier call stood.
2. **Their size.** 134 to 215 m: twice the jungle's emergents (34 m) to their limbs and five times to their tops, so the
   jungle is an understorey and the town under them a village at their feet; under the shadow pass's depth (1,200 m) and
   far under the far plane (6 km). Taller, and the travel view's lowest eye (150 m) would stand
   among more crowns and the sun's far cascade (240 m) would hold fewer of them; lower, and they would read as the
   jungle's emergents again.
3. **Their crowns close the sky, with gaps.** 93% of it overhead - the owner's "cover the sky" - and the gaps are the
   light's: dappling on the enhanced lane, its shafts through them. The ceiling of leaves is retired whole: no far fill
   is kept, since in Valenwood the haze closes the horizon before the trees end (no tree past the fog's reach is drawn
   either), and a fill would draw a sky over the gaps they leave. Past the loaded ground the far ring (`render/farRing.js`,
   `06-Systems/Travel-View.md`) draws Valenwood's land in its rainforest tint and no tree: FAR-LANDMARK's `addLandmark`
   is one landmark's mesh on one pixel (a tower), not a forest of thousands, and a canopy on the ring - its tint leaned
   to the crowns', or its ground lifted by their height - is the ring's own change, left for a slice of its own.
4. **No graht-oak in a town.** A town's trunks stand round its rect and its clearing; their crowns overhang its edge. A
   village built in the trees - Falinesti on its walking oak, Elden Root in its crown - is another slice's.
5. **Collision is the player's and the foes'** (PROP-BODIES' law): the trunk and the buttresses turn the player, on foot
   or mounted, and since TRUNK-FOES a foe (a nature body, `Player-Arc.md`); peers, arrows and the camera pass through
   them as through every flat's body, and no one climbs them.
6. **Not Logging's.** A graht-oak is no tree a player fells; Logging's jungle trees stand under it.

## Departures from DFU (Port-Ledger A, TAMRIEL'S BIOMES)

DFU draws its sky wherever a sky is drawn and stands nothing over its flats but its own models; over Valenwood's forest
the sky is the graht-oaks' crowns - procedural trees of the port's own, drawn by the billboard program's mesh mode.

## Verification

`test/world/graht1_oaks.test.js` (11): the tree made - every variant at every LOD flat-shaded and wound out of itself,
the renderer's handedness measured, its three submeshes, its masses' push (a seventh of a mass's radius) measured, the
same on every run, the LODs' faces golden and their crowns one; the measures golden, colossal over the jungle, a trunk over 20 m across, the drawn tree its measures', the largest
foot inside its cell's inset; where they stand - a whole canopy's sites mostly stood, none without the canopy, thinning to
its line, every foot off a track, a place's rect and water - over the edges between dirt, grass and stone as over grass, never
over water's, the flats still on the three alone - at the lowest ground under it, off the trails, no trunk on a
steep step, every draw the world tile's; the storeys and the roadside pairs off their feet, the floor off their trunks,
the jungle as it stood without them; the sky from the floor (rays against the drawn LOD 0 over a 3 x 3 of whole canopy
pixels: over 86% covered overhead and under 99%, over 92% lower); the bodies on the drawn buttresses; the pictures; the
host (the stand and its keep, the GPU on the slice clock, the runs, the instances uploaded (the trees met out of their runs' order), the culls, no travel-view cull, the
casters nearest first and capped, the teardown, a teardown mid-making); the fog's reach exactly; the GPU's
pack; the wiring. `test/world/valenwood_canopy.test.js`'s law, host and wiring pins moved with it (PIN MOVED, GRAHT1),
and `test/render/volumetricClouds.test.js`'s sky span. `tools/mutants/graht1.json` (72); `tools/mutants/valenwoodcanopy.json`
re-aimed by content (31).

### Seen in the game (2026-10-26)

Photographed headless on SwiftShader by `tools/grahtOakProbe.mjs` (the renders stay outside the tree - game data): the
world booted at Arkbridge, a jump past the Bay to the Grahtwood pixel the probe finds on the page (1396, 1441 - by the
zone's own seed), and the nearest place on the canopy (Nightpool Court, a manor), at noon and at 23:00 in the same boot;
before (the branch head, the ceiling of leaves) and after.

- **Before.** A flat ceiling of leaves - value noise in greens with blue holes and curling strokes - over every sky:
  from the forest floor and over the manor's clearing alike, and from 330 m over the forest no tree over the jungle's
  emergents.
- **After, first.** The trees stood - trunks and buttresses in the haze, tiered crowns, the manor's clearing open to the
  sky with the crowns over its edge, a sea of crowns from 330 m with a road cut through, stars in the gaps at night
  under NIGHT-FOG's lit air - but too open: 45% of the frame was sky looking up at 66 degrees from the floor, where the
  test's flat grass had measured 93% covered. The cause was the foot's ground (Where they stand, above): on the land's
  own tiles 41% of the drawn sites were refused for an edge tile under a buttress.
- **After, the foot on land.** The same view 98% leaves and limbs, the sky in a few gaps; along the floor the trunks
  rise into one roof of limbs and leaves. The night, the manor and the view from 330 m were photographed before this
  fix only: the shared machine's memory killed the page climbing to 330 m on the last boot.
- **Frame times** (`FRAMES`, the probe's): SwiftShader on four cores shared with five other workers' builds and probes -
  the same view swung from 1.3 s to 10 s a frame between boots, so no number here compares a build with another. The
  graht-oaks' own CPU frame, the host alone over a stub renderer: 1 to 3 ms for 6,452 trees out to the fog's 6 km, at
  most 24 instanced draws; their GPU cost wants a real GPU.
