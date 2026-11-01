// @ts-check
// TESA-LANDS (bible/03-World/Tamriel-Lands.md, "The landmarks"): THE LANDMARKS' LAW - where the land's own features past
// the Bay stand and what each is. A zone names its kinds and looks (LAND_LOOKS), each a rate, a where (woods, plains, any,
// the water's edge) and maybe a patch; a site is a cell of its kind's size on the WORLD's lattice, every draw a hash of its
// world tile, so every client and the worker lay the same. Its foot stands wholly on land a landmark may, at the lowest
// ground about it; the larger stand first. Pure and the terrain worker's (world/ alone).
import { LAND_KINDS, LAND_VARIANTS, VINE_SPAN, landPropMesh } from './landPropMesh.js';

/** A landmark's floats, in a set: x, y, z (pixel-local m), yaw (radians), scale, kind (LAND_KINDS' index), variant, look
 *  (LAND_LOOK_NAMES' index). */
export const LAND_PROP_FLOATS = 8;

/**
 * EACH KIND'S LAW: its site's cell (tiles) and where in it a site stands (a share each way), its LODs' reaches (m over
 * its scale: LOD 0 nearer than [0], 1 nearer than [1], 2 past) and the farthest it is drawn (m), its steepest ground
 * (degrees), how far its foot sinks (m), whether it has a BODY, the share of the wind's lean its draw takes, and its
 * draw order (`rank` - the larger first; a smaller one keeps off it).
 */
export const LAND_KIND_LAW = Object.freeze({
  hist: Object.freeze({
    cell: 16,
    inset: Object.freeze([0.3, 0.7]),
    lod: Object.freeze([240, 760]),
    far: 2600,
    steep: 26,
    sink: 1.2,
    body: true,
    sway: 0.04,
    rank: 0,
  }),
  spire: Object.freeze({
    cell: 8,
    inset: Object.freeze([0.25, 0.75]),
    lod: Object.freeze([150, 480]),
    far: 2200,
    steep: 40,
    sink: 0.6,
    body: true,
    sway: 0,
    rank: 1,
  }),
  parasol: Object.freeze({
    cell: 4,
    inset: Object.freeze([0.2, 0.8]),
    lod: Object.freeze([100, 300]),
    far: 1500,
    steep: 30,
    sink: 0.3,
    body: true,
    sway: 0.03,
    rank: 2,
  }),
  grove: Object.freeze({
    cell: 2,
    inset: Object.freeze([0.25, 0.75]),
    lod: Object.freeze([70, 220]),
    far: 1200,
    steep: 32,
    sink: 0.3,
    body: true,
    sway: 0.14,
    rank: 3,
  }),
  vines: Object.freeze({
    cell: 1,
    inset: Object.freeze([0.5, 0.5]),
    lod: Object.freeze([40, 130]),
    far: 420,
    steep: 6,
    sink: 0.1,
    body: false,
    sway: 0.06,
    rank: 4,
  }), // steep: the second audit's - a row's fall over its half (3.2 m) within its posts' 0.4 m
  reeds: Object.freeze({
    cell: 1,
    inset: Object.freeze([0.15, 0.85]),
    lod: Object.freeze([30, 90]),
    far: 260,
    steep: 20,
    sink: 0.1,
    body: false,
    sway: 0.35,
    rank: 5,
  }),
});
/** The vines' block (tiles): a vineyard drawn whole, its rows two a tile. */
export const VINE_BLOCK = 8;
/** A patch's block (tiles): a kind with a `patch` stands only in the blocks it draws. */
export const PATCH_BLOCK = 16;
/** The flats keep off a foot by this past its body (m, at its scale). */
export const FLAT_CLEAR = 1.5;
/** The draws' salts (terrainNature.js tileDraw) - a band of their own, past GRAHT1's 70. */
export const LAND_SALT = 90;

const look = (kind, variants, scale, body, crown, detail = null) =>
  Object.freeze({ kind, variants: Object.freeze(variants), scale: Object.freeze(scale), body, crown, detail });
/**
 * THE LOOKS, by name - a kind's variants (each equally drawn), its scale's range, and its submeshes' colours (hex, as the
 * colour stands in the game's own pictures: render/landPropArt.js paints the grain grey and the colour is laid over its
 * mean; null a picture in its own colours). Read off the page's sources (UESP's Lore, Morrowind, Skyrim and Online pages).
 */
