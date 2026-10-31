// @ts-check
// TOWN-DRESS (OWN-WORK3, 2026-10-31; the owner: "removing mods from outside authors and instead replacing them with
// our own work") - A TOWN DRESSED BY OUR OWN LAW, in place of Beautiful Villages' and Beautiful Cities' retired edits:
// lamps along its streets, trade goods at its shops, taverns and temples, the zone's plants round its wells, and a market
// of our own stalls near its middle. Every piece keeps off a road, a door's step and the four metres before it, every
// wall, model and flat, a home's lot, and what the town already stood (the walk grid it is handed: its wall, its fabric,
// its yards and port). No building moves, so every building key is Daggerfall's. Every province is dressed alike.
// Pure: the host (scenes/townDressHost.js) hands the grid and the models; the answer is the same on every client.
import { LOCATION_TYPES, CLIMATE_BASE_TYPES } from '../formats/mapsFile.js';
import { BUILDING_TYPES } from './buildingNames.js';
import { NAV_CELL, NAV_CELLS_PER_BLOCK, ROAD_WEIGHT } from './city/cityNavigation.js';
import { RMB_SIDE } from './locationLayout.js';
import { miscModelMatrix } from './rmbLayout.js';
import { stepsDone } from './puddleMask.js';   // IC-STUTTER: OW-HITCH's runner
import { isPortCell, FABRIC_KIND } from './urban/townFabric.js';
import { MeshBuilder } from './detStandIns.js';
import { CAPITAL_ART, art } from './capitalShapes.js';

/** A door's step and the metres before it kept clear (world/curatedPlacements.js DOOR_APPROACH_M, the same rule). */
export const DOOR_CLEAR_M = 4;
/** Our market stall's model id - past the town fabric's (5,000,000) and short of the Imperial City's (7,000,000). */
export const TOWN_STALL_MODEL = 5_800_000;
/** A ground flat's YPos and a misc model's - Daggerfall's own for a ground flat (210_29: 992 of 992); a model's origin
 *  on the block's plane (RMBLayout's propsOffsetY under its record). */
export const DRESS_FLAT_Y = -4;
export const DRESS_MODEL_Y = -4;
/** The law's measures, metres. */
export const DRESS = Object.freeze({
  lampRoad: 0.45,       // a lamp's foot this far off a road's edge, at the least
  roadClear: 0.8,       // every other piece this far off a road
  wallGap: 0.25,        // between a piece and a building's walls
  homeLot: 6,           // a home's or a guild hall's lot (scenes/homeYards.js YARD_MARGIN): no stall on it
  homeNear: 2.5,        // a lamp's, a plant's or a crate's distance from a home's walls
  modelClear: 0.4,      // from another model's box
  flatClear: 0.3,       // between two flats' edges
  doorSide: 0.8,        // past each jamb, the door's approach widened
  stallBuilding: 2,     // a stall's distance from any building
  stallStep: 3.4,       // between two stalls of a row, centre to centre
  stallGap: 4,          // between two rows
  floraRing: 0.5,       // a plant's gap from its well
});
/** The location types the law dresses, and how: `lampGap` the least metres between two lamps, the block's own counted
 *  (0: no lamps), `stalls` its market's. */
export const DRESSED_TYPES = Object.freeze({
  [LOCATION_TYPES.TownCity]: Object.freeze({ lampGap: 26, stalls: 3 }),
  [LOCATION_TYPES.TownHamlet]: Object.freeze({ lampGap: 26, stalls: 2 }),
  [LOCATION_TYPES.TownVillage]: Object.freeze({ lampGap: 34, stalls: 1 }),
  [LOCATION_TYPES.Tavern]: Object.freeze({ lampGap: 34, stalls: 0 }),
  [LOCATION_TYPES.ReligionTemple]: Object.freeze({ lampGap: 34, stalls: 0 }),
  [LOCATION_TYPES.HomeWealthy]: Object.freeze({ lampGap: 0, stalls: 0 }),
  [LOCATION_TYPES.HomeFarms]: Object.freeze({ lampGap: 0, stalls: 0 }),
});
/** Each picture the law stands: [archive, record, width in metres] - the width Daggerfall draws it at (its pixels, its
 *  record's scale, MeshReader's 0.025), measured on the freeware. */
