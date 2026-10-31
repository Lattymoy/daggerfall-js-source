// @ts-check
// PORT-SHIPS (2026-10-27, the owner's field report, item 8: "I went to solitude and the ships at works were inside town
// walls"; bible/03-World/Holdings.md section 7, PORT-SHIPS) - WHERE A PORT'S TOWN KEEPS ITS SHIPS OUT. A harbour is found off
// the water alone (shipLife.js findHarbour: a water tile, or Deep Waters' floor, beside land), and the water says nothing
// of what the town stands on it. Solitude's walls were drawn round its blocks clear of every house (AUDIT-TESA A6-3), and
// so 7 m out into the Karth on the west: its six berths were the river's shore at the terrace, each ship's hull through
// the west wall and her quay inside it, two of them under the arch. Alinor's river runs through the middle of its city, and
// its six ships lay in it; Torval's two and the Waterfront's one lay through a pier. A town past the Bay walled on its
// outline (TOWN-SHAPES TS4) and a Bay city walled the same way (TS7) stand their wall where the shore may be too.
//
// THE KEEP (`harbourKeep(loc, rect)`): `(x, z) => boolean` in the scene's frame of the town's footprint `rect` (metres, x
// east, z north - navalHarbourNear's), true where no ship of the harbour may lie, nor her quay, nor her jetty's way - or
// null for a town that keeps none (a town with no wall of its own; the Bay's ports, but its walled cities). A berth is
// kept only where all of hers is clear of it (shipLife.js berthKept).
//   - A CAPITAL (CAPITAL_KEEPS, by its key - the anchor's metres, x east, z south, as its measures are): the ground inside
//     its walls and their band (CAPITAL_WALLS: a side the sea faces open, its two end towers kept), and every landmark it
//     stands over the water - Solitude's two piers, its sea stack, its arch and its rock (SOLITUDE-RELIEF: onSolitudeRock);
//     Alinor's and Torval's four piers each; the Imperial City's walled city, the Waterfront's piers, its bridge and causeways.
//   - A WALLED TOWN (townWalls.js townWallOf - the wall registered this session): inside its wall's line, or within
//     TOWN_WALL_KEEP of it (its length's half thickness and a bend tower's half diagonal), on a raster of TOWN_KEEP_CELL
//     made once a wall.
// Pure. Not a DFU member: DFU has no ships (Come Sail Away's and the port's own). Ledger A (QUAYS).
import { SOLITUDE, CAPITALS, capitalDims, capitalCentre, BLOCK_M } from '../../world/tamrielCapitals.js';
import { onSolitudeRock } from '../../world/solitudeRelief.js';
import { ALINOR, TORVAL } from '../../world/capitalPlans.js';
import { IMPERIAL, imperialBearing, bridgeLine, causewayLines } from '../../world/imperialCity.js';
import { townWallOf } from '../../world/townWalls.js';

/** What a keep stands off its measures, every way (m) - a ship's fender's room. */
export const KEEP_SPARE = 1;
/** A walled town's wall kept this far either side of its line (m): a length's half thickness (445's 9.6 m) and a bend
 *  tower's half diagonal (9.6 m square), and KEEP_SPARE. */
export const TOWN_WALL_KEEP = 4.8 * Math.SQRT2 + KEEP_SPARE;
/** A walled town's keep raster: its cell (m, the town map's) and its margin past the grid (m) - the wall's line stands at
 *  most WALL_ROUND.line + .close tiles and two out from a building at a grid's edge (townWalls.js townWall's PAD). */
export const TOWN_KEEP_CELL = 1.6;
export const TOWN_KEEP_MARGIN = 2 * BLOCK_M;

/**
 * A capital's walls as a keep reads them - the anchor's metres of their lines (`x0` west, `x1` east, `z0` north, `z1`
 * south), the band each side of a line (its thickness or its towers' half, whichever stands wider), and the side the sea
 * faces open (`open`: Alinor's and Torval's three landward walls - their quays south; Solitude's four) - its two end
 * towers kept as discs of the band.
 * @param {{ west: number, east: number, north: number, south: number, thick: number }} W @param {number} tower a tower's
 *   half extent (m) @param {?'S'} open
 */
const wallsOf = (W, tower, open) =>
  Object.freeze({
    x0: W.west,
    x1: W.east,
    z0: W.north,
    z1: W.south,
    band: Math.max(W.thick / 2, tower) + KEEP_SPARE,
    open,
  });
