// @ts-check
// LEFAY1 (2026-10-08, asked: "In the middle of gothway garden, I want to build and implement a monument to Julian LeFay,
// one of the creators of daggerfall, with the ability of people to interact and throw flowers on it"): THE MONUMENT TO
// JULIAN LEFAY, ITS LAW - where it stands in Gothway Garden, what it is made of, what its plaque says, and where a
// flower thrown at it comes to rest. Pure: no renderer, no GL, no clock (scenes/lefayMonumentHost.js stands it).
//
// WHERE: Gothway Garden (the Daggerfall region's hamlet; test/audit18_hosts_outer.test.js reads its type off MAPS.BSA),
// in every read of it - Daggerfall's own layout or a pack's - at the open ground nearest the middle of its block grid.
// The town's own navgrid says what is open (world/cityNavigation.js: DFU's CityNavigation carve, every automap byte a
// building, a tree or a lamp has drawn closed, the water closed): the spot is the nearest cell to the grid's middle
// whose whole MONUMENT_CLEAR_M round it is open ground, a road counted against it (a monument stands on a green, not
// across a street, where the town has one). A function of the layout alone, so every client stands it on one spot.
// The spot is carved out of the wandering people's navgrid (carveLefay), so they walk round it.
//
// WHAT: three octagonal granite steps, a marble pedestal with a bronze plaque on each face, and a marble obelisk
// tipped in gilt - the port's own geometry in the monument's own frame (y up from the ground at its middle, its faces
// on the axes), cut from the port's own art (world/lefayArt.js, LEFAY_ARCHIVE): no game data at all.
//
// THE FLOWERS: Daggerfall's own (TEXTURE.254's roses and flowers - systems/arenaCrowd.js THROWN_FLOWERS, the arena
// crowd's), thrown from the hand on a short arc to a rest on one of the steps or the ground at their foot, on the
// thrower's side. A character keeps the count of what it laid and the newest MONUMENT_FLOWERS_KEPT where they lay
// (normalTribute - systems/save.js carries it), so a pile laid stands there again after a load.
//
// Not a DFU member. Ledger A (LEFAY).
import { REGION_NAMES } from '../formats/mapsTables.js';
import { CityNavigation, NAV_CELL, HALF_CELL } from './cityNavigation.js';
import { THROWN_FLOWERS } from '../systems/arenaCrowd.js';

/** The town, by its region's name and its own (a pack's read of it keeps both). */
export const LEFAY_TOWN = 'Gothway Garden';
export const LEFAY_REGION = REGION_NAMES.indexOf('Daggerfall');
/** Is `loc` (a DFLocation, as MapsFile reads it) Gothway Garden? */
export const isLefayTown = (loc) => !!loc && loc.regionIndex === LEFAY_REGION && loc.name === LEFAY_TOWN;

/** The man, and what the plaque and the hover say of him. */
export const LEFAY_TEXT = Object.freeze({
  title: 'Monument to Julian LeFay',
  years: '1965 - 2025',
  epithet: 'Father of The Elder Scrolls',
  /** The plaque's engraving, line by line - drawn twice the size for the name and the years (world/lefayArt.js). */
  plaque: Object.freeze(['JULIAN LEFAY', '1965 - 2025', 'FATHER OF', 'THE ELDER SCROLLS']),
  /** Info mode, or the plaque's Read row: the inscription read aloud. */
  read: Object.freeze([
    'Julian LeFay, 1965 - 2025.',
    'Father of The Elder Scrolls, and one of the makers of Daggerfall.',
    'Travellers lay flowers at his stone.',
  ]),
  laid: 'You lay flowers for Julian LeFay.',
  steal: 'You leave the flowers where they lie.',
  /** The plaque's line for a character that has laid some. */
  count: (n) => `You have laid ${n} ${n === 1 ? 'flower' : 'flowers'} here`,
});
/** The plaque's rows (systems/worldHover.js resolveHover): the lit one is what a press does. */
export const LEFAY_ROWS = Object.freeze([
  Object.freeze({ id: 'flowers', label: 'Throw flowers' }),
  Object.freeze({ id: 'read', label: 'Read the inscription' }),
]);
/** The one key it answers to - the eye's box and its collider bucket are one name, so the ray from a body standing on
 *  its steps meets it at its stone (player/activate.js CASTLE1: a surface its own bucket owns). */