export const DRESS_PIECES = Object.freeze({
  lamp: Object.freeze([210, 29, 0.53]),
  barrel: Object.freeze([205, 0, 0.83]), crate: Object.freeze([205, 24, 1.05]), crates: Object.freeze([205, 25, 1.53]),
  sack: Object.freeze([205, 17, 0.93]), sackOpen: Object.freeze([205, 19, 0.78]), sackSmall: Object.freeze([205, 20, 0.68]),
  basket: Object.freeze([205, 9, 0.95]), bucket: Object.freeze([205, 29, 0.9]),
  potLeafy: Object.freeze([205, 39, 1.05]), potFern: Object.freeze([205, 40, 0.7]), potPalm: Object.freeze([205, 38, 1.5]),
  urn: Object.freeze([205, 41, 0.48]), anvil: Object.freeze([211, 35, 1.38]),
  bottleA: Object.freeze([205, 11, 0.25]), bottleB: Object.freeze([205, 13, 0.25]), bottleC: Object.freeze([205, 15, 0.25]),
  fishPile: Object.freeze([211, 8, 1.07]), fish: Object.freeze([211, 9, 0.55]), ham: Object.freeze([211, 40, 0.73]),
  vase: Object.freeze([213, 6, 0.6]), fernPot: Object.freeze([213, 5, 0.7]),
  flowersWhite: Object.freeze([301, 15, 0.71]), flowersBlue: Object.freeze([301, 16, 0.71]), flowersYellow: Object.freeze([301, 13, 0.71]),
  roses: Object.freeze([301, 14, 0.71]), shrub: Object.freeze([301, 11, 1.39]), heath: Object.freeze([301, 18, 0.86]), reed: Object.freeze([301, 17, 0.45]),
});
const B = BUILDING_TYPES;
/** A building's trade goods, by its type: the pieces its wall takes, in the order they are stood (two at the most). */
export const TRADE_GOODS = Object.freeze({
  [B.Tavern]: Object.freeze(['barrel', 'barrel', 'crate']),
  [B.GeneralStore]: Object.freeze(['sack', 'barrel', 'crate', 'sackOpen']),
  [B.Armorer]: Object.freeze(['anvil', 'barrel']),
  [B.WeaponSmith]: Object.freeze(['anvil', 'barrel']),
  [B.Alchemist]: Object.freeze(['potLeafy', 'urn', 'potFern']),
  [B.ClothingStore]: Object.freeze(['sack', 'sackSmall']),
  [B.FurnitureStore]: Object.freeze(['crates', 'crate']),
  [B.Bookseller]: Object.freeze(['crate', 'potFern']),
  [B.GemStore]: Object.freeze(['urn', 'potFern']),
  [B.PawnShop]: Object.freeze(['crate', 'sackSmall']),
  [B.Bank]: Object.freeze(['urn', 'urn']),
  [B.Library]: Object.freeze(['potFern', 'urn']),
  [B.Temple]: Object.freeze(['urn', 'potLeafy']),
  [B.Palace]: Object.freeze(['urn', 'urn']),
});
/** The buildings whose lot a player may own and dress (a home - DFU's residences - and a guild's hall, GUILD-YARD). */
const lotHolder = (t) => (t >= B.House1 && t <= B.House4) || t === B.HouseForSale || t === B.GuildHall;
/** The zone's plants round a well, by its climate (the ground's - URBANIZER keeps the zone's as zoneClimateType). */
export const WELL_FLORA = Object.freeze({
  [CLIMATE_BASE_TYPES.Temperate]: Object.freeze(['flowersWhite', 'flowersBlue', 'flowersYellow', 'roses']),
  [CLIMATE_BASE_TYPES.Mountain]: Object.freeze(['heath', 'reed', 'potFern']),
  [CLIMATE_BASE_TYPES.Desert]: Object.freeze(['urn', 'potPalm']),
  [CLIMATE_BASE_TYPES.Swamp]: Object.freeze(['fernPot', 'shrub', 'reed']),
});
/** The flats a town draws water at: Daggerfall's well, its two fountains and its two pumps (TEXTURE.212). */
export const WELL_FLATS = Object.freeze(['212_0', '212_2', '212_3', '212_8', '212_9']);
/** What a stall sells: three pieces along its counter, and one on the ground beside it. */
export const STALL_WARES = Object.freeze([
  Object.freeze({ counter: Object.freeze(['fish', 'fishPile', 'fish']), ground: 'barrel' }),
  Object.freeze({ counter: Object.freeze(['basket', 'ham', 'sackSmall']), ground: 'sack' }),
  Object.freeze({ counter: Object.freeze(['bottleA', 'bottleB', 'bottleC']), ground: 'crate' }),
  Object.freeze({ counter: Object.freeze(['urn', 'vase', 'urn']), ground: 'crate' }),
  Object.freeze({ counter: Object.freeze(['vase', 'fernPot', 'vase']), ground: 'bucket' }),
]);

/** OUR STALL (TOWN_STALL_MODEL), metres in its own frame: y up from the ground, its front - the counter, the buyer's
 *  side - along +z. A trestle counter under a sloping cloth awning on four posts. */
export const TOWN_STALL = Object.freeze({
  half: 1.4, back: -0.85, front: 0.95,       // the posts' outer faces: x within +-half, z from back to front
  post: 0.1, backH: 2.5, frontH: 2.2,        // the posts' side and their tops
  counterY: 0.92, counterD: 0.7, counterT: 0.06,   // the counter's top, its depth and its board's thickness
  overhang: 0.2, valance: 0.25,              // the awning past the posts, and its cloth hanging at the front
});
/** A stall's ground in its own frame, [x0, z0, x1, z1] - the awning's reach. */
export const STALL_FOOT = Object.freeze([-TOWN_STALL.half - TOWN_STALL.overhang, TOWN_STALL.back - TOWN_STALL.overhang, TOWN_STALL.half + TOWN_STALL.overhang, TOWN_STALL.front + TOWN_STALL.overhang]);
/** Where a stall's wares stand on its counter, [x, z] in its frame. */
const COUNTER_AT = Object.freeze([[-0.85, 0.55], [0, 0.55], [0.85, 0.55]]);
/** A counter ware's YPos: its foot on the counter's top (a flat stands (-YPos - 6) units over the plane). */
export const WARE_Y = -Math.round(TOWN_STALL.counterY / 0.025) - 6;

