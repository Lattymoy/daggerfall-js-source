// @ts-check
// WG2-TOWNS (bible/03-World/World-2-Canon.md, "Buildings and settlements"): A WORLD 2.0 TOWN'S BLOCKS - one a cell of its
// pixel's 8 x 8 grid, made when first read (a family on the world-data door, formats/worldData/worldDataReplacement.js
// registerPortBlockFamily). Each building is the subrecord its slot names - its shell (settle2Shell.js) and Daggerfall's
// door (world/imperialFabricBuildings.js fabricDoorModel) laid with its door at its record's door, facing its way - and the
// record the game reads (its type, quality, faction and name seed). Its interior is made from Daggerfall's own kit to its
// footprint and storeys, a donor's people stood in it (world/interior/fabricInterior.js). Roads and the plaza paint the
// ground; the town map's bytes are its buildings, and outside its footprint the walkers' grid is shut.
import { settle2TownOf, settle2BlockName, settle2BlockOf, settle2BlockIndex, settle2BlockAt, settle2Base, sceneOf } from './settle2Towns.js';
import { shellModelId } from './settle2Shell.js';
import { settle2Features, installSettle2Models } from './settle2Features.js';
import { FABRIC_DONORS, fabricDonorOf, fabricDoorModelId, installFabricDoors, automapByteOf } from '../imperialFabricBuildings.js';
import { fabricInteriorGrid, fabricInteriorPlan, fabricInteriorRecord } from '../interior/fabricInterior.js';
import { portBlockJson, startMarkerAt, CAPITAL_NO_GROUND, CAPITAL_CLOSED_BYTE } from '../tamrielCapitals.js';
import { blockFromJson, registerPortBlockFamily } from '../../formats/worldData/worldDataReplacement.js';
import { ROTATION_DIVISOR, RMB_DIMENSION } from '../../formats/blocksFile.js';
import { GLOBAL_SCALE } from '../meshReader.js';
import { hash32, BLOCK_M } from '../blockHash.js';
import { TERRAIN_SIZE } from '../terrain/terrainSampler.js';
import { PROPS_OFFSET_Y } from '../rmbLayout.js';
import { PAD_MARGIN_M as PAD_MARGIN } from '../gen2/padLaw.js';
import { GUILD_FACTION_IDS } from '../../systems/guild/guildFactions.js';

const SALT = 0x5e72, B = BLOCK_M, PX = TERRAIN_SIZE, TILE = B / 16, AUTO = B / 64;
/** Ground records: Daggerfall's stone, dirt and its farms' furrowed crop ground (the climate's own set). */
const STONE = 3, DIRT = 1, CROPS = 54;
/** Each style's look: [wall set (settle2Shell.js SHELL_WALLS), roof (0 flat, 1 gable), roof picture]. */
const STYLE_LOOK = Object.freeze({
  redguard: [0, 0, 2], khajiit: [0, 0, 2], dunmer: [0, 0, 1], nord: [0, 1, 3], breton: [1, 1, 3], imperial: [0, 1, 2],
  altmer: [0, 1, 2], argonian: [1, 1, 0], bosmer: [1, 1, 0],
});
/** The interiors' pools by role (FABRIC_DONORS'): a home's by its floor, as the fabric's (m2 under its roof). */
const ROLE_POOL = Object.freeze({ tavern: 'tavern', shop: 'general', store: 'general', temple: 'temple', smith: 'weaponsmith', bank: 'bank', guild: 'fighters', barracks: 'house1' });
const HOMES = Object.freeze([[80, 'house3'], [150, 'house2'], [240, 'house1'], [Infinity, 'house4']]);
export const settle2PoolOf = (role, area) => ROLE_POOL[role] ?? /** @type {[number, string]} */ (HOMES.find(([max]) => area < max))[1];

/**
 * A DOOR'S SUBRECORD in its block (rmbLayout.js layoutRmbBlock: T(XPos, 0, RMBDimension - ZPos) * GlobalScale, R(0,
 * -YRotation / RotationDivisor, 0)): placed at the door (`x`, `y` world pixels, its block cell's) and turned so its frame's
 * -z faces `dir` (map: x east, y south). trs turns a local (x, z) by f to (x cos f + z sin f, -x sin f + z cos f), so -z
 * goes to (-sin f, -cos f) east and north: f = atan2(-dir.x, dir.y).
 * @param {{ x: number, y: number, dir: number[] }} door @param {number} px @param {number} py @param {number} bx @param {number} by
 */
