// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ZONE GIANTS (2026-10-08, the owner: "can you always spawn 2 giants per tier and make em show on the map where they
// wander around? dont use the 15% anymore if this is possible")
//
// The zone's giants are no longer a wanderer's roll. Every tier keeps TWO giants, always - eight in the zone - and each
// one WANDERS: its place at any moment is a pure function of the time (the relay's clock, the same skew the halls read)
// and the zone's mask, so every client sees every giant in the same place on the map, walking the same way.
//
// HOW A GIANT WALKS: each day it keeps a HOME, the lowest of a few free cells of its tier the day draws, and walks a chain
// of straight LEGS, each WILD_GIANT_LEG_MS long, between waypoints - free cells of its tier within WILD_GIANT_ROAM_PX of
// the home; a day on, a new home. WW-C2: the cells are the mask's (wildZone.js, Cyrodiil's of four pixels), each place a
// map pixel; `free`, the host's ground test, is asked of the cells a home or a leg draws, never a whole tier (WILD-FREE).
//
// DEAD: a giant killed is the hub's word (net/wild/wildLaw.js wdunGiantDie - kept with the halls), down for
// WILD_GIANT_RESPAWN_MS for everyone, then it walks again from wherever its path has got to.
// Pure: the mask, a pixel test and a time in; the giants out.
// ═══════════════════════════════════════════════════════════════════
import { WILD_RINGS, maskWorld, ringOfCell, wildInside } from './wildZone.js';

export const WILD_GIANTS_PER_RING = 2;
export const WILD_GIANT_COUNT = WILD_GIANTS_PER_RING * WILD_RINGS;
/** One leg of a giant's walk (real milliseconds). */
export const WILD_GIANT_LEG_MS = 20 * 60_000;
/** How far from its day's home a giant roams (map pixels - a cell at the least). */
export const WILD_GIANT_ROAM_PX = 5;
/** WW-C2: how many cells a home's draw asks the ground of - the lowest free one is the home (GIANT-FIELDS). */
export const WILD_GIANT_HOME_DRAWS = 8;
/** A killed giant is down this long for everyone. */
export const WILD_GIANT_RESPAWN_MS = 30 * 60_000;
/** A giant is stood in the world (out of its path, onto the ground) once the player is this near its place (metres). */
export const WILD_GIANT_STAND_M = 320;
/**
 * RPT1026-MISC GIANT-ROCK (a private report, the second sighting: giants of the open zone standing inside rocks): THE GROUND A GIANT
 * IS STOOD ON IS CLEAR OF SOLIDS. GIANT-FIELDS chose its spot by the height map alone - flat, no crest, no water, inside
 * the zone - and the Wrothgarian Mountains' rocks (World of Daggerfall's landform pieces, a mesh each in the collider) stand
 * on flat ground too: a Greater Giant, four times its size (wildZone.js WILD_GIANT_SIZE), and the ten its call brings were
 * stood inside them. A spot is refused where any solid of the world collider lies within GIANT_CLEAR_R of the giant's
 * lower body (GIANT_CLEAR_LIFT over its feet) - the collider's own open-space test, CreateFoe's (PlaceFoeFreely,
 * `sphereOverlaps`) - or holds it inside (`insideSolid`, UNSTUCK-OUT's). The ground is the height map's and never a solid,
 * so open ground answers clear. Pure: the collider in.
 */
export const GIANT_CLEAR_R = 2.5;
export const GIANT_CLEAR_LIFT = 3;
/** A solid's face within reach of the body (`sphereOverlaps`), or the body inside a solid whose faces are all farther off
 *  (`insideSolid` - a rock scaled up hundreds of times holds a giant with no face near it).
 *  @param {{ sphereOverlaps?: (c: number[], r: number) => boolean, insideSolid?: (p: number[]) => boolean } | null} collider
 *  @param {number} x @param {number} h @param {number} z */
export function giantGroundBlocked(collider, x, h, z) {
  if (!collider) return false;
  const c = [x, h + GIANT_CLEAR_LIFT, z];
  return !!(collider.sphereOverlaps?.(c, GIANT_CLEAR_R) || collider.insideSolid?.(c));
}
const DAY_MS = 24 * 3_600_000;

