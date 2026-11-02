// @ts-check
// LEFAY1 (2026-10-08): THE MONUMENTS' LAW - where each stands, what it is made of, what its plaque says, and where a
// flower thrown at it comes to rest. Pure: no renderer, no GL, no clock (scenes/lefayMonumentHost.js stands them).
// Not a DFU member. Ledger A (LEFAY).
//
// TWO MONUMENTS, one stone (MONUMENTS): Julian LeFay's and (STEWART-MONUMENT) Patrick Stewart's. Each its own text,
// plaque, key and tribute; the steps, the pedestal, the obelisk and the flowers' law are one.
import { REGION_NAMES } from '../formats/mapsTables.js';
import { CityNavigation, NAV_CELL, HALF_CELL } from './city/cityNavigation.js';
import { THROWN_FLOWERS } from '../systems/arena/arenaCrowd.js';
import { ROAD_WEIGHT } from './city/cityNavigation.js';
import { IMPERIAL, IMPERIAL_SPAN, IMPERIAL_CELLS, polar } from './imperialCity.js';
import { BLOCK_M } from './blockHash.js';
import { t } from '../systems/textManager.js';

// GOTHWAY-MONUMENT (2026-10-30, the owner: "move the Julian monument to a more player facing location in gothway. Where
// players mostly populate"): Gothway Garden's north entrance, beside the road in from Privateer's Hold - the way every
// new character comes into town, where GOTHWAY-NORTH stood its boards. It stood outside the Hold from HOLD-MONUMENT.
/** The place, by its region's name and its own (a pack's read of it keeps both). */
export const LEFAY_TOWN = 'Gothway Garden';
export const LEFAY_REGION = REGION_NAMES.indexOf('Daggerfall');
/** Is `loc` (a DFLocation, as MapsFile reads it) Gothway Garden? */
export const isLefayTown = (loc) => !!loc && loc.regionIndex === LEFAY_REGION && loc.name === LEFAY_TOWN;

const LEFAY_YEARS = '1965 - 2025',
  LEFAY_EPITHET = 'Father of The Elder Scrolls';
const travelers = () => t('monument.travelers', 'Travelers lay flowers at his stone.');
/** The man, and what the plaque and the hover say of him. The words both monuments share read through t() as asked. */
export const LEFAY_TEXT = Object.freeze({
  title: 'Monument to Julian LeFay',
  years: LEFAY_YEARS,
  epithet: LEFAY_EPITHET,
  /** The hover's lines under its title. */
  subs: Object.freeze([LEFAY_YEARS, LEFAY_EPITHET]),
  /** The plaque's engraving, line by line - drawn twice the size for the name and the years (world/lefayArt.js). */
  plaque: Object.freeze(['JULIAN LEFAY', '1965 - 2025', 'FATHER OF', 'THE ELDER SCROLLS']),
  /** Info mode, or the plaque's Read row: the inscription read aloud. */
  get read() {
    return [
      'Julian LeFay, 1965 - 2025.',
      'Father of The Elder Scrolls, and one of the makers of Daggerfall.',
      travelers(),
    ];
  },
  laid: 'You lay flowers for Julian LeFay.',
  get steal() {
    return t('monument.steal', 'You leave the flowers where they lie.');
  },
  /** The plaque's line for a character that has laid some. */
  count: (n) => t('monument.count', 'You have laid {n, plural, one {# flower} other {# flowers}} here', { n }),
});
/** STEWART-MONUMENT (2026-10-30, the owner: "add a Patrick Stewart monument in the Imperial City next to the gold white
 *  tower"): the actor who gave Emperor Uriel Septim VII his voice in The Elder Scrolls IV: Oblivion. */
