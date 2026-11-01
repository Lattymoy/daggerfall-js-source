// @ts-check
// A SETTLEMENT IS A PLAN, AND RMB IS ONE SOURCE OF ITS
// BUILDINGS. A plan is metres: a footprint, flat pads at their own heights (terraces), links between them, streets,
// districts and buildings. A building keeps the identity every table keys on - its place's map id and a building key -
// and a key minted for a new building lies in a band no RMB key reaches, so nothing decodes it into a block cell.
// Pure: the generator, the publication and every tool check a plan by it. Not a DFU member (DFU's towns are RMB grids).
import { HOME_KEY_MAX, homeBuildingKeyOk } from '../../net/homeLaw.js';
import { worldPixelOk } from '../../net/wire.js';
import { fnv1a } from '../../formats/fnv1a.js';
import { dsin, dcos, dhypot } from './exactMath.js';
import { ringOk, ringWithin, ringsOverlap, inOrOn, pointInRing, edgeDistance, ringArea2, padAt, padFinder, distanceToSegment, segmentGap, segmentRingDistance } from './settlementGeometry.js';
export { padAt };

/** Raised when the plan's shape changes, so a reader can refuse a plan it does not know. */
export const SETTLEMENT_CONTRACT_VERSION = 1;
/**
 * @typedef {readonly [number, number]} Pt - [east, north], metres from the plan's origin
 * @typedef {{ id: string, poly: Pt[], y: number, rim?: 'grade'|'wall', base?: 'cut'|'raised', legacy?: boolean }} Pad - flat ground y metres over the datum
 * @typedef {{ id: string, kind: 'grade'|'stairs'|'ramp'|'bridge', from: string, to: string, a: Pt, b: Pt, width: number }} Link
 * @typedef {{ id: string, rank: string, width: number, pad: string, path: Pt[] }} Street
 * @typedef {{ id: string, purpose: string, poly: Pt[] }} District
 * @typedef {{ id: string, pad: string, at: Pt }} Gate
 */
export const PAD_BASES = Object.freeze(['cut', 'raised']);
export const SETTLEMENT_SOURCES = Object.freeze(['legacy', 'procedural', 'authored']);
export const LINK_KINDS = Object.freeze(['grade', 'stairs', 'ramp', 'bridge']);
export const STREET_RANKS = Object.freeze(['main', 'side', 'alley', 'path']);
/**
 * @typedef {{ n: number, at: Pt, facing: number }} Entrance - facing: the way out, degrees clockwise from north
 * @typedef {{ kind: string, block?: string, record?: number, id?: number|string, style?: string, plan?: string }} Asset
 * @typedef {{ key: number, source: string, anchor: string, pad: string, at: Pt, yaw: number, lift: number,
 *   footprint: Pt[]|null, storeys: number|null, exterior: Asset, interior: Asset|null, entrances: Entrance[],
 *   type: number, factionId: number, quality: number, nameSeed: number, access: string }} Building
 */
export const ACCESS = Object.freeze(['public', 'private', 'none']);
export const EXTERIOR_KINDS = Object.freeze(['rmb', 'model', 'prefab', 'procedural']);
export const INTERIOR_KINDS = Object.freeze(['rmb', 'generated', 'prefab']);
/**
 * @typedef {{ px: number, py: number, east: number, north: number }} Origin - a world pixel's south-west corner and metres past it
 * @typedef {{ contract: number, place: number, source: string, generator: { id: string, version: number, seed: number }|null,
 *   revision: number, origin: Origin, footprint: Pt[], pads: Pad[], links: Link[], gates: Gate[], streets: Street[],
 *   districts: District[], buildings: Building[], plots?: Plot[], features?: Feature[] }} SettlementPlan
 * @typedef {{ code: string, at: string, why: string }} Problem
 */
export const FEATURE_KINDS = Object.freeze(['well', 'fountain', 'market', 'garden', 'field', 'tree', 'statue', 'wall', 'tower', 'fence', 'dock']);
/**
 * @typedef {{ id: string, pad: string, poly: Pt[], street?: string, district?: string }} Plot - a building's ground, or open land
 * @typedef {{ id: string, kind: string, pad?: string, at?: Pt, path?: Pt[], yaw?: number, size?: number, y?: number, ground?: number[] }} Feature
 */
const fin = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isFinite(v);
const ptOk = (/** @type {any} */ p) => Array.isArray(p) && p.length === 2 && fin(p[0]) && fin(p[1]);