export const LEFAY_KEY = 'lefay:monument';

// ── THE SPOT ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Open ground the monument needs round its middle, metres: its lowest step (MONUMENT_STEPS[0].r) and the flowers'
 *  ring at its foot, and a pace to walk round it. */
export const MONUMENT_CLEAR_M = 4.0;
/** How far from the grid's middle a spot is looked for, navgrid cells (one block's side is 64). */
export const MONUMENT_SEARCH_CELLS = 48;
/** What a road cell under it costs, in cells of distance from the middle (CityNavigation's Road family is weight 15). */
export const MONUMENT_ROAD_COST = 0.3;
export const ROAD_WEIGHT = 15;
/** The navgrid closed under it for the wandering people, metres from its middle: its lowest step and the flowers at its
 *  foot (AUDIT LEFAY1 A4: at 3.2 a walker's centre came within 3.58 m, its sprite over the ground ring's 3.3) - the
 *  cells of its clear disc, so the nearest a walker's centre comes is 4.5 m. */
export const MONUMENT_CARVE_M = 3.6;

/** The cell offsets within `m` metres of a cell's centre, nearest first. Pure. */
export function discCells(m) {
  const r = Math.floor(m / NAV_CELL), out = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.hypot(dx, dy) * NAV_CELL <= m) out.push([dx, dy]);
  return out.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
}
const CLEAR_DISC = discCells(MONUMENT_CLEAR_M);
const CARVE_DISC = discCells(MONUMENT_CARVE_M);

/**
 * WHERE IT STANDS on a navgrid: the cell nearest the grid's middle with all of MONUMENT_CLEAR_M round it open (weight
 * over 0), each road cell under it MONUMENT_ROAD_COST further; ties to the lower row, then the lower column. Null when
 * no cell within MONUMENT_SEARCH_CELLS is open enough. `x`, `z` the cell's centre in the location's frame (metres
 * from its origin - navToWorld's). Pure.
 * @param {{width: number, height: number, weightAt: (gx: number, gy: number) => number}} nav
 */
export function lefaySpot(nav) {
  if (!nav || !(nav.width > 0) || !(nav.height > 0)) return null;
  const mx = nav.width / 2, my = nav.height / 2;
  let best = null, bestScore = Infinity;
  const y0 = Math.max(0, Math.floor(my - MONUMENT_SEARCH_CELLS)), y1 = Math.min(nav.height - 1, Math.ceil(my + MONUMENT_SEARCH_CELLS));
  const x0 = Math.max(0, Math.floor(mx - MONUMENT_SEARCH_CELLS)), x1 = Math.min(nav.width - 1, Math.ceil(mx + MONUMENT_SEARCH_CELLS));
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const d = Math.hypot(gx + 0.5 - mx, gy + 0.5 - my);
      if (d > MONUMENT_SEARCH_CELLS || d >= bestScore) continue;   // a road only adds: a cell already further cannot win
      let open = true, roads = 0;
      for (const [dx, dy] of CLEAR_DISC) {
        const w = nav.weightAt(gx + dx, gy + dy);
        if (!(w > 0)) { open = false; break; }
        if (w === ROAD_WEIGHT) roads++;
      }
      if (!open) continue;
      const score = d + roads * MONUMENT_ROAD_COST;
      if (score < bestScore) { bestScore = score; best = { gx, gy }; }
    }
  }
  return best ? { gx: best.gx, gy: best.gy, x: best.gx * NAV_CELL + HALF_CELL, z: best.gy * NAV_CELL + HALF_CELL } : null;
}

/**
 * The spot in a laid-out location (world/locationLayout.js layoutLocation's `{width, height, blocks}`): its navgrid
 * carved as the wandering people's is, then lefaySpot. AUDIT LEFAY1 A3: ALWAYS on the enhanced lane's water table
 * (cityNavigation.js WATER-NPC) - the classic table walks seven records the player wades in (8, 23, 33-36, 49), so on
 * it the monument could stand in the shallows, and a client on each lane would stand it in a different place. Pure.
 * @param {{width: number, height: number, blocks: any[]}} loc
 */