export const STEWART_TEXT = Object.freeze({
  get title() {
    return t('monument.stewart.title', 'Monument to Patrick Stewart');
  },
  get subs() {
    return [t('monument.stewart.voice', 'The voice of Emperor Uriel Septim VII')];
  },
  /** The name over two lines at twice the size (it is too long for one), then the two small lines. */
  plaque: Object.freeze(['PATRICK', 'STEWART', 'THE VOICE OF', 'URIEL SEPTIM VII']),
  get read() {
    return [
      t('monument.stewart.name', 'Patrick Stewart.'),
      t('monument.stewart.read', 'He gave his voice to Emperor Uriel Septim VII in The Elder Scrolls IV: Oblivion.'),
      travelers(),
    ];
  },
  get laid() {
    return t('monument.stewart.laid', 'You lay flowers for Patrick Stewart.');
  },
  get steal() {
    return LEFAY_TEXT.steal;
  },
  count: LEFAY_TEXT.count,
});
/** The plaque's rows (systems/worldHover.js resolveHover): the lit one is what a press does. */
export const LEFAY_ROWS = Object.freeze([
  Object.freeze({
    id: 'flowers',
    get label() {
      return t('monument.row.flowers', 'Throw flowers');
    },
  }),
  Object.freeze({
    id: 'read',
    get label() {
      return t('monument.row.read', 'Read the inscription');
    },
  }),
]);
/** The one key each answers to - the eye's box and its collider bucket are one name, so the ray from a body standing on
 *  its steps meets it at its stone (player/activate.js CASTLE1: a surface its own bucket owns). The street's press
 *  (scenes/worldModes.js) knows a monument by the key's `monument:`. */
export const LEFAY_KEY = 'monument:lefay';
export const STEWART_KEY = 'monument:stewart';

// ── THE SPOT ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Open ground the monument needs round its middle, metres: every navgrid cell whose centre is this near is open.
 *  AUDIT LEFAY1 C3: every cell beside the carve's (MONUMENT_CARVE_M) - a ring the people walk round it by. Open
 *  ground to 5.6 m from its middle at the least (B6) - past its lowest step and the flowers' ring at its foot. */
export const MONUMENT_CLEAR_M = 5.8;
/** How far from the grid's middle a spot is looked for, navgrid cells (one block's side is 64). */
export const MONUMENT_SEARCH_CELLS = 48;
/** What a road cell under it costs, in cells of distance from the middle (a cell of CityNavigation's Road family weighs
 *  ROAD_WEIGHT). */
export const MONUMENT_ROAD_COST = 0.3;
/** The navgrid closed under it for the wandering people, metres from its middle: its lowest step and the flowers at its
 *  foot (AUDIT LEFAY1 A4) - 21 cells, so the nearest a walker's centre comes is 4.5 m. */
export const MONUMENT_CARVE_M = 3.6;
/** GOTHWAY-MONUMENT: the way in kept clear - metres either side of its line, and how far in from the border. */
export const MONUMENT_WAY_M = 3.2;
export const MONUMENT_WAY_IN_M = 16;
/** GOTHWAY-NORTH's band: the rows at the north border a road crosses it through, metres. */
export const ENTRANCE_BAND_M = 8;

/** The cell offsets within `m` metres of a cell's centre, nearest first. Pure. */
export function discCells(m) {
  const r = Math.floor(m / NAV_CELL),
    out = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) if (Math.hypot(dx, dy) * NAV_CELL <= m) out.push([dx, dy]);
  return out.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
}
const CLEAR_DISC = discCells(MONUMENT_CLEAR_M);
const CARVE_DISC = discCells(MONUMENT_CARVE_M);

/**
 * WHERE IT STANDS on a navgrid: the cell nearest the grid's middle - or the `from` cell's centre, given one - with every
 * cell centred within MONUMENT_CLEAR_M of it open (weight over 0), each road cell under it MONUMENT_ROAD_COST further;
 * ties to the lower row, then the lower column. Null when no cell within MONUMENT_SEARCH_CELLS is open enough. `x`, `z`
 * the cell's centre in the location's frame (metres from its origin - navToWorld's). Pure.
 * @param {{width: number, height: number, weightAt: (gx: number, gy: number) => number}} nav
 * @param {{gx: number, gy: number}|null} [from]
 */
