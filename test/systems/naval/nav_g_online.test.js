// NAV-G (2026-09-28, Mac: "directly integrate into online mode") - ONLINE: one player stands the sea for everyone
// near and says it in `nv` on their own foes frame - the ships, the last volleys and the barrels - which every other
// client lands through one door; a blow on another's ship is a directed hit frame its stander lands; the other players'
// boats at their helms are the sea's contacts too (bible/03-World/Naval-Combat.md NAV-G).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  NAVAL_WIRE_SHIPS, NAVAL_WIRE_VOLLEYS, NAVAL_WIRE_BARRELS, NAVAL_HIT_MAX, WIRE_STATES, SIDE_CODES, NAVAL_GEN_MAX, NAVAL_VOLLEY_KEEP_MS, TRAFFIC_DEFAULT, NAVAL_WIRE_CASKS,
  navalWireRecord, validNavalRecord, navalRecordKey, navalHitData, validNavalHit,
} from '../../../src/systems/naval/navalWire.js';
import { SHIP_CLASSES, classById } from '../../../src/systems/naval/navalShips.js';
import { LOT_KEYS } from '../../../src/systems/naval/navalPlunder.js';
import { HULL_VARIANT_COUNTS, Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { POSE_BOUND, POSE_Y_BOUND } from '../../../src/net/wire.js';
import { createComeSailAwayPool } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createComeSailAwayPeers } from '../../../src/scenes/comeSailAway/comeSailAwayPeers.js';

const src = (p) => readFileSync(new URL(`../../../src/${p}`, import.meta.url), 'utf8');

const ship = (o = {}) => ({ n: 3, classId: 'pirateBrig', variant: 0, pos: [100.123, 0, -50.456], yaw: 1.234567, speed: 3.456, sails: 0.8, hull: 0.4567, sail: 1, crew: 0.9, state: 'afloat', heel: 2.34, seed: 0xdeadbeef, fire: true, gen: 2, region: 23, ...o });
const volley = (o = {}) => ({ id: 77, shooter: 3, hull: 2, side: 'port', pos: [1, 2, 3], yaw: -0.5, vel: [1.234, 0, -2.345], elevation: 0.1234567, seed: 99, skill: 0.55, ...o });

