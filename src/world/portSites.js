// @ts-check
// SHIPYARDS (2026-10-11; asked where the shipyard and the lighthouse stand, Mac chose "Town's seaward edge - both on the
// town's own open ground at the edge nearest the sea, placed off the town's layout like the Stables"): WHERE A PORT
// TOWN'S SHIPYARD AND LIGHTHOUSE STAND - read off its layout and the map's own data alone, so every client stands each
// on one spot (world/merchantYards/merchantYardSites.js's law for the Stable and the Wagon Yard, which this places after, on what they
// left).
//
// THE GROUND is the yards' (merchantYardSites.js townGroundOf: the town's navgrid on the enhanced lane's water table, its
// buildings kept BUILDING_CLEAR_M off - HOME-YARD's lot margin - its props, flats, palace blocks and the monument), with
// the Stable and the Wagon Yard already closed on it, YARD_GAP_M round each.
//
// WHICH TOWNS (FIELD BUGS 2026-10-14 INLAND-PORTS, a player: "Shipyard & light house near pond" - Ilessan Hills, a
// region capital in the hills, stood both at its middle beside a pond in its own blocks). A port by its own data
// (systems/portPlaces.js portTownByData) that THE OPEN SEA bears on (`portTownOnSea`): a pixel of it within SEA_RING of
// the town's, the ring its bearing is read off - so every port town has a seaward edge. The open sea is the map's water
// that reaches the map's border (`openSeaOf` - the flood Deep Waters' bake makes of the sea, every inland lake left
// out): the data alone is no coast, since PortTownAndUnknown's 0x10 is the region capitals' mark and Hazelnut's table
// copied the byte's list, and a lake or a one-pixel pond the map draws inland is no sea.
//
// THE SEA. Where the town's own blocks hold the sea - water cells (the navgrid's water family) in a body that reaches the
// edge of its block grid, SEA_CELLS_MIN of them at least (a puddle, a fountain's pool or an inland pond is never the
// sea) - each cell's distance to it is walked (four-way, in whole cells, `seaField`). Where they hold none, the sea's
// BEARING off the map pixels round the town's (`seaBearing`: each pixel of the open sea within two - the one water law,
// CLIMATE.PAK's ocean or WOODS.WLD's height at sea level, overworldModel.js isWaterPixel, flooded from the map's border -
// weighted two near and one far), and a cell's distance is how far it stands in from the town's seaward edge along it,
// and a quarter of its distance off that edge's middle. The bearing's sum nought (the sea all round evenly): the town's
// middle, as the yards'. A body of the town's own water lying against the map's bearing - its middle on the far side of
// the town's from the sea the map shows - is a lake or a river's reach inland, never the sea (AUDIT SHIPYARDS U2: the
// shipyard turned its back on the sea to face it).
//
// THE PLACE: a rectangle (PORT_FOOT, its front - its gate's side - along its +z), turned to one of the four axes; its
// own ground open and off every road, a ring of YARD_PAD_M round it open (a road allowed). Each BACKS ONTO THE SEA: a
// place whose front stands no farther from the sea than its back by its own depth costs FACE_K cells for every cell it
// falls short (FACE_K). THE SHIPYARD's score is that and the sea's distance at the middle of its back edge - its sea
// wall, its slipway running out through it, where its hull on the stocks would go down to the water - its gate to the
// town; its front facing no
// road within FRONT_ROAD_CELLS costs NO_ROAD_COST more (merchantYardSites.js, the yards' law). THE LIGHTHOUSE's is that
// and the sea's distance at its middle (its door to the town), less
// LIGHT_APART_K of a cell for every cell it stands from the shipyard (to LIGHT_APART_CAP): the town's light at its
// harbour's end, not beside its yard. Ties to the lower row, then column, then turn. Every distance an exact sum or a
// Math.sqrt of one (never Math.hypot - AUDIT MERCHANT-YARDS G2), the same on every engine.
//
// A town with no room for one stands none of it - said once, in the console - never over a house, a road or a lot.
//
// Pure: no renderer, no GL, no clock. Not a DFU member. Ledger A (SHIPYARDS).
import { NAV_CELL, NAV_CELLS_PER_BLOCK, tileWeight } from './city/cityNavigation.js';
import { summed, frontStrip, closeSite, YARD_PAD_M, YARD_TURNS, NO_ROAD_COST } from './merchantYards/merchantYardSites.js';
import { PORT_SITE_ORDER, portPlaceName, portTownByData } from '../systems/portPlaces.js';
import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { SEA_RING, seaBears } from '../net/fortLaw.js';   // FB1020c BERTH-RING: the ring and the sea's bearing, the coast law's own