export function settle2SubRecordFrame(door, px, py, bx, by) {
  const u = (door.x - px) * PX - bx * B, v = (py + 1 - door.y) * PX - by * B;
  const f = (Math.atan2(-door.dir[0], door.dir[1]) * 180) / Math.PI;
  return { xPos: Math.round(u / GLOBAL_SCALE), zPos: Math.round(RMB_DIMENSION - v / GLOBAL_SCALE), yRotation: Math.round(-f * ROTATION_DIVISOR) };
}

/** A building's footing below its floor (metres): down to the lowest ground the stream draws under it - the region's at
 *  every node of its kernel's grid (128 a pixel) about its footprint, which the drawn ground runs between - so neither a
 *  plinth nor a terrace (its pad narrower than the grid can hold) shows a gap under its walls. */
function footOf(b, groundAt, px, py) {
  const [w, d] = b.footprint, n = b.at.dir, t = [-n[1], n[0]], xs = [], ys = [];
  for (const [s, k] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { xs.push(b.at.x + (t[0] * s * w / 2 + n[0] * k * d / 2) / PX); ys.push(b.at.y + (t[1] * s * w / 2 + n[1] * k * d / 2) / PX); }
  let low = Infinity;
  for (let i = Math.floor((Math.min(...xs) - px) * 128); i <= Math.ceil((Math.max(...xs) - px) * 128); i++) {
    for (let j = Math.floor((py + 1 - Math.max(...ys)) * 128); j <= Math.ceil((py + 1 - Math.min(...ys)) * 128); j++) {
      const g = groundAt(px + i / 128, py + 1 - j / 128);
      if (Number.isFinite(g) && g < low) low = g;
    }
  }
  return Math.max(0.5, Number.isFinite(low) ? b.at.z - low + 0.3 : 0.5);
}

/**
 * A BUILDING AS ITS BLOCK HOLDS IT: its record (type, quality, faction, name seed), its interior's pool, donor and seed, its
 * shell's id, its door's subrecord frame and its models' height over the location's plane (YPos). The seed is its town's
 * ordinal and its slot, so it is the same building on every client.
 * @param {{ town: any, region: any, px: number, py: number }} at @param {any} b
 */
export function settle2Record(at, b) {
  const { town, px, py } = at, [bx, by, rec] = b.slot, [w, d] = b.footprint, area = w * d;
  const key = hash32(SALT, town.ordinal, bx, by, rec), pool = settle2PoolOf(b.role, area), donor = fabricDonorOf(pool, key, area);
  const look = STYLE_LOOK[town.style] ?? STYLE_LOOK.imperial, wall = b.role === 'tavern' ? 2 : b.role === 'temple' ? 3 : look[0];
  const stilts = b.ground?.kind === 'stilts', foot = stilts ? 0 : footOf(b, (x, y) => at.region.heightAt(x, y), px, py);   // a stilt house's legs its platform's
  const shell = shellModelId({ w, d, storeys: Math.max(1, b.storeys | 0), roof: look[1], wall, roofRec: look[2], foot, stilts });
  const door = b.doors[0] ?? { x: b.at.x + (b.at.dir[0] * d) / 2 / PX, y: b.at.y + (b.at.dir[1] * d) / 2 / PX, z: b.at.z, dir: b.at.dir };
  const factionId = b.role === 'temple' ? FABRIC_DONORS[donor].faction : b.role === 'guild' ? GUILD_FACTION_IDS.FightersGuild : 0;
  return Object.freeze({
    id: b.id, slot: b.slot, type: b.type, role: b.role, w, d, storeys: Math.max(1, b.storeys | 0), key, pool, donor, shell, factionId,
    quality: 6 + (hash32(SALT, key, 2) % 9), nameSeed: (hash32(SALT, key, 3) % 65535) + 1, door,
    frame: settle2SubRecordFrame(door, px, py, bx, by), yPos: -Math.round((sceneOf(door.z) - settle2Base(town)) / GLOBAL_SCALE),
  });
}

/** A town's buildings' records (settle2Record's), in its buildings' order - made once. @param {{ town: any, region: any, px: number, py: number }} at */
export const settle2TownRecords = (at) => townPlan(at).records;
/** Pixel-local metres (x east, z north from the pixel's south-west) of a world point. */
const localOf = (px, py, x, y) => [(x - px) * PX, (py + 1 - y) * PX];
const _plans = new WeakMap();
/** A town's plan, made once: its buildings' records and footprints, its roads' segments and its outline, pixel-local. */
function townPlan(at) {
  let plan = _plans.get(at.town);
  if (plan) return plan;
  const { town, px, py } = at, L = (x, y) => localOf(px, py, x, y), raised = town.style === 'argonian' || town.style === 'bosmer';
  const records = town.buildings.map((b) => settle2Record(at, b));
  const rects = town.buildings.map((b, i) => {
    const c = L(b.at.x, b.at.y), n = [b.at.dir[0], -b.at.dir[1]];
    return { c, n, t: [-n[1], n[0]], hw: b.footprint[0] / 2, hd: b.footprint[1] / 2, byte: automapByteOf(records[i].type) };
  });
  const segs = [];
  for (const r of town.roads) {
    const rec = raised || r.kind === 'lane' ? DIRT : STONE, half = r.width / 2 + TILE / 4;
    for (let i = 0; i + 1 < r.pts.length; i++) segs.push({ a: L(r.pts[i][0], r.pts[i][1]), b: L(r.pts[i + 1][0], r.pts[i + 1][1]), half, rec });
  }
  // its start markers: on its plaza and in from each way in, each the first spot on the way clear of every building (a
  // stilt house's deck with it) and of the water, at the region's ground over the plane - an arrival's floor its own
  const base = settle2Base(town), ground = (x, y) => sceneOf(at.region.heightAt(x, y)) - base;
  const ways = [[[town.plaza.x, town.plaza.y], [1, 0], town.plaza.r / 3], ...town.entrances.map((e) => [e.at, [-e.dir[0], -e.dir[1]], 6])];
  const markers = ways.map(([p, d, m0]) => clearSpot(at, p, d, m0)).filter(Boolean).map(([x, y]) => [...L(x, y), ground(x, y)]);
  // its features (settle2Features.js) - each a misc model at its anchor - its fields' crop ground, and the walkers kept off
  // a terrace's edge (but at its stair) and off the well and the stalls
  const feats = settle2Features(town, (x, y) => at.region.heightAt(x, y), (x, y) => at.region.waterAt(x, y));
  const features = feats.placed.map((f) => ({ ...f, c: L(f.at[0], f.at[1]), h: sceneOf(f.z) - base }));
  const fields = feats.fields.map(([x0, y0, x1, y1]) => [...L(x0, y1), ...L(x1, y0)]);
  for (const f of features) rects.push(...closedAt(f, town.buildings.find((b) => b.at.x === f.at[0] && b.at.y === f.at[1])));
  plan = { records, rects, segs, markers, features, fields, outline: town.footprint.map(([x, y]) => L(x, y)), plaza: { c: L(town.plaza.x, town.plaza.y), r: town.plaza.r }, raised };
  _plans.set(at.town, plan);
  return plan;
}
/** The first spot from `p` along `d` (map), `m0` metres on and then every two to forty, that stands clear of every
 *  building by a stride and a half (a stilt house's deck out before its door with it) and over no water; or null. */
function clearSpot(at, p, d, m0) {
  const near = (x, y) => at.town.buildings.some((b) => {
    const dx = (x - b.at.x) * PX, dy = (y - b.at.y) * PX, n = b.at.dir, deck = b.ground?.kind === 'stilts' ? 1.2 : 0;
    return Math.abs(dx * -n[1] + dy * n[0]) < b.footprint[0] / 2 + 1.5 && Math.abs(dx * n[0] + dy * n[1]) < b.footprint[1] / 2 + 1.5 + deck;
  });
  for (let m = m0; m <= 40; m += 2) {
    const x = p[0] + (d[0] * m) / PX, y = p[1] + (d[1] * m) / PX;
    if (!near(x, y) && !at.region.waterAt(x, y)) return [x, y];
  }
  return null;
}
/** The walkers' grid shut under a feature (the town map's closed byte): a terrace's ring but its stair's gap, a well, a stall.
 *  A ring's band is a cell's half-diagonal either side of its line, so every cell the line crosses is shut (a cell is read
 *  at its middle) and no walker slips a diagonal gap. */
function closedAt(f, b) {
  const n = [f.dir[0], -f.dir[1]], t = [-n[1], n[0]], C = CAPITAL_CLOSED_BYTE, band = AUTO * Math.SQRT1_2, r = (c, hw, hd) => ({ c, n, t, hw, hd, byte: C });
  const off = (c, a, k) => [c[0] + a[0] * k, c[1] + a[1] * k];
  if (f.kind === 'well') return [r(f.c, 1.3, 1.3)];
  if (f.kind === 'stall') return [r(off(f.c, n, -0.4), 1.4, 1.2)];
  if (f.kind !== 'retaining' || !b) return [];
  const hw = b.footprint[0] / 2 + PAD_MARGIN, hd = b.footprint[1] / 2 + PAD_MARGIN, g = 1.2;
  return [r(off(f.c, n, -hd), hw + band, band), r(off(f.c, t, hw), band, hd), r(off(f.c, t, -hw), band, hd),
    r(off(off(f.c, n, hd), t, (hw + g) / 2), (hw - g) / 2, band), r(off(off(f.c, n, hd), t, -(hw + g) / 2), (hw - g) / 2, band)];
}
const segD2 = (s, x, z) => {
  const vx = s.b[0] - s.a[0], vz = s.b[1] - s.a[1], l = vx * vx + vz * vz;
  let t = l > 0 ? ((x - s.a[0]) * vx + (z - s.a[1]) * vz) / l : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - s.a[0] - vx * t, dz = z - s.a[1] - vz * t;
  return dx * dx + dz * dz;
};
/** Which of a row of `n` cells (side `side`, the first's middle at x0 + side / 2) at height z lie inside a polygon: its
 *  edges' crossings of the row, even-odd. */
function rowInside(poly, z, x0, side, n, out, at) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]));
  }
  xs.sort((p, q) => p - q);
  for (let k = 0; k < n; k++) {
    const x = x0 + (k + 0.5) * side;
    let c = 0;
    while (c < xs.length && xs[c] <= x) c++;
    out[at + k] = c & 1;
  }
}
const inRect = (r, x, z) => { const dx = x - r.c[0], dz = z - r.c[1]; return Math.abs(dx * r.t[0] + dz * r.t[1]) <= r.hw && Math.abs(dx * r.n[0] + dz * r.n[1]) <= r.hd; };

