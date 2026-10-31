// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ROAD-LOOK (2026-10-27, KPbICA on the DFO Online Discord through the owner: "No bridges across the big rivers (like this
// one that starts around IC and goes south)"; the owner: "No band aids or half assed work"; bible/03-World/Roads.md
// ROAD-LOOK) - A ROAD OVER A RIVER WIDER THAN A FORD CROSSES IT ON A BRIDGE.
//
// Past the Bay the roads are the port's own (world/tamrielRoads.js) and CYRODIIL-WATERS carves ten rivers into the land,
// narrower than a pixel (world/tamriel/tamrielWaters.js). RIVER-FORDS prices a step onto a channel's pixel so a road
// crosses a river once, square to it, at its narrowest - and keeps the road's own tiles over the channel, a ford: a strip
// of road at the water's level through the river. Measured on the freeware's Cyrodiil (six regions about the Niben):
// 94 road crossings and 141 track crossings of a carved river, 90 and 136 of them wider than Basic Roads' own river
// (BRIDGE.fordMax) - the Corbolo, the White Rose, the Strid and the rest, 30 to 460 m across.
//
// THE LAW, pure (the terrain worker and this thread read it alike, off the roads' layer and the waters' law):
//  - A CROSSING is where a road's or a track's DRAWN line (world/road/roadCurves.js curvesOf - the curves the painter
//    paints) meets a river's centre line: its point, the line's heading there, the river's width and level. It is the
//    pixel's whose own byte draws that curve and holds that point - so each crossing has one owner.
//  - A BRIDGE stands at every crossing wider than `fordMax`: a road's of stone (`road`), a track's of timber (`track`);
//    of two whose decks would meet over one river the squarer stands, a road's before a track's. Its deck stands `clearance` over the
//    river's level with `deck` of masonry or plank over that, `bank` past each water's edge, and comes down to the river's
//    level - the valley's floor at its banks (CYRODIIL-WATERS' carve lays the land beside a channel at its level, rising to
//    the walls over a valley of 220 m and more) - over `ramp` metres a metre: a road meets each end on its own ground.
//    Its length across the water is the river's width over the sine of the angle the road meets it at (never under
//    `minSine`).
//  - UNDER IT THE RIVER RUNS: the road's tiles and the shoulders the painter wore under the deck and over the channel
//    are laid back (unpaveBridges), so the channel's water is painted there as anywhere along it (RIVER-FORDS kept them
//    the ford's).
//  - A ford at or under `fordMax` stays a ford, as Basic Roads crosses every river of the Bay at grade.
// The meshes are world/road/bridgeModels.js's, made on the page's thread from the kernel's answer (terrainGen.js
// `bridges`); the roads' network, the Overworld's planner and the map read none of this - a bridge is where the road
// already crosses.
// ═══════════════════════════════════════════════════════════════════
import { curvesOf, curvePolyline, CURVE_STEPS, CURVE_DIM } from './roadCurves.js';
import { tamrielWaters, waterAt } from '../tamriel/tamrielWaters.js';

/** The bridges' dials, metres (`ramp` a run a metre of rise). */
export const BRIDGE = Object.freeze({
  /** the widest water a ford crosses: Basic Roads' river from bank to bank - two tiles of water and a bank each side
   *  (world/road/roadPainter.js RIVER_TILES), which every road of the Bay crosses at grade */
  fordMax: 4 * 6.4,
  /** the least sine of the angle a road meets a river at, as a bridge's length across it reckons it */
  minSine: 0.35,
  /** a road's: stone, two tiles wide as the road (roadCurves.js ROAD_HALF), its arches no wider than `span` between piers
   *  `pier` thick, a `parapet` of `wall` thickness, its walls `foot` into the ground */
  road: Object.freeze({
    width: 12.8,
    clearance: 4.5,
    deck: 1,
    bank: 4,
    ramp: 8,
    span: 26,
    pier: 2.4,
    parapet: 1.1,
    wall: 0.5,
    foot: 2.5,
  }),
  /** a track's: timber, a cart's width, its trestles no further apart than `span` */
  track: Object.freeze({
    width: 4.8,
    clearance: 2.5,
    deck: 0.4,
    bank: 2,
    ramp: 8,
    span: 6,
    pier: 0.35,
    parapet: 1,
    wall: 0.2,
    foot: 1.5,
  }),
});
/** A pixel's side, metres, and a tile's. */
const PIXEL_M = 819.2,
  TILE_M = PIXEL_M / CURVE_DIM;