export function lefaySpotOf(loc) {
  if (!loc?.blocks?.length || !(loc.width > 0) || !(loc.height > 0)) return null;
  const nav = new CityNavigation(loc.width, loc.height);
  for (const b of loc.blocks) {
    const fld = b.dfBlock?.rmbBlock?.fldHeader;
    if (!fld?.autoMapData || !fld.groundData?.groundTiles) continue;
    const tiles = fld.groundData.groundTiles;
    nav.setBlockData(b.x, b.y, fld.autoMapData, (tx, ty) => tiles[tx][ty].textureRecord, { enhancedWater: true });
  }
  return lefaySpot(nav);
}

/** Close the monument's ground on a navgrid (the wandering people's): every cell within MONUMENT_CARVE_M of its
 *  middle. Answers how many cells it closed. */
export function carveLefay(nav, spot) {
  if (!nav?.grid || !spot) return 0;
  let n = 0;
  for (const [dx, dy] of CARVE_DISC) {
    const gx = spot.gx + dx, gy = spot.gy + dy;
    if (!nav.inBounds(gx, gy)) continue;
    const i = gy * nav.width + gx;
    if (nav.grid[i] !== 0) { nav.grid[i] = 0; n++; }
  }
  return n;
}

// ── THE STONE ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The port's own pictures, under a pseudo-archive of their own (world/lefayArt.js draws them). */
export const LEFAY_ARCHIVE = 38211;
export const LEFAY_GRANITE = 0;
export const LEFAY_MARBLE = 1;
export const LEFAY_GILT = 2;
export const LEFAY_PLAQUE = 3;
export const LEFAY_BRONZE = 4;
/** Metres of stone one tile of its picture covers. */
export const STONE_TILE_M = 1.6;
/** How far the foot of the lowest step is sunk below the ground (a gentle slope never shows light under it). */
export const MONUMENT_FOOT = 0.4;
/** The three steps, octagons: radius to a corner, and the height of each top over the ground. */
export const MONUMENT_STEPS = Object.freeze([
  Object.freeze({ r: 2.8, top: 0.3 }),
  Object.freeze({ r: 2.15, top: 0.6 }),
  Object.freeze({ r: 1.5, top: 0.9 }),
]);
/** The pedestal, square (half its side): its base moulding, its die (the plaques' face) and its cornice. */
export const PEDESTAL = Object.freeze({
  baseHalf: 0.82, baseTop: 1.05,
  dieHalf: 0.7, dieTop: 2.45,
  corniceHalf: 0.84, corniceTop: 2.65,
});
/** The obelisk: half its side at its foot and its top, its top's height, and its gilt point's. */
export const OBELISK = Object.freeze({ footHalf: 0.46, topHalf: 0.28, top: 6.4, apex: 6.95 });
/** A plaque on each face of the die: its width, its height, its middle's height, and how far it stands proud. */
export const PLAQUE = Object.freeze({ w: 1.0, h: 0.8, mid: 1.75, proud: 0.03 });
/** The eye's boxes round it, one key: its steps (the lowest one's corners, to the top one's top) and its column (the
 *  cornice's square, to its gilt point) - two, so the air over its lower steps beside the column is not its own, and a
 *  door seen past it is not pressed into it. */
export const MONUMENT_BOXES = Object.freeze([
  Object.freeze([-MONUMENT_STEPS[0].r, 0, -MONUMENT_STEPS[0].r, MONUMENT_STEPS[0].r, MONUMENT_STEPS[2].top, MONUMENT_STEPS[0].r]),
  Object.freeze([-PEDESTAL.corniceHalf, 0, -PEDESTAL.corniceHalf, PEDESTAL.corniceHalf, OBELISK.apex, PEDESTAL.corniceHalf]),
]);