// ── the word ────────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-G my word: each ship I stand in the wire frame\'s natives, rounded as a cell object\'s are - her class by its row, her shares as whole percents, her state by its code, and (AUDIT NAV1, online) her handover\'s count and the region her names were drawn in - the volleys\' lays and seeds, the barrels; at most the caps; nothing to say, null; a moved ship a new key (mutants: toWire skipped, the caps, a class by name, the count unbounded, a region past the map)', () => {
  const toWire = (p) => [p[0] + 1000, p[1] - 5, p[2] + 2000];
  const rec = navalWireRecord({ ships: [ship()], volleys: [volley()], barrels: [{ id: 5, pos: [7, 8, 9] }] }, toWire);
  const cls = SHIP_CLASSES.findIndex((c) => c.id === 'pirateBrig');
  assert.deepEqual(rec.s, [[3, cls, 0, 1100.12, -5, 1949.54, 1.2346, 3.46, 0.8, 46, 100, 90, 0, 2.3, 0xdeadbeef, 1, 0, 2, 23]]);
  assert.deepEqual(navalWireRecord({ ships: [ship({ gen: 999, region: 999 })] }).s[0].slice(17), [NAVAL_GEN_MAX, -1], 'the count at its ceiling, a region past the map none');
  assert.deepEqual(navalWireRecord({ ships: [ship({ gen: undefined, region: undefined })] }).s[0].slice(17), [0, -1]);
  assert.equal(navalWireRecord({ ships: [ship({ runOut: 0b0101 })] }).s[0][16], 0b0101, 'AUDIT NAV1: her run-out, a bit a side');
  assert.deepEqual(rec.v, [[77, 3, 2, SIDE_CODES.indexOf('port'), 1001, -3, 2003, -0.5, 1.23, -2.35, 0.1235, 99, 0.55, 0]]);
  // AUDIT NAV1 (online #15): her age when the word is said, whole milliseconds, never past the word's keep
  assert.deepEqual([312.4, 5000, -5].map((age) => navalWireRecord({ volleys: [volley({ age })] }).v[0][13]), [312, NAVAL_VOLLEY_KEEP_MS, 0]);
  assert.deepEqual(rec.b, [[5, 1007, 3, 2009, -1]], 'AUDIT NAV1 (online #7): a barrel with no ship\'s number is the owner\'s own boat\'s');
  assert.equal(navalWireRecord({ barrels: [{ id: 5, pos: [7, 8, 9], shooter: 3 }] }).b[0][4], 3, 'her ship\'s number');
  // AUDIT NAV1 (online #6, #10): my own boat and my notoriety, crowns by their row - nothing else to say still says them
  const self = navalWireRecord({ me: { hull: 0.426, crippled: true, boarders: false }, law: { Wayrest: 80.4, Daggerfall: 0, Sentinel: 250 } });
  assert.deepEqual(self, { s: [], v: [], b: [], p: [43, 1, 0], n: [[1, 80], [2, 100]] });
  assert.equal(navalWireRecord({ law: { Wayrest: 0 } }), null, 'owed nothing and nothing else: null');
  // AUDIT NAV1 (online #15): my Ships at sea by its row - never the default, which saying nothing already says
  assert.deepEqual(['few', 'many', 'off'].map((traffic) => navalWireRecord({ traffic })), [1, 3, 0].map((t) => ({ s: [], v: [], b: [], t })));
  assert.deepEqual([TRAFFIC_DEFAULT, 'lots', undefined].map((traffic) => navalWireRecord({ traffic })), [null, null, null]);
  assert.equal(navalWireRecord({ ships: [], volleys: [], barrels: [] }), null);
  assert.equal(navalWireRecord(null), null);
  assert.equal(navalWireRecord({ ships: [ship({ classId: 'ghostShip' })] }), null, 'no such class: not said');
  assert.equal(navalWireRecord({ ships: [ship({ pos: [Number.NaN, 0, 0] })] }), null);
  assert.equal(navalWireRecord({ volleys: [volley({ side: 'up' })] }), null);
  const many = navalWireRecord({
    ships: Array.from({ length: 20 }, (_, i) => ship({ n: i })),
    volleys: Array.from({ length: 20 }, (_, i) => volley({ id: i })),
    barrels: Array.from({ length: 20 }, (_, i) => ({ id: i, pos: [i, 0, 0] })),
  });
  assert.deepEqual([many.s.length, many.v.length, many.b.length], [NAVAL_WIRE_SHIPS, NAVAL_WIRE_VOLLEYS, NAVAL_WIRE_BARRELS]);
  assert.equal(navalWireRecord({ ships: [ship({ state: 'prize' })] }).s[0][12], WIRE_STATES.indexOf('prize'));
  assert.equal(navalRecordKey(null), '');
  assert.notEqual(navalRecordKey(rec), navalRecordKey(navalWireRecord({ ships: [ship({ pos: [101, 0, -50.456] })], volleys: [volley()], barrels: [{ id: 5, pos: [7, 8, 9] }] }, toWire)));
});