export const LAND_LOOKS = Object.freeze({
  // the parasols - Morrowind's giant fungi
  ascadian: look('parasol', [0, 0, 1], [0.85, 1.2], '#c9b89a', '#6e6040', '#d8c8a4'), // the emperor parasol: a pale stalk, an olive-brown cap
  deshaan: look('parasol', [0, 1], [0.8, 1.1], '#8f8a9c', '#5e4a7c', '#f0902a'), // Deshaan's dragon-scale caps over gills aglow
  glowstalk: look('parasol', [2], [0.8, 1.3], '#7a7466', '#f0902a', '#f0902a'), // its glowstalk, tree-sized, glowing orange
  telvanni: look('parasol', [2, 2, 0], [0.9, 1.4], '#9a8468', '#8a5c96', '#c8a8d0'), // the Telvanni's grown purple pods
  xylaria: look('parasol', [3], [0.8, 1.3], '#5c534c', '#231d1c'), // the Ashlands' dark-tipped spikes
  // the spires - stone standing out of the land (its crown the faces that look up: a snowcap, a lichened or grassy top)
  frost: look('spire', [2, 0], [0.8, 1.3], '#7d838a', '#e6ecf0'),
  lichen: look('spire', [2, 3], [0.7, 1.1], '#7d7f78', '#a6a68a'),
  reachstone: look('spire', [0, 2, 3], [0.9, 1.4], '#8a7a68', '#9a8a74'),
  granite: look('spire', [2, 0], [0.9, 1.4], '#7c7e82', '#8e9094'),
  striated: look('spire', [1, 2], [0.8, 1.2], '#a46e4c', '#b8865e'),
  flint: look('spire', [2, 3], [0.8, 1.2], '#5f6266', '#767a64'),
  redstone: look('spire', [1, 0], [0.9, 1.4], '#a4583a', '#b8704a'),
  limestone: look('spire', [0, 1, 2], [0.9, 1.4], '#bab2a2', '#cfc8b8'),
  honey: look('spire', [2, 1], [0.8, 1.2], '#b47c4e', '#c4925e'),
  sandstone: look('spire', [1, 0, 2], [0.9, 1.5], '#c07a48', '#cc8c58'),
  mound: look('spire', [4], [0.8, 1.3], '#9c5e3c', '#a86c48'),
  karst: look('spire', [0, 2], [0.8, 1.2], '#9a9890', '#6e7a4e'),
  basalt: look('spire', [0, 2], [0.9, 1.4], '#2e2a28', '#3a3532'), // read under the noon sun as the flats' black stacks are
  scoria: look('spire', [2, 0], [0.9, 1.3], '#5a3a30', '#3a2c28'),
  menhir: look('spire', [3], [0.9, 1.3], '#6f7068', '#6a7a52'),
  // the Hist
  hist: look('hist', [0, 1, 2], [0.85, 1.15], '#5a4c3e', '#3f5a2c', '#6e7a4c'),
  // the reeds (their blades' and heads' colours their picture's own)
  reed: look('reeds', [0, 0, 2], [0.85, 1.2], '#8a9a5a', '#6a7a40'),
  cane: look('reeds', [1], [0.9, 1.2], '#9aa860', '#6a7a40'),
  // the vines (its grapes' and leaves' colours their picture's own) - at scale 1, so a row meets the next
  vine: look('vines', [0, 1], [1, 1], '#6e5840', '#4e6a30'),
  // the groves - their crowns' colours the season the lore paints them in
  cherry: look('grove', [0], [0.85, 1.15], '#5c3a30', '#e2a6bc', '#eab4c8'),
  ginkgo: look('grove', [1], [0.85, 1.15], '#6a6050', '#d4b23c', '#dcbc48'),
  maple: look('grove', [2], [0.85, 1.15], '#5a4a40', '#a8382a', '#b84434'),
  aspen: look('grove', [1], [0.8, 1.1], '#d4d0c4', '#d8a834', '#e0b440'),
  ember: look('grove', [0, 2], [0.7, 1.0], '#4a3a30', '#d0702c', '#dc7c34'), // Stonefalls' orange thorny cherry
  jester: look('grove', [0, 2], [0.7, 1.0], '#4a3a30', '#8a4a9a', '#9a58a8'), // ...and its purple
});
/** The looks' names, in their index order (a landmark's float). */
export const LAND_LOOK_NAMES = Object.freeze(Object.keys(LAND_LOOKS));
const LOOK_INDEX = new Map(LAND_LOOK_NAMES.map((n, i) => [n, i]));