export function lefaySpot(nav, from = null) {
  if (!nav || !(nav.width > 0) || !(nav.height > 0)) return null;
  const mx = from ? from.gx + 0.5 : nav.width / 2,
    my = from ? from.gy + 0.5 : nav.height / 2;
  let best = null,
    bestScore = Infinity;
  const y0 = Math.max(0, Math.floor(my - MONUMENT_SEARCH_CELLS)),
    y1 = Math.min(nav.height - 1, Math.ceil(my + MONUMENT_SEARCH_CELLS));
  const x0 = Math.max(0, Math.floor(mx - MONUMENT_SEARCH_CELLS)),
    x1 = Math.min(nav.width - 1, Math.ceil(mx + MONUMENT_SEARCH_CELLS));
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const d = Math.hypot(gx + 0.5 - mx, gy + 0.5 - my);
      if (d > MONUMENT_SEARCH_CELLS || d >= bestScore) continue; // a road only adds: a cell already further cannot win
      let open = true,
        roads = 0;
      for (const [dx, dy] of CLEAR_DISC) {
        const w = nav.weightAt(gx + dx, gy + dy);
        if (!(w > 0)) {
          open = false;
          break;
        }
        if (w === ROAD_WEIGHT) roads++;
      }
      if (!open) continue;
      const score = d + roads * MONUMENT_ROAD_COST;
      if (score < bestScore) {
        bestScore = score;
        best = { gx, gy };
      }
    }
  }
  return best
    ? { gx: best.gx, gy: best.gy, x: best.gx * NAV_CELL + HALF_CELL, z: best.gy * NAV_CELL + HALF_CELL }
    : null;
}

/** Close every cell of `nav` whose centre is within `m` metres of (`x`, `z`), the location's frame. */
function closeRound(nav, x, z, m) {
  const r = Math.ceil(m / NAV_CELL) + 1,
    [cx, cy] = [Math.floor(x / NAV_CELL), Math.floor(z / NAV_CELL)];
  for (let gy = cy - r; gy <= cy + r; gy++) {
    for (let gx = cx - r; gx <= cx + r; gx++) {
      if (nav.inBounds(gx, gy) && Math.hypot(gx * NAV_CELL + HALF_CELL - x, gy * NAV_CELL + HALF_CELL - z) <= m)
        nav.grid[gy * nav.width + gx] = 0;
    }
  }
}

/**
 * GOTHWAY-NORTH's way in (2026-10-08, the owner's boards): the run of road across the north border's band - else of open
 * ground, three cells at the least - nearest the border's middle, as `{ x, z, nx, nz }` in the location's frame: the
 * run's middle on the border, facing in (south). Null when the border has no way in. North is the grid's last rows. Pure.
 * @param {{width: number, height: number, weightAt: (gx: number, gy: number) => number}} nav
 */
export function northEntrance(nav) {
  const w = nav.width,
    h = nav.height,
    band = Math.max(2, Math.round(ENTRANCE_BAND_M / NAV_CELL));
  const runs = (want, least) => {
    const out = [];
    let start = -1;
    for (let gx = 0; gx <= w; gx++) {
      let ok = false;
      if (gx < w) for (let k = 0; k < band && !ok; k++) ok = want(nav.weightAt(gx, h - 1 - k));
      if (ok && start < 0) start = gx;
      if (!ok && start >= 0) {
        if (gx - start >= least) out.push([start, gx - 1]);
        start = -1;
      }
    }
    return out;
  };
  let found = runs((wt) => wt >= ROAD_WEIGHT, 2);
  if (!found.length) found = runs((wt) => wt > 0, 3); // no paved road: the widest open way in
  if (!found.length) return null;
  const mid = (w - 1) / 2;
  found.sort((p, q) => Math.abs((p[0] + p[1]) / 2 - mid) - Math.abs((q[0] + q[1]) / 2 - mid));
  const [a, b] = found[0];
  return { x: ((a + b + 1) / 2) * NAV_CELL, z: h * NAV_CELL, nx: 0, nz: -1 };
}

