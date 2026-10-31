# Graht-Oaks

Valenwood's giant trees. Over Grahtwood, Malabal Tor and Greenshade a graht-oak stands at most every 102.4 m: a trunk
20 to 30 m across flaring into buttresses, limbs leaving it 66 to 98 m up, and a crown of flat-bottomed leaf masses
134 to 215 m over the ground. The crowns overlap and close most of the sky; light comes through their gaps. Under them
Bantha's jungle (`Bantha-Jungle.md`) stands its four storeys. The player meets them walking or travelling in Valenwood.

## How it works

- **The tree** (`src/world/jungle/grahtOakMesh.js`). Made, not loaded: three variants (`GRAHT_VARIANTS`), each a
  skeleton (`grahtSkeleton`) seeded by `grahtSeed`, so every LOD is the same shape. A ringed, fluted trunk sunk 9 m;
  six to eight buttress fins (`finSection`) with surface roots; seven or eight limbs spiralling up, each forking twice;
  52 to 59 leaf masses; lianas. `grahtOakMesh(variant, lod)` builds three flat-shaded submeshes (bark, leaves, cards)
  at three LODs, every face wound outward.
- **The textures** (`src/render/grahtOakArt.js`) are the port's own, painted from tiling value noise: bark, leaves and
  leaf cards, a handful of shades each, with a tint per variant (`GRAHT_TINTS`).
- **Where they stand** (`src/world/jungle/grahtOaks.js` `grahtSites`). The terrain worker runs them first in
  `src/world/terrain/jungleNature.js` `jungleLayout`, where the job carries the canopy's field. One site per 16-tile cell
  (`GRAHT.cell`), the tree in the cell's middle 40% (`GRAHT.inset`), so no foot crosses its pixel. 90% of sites stand at a
  whole canopy (`GRAHT.occupancy`), thinning to none at the canopy's line. Every draw is a hash of the world tile, so a
  tree stands in the same place on every client.
- **What a foot never stands on.** Only land tiles (dirt, grass, stone and the edges between them), no road or trail,
  no place's rect or clearing, no water or beach, nothing past 50 degrees, the trunk's tile no steeper than 34 degrees,
  and ground no rougher than `GRAHT.bury`. The tree sinks to the lowest ground under its foot.
- **The storeys under them** keep off their feet (`grahtFootMask`): canopy trees, young trees, palms and roadside pairs
  off the whole foot; floor plants off the trunk.
- **In the game** (`src/scenes/grahtHost.js`). The jungle host builds it past the Bay; the trees' host frames it. The
  stand gives each tree collision bodies on the trunk and along each buttress (`grahtBodies`). The GPU objects
  are made on the build's slice clock the first time a tree stands. Each frame culls to the view, the fog's reach and
  the jungle's haze, picks a LOD and hands at most 24 instanced draws to the renderer's third tree slot. The nearest 24
  trees cast into the sun's shadow maps. Under the travel view every tree is drawn, and a crown between the eye and the
  traveller is seen through by the trees' screen-door (`src/render/lowPolyTreesGlsl.js` `TREE_SEE`,
  `07-Rendering/Low-Poly-Trees.md`). It still casts.
- **Light under the canopy** is `src/world/jungle/jungleCanopy.js`'s, with the canopy's top at the crowns.

## Rules

- Super tall low-poly trees with branches and leaves that cover the sky, replacing the drawn canopy ceiling (the owner).
  Built for Valenwood, where the owner's call for a sky covered by trees stood; Vvardenfell has no canopy.
- The crowns close about 93% of the sky overhead, with gaps for light. No far canopy fill is drawn.
- No graht-oak stands in a town: trunks stand round it and crowns overhang its edge.
- Collision is the player's and the foes' (the prop-bodies law): a foe in a trunk or a buttress is put at its edge
  (`src/characters/foeSpacing.js` `keepFoesOffBodies`). Peers, arrows and the camera pass through. No one climbs them,
  and Logging cannot fell them.
- `?graht=off` removes them offline (`grahtOaksOn`). Online they always stand. `?jungle=off` takes them with the
  jungle.
- Only the world host is wired. The exterior bench is the Bay's map, where no canopy closes; interiors and dungeons
  stand no wilderness.

## Daggerfall Unity

DFU stands nothing over its flats but its own models. Over Valenwood the sky is the graht-oaks' crowns, procedural
trees drawn by the billboard program's mesh mode: a departure (TAMRIEL'S BIOMES).

## Code and tests

- `src/world/jungle/grahtOakMesh.js` - the tree and its LODs
- `src/world/jungle/grahtOaks.js` - the sites and the foot mask
- `src/scenes/grahtHost.js` - stand, bodies, GPU, frame, casters and teardown
- `src/render/grahtOakArt.js` - the textures
- `test/world/graht1_oaks.test.js` - the mesh, the sites, the storeys off their feet, the sky cover from the floor,
  the bodies, the host and the wiring
- `test/world/valenwood_canopy.test.js` - the canopy's light
- `tools/grahtOakProbe.mjs` - photographs them headless
- `tools/mutants/graht1.json` - the mutants

## Open

- The far ring draws Valenwood's land in its rainforest tint with no trees; a canopy on the ring is its own change.
- Falinesti and Elden Root, towns in the trees, are not built here.