export { SEA_RING, seaBears };

/** FIELD BUGS 2026-10-21b VOYAGE-HOLD: the board port whose waters map pixel (x, y) lies in - the nearest of `ports` within
 *  SEA_RING by the crow's flight (the squared pixels, exact on every engine), or null outside every ring. By the ring's
 *  squares alone (BERTH-RING's reading) a tie went to the list's first, and every pixel of Pencart's water tied it with
 *  Longham's: no berth ever named Pencart. Inside a ring of two the crow's flight differs from the squares on a tie alone.
 *  @template {{ px: number, py: number }} P @param {ReadonlyArray<P>} ports @param {number} x @param {number} y @returns {P|null} */
export function boardPortAt(ports, x, y) {
  let port = null, best = Infinity;
  for (const q of ports) {
    const dx = q.px - x, dy = q.py - y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > SEA_RING) continue;
    const e = dx * dx + dy * dy;
    if (e < best) { best = e; port = q; }
  }
  return port;
}

/** Each place's ground, metres: half its width (x) and half its depth (z) - its fence or wall and the apron before its
 *  gate (world/shipyardModel.js, world/lighthouseModel.js lay both out inside it). */
export const PORT_FOOT = Object.freeze({
  shipyard: Object.freeze({ hx: 11, hz: 8 }),
  lighthouse: Object.freeze({ hx: 6.5, hz: 6.5 }),
});
/** The least body of water, cells, that is the sea (never a puddle or a pond) - a body reaching the block grid's edge. */
export const SEA_CELLS_MIN = 48;
/** How far the map pixels round the town's are asked for the sea (SEA_RING, net/fortLaw.js - FB1020c BERTH-RING: the coast's
 *  law's home, which the account Worker bundles), and each ring's weight (the nearest the heavier). */
export const SEA_RING_WEIGHT = Object.freeze([0, 2, 1]);
/** Off the seaward edge's middle: a cell of distance for every LATERAL_K^-1 cells along it. */
export const LATERAL_K = 0.25;
/** Its back to the sea: a place whose front stands no farther from the sea than its back by its depth costs FACE_K
 *  cells for every cell it falls short (sideways about its depth's worth, its back to the town twice that) - more than
 *  a front onto no road (NO_ROAD_COST), so a shipyard backs onto the water first and opens onto a street where it can. */
export const FACE_K = 2;
/** The lighthouse stands apart from the shipyard: LIGHT_APART_K of a cell of the sea's distance for every cell between
 *  them, to LIGHT_APART_CAP cells - more than LATERAL_K, which it pays along the seaward edge for every cell off its
 *  middle (AUDIT SHIPYARDS L3-1: at LATERAL_K's own quarter the two cancelled, and on a bearing the light stood beside
 *  the yard), less than the cell it pays for every cell inland. */
export const LIGHT_APART_K = 0.5;
export const LIGHT_APART_CAP = 40;

/** A place's cell spans for a turn: [across x, across z]. Pure. */
export function portSpans(kind, turn) {
  const F = PORT_FOOT[kind];
  const sx = turn % 2 ? F.hz : F.hx, sz = turn % 2 ? F.hx : F.hz;
  return [Math.ceil((2 * sx) / NAV_CELL - 1e-9), Math.ceil((2 * sz) / NAV_CELL - 1e-9)];
}