const EMPTY_DATA = Object.freeze({ Header: Object.freeze({ Num3dObjectRecords: 0, NumFlatObjectRecords: 0, NumSection3Records: 0, NumPeopleRecords: 0, NumDoorRecords: 0 }), Block3dObjectRecords: [], BlockFlatObjectRecords: [], BlockSection3Records: [], BlockPeopleRecords: [], BlockDoorRecords: [] });
const model = (id, yPos) => ({ ModelId: String(id), ModelIdNum: id, ObjectType: 0, XPos: 0, YPos: yPos, ZPos: 0, XRotation: 0, YRotation: 0, ZRotation: 0 });
/** A feature as its block's misc model (rmbLayout.js miscModelMatrix: x, (-y + PROPS_OFFSET_Y), z + RMBDimension), turned as a
 *  subrecord is (settle2SubRecordFrame's law). */
function miscAt(f, ox, oz) {
  const yRotation = Math.round(((Math.atan2(-f.dir[0], f.dir[1]) * 180) / Math.PI) * -ROTATION_DIVISOR);
  return { ModelId: String(f.id), ModelIdNum: f.id, ObjectType: 0, XPos: Math.round((f.c[0] - ox) / GLOBAL_SCALE), YPos: -Math.round(f.h / GLOBAL_SCALE) + PROPS_OFFSET_Y,
    ZPos: Math.round((f.c[1] - oz) / GLOBAL_SCALE) - RMB_DIMENSION, XRotation: 0, YRotation: yRotation, ZRotation: 0 };
}