/** The stall's mesh: the port's own shapes in the capitals' own pictures (timber and cloth, world/capitalModels.js). */
export function buildTownStall(S = TOWN_STALL) {
  const mb = new MeshBuilder(), TIMBER = art(CAPITAL_ART.timber), CLOTH = art(CAPITAL_ART.cloth);
  const px = S.half - S.post / 2, sink = 0.2;
  for (const [x, z, h] of [[-px, S.back + S.post / 2, S.backH], [px, S.back + S.post / 2, S.backH], [-px, S.front - S.post / 2, S.frontH], [px, S.front - S.post / 2, S.frontH]]) {
    mb.box(TIMBER, [x, (h - sink) / 2, z], [S.post, h + sink, S.post]);
  }
  const cz = S.front - S.counterD / 2;
  mb.box(TIMBER, [0, S.counterY - S.counterT / 2, cz], [2 * S.half, S.counterT, S.counterD]);   // the counter's top
  mb.box(TIMBER, [0, (S.counterY - S.counterT) / 2 + 0.1, S.front - 0.03], [2 * px, S.counterY - S.counterT - 0.2, 0.04]);   // its front board
  for (const x of [-px, px]) mb.box(TIMBER, [x, S.frontH - 0.06, (S.back + S.front) / 2], [0.08, 0.08, S.front - S.back]);   // the side rails under the awning
  const o = S.overhang, x0 = -S.half - o, x1 = S.half + o, zb = S.back - o, zf = S.front + o;
  const slope = (S.backH - S.frontH) / (S.front - S.back), yb = S.backH + slope * o + 0.02, yf = S.frontH - slope * o + 0.02;
  const len = Math.hypot(zf - zb, yb - yf), n = [0, (zf - zb) / len, (yb - yf) / len];
  const w = x1 - x0;
  mb.sheet(CLOTH, [x0, yb, zb], [x1, yb, zb], [x1, yf, zf], [x0, yf, zf], n, [[0, 0], [w, 0], [w, -len], [0, -len]]);
  mb.sheet(CLOTH, [x0, yf, zf], [x1, yf, zf], [x1, yf - S.valance, zf], [x0, yf - S.valance, zf], [0, 0, 1], [[0, 0], [w, 0], [w, -S.valance], [0, -S.valance]]);
  return mb.build();
}

// ---- the town's ground ----------------------------------------------------------------------------------------------

/** FNV-1a over a string, the law's seed. */
function hashOf(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
/** A cell's or a candidate's order: a hash of the town's seed and two numbers (the same on every client). */
const orderOf = (seed, a, b) => Math.imul(seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b), 0xc2b2ae35) >>> 0;
/** A box grown by `r` holds a point. */
const inBox = (b, x, z, r) => x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r;
/** A model's box in the block's frame from its own vertices under its placement (`m`), [x0, z0, x1, z1]. */
function boxOf(positions, m) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const px = positions[i], py = positions[i + 1], pz = positions[i + 2];
    const x = m[0] * px + m[4] * py + m[8] * pz + m[12], z = m[2] * px + m[6] * py + m[10] * pz + m[14];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return x0 <= x1 ? [x0, z0, x1, z1] : null;
}
/** A door's approach in the block's frame: its foot, the way out (level, unit) and half its width. */
export function doorReach(door, m) {
  const at = (x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[2] * x + m[6] * y + m[10] * z + m[14]];
  const v0 = door.vert0, v2 = door.vert2, cx = (v0.x + v2.x) / 2, cz = (v0.z + v2.z) / 2, fy = Math.min(v0.y, v2.y);
  const foot = at(cx, fy, cz), tip = at(cx + door.normal.x, fy, cz + door.normal.z);
  const ox = tip[0] - foot[0], oz = tip[1] - foot[1], l = Math.hypot(ox, oz) || 1;
  const a = at(v0.x, fy, v0.z), b = at(v2.x, fy, v2.z);
  return { foot, out: [ox / l, oz / l], half: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 };
}
/** Whether a disc (x, z, r) touches a door's approach - its step and DOOR_CLEAR_M before it, DRESS.doorSide past each
 *  jamb, and a hand behind its sill. */
export function inDoorway(d, x, z, r) {
  const dx = x - d.foot[0], dz = z - d.foot[1];
  const along = dx * d.out[0] + dz * d.out[1], across = Math.abs(-dx * d.out[1] + dz * d.out[0]);
  return along > -0.5 - r && along < DOOR_CLEAR_M + r && across < d.half + DRESS.doorSide + r;
}
/** A door's approach's box, [x0, z0, x1, z1] - what the index files it under. */
const doorBox = (d) => {
  const h = d.half + DRESS.doorSide, ax = d.foot[0] + d.out[0] * DOOR_CLEAR_M, az = d.foot[1] + d.out[1] * DOOR_CLEAR_M;
  return [Math.min(d.foot[0], ax) - h - 0.5, Math.min(d.foot[1], az) - h - 0.5, Math.max(d.foot[0], ax) + h + 0.5, Math.max(d.foot[1], az) + h + 0.5];
};
/** The reach a flat of the block keeps round its foot, by its picture: a well or a fountain its basin, a pump or a lamp
 *  its post, an editor's marker a step, any other a crate's. */