/** CYRODIIL-WATERS' metres a kernel unit (tamrielWaters.js UNIT_M): a river's level in the terrain's own frame. */
const UNIT_M = 1.25;
/** The index's run of segments (tamrielWaters.js RUN). */
const RUN = 8;

/**
 * THE CROSSINGS A PIXEL OWNS: where its own roads' and tracks' drawn curves meet a carved river's centre line, inside it -
 * `{ kind: 'road'|'track', x, y, ux, uy, sin, width, level, river }`: the point (Bay pixels, y south), the line's unit
 * heading there (Bay pixels), the sine of the angle it meets the river at, the river's width there and its level (metres,
 * the terrain's frame), its key. Of two of one river whose decks would meet the squarer stands (a track's goes under a
 * road's). In one order on every thread.
 * @param {number} px @param {number} py @param {(kind: 'roads'|'tracks', x: number, y: number) => number} byteAt the layer's
 * @param {any} [law] the waters' compiled law (tamrielWaters' - its rivers and its index)
 */
export function crossingsOf(px, py, byteAt, law = tamrielWaters()) {
  const ids = law ? law.index.get(px * 65536 + py) : null;
  if (!ids) return [];
  /** @type {Array<{ kind: 'road'|'track', x: number, y: number, ux: number, uy: number, sin: number, width: number, level: number, river: string }>} */
  const out = [];
  for (const kind of /** @type {const} */ (['road', 'track'])) {
    const bits = byteAt(kind === 'road' ? 'roads' : 'tracks', px, py);
    if (!bits) continue;
    const found = [];
    for (const q of curvesOf(bits).curves) {
      const p = curvePolyline(q);
      for (let s = 0; s < CURVE_STEPS; s++) {
        const ax = px + p[2 * s] / CURVE_DIM,
          ay = py + 1 - p[2 * s + 1] / CURVE_DIM;
        const bx = px + p[2 * s + 2] / CURVE_DIM,
          by = py + 1 - p[2 * s + 3] / CURVE_DIM;
        for (const id of ids) {
          const ri = Math.floor(id / 65536),
            i0 = id - ri * 65536,
            r = law.rivers[ri];
          for (let i = i0; i <= Math.min(r.n - 2, i0 + RUN - 1); i++) {
            const cx = r.pts[2 * i],
              cy = r.pts[2 * i + 1],
              dx = r.pts[2 * i + 2],
              dy = r.pts[2 * i + 3];
            const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
            if (den === 0) continue;
            const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den,
              u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
            if (t < 0 || t > 1 || u < 0 || u >= 1) continue; // a river's vertex one segment's; a curve's ends both its segments' (the pixel's edge is the curve's end - the owner below, and the merge, make it one)
            const x = ax + (bx - ax) * t,
              y = ay + (by - ay) * t;
            if (Math.floor(x) !== px || Math.floor(y) !== py) continue; // the pixel that holds the point owns it
            const rl = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) || 1,
              vl = Math.sqrt((dx - cx) * (dx - cx) + (dy - cy) * (dy - cy)) || 1;
            const ux = (bx - ax) / rl,
              uy = (by - ay) / rl,
              vx = (dx - cx) / vl,
              vy = (dy - cy) / vl;
            found.push({
              kind,
              x,
              y,
              ux,
              uy,
              sin: Math.abs(ux * vy - uy * vx),
              width: r.width[i] + (r.width[i + 1] - r.width[i]) * u,
              level: (r.level[i] + (r.level[i + 1] - r.level[i]) * u) * UNIT_M,
              river: r.key,
            });
          }
        }
      }
    }
    // the squarest first: of two crossings of one river whose decks would meet (a junction's curves through one point), the
    // one that meets it most nearly square stands, and a track's whose deck meets a road's is carried by the road's
    found.sort((a, b) => b.sin - a.sin || a.y - b.y || a.x - b.x);
    for (const c of found) {
      const meets = (o) =>
        o.river === c.river && (o.kind === c.kind || o.kind === 'road') && decksMeet(bridgeShape(o), bridgeShape(c));
      if (!out.some(meets)) out.push(c);
    }
  }
  return out;
}