/**
 * A TOWN'S BLOCK AT CELL (bx, by) as the world-data door's JSON: its ground (its roads and its plaza, the land's own
 * elsewhere), its town map (its buildings' bytes, shut outside its outline), its start markers, and a subrecord and a
 * record for each building whose slot is this cell - at its slot's record, a gap an empty one.
 * @param {{ town: any, region: any, px: number, py: number }} at @param {number} bx @param {number} by
 */
export function settle2BlockJson(at, bx, by) {
  const plan = townPlan(at), ox = bx * B, oz = by * B, x0 = ox - 40, x1 = ox + B + 40, z0 = oz - 40, z1 = oz + B + 40;
  const segs = plan.segs.filter((s) => Math.max(s.a[0], s.b[0]) + s.half > x0 && Math.min(s.a[0], s.b[0]) - s.half < x1 && Math.max(s.a[1], s.b[1]) + s.half > z0 && Math.min(s.a[1], s.b[1]) - s.half < z1);
  const rects = plan.rects.filter((r) => r.c[0] > x0 && r.c[0] < x1 && r.c[1] > z0 && r.c[1] < z1);
  // the ground a tile (by its middle; rows from the south) and the outline an automap cell, worked a row at a time
  const tiles = new Uint8Array(256).fill(CAPITAL_NO_GROUND), inside = new Uint8Array(64 * 64), pr2 = plan.plaza.r * plan.plaza.r;
  for (let tz = 0; tz < 16; tz++) for (let tx = 0; tx < 16; tx++) {
    const X = ox + (tx + 0.5) * TILE, Z = oz + (tz + 0.5) * TILE, px = X - plan.plaza.c[0], pz = Z - plan.plaza.c[1];
    if (px * px + pz * pz <= pr2) { tiles[tz * 16 + tx] = plan.raised ? DIRT : STONE; continue; }
    for (const s of segs) if (segD2(s, X, Z) <= s.half * s.half) { tiles[tz * 16 + tx] = s.rec; break; }
    if (tiles[tz * 16 + tx] === CAPITAL_NO_GROUND && plan.fields.some(([x0, z0, x1, z1]) => X >= x0 && X < x1 && Z >= z0 && Z < z1)) tiles[tz * 16 + tx] = CROPS;
  }
  for (let az = 0; az < 64; az++) rowInside(plan.outline, oz + (az + 0.5) * AUTO, ox, AUTO, 64, inside, az * 64);
  const tile = (x, z) => tiles[Math.floor(z / TILE) * 16 + Math.floor(x / TILE)];
  const closed = (x, z) => !inside[Math.floor(z / AUTO) * 64 + Math.floor(x / AUTO)];
  const flats = plan.markers.filter(([x, z]) => x >= ox && x < ox + B && z >= oz && z < oz + B).map(([x, z, h]) => startMarkerAt(x - ox, z - oz, h));
  const models = plan.features.filter(({ c }) => c[0] >= ox && c[0] < ox + B && c[1] >= oz && c[1] < oz + B).map((f) => miscAt(f, ox, oz));
  const json = portBlockJson(settle2BlockName(at.town.ordinal, bx, by), { tile, closed, flats, models });
  const auto = json.RmbBlock.FldHeader.AutoMapData;
  for (let ay = 0; ay < 64; ay++) for (let ax = 0; ax < 64; ax++) {
    const X = ox + (ax + 0.5) * AUTO, Z = oz + (63 - ay + 0.5) * AUTO, r = rects.find((q) => inRect(q, X, Z));
    if (r) auto[ay * 64 + ax] = r.byte;
  }
  const here = plan.records.filter((r) => r.slot[0] === bx && r.slot[1] === by);
  const n = here.reduce((m, r) => Math.max(m, r.slot[2] + 1), 0), list = [], subs = [];
  for (let i = 0; i < n; i++) {
    const r = here.find((q) => q.slot[2] === i);
    list.push({ NameSeed: r?.nameSeed ?? 0, FactionId: r?.factionId ?? 0, Sector: by * 8 + bx, LocationId: 0, BuildingType: r ? r.type : -1, Quality: r?.quality ?? 0 });
    const exterior = r ? { ...EMPTY_DATA, Header: { ...EMPTY_DATA.Header, Num3dObjectRecords: 2 }, Block3dObjectRecords: [model(r.shell, r.yPos), model(fabricDoorModelId(r.donor), r.yPos)] } : EMPTY_DATA;
    subs.push({ XPos: r?.frame.xPos ?? 0, ZPos: r?.frame.zPos ?? 0, YRotation: r?.frame.yRotation ?? 0, Exterior: exterior, Interior: EMPTY_DATA });
  }
  json.RmbBlock.FldHeader.BuildingDataList = list;
  json.RmbBlock.SubRecords = subs;
  return { json, records: Array.from({ length: n }, (_, i) => here.find((q) => q.slot[2] === i) ?? null) };
}