export const CAPITAL_WALLS = Object.freeze({
  solitude: wallsOf(SOLITUDE.wall, SOLITUDE.wall.tower / 2, null), // square towers, its side the half
  alinor: wallsOf(ALINOR.wall, ALINOR.wall.tower + 0.6, 'S'), // round towers, its radius and its ledge (capitalShapes.js roundTower)
  torval: wallsOf(TORVAL.wall, TORVAL.wall.tower / 2, 'S'),
});
/** Inside a capital's walls, or on them (CAPITAL_WALLS'). @param {any} K @param {number} dx @param {number} dz */
export function inCapitalWalls(K, dx, dz) {
  const b = K.band;
  if (dx < K.x0 - b || dx > K.x1 + b || dz < K.z0 - b) return false;
  if (dz <= (K.open === 'S' ? K.z1 : K.z1 + b)) return true;
  return K.open === 'S' && (Math.hypot(dx - K.x0, dz - K.z1) <= b || Math.hypot(dx - K.x1, dz - K.z1) <= b);
}
/** A capital's straight piers on its quay's edge (`edge`, out to `pierTo` either way), each `pierW` wide at its `piers`. */
const onPier = (Q, dx, dz) =>
  dz >= Math.min(Q.edge, Q.pierTo) - KEEP_SPARE &&
  dz <= Math.max(Q.edge, Q.pierTo) + KEEP_SPARE &&
  Q.piers.some((p) => Math.abs(dx - p) <= Q.pierW / 2 + KEEP_SPARE);
/** A point's distance from a segment. */
/** @param {number} x @param {number} z @param {number[]} a @param {number[]} b */
const segDistance = (x, z, a, b) => {
  const ax = a[0],
    az = a[1],
    ux = b[0] - ax,
    uz = b[1] - az,
    l = ux * ux + uz * uz,
    t = l > 0 ? Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / l)) : 0;
  return Math.hypot(x - ax - ux * t, z - az - uz * t);
};
const SOLITUDE_DOCKS = Object.freeze({
  edge: SOLITUDE.docks.edge,
  pierTo: SOLITUDE.docks.pierTo,
  pierW: SOLITUDE.docks.pierW,
  piers: SOLITUDE.docks.piers,
});
/** The arch's foot each side of its middle and the stack's at the water (capitalSolitude.js buildSolitudeArch: the body's
 *  widest section at the water, its jitter and its feet's flare; the column's rings there and the boulders round it). */
export const ARCH_FOOT = SOLITUDE.arch.w / 2 + 16,
  STACK_FOOT = SOLITUDE.stack.foot + 19;
/** The Imperial City's ways over the lake: Talos Bridge and the causeways, their half width. */
const IC_WAYS = Object.freeze([...causewayLines(), bridgeLine()]);
const IC_WAY_HALF = Math.max(IMPERIAL.bridge.w, IMPERIAL.causeway) / 2 + KEEP_SPARE;

/** Each harbour capital's keep, the anchor's metres (x east, z south). */
export const CAPITAL_KEEPS = Object.freeze({
  solitude: (dx, dz) => {
    const A = SOLITUDE.arch,
      st = SOLITUDE.stack;
    if (onSolitudeRock(dx, dz)) return true; // SOLITUDE-RELIEF: its rock - its cliffs' feet no quay
    return (
      inCapitalWalls(CAPITAL_WALLS.solitude, dx, dz) ||
      onPier(SOLITUDE_DOCKS, dx, dz) ||
      Math.hypot(dx - st.x, dz - st.z) <= STACK_FOOT + KEEP_SPARE ||
      (dx >= st.x && dx <= A.to + KEEP_SPARE && Math.abs(dz) <= ARCH_FOOT + KEEP_SPARE)
    );
  },
  alinor: (dx, dz) => inCapitalWalls(CAPITAL_WALLS.alinor, dx, dz) || onPier(ALINOR.quay, dx, dz),
  torval: (dx, dz) => inCapitalWalls(CAPITAL_WALLS.torval, dx, dz) || onPier(TORVAL.quay, dx, dz),
  'imperial-city': (dx, dz) => {
    const C = IMPERIAL.cityWall,
      Wf = IMPERIAL.waterfront,
      r = Math.hypot(dx, dz);
    if (r <= C.r + C.towerR + KEEP_SPARE) return true; // the walled city
    if (r >= Wf.r1 - KEEP_SPARE && r <= Wf.pierTo + KEEP_SPARE) {
      // the Waterfront's piers, each on its bearing
      const b = imperialBearing(dx, dz);
      if (
        Wf.piers.some((p) => Math.abs(((b - p + 540) % 360) - 180) * (Math.PI / 180) * r <= Wf.pierW / 2 + KEEP_SPARE)
      )
        return true;
    }
    return IC_WAYS.some(([a, c]) => segDistance(dx, dz, a, c) <= IC_WAY_HALF);
  },
});