const mix = (a, b) => {
  let h = (a ^ Math.imul(b + 0x7f4a7c15, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/** A giant's tier (1..4) by its index (0..7): two a tier, the outer tier's first. */
export const wildGiantRing = (g) => Math.floor((g | 0) / WILD_GIANTS_PER_RING) + 1;

const _cells = new WeakMap();
/** GIANT-FIELDS (the owner: "make sure the giants dont spawn on top of mounts only in a free field"): a home is the
 *  lowest of the free cells its draw asks (the height map's byte), and a waypoint one of the LOWER half of the cells
 *  about the home - the valleys and the open fields, never the peaks. WW-C2: the low half the home's own ground's, where it
 *  was the whole tier's (a province's tier is too wide a ground to rank, and too varied for one median). */
export const WILD_GIANT_LOW_SHARE = 0.5;
/** Each tier's cells `[{x, y}]` (the mask's grid), and the ground's answers asked so far - read once a mask. */
function cellsOf(mask, free, heightAt = null) {
  let c = _cells.get(mask);
  if (c && c.free === free && c.heightAt === heightAt) return c;
  const box = mask.box ?? { x0: 0, y0: 0, x1: mask.width - 1, y1: mask.height - 1 };
  const all = Array.from({ length: WILD_RINGS + 1 }, () => []);
  for (let y = box.y0; y <= box.y1; y++)
    for (let x = box.x0; x <= box.x1; x++) {
      const r = ringOfCell(mask, x, y);
      if (r) all[r].push({ x, y });
    }
  /** @type {Map<number, boolean>} */
  const asked = new Map();
  const mid = (p) => maskWorld(mask, p.x + 0.5, p.y + 0.5).map(Math.floor);
  const isFree = (p) => {
    const k = p.y * mask.width + p.x;
    let f = asked.get(k);
    if (f === undefined) {
      const [x, y] = mid(p);
      asked.set(k, (f = !!free(x, y)));
    }
    return f;
  };
  const low = (p) => {
    if (!heightAt) return 0;
    const [x, y] = mid(p);
    return heightAt(x, y);
  };
  c = { free, heightAt, all, isFree, low, mid, legs: new Map(), homes: new Map(), mask };
  _cells.set(mask, c);
  return c;
}

/** The giant's home on a day: the lowest free cell of WILD_GIANT_HOME_DRAWS its tier's draw asks (the second of a tier
 *  the farthest of them from the first's). */
function homeOf(c, g, day) {
  const key = `${g}:${day}`;
  let h = c.homes.get(key);
  if (h !== undefined) return h;
  const list = c.all[wildGiantRing(g)];
  const draws = list.length
    ? Array.from(
        { length: WILD_GIANT_HOME_DRAWS },
        (_, k) => list[mix(day * 31 + 7 + k * 101, g) % list.length],
      ).filter(c.isFree)
    : [];
  if (!draws.length) h = null;
  else if (g % WILD_GIANTS_PER_RING === 1 && homeOf(c, g - 1, day)) {
    const first = /** @type {{x:number,y:number}} */ (homeOf(c, g - 1, day)); // apart from its twin: the farthest
    h = draws.reduce((a, b) =>
      Math.hypot(b.x - first.x, b.y - first.y) > Math.hypot(a.x - first.x, a.y - first.y) ? b : a,
    );
  } else h = draws.reduce((a, b) => (c.low(b) < c.low(a) ? b : a));
  c.homes.set(key, h);
  if (c.homes.size > 256) c.homes.delete(c.homes.keys().next().value);
  return h;
}

/** The giant's waypoint at leg `leg` (a free cell of its tier near the day's home). */
function waypointOf(c, g, leg) {
  const key = `${g}:${leg}`;
  let w = c.legs.get(key);
  if (w !== undefined) return w;
  const day = Math.floor((leg * WILD_GIANT_LEG_MS) / DAY_MS);
  const home = homeOf(c, g, day);
  if (!home) {
    c.legs.set(key, null);
    return null;
  }
  // GIANT-LEASH2: the day's first leg starts at its home; every next waypoint is one the giant can WALK to from the last
  // in a straight line without leaving the zone (a bay in the border is walked round, never across) - none such, it
  // stands where it is for the leg
  const first = Math.floor(((leg - 1) * WILD_GIANT_LEG_MS) / DAY_MS) !== day;
  const prev = first ? null : waypointOf(c, g, leg - 1);
  if (first) w = home;
  else {
    const reach = Math.max(1, Math.ceil(WILD_GIANT_ROAM_PX / (c.mask.cell ?? 1))),
      ring = wildGiantRing(g);
    let near = [];
    for (let y = home.y - reach; y <= home.y + reach; y++)
      for (let x = home.x - reach; x <= home.x + reach; x++)
        if (ringOfCell(c.mask, x, y) === ring && (!prev || lineInside(c.mask, prev, { x, y }))) near.push({ x, y });
    if (c.heightAt && near.length >= 8) {
      // GIANT-FIELDS: the low half of the ground about the home
      const hs = near.map(c.low).sort((a, b) => a - b),
        cut = hs[Math.floor((hs.length - 1) * WILD_GIANT_LOW_SHARE)];
      near = near.filter((p) => c.low(p) <= cut);
    }
    // the leg's draw, and the next ones round the window until a free cell answers
    const at = near.length ? mix(leg, g * 977 + 13) % near.length : 0;
    w = prev ?? home;
    for (let k = 0; k < near.length; k++) {
      const q = near[(at + k) % near.length];
      if (c.isFree(q)) {
        w = q;
        break;
      }
    }
  }
  c.legs.set(key, w);
  if (c.legs.size > 4096) c.legs.delete(c.legs.keys().next().value);
  return w;
}
/** WW-C2: a giant's place on the world at a point of the cells' grid - a cell's middle its middle pixel's (a hall's own
 *  pixel, wildDungeons.js), the walk between at the grid's scale. */
const giantWorld = (mask, cx, cy) =>
  maskWorld(mask, cx - 0.5, cy - 0.5).map((v) => v + Math.floor((mask.cell ?? 1) / 2) + 0.5);
/** Does a giant at grid point (cx, cy) stand in the zone - its cell the zone's, and (ZONE-LINE) the world pixel under it the
 *  zone's own: a cell whose middle is the province's may hold a pixel or two past the province's line. */
const giantIn = (mask, cx, cy) =>
  !!ringOfCell(mask, Math.floor(cx), Math.floor(cy)) && wildInside(mask, ...giantWorld(mask, cx, cy));
/** Does the straight walk from cell `a` to cell `b` (their middles) stay inside the zone all the way? */
function lineInside(mask, a, b) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4));
  for (let k = 0; k <= n; k++) {
    if (!giantIn(mask, a.x + 0.5 + ((b.x - a.x) * k) / n, a.y + 0.5 + ((b.y - a.y) * k) / n)) return false;
  }
  return true;
}