/** Would two bridges' decks (abutment to abutment, parapet to parapet) meet - the separating axes of two rectangles. */
export function decksMeet(p, q) {
  const rect = (b) => {
    const k = b.kind === 'road' ? BRIDGE.road : BRIDGE.track;
    return { x: b.x * PIXEL_M, y: b.y * PIXEL_M, u: [b.ux, b.uy], v: [-b.uy, b.ux], a: b.abut, w: k.width / 2 };
  };
  const A = rect(p),
    B = rect(q),
    d = [B.x - A.x, B.y - A.y];
  for (const L of [A.u, A.v, B.u, B.v]) {
    const r = (R) => R.a * Math.abs(R.u[0] * L[0] + R.u[1] * L[1]) + R.w * Math.abs(R.v[0] * L[0] + R.v[1] * L[1]);
    if (Math.abs(d[0] * L[0] + d[1] * L[1]) > r(A) + r(B)) return false;
  }
  return true;
}

/** A bridge's shape off its crossing: the dials of its kind, its length over the water (`half` each way along the line),
 *  its deck's top, its whole reach along the line each way (to the ramps' feet). */
export function bridgeShape(c) {
  const k = c.kind === 'road' ? BRIDGE.road : BRIDGE.track;
  const half = c.width / Math.max(BRIDGE.minSine, c.sin) / 2;
  const deck = c.level + k.clearance + k.deck;
  return { ...c, half, deck, abut: half + k.bank, reach: half + k.bank + (deck - c.level) * k.ramp };
}

/** @type {Map<number, { law: object, key: string, list: ReturnType<typeof bridgeShape>[] }>} */
const _memo = new Map();
/**
 * THE BRIDGES A PIXEL OWNS - its crossings wider than a ford (`fordMax`), each with its shape (bridgeShape). Kept a pixel,
 * by its own two bytes and the law (a crossing is its own byte's curves' and the law's, compiled again with the trace or
 * the fit).
 * @param {number} px @param {number} py @param {(kind: 'roads'|'tracks', x: number, y: number) => number} byteAt
 * @param {any} [law] the waters' compiled law
 */
export function bridgesOf(px, py, byteAt, law = tamrielWaters()) {
  if (!law) return [];
  const pk = px * 65536 + py,
    key = `${byteAt('roads', px, py)},${byteAt('tracks', px, py)}`;
  const hit = _memo.get(pk);
  if (hit && hit.law === law && hit.key === key) return hit.list;
  const list = crossingsOf(px, py, byteAt, law)
    .filter((c) => c.width > BRIDGE.fordMax)
    .map(bridgeShape);
  if (_memo.size > 4096) _memo.clear();
  _memo.set(pk, { law, key, list });
  return list;
}

/** @type {WeakMap<object, any>} */
const _inkLaws = new WeakMap();
/**
 * THE MAP'S LAW FOR ITS BRIDGES (ui/tamrielInk.js): the map's copy of the waters (world/tamriel/watersInk.js - each
 * river's centre line and widths, made by the terrain worker so the law's compile never lands on the map's thread) as
 * crossingsOf reads a law - its rivers, a level of none (the map draws where, not how high), and an index of the pixels
 * each run of RUN segments crosses and a pixel round it. Kept an install.
 * @param {{ rivers: Array<{ key: string, n: number, pts: ArrayLike<number>, width: ArrayLike<number> }> }} ink
 */
