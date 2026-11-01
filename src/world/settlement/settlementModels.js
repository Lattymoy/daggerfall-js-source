// @ts-check
// A DRESSED SETTLEMENT AS MODELS. Its ground: each cut
// pad paved with a retaining wall down its rim (the terrain is carved under it - settlementGround.js), each raised pad a
// deck on posts, each link a stair, ramp or bridge between its pads' heights. Its buildings: the Imperial City fabric's
// mesher (imperialFabricModels.js buildPlot) over each footprint in its style's walls and roof, its door the fabric's door
// model on its front wall, and its rooms the fabric's interior (fabricBuildingInterior) - no RMB block anywhere. Models in
// the pixel's frame (x east, y up, z north, metres): the host draws them at the pixel's translation. Pure.
import { MeshBuilder } from '../detStandIns.js';
import { buildPlot } from '../imperialFabricModels.js';
import { STOREY } from '../imperialFabric.js';
import { art, CAPITAL_ART } from '../capitalShapes.js';
import { fabricDoorModel, fabricDoorModelId, fabricDonorOf, fabricBuildingInterior, FABRIC_DONORS } from '../imperialFabricBuildings.js';
import { getStaticDoors } from '../staticDoors.js';
import { trs } from '../mat4.js';
import { hash32 } from '../blockHash.js';
import { BUILDING_TYPES as T, generateBuildingName } from '../buildingNames.js';
import { SETTLEMENT_STYLES } from './settlementStyles.js';
import { ringArea2, pointInRing } from './settlementGeometry.js';

/** The model ids of a settlement's pieces: a run of 4,096 a settlement past the Imperial City's (7,000,000 to 7,200,052). */
export const SETTLEMENT_MODEL_BASE = 7_600_000;
export const SETTLEMENT_MODEL_RUN = 4096;
/** A settlement's ground's model id, and a building's. */
export const groundModelId = (/** @type {number} */ ordinal) => SETTLEMENT_MODEL_BASE + ordinal * SETTLEMENT_MODEL_RUN;
export const buildingModelId = (/** @type {number} */ ordinal, /** @type {number} */ i) => groundModelId(ordinal) + 1 + i;
/** Its features' model id: the run's last, past every building a plan can stand (the contract's checks keep fewer). */
export const featuresModelId = (/** @type {number} */ ordinal) => groundModelId(ordinal) + SETTLEMENT_MODEL_RUN - 1;
export const isSettlementModelId = (/** @type {number} */ id) => id >= SETTLEMENT_MODEL_BASE && id < SETTLEMENT_MODEL_BASE + 512 * SETTLEMENT_MODEL_RUN;
/** How far a retaining wall reaches down from its pad, and a deck's rim, metres. */
export const WALL_DROP = 8;
export const DECK_RIM = 0.35;
/** A texture repeats this many metres. */
const TILE = 3.2;
const PAVING = art(CAPITAL_ART.bridgeStone), WALL = art(CAPITAL_ART.wallStone), PLANK = art(CAPITAL_ART.timber);