test('NAV-G a peer\'s word through the door, whole or not at all: my own word comes back as what it said; a known class and a variant her hull has, bounded places, a way and canvas a ship can have, shares 0-100, a state the wire knows, a side, a finite lay - one bad entry drops the lot (mutants: the variant unchecked, the state\'s range, one bad ship let the rest through)', () => {
  const rec = navalWireRecord({ ships: [ship(), ship({ n: 4, classId: 'merchantCoaster', variant: 3, fire: false })], volleys: [volley()], barrels: [{ id: 5, pos: [7, 8, 9] }] });
  const got = validNavalRecord(rec);
  assert.equal(got.ships.length, 2);
  assert.deepEqual(got.ships[0], { n: 3, classId: 'pirateBrig', hull: classById('pirateBrig').hull, variant: 0, pos: [100.12, 0, -50.46], yaw: 1.2346, speed: 3.46, sails: 0.8, hull100: 46, sail100: 100, crew100: 90, state: 'afloat', heel: 2.3, seed: 0xdeadbeef, fire: true, runOut: 0, gen: 2, region: 23 });
  assert.equal(validNavalRecord({ s: [rec.s[0].slice(0, 16)] }).ships[0].runOut, 0, 'an older build\'s word, without the run-out: none');
  assert.deepEqual(['gen', 'region'].map((k) => validNavalRecord({ s: [rec.s[0].slice(0, 17)] }).ships[0][k]), [0, -1], 'an older build\'s word, without the handover: the first claim, the reader\'s own region');
  assert.equal(validNavalRecord({ s: [Object.assign([...rec.s[0]], { 16: 0b1001 })] }).ships[0].runOut, 0b1001);
  assert.equal(got.ships[1].variant, 3, 'a Large Boat has variants');
  assert.deepEqual(got.volleys[0], { id: 77, shooter: 3, hull: 2, side: 'port', pos: [1, 2, 3], yaw: -0.5, vel: [1.23, 0, -2.35], elevation: 0.1235, seed: 99, skill: 0.55, age: 0 });
  assert.equal(validNavalRecord({ v: [Object.assign([...rec.v[0]], { 13: 640 })] }).volleys[0].age, 640, 'her age read');
  assert.equal(validNavalRecord({ v: [rec.v[0].slice(0, 13)] }).volleys[0].age, 0, 'an older build\'s volley: fired as it is heard');
  assert.deepEqual(got.barrels, [{ id: 5, pos: [7, 8, 9], shooter: -1 }]);
  assert.deepEqual(validNavalRecord({ b: [[5, 7, 8, 9]] }).barrels, [{ id: 5, pos: [7, 8, 9], shooter: -1 }], 'an older build\'s barrel: the owner\'s own');
  assert.deepEqual(validNavalRecord({ b: [[5, 7, 8, 9, 3]] }).barrels, [{ id: 5, pos: [7, 8, 9], shooter: 3 }], 'her ship\'s number, read');
  // AUDIT NAV2 F1-F3: PIN MOVED - the record reads the captains' key and the boat's too; an older build's word says neither.
  // AUDIT GN-G3: PIN MOVED - and her laid broadsides (`g`): none in an older build's word
  // AUDIT PASSAGE B5: PIN MOVED - and the booked harbour ships (`q`): none in an older build's word
  assert.deepEqual(validNavalRecord({}), { ships: [], volleys: [], barrels: [], me: null, law: {}, traffic: TRAFFIC_DEFAULT, casks: [], captains: new Map(), boat: null, spent: [], gone: [], laid: [] }, 'an empty word stands for none');   // AUDIT BAY A18 PIN MOVED: and no spent packet
  assert.deepEqual(validNavalRecord({ p: [43, 1, 0], n: [[1, 80]] }), { ships: [], volleys: [], barrels: [], me: { hull: 0.43, crippled: true, boarders: false }, law: { Wayrest: 80 }, traffic: TRAFFIC_DEFAULT, casks: [], captains: new Map(), boat: null, spent: [], gone: [], laid: [] });
  // AUDIT NAV1 (online #15): the casks afloat - the class and the lot by their rows, the place to half a metre
  const casks = navalWireRecord({ casks: [{ id: 7, pos: [10.3, 0.12, -4.74], from: 'pirateBrig', lot: 'E' }, { id: 8, pos: [0, 0, 0], from: 'ghostShip', lot: 'E' }, { id: 9, pos: [0, 0, 0], from: 'pirateBrig', lot: 'Z' }] });
  assert.deepEqual(casks, { s: [], v: [], b: [], f: [[7, 10.5, 0, -4.5, SHIP_CLASSES.findIndex((c) => c.id === 'pirateBrig'), LOT_KEYS.indexOf('E')]] }, 'no such class, no such lot: not said');
  assert.deepEqual(validNavalRecord(casks).casks, [{ id: 7, pos: [10.5, 0, -4.5], from: 'pirateBrig', lot: 'E' }]);
  assert.equal(navalWireRecord({ casks: Array.from({ length: 20 }, (_, id) => ({ id, pos: [0, 0, 0], from: 'pirateBrig', lot: 'S' })) }).f.length, NAVAL_WIRE_CASKS);
  assert.deepEqual([0, 1, 3].map((t) => validNavalRecord({ t }).traffic), ['off', 'few', 'many']);
  const s0 = rec.s[0], v0 = rec.v[0];
  const withShip = (i, val) => ({ s: [Object.assign([...s0], { [i]: val })] });
  const withVolley = (i, val) => ({ v: [Object.assign([...v0], { [i]: val })] });
  const brigVariants = HULL_VARIANT_COUNTS[classById('pirateBrig').hull];
  for (const [bad, why] of [
    [null, 'nothing'], [[], 'an array'], [{ s: 'x' }, 'ships not a list'],
    [{ s: Array.from({ length: NAVAL_WIRE_SHIPS + 1 }, () => s0) }, 'past the ships\' cap'],
    [{ v: Array.from({ length: NAVAL_WIRE_VOLLEYS + 1 }, () => v0) }, 'past the volleys\' cap'],
    [{ s: [s0.slice(0, 15)] }, 'fifteen fields'], [withShip(3, Number.NaN), 'NaN'],
    [withShip(1, SHIP_CLASSES.length), 'no such class'], [withShip(1, 1.5), 'a fractional class'],
    [withShip(2, Math.max(1, brigVariants)), 'a variant her hull has not'],
    [withShip(3, POSE_BOUND + 1), 'past the world'], [withShip(4, POSE_Y_BOUND + 1), 'past the sky'],
    [withShip(7, 41), 'no ship makes forty'], [withShip(8, 1.1), 'more canvas than she has'],
    [withShip(9, 101), 'a share past whole'], [withShip(12, WIRE_STATES.length), 'a state the wire does not know'],
    [withShip(13, 91), 'on her beam ends'], [withShip(14, -1), 'a negative seed'], [withShip(15, 2), 'a fire that is not a bit'],
    [withShip(16, 16), 'a run-out past the four batteries'], [withShip(16, 1.5), 'a fractional run-out'], [{ s: [s0.slice(0, 18)] }, 'eighteen fields'],
    [{ s: [[...s0, 0]] }, 'twenty fields'], [withShip(17, NAVAL_GEN_MAX + 1), 'a count past its ceiling'], [withShip(17, -1), 'a negative count'],
    [withShip(18, -2), 'a region before the map'], [withShip(18, 1e3), 'a region past the map'], [withShip(18, 2.5), 'half a region'],
    [withVolley(3, SIDE_CODES.length), 'a side past the stern'], [withVolley(1, -2), 'a shooter past the owner\'s own'],
    [withVolley(10, 2), 'a lay past the carriage'], [withVolley(12, 1.5), 'a skill past the best'],
    [withVolley(13, -1), 'an age before the fire'], [withVolley(13, NAVAL_VOLLEY_KEEP_MS + 1), 'an age past the word\'s keep'], [withVolley(13, 2.5), 'a fractional age'],
    [{ b: [[1, POSE_BOUND + 1, 0, 0]] }, 'a barrel past the world'], [{ b: [[1.5, 0, 0, 0]] }, 'a fractional barrel id'],
    [{ b: [[1, 0, 0, 0, -2]] }, 'a barrel\'s shooter before the owner'], [{ b: [[1, 0, 0, 0, 1, 0]] }, 'six barrel fields'],
    [{ p: [101, 0, 1] }, 'a hull past whole'], [{ p: [50, 2, 1] }, 'a wreck that is not a bit'], [{ p: [50, 0] }, 'two fields of a boat'],
    [{ n: [[3, 50]] }, 'no such crown'], [{ n: [[0, 101]] }, 'notoriety past its ceiling'], [{ n: [[0, 5, 1]] }, 'three fields of a crown'],
    [{ n: [[0, 1], [1, 1], [2, 1], [0, 1]] }, 'more crowns than there are'],
    [{ t: 4 }, 'no such traffic'], [{ t: -1 }, 'a traffic before the first'], [{ t: 1.5 }, 'half a traffic'],
    [{ f: [[1, 0, 0, 0, SHIP_CLASSES.length, 0]] }, 'a cask of no such class'], [{ f: [[1, 0, 0, 0, 0, LOT_KEYS.length]] }, 'a cask of no such lot'],
    [{ f: [[1, POSE_BOUND + 1, 0, 0, 0, 0]] }, 'a cask past the world'], [{ f: [[1, 0, 0, 0, 0]] }, 'five fields of a cask'],
    [{ f: Array.from({ length: NAVAL_WIRE_CASKS + 1 }, (_, i) => [i, 0, 0, 0, 0, 0]) }, 'more casks than a word says'],
    [{ s: [s0, 'x'] }, 'one bad ship drops them all'],
  ]) assert.equal(validNavalRecord(bad), null, why);
});