export function inkBridgeLaw(ink) {
  let law = _inkLaws.get(ink);
  if (law) return law;
  const index = new Map();
  const rivers = ink.rivers.map((r) => ({
    key: r.key,
    name: r.key,
    n: r.n,
    pts: r.pts,
    width: r.width,
    level: new Float32Array(r.n),
  }));
  rivers.forEach((r, ri) => {
    for (let i0 = 0; i0 < r.n - 1; i0 += RUN) {
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (let i = i0; i <= Math.min(r.n - 1, i0 + RUN); i++) {
        x0 = Math.min(x0, r.pts[2 * i]);
        x1 = Math.max(x1, r.pts[2 * i]);
        y0 = Math.min(y0, r.pts[2 * i + 1]);
        y1 = Math.max(y1, r.pts[2 * i + 1]);
      }
      for (let y = Math.floor(y0) - 1; y <= Math.floor(y1) + 1; y++)
        for (let x = Math.floor(x0) - 1; x <= Math.floor(x1) + 1; x++) {
          const k = x * 65536 + y,
            a = index.get(k) ?? [];
          if (a[a.length - 1] !== ri * 65536 + i0) a.push(ri * 65536 + i0);
          index.set(k, a);
        }
    }
  });
  law = { version: 0, rivers, lakes: [], index, pixels: new Map() };
  _inkLaws.set(ink, law);
  return law;
}

/** Is a Bay point in a carved river's channel (the waters' own answer). */
const channelAt = (x, y) => waterAt(x, y)?.kind === 'river';

/** A bridge in a pixel's own frame (metres, x east and z north from its south-west corner): its middle and its line's
 *  unit heading - the pixel (px, py) whose frame is asked, which need not own it. */
export function bridgeFrame(b, px, py) {
  return { cx: (b.x - px) * PIXEL_M, cz: (py + 1 - b.y) * PIXEL_M, ax: b.ux, az: -b.uy };
}

/**
 * UNDER A BRIDGE THE RIVER RUNS (the kernel's, world/terrain/terrainGen.js, after the road painter and before the
 * waters' paint and the roads' smoothing): every tile of a pixel under a bridge's deck over its water - the bridges of the
 * pixel and its eight neighbours - that the painter wrote (GRASS-PATH1's `paths`) and that has a corner in a river's
 * channel is laid back: no road tile (the squares lay the water's shore there) and no path (the waters' paint keeps a
 * path's corners - RIVER-FORDS' ford). Answers how many tiles, and the pixel's own bridges.
 * @param {Uint8Array} tilemap 128 x 128 @param {Uint8Array} paths 128 x 128 @param {number} px @param {number} py
 * @param {(kind: 'roads'|'tracks', x: number, y: number) => number} byteAt
 * @param {any} [law] the waters' compiled law @param {(x: number, y: number) => boolean} [inChannel] a Bay point in a river's channel
 */
export function unpaveBridges(tilemap, paths, px, py, byteAt, law = tamrielWaters(), inChannel = channelAt) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const b of bridgesOf(px + dx, py + dy, byteAt, law)) {
        const k = b.kind === 'road' ? BRIDGE.road : BRIDGE.track,
          f = bridgeFrame(b, px, py);
        const along = b.half + TILE_M,
          across = k.width / 2 + TILE_M,
          r = Math.hypot(along, across);
        const tx0 = Math.max(0, Math.floor((f.cx - r) / TILE_M)),
          tx1 = Math.min(CURVE_DIM - 1, Math.floor((f.cx + r) / TILE_M));
        const ty0 = Math.max(0, Math.floor((f.cz - r) / TILE_M)),
          ty1 = Math.min(CURVE_DIM - 1, Math.floor((f.cz + r) / TILE_M));
        for (let ty = ty0; ty <= ty1; ty++) {
          for (let tx = tx0; tx <= tx1; tx++) {
            const t = ty * CURVE_DIM + tx;
            if (!paths[t]) continue;
            const ox = (tx + 0.5) * TILE_M - f.cx,
              oz = (ty + 0.5) * TILE_M - f.cz;
            if (Math.abs(ox * f.ax + oz * f.az) > along || Math.abs(-ox * f.az + oz * f.ax) > across) continue;
            let wet = false;
            for (let c = 0; c < 4 && !wet; c++)
              wet = inChannel(px + (tx + (c & 1)) / CURVE_DIM, py + 1 - (ty + (c >> 1)) / CURVE_DIM);
            if (!wet) continue;
            tilemap[t] = 0;
            paths[t] = 0;
            n++;
          }
        }
      }
    }
  }
  return n;
}