/**
 * The spot in a laid-out location (world/locationLayout.js layoutLocation's `{width, height, blocks}`): its navgrid
 * carved as the wandering people's is - AUDIT LEFAY1 A3: always on the enhanced lane's water table, so every client
 * stands it in one place and never in the shallows - its way in from the north kept clear (MONUMENT_WAY_M either side,
 * MONUMENT_WAY_IN_M in), and the open ground nearest that way in; with no way in, nearest the grid's middle. Pure.
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
  const way = northEntrance(nav);
  if (!way) return lefaySpot(nav);
  for (let t = 0; t <= MONUMENT_WAY_IN_M + 1e-9; t += HALF_CELL)
    closeRound(nav, way.x + way.nx * t, way.z + way.nz * t, MONUMENT_WAY_M);
  const at = nav.worldToNav(way.x, way.z - HALF_CELL);
  return lefaySpot(nav, { gx: at[0], gy: at[1] });
}

/** STEWART-MONUMENT: where it stands, the Imperial City's metres (world/imperialCity.js: x east, z south of the tower's
 *  middle) - on the tower's plaza, 25 m out from the rotunda's wall, a little north of the palace's door (it faces
 *  east) and clear of the arrivals' marker before it (tamrielCapitals.js CAPITALS' `markers`). */
export const STEWART_AT = Object.freeze(polar(80, IMPERIAL.tower.plinthR + 25));
/** The Imperial City's centre slice - the tower's, the city's own name (world/tamrielCapitals.js capitalCentre). */
export const STEWART_SLICE = (IMPERIAL_SPAN * IMPERIAL_SPAN - 1) / 2;
/** Is `loc` the Imperial City's centre slice? */
export const isStewartSlice = (loc) => loc?.capital?.key === 'imperial-city' && loc.capital.s === STEWART_SLICE;
/** STEWART_AT in the centre slice's location frame (x east, z north from its corner), on a navgrid cell's centre. The
 *  city's middle is four blocks into the slice each way (imperialBlocks.js imperialAnchorOf). Pure. */
export function stewartSpot() {
  const mid = (IMPERIAL_CELLS / 2 - ((IMPERIAL_SPAN - 1) / 2) * 8) * BLOCK_M;
  const gx = Math.floor((mid + STEWART_AT[0]) / NAV_CELL),
    gy = Math.floor((mid - STEWART_AT[1]) / NAV_CELL);
  return { gx, gy, x: gx * NAV_CELL + HALF_CELL, z: gy * NAV_CELL + HALF_CELL };
}

/** Which monument stands in a location, and where - `{ id, gx, gy, x, z }` (MONUMENTS' id, the location's frame), or
 *  null. `loc` the location laid out (lefaySpotOf's). Pure. */
export function monumentSpotOf(dfLocation, loc) {
  if (isStewartSlice(dfLocation)) return { id: 'stewart', ...stewartSpot() };
  const s = isLefayTown(dfLocation) ? lefaySpotOf(loc) : null;
  return s && { id: 'lefay', ...s };
}

/** Close the monument's ground on a navgrid (the wandering people's): every cell within MONUMENT_CARVE_M of its
 *  middle. Answers how many cells it closed. */