/**
 * THE TOWN'S OWN SEA: a mask over its navgrid's cells (the yards' frame - rows along +z, per block flipped as
 * CityNavigation.setBlockData flips them), 1 where a cell is open water of a body reaching the block grid's edge with
 * SEA_CELLS_MIN cells at least. A cell is water where no automap byte covers it and its ground tile is of the water
 * family on the enhanced lane's table (cityNavigation.js tileWeight's nought). With the map's `bearing` ([sx, sz],
 * seaBearing's), a body whose middle lies against it - on the far side of the grid's middle from the sea the map shows -
 * is no sea (AUDIT SHIPYARDS U2). Pure.
 * @param {{width: number, height: number, blocks: any[]}} loc @param {number[]|null} [bearing]
 * @returns {{ width: number, height: number, sea: Uint8Array, cells: number }}
 */
export function townSeaOf(loc, bearing = null) {
  const N = NAV_CELLS_PER_BLOCK, W = (loc?.width | 0) * N, H = (loc?.height | 0) * N;
  const water = new Uint8Array(Math.max(0, W * H)), sea = new Uint8Array(Math.max(0, W * H));
  if (!(W > 0) || !(H > 0)) return { width: 0, height: 0, sea, cells: 0 };
  for (const b of loc.blocks ?? []) {
    const fld = b.dfBlock?.rmbBlock?.fldHeader;
    const auto = fld?.autoMapData, tiles = fld?.groundData?.groundTiles;
    if (!auto || !tiles) continue;
    for (let y = 0; y < N; y++) {
      const row = b.y * N + (N - 1 - y);
      for (let x = 0; x < N; x++) {
        if (auto[y * N + x] !== 0) continue;
        const rec = tiles[x >> 2]?.[y >> 2]?.textureRecord;
        if (Number.isInteger(rec) && tileWeight(rec & 0x3f, { enhancedWater: true }) === 0) water[row * W + b.x * N + x] = 1;
      }
    }
  }
  // each body of water four-way, kept where it reaches the grid's edge and is large enough
  const seen = new Uint8Array(W * H), stack = [];
  let cells = 0;
  for (let i = 0; i < W * H; i++) {
    if (!water[i] || seen[i]) continue;
    const body = [];
    let edge = false;
    seen[i] = 1; stack.push(i);
    while (stack.length) {
      const c = /** @type {number} */ (stack.pop());
      body.push(c);
      const cx = c % W, cy = (c - cx) / W;
      if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) edge = true;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (water[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    if (!edge || body.length < SEA_CELLS_MIN || againstBearing(body, W, H, bearing)) continue;
    for (const c of body) sea[c] = 1;
    cells += body.length;
  }
  return { width: W, height: H, sea, cells };
}

/** Whether a body of water's middle lies against the map's bearing - twice its offset off the grid's middle, along the
 *  bearing, below nought (whole numbers: a cell's centre). No bearing: never. Pure. */
function againstBearing(body, W, H, bearing) {
  const sx = bearing?.[0] ?? 0, sz = bearing?.[1] ?? 0;
  if (!sx && !sz) return false;
  let along = 0;
  for (const c of body) { const cx = c % W, cy = (c - cx) / W; along += (2 * cx + 1 - W) * sx + (2 * cy + 1 - H) * sz; }
  return along < 0;
}

/**
 * THE SEA'S BEARING off the map: every pixel of sea within SEA_RING of the town's (`isSea(px, py)`), weighted by its
 * ring, summed as a vector in the location's frame - the map's y runs south, the frame's z north - `[sx, sz]`, whole
 * numbers. `[0, 0]` where there is none, or it lies all round evenly. Pure.
 * @param {number} px @param {number} py @param {(x: number, y: number) => boolean} isSea
 */
export function seaBearing(px, py, isSea) {
  let sx = 0, sz = 0;
  for (let dy = -SEA_RING; dy <= SEA_RING; dy++) {
    for (let dx = -SEA_RING; dx <= SEA_RING; dx++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dy));
      if (ring === 0 || !isSea(px + dx, py + dy)) continue;
      const w = SEA_RING_WEIGHT[ring] ?? 0;
      sx += dx * w; sz -= dy * w;
    }
  }
  return [sx, sz];
}

