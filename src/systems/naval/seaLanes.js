// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-LANES (2026-10-02, Mac: "ships should be more persistant and actively engage with multiple docks and multiple
// pathways around daggerfall") - THE BAY'S PACKETS. The sea's traffic was the director's alone: ships stood on a ring
// about the player, crossing their waters on a slant, going about an errand only to a harbour the player had stood by,
// and let go out of sight for good - a ship seen leaving a port was never the ship met at the next, and none was ever
// on her way between two. The packets are ships of the Bay itself, between its ports:
//
// THE LANES. Every port town (Travel Options' 378, the map's harbours) with sea beside it - its ROADSTEAD, the nearest
// map pixel of open water within ROADSTEAD_PX of the town - runs packets to its LANE_NEIGHBOURS nearest such ports
// within LANE_MAX_PX: so every port has two lanes at least and most have three or four, and a coast is a chain of them,
// a headland's ports each other's neighbours across the water, the three crowns' capitals linked through the lanes'
// ports between them. A lane's way is the water's: an A* over the map's water pixels from one roadstead to the other,
// straightened wherever a line holds to the water (LANE_STRAIGHT_STEPS of it each pixel), no longer than LANE_PATH_PX.
//
// THE PACKET. One ship a lane, of the lane's own seed (the two ports'): a merchantman, or on LANE_NAVY of the lanes a
// crown's ship keeping the passage. She sails it out and back for ever on the SHARED CLOCK - out at her class's cruise
// (LANE_CRUISE of her best way), LANE_DWELL_S at the far port, home, LANE_DWELL_S at hers - from a phase of her seed, so
// where she is now is a function of the clock alone (OWS3's raiders' law): every player sees her in the same water at
// the same minute, a port left and come back to finds her further on, and a ship watched out of one port is the one that
// berths at the next. Her VOYAGE is her cycle: one sunk or taken is spent for it, and the lane's next cycle sails
// another (a company's next ship).
//
// PURE: numbers in, packets out. Places are map pixels (x east, y south from the map's top) and native world units
// (32768 a pixel, z north: (499 - y) pixels - streamingWorld.js mapPixelToWorldCoords, seaRaiders.js's own).
// ═══════════════════════════════════════════════════════════════════

import { hash32 } from '../../world/spawnedDungeons.js';
import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { classFor, HULL } from './navalShips.js';
import { nativeOfPixel, NATIVE_PIXEL } from '../seaRaiders.js';

/** How far from its town a port's roadstead may lie (map pixels), and how many ports a port runs packets to, within how
 *  far of it (map pixels between roadsteads: about 25 km). */
export const ROADSTEAD_PX = 3;
export const LANE_NEIGHBOURS = 2;
export const LANE_MAX_PX = 30;
/** A lane's way: no longer than this over the water (map pixels), its search no more than LANE_SEARCH pixels expanded,
 *  and a straightened leg's water asked this many times a pixel. */
export const LANE_PATH_PX = 60;
export const LANE_SEARCH = 20000;
export const LANE_STRAIGHT_STEPS = 4;
/** A packet's cruise (her class's best way times this), her dwell at each end (s, the shared clock's), the headway
 *  between a lane's packets (s: a lane sails one every LANE_HEADWAY_S each way, its round trip's length over it, one at
 *  the least), and the share of packets a crown's ship sails (a patrol keeping the passage). */
export const LANE_CRUISE = 0.7;
export const LANE_DWELL_S = 600;
export const LANE_HEADWAY_S = 1800;
export const LANE_NAVY = 0.25;
/** The level a packet's class is drawn at (navalShips.js classFor): the same for every player. */
export const LANE_LEVEL = 10;
/** The lane's own salt on its seed. */
export const LANE_SALT = 0x1a4e5;
/** AUDIT BAY A17: the voyages a packet is known by - her own and the LANE_LINEAGE - 1 before it. A ship on the
 *  water at her voyage's end sails the next as herself (the swap at the turn put a ship out of the world at her berth,
 *  in the port's sight, and another into it at the roadstead), so a slot's packet is any ship of these seeds afloat;
 *  past them she is let go of her lane (a day and more of the shortest lane's voyages, under one player's eye). */