export function carveLefay(nav, spot) {
  if (!nav?.grid || !spot) return 0;
  let n = 0;
  for (const [dx, dy] of CARVE_DISC) {
    const gx = spot.gx + dx,
      gy = spot.gy + dy;
    if (!nav.inBounds(gx, gy)) continue;
    const i = gy * nav.width + gx;
    if (nav.grid[i] !== 0) {
      nav.grid[i] = 0;
      n++;
    }
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
/** STEWART-MONUMENT: Patrick Stewart's plaque, its own picture beside LeFay's. */
export const STEWART_PLAQUE = 5;

/** @typedef {{ id: string, key: string, plaque: number, tribute: string, text: { title: string, subs: ReadonlyArray<string>,
 *  plaque: ReadonlyArray<string>, read: ReadonlyArray<string>, laid: string, steal: string, count: (n: number) => string } }} MonumentSubject */
/** THE MONUMENTS: each its id (a pixel's `monument` names it), its key, its words, its plaque's picture and the
 *  player's field its tribute is saved under (systems/save/save.js).
 *  @type {Readonly<{ lefay: MonumentSubject, stewart: MonumentSubject }>} */
export const MONUMENTS = Object.freeze({
  lefay: Object.freeze({
    id: 'lefay',
    key: LEFAY_KEY,
    text: LEFAY_TEXT,
    plaque: LEFAY_PLAQUE,
    tribute: 'lefayTribute',
  }),
  stewart: Object.freeze({
    id: 'stewart',
    key: STEWART_KEY,
    text: STEWART_TEXT,
    plaque: STEWART_PLAQUE,
    tribute: 'stewartTribute',
  }),
});
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
  baseHalf: 0.82,
  baseTop: 1.05,
  dieHalf: 0.7,
  dieTop: 2.45,
  corniceHalf: 0.84,
  corniceTop: 2.65,
});
/** The obelisk: half its side at its foot and its top, its top's height, and its gilt point's. */
export const OBELISK = Object.freeze({ footHalf: 0.46, topHalf: 0.28, top: 6.4, apex: 6.95 });
/** A plaque on each face of the die: its width, its height, its middle's height, and how far it stands proud. */
export const PLAQUE = Object.freeze({ w: 1.0, h: 0.8, mid: 1.75, proud: 0.03 });
/** The eye's boxes round it, one key: its steps (the lowest one's corners, to the top one's top) and its column (the
 *  cornice's square, to its gilt point) - two, so the air over its lower steps beside the column is not its own, and a
 *  door seen past it is not pressed into it. */
export const MONUMENT_BOXES = Object.freeze([
  Object.freeze([
    -MONUMENT_STEPS[0].r,
    0,
    -MONUMENT_STEPS[0].r,
    MONUMENT_STEPS[0].r,
    MONUMENT_STEPS[2].top,
    MONUMENT_STEPS[0].r,
  ]),
  Object.freeze([
    -PEDESTAL.corniceHalf,
    0,
    -PEDESTAL.corniceHalf,
    PEDESTAL.corniceHalf,
    OBELISK.apex,
    PEDESTAL.corniceHalf,
  ]),
]);