/**
 * THE OPEN SEA (FIELD BUGS 2026-10-14 INLAND-PORTS): the map's water that reaches the map's border - every pixel the one
 * water law calls water (`isWater(x, y)`: overworldModel.js isWaterPixel) flooded eight-way from those on the map's edge,
 * the flood Deep Waters' bake makes of the sea (world/deepWater/deepWatersBake.js COARSE: "the 8-connected flood of candidates
 * from the map's border - one component in the file, every inland lake left out"), a map pixel at a time. On the real map
 * it is one body of 179,926 pixels; the 81 lakes and ponds the map draws inland (one pixel to 54) are none of it - no
 * ship of the Bay's reaches them. Answers a mask over the map's pixels (`y * width + x`), 1 the open sea. Pure.
 * @param {(x: number, y: number) => boolean} isWater @param {number} width @param {number} height
 * @returns {Uint8Array}
 */
export function openSeaOf(isWater, width, height) {
  const W = width | 0, H = height | 0, n = W > 0 && H > 0 ? W * H : 0;
  const wet = new Uint8Array(n), sea = new Uint8Array(n), stack = new Int32Array(n);
  if (!n) return sea;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWater(x, y)) wet[y * W + x] = 1;
  let top = 0;
  const reach = (i) => { if (wet[i] && !sea[i]) { sea[i] = 1; stack[top++] = i; } };
  for (let x = 0; x < W; x++) { reach(x); reach((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { reach(y * W); reach(y * W + W - 1); }
  while (top > 0) {
    const c = stack[--top], cx = c % W, cy = (c - cx) / W;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) reach(ny * W + nx);
      }
    }
  }
  return sea;
}

/**
 * WHETHER A LOCATION STANDS THE PORT'S PLACES (FIELD BUGS 2026-10-14 INLAND-PORTS; systems/portPlaces.js isPortTown's
 * `isPort`): a port by its own data (portPlaces.js portTownByData - Travel Options' harbours or Daggerfall's
 * PortTownAndUnknown byte) that the open sea bears on (`seaBears` at its map pixel, over `isSea` - the host's open sea,
 * `openSeaOf`'s). The data alone is no coast: the byte's 0x10 is the region capitals' mark, and 36 of the 39 capitals it
 * marks - Ilessan Hills in its hills among them - have no open sea within SEA_RING; its low four bits name the sides
 * water lies on, a lake's or a pond's as the sea's. Pure.
 * @param {any} loc @param {(mapId: number) => boolean} hasPort @param {(x: number, y: number) => boolean} isSea
 */
export function portTownOnSea(loc, hasPort, isSea) {
  const t = loc?.mapTableData;
  if (!t || !portTownByData(loc, hasPort)) return false;
  const p = longitudeLatitudeToMapPixel(t.longitude, t.latitude);
  return seaBears(p.x, p.y, isSea);
}

/**
 * EACH CELL'S DISTANCE TO THE SEA (cells): from the town's own sea where it holds one (`townSea`, a four-way walk over
 * every cell - through a house as over a street: it is a distance, not a way); else along the bearing (`bearing`), in
 * from the seaward edge, and LATERAL_K of its distance off that edge's middle; else (the sea all round evenly - a port
 * town always has the sea within SEA_RING, `portTownOnSea`) from the grid's middle (the yards' law). Answers
 * `{ at(gx, gy), kind: 'water'|'bearing'|'middle' }` - `at` a cell's, a half cell's point read by its floor. Pure.
 * @param {number} W @param {number} H @param {{ sea: Uint8Array, cells: number }|null} townSea @param {number[]} bearing
 */
