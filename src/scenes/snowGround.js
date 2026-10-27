// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { authoredTiles, settlementsIn, snowfallNetwork } from './snowfallHost.js';
import { carvedFloorLocalY } from './deepWater/deepWatersHost.js';
import { gridValueAt, surfaceHeightAt, surfaceNormalAt, surfaceNormalFromSamples } from '../world/terrain/terrainSurface.js';
import { nearestFirstFrom } from '../world/streamingWorld.js';
import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';

/** @param {any} host */
export function createSnowGround(host) {
  const {
    blocks, locationIndex, maps, terrainGen
  } = host;
  // SNOWFALL1 (Mac: "These should be on by default and integrate into our enhanced environments seamlessly"): SNOWFALL -
  // the enhanced outdoors' snow (scenes/snowfallHost.js) on the streamed ground as it is DRAWN: each pixel's own
  // surface at its stride and its TileMap (the cap's, where Deep Waters patched one), the sea it carved bare, the roads
  // Basic Roads'. Ticked on every frame, outdoors and in; told each pixel published (OnPromoteTerrainData); drawn after
  // the ground by the ground's own program - its sun, its shadows, its lights and its fog. The adapter reads the
  // stream's bindings when it is asked, never here (they are declared below).
  const _snowPixels = new Map();   // px * 1000 + py -> the built entry, this frame (cleared at the frame: a publish lands between frames)
  const _snowIds = new WeakMap();
  const _snowNextId = { n: 0 };   // HOST-SPLIT: a holder, so the snow's ground moves out whole (scenes/snowGround.js)
  const snowIdOf = (o) => { if (!o) return 0; let id = _snowIds.get(o); if (id === undefined) { id = ++_snowNextId.n; _snowIds.set(o, id); } return id; };
  const _snowG = [0, 0];
  const snowGround = {
    size: TERRAIN_SIZE,
    get terrainDistance() { return host.state.terrainDistance; },
    pixelAt(x, z) {
      const c = host.state.compensation;
      return snowGround.pixelOn(host.state.mapOrigin.x + Math.floor((x - c[0]) / TERRAIN_SIZE), host.state.mapOrigin.y - Math.floor((z - c[2]) / TERRAIN_SIZE));
    },
    pixelOn(px, py) {   // StreamingWorld.GetTerrainFromPixel: the built entry standing there, its ground published
      if (px < 0 || px >= 1000 || py < 0 || py >= 500) return null;
      const k = px * 1000 + py;
      let p = _snowPixels.get(k);
      if (p === undefined) { p = host.built.get(`${px},${py}`) ?? null; if (p && !(p.samples && p.tilemapBytes)) p = null; _snowPixels.set(k, p); }
      return p;
    },
    pixelsNear(ring) {
      const cur = host.state.current, out = [];
      for (const p of host.built.values()) if (p.samples && p.tilemapBytes && Math.max(Math.abs(p.px - cur.x), Math.abs(p.py - cur.y)) <= ring) out.push(p);
      return out.sort(nearestFirstFrom(cur));
    },
    translation: (p, out) => host.state.pixelTranslation(p.px, p.py, out),
    height(p, lx, lz) {
      if (p.deepWaters && host.deepWaters) { const f = host.deepWaters.floorLocalY(p, lx, lz); if (f != null) return f; }   // DW-B: the floor is drawn there
      const stride = p._stride ?? 1, h = surfaceHeightAt(p.samples, lx, lz, stride), d = p._bed?.depths, g = 128 / stride + 1;
      return d ? h - gridValueAt(d, g, g, host.tileSide * stride, lx, lz) : h;   // WATER-NEXT 2: and the bed carved under a shore
    },
    normal: (p, lx, lz, out) => (p.groundNormals && (p._stride ?? 1) === 1 ? surfaceNormalAt(p.groundNormals, lx, lz, out) : surfaceNormalFromSamples(p.samples, lx, lz, p._stride ?? 1, out)),
    tileMap: (p) => p._dwBytes ?? p.tilemapBytes,
    climate: (p) => maps.getClimateIndex(p.px, p.py),
    mapPixel: (p) => ({ x: p.px, y: p.py }),
    stamp: (p) => `${p._stride ?? 1}/${snowIdOf(p._dwBytes ?? p.tilemapBytes)}/${snowIdOf(p.deepWaters)}/${snowIdOf(p._bed?.depths)}`,
    bare: (p, lx, lz) => !!p.deepWaters && carvedFloorLocalY(p.deepWaters, lx, lz) != null,   // DW-B: the carved sea has no ground to lie on
    roads(p) {
      const raw = terrainGen.roads();
      const net = raw?.source === 'basic-roads' ? snowfallNetwork(raw, p.px, p.py) : null;
      if (!net) return null;
      const loc = p.locationRect ? locationIndex.get(`${p.px},${p.py}`) : null;
      const authored = loc?.exterior?.exteriorData && (net.roads | net.roadCorners | net.paths | net.pathCorners) !== 0 ? authoredTiles(loc, maps, blocks) : new Uint8Array(16384);
      return { ...net, authored, rect: p.locationRect ?? { xMin: 0, xMax: 0, yMin: 0, yMax: 0 } };
    },
    toGlobal(x, z) {
      const c = host.state.compensation;
      _snowG[0] = host.state.mapOrigin.x * TERRAIN_SIZE + (x - c[0]);
      _snowG[1] = (499 - host.state.mapOrigin.y) * TERRAIN_SIZE + (z - c[2]);
      return _snowG;
    },
    settlements: (minX, minZ, maxX, maxZ) => settlementsIn((x, y) => locationIndex.get(`${x},${y}`) ?? null, minX, minZ, maxX, maxZ),
  };
  return { _snowPixels, snowGround };
}