export const LANE_LINEAGE = 24;
/** Metres a native unit. */
const M_PER_NATIVE = 819.2 / NATIVE_PIXEL;

/** The water's way between two map pixels, 8 neighbours with no corner cut past land, or null (none within LANE_SEARCH,
 *  or longer than LANE_PATH_PX). `water(px, py)` the map's own. */
export function lanePixels(from, to, water) {
  const W = 1000, H = 500;
  if (!water(from.x, from.y) || !water(to.x, to.y)) return null;
  const key = (x, y) => y * W + x;
  const g = new Map([[key(from.x, from.y), 0]]), came = new Map(), shut = new Set();
  const h = (x, y) => Math.hypot(x - to.x, y - to.y);
  // the open list a binary heap on f: [f, x, y]
  const heap = [[h(from.x, from.y), from.x, from.y]];
  const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  let expanded = 0;
  while (heap.length && expanded < LANE_SEARCH) {
    const [, x, y] = pop();
    const k = key(x, y);
    if (shut.has(k)) continue;
    shut.add(k);
    const gk = g.get(k);
    if (x === to.x && y === to.y) {
      const path = [{ x, y }];
      for (let c = came.get(k); c != null; c = came.get(c)) path.push({ x: c % W, y: Math.floor(c / W) });
      return path.reverse();
    }
    expanded++;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !water(nx, ny)) continue;
        if (dx && dy && (!water(x + dx, y) || !water(x, y + dy))) continue;   // no corner cut past land
        const ng = gk + (dx && dy ? Math.SQRT2 : 1);
        const nk = key(nx, ny);
        if (ng >= (g.get(nk) ?? Infinity) || ng > LANE_PATH_PX) continue;
        g.set(nk, ng); came.set(nk, k);
        push([ng + h(nx, ny), nx, ny]);
      }
    }
  }
  return null;
}