export function seaField(W, H, townSea, bearing) {
  if (townSea && townSea.cells > 0) {
    const d = new Int32Array(W * H).fill(-1), queue = new Int32Array(W * H);
    let head = 0, tail = 0;
    for (let i = 0; i < W * H; i++) if (townSea.sea[i]) { d[i] = 0; queue[tail++] = i; }
    while (head < tail) {
      const c = queue[head++], cx = c % W, cy = (c - cx) / W;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (d[n] < 0) { d[n] = d[c] + 1; queue[tail++] = n; }
      }
    }
    return { kind: 'water', at: (gx, gy) => d[Math.max(0, Math.min(H - 1, Math.floor(gy))) * W + Math.max(0, Math.min(W - 1, Math.floor(gx)))] };
  }
  const [sx, sz] = bearing ?? [0, 0];
  if (sx || sz) {
    // twice a point's place off the grid's middle, along the bearing and across it - whole numbers for a cell's centre
    const len = Math.sqrt(sx * sx + sz * sz);
    const along = (gx, gy) => (2 * gx + 1 - W) * sx + (2 * gy + 1 - H) * sz;
    const across = (gx, gy) => (2 * gx + 1 - W) * -sz + (2 * gy + 1 - H) * sx;
    const reach = Math.max(along(0, 0), along(W - 1, 0), along(0, H - 1), along(W - 1, H - 1));
    return { kind: 'bearing', at: (gx, gy) => ((reach - along(gx, gy)) + LATERAL_K * Math.abs(across(gx, gy))) / (2 * len) };
  }
  return { kind: 'middle', at: (gx, gy) => Math.sqrt((2 * gx + 1 - W) * (2 * gx + 1 - W) + (2 * gy + 1 - H) * (2 * gy + 1 - H)) / 2 };
}

/** The cell at the middle of a placed rectangle's BACK edge - the side its front turns from (YARD_TURNS: turn 0 fronts
 *  +z, 1 +x, 2 -z, 3 -x). Pure. */
export function backMiddle(gx, gy, nx, nz, turn) {
  if (turn === 0) return [gx + nx / 2, gy];
  if (turn === 1) return [gx, gy + nz / 2];
  if (turn === 2) return [gx + nx / 2, gy + nz - 1];
  return [gx + nx - 1, gy + nz / 2];
}
/** The cell at the middle of its FRONT edge - its gate's. Pure. */
export function frontMiddle(gx, gy, nx, nz, turn) {
  if (turn === 0) return [gx + nx / 2, gy + nz - 1];
  if (turn === 1) return [gx + nx - 1, gy + nz / 2];
  if (turn === 2) return [gx + nx / 2, gy];
  return [gx, gy + nz / 2];
}

/**
 * ONE PORT PLACE'S SPOT on the ground (yardGround's, the yards closed on it): the best fit, or null - `x`, `z` its middle
 * in the location frame (metres), `yaw` its turn (degrees), its cells. `field` seaField's; `apart` the shipyard's middle
 * (cells) for the lighthouse to stand off. Pure.
 * @param {{width: number, height: number, blocked: Uint8Array, road: Uint8Array}} g @param {string} kind
 * @param {{ at: (gx: number, gy: number) => number, kind?: string }} field @param {number[]|null} [apart]
 */