/**
 * Where every giant walks at `now` (the relay's clock): `[{ g, ring, x, y, heading }]` in map pixels (fractional - the
 * centre of a pixel is +0.5), `heading` the way it walks (radians on the map, 0 east).
 * @param {{ width:number, height:number, depth:ArrayLike<number>, maxDepth:number, box?:object, ox?:number, oy?:number, cell?:number }} mask
 * @param {(x:number, y:number) => boolean} free
 * @param {number} now
 * @param {(g:number) => boolean} [dead] a giant down
 * @param {((x:number, y:number) => number)|null} [heightAt] the height map's byte - the giants keep to the low ground
 */
export function wildGiantsAt(mask, free, now, dead = () => false, heightAt = null) {
  if (!mask?.depth || !mask.maxDepth) return [];
  const c = cellsOf(mask, free, heightAt);
  const out = [];
  for (let g = 0; g < WILD_GIANT_COUNT; g++) {
    if (dead(g)) continue;
    const t = now + g * 157_000; // each giant's legs out of step with the others'
    const leg = Math.floor(t / WILD_GIANT_LEG_MS);
    const f = (t - leg * WILD_GIANT_LEG_MS) / WILD_GIANT_LEG_MS;
    const a = waypointOf(c, g, leg),
      b = waypointOf(c, g, leg + 1);
    if (!a || !b) continue;
    let cx = a.x + 0.5 + (b.x - a.x) * f,
      cy = a.y + 0.5 + (b.y - a.y) * f;
    // GIANT-LEASH (the owner: "giant should not be able to walk out of the zone"): a straight line between two waypoints
    // of its tier that cuts over the zone's edge (a bay in the border) is not walked out there - the giant waits at the
    // nearer waypoint until the line comes back in
    if (!giantIn(mask, cx, cy)) {
      const p = f < 0.5 ? a : b;
      cx = p.x + 0.5;
      cy = p.y + 0.5;
    } // ZONE-LINE: the zone's own pixel too
    const [x, y] = giantWorld(mask, cx, cy);
    out.push({ g, ring: wildGiantRing(g), x, y, heading: Math.atan2(b.y - a.y, b.x - a.x) });
  }
  return out;
}