/** A capital's keep in the scene: its slice's anchor off its footprint (its plan's row 0 the north). */
function capitalKeep(loc, rect) {
  const law = CAPITAL_KEEPS[loc.capital.key];
  const cap = CAPITALS[loc.capital.k];
  if (!law || !cap) return null;
  const D = capitalDims(cap),
    s = loc.capital.s ?? capitalCentre(cap),
    sx = s % D.w,
    sy = Math.floor(s / D.w);
  const ax = rect.minX + (cap.anchor[0] - sx * 8) * BLOCK_M,
    az = rect.maxZ - (cap.anchor[1] - sy * 8) * BLOCK_M;
  return (x, z) => law(x - ax, az - z);
}

/** A walled town's keep raster (its wall's line, the town's metres from its grid's south-west corner, z north): inside the
 *  line or within TOWN_WALL_KEEP of it. Made once a wall. */
const _townFields = new WeakMap();
export function townKeepField(wall, w, h) {
  const kept = _townFields.get(wall);
  if (kept) return kept;
  const C = TOWN_KEEP_CELL,
    M = TOWN_KEEP_MARGIN,
    W = Math.ceil((w * BLOCK_M + 2 * M) / C),
    H = Math.ceil((h * BLOCK_M + 2 * M) / C);
  const cells = new Uint8Array(W * H),
    line = wall.line;
  for (let j = 0; j < H; j++) {
    // inside: each row's crossings of the line, filled between pairs
    const z = -M + (j + 0.5) * C,
      xs = [];
    for (let i = 0, k = line.length - 1; i < line.length; k = i++) {
      const [x1, z1] = line[k],
        [x2, z2] = line[i];
      if (z1 > z !== z2 > z) xs.push(x1 + ((z - z1) * (x2 - x1)) / (z2 - z1));
    }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) {
      const i0 = Math.max(0, Math.ceil((xs[q] + M) / C - 0.5)),
        i1 = Math.min(W - 1, Math.floor((xs[q + 1] + M) / C - 0.5));
      for (let i = i0; i <= i1; i++) cells[j * W + i] = 1;
    }
  }
  const r = Math.ceil(TOWN_WALL_KEEP / C) + 1;
  for (let i = 0, k = line.length - 1; i < line.length; k = i++) {
    // the wall: its band either side of the line
    const a = line[k],
      b = line[i];
    const gx0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) + M) / C) - r),
      gx1 = Math.min(W - 1, Math.floor((Math.max(a[0], b[0]) + M) / C) + r);
    const gz0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) + M) / C) - r),
      gz1 = Math.min(H - 1, Math.floor((Math.max(a[1], b[1]) + M) / C) + r);
    for (let gz = gz0; gz <= gz1; gz++)
      for (let gx = gx0; gx <= gx1; gx++) {
        if (!cells[gz * W + gx] && segDistance(-M + (gx + 0.5) * C, -M + (gz + 0.5) * C, a, b) <= TOWN_WALL_KEEP)
          cells[gz * W + gx] = 1;
      }
  }
  const field = Object.freeze({ cells, W, H });
  _townFields.set(wall, field);
  return field;
}
/** A walled town's keep in the scene: its raster off its footprint's south-west corner. */
function townKeep(wall, loc, rect) {
  const ed = loc.exterior.exteriorData,
    C = TOWN_KEEP_CELL,
    M = TOWN_KEEP_MARGIN;
  let f = null; // made when first asked - the host hands a keep every frame, the book asks one at a sounding
  return (x, z) => {
    f ??= townKeepField(wall, ed.width, ed.height);
    const i = Math.floor((x - rect.minX + M) / C),
      j = Math.floor((z - rect.minZ + M) / C);
    return i >= 0 && j >= 0 && i < f.W && j < f.H && f.cells[j * f.W + i] === 1;
  };
}

/**
 * THE KEEP OF A PORT'S TOWN (the header's): `(x, z) => boolean` over its footprint `rect` in the scene (metres, z north),
 * or null where its town keeps none.
 * @param {any} loc the port's location (navalHarbourNear's town) @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} rect
 * @returns {((x: number, z: number) => boolean) | null}
 */
export function harbourKeep(loc, rect) {
  if (!loc || !rect) return null;
  if (loc.capital) return capitalKeep(loc, rect);
  const wall = loc.outline?.walled ? townWallOf(loc) : null;
  return wall?.line?.length >= 3 && loc.exterior?.exteriorData ? townKeep(wall, loc, rect) : null;
}
