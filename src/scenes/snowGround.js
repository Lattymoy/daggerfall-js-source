// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import {
  authoredTiles,
  settlementsIn,
  siteFootprintsIn,
  snowfallNetwork,
  snowfallNetworkBeyond,
} from './snowfallHost.js';
import { worldPixelKey, inWorldGrid } from '../world/worldWide/worldGrid.js'; // A pixel's one key over the world
import { inBay } from '../world/tamriel/tamrielFrame.js';
import {
  snowGroundHeight,
  snowGroundNormal,
  snowGroundBare,
  snowGroundSnapshot,
  snowPixelX,
  snowPixelY,
  snowGlobalOf,
} from '../systems/snowfall/snowGroundLaw.js'; // One law for the frame and the build worker
import { nearestFirstFrom } from '../world/streamingWorld.js';
import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';

/** @param {any} host */
export function createSnowGround(host) {
  const { blocks, locationIndex, maps, terrainGen } = host;
  // SNOWFALL - the enhanced outdoors' snow (scenes/snowfallHost.js) on the streamed ground as it is DRAWN: each pixel's
  // own surface at its stride and its TileMap (the cap's, where Deep Waters patched one), the sea it carved bare, the
  // roads Basic Roads'. Ticked on every frame, outdoors and in; told each pixel published (OnPromoteTerrainData); drawn
  // after the ground by the ground's own program - its sun, its shadows, its lights and its fog. The adapter reads the
  // stream's bindings when it is asked, never here (they are declared below). BAY-LEFT-GROUND ( "BAY-LEFT-GROUND", the
  // snow's part; the audit "no system left behind in the Bay", D3): THE SNOW ON THE WHOLE WORLD'S GROUND. A pixel off
  // the Bay's 1000 x 500 stood no ground for the snow (pixelOn's bound, and its `px * 1000 + py` key aliased two pixels
  // a thousand apart past it), so Skyrim's winter laid its cover and its caps but no snow to wade, no footprint, no
  // track and no berm. Every pixel of the world's grid now, by its world key; past the Bay the roads are TESA's
  // (snowfallHost.js snowfallNetworkBeyond).
  const _snowPixels = new Map(); // worldPixelKey -> the built entry, this frame (cleared at the frame: a publish lands between frames)
  const _snowIds = new WeakMap();
  const _snowNextId = { n: 0 }; // HOST-SPLIT: a holder, so the snow's ground moves out whole (scenes/snowGround.js)
  const snowIdOf = (o) => {
    if (!o) return 0;
    let id = _snowIds.get(o);
    if (id === undefined) {
      id = ++_snowNextId.n;
      _snowIds.set(o, id);
    }
    return id;
  };
  const _snowG = [0, 0];
  const snowGround = {
    size: TERRAIN_SIZE,
    get terrainDistance() {
      return host.state.terrainDistance;
    },
    pixelAt(x, z) {
      const c = host.state.compensation;
      return snowGround.pixelOn(
        snowPixelX(host.state.mapOrigin.x, c[0], TERRAIN_SIZE, x),
        snowPixelY(host.state.mapOrigin.y, c[2], TERRAIN_SIZE, z),
      );
    },
    pixelOn(px, py) {
      // StreamingWorld.GetTerrainFromPixel: the built entry standing there, its ground published
      if (!inWorldGrid(px, py)) return null; // The world's grid, not the Bay's 1000 x 500
      const k = worldPixelKey(px, py);
      let p = _snowPixels.get(k);
      if (p === undefined) {
        p = host.built.get(`${px},${py}`) ?? null;
        if (p && !(p.samples && p.tilemapBytes)) p = null;
        _snowPixels.set(k, p);
      }
      return p;
    },
    pixelsNear(ring) {
      const cur = host.state.current,
        out = [];
      for (const p of host.built.values())
        if (p.samples && p.tilemapBytes && Math.max(Math.abs(p.px - cur.x), Math.abs(p.py - cur.y)) <= ring)
          out.push(p);
      return out.sort(nearestFirstFrom(cur));
    },
    translation: (p, out) => host.state.pixelTranslation(p.px, p.py, out),
    // The drawn ground's laws live in systems/snowfall/snowGroundLaw.js, which the snow's build worker reads
    // off `data`'s snapshot of the same entry - DW-B's floor, WATER-NEXT 2's bed, the stride's surface and normals
    height: (p, lx, lz) => snowGroundHeight(p, !!host.deepWaters, lx, lz),
    normal: (p, lx, lz, out) => snowGroundNormal(p, lx, lz, out),
    data: (p) => snowGroundSnapshot(p, !!host.deepWaters),
    tileMap: (p) => p._dwBytes ?? p.tilemapBytes,
    climate: (p) => maps.getClimateIndex(p.px, p.py),
    mapPixel: (p) => ({ x: p.px, y: p.py }),
    stamp: (p) =>
      `${p._stride ?? 1}/${snowIdOf(p._dwBytes ?? p.tilemapBytes)}/${snowIdOf(p.deepWaters)}/${snowIdOf(p._bed?.depths)}`,
    bare: (p, lx, lz) => snowGroundBare(p, lx, lz),
    roads(p) {
      const raw = terrainGen.roads();
      // Past the Bay TESA's own roads, classified by the painter's word (the build's `paths`); on the Bay
      // the Basic Roads switch's network, as the mod reads it
      const net = !inBay(p.px, p.py)
        ? snowfallNetworkBeyond(p.px, p.py, p.paths)
        : raw?.source === 'basic-roads'
          ? snowfallNetwork(raw, p.px, p.py)
          : null;
      if (!net) return null;
      const loc = p.locationRect ? locationIndex.get(`${p.px},${p.py}`) : null;
      const authored =
        loc?.exterior?.exteriorData && (net.kindAt || (net.roads | net.roadCorners | net.paths | net.pathCorners) !== 0)
          ? authoredTiles(loc, maps, blocks)
          : new Uint8Array(16384);
      return { ...net, authored, rect: p.locationRect ?? { xMin: 0, xMax: 0, yMin: 0, yMax: 0 } };
    },
    toGlobal: (x, z) =>
      snowGlobalOf(
        host.state.mapOrigin.x,
        host.state.mapOrigin.y,
        host.state.compensation[0],
        host.state.compensation[2],
        TERRAIN_SIZE,
        x,
        z,
        _snowG,
      ),
    frame: () => [
      host.state.mapOrigin.x,
      host.state.mapOrigin.y,
      host.state.compensation[0],
      host.state.compensation[2],
      TERRAIN_SIZE,
    ], // toGlobal's and pixelAt's inputs, for the worker's copy of the world
    settlements: (minX, minZ, maxX, maxZ) =>
      settlementsIn((x, y) => locationIndex.get(`${x},${y}`) ?? null, minX, minZ, maxX, maxZ),
    // Snowfall's Location Loader keys - World of Daggerfall's sites on the built pixels
    footprints: (globalX, globalZ, radius) =>
      siteFootprintsIn((x, y) => snowGround.pixelOn(x, y), globalX, globalZ, radius),
  };
  return { _snowPixels, snowGround };
}