/** The records a made interior makes when one of them is first read (world/imperialFabricBuildings.js's). */
const MADE_RECORDS = Object.freeze(['header', 'block3dObjectRecords', 'blockFlatObjectRecords', 'blockSection3Records', 'blockPeopleRecords', 'blockDoorRecords']);
const NO_FILE = Object.freeze({});
let _casts = new WeakMap(), _made = new WeakMap();
const MADE_KEEP = 512;
/** A donor's interior from the player's BLOCKS.BSA, read once a file: the cast a building's own interior takes. */
function castOf(blocksFile, d) {
  if (!blocksFile) return null;
  let m = _casts.get(blocksFile);
  if (!m) _casts.set(blocksFile, (m = new Map()));
  const k = `${d.block}#${d.record}`;
  if (!m.has(k)) m.set(k, blocksFile.getBlockByName?.(d.block)?.rmbBlock?.subRecords?.[d.record]?.interior ?? null);
  return m.get(k);
}
/** A building's interior plan: its footprint's grid in its door's frame (the frame its subrecord stands it in), its pool,
 *  its storeys and its seed. @param {{ w: number, d: number, key: number, pool: string, storeys: number }} r */
export function settle2InteriorPlan(r) {
  const q = [[-r.w / 2, 0], [r.w / 2, 0], [r.w / 2, r.d], [-r.w / 2, r.d]], grid = fabricInteriorGrid(q, [0, 0], [0, -1], 0);
  return fabricInteriorPlan({ key: r.key, pool: r.pool, cells: grid.cells, blind: grid.blind, storeys: r.storeys });
}
/**
 * A BUILDING'S OWN INTERIOR: a MADE interior (world/interior/interiorLayout.js interiorCast) whose records are made when one
 * is first read, `cast` its donor's. The same object for the same building and BLOCKS.BSA while kept (an LRU by its id -
 * the fabric's own keeps by a plot's key, which a town's building does not have).
 * @param {any} r settle2Record's @param {any} blocksFile
 */