/** Every key BuildingDirectory.MakeBuildingKey packs is under this (column << 16 | row << 8 | record, a grid of eight by
 *  eight), but its key 0, written as 1 << 24 (talkTopics.js BUILDING_KEY_0, homeLaw.js HOME_KEY_MAX). */
export const RMB_KEY_LIMIT = 0x80000;
/** The band a new building's key is minted in: past every RMB key, under BUILDING_KEY_0, so every home check takes it. */
export const MINTED_KEY_MIN = 0x800000;
export const MINTED_KEY_MAX = HOME_KEY_MAX - 1;

import { STEP_MAX, PITCH_MAX, FORT_WALL, DOCK_HALF, FEATURE_CLEAR, TREE_CLEAR, featureReach } from './settlementLimits.js';
export { STEP_MAX, PITCH_MAX };
/** How far before a door its approach is read, metres (imperialHomes.js DOOR_OUT's distance). */
export const APPROACH = 0.8;
/** How far a door may stand from its building's wall, metres. */
export const WALL_REACH = 0.25;

/** Which band a building key lies in. @param {number} key @returns {'rmb'|'minted'|'none'} */
export function keyBandOf(key) {
  if (!homeBuildingKeyOk(key)) return 'none';
  if (key < RMB_KEY_LIMIT || key === HOME_KEY_MAX) return 'rmb';
  return key >= MINTED_KEY_MIN && key <= MINTED_KEY_MAX ? 'minted' : 'none';
}

/** An RMB key's block cell and record, or null: a minted key names no cell. @param {number} key */
export function rmbPartsOfKey(key) {
  if (keyBandOf(key) !== 'rmb') return null;
  const k = key === HOME_KEY_MAX ? 0 : key;
  return { x: k >> 16, y: (k >> 8) & 0xff, record: k & 0xff };
}

/** A building's name in logs and the editor: its place and key. @param {number} place @param {number} key */
export const buildingIdText = (place, key) => `b:${place >>> 0}.${key}`;

/** The pad under a point and its height, or null off every pad. @param {SettlementPlan} plan @param {number} east @param {number} north */
export function groundAt(plan, east, north) {
  const pad = padAt(plan.pads, [east, north]);
  return pad ? { pad: pad.id, y: pad.y } : null;
}

/** A building's floor over the datum: its pad's height and its own lift. @param {SettlementPlan} plan @param {Building} b */
export function floorOf(plan, b) {
  const pad = plan.pads.find((p) => p.id === b.pad);
  return pad ? pad.y + (b.lift ?? 0) : null;
}