/** A kind's variant's MEASURES at scale 1 - `top`, `reach`, `stalk` (its LOD 0's: landPropMesh); `foot`, the reach of
 *  what stands on the ground - a bodied kind's read off its mesh to LAND_CHEST (landPropMesh's `foot`: a crag's satellite
 *  lumps, a grove of three's outer stalks, the Hist's roots), the reeds' and the vines' their stalk's and their tile's;
 *  `sink`, how far round its middle the lowest ground is sought (its stalk's; the Hist's its roots - as it stood, so no
 *  landmark stands deeper than it did); and `parts`, its solid ones (landPropBodies). Made once a variant, on the thread
 *  that asks. TESA-LANDS' second audit (lane D): the foot and the body had been one stalk's or one lump's - a crag's 5.2 m
 *  of its 9.2, a grove of three's 1.07 of its 3.8: its satellites stood on roads and water, flats grew out of them, and
 *  the player walked metres into the rock. */
const _measures = new Map();
export function landMeasures(kind, variant) {
  const key = `${kind}:${variant}`;
  let m = _measures.get(key);
  if (!m) {
    const made = landPropMesh(kind, variant, 0);
    const sink = kind === 'hist' ? HIST_ROOTS : kind === 'vines' ? 0.6 : Math.max(0.5, made.stalk);
    const bodied = /** @type {any} */ (LAND_KIND_LAW)[kind].body;
    m = Object.freeze({
      top: made.top,
      reach: made.reach,
      stalk: made.stalk,
      foot: bodied ? Math.max(0.5, made.foot) : sink,
      sink,
      parts: bodied ? made.parts : Object.freeze([]),
    });
    _measures.set(key, m);
  }
  return m;
}
/** The Hist's roots' reach (m, at scale 1 - landPropMesh's root flares, 6 to 9 m out): its sink's (its foot is read off
 *  its mesh). */
export const HIST_ROOTS = 9;

/** A landmark's LOD at `d` metres from the eye over its scale. */
export const landLodOf = (kind, d) => {
  const l = /** @type {any} */ (LAND_KIND_LAW)[kind].lod;
  return d < l[0] ? 0 : d < l[1] ? 1 : 2;
};

/** The tile records a foot may stand on: DFU's dirt, grass and stone and the edges between them (never water, paving or a
 *  track's) - terrainTiles.js createLookupTable's land rings. */
export const LAND_FOOT_RECORDS = Object.freeze([1, 2, 3, 10, 11, 12, 15, 16, 17, 51, 53]);
/** ...and the records with water in them (the reeds' `wet`: a tile at the water's edge). */
export const WATER_RECORDS = Object.freeze([0, 5, 6, 7, 48]);
const FOOT_OK = new Uint8Array(64),
  WET = new Uint8Array(64);
for (const r of LAND_FOOT_RECORDS) FOOT_OK[r] = 1;
for (const r of WATER_RECORDS) WET[r] = 1;

/**
 * A PIXEL'S LANDMARKS - LAND_PROP_FLOATS each, pixel-local, on its world tiles from (ox, oz): each tile's owner's props,
 * woods, record, clearing, slope and beach asked; `named` the kinds any owner names (the rest are not walked).
 * @param {{ ox: number, oz: number, tiles: number, tileM: number, owners: (ti: number) => any[]|null, wood: (x: number, y: number, ti: number) => number,
 *   tile: (ti: number) => number, clear: (ti: number) => boolean, steep: (ti: number) => number, beach: (ti: number) => boolean,
 *   ground: (x: number, z: number) => number, draw: (wx: number, wz: number, salt: number) => number, named?: ReadonlySet<string> | null }} a
 * @returns {Float32Array}
 */