/** @param {number[]} a @param {number[]} b */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** @param {number[]} a @param {number[]} b */
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** @param {number[]} a */
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A flat-shaded face builder, by picture: each triangle's normal its own (gateModel.js faces' law). */
function faces() {
  /** @type {Map<number, {p: number[], n: number[], uv: number[]}>} */
  const byRec = new Map();
  const tri = (rec, a, b, c, ua, ub, uc) => {
    let g = byRec.get(rec);
    if (!g) byRec.set(rec, g = { p: [], n: [], uv: [] });
    const n = norm(cross(sub(b, a), sub(c, a)));
    for (const [v, u] of [[a, ua], [b, ub], [c, uc]]) { g.p.push(v[0], v[1], v[2]); g.n.push(n[0], n[1], n[2]); g.uv.push(u[0], u[1]); }
  };
  /** a, b, c, d counter-clockwise seen from outside. */
  const quad = (rec, a, b, c, d, ua, ub, uc, ud) => { tri(rec, a, b, c, ua, ub, uc); tri(rec, a, c, d, ua, uc, ud); };
  return { tri, quad, byRec };
}

/**
 * A prism or a frustum about the y axis: `sides` faces from radius `r0` at `y0` to `r1` at `y1` (radii to a corner),
 * turned so a face looks down +x (and, for four or eight sides, down every axis); its top capped flat when `cap`, in
 * `capRec` (or its own picture), and its foot when `under` (a piece that overhangs the one under it). Its sides wear
 * `rec` a tile every STONE_TILE_M.
 */
function frustum(f, rec, sides, r0, r1, y0, y1, { cap = true, capRec = rec, under = false } = {}) {
  const turn = Math.PI / sides;
  const at = (k, r, y) => { const a = (k / sides) * Math.PI * 2 - turn; return [Math.cos(a) * r, y, Math.sin(a) * r]; };
  const edge = 2 * Math.sin(Math.PI / sides);
  const v = (y1 - y0) / STONE_TILE_M;
  for (let k = 0; k < sides; k++) {
    const b0 = at(k, r0, y0), b1 = at(k + 1, r0, y0), t1 = at(k + 1, r1, y1), t0 = at(k, r1, y1);
    const u0 = (r0 * edge) / STONE_TILE_M, u1 = (r1 * edge) / STONE_TILE_M;
    if (r1 > 0) f.quad(rec, b0, t0, t1, b1, [0, v], [(u0 - u1) / 2, 0], [(u0 + u1) / 2, 0], [u0, v]);
    else f.tri(rec, b0, t0, b1, [0, v], [u0 / 2, 0], [u0, v]);   // a point: the quad's first triangle would have no area
    const uv = (p) => [0.5 + p[0] / STONE_TILE_M, 0.5 + p[2] / STONE_TILE_M];
    if (cap && r1 > 0) { const c = [0, y1, 0]; f.tri(capRec, c, t1, t0, uv(c), uv(t1), uv(t0)); }
    if (under) { const c = [0, y0, 0]; f.tri(capRec, c, b0, b1, uv(c), uv(b0), uv(b1)); }   // its foot, facing down
  }
}

/** A square block about the y axis, half its side `h`, from `y0` to `y1` - its top capped, and its foot when `under`. */
const block = (f, rec, h, y0, y1, under = false) => frustum(f, rec, 4, h * Math.SQRT2, h * Math.SQRT2, y0, y1, { under });

/** A plaque proud of the die's face at angle `a` (0 looks down +x, a quarter turn at a time): its face the whole
 *  engraving, its edges plain bronze. */
function plaque(f, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const { w, h, mid, proud } = PLAQUE, d0 = PEDESTAL.dieHalf, d1 = d0 + proud;
  // the face's frame: out (c, s), across (-s, c). AUDIT LEFAY1 A1: the world is DFU's, LEFT-handed, and the game draws
  // it so (world/mat4.js THE HANDEDNESS LAW: world +x lands screen-RIGHT) - so seen from outside, "across" runs to the
  // viewer's RIGHT, and the picture's left edge is at -across
  const P = (out, across, y) => [c * out - s * across, y, s * out + c * across];
  const y0 = mid - h / 2, y1 = mid + h / 2, hw = w / 2;
  // the face: its top-left (seen from outside) at the picture's top-left - v down the plaque, u across it
  f.quad(LEFAY_PLAQUE, P(d1, hw, y1), P(d1, hw, y0), P(d1, -hw, y0), P(d1, -hw, y1), [1, 0], [1, 1], [0, 1], [0, 0]);
  const e = [0, 0], g = [1, 0.1];
  f.quad(LEFAY_BRONZE, P(d0, hw, y1), P(d1, hw, y1), P(d1, -hw, y1), P(d0, -hw, y1), e, g, g, e);   // its top
  f.quad(LEFAY_BRONZE, P(d0, -hw, y0), P(d1, -hw, y0), P(d1, hw, y0), P(d0, hw, y0), e, g, g, e);   // its foot
  f.quad(LEFAY_BRONZE, P(d0, hw, y0), P(d1, hw, y0), P(d1, hw, y1), P(d0, hw, y1), e, g, g, e);     // its two ends
  f.quad(LEFAY_BRONZE, P(d0, -hw, y1), P(d1, -hw, y1), P(d1, -hw, y0), P(d0, -hw, y0), e, g, g, e);
}