export function portSite(g, kind, field, apart = null) {
  if (!g || !PORT_FOOT[kind]) return null;
  const { width: W, height: H } = g;
  const closed = summed(W, H, (x, y) => g.blocked[y * W + x]);
  const roads = summed(W, H, (x, y) => g.road[y * W + x]);
  const pad = Math.ceil(YARD_PAD_M / NAV_CELL - 1e-9);
  let best = null, bestScore = Infinity;
  for (let turn = 0; turn < 4; turn++) {
    const [nx, nz] = portSpans(kind, turn);
    for (let gy = pad; gy + nz + pad <= H; gy++) {
      for (let gx = pad; gx + nx + pad <= W; gx++) {
        const [bx, by] = backMiddle(gx, gy, nx, nz, turn), [fx, fy] = frontMiddle(gx, gy, nx, nz, turn);
        const back = field.at(bx, by), depth = (turn % 2 ? nx : nz) - 1;
        // its back to the sea: its front as much farther from it as it is deep (the middle's field has no sea to face)
        let score = field.kind === 'middle' ? 0 : FACE_K * Math.max(0, depth - (field.at(fx, fy) - back));
        if (kind === 'shipyard') score += back;
        else {
          const cx = gx + nx / 2, cy = gy + nz / 2;
          score += field.at(cx, cy);
          if (apart) score -= LIGHT_APART_K * Math.min(LIGHT_APART_CAP, Math.sqrt((cx - apart[0]) * (cx - apart[0]) + (cy - apart[1]) * (cy - apart[1])));
        }
        if (score > bestScore) continue;   // the road can only cost more: a place already further cannot win (one as far may tie)
        if (closed(gx - pad, gy - pad, gx + nx + pad, gy + nz + pad) !== 0) continue;
        if (roads(gx, gy, gx + nx, gy + nz) !== 0) continue;
        if (kind === 'shipyard') {
          const s = frontStrip(gx, gy, nx, nz, turn);
          if (roads(s[0], s[1], s[2], s[3]) === 0) score += NO_ROAD_COST;
        }
        if (score < bestScore || (score === bestScore && best && (gy < best.gy || (gy === best.gy && (gx < best.gx || (gx === best.gx && turn < best.turn)))))) {
          bestScore = score; best = { gx, gy, nx, nz, turn };
        }
      }
    }
  }
  if (!best) return null;
  return {
    kind, turn: best.turn, yaw: YARD_TURNS[best.turn],
    x: (best.gx + best.nx / 2) * NAV_CELL, z: (best.gy + best.nz / 2) * NAV_CELL,
    gx: best.gx, gy: best.gy, nx: best.nx, nz: best.nz, score: bestScore,
  };
}

/**
 * BOTH PORT PLACES on a town's ground (the yards already closed on it): the shipyard, then the lighthouse on what is
 * left YARD_GAP_M clear of it and standing off it. `field` seaField's. Answers the sites found (none, one or both). It
 * closes `g` as it goes - a ground is placed on once. Pure.
 * @param {{width: number, height: number, blocked: Uint8Array, road: Uint8Array}} g @param {{ at: (gx: number, gy: number) => number }} field
 */
export function portSitesOn(g, field) {
  const out = [];
  let apart = null;
  for (const kind of PORT_SITE_ORDER) {
    const s = portSite(g, kind, field, apart);
    if (!s) continue;
    out.push(s);
    closeSite(g, s);
    if (kind === 'shipyard') apart = [s.gx + s.nx / 2, s.gy + s.nz / 2];
  }
  return out;
}

/** A point of a placed site's frame (its middle, turned by its yaw - trs's: +90 takes +z to +x) in the location frame:
 *  `[x, z]`. Pure. */
export function siteToLocation(site, lx, lz) {
  const a = ((site.yaw ?? 0) * Math.PI) / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  return [site.x + lx * c + lz * s, site.z - lx * s + lz * c];
}
/** A scene's point [x, z] in a location's frame: its pixel's floating-origin translation `t` ([x, y, z]) and the location's
 *  origin in its pixel `origin` ([x, y, z]) taken off - the docks' berth for the talk directory. Pure. */
export const sceneToLocationXZ = (p, t, origin) => [p[0] - t[0] - origin[0], p[1] - t[2] - origin[2]];
/** A PORT TOWN'S PLACES AS ROWS OF ITS TALK DIRECTORY, in the location frame (systems/portPlaces.js portDirectoryRows):
 *  each place where its town's layout put it; the CREW HALL at `crewAt`, a point of the shipyard's own frame (the
 *  crewmaster's table); the DOCKS at `docks` ([x, z], the first berth's quay) once there is one, named for the town.
 *  scenes/world.js portPlacesOf hands it the sites and the docks (AUDIT SHIPYARDS L6-10: executed here, not read off
 *  world.js's text). Pure. */
export function portPlaceRows(sites, crewAt, docks, townName) {
  const out = [];
  for (const site of sites ?? []) {
    out.push({ kind: site.kind, x: site.x, z: site.z, name: site.name });
    if (site.kind === 'shipyard') { const [x, z] = siteToLocation(site, crewAt[0], crewAt[1]); out.push({ kind: 'crewhall', x, z, name: site.crewName }); }
  }
  if (docks) out.push({ kind: 'docks', x: docks[0], z: docks[1], name: portPlaceName('docks', { townName }) });
  return out;
}