export function landSites({
  ox,
  oz,
  tiles,
  tileM,
  owners,
  wood,
  tile,
  clear,
  steep,
  beach,
  ground,
  draw,
  named = null,
}) {
  const out = [],
    feet = []; // feet: [x, z, r] of every landmark stood (m), the smaller keep off them
  const kinds = LAND_KINDS.filter((k) => !named || named.has(k)).sort(
    (a, b) => /** @type {any} */ (LAND_KIND_LAW)[a].rank - /** @type {any} */ (LAND_KIND_LAW)[b].rank,
  );
  const wetAt = (tx, tz) => {
    for (let y = Math.max(0, tz - 1); y <= Math.min(tiles - 1, tz + 1); y++)
      for (let x = Math.max(0, tx - 1); x <= Math.min(tiles - 1, tx + 1); x++)
        if (WET[tile(y * tiles + x) & 0x3f]) return true;
    return false;
  };
  /** whether the foot of radius r about (mx, mz) stands wholly on land a landmark may (a reed's own tile alone) */
  const footOk = (mx, mz, r, wet) => {
    const reach = r + tileM * 0.5,
      rt = Math.ceil(reach / tileM),
      cx = Math.floor(mx / tileM),
      cz = Math.floor(mz / tileM);
    for (let y = Math.max(0, cz - rt); y <= Math.min(tiles - 1, cz + rt); y++) {
      for (let x = Math.max(0, cx - rt); x <= Math.min(tiles - 1, cx + rt); x++) {
        const dx = (x + 0.5) * tileM - mx,
          dz = (y + 0.5) * tileM - mz;
        if (dx * dx + dz * dz > reach * reach && !(x === cx && y === cz)) continue;
        const ti = y * tiles + x,
          rec = tile(ti) & 0x3f;
        if (clear(ti) || !(FOOT_OK[rec] || (wet && WET[rec] && rec !== 0))) return false;
      }
    }
    return true;
  };
  /** the lowest ground under the foot (its middle and four points round it) */
  const lowest = (mx, mz, r) => {
    let lo = ground(mx, mz);
    if (r > 0.5)
      for (let k = 0; k < 4; k++)
        lo = Math.min(lo, ground(mx + Math.cos(k * 1.5708) * r, mz + Math.sin(k * 1.5708) * r));
    return lo;
  };
  const kept = (mx, mz, r) => {
    for (let i = 0; i < feet.length; i += 3) {
      const dx = feet[i] - mx,
        dz = feet[i + 1] - mz,
        rr = feet[i + 2] + r;
      if (dx * dx + dz * dz < rr * rr) return false;
    }
    return true;
  };
  for (const kind of kinds) {
    const law = /** @type {any} */ (LAND_KIND_LAW)[kind],
      K = LAND_KINDS.indexOf(kind),
      S = LAND_SALT + K * 8;
    const C = law.cell,
      cells = tiles / C,
      [in0, in1] = law.inset;
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const wx = ox + cx * C,
          wz = oz + cy * C;
        const tx = cx * C + C * (in0 + (in1 - in0) * draw(wx, wz, S)),
          tz = cy * C + C * (in0 + (in1 - in0) * draw(wx, wz, S + 1));
        const ix = Math.min(tiles - 1, Math.floor(tx)),
          iz = Math.min(tiles - 1, Math.floor(tz)),
          ti = iz * tiles + ix;
        const prop = owners(ti)?.find((p) => p.kind === kind);
        if (!prop) continue;
        if (prop.patch != null) {
          const bx = Math.floor(ix / PATCH_BLOCK) * PATCH_BLOCK,
            bz = Math.floor(iz / PATCH_BLOCK) * PATCH_BLOCK;
          if (draw(ox + bx, oz + bz, S + 6) >= prop.patch) continue; // its block's dice: a stand, or none
        }
        if (kind === 'vines') {
          // a vineyard's block, drawn whole by its corner's dice; its tile's rows where they may stand
          const bx = Math.floor(ix / VINE_BLOCK) * VINE_BLOCK,
            bz = Math.floor(iz / VINE_BLOCK) * VINE_BLOCK;
          const bc = (bz + VINE_BLOCK / 2) * tiles + bx + VINE_BLOCK / 2;
          if (draw(ox + bx, oz + bz, S + 2) >= prop.rate * (1 - wood(bx + VINE_BLOCK / 2, bz + VINE_BLOCK / 2, bc)))
            continue;
        } else {
          const u = draw(wx, wz, S + 2);
          if (u >= prop.rate) continue; // past its rate whatever its share - the share asked only of a site it may stand
          const w = prop.where === 'woods' || prop.where === 'plains' ? wood(ix, iz, ti) : 0;
          const share =
            prop.where === 'woods'
              ? w
              : prop.where === 'plains'
                ? 1 - w
                : prop.where === 'wet'
                  ? wetAt(ix, iz)
                    ? 1
                    : 0
                  : 1;
          if (u >= prop.rate * share) continue;
        }
        if (steep(ti) > law.steep || (beach(ti) && kind !== 'reeds')) continue;
        const looks = prop.looks,
          name = looks[Math.min(looks.length - 1, Math.floor(draw(wx, wz, S + 3) * looks.length))],
          lk = /** @type {any} */ (LAND_LOOKS)[name];
        if (!lk || lk.kind !== kind) continue;
        const variant =
          lk.variants[Math.min(lk.variants.length - 1, Math.floor(draw(wx, wz, S + 4) * lk.variants.length))];
        if (!(variant < /** @type {any} */ (LAND_VARIANTS)[kind])) continue;
        const scale = lk.scale[0] + (lk.scale[1] - lk.scale[0]) * draw(wx, wz, S + 5);
        const m = landMeasures(kind, variant),
          foot = m.foot * scale,
          sinkR = m.sink * scale;
        if (kind === 'vines') {
          // two rows across the tile, along x; their foot the tile's own. TESA-LANDS' second audit (lane D): a row its whole
          // length - off every foot along it (its middle's 1.6 m had been asked: a row ran through a grove's trunk at its
          // ends), and at the lowest of its middle and its two ends (a rigid 6.4 m stood at its middle's ground on a 14°
          // slope had floated its downhill end); its slope's limit the law's
          if (!footOk((ix + 0.5) * tileM, (iz + 0.5) * tileM, 0, false)) continue;
          const half = VINE_SPAN / 2;
          for (const f of [0.25, 0.75]) {
            const mx = (ix + 0.5) * tileM,
              mz = (iz + f) * tileM;
            if (!kept(mx - half / 2, mz, half / 2) || !kept(mx, mz, half / 2) || !kept(mx + half / 2, mz, half / 2))
              continue;
            out.push(
              mx,
              Math.min(lowest(mx, mz, 0), ground(mx - half, mz), ground(mx + half, mz)) - law.sink,
              mz,
              0,
              1,
              K,
              variant,
              LOOK_INDEX.get(name) ?? 0,
            );
          }
          continue;
        }
        const mx = tx * tileM,
          mz = tz * tileM;
        if (!footOk(mx, mz, foot, kind === 'reeds') || !kept(mx, mz, foot)) continue;
        out.push(
          mx,
          lowest(mx, mz, sinkR) - law.sink * scale,
          mz,
          draw(wx, wz, S + 7) * Math.PI * 2,
          scale,
          K,
          variant,
          LOOK_INDEX.get(name) ?? 0,
        );
        if (law.body) feet.push(mx, mz, foot);
      }
    }
  }
  return Float32Array.from(out);
}

