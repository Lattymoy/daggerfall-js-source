// @ts-check
// BLD (2026-10-26, the owner, having walked the Imperial City: "... and no lighting sources like the original layouts";
// bible/03-World/Arena-Provinces.md IC-GRAND, BLD) - THE FABRIC'S LIGHTS, as Daggerfall's own blocks carry theirs.
//
// DFU's reference: a city block's lights are its LIGHT FLATS - misc flats of TEXTURE.210 (RMBLayout AddLights/AddLight;
// world/city/cityLights.js, one point light a flat, the [City] prefab's range 18 and white), drawn as billboards and lit
// at night. Measured on the freeware's 920 RMB blocks: 2,146 light flats, 2.33 a block, at most 8; the street lamp-posts
// 29 (992) and 28 (710) the most of them by far. So the fabric's streets carry the same flats, the same records, at the
// same density: no light of the port's own, no glow painted on - Daggerfall's lamp-posts, lit by Daggerfall's law.
//
// THE LAW (pure: the cell's layout in, the same lamps on every client): a lamp-post at the kerb of a street front, by the
// front's first corner (FABRIC_LAMPS.inset along it - never before its door, world/imperialFabricBuildings.js, which
// stands at its middle bay) - on a main street's pavement, at a lane's or a side street's wall foot - never in an alley;
// two either side of a square's
// fountain; each at least FABRIC_LAMPS.spacing from every other of the cell's; the squares first, then the main streets,
// the side streets and the lanes, each in its hash's order; at most FABRIC_LAMPS.perCell a cell (Daggerfall's own
// blocks' most); only on the open street or square of the cell itself (world/imperialFabric.js fabricGroundIn). The
// district picks the post (FABRIC_LAMPS.posts: its sector's parity).
import {
  fabricCell,
  fabricGroundIn,
  outwardOf,
  streetKind,
  centroid,
  PAVEMENT,
  SQUARE_FOUNTAIN,
  GROUND,
} from './imperialFabric.js';
import { imperialCellRect, imperialDistrictAt, IMPERIAL_SECTORS } from './imperialCity.js';
import { LIGHTS_ARCHIVE } from './city/cityLights.js';
import { hash32 } from './spawnedDungeons.js';

/** The lamps' measures: TEXTURE.210's two street lamp-posts (the freeware's commonest light flats), the least distance
 *  between two of a cell's, the most a cell carries (Daggerfall's own blocks' most), and a lamp's place out from its
 *  front - a main street's on its pavement, any other's at the wall's foot. */
export const FABRIC_LAMPS = Object.freeze({
  archive: LIGHTS_ARCHIVE,
  posts: Object.freeze([29, 28]),
  spacing: 18,
  perCell: 8,
  pavement: PAVEMENT.w - 0.6,
  kerb: 0.8,
  inset: 0.6,
});
/** The streets a lamp stands on, in the order they are lit. */
const LIT = Object.freeze({ main: 1, side: 2, lane: 3 });
const SALT = 0xb1d4;
const _lamps = new Map();
const KEEP = 1024;

/**
 * A CELL'S LAMPS (row r, column c of the plan): each `{ at: [x, z], record }` in the city's metres (x east, z south), the
 * cell's own - kept (an LRU).
 * @returns {ReadonlyArray<{ at: number[], record: number }>}
 */
export function fabricCellLamps(r, c) {
  const k = r * 4096 + c;
  let out = _lamps.get(k);
  if (out) return out;
  out = Object.freeze(makeLamps(r, c));
  _lamps.set(k, out);
  if (_lamps.size > KEEP) _lamps.delete(_lamps.keys().next().value);
  return out;
}
function makeLamps(r, c) {
  const L = fabricCell(r, c);
  if (!L.plots.length && !L.fountains.length) return [];
  const [x0, z0, x1, z1] = imperialCellRect(r, c);
  /** @type {Array<{ at: number[], rank: number, h: number }>} */
  const spots = [];
  for (const f of L.fountains)
    for (const s of [-1, 1])
      spots.push({ at: [f[0] + s * (SQUARE_FOUNTAIN.r + 2.5), f[1]], rank: 0, h: hash32(SALT, r, c, s) });
  for (const p of L.plots) {
    for (let e = 0; e < 4; e++) {
      if (!(p.out & (1 << e))) continue;
      const kind = streetKind(p.sw?.[e] ?? 0),
        rank = LIT[kind];
      if (!rank) continue;
      const a = p.q[e],
        b = p.q[(e + 1) & 3],
        n = outwardOf(p.q, e),
        out = kind === 'main' ? FABRIC_LAMPS.pavement : FABRIC_LAMPS.kerb;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        s = Math.min(FABRIC_LAMPS.inset, len / 2) / (len || 1);
      spots.push({
        at: [a[0] + (b[0] - a[0]) * s + n[0] * out, a[1] + (b[1] - a[1]) * s + n[1] * out],
        rank,
        h: hash32(SALT, p.key, e),
      });
    }
  }
  spots.sort((u, v) => u.rank - v.rank || u.h - v.h);
  const kept = [];
  for (const s of spots) {
    if (kept.length >= FABRIC_LAMPS.perCell) break;
    const [x, z] = s.at;
    if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
    const g = fabricGroundIn(L, x, z);
    if (g !== GROUND.street && g !== GROUND.square) continue;
    if (kept.some((k) => Math.hypot(k.at[0] - x, k.at[1] - z) < FABRIC_LAMPS.spacing)) continue;
    kept.push(s);
  }
  const district = imperialDistrictAt(
    ...centroid([
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ]),
  );
  const sector = Math.max(
    0,
    IMPERIAL_SECTORS.findIndex(([d]) => d === district),
  );
  const record = FABRIC_LAMPS.posts[sector % FABRIC_LAMPS.posts.length];
  return kept.map((s) => Object.freeze({ at: Object.freeze(s.at), record }));
}