/** The faces gathered by picture into renderer.createMesh's model shape (cageModel.js assemble's). */
function assemble(f) {
  const recs = [...f.byRec.keys()].sort((a, b) => a - b);
  const count = recs.reduce((n, r) => n + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(count);
  const subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec), n = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
    for (let i = 0; i < n; i++) indices[v + i] = v + i;
    subMeshes.push({ textureArchive: LEFAY_ARCHIVE, textureRecord: rec, startIndex: v, primitiveCount: n / 3 });
    v += n;
  }
  return { positions, normals, uvs, indices, subMeshes };
}

/** THE MONUMENT, in its own frame: renderer.createMesh's model shape (and the collider's - its positions and
 *  indices). Pure. */
export function buildLefayModel() {
  const f = faces();
  let y = -MONUMENT_FOOT;
  for (const step of MONUMENT_STEPS) { frustum(f, LEFAY_GRANITE, 8, step.r, step.r, y, step.top); y = step.top; }
  const P = PEDESTAL;
  block(f, LEFAY_MARBLE, P.baseHalf, y, P.baseTop);
  block(f, LEFAY_MARBLE, P.dieHalf, P.baseTop, P.dieTop);
  block(f, LEFAY_MARBLE, P.corniceHalf, P.dieTop, P.corniceTop, true);   // AUDIT LEFAY1 A2: it overhangs the die - its underside seen from the ground
  const O = OBELISK;
  frustum(f, LEFAY_MARBLE, 4, O.footHalf * Math.SQRT2, O.topHalf * Math.SQRT2, P.corniceTop, O.top, { cap: false });
  frustum(f, LEFAY_GILT, 4, O.topHalf * Math.SQRT2, 0, O.top, O.apex, { cap: false });
  for (let k = 0; k < 4; k++) plaque(f, (k * Math.PI) / 2);
  return assemble(f);
}

// ── THE FLOWERS ──────────────────────────────────────────────────────────────────────────────────────────────────
/** The flowers thrown: the arena crowd's (TEXTURE.254 - the red and yellow roses, the red and yellow flowers, the
 *  white rose). */
export const LEFAY_FLOWERS = THROWN_FLOWERS;
/** A flower's picture at this share of its classic size (a bloom, not a bush). */
export const FLOWER_SCALE = 0.55;
/** How many a character's pile keeps where they lay (the count goes on past it). */
export const MONUMENT_FLOWERS_KEPT = 48;
/** A throw's flight, ms, and how high its arc rises over the straight line, metres. */
export const TOSS_MS = 850;
export const TOSS_ARC = 0.9;
/** The least time between two throws, ms. */
export const TOSS_EVERY_MS = 1200;
/** How far either side of the thrower's bearing a flower may land, radians. */
export const TOSS_SPREAD = 0.7;
/** Where a flower comes to rest: on each step's top between the next step's corners and its own face, or on the ground
 *  at the lowest step's foot - each ring's height, its radii (metres from the middle), and its share of the throws. */
export const FLOWER_RINGS = Object.freeze([
  Object.freeze({ y: MONUMENT_STEPS[2].top, r0: 1.22, r1: 1.32, share: 0.35 }),
  Object.freeze({ y: MONUMENT_STEPS[1].top, r0: 1.6, r1: 1.9, share: 0.3 }),
  Object.freeze({ y: MONUMENT_STEPS[0].top, r0: 2.25, r1: 2.5, share: 0.2 }),
  Object.freeze({ y: 0, r0: 2.95, r1: 3.3, share: 0.15 }),
]);