/**
 * THE LANDMARKS' FEET, A TEST: whether pixel-local (x, z) stands within a bodied landmark's foot and FLAT_CLEAR (a
 * parasol's stalk, a spire's column, a Hist's roots, a grove's trunk) or in a vineyard's tile - null for a set that has
 * neither. Its feet are kept in a grid of cells as wide as its widest, so a flat asks the nine about it (AUDIT: every
 * flat against every foot, the pixel build's own now - a Deshaan pixel's thousands of flats and hundreds of parasols).
 * @param {ArrayLike<number>|null|undefined} props a set's floats @param {number} tileM a tile's metres
 * @returns {((x: number, z: number) => boolean) | null}
 */
export function landFeetOff(props, tileM) {
  if (!props?.length) return null;
  const vines = new Set(),
    feet = [];
  let reach = 0;
  const at = (v, w) => (Math.floor(v / w) + 1024) * 2048;
  for (let i = 0; i < props.length; i += LAND_PROP_FLOATS) {
    const kind = LAND_KINDS[props[i + 5]];
    if (kind === 'vines') {
      vines.add(at(props[i], tileM) + Math.floor(props[i + 2] / tileM) + 1024);
      continue;
    }
    if (!(/** @type {any} */ (LAND_KIND_LAW)[kind].body)) continue;
    const r = (landMeasures(kind, props[i + 6]).foot + FLAT_CLEAR) * props[i + 4];
    feet.push(props[i], props[i + 2], r);
    reach = Math.max(reach, r);
  }
  if (!feet.length && !vines.size) return null;
  const C = Math.max(tileM, reach),
    cells = new Map();
  for (let i = 0; i < feet.length; i += 3) {
    const k = at(feet[i], C) + Math.floor(feet[i + 1] / C) + 1024;
    let a = cells.get(k);
    if (!a) cells.set(k, (a = []));
    a.push(feet[i], feet[i + 1], feet[i + 2]);
  }
  return (x, z) => {
    if (vines.size && vines.has(at(x, tileM) + Math.floor(z / tileM) + 1024)) return true;
    const cx = Math.floor(x / C),
      cz = Math.floor(z / C);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const a = cells.get((cx + dx + 1024) * 2048 + cz + dz + 1024);
        if (a)
          for (let i = 0; i < a.length; i += 3) {
            const ex = x - a[i],
              ez = z - a[i + 1];
            if (ex * ex + ez * ez < a[i + 2] * a[i + 2]) return true;
          }
      }
    }
    return false;
  };
}