export function settle2Interior(r, blocksFile) {
  const host = blocksFile ?? NO_FILE;
  let byId = _made.get(host);
  if (!byId) _made.set(host, (byId = new Map()));
  let out = byId.get(r.id);
  if (out) { byId.delete(r.id); byId.set(r.id, out); return out; }
  const cast = castOf(blocksFile, FABRIC_DONORS[r.donor]);
  /** @type {any} */
  let made = null;
  const record = () => (made ??= fabricInteriorRecord(settle2InteriorPlan(r), cast));
  out = { made: true, cast };
  for (const k of MADE_RECORDS) Object.defineProperty(out, k, { get: () => record()[k], enumerable: true });
  out = Object.freeze(out);
  byId.set(r.id, out);
  if (byId.size > MADE_KEEP) byId.delete(byId.keys().next().value);
  return out;
}

/** A town's block of a name, read as the door reads every block, each building's interior its own; null for none of ours or
 *  a town not installed. @param {string} name @param {any} blocksFile */
export function settle2Block(name, blocksFile) {
  const c = settle2BlockOf(name), at = c ? settle2TownOf(c.ordinal) : null;
  if (!c || !at) return null;
  const { json, records } = settle2BlockJson(at, c.bx, c.by);
  const block = blockFromJson(json, settle2BlockIndex(c.ordinal, c.bx, c.by));
  block.rmbBlock.subRecords.forEach((sub, i) => {
    const r = records[i];
    if (!r) return;
    Object.defineProperty(sub, 'interior', { get: () => settle2Interior(r, blocksFile), enumerable: true, configurable: true });
    sub.footprintM2 = r.w * r.d;   // IC-HOMES: its ground, m2 - a house's price (net/onlineHomes.js)
  });
  block.ownNamedBuildings = true;
  return block;
}

/** The family's laws: a name's index (an installed town's alone) and an index's name. */
export const settle2FamilyIndexOf = (name) => { const c = settle2BlockOf(name); return c && settle2TownOf(c.ordinal) ? settle2BlockIndex(c.ordinal, c.bx, c.by) : -1; };
export const settle2FamilyNameOf = (index) => { const c = settle2BlockAt(index); return c && settle2TownOf(c.ordinal) ? settle2BlockName(c.ordinal, c.bx, c.by) : null; };
let _installed = false;
/** The towns' blocks, shells and doors on their doors, once (before the first build reads a town). */
export function installSettle2() {
  if (_installed) return;
  _installed = true;
  installSettle2Models();
  installFabricDoors();
  registerPortBlockFamily({ indexOf: settle2FamilyIndexOf, nameOf: settle2FamilyNameOf, make: settle2Block, keep: 192 });
}
/** Test seam: install again (after the door's reset), the interiors made again. */
export function _resetSettle2() { _installed = false; _casts = new WeakMap(); _made = new WeakMap(); }