/** A simple ring's triangles by ear clipping (indices into it). @param {any} ring */
export function earClip(ring) {
  const idx = ring.map((_, i) => i);
  if (ringArea2(ring) < 0) idx.reverse();
  const out = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = idx.length * idx.length;
  while (idx.length > 3 && guard-- > 0) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const a = ring[idx[(i + idx.length - 1) % idx.length]], b = ring[idx[i]], c = ring[idx[(i + 1) % idx.length]];
      if (cross(a, b, c) <= 1e-9) continue;
      const ear = /** @type {any} */ ([a, b, c]);
      if (idx.some((j) => { const p = ring[j]; return p !== a && p !== b && p !== c && pointInRing(p, ear); })) continue;
      out.push([idx[(i + idx.length - 1) % idx.length], idx[i], idx[(i + 1) % idx.length]]);
      idx.splice(i, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

/** A wall face from a to b (plan points), from y0 up to y1, facing n. */
function wall(mb, tex, a, b, y0, y1, n) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  mb.quad(tex, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [n[0], 0, n[1]], [[0, y0 / TILE], [len / TILE, y0 / TILE], [len / TILE, y1 / TILE], [0, y1 / TILE]]);
}
/** The outward normal of a ring's edge from i to i + 1 (plan frame). */
function outward(ring, i) {
  const a = ring[i], b = ring[(i + 1) % ring.length], s = Math.sign(ringArea2(ring)) || 1, len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [((b[1] - a[1]) / len) * s, (-(b[0] - a[0]) / len) * s];
}

/**
 * The ground's model: paving and retaining walls, decks and posts, stairs, ramps and bridges.
 * @param {import('./settlementContract.js').SettlementPlan} plan @param {number} datum @param {Map<string, { natural: number }>} cells
 * @param {string} [style] its style's key: its terraces' paving (settlementStyles.js `ground`)
 */
export function groundModel(plan, datum, cells, style = 'IliacBay') {
  const mb = new MeshBuilder(), Y = new Map(plan.pads.map((p) => [p.id, datum + p.y]));
  const ground = art(CAPITAL_ART[SETTLEMENT_STYLES[style]?.ground] ?? CAPITAL_ART.bridgeStone);   // its style's paving
  for (const pad of plan.pads) {
    if (pad.legacy) continue;   // A core's ground is its town's own tiles
    const y = /** @type {number} */ (Y.get(pad.id)), raised = pad.base === 'raised', top = raised ? PLANK : ground;
    for (const [i, j, k] of earClip(pad.poly)) {
      const p = [pad.poly[i], pad.poly[j], pad.poly[k]];
      mb.tri(top, [p[0][0], y, p[0][1]], [p[1][0], y, p[1][1]], [p[2][0], y, p[2][1]], [0, 1, 0], [p[0][0] / TILE, p[0][1] / TILE], [p[1][0] / TILE, p[1][1] / TILE], [p[2][0] / TILE, p[2][1] / TILE]);
    }
    const low = raised ? y - DECK_RIM : y - WALL_DROP;
    pad.poly.forEach((a, i) => wall(mb, raised ? PLANK : WALL, a, pad.poly[(i + 1) % pad.poly.length], low, y, outward(pad.poly, i)));
    if (raised) {
      const foot = datum + (cells.get(pad.id)?.natural ?? y - datum) - 1;
      pad.poly.forEach((p, i) => { if (i % 3 === 0) mb.box(PLANK, [p[0], (foot + y) / 2, p[1]], [0.3, Math.max(0.5, y - foot), 0.3], 1); });
    }
  }
  for (const l of plan.links) {
    const ya = /** @type {number} */ (Y.get(l.from)), yb = /** @type {number} */ (Y.get(l.to));
    const dx = l.b[0] - l.a[0], dz = l.b[1] - l.a[1], len = Math.hypot(dx, dz) || 1, s = [(-dz / len) * l.width / 2, (dx / len) * l.width / 2];
    const tex = l.kind === 'bridge' ? PLANK : PAVING;
    if (l.kind === 'stairs') { flight(mb, l, ya, yb, dx / len, dz / len, len, s); continue; }
    const p = [[l.a[0] - s[0], ya, l.a[1] - s[1]], [l.a[0] + s[0], ya, l.a[1] + s[1]], [l.b[0] + s[0], yb, l.b[1] + s[1]], [l.b[0] - s[0], yb, l.b[1] - s[1]]];
    const up = [-(dx / len) * (yb - ya), len, -(dz / len) * (yb - ya)], m = Math.hypot(...up);
    mb.quad(tex, p[0], p[1], p[2], p[3], [up[0] / m, up[1] / m, up[2] / m], [[0, 0], [l.width / TILE, 0], [l.width / TILE, len / TILE], [0, len / TILE]]);
    for (const [q0, q1, sign] of /** @type {Array<[number[], number[], number]>} */ ([[p[0], p[3], -1], [p[1], p[2], 1]])) {
      const n = [sign * s[0], sign * s[1]], nl = Math.hypot(n[0], n[1]) || 1;
      mb.quad(tex, q0, q1, [q1[0], q1[1] - 1, q1[2]], [q0[0], q0[1] - 1, q0[2]], [n[0] / nl, 0, n[1] / nl]);
    }
  }
  return mb.build();
}

/** A stair's most rise a step, metres: well under the walker's step (its collider's stepOffset, 0.5). */
export const FLIGHT_STEP = 0.18;
/**
 * A stair as its steps: from its lower pad's end a riser and a tread at a time, each tread level, each riser facing down
 * the flight, each step's sides skirted below it. @param {any} mesh @param {any} link @param {number} fromY @param {number} toY
 * @param {number} dirE @param {number} dirN @param {number} len @param {number[]} side half its width across, east and north
 */
function flight(mesh, link, fromY, toY, dirE, dirN, len, side) {
  const steps = Math.max(2, Math.ceil(Math.abs(toY - fromY) / FLIGHT_STEP)), rise = (toY - fromY) / steps, facing = rise > 0 ? -1 : 1;
  const at = (/** @type {number} */ share, /** @type {number} */ height, /** @type {number} */ across) => [link.a[0] + dirE * len * share + side[0] * across, height, link.a[1] + dirN * len * share + side[1] * across];
  const wide = link.width / TILE, tread = len / steps, sideLen = Math.hypot(side[0], side[1]) || 1;
  for (let i = 0; i < steps; i++) {
    const from = i / steps, to = (i + 1) / steps, below = fromY + i * rise, top = fromY + (i + 1) * rise;
    mesh.quad(PAVING, at(from, top, -1), at(from, top, 1), at(to, top, 1), at(to, top, -1), [0, 1, 0], [[0, 0], [wide, 0], [wide, tread / TILE], [0, tread / TILE]]);
    mesh.quad(PAVING, at(from, below, -1), at(from, below, 1), at(from, top, 1), at(from, top, -1), [dirE * facing, 0, dirN * facing], [[0, 0], [wide, 0], [wide, Math.abs(rise) / TILE], [0, Math.abs(rise) / TILE]]);
    for (const across of [-1, 1]) mesh.quad(PAVING, at(from, top, across), at(to, top, across), at(to, top - 1 - Math.abs(rise), across), at(from, top - 1 - Math.abs(rise), across), [(side[0] / sideLen) * across, 0, (side[1] / sideLen) * across]);
  }
}

/** The fabric's pool and donor for a building's type (its rooms and its keeper): the first donor of the type, a house's else. */
export function interiorPoolOf(type) {
  const d = FABRIC_DONORS.find((x) => x.type === type);
  return d ? d.pool : type === T.Palace ? 'house4' : 'house1';
}

/**
 * A building's model, frame and door: its walls and roof in its style (buildPlot over its footprint, its front its street's),
 * at its floor; its door model and the door the game opens.
 * @param {import('./settlementContract.js').SettlementPlan} plan @param {import('./settlementContract.js').Building} b
 * @param {number} floor metres @param {string} style
 */
export function buildingPiece(plan, b, floor, style) {
  const st = SETTLEMENT_STYLES[style] ?? SETTLEMENT_STYLES.IliacBay;
  const [cx, cn] = b.at, fp = /** @type {any} */ (b.footprint);
  const q = fp.map(([e, n]) => [e - cx, -(n - cn)]);   // buildPlot's frame: x east, z south, about its middle
  const h = (b.storeys ?? 1) * STOREY;
  const front = Math.hypot(fp[1][0] - fp[0][0], fp[1][1] - fp[0][1]), deep = Math.hypot(fp[3][0] - fp[0][0], fp[3][1] - fp[0][1]);
  const flat = st.pitch <= 0;
  const across = Math.min(front, deep), roof = flat ? 'flat' : front >= deep ? 'gableS' : 'gableT';
  const shop = b.type !== T.House1 && b.type !== T.House2 && b.type !== T.House3 && b.type !== T.House4;
  const plot = {
    q, out: 1, sw: [4, 0, 0, 0], h, roof, ridge: flat ? h : h + (across / 2) * Math.tan((st.pitch * Math.PI) / 180), wall: st.wall,
    ground: shop ? 'groundShop' : st.wall, roofTex: st.roofArt, ledge: false, balcony: 0, tower: false, key: b.key,
  };
  const mb = new MeshBuilder();
  buildPlot(mb, plot);
  const pool = interiorPoolOf(b.type), area = Math.abs(ringArea2(fp)) / 2, donor = fabricDonorOf(pool, b.key, area);
  const e = b.entrances[0], ry = e.facing + 180;   // the door model faces south at its origin: turned to face out
  const doorFrame = trs(e.at[0], floor, e.at[1], 0, ry, 0);
  const doorModel = fabricDoorModel(fabricDoorModelId(donor));
  return {
    model: mb.build(), frame: trs(cx, floor, cn, 0, 0, 0), doorId: fabricDoorModelId(donor), doorModel, doorFrame,
    doors: doorModel ? getStaticDoors(doorModel, -1, 0, doorFrame) : null, pool, donor, area,
    plot: { q: fp.map(([pe, pn]) => [pe, -pn]), h }, door: { at: [e.at[0], -e.at[1]], n: [Math.sin((e.facing * Math.PI) / 180), -Math.cos((e.facing * Math.PI) / 180)] },
  };
}

/** A building's rooms: the fabric's interior over its footprint and door, filed under its own place and key.
 *  @param {number} place @param {import('./settlementContract.js').Building} b @param {ReturnType<typeof buildingPiece>} piece @param {any} blocksFile */
export function buildingInterior(place, b, piece, blocksFile) {
  return fabricBuildingInterior({ key: hash32(place >>> 0, b.key), cacheKey: `settlement:${place >>> 0}.${b.key}`, pool: piece.pool, donor: piece.donor, party: 0, plot: piece.plot, door: piece.door }, blocksFile);
}

/** A building as the game's doors, shops and talk read it (systems/talk/talkTopics.js buildingDataForDoor's shape).
 *  @param {{ place: number, name: string, regionIndex: number, blocks?: number }} town @param {import('./settlementContract.js').Building} b @param {number} area */
export function buildingRecord(town, b, area) {
  return Object.freeze({
    buildingType: b.type, factionId: b.factionId, quality: b.quality, nameSeed: b.nameSeed, buildingKey: b.key, hasInterior: true,
    footprintM2: Math.round(area), regionIndex: town.regionIndex, townMapId: town.place >>> 0, townBlocks: town.blocks ?? 1, townName: town.name,
    name: generateBuildingName(b.nameSeed, b.type, { locationName: town.name, factionId: b.factionId }), settlement: true,
  });
}