test('NAV-G a blow on a ship another stands: the striker sends the directed hit frame - the ship, her hurts, a fire (a ball\'s 1, a barrel\'s 2 - AUDIT NAV1), the zone - and the stander\'s door takes only bounded numbers, a known fire and a known zone; AUDIT NAV1 (online): no board claims - a ship boarded is taken over at the grapple, never marked in her stander\'s world - and a GRAPPLE (my ship alongside your boat) carries no hurt (mutants: the ceiling, the zone\'s codes, a grapple with a hurt)', () => {
  const d = navalHitData('ann', { n: 7, hull: 33.4, sail: 5.6, crew: 2, fire: true, zone: 'holed' });
  assert.deepEqual(d, { to: 'ann', nv: { n: 7, h: 33, s: 6, c: 2, f: 1, z: 2 } });
  assert.deepEqual(validNavalHit(d), { n: 7, hull: 33, sail: 6, crew: 2, fire: true, zone: 'holed', grapple: false, cask: null, answer: false });
  // AUDIT NAV1 (online #15): a cask's claim, and its owner's answer
  const k = navalHitData('ann', { n: 0, cask: 4000000000 }), a = navalHitData('bob', { n: 0, cask: 9, answer: true });
  assert.deepEqual([k.nv.k, k.nv.a, a.nv.k, a.nv.a], [4000000000, undefined, 9, 1]);
  assert.deepEqual([validNavalHit(k).cask, validNavalHit(k).answer, validNavalHit(a).cask, validNavalHit(a).answer], [4000000000, false, 9, true]);
  assert.equal(navalHitData('ann', { n: 1, answer: true }).nv.a, undefined, 'an answer is a cask\'s');
  const g = navalHitData('ann', { n: 4, grapple: true });
  assert.deepEqual(g, { to: 'ann', nv: { n: 4, h: 0, s: 0, c: 0, f: 0, z: 0, g: 1 } });
  assert.equal(validNavalHit(g).grapple, true);
  const barrel = navalHitData('ann', { n: 7, hull: 45, fire: 'barrel' });
  assert.equal(barrel.nv.f, 2);
  assert.equal(validNavalHit(barrel).fire, 'barrel', 'a barrel\'s fire comes over as a barrel\'s');
  assert.equal(validNavalHit(navalHitData('ann', { n: 7 })).fire, false);
  assert.equal(validNavalHit(navalHitData('ann', { n: 1, zone: 'rig' })).zone, 'rig');
  assert.equal(validNavalHit(navalHitData('ann', { n: 1 })).zone, 'hull');
  assert.equal(navalHitData('bob', { n: 2, board: 2 }).nv.board, undefined, 'no claim rides a blow');
  for (const [bad, why] of [
    [null, 'nothing'], [{ nv: [] }, 'an array'], [{ nv: { ...d.nv, n: -1 } }, 'no ship'],
    [{ nv: { ...d.nv, h: NAVAL_HIT_MAX + 1 } }, 'more than a broadside'], [{ nv: { ...d.nv, s: -1 } }, 'negative canvas'],
    [{ nv: { ...d.nv, c: 61 } }, 'more men than a galley'], [{ nv: { ...d.nv, f: 3 } }, 'no such fire'], [{ nv: { ...d.nv, f: 0.5 } }, 'half a fire'],
    [{ nv: { ...d.nv, z: 3 } }, 'no such zone'], [{ nv: { ...d.nv, h: 1.5 } }, 'a fraction'],
    [{ nv: { ...g.nv, h: 5 } }, 'a grapple with a hurt'], [{ nv: { ...g.nv, f: 1 } }, 'a grapple with a fire'], [{ nv: { ...g.nv, g: 2 } }, 'no such grapple'],
    [{ nv: { ...k.nv, h: 5 } }, 'a claim with a hurt'], [{ nv: { ...k.nv, g: 1 } }, 'a claim and a grapple'], [{ nv: { ...k.nv, k: -1 } }, 'no such cask'],
    [{ nv: { ...k.nv, k: 1.5 } }, 'half a cask'], [{ nv: { ...d.nv, a: 1 } }, 'an answer with no cask'], [{ nv: { ...a.nv, a: 2 } }, 'no such answer'],
  ]) assert.equal(validNavalHit(bad), null, why);
});