const FLAT_REACH = Object.freeze({ '212_0': 1.0, '212_2': 1.0, '212_3': 1.0, '212_8': 0.35, '212_9': 0.35, '210_28': 0.36, '210_29': 0.27 });
const flatReach = (archive, record) => FLAT_REACH[`${archive}_${record}`] ?? (archive === 199 ? 0.4 : 0.5);

/** A bucket index of boxes over the town (8 m buckets): what stands near a point, asked without walking the town. */
class Near {
  constructor() { this.cells = new Map(); }
  add(box, item) {
    for (let j = Math.floor(box[1] / 8); j <= Math.floor(box[3] / 8); j++) for (let i = Math.floor(box[0] / 8); i <= Math.floor(box[2] / 8); i++) {
      const k = i * 65536 + j;
      const c = this.cells.get(k);
      if (c) c.push(item); else this.cells.set(k, [item]);
    }
  }
  /** every item filed within `reach` of (x, z) - an item may come twice */
  *at(x, z, reach) {
    for (let j = Math.floor((z - reach) / 8); j <= Math.floor((z + reach) / 8); j++) for (let i = Math.floor((x - reach) / 8); i <= Math.floor((x + reach) / 8); i++) {
      const c = this.cells.get(i * 65536 + j);
      if (c) yield* c;
    }
  }
}

/**
 * THE TOWN'S MEASURES, block by block: each building's box, type and doors; every other model's box; every flat's foot
 * and reach; its lamps and its wells. `modelOf(id)` the model as the pipeline builds it ({ positions, doors }), or null.
 * @param {any} loc @param {(id: number) => any} modelOf
 */
export function townMeasures(loc, modelOf) {
  return (loc?.blocks ?? []).map((b) => {
    const buildings = new Map(), props = [], flats = [], doors = [], lamps = [], wells = [];
    const list = b.dfBlock?.rmbBlock?.fldHeader?.buildingDataList ?? [];
    for (const placed of b.layout?.models ?? []) {
      const model = modelOf(placed.modelIdNum);
      const box = model?.positions?.length ? boxOf(model.positions, placed.matrix) : null;
      if (!box) continue;
      if (placed.recordIndex == null) { props.push(box); continue; }
      const k = placed.recordIndex, had = buildings.get(k);
      if (had) for (let i = 0; i < 4; i++) had.box[i] = i < 2 ? Math.min(had.box[i], box[i]) : Math.max(had.box[i], box[i]);
      else buildings.set(k, { record: k, box: [...box], type: list[k]?.buildingType ?? -1, doors: [] });
      for (const d of model.doors ?? []) { const r = doorReach(d, placed.matrix); doors.push(r); buildings.get(k).doors.push(r); }
    }
    for (const w of b.layout?.windmills ?? []) props.push([w.matrix[12] - 4, w.matrix[14] - 4, w.matrix[12] + 4, w.matrix[14] + 4]);   // a mill's tower, its sails over it
    const rmb = b.dfBlock?.rmbBlock;
    for (const f of rmb?.miscFlatObjectRecords ?? []) {
      const x = f.xPos * 0.025, z = (f.zPos + 4096) * 0.025, key = `${f.textureArchive}_${f.textureRecord}`, reach = flatReach(f.textureArchive, f.textureRecord);
      flats.push([x, z, reach]);
      if (f.textureArchive === 210 && [14, 15, 28, 29].includes(f.textureRecord)) lamps.push([x, z]);
      if (WELL_FLATS.includes(key)) wells.push([x, z, reach]);
    }
    for (const s of rmb?.subRecords ?? []) {
      for (const f of s.exterior?.blockFlatObjectRecords ?? []) flats.push([(f.xPos + s.xPos) * 0.025, (f.zPos + 4096 - s.zPos) * 0.025, flatReach(f.textureArchive, f.textureRecord)]);
    }
    return { buildings: [...buildings.values()], props, flats, doors, lamps, wells };
  });
}

/**
 * THE TOWN'S DRESS, block by block, or null for a place it does not dress. `nav` the town's walk grid as its walkers'
 * is made (the yards and port carved out); `modelOf(id)` the model ({ positions, doors }); `plan` the town's fabric past
 * the Bay. Answers `{ blocks: [{ flats, models }] parallel to loc.blocks, stalls: [[x0, z0, x1, z1]] in the location's
 * frame, counts }`, each record in the block's own RMB shape.
 * @param {any} loc @param {any} dfLocation
 * @param {{ nav: { width: number, height: number, grid: Uint8Array }, modelOf: (id: number) => any, plan?: any }} o
 */
export const townDressOf = (loc, dfLocation, o) => stepsDone(townDressSteps(loc, dfLocation, o));
/** townDressOf a band of rows, a stall or a few dozen buildings at a time (IC-STUTTER: the build's breather between).
 *  @param {any} loc @param {any} dfLocation
 *  @param {{ nav: { width: number, height: number, grid: Uint8Array }, modelOf: (id: number) => any, plan?: any }} o */