/**
 * A throw's rest: the ring the first draw names (by FLOWER_RINGS' shares), its bearing within TOSS_SPREAD of the
 * thrower's (`bearing`, radians - atan2 of east over north from the monument to the thrower), and how far across the
 * ring - as the record's entry `[deg, kind, ring, across]` (whole degrees, the flower's index in LEFAY_FLOWERS, the
 * ring's index, tenths across it), which is what a save keeps. `rand` three draws in [0, 1). Pure.
 * @param {number} bearing @param {() => number} rand
 */
export function tossRest(bearing, rand) {
  let pick = rand(), ring = FLOWER_RINGS.length - 1;
  for (let i = 0; i < FLOWER_RINGS.length; i++) { if (pick < FLOWER_RINGS[i].share) { ring = i; break; } pick -= FLOWER_RINGS[i].share; }
  const a = bearing + (rand() * 2 - 1) * TOSS_SPREAD;
  const deg = ((Math.round((a * 180) / Math.PI) % 360) + 360) % 360;
  const kind = Math.min(LEFAY_FLOWERS.length - 1, Math.floor(rand() * LEFAY_FLOWERS.length));
  const across = Math.min(9, Math.floor(rand() * 10));
  return [deg, kind, ring, across];
}

/** A laid entry's place in the monument's frame (y up from its ground; the flower's base). Pure. */
export function flowerPlace(entry) {
  const [deg, , ring, across] = entry;
  const R = FLOWER_RINGS[ring] ?? FLOWER_RINGS[FLOWER_RINGS.length - 1];
  const a = (deg * Math.PI) / 180, r = R.r0 + ((R.r1 - R.r0) * across) / 9;
  return [Math.sin(a) * r, R.y, Math.cos(a) * r];
}

/** A flight's point at `k` (0..1) from `from` to `to`, its arc TOSS_ARC over the line at its middle. Pure. */
export function tossPoint(from, to, k, out = [0, 0, 0]) {
  const t = Math.min(1, Math.max(0, k));
  const u = 1 - t;   // weighted from both ends, so it leaves the hand and lands on its rest exactly
  out[0] = from[0] * u + to[0] * t;
  out[1] = from[1] * u + to[1] * t + (t > 0 && t < 1 ? Math.sin(Math.PI * t) * TOSS_ARC : 0);
  out[2] = from[2] * u + to[2] * t;
  return out;
}

/** A laid entry as a save may hold it - four whole numbers in range - or null. Pure. */
const normalEntry = (e) => {
  if (!Array.isArray(e) || e.length !== 4 || ![0, 1, 2, 3].every((i) => Number.isSafeInteger(e[i]))) return null;   // AUDIT LEFAY1 A5: a hole is no number
  const [deg, kind, ring, across] = e;
  if (deg < 0 || deg >= 360 || kind < 0 || kind >= LEFAY_FLOWERS.length || ring < 0 || ring >= FLOWER_RINGS.length || across < 0 || across > 9) return null;
  return [deg, kind, ring, across];
};
/**
 * A character's tribute as the save keeps it: `{count, laid}` - how many it ever laid (a whole number, never fewer than
 * it keeps), and the newest MONUMENT_FLOWERS_KEPT laid entries, oldest first. Anything else reads as none laid. Pure.
 */
export function normalTribute(t) {
  const laid = Array.isArray(t?.laid) ? t.laid.map(normalEntry).filter(Boolean).slice(-MONUMENT_FLOWERS_KEPT) : [];
  const count = Number.isSafeInteger(t?.count) && t.count > 0 ? t.count : 0;
  return { count: Math.max(count, laid.length), laid };
}
/** The tribute with one more laid: counted, and kept with the oldest let go past MONUMENT_FLOWERS_KEPT. Pure. */
export function layFlower(t, entry) {
  const n = normalTribute(t), e = normalEntry(entry);
  if (!e) return n;
  return { count: n.count + 1, laid: [...n.laid, e].slice(-MONUMENT_FLOWERS_KEPT) };
}