// ── the other players' boats: the sea's contacts ────────────────────────────────────────────────────────────────

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
function standInRenderer() {
  return {
    createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }),
    drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (archive, record, size, centers, opts) => ({ archive, record, size, centers, opts }),
    destroyBillboardBatch() {}, destroyMesh() {},
  };
}
function standInPipeline() {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  return { getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };
}
const Q = [0, Math.sin(0.25), 0, Math.cos(0.25)];
const boatWord = (over = {}) => [over.hull ?? 1, over.variant ?? 0, over.x ?? 10, over.y ?? 34, over.z ?? 20, ...Q, 0, over.helm ?? 1, 0];

test('NAV-H the other players\' boats at their helms are the sea\'s contacts: where each stands and her way - her word\'s own (CSA-K\'s `m`), carried through the frame as the lead carries it; a word that says no way has none, and a boat at rest at its mooring is nobody\'s contact (mutants: an idle boat hunted, the way never read, the way left in the wire frame)', async () => {
  const pool = createComeSailAwayPool({ renderer: standInRenderer(), pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  // the wire frame is natives, forty to the metre, about an origin of its own - a way is carried through it as a
  // difference, never read as it stands
  const toScene = (p) => [(p[0] - 1000) / 40, p[1], (p[2] + 400) / 40];
  peers.applyOwner('ann', { b: [boatWord({ x: 1400, z: 400 }), boatWord({ x: 16000, helm: 0 })] }, toScene, 1000);
  peers.frame(0.1);
  let got = peers.helmBoats();
  assert.equal(got.length, 1, 'the moored boat is not at a helm');
  assert.deepEqual(got[0].id, 'ann');
  assert.ok(got[0].boat && pool.peerBoats.includes(got[0].boat), 'AUDIT NAV1 (online): her hull itself - the sea\'s balls and barrels meet her');
  assert.deepEqual(got[0].pos.map((v) => +v.toFixed(6)), [10, 34, 20]);
  assert.deepEqual([got[0].speed, ...got[0].vel], [0, 0, 0, 0], 'her word says no way: she has none');
  // she sails: her word says her way - 200 natives a second along x and 80 along z, 5 and 2 m/s in the scene
  peers.applyOwner('ann', { b: [boatWord({ x: 1420, z: 400 }), boatWord({ x: 16000, helm: 0 })], m: [[200, 80, 3], [0, 0, 0]] }, toScene, 1100);
  peers.frame(0.1);
  got = peers.helmBoats();
  assert.equal(pool.peerBoats.length, 2, 'both of ann\'s boats built');
  assert.equal(got.length, 1, 'the moored one is still nobody\'s contact');
  assert.deepEqual(got[0].vel.map((v) => +v.toFixed(9)), [5, 0, 2], 'her way in the scene, a second\'s');
  assert.ok(Math.abs(got[0].speed - Math.hypot(5, 2)) < 1e-9);
  assert.ok(got[0].pos[0] > 10.5, 'and she is led along it');
  // brought up short: the word that says no way takes it at once - nothing measured, nothing left over
  peers.applyOwner('ann', { b: [boatWord({ x: 1440, z: 400 }), boatWord({ x: 16000, helm: 0 })] }, toScene, 1200);
  peers.frame(0.1);
  assert.equal(peers.helmBoats()[0].speed, 0, 'no way said, none');
  // a summons is a new place, not a way: she snaps there, and her speed stays her word's (none said here) - never the jump's
  peers.applyOwner('ann', { b: [boatWord({ x: 9000, z: 400 }), boatWord({ x: 16000, helm: 0 })] }, toScene, 1300);
  peers.frame(0.1);
  assert.deepEqual([peers.helmBoats()[0].speed, peers.helmBoats()[0].pos[0]], [0, 200], 'snapped to her new place with no way');
  peers.applyOwner('ann', null, toScene, 4000);
  peers.frame(0.1);
  assert.deepEqual(peers.helmBoats(), [], 'her word withdrawn');
  // a sea ship stands in the pool beside the others - drawn, never mine, and torn down with the rest
  const sea = pool.spawnSeaNow(new Boat(2, 0));   // the naval host's own call (scenes/naval/navalHost.js)
  assert.ok(sea?.GameObject, 'built as SpawnBoat builds one');
  assert.deepEqual(pool.seaBoats, [sea]);
  assert.equal(pool.boats.includes(sea), false, 'never one of MY boats - no helm is taken on her');
  pool.remove(sea);
  assert.deepEqual(pool.seaBoats, []);
  pool.spawnSeaNow(new Boat(4, 0));
  pool.destroyAll();
  assert.deepEqual([pool.boats.length, pool.peerBoats.length, pool.seaBoats.length], [0, 0, 0]);
});

// ── the hosts' doors ────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-G the doors: my word rides my foes frame beside the boats\' - a changed word asking for the frame it rides; a peer\'s lands past the room test and is cleared with the puppets; a blow carrying `nv` goes to the naval stander, anything else where it always went (mutants: the moved word never asking, the clears, the hit routed to the foes)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /if \(cell\) csaWord\(frame, full\); if \(cell\) csaAboardWord\(frame, full\);(?: if \(cell\) bandWord\(frame, full\);)? if \(cell\) navalWord\(frame, full\);/);   // THE MERGE with TV7b: the Overworld's bands' word may ride between
  assert.match(w, /function navalWord\(frame, full\) \{\n\s+if \(!navalOn\(\)\) \{ if \(!_navalWordKey\) return false; if \(frame\) \{ frame\.nv = null; _navalWordKey = ''; \} return true; \}\n\s+if \(_navalWordMade\?\.at !== _foesSentAt\) \{ const made = naval\.word\(campToWire\); _navalWordMade = \{ at: _foesSentAt, rec: made, key: navalRecordKey\(made\) \}; \}\n\s+const \{ rec, key \} = _navalWordMade;\n\s+if \(!full && key === _navalWordKey\) return false;\n\s+if \(frame\) \{ frame\.nv = rec; _navalWordKey = key; \}\n\s+return true;/);   // AUDIT NAV1 (#14): made once a tick
  assert.match(w, /exteriorFoes\.setOnNaval\(\(from, nv\) => naval\?\.applyWord\(from, nv, campToScene\), \(\) => naval\?\.clearPeers\(\)\);/);
  assert.match(w, /online\.onHit = \(id, data\) => \{ if \(isCellRoom\(online\.room\) && data\?\.nv\) \{ naval\?\.applyPeerHit\(id, data\); return; \} if \(isCellRoom\(online\.room\)\) exteriorFoes\.applyHit\(id, data\);/);
  const x = src('scenes/exteriorFoes.js');
  assert.match(x, /if \(data\.nv !== undefined\) _onNaval\?\.\(from, data\.nv, _now\(\)\);/);
  assert.equal((x.match(/_onNavalClear\?\.\(\);/g) ?? []).length, 2, 'both clears: the teardown and the room change');
  assert.match(x, /function setOnNaval\(fn, onClear = null\) \{ _onNaval = typeof fn === 'function' \? fn : null; _onNavalClear = typeof onClear === 'function' \? onClear : null; \}/);
  // the sea's word stays outside the relay's bundle: net/ never imports it
  for (const f of ['net/wire.js', 'net/relay.js']) {
    let s = '';
    try { s = src(f); } catch { continue; }
    assert.doesNotMatch(s, /navalWire/, `${f} reads nothing of the sea`);
  }
});