export function* townDressSteps(loc, dfLocation, { nav, modelOf, plan = null }) {
  const type = dfLocation?.mapTableData?.locationType;
  const rule = DRESSED_TYPES[type];
  if (!rule || dfLocation?.capital || !loc?.blocks?.length || !nav?.grid) return null;
  const seed = hashOf(`${(dfLocation.mapTableData?.mapId ?? 0) >>> 0}:${dfLocation.name ?? ''}`);
  const climate = dfLocation.climate?.zoneClimateType ?? dfLocation.climate?.climateType ?? CLIMATE_BASE_TYPES.Temperate;
  const W = nav.width, H = nav.height, kinds = plan?.kind && plan.kind.length === W * H ? plan.kind : null, K = FABRIC_KIND;
  const fabricOwn = (i) => !!kinds && (kinds[i] === K.main || kinds[i] === K.pave || kinds[i] === K.side || kinds[i] === K.alley || kinds[i] === K.yard);
  const weight = (gx, gy) => (gx < 0 || gy < 0 || gx >= W || gy >= H ? 0 : nav.grid[gy * W + gx] >> 4);
  const origin = (b) => [b.originX ?? b.x * RMB_SIDE, b.originZ ?? b.y * RMB_SIDE];
  const byCell = new Map(loc.blocks.map((b, i) => [`${b.x},${b.y}`, i]));
  /** a cell its block's own town map covers (a building's, a wall's, a prop's): the boxes below measure it exactly */
  const autoAt = (gx, gy) => {
    const bx = Math.floor(gx / NAV_CELLS_PER_BLOCK), by = Math.floor(gy / NAV_CELLS_PER_BLOCK), i = byCell.get(`${bx},${by}`);
    const am = i == null ? null : loc.blocks[i].dfBlock?.rmbBlock?.fldHeader?.autoMapData;
    return am ? am[(NAV_CELLS_PER_BLOCK - 1 - (gy - by * NAV_CELLS_PER_BLOCK)) * NAV_CELLS_PER_BLOCK + (gx - bx * NAV_CELLS_PER_BLOCK)] ?? 0 : 0;
  };
  /** the block a point of the location stands in - its index, or -1 */
  const blockAt = (x, z) => byCell.get(`${Math.floor(x / RMB_SIDE)},${Math.floor(z / RMB_SIDE)}`) ?? -1;
  const dressable = (i) => i >= 0 && !isPortCell(loc.blocks[i].blockName ?? loc.blocks[i].dfBlock?.name);

  // the measures, in the location's frame, filed by place
  const buildings = [], doors = new Near(), near = { buildings: new Near(), props: new Near(), flats: new Near(), placed: new Near() };
  const lamps = [], wells = [];
  for (const [i, m] of townMeasures(loc, modelOf).entries()) {
    const [ox, oz] = origin(loc.blocks[i]), mv = (bx) => [bx[0] + ox, bx[1] + oz, bx[2] + ox, bx[3] + oz], mf = (d) => ({ ...d, foot: [d.foot[0] + ox, d.foot[1] + oz] });
    for (const bd of m.buildings) { const b = { ...bd, box: mv(bd.box), doors: bd.doors.map(mf) }; buildings.push(b); near.buildings.add(b.box, b); }
    for (const d of m.doors) { const md = mf(d); doors.add(doorBox(md), md); }
    for (const p of m.props) { const box = mv(p); near.props.add(box, box); }
    for (const f of m.flats) { const at = [f[0] + ox, f[1] + oz, f[2]]; near.flats.add([at[0] - at[2], at[1] - at[2], at[0] + at[2], at[1] + at[2]], at); }
    for (const l of m.lamps) lamps.push([l[0] + ox, l[1] + oz]);
    for (const w of m.wells) wells.push([w[0] + ox, w[1] + oz, w[2]]);
  }
  const lots = buildings.filter((bd) => lotHolder(bd.type)).map((bd) => bd.box), lotNear = new Near();
  for (const l of lots) lotNear.add([l[0] - DRESS.homeLot, l[1] - DRESS.homeLot, l[2] + DRESS.homeLot, l[3] + DRESS.homeLot], l);
  const stalls = [];

  /** a disc's cells: none water, wall, fabric or ground shut (a cell its block's town map covers is a building's or a
   *  prop's, which the boxes measure); and no road within `road` metres */
  const groundOk = (x, z, r, road) => {
    const cx = Math.floor(x / NAV_CELL), cz = Math.floor(z / NAV_CELL);
    if (!(weight(cx, cz) > 0) || weight(cx, cz) === ROAD_WEIGHT || fabricOwn(cz * W + cx)) return false;
    for (let gy = Math.floor((z - r) / NAV_CELL); gy <= Math.floor((z + r) / NAV_CELL); gy++) for (let gx = Math.floor((x - r) / NAV_CELL); gx <= Math.floor((x + r) / NAV_CELL); gx++) {
      if (gx < 0 || gy < 0 || gx >= W || gy >= H || fabricOwn(gy * W + gx)) return false;
      if (!(weight(gx, gy) > 0) && !autoAt(gx, gy)) return false;
    }
    for (let gy = Math.floor((z - r - road) / NAV_CELL); gy <= Math.floor((z + r + road) / NAV_CELL); gy++) for (let gx = Math.floor((x - r - road) / NAV_CELL); gx <= Math.floor((x + r + road) / NAV_CELL); gx++) {
      if (weight(gx, gy) === ROAD_WEIGHT) return false;
    }
    return true;
  };
  /** a piece's place: on open ground, off the roads, walls, doors, models, flats and stalls - and `lot` metres off a
   *  home's walls */
  /** @type {(x: number, z: number, r: number, o?: { road?: number, lot?: number }) => boolean} */
  const clear = (x, z, r, { road = DRESS.roadClear, lot = DRESS.homeNear } = {}) => {
    if (!groundOk(x, z, r, road)) return false;
    for (const bd of near.buildings.at(x, z, r + DRESS.wallGap)) if (inBox(bd.box, x, z, r + DRESS.wallGap)) return false;
    for (const d of doors.at(x, z, r)) if (inDoorway(d, x, z, r)) return false;
    for (const p of near.props.at(x, z, r + DRESS.modelClear)) if (inBox(p, x, z, r + DRESS.modelClear)) return false;
    for (const f of near.flats.at(x, z, r + DRESS.flatClear)) if (Math.hypot(f[0] - x, f[1] - z) < f[2] + r + DRESS.flatClear) return false;
    for (const f of near.placed.at(x, z, r + DRESS.flatClear + 1)) if (Math.hypot(f[0] - x, f[1] - z) < f[2] + r + DRESS.flatClear) return false;
    for (const s of stalls) if (inBox(s, x, z, r + DRESS.flatClear)) return false;
    if (lot > 0) for (const l of lotNear.at(x, z, r + lot)) if (inBox(l, x, z, r + lot)) return false;
    return true;
  };
  const out = loc.blocks.map(() => ({ flats: [], models: [] }));
  const counts = { lamps: 0, goods: 0, flora: 0, stalls: 0, wares: 0 };
  /** a flat stood at a point of the location, filed in its block (its YPos `y`); `solid` a piece others keep off */
  const standFlat = (name, x, z, y = DRESS_FLAT_Y, solid = true) => {
    const i = blockAt(x, z);
    if (!dressable(i)) return false;
    const [archive, record, w] = DRESS_PIECES[name], [ox, oz] = origin(loc.blocks[i]);
    out[i].flats.push({ position: 0, xPos: Math.round((x - ox) / 0.025), yPos: y, zPos: Math.round((z - oz) / 0.025) - 4096, textureArchive: archive, textureRecord: record, textureBitfield: (archive << 7) | record, factionID: 0, flags: 0 });
    if (solid) near.placed.add([x - w / 2, z - w / 2, x + w / 2, z + w / 2], [x, z, w / 2]);
    return true;
  };

  // 1. THE MARKET: our stalls on the open ground nearest the town's middle, each front to a street
  if (rule.stalls > 0) {
    const mid = [(loc.width * RMB_SIDE) / 2, (loc.height * RMB_SIDE) / 2], foot = STALL_FOOT, cands = [];
    for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
      if (gx === 0 && gy % 32 === 0) yield;
      if (weight(gx, gy) !== ROAD_WEIGHT) continue;
      for (const [fx, fz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = gx - fx, ny = gy - fz;   // the cell behind the road's edge: the stall's front to the road
        if (!(weight(nx, ny) > 0) || weight(nx, ny) === ROAD_WEIGHT) continue;
        const ex = (gx + 0.5 - fx / 2) * NAV_CELL, ez = (gy + 0.5 - fz / 2) * NAV_CELL, back = foot[3] + DRESS.roadClear;
        cands.push({ x: ex - fx * back, z: ez - fz * back, f: [fx, fz], d: (ex - mid[0]) ** 2 + (ez - mid[1]) ** 2, o: orderOf(seed, gx * 4 + fx + 1, gy * 4 + fz + 1) });
      }
    }
    cands.sort((a, b) => a.d - b.d || a.o - b.o);
    yield;
    const overlaps = (a, b, m) => !(a[2] + m <= b[0] || a[0] - m >= b[2] || a[3] + m <= b[1] || a[1] - m >= b[3]);
    const fits = (x, z, f) => {
      if (!dressable(blockAt(x, z))) return null;
      const along = [f[1], -f[0]], pts = [];   // the counter's run, across the facing
      for (const [px, pz] of [[foot[0], foot[1]], [foot[2], foot[1]], [foot[2], foot[3]], [foot[0], foot[3]], [0, foot[1]], [0, foot[3]], [foot[0], 0], [foot[2], 0], [0, 0]]) {
        pts.push([x + px * along[0] + pz * f[0], z + px * along[1] + pz * f[1]]);
      }
      const box = [Math.min(...pts.map((c) => c[0])), Math.min(...pts.map((c) => c[1])), Math.max(...pts.map((c) => c[0])), Math.max(...pts.map((c) => c[1]))];
      if (blockAt(box[0], box[1]) < 0 || blockAt(box[2], box[3]) < 0) return null;
      for (const [cx, cz] of pts) if (!groundOk(cx, cz, 0.2, cx === x && cz === z ? DRESS.roadClear : 0.3)) return null;
      const cx = (box[0] + box[2]) / 2, cz = (box[1] + box[3]) / 2, reach = Math.max(box[2] - box[0], box[3] - box[1]) / 2;
      for (const bd of near.buildings.at(cx, cz, reach + DRESS.stallBuilding)) if (overlaps(box, bd.box, DRESS.stallBuilding)) return null;
      for (const l of lotNear.at(cx, cz, reach)) if (overlaps(box, l, DRESS.homeLot)) return null;
      for (const d of doors.at(cx, cz, reach)) for (const [px, pz] of pts) if (inDoorway(d, px, pz, 0.3)) return null;
      for (const p of near.props.at(cx, cz, reach + DRESS.modelClear)) if (overlaps(box, p, DRESS.modelClear)) return null;
      for (const fl of near.flats.at(cx, cz, reach + 1.5)) if (inBox(box, fl[0], fl[1], fl[2] + DRESS.flatClear)) return null;
      for (const fl of near.placed.at(cx, cz, reach + 1.5)) if (inBox(box, fl[0], fl[1], fl[2] + DRESS.flatClear)) return null;
      for (const s of stalls) if (overlaps(box, s, 0.4)) return null;
      return box;
    };
    const stand = (x, z, f, k) => {
      const box = fits(x, z, f);
      if (!box) return false;
      const i = blockAt(x, z), [ox, oz] = origin(loc.blocks[i]);
      const yRotation = -Math.round((Math.atan2(f[0], f[1]) * 1024) / Math.PI) + 0;   // the model's +z (its counter) to the street; + 0: never -0
      out[i].models.push({ modelId: String(TOWN_STALL_MODEL), modelIdNum: TOWN_STALL_MODEL, objectType: 0, xPos: Math.round((x - ox) / 0.025), yPos: DRESS_MODEL_Y, zPos: Math.round((z - oz) / 0.025) - 4096, xRotation: 0, yRotation, zRotation: 0 });
      stalls.push(box);
      counts.stalls++;
      const wares = STALL_WARES[orderOf(seed, k, 11) % STALL_WARES.length], along = [f[1], -f[0]];
      for (const [j, [px, pz]] of COUNTER_AT.entries()) if (standFlat(wares.counter[j], x + px * along[0] + pz * f[0], z + px * along[1] + pz * f[1], WARE_Y, false)) counts.wares++;
      const side = orderOf(seed, k, 13) & 1 ? 1 : -1, gw = DRESS_PIECES[wares.ground][2] / 2, s = foot[2] + gw + 0.15;
      if (clear(x + side * s * along[0], z + side * s * along[1], gw, { lot: 0 }) && standFlat(wares.ground, x + side * s * along[0], z + side * s * along[1])) counts.wares++;
      return true;
    };
    let k = 0;
    for (const [n, c] of cands.entries()) {
      if (counts.stalls >= rule.stalls) break;
      if (n % 256 === 255) yield;
      if (stalls.some((s) => Math.hypot((s[0] + s[2]) / 2 - c.x, (s[1] + s[3]) / 2 - c.z) < DRESS.stallGap + DRESS.stallStep)) continue;
      if (!stand(c.x, c.z, c.f, k++)) continue;
      const along = [c.f[1], -c.f[0]];   // the row: along the street either way, while it fits
      for (const dir of [1, -1]) {
        for (let n = 1; counts.stalls < rule.stalls; n++) if (!stand(c.x + dir * n * DRESS.stallStep * along[0], c.z + dir * n * DRESS.stallStep * along[1], c.f, k++)) break;
      }
    }
  }

  // 2. TRADE GOODS against the walls of the town's shops, taverns, temples and halls
  for (const [n, bd] of buildings.entries()) {
    if (n % 32 === 31) yield;
    const goods = TRADE_GOODS[bd.type];
    if (!goods || !dressable(blockAt((bd.box[0] + bd.box[2]) / 2, (bd.box[1] + bd.box[3]) / 2))) continue;
    const first = DRESS_PIECES[goods[0]][2] / 2, spots = [], [x0, z0, x1, z1] = bd.box, off = DRESS.wallGap + 0.05 + first;
    for (let t = 0.6 + first; t <= x1 - x0 - 0.6 - first; t += 0.8) spots.push([x0 + t, z0 - off, 1, 0], [x0 + t, z1 + off, 1, 0]);
    for (let t = 0.6 + first; t <= z1 - z0 - 0.6 - first; t += 0.8) spots.push([x0 - off, z0 + t, 0, 1], [x1 + off, z0 + t, 0, 1]);
    const ord = (p) => orderOf(seed, Math.round(p[0] * 8), Math.round(p[1] * 8));
    spots.sort((a, b) => ord(a) - ord(b));
    for (const [x, z, ax, az] of spots) {
      if (!clear(x, z, first) || !standFlat(goods[0], x, z)) continue;
      counts.goods++;
      // its fellow beside it along the wall, where there is room
      const name = goods[1 + (orderOf(seed, bd.record, 3) % (goods.length - 1))], r = DRESS_PIECES[name][2] / 2, s = first + r + DRESS.flatClear + 0.05;
      for (const dir of [1, -1]) if (clear(x + dir * s * ax, z + dir * s * az, r) && standFlat(name, x + dir * s * ax, z + dir * s * az)) { counts.goods++; break; }
      break;
    }
  }

  // 3. FLORA round the wells, fountains and pumps - the zone's own plants
  const flora = WELL_FLORA[climate] ?? WELL_FLORA[CLIMATE_BASE_TYPES.Temperate];
  for (const [n, [wx, wz, wr]] of wells.entries()) {
    let stood = 0;
    for (let a = 0; a < 8 && stood < 2; a++) {
      const name = flora[(orderOf(seed, n, a) >>> 3) % flora.length], r = DRESS_PIECES[name][2] / 2;
      const ang = ((orderOf(seed, n, 17) % 8) + a * 3) * (Math.PI / 4), d = wr + DRESS.flatClear + DRESS.floraRing + r;
      const x = wx + Math.cos(ang) * d, z = wz + Math.sin(ang) * d;
      if (!clear(x, z, r) || !standFlat(name, x, z)) continue;
      counts.flora++;
      stood++;
    }
  }

  // 4. LAMPS along the streets, never nearer another than the type's lampGap
  if (rule.lampGap > 0) {
    const r = DRESS_PIECES.lamp[2] / 2, cands = [];
    for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
      if (gx === 0 && gy % 32 === 0) yield;
      if (weight(gx, gy) !== ROAD_WEIGHT) continue;
      for (const [fx, fz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = gx + fx, ny = gy + fz;
        if (!(weight(nx, ny) > 0) || weight(nx, ny) === ROAD_WEIGHT) continue;
        const ex = (gx + 0.5 + fx / 2) * NAV_CELL, ez = (gy + 0.5 + fz / 2) * NAV_CELL, s = DRESS.lampRoad + r + 0.05;
        cands.push({ x: ex + fx * s, z: ez + fz * s, o: orderOf(seed, gx * 4 + fx + 1, gy * 4 + fz + 1) });
      }
    }
    cands.sort((a, b) => a.o - b.o);
    yield;
    for (const [n, c] of cands.entries()) {
      if (n % 2048 === 2047) yield;
      if (lamps.some(([lx, lz]) => (lx - c.x) ** 2 + (lz - c.z) ** 2 < rule.lampGap ** 2)) continue;
      if (!clear(c.x, c.z, r, { road: DRESS.lampRoad }) || !standFlat('lamp', c.x, c.z)) continue;
      lamps.push([c.x, c.z]);
      counts.lamps++;
    }
  }
  return { blocks: out, stalls, counts };
}