/** A pixel's centre in native units. */
const centreOf = (p) => { const o = nativeOfPixel(p.x, p.y); return { x: o.x + NATIVE_PIXEL / 2, z: o.z + NATIVE_PIXEL / 2 }; };
/** Whether the line between two native points holds to the water (LANE_STRAIGHT_STEPS a pixel of it). */
function holds(a, b, waterNative) {
  const n = Math.max(1, Math.ceil((Math.hypot(b.x - a.x, b.z - a.z) / NATIVE_PIXEL) * LANE_STRAIGHT_STEPS));
  for (let i = 1; i < n; i++) if (!waterNative(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
  return true;
}
/** A pixel way straightened: from each point, on to the farthest the water holds a line to. Native points. */
export function straighten(pixels, waterNative) {
  const pts = pixels.map(centreOf);
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !holds(pts[i], pts[j], waterNative)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/**
 * A port's roadstead: the nearest map pixel within ROADSTEAD_PX of its town that is open sea (`open(px, py)`), ring by
 * ring, the first found in a ring by its own order (deterministic) - or null: an inland "port", or a coast too shallow.
 */
export function roadsteadOf(port, open) {
  for (let r = 1; r <= ROADSTEAD_PX; r++) {
    let best = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = port.px + dx, y = port.py + dy;
        if (!open(x, y)) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = { x, y }; }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * THE LANES between `ports` (`[{ id, name, px, py, region }]`, every port of the map): each port with a roadstead to
 * its LANE_NEIGHBOURS nearest within LANE_MAX_PX, each pair once (the lower id first). Answers `[{ key, a, b }]`, `a`
 * and `b` `{ id, name, px, py, region, road }` - the same list on every client, whatever port it stands by.
 */
export function laneNetwork(ports, open) {
  const sea = [...ports].sort((p, q) => p.id - q.id).map((p) => ({ ...p, road: roadsteadOf(p, open) })).filter((p) => p.road);
  const pairs = new Map();
  for (const p of sea) {
    const near = sea.filter((q) => q !== p).map((q) => ({ q, d: Math.hypot(q.road.x - p.road.x, q.road.y - p.road.y) }))
      .filter((x) => x.d > 0 && x.d <= LANE_MAX_PX).sort((x, y) => x.d - y.d || x.q.id - y.q.id).slice(0, LANE_NEIGHBOURS);
    for (const { q } of near) {
      const [a, b] = p.id < q.id ? [p, q] : [q, p];
      const key = `${a.id}-${b.id}`;
      if (!pairs.has(key)) pairs.set(key, { key, a, b });
    }
  }
  return [...pairs.values()];
}

/** A lane's way in native points, a to b (straightened), and its length (m) - or null where the water joins them not. */
export function laneWay(lane, water, waterNative) {
  const px = lanePixels(lane.a.road, lane.b.road, water);
  if (!px) return null;
  const pts = straighten(px, waterNative);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) * M_PER_NATIVE;
  return { pts, len };
}

/** The lane's own seed (its two ports'). */
export const laneSeed = (lane) => hash32(lane.a.id >>> 0, lane.b.id >>> 0, LANE_SALT);
/** A lane's `k`th packet: her seed (the lane's, her place in it, her voyage), her class (a crown's on LANE_NAVY of them,
 *  never a galley - she moors), her cruise (m/s) and her share of the lane's cycle. */
export function packetOf(lane, k = 0, count = 1) {
  const seed = hash32(laneSeed(lane), k >>> 0, LANE_SALT);
  const r = mulberry32(seed);
  const faction = r() < LANE_NAVY ? 'navy' : 'merchant';
  let cls = classFor(faction, LANE_LEVEL, r());   // one level for every player: her class is the lane's, never a reader's
  if (cls?.hull === HULL.LargeGalley) cls = classFor(faction, 1, r());
  return { seed, cls, speed: (cls?.speed ?? 4) * LANE_CRUISE, phase: (mulberry32(laneSeed(lane))() + k / Math.max(1, count)) % 1 };
}

/** The point `s` metres along `pts` (native) from its start, and the leg it lies on (`dx`, `dz`, native: the caller
 *  turns it into the scene's heading). */
function along(pts, s) {
  let left = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.z - a.z) * M_PER_NATIVE;
    if (left <= seg || i === pts.length - 1) {
      const k = seg > 0 ? Math.min(1, left / seg) : 1;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: b.x - a.x, dz: b.z - a.z };
    }
    left -= seg;
  }
  const p = pts[pts.length - 1];
  return { x: p.x, z: p.z, dx: 0, dz: 0 };
}

/**
 * THE PACKETS OF A LANE at shared time `ms`, each `{ id, lane, k, voyage, seed, seeds, cls, region, phase: 'sail' |
 * 'dwell', from, to, port, at: { x, z }, dir: { x, z }, leg, until }` - native points; `dir` her way on the map (native),
 * `leg` the water she sails (AUDIT BAY A6: the leg under her - or, lying at a port, the one that brought her there -
 * her way's points from the port she left to the one she makes for: the host steers her along it from wherever she
 * is, never for her place on the clock); `port` the port she lies at while she dwells (`to` the one she sails for
 * next), `until` the shared second her dwell ends; `region` her home port's (AUDIT BAY A8: her names the lane's,
 * wherever she is met). A lane sails one every LANE_HEADWAY_S each way (its round trip over it, one at the least), each
 * on her own share of the cycle; a packet's `id` names her lane, her place and her voyage (a cycle of the clock: one
 * sunk or taken is spent for it, and the next is another ship, her `seed` another) - and `seeds` the seeds of her
 * place's last LANE_LINEAGE voyages, hers first (AUDIT BAY A17: a ship still on the water sails on as the packet of the
 * next). Stateless.
 */