/**
 * THE FLATS KEPT OFF THE FEET: the pixel's flats (`flats`, pixel-local - taken out IN PLACE, the rest in their order) less
 * any landFeetOff stands on a landmark. Its value the same array.
 * @template {{x: number, z: number}} F
 * @param {F[]} flats @param {ArrayLike<number>|null|undefined} props @param {number} tileM
 */
export function flatsOffProps(flats, props, tileM) {
  const off = flats.length ? landFeetOff(props, tileM) : null;
  if (!off) return flats;
  let n = 0;
  for (let i = 0; i < flats.length; i++) if (!off(flats[i].x, flats[i].z)) flats[n++] = flats[i];
  flats.length = n;
  return flats;
}

/**
 * A LANDMARK'S BODIES (world/propBodies.js's shape: `{ c, r, h, lift, body, nature, _mark }`, its foot `c` pixel-local): each solid
 * part one (landMeasures' `parts` - a stalk, a column, a lump of rock, a trunk: a crag's three lumps, a grove of three's
 * stalks, the xylaria's cluster), turned by its yaw as the draw turns its mesh (x' = c x + s z, z' = -s x + c z) - none
 * for the reeds and the vines (LAND_KIND_LAW.body).
 * @param {ArrayLike<number>} props a set's floats @param {number} i the landmark's first
 */
export function landPropBodies(props, i) {
  const kind = LAND_KINDS[props[i + 5]];
  if (!(/** @type {any} */ (LAND_KIND_LAW)[kind])) return [];
  const m = landMeasures(kind, props[i + 6]),
    s = props[i + 4],
    c = Math.cos(props[i + 3]),
    sn = Math.sin(props[i + 3]); // an unbodied kind's parts none (landMeasures)
  return m.parts.map((q) => ({
    c: [props[i] + (c * q.x + sn * q.z) * s, props[i + 1], props[i + 2] + (-sn * q.x + c * q.z) * s],
    r: Math.max(0.3, q.r) * s,
    h: q.h * s,
    lift: 0,
    body: true,
    nature: true,
    _mark: 0,
  }));
}

/**
 * A PIXEL'S LANDMARKS STOOD - `raw` the worker's (LAND_PROP_FLOATS a landmark, pixel-local), each kept whole or not at all
 * where `keep(x, z)` keeps its foot (the gate's clearing, the rocks) - `{ set, bodies }`, or null for none. The set rides
 * the built pixel (`landProps` - its host frames every built pixel's), the bodies its cover.
 * @param {number} px @param {number} py @param {ArrayLike<number>|null|undefined} raw @param {(x: number, z: number) => boolean} [keep]
 */
export function standLandProps(px, py, raw, keep = () => true) {
  if (!raw?.length) return null;
  const kept = [];
  for (let i = 0; i < raw.length; i += LAND_PROP_FLOATS)
    if (keep(raw[i], raw[i + 2])) for (let k = 0; k < LAND_PROP_FLOATS; k++) kept.push(raw[i + k]);
  if (!kept.length) return null;
  const props = Float32Array.from(kept),
    bodies = [];
  for (let i = 0; i < props.length; i += LAND_PROP_FLOATS) bodies.push(...landPropBodies(props, i));
  return { set: { px, py, props }, bodies };
}