/**
 * A DRESSED COPY of a block: its own records, and the dress's after its misc models and flats. The block read from
 * BLOCKS.BSA is untouched (another town's of the same name keeps its own), its buildings and their keys as they were.
 * @param {any} dfBlock @param {{ flats: any[], models: any[] }} adds
 */
export function dressedBlock(dfBlock, adds) {
  if (!dfBlock?.rmbBlock || (!adds?.flats?.length && !adds?.models?.length)) return dfBlock;
  const rmb = dfBlock.rmbBlock;
  return {
    ...dfBlock,
    dressed: true,
    rmbBlock: {
      ...rmb,
      misc3dObjectRecords: [...(rmb.misc3dObjectRecords ?? []), ...adds.models],
      miscFlatObjectRecords: [...(rmb.miscFlatObjectRecords ?? []), ...adds.flats],
    },
  };
}
/**
 * The town's layout dressed IN PLACE (layoutLocation's `loc`): each block the dress adds to takes its dressed copy, and
 * its layout the stalls' placements (RMBLayout's AddProps, as every misc model). Answers how many blocks it dressed.
 * @param {any} loc @param {any} dress
 */
export function dressLocation(loc, dress) {
  if (!dress) return 0;
  let n = 0;
  for (const [i, b] of (loc?.blocks ?? []).entries()) {
    const adds = dress.blocks[i];
    if (!adds?.flats.length && !adds?.models.length) continue;
    loc.blocks[i] = {
      ...b,
      dfBlock: dressedBlock(b.dfBlock, adds),
      layout: { ...b.layout, models: [...(b.layout?.models ?? []), ...adds.models.map((rec) => ({ modelId: rec.modelId, modelIdNum: rec.modelIdNum, matrix: miscModelMatrix(rec) }))] },
    };
    n++;
  }
  return n;
}
/** The town's walkers kept off its stalls (their ground closed on the walk grid). Answers how many cells it closed.
 *  @param {{ width: number, height: number, grid: Uint8Array }} nav @param {any} dress */
export function carveTownDress(nav, dress) {
  if (!nav?.grid || !dress?.stalls?.length) return 0;
  let n = 0;
  for (const s of dress.stalls) {
    const g0 = Math.max(0, Math.floor(s[0] / NAV_CELL)), g1 = Math.min(nav.width - 1, Math.floor(s[2] / NAV_CELL));
    const h0 = Math.max(0, Math.floor(s[1] / NAV_CELL)), h1 = Math.min(nav.height - 1, Math.floor(s[3] / NAV_CELL));
    for (let gy = h0; gy <= h1; gy++) for (let gx = g0; gx <= g1; gx++) { const i = gy * nav.width + gx; if (nav.grid[i]) { nav.grid[i] = 0; n++; } }
  }
  return n;
}