export function packetsAt(lane, way, ms) {
  const first = packetOf(lane);
  const leg = way.len / Math.max(0.1, first.speed);
  const count = Math.max(1, Math.round((2 * (leg + LANE_DWELL_S)) / LANE_HEADWAY_S));
  const out = [];
  for (let k = 0; k < count; k++) out.push(packetAt(lane, way, ms, k, count));
  return out;
}
/** The lane's `k`th packet of `count`, at shared time `ms` (packetsAt's). */
export function packetAt(lane, way, ms, k = 0, count = 1) {
  const p = packetOf(lane, k, count);
  const leg = way.len / Math.max(0.1, p.speed);
  const period = 2 * (leg + LANE_DWELL_S);
  const t = ms / 1000 + p.phase * period;
  const voyage = Math.floor(t / period);
  const tau = t - voyage * period;
  const seeds = [];
  for (let j = 0; j < LANE_LINEAGE; j++) seeds.push(hash32(p.seed, (voyage - j) >>> 0, LANE_SALT));
  const base = { id: `L${lane.key}.${k}.${voyage}`, lane: lane.key, k, voyage, seed: seeds[0], seeds, cls: p.cls, region: lane.a.region ?? -1 };
  const rev = [...way.pts].reverse();
  const sailing = (pts, s, from, to) => {
    const here = along(pts, s);
    return { ...base, phase: 'sail', from, to, port: null, at: { x: here.x, z: here.z }, dir: { x: here.dx, z: here.dz }, leg: pts, until: null };
  };
  const end = (pts) => pts[pts.length - 1];
  const start = voyage * period - p.phase * period;   // her voyage's first second on the shared clock
  if (tau < leg) return sailing(way.pts, tau * p.speed, lane.a, lane.b);
  if (tau < leg + LANE_DWELL_S) {
    const e = end(way.pts);
    return { ...base, phase: 'dwell', from: lane.a, to: lane.a, port: lane.b, at: { x: e.x, z: e.z }, dir: { x: 0, z: 0 }, leg: way.pts, until: start + leg + LANE_DWELL_S };
  }
  if (tau < 2 * leg + LANE_DWELL_S) return sailing(rev, (tau - leg - LANE_DWELL_S) * p.speed, lane.b, lane.a);
  const e = end(rev);
  return { ...base, phase: 'dwell', from: lane.b, to: lane.b, port: lane.a, at: { x: e.x, z: e.z }, dir: { x: 0, z: 0 }, leg: rev, until: start + period };
}

/**
 * AUDIT BAY A6: PURSUIT - the point `ahead` on along `leg` (`[[x, z], ...]`, any units) from the point of it
 * nearest (x, z), and how far that nearest point lies from the leg's end along it (`left`), or null for no leg. A packet
 * steered for her place on the clock made straight for it wherever she was - lagging a bend behind it, across the land
 * the lane goes round - and came back for it when she outsailed it; steered along her leg from where she is, she keeps
 * to its water and only ever goes on.
 */
export function pursue(leg, x, z, ahead) {
  if (!leg?.length) return null;
  if (leg.length === 1) return { x: leg[0][0], z: leg[0][1], left: 0 };
  const len = (i) => Math.hypot(leg[i][0] - leg[i - 1][0], leg[i][1] - leg[i - 1][1]);
  let best = Infinity, seg = 1, t = 0;
  for (let i = 1; i < leg.length; i++) {
    const ax = leg[i - 1][0], az = leg[i - 1][1], dx = leg[i][0] - ax, dz = leg[i][1] - az, l2 = dx * dx + dz * dz;
    const k = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    const d = (x - (ax + dx * k)) ** 2 + (z - (az + dz * k)) ** 2;
    if (d < best) { best = d; seg = i; t = k; }
  }
  let left = len(seg) * (1 - t);
  for (let i = seg + 1; i < leg.length; i++) left += len(i);
  let need = Math.max(0, ahead);
  for (let i = seg, k = t; i < leg.length; i++, k = 0) {
    const L = len(i), rest = L * (1 - k);
    if (L > 0 && need <= rest) {
      const kk = k + need / L;
      return { x: leg[i - 1][0] + (leg[i][0] - leg[i - 1][0]) * kk, z: leg[i - 1][1] + (leg[i][1] - leg[i - 1][1]) * kk, left };
    }
    need -= rest;
  }
  const e = leg[leg.length - 1];
  return { x: e[0], z: e[1], left };
}