/** @param {number[]} a @param {number[]} b */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** @param {number[]} a @param {number[]} b */
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** @param {number[]} a */
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A flat-shaded face builder, by picture: each triangle's normal its own (gateModel.js faces' law). */
function faces() {
  /** @type {Map<number, {p: number[], n: number[], uv: number[]}>} */
  const byRec = new Map();
  const tri = (rec, a, b, c, ua, ub, uc) => {
    let g = byRec.get(rec);
    if (!g) byRec.set(rec, (g = { p: [], n: [], uv: [] }));
    const n = norm(cross(sub(b, a), sub(c, a)));
    for (const [v, u] of [
      [a, ua],
      [b, ub],
      [c, uc],
    ]) {
      g.p.push(v[0], v[1], v[2]);
      g.n.push(n[0], n[1], n[2]);
      g.uv.push(u[0], u[1]);
    }
  };
  /** a, b, c, d counter-clockwise seen from outside. */
  const quad = (rec, a, b, c, d, ua, ub, uc, ud) => {
    tri(rec, a, b, c, ua, ub, uc);
    tri(rec, a, c, d, ua, uc, ud);
  };
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
  const at = (k, r, y) => {
    const a = (k / sides) * Math.PI * 2 - turn;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  const edge = 2 * Math.sin(Math.PI / sides);
  const v = (y1 - y0) / STONE_TILE_M;
  for (let k = 0; k < sides; k++) {
    const b0 = at(k, r0, y0),
      b1 = at(k + 1, r0, y0),
      t1 = at(k + 1, r1, y1),
      t0 = at(k, r1, y1);
    const u0 = (r0 * edge) / STONE_TILE_M,
      u1 = (r1 * edge) / STONE_TILE_M;
    if (r1 > 0) f.quad(rec, b0, t0, t1, b1, [0, v], [(u0 - u1) / 2, 0], [(u0 + u1) / 2, 0], [u0, v]);
    else f.tri(rec, b0, t0, b1, [0, v], [u0 / 2, 0], [u0, v]); // a point: the quad's first triangle would have no area
    const uv = (p) => [0.5 + p[0] / STONE_TILE_M, 0.5 + p[2] / STONE_TILE_M];
    if (cap && r1 > 0) {
      const c = [0, y1, 0];
      f.tri(capRec, c, t1, t0, uv(c), uv(t1), uv(t0));
    }
    if (under) {
      const c = [0, y0, 0];
      f.tri(capRec, c, b0, b1, uv(c), uv(b0), uv(b1));
    } // its foot, facing down
  }
}

/** A square block about the y axis, half its side `h`, from `y0` to `y1` - its top capped, and its foot when `under`. */
const block = (f, rec, h, y0, y1, under = false) =>
  frustum(f, rec, 4, h * Math.SQRT2, h * Math.SQRT2, y0, y1, { under });

/** A plaque proud of the die's face at angle `a` (0 looks down +x, a quarter turn at a time): its face the whole
 *  engraving, its edges plain bronze. */
function plaque(f, a, rec) {
  const c = Math.cos(a),
    s = Math.sin(a);
  const { w, h, mid, proud } = PLAQUE,
    d0 = PEDESTAL.dieHalf,
    d1 = d0 + proud;
  // the face's frame: out (c, s), across (-s, c). AUDIT LEFAY1 A1: the world is DFU's, LEFT-handed, and the game draws
  // it so (world/mat4.js THE HANDEDNESS LAW: world +x lands screen-RIGHT) - so seen from outside, "across" runs to the
  // viewer's RIGHT, and the picture's left edge is at -across
  const P = (out, across, y) => [c * out - s * across, y, s * out + c * across];
  const y0 = mid - h / 2,
    y1 = mid + h / 2,
    hw = w / 2;
  // the face: its top-left (seen from outside) at the picture's top-left - v down the plaque, u across it
  f.quad(rec, P(d1, hw, y1), P(d1, hw, y0), P(d1, -hw, y0), P(d1, -hw, y1), [1, 0], [1, 1], [0, 1], [0, 0]);
  const e = [0, 0],
    g = [1, 0.1];
  f.quad(LEFAY_BRONZE, P(d0, hw, y1), P(d1, hw, y1), P(d1, -hw, y1), P(d0, -hw, y1), e, g, g, e); // its top
  f.quad(LEFAY_BRONZE, P(d0, -hw, y0), P(d1, -hw, y0), P(d1, hw, y0), P(d0, hw, y0), e, g, g, e); // its foot
  f.quad(LEFAY_BRONZE, P(d0, hw, y0), P(d1, hw, y0), P(d1, hw, y1), P(d0, hw, y1), e, g, g, e); // its two ends
  f.quad(LEFAY_BRONZE, P(d0, -hw, y1), P(d1, -hw, y1), P(d1, -hw, y0), P(d0, -hw, y0), e, g, g, e);
}

/** The faces gathered by picture into renderer.createMesh's model shape (cageModel.js assemble's). */
function assemble(f) {
  const recs = [...f.byRec.keys()].sort((a, b) => a - b);
  const count = recs.reduce((n, r) => n + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3),
    normals = new Float32Array(count * 3),
    uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(count);
  const subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec),
      n = g.p.length / 3;
    positions.set(g.p, v * 3);
    normals.set(g.n, v * 3);
    uvs.set(g.uv, v * 2);
    for (let i = 0; i < n; i++) indices[v + i] = v + i;
    subMeshes.push({ textureArchive: LEFAY_ARCHIVE, textureRecord: rec, startIndex: v, primitiveCount: n / 3 });
    v += n;
  }
  return { positions, normals, uvs, indices, subMeshes };
}