/** The plan's print: FNV-1a of its canonical form. Two clients on one revision compare it. @param {SettlementPlan} plan */
export function settlementPrint(plan) {
  const canon = (/** @type {any} */ v) => (Array.isArray(v) ? v.map(canon)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  return fnv1a(new TextEncoder().encode(JSON.stringify(canon(plan))));
}

/**
 * Every way the plan breaks the contract, each with a code, what it names and why; [] when it keeps it.
 * A legacy building with no footprint is its RMB record's: its walls and doors are the record's, so they are not read.
 * @param {SettlementPlan} plan @returns {Problem[]}
 */
export function validateSettlement(plan) {
  /** @type {Problem[]} */ const out = [];
  const bad = (/** @type {string} */ code, /** @type {string} */ at, /** @type {string} */ why) => out.push({ code, at, why });
  if (plan?.contract !== SETTLEMENT_CONTRACT_VERSION) {
    bad('contract', 'plan', `contract ${plan?.contract} is not ${SETTLEMENT_CONTRACT_VERSION}`);
    return out;
  }
  if (!SETTLEMENT_SOURCES.includes(plan.source)) bad('source', 'plan', `source '${plan.source}' is not one of ${SETTLEMENT_SOURCES}`);
  if (!Number.isSafeInteger(plan.place) || plan.place <= 0) bad('place', 'plan', 'place is not a map id');
  const o = plan.origin;
  if (!o || !worldPixelOk(o.px) || !worldPixelOk(o.py) || !fin(o.east) || !fin(o.north)) bad('origin', 'plan', 'origin is not a world pixel and metres past it');
  const foot = ringOk(plan.footprint) ? plan.footprint : null;
  if (!foot) bad('poly', 'plan', 'footprint is not a simple ring of three or more points');

  /** @type {Map<string, Pad>} */ const pads = new Map();
  for (const pad of plan.pads ?? []) {
    const at = `pad:${pad.id}`;
    if (pads.has(pad.id)) { bad('id-dup', at, 'two pads share this id'); continue; }
    if (!ringOk(pad.poly) || !fin(pad.y)) { bad('poly', at, 'not a simple ring at a finite height'); continue; }
    if (pad.base !== undefined && !PAD_BASES.includes(pad.base)) bad('pad', at, `base '${pad.base}' is not one of ${PAD_BASES}`);
    if (foot && !ringWithin(pad.poly, foot)) bad('outside', at, 'reaches past the footprint');
    for (const other of pads.values()) {
      if (!ringsOverlap(pad.poly, other.poly)) continue;
      const nested = Math.abs(ringArea2(pad.poly)) !== Math.abs(ringArea2(other.poly)) && (ringWithin(pad.poly, other.poly) || ringWithin(other.poly, pad.poly));
      if (!nested) bad('pad-overlap', at, `crosses pad ${other.id}'s rim: pads touch or one stands wholly inside the other`);
    }
    pads.set(pad.id, pad);
  }
  const padList = [...pads.values()];
  /** @param {Pt} p */
  const padOf = padFinder(padList);
  /** A ring on `pad` crosses no smaller pad's rim (the ground inside it would be another height). @param {Pt[]} ring @param {Pad} pad */
  const onePad = (ring, pad) => {
    const a = Math.abs(ringArea2(pad.poly));
    return ringWithin(ring, pad.poly) && !padList.some((q) => q !== pad && Math.abs(ringArea2(q.poly)) < a && ringsOverlap(ring, q.poly));
  };

  // the walk: gates are the roots, links the only ways between pads
  /** @type {Map<string, string[]>} */ const ways = new Map([...pads.keys()].map((id) => [id, []]));
  const linkIds = new Set();
  for (const l of plan.links ?? []) {
    const at = `link:${l.id}`;
    if (linkIds.has(l.id)) { bad('id-dup', at, 'two links share this id'); continue; }
    linkIds.add(l.id);
    const from = pads.get(l.from), to = pads.get(l.to);
    if (!from || !to) { bad('pad-missing', at, `joins pad '${from ? l.to : l.from}', which the plan does not have`); continue; }
    if (!LINK_KINDS.includes(l.kind) || !ptOk(l.a) || !ptOk(l.b) || !(l.width > 0)) { bad('link', at, 'needs a kind, two ends and a width'); continue; }
    if (padOf(l.a) !== from || padOf(l.b) !== to) bad('link-end', at, `its ends must stand on pads ${l.from} and ${l.to}`);
    const rise = Math.abs(to.y - from.y), run = dhypot(l.b[0] - l.a[0], l.b[1] - l.a[1]);
    if (l.kind === 'grade' ? rise > STEP_MAX : rise > PITCH_MAX[l.kind] * run) {
      bad('link-steep', at, `rises ${rise.toFixed(2)} m over ${run.toFixed(2)} m, past what a ${l.kind} allows`);
    }
    ways.get(l.from)?.push(l.to);
    ways.get(l.to)?.push(l.from);
  }
  const reached = new Set();
  const gateIds = new Set();
  for (const g of plan.gates ?? []) {
    const at = `gate:${g.id}`;
    if (gateIds.has(g.id)) { bad('id-dup', at, 'two gates share this id'); continue; }
    gateIds.add(g.id);
    if (!pads.has(g.pad) || !ptOk(g.at) || padOf(g.at) !== pads.get(g.pad)) { bad('gate', at, `does not stand on pad '${g.pad}'`); continue; }
    for (const stack = [g.pad]; stack.length;) {
      const id = /** @type {string} */ (stack.pop());
      if (reached.has(id)) continue;
      reached.add(id);
      stack.push(...(ways.get(id) ?? []));
    }
  }

  const streetIds = new Set();
  for (const s of plan.streets ?? []) {
    const at = `street:${s.id}`;
    if (streetIds.has(s.id)) { bad('id-dup', at, 'two streets share this id'); continue; }
    streetIds.add(s.id);
    const pad = pads.get(s.pad);
    if (!STREET_RANKS.includes(s.rank) || !(s.width > 0) || !Array.isArray(s.path) || s.path.length < 2 || !s.path.every(ptOk)) { bad('street', at, 'needs a rank, a width and a path of two or more points'); continue; }
    const mids = s.path.slice(1).map((p, i) => /** @type {Pt} */ ([(p[0] + s.path[i][0]) / 2, (p[1] + s.path[i][1]) / 2]));
    if (!pad || ![...s.path, ...mids].every((p) => padOf(p) === pad)) bad('street-off-pad', at, `every point must stand on pad '${s.pad}'; a change of height is a link`);
  }
  const districtIds = new Set();
  for (const d of plan.districts ?? []) {
    const at = `district:${d.id}`;
    if (districtIds.has(d.id)) bad('id-dup', at, 'two districts share this id');
    else if (!ringOk(d.poly) || typeof d.purpose !== 'string' || !d.purpose) bad('poly', at, 'needs a purpose and a simple ring');
    districtIds.add(d.id);
  }

  /** @type {Map<string, Plot>} */ const plots = new Map();
  for (const pl of plan.plots ?? []) {
    const at = `plot:${pl.id}`;
    if (plots.has(pl.id)) { bad('id-dup', at, 'two plots share this id'); continue; }
    const pad = pads.get(pl.pad);
    if (!ringOk(pl.poly)) { bad('poly', at, 'not a simple ring'); continue; }
    if (!pad) { bad('pad-missing', at, `lies on pad '${pl.pad}', which the plan does not have`); continue; }
    if (!onePad(pl.poly, pad)) bad('off-pad', at, `reaches past pad '${pl.pad}'`);
    for (const other of plots.values()) if (ringsOverlap(pl.poly, other.poly)) bad('overlap', at, `overlaps plot ${other.id}`);
    plots.set(pl.id, pl);
  }
  const featureIds = new Set();
  for (const f of plan.features ?? []) {
    const at = `feature:${f.id}`;
    if (featureIds.has(f.id)) { bad('id-dup', at, 'two features share this id'); continue; }
    featureIds.add(f.id);
    if (!FEATURE_KINDS.includes(f.kind)) { bad('feature', at, `kind '${f.kind}' is not one of ${FEATURE_KINDS}`); continue; }
    if (f.at !== undefined && (!ptOk(f.at) || (f.pad !== undefined ? padOf(f.at) !== pads.get(f.pad) : !foot || !inOrOn(f.at, foot)))) bad('feature', at, f.pad !== undefined ? `does not stand on pad '${f.pad}'` : 'stands past the footprint');
    if (f.path !== undefined && (!Array.isArray(f.path) || f.path.length < 2 || !f.path.every((p) => ptOk(p) && !!foot && inOrOn(p, foot)))) bad('feature', at, 'its path must run inside the footprint');
  }

  /** @type {Map<number, Building>} */ const keys = new Map();
  /** @type {Building[]} */ const walled = [];
  for (const b of plan.buildings ?? []) {
    const at = `building:${b.key}`;
    if (keys.has(b.key)) { bad('id-dup', at, 'two buildings share this key'); continue; }
    keys.set(b.key, b);
    const band = keyBandOf(b.key);
    if (!SETTLEMENT_SOURCES.includes(b.source)) bad('source', at, `source '${b.source}' is not one of ${SETTLEMENT_SOURCES}`);
    if (b.source === 'legacy' ? band !== 'rmb' : band !== 'minted') {
      bad('key-band', at, b.source === 'legacy' ? 'a legacy building keeps its RMB key' : `a new building's key is minted in ${MINTED_KEY_MIN}..${MINTED_KEY_MAX}`);
    }
    if (typeof b.anchor !== 'string' || !b.anchor) bad('anchor', at, 'needs an anchor: the name its key is kept by');
    if (!b.exterior || !EXTERIOR_KINDS.includes(b.exterior.kind)) bad('asset', at, `exterior kind is not one of ${EXTERIOR_KINDS}`);
    if (b.interior && !INTERIOR_KINDS.includes(b.interior.kind)) bad('asset', at, `interior kind is not one of ${INTERIOR_KINDS}`);
    if (b.exterior?.kind === 'rmb' && b.source !== 'legacy') bad('asset', at, 'only a legacy building stands as an RMB record');
    if (!ACCESS.includes(b.access)) bad('access', at, `access '${b.access}' is not one of ${ACCESS}`);
    const pad = pads.get(b.pad);
    if (!pad) { bad('pad-missing', at, `stands on pad '${b.pad}', which the plan does not have`); continue; }
    if (!ptOk(b.at) || !fin(b.yaw) || !fin(b.lift) || b.lift < 0) { bad('transform', at, 'needs a point, a yaw and a lift of 0 or more'); continue; }
    if (b.footprint == null) {
      if (b.source !== 'legacy') bad('poly', at, 'only a legacy building may leave its footprint to its record');
      else if (!inOrOn(b.at, pad.poly)) bad('off-pad', at, `stands off its pad '${b.pad}'`);
      continue;
    }
    if (!ringOk(b.footprint)) { bad('poly', at, 'footprint is not a simple ring'); continue; }
    if (foot && !ringWithin(b.footprint, foot)) bad('outside', at, 'reaches past the settlement footprint');
    if (!onePad(b.footprint, pad)) bad('off-pad', at, `reaches past pad '${b.pad}': it would float over lower ground or sink into higher`);
    for (const other of walled) if (ringsOverlap(b.footprint, /** @type {Pt[]} */ (other.footprint))) bad('overlap', at, `overlaps building ${other.key}`);
    walled.push(b);
    const plot = plots.get(b.anchor);
    if (plot && !ringWithin(b.footprint, plot.poly)) bad('off-plot', at, `reaches past its plot '${plot.id}'`);
    if (b.access === 'none') continue;
    if (!Array.isArray(b.entrances) || !b.entrances.length) { bad('no-entrance', at, `is ${b.access} but has no door`); continue; }
    const floor = pad.y + b.lift;
    for (const e of b.entrances) {
      const eat = `${at}/e${e.n}`;
      if (!ptOk(e.at) || !fin(e.facing)) { bad('entrance', eat, 'needs a point and a facing'); continue; }
      if (edgeDistance(e.at, b.footprint) > WALL_REACH) { bad('entrance-off-wall', eat, `stands more than ${WALL_REACH} m from the wall`); continue; }
      const r = (e.facing * Math.PI) / 180;
      /** @type {Pt} */ const out1 = [e.at[0] + dsin(r) * APPROACH, e.at[1] + dcos(r) * APPROACH];
      const before = pointInRing(out1, b.footprint) ? null : padOf(out1);
      if (!before || Math.abs(before.y - floor) > STEP_MAX) { bad('entrance-blocked', eat, `no ground within ${STEP_MAX} m of the floor ${APPROACH} m outside it`); continue; }
      if (!reached.has(before.id)) bad('unreachable', eat, `its pad '${before.id}' has no way from a gate`);
    }
  }
  // a feature's body keeps off every building and every way between pads: the square's feature, a market's stalls, a
  // tower, a wall's run, a dock, a tree's trunk
  const runs = (plan.links ?? []).filter((link) => ptOk(link.a) && ptOk(link.b) && fin(link.width));
  for (const feature of plan.features ?? []) {
    const at = `feature:${feature.id}`, reach = featureReach(feature);
    if ((reach > 0 || feature.kind === 'tree') && ptOk(feature.at)) {
      const room = feature.kind === 'tree' ? FEATURE_CLEAR : reach, onWay = feature.kind === 'tree' ? TREE_CLEAR : reach;
      const hit = walled.find((b) => pointInRing(feature.at, /** @type {Pt[]} */ (b.footprint)) || edgeDistance(feature.at, /** @type {Pt[]} */ (b.footprint)) < room);
      if (hit) bad('feature-blocks', at, `building ${hit.key}`);   // the code says it; the reason names what it meets
      const way = runs.find((link) => distanceToSegment(feature.at, link.a, link.b) < onWay + link.width / 2);
      if (way) bad('feature-blocks', at, `way ${way.id}`);
      // a body on its own pad, over no other's rim (a keep's mound, a terrace); one off every pad off them all
      const own = feature.pad !== undefined ? pads.get(feature.pad) : null, over = reach > 0 && padList.find((pad) => (pad === own ? edgeDistance(feature.at, pad.poly) < reach : pointInRing(feature.at, pad.poly) || edgeDistance(feature.at, pad.poly) < reach));
      if (over) bad('feature-blocks', at, `${over === own ? 'rim' : 'pad'} ${over.id}`);
    }
    const half = feature.kind === 'wall' ? FORT_WALL.thick / 2 : feature.kind === 'dock' ? DOCK_HALF : 0;
    if (!half || !Array.isArray(feature.path) || !feature.path.every(ptOk)) continue;
    for (let i = 0; i + 1 < feature.path.length; i++) {
      const [from, to] = [feature.path[i], feature.path[i + 1]];
      const hit = walled.find((b) => segmentRingDistance(from, to, /** @type {Pt[]} */ (b.footprint)) < half);
      if (hit) { bad('feature-blocks', at, `building ${hit.key}`); break; }
      const way = feature.kind === 'wall' && runs.find((link) => segmentGap(from, to, link.a, link.b) < half + link.width / 2);   // a dock leaves from its quay's street
      if (way) { bad('feature-blocks', at, `way ${way.id}`); break; }
    }
  }
  return out;
}