/** THE MONUMENT, in its own frame: renderer.createMesh's model shape (and the collider's - its positions and
 *  indices). `plaqueRec` its plaque's picture (MONUMENTS' `plaque`). Pure. */
export function buildLefayModel(plaqueRec = LEFAY_PLAQUE) {
  const f = faces();
  let y = -MONUMENT_FOOT;
  for (const step of MONUMENT_STEPS) {
    frustum(f, LEFAY_GRANITE, 8, step.r, step.r, y, step.top);
    y = step.top;
  }
  const P = PEDESTAL;
  block(f, LEFAY_MARBLE, P.baseHalf, y, P.baseTop);
  block(f, LEFAY_MARBLE, P.dieHalf, P.baseTop, P.dieTop);
  block(f, LEFAY_MARBLE, P.corniceHalf, P.dieTop, P.corniceTop, true); // AUDIT LEFAY1 A2: it overhangs the die - its underside seen from the ground
  const O = OBELISK;
  frustum(f, LEFAY_MARBLE, 4, O.footHalf * Math.SQRT2, O.topHalf * Math.SQRT2, P.corniceTop, O.top, { cap: false });
  frustum(f, LEFAY_GILT, 4, O.topHalf * Math.SQRT2, 0, O.top, O.apex, { cap: false });
  for (let k = 0; k < 4; k++) plaque(f, (k * Math.PI) / 2, plaqueRec);
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
 * ring's index, tenths across it), which is what a save keeps. `rand` four draws in [0, 1) - the ring, the spread,
 * the flower, the place across. Pure.
 * @param {number} bearing @param {() => number} rand
 */
export function tossRest(bearing, rand) {
  let pick = rand(),
    ring = FLOWER_RINGS.length - 1;
  for (let i = 0; i < FLOWER_RINGS.length; i++) {
    if (pick < FLOWER_RINGS[i].share) {
      ring = i;
      break;
    }
    pick -= FLOWER_RINGS[i].share;
  }
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
  const a = (deg * Math.PI) / 180,
    r = R.r0 + ((R.r1 - R.r0) * across) / 9;
  return [Math.sin(a) * r, R.y, Math.cos(a) * r];
}

/** A flight's point at `k` (0..1) from `from` to `to`, its arc TOSS_ARC over the line at its middle. Pure. */
export function tossPoint(from, to, k, out = [0, 0, 0]) {
  const t = Math.min(1, Math.max(0, k));
  const u = 1 - t; // weighted from both ends, so it leaves the hand and lands on its rest exactly
  out[0] = from[0] * u + to[0] * t;
  out[1] = from[1] * u + to[1] * t + (t > 0 && t < 1 ? Math.sin(Math.PI * t) * TOSS_ARC : 0);
  out[2] = from[2] * u + to[2] * t;
  return out;
}

/** A laid entry as a save may hold it - four whole numbers in range - or null. Pure. */
const normalEntry = (e) => {
  if (!Array.isArray(e) || e.length !== 4 || ![0, 1, 2, 3].every((i) => Number.isSafeInteger(e[i]))) return null; // AUDIT LEFAY1 A5: a hole is no number
  const [deg, kind, ring, across] = e;
  if (
    deg < 0 ||
    deg >= 360 ||
    kind < 0 ||
    kind >= LEFAY_FLOWERS.length ||
    ring < 0 ||
    ring >= FLOWER_RINGS.length ||
    across < 0 ||
    across > 9
  )
    return null;
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
  const n = normalTribute(t),
    e = normalEntry(entry);
  if (!e) return n;
  return { count: n.count + 1, laid: [...n.laid, e].slice(-MONUMENT_FLOWERS_KEPT) };
}
