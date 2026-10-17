// AUDIT BAY (2026-10-02, Mac: "Audit this. Must be perfect") - SHIPS OF THE BAY (ea3a7361e) audited, the sea's lens:
// the lanes' packets through the real host (scenes/naval/navalHost.js liners, steerLiner, boundOf) alone (test/navalSea.mjs)
// and in a room (test/navalRoom.mjs) - a packet's course, her end, her berth, her names, her tag, her next voyage, her
// spending, and a packet, a raider and a harbour's own handed from one player to another - the lanes' pure law
// (systems/naval/seaLanes.js pursue, the lineage) and the world's feed lifted from world.js. Each pin is red on the
// record's code (ea3a7361e) unless it says otherwise. `01-Overview/audits/Audit-Ships-of-the-Bay.md`.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea, knowAll } from '../../navalSea.mjs';
import { room } from '../../navalRoom.mjs';
import * as LANES from '../../../src/systems/naval/seaLanes.js';
import * as HOST from '../../../src/scenes/naval/navalHost.js';
import * as WIRE from '../../../src/systems/naval/navalWire.js';
import { DESPAWN_BEYOND } from '../../../src/systems/naval/navalDirector.js';
import { RAIDER_DROP_M } from '../../../src/systems/naval/navalRaiders.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { findHarbour } from '../../../src/systems/naval/shipLife.js';
import { NATIVE_PIXEL, nativeOfPixel, pixelOfNative } from '../../../src/systems/seaRaiders.js';

const { SHIP_FADE_S, LINER_DROP_M, LINER_STAND_M, HARBOUR_LEAVE, ORPHAN_S } = HOST;
const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const some = { ShipsAtSea: 'some' };
const GLEN = { key: 'port:1', name: 'Glenpoint' }, WAY = { key: 'port:2', name: 'Wayrest' };
/** A packet under way in the scene, her leg running north through her place - the record's fields (`ahead`, the ports'
 *  names) beside the audit's (`leg`, `seeds`, the ports' keys), so the record's host reads her too. */
const under = (id, seed, x, z, o = {}) => ({ id, seed, seeds: [seed], classId: 'merchantGalleon', region: -1, phase: 'sail', pos: [x, 0, z], yaw: 0,
  ahead: [x, 0, z + 300], leg: [[x, z - 3000], [x, z + 3000]], port: null, to: WAY, from: GLEN, until: null, ...o });
const all = (h) => [...h.host._sea.values()];
const liners = (h) => all(h).filter((e) => e.liner && !e.owner);
const bySeed = (h, seed) => all(h).find((e) => e.ship.seed === seed) ?? null;
const at = (h, p) => { h.view.feet = p; if (h.boat) h.boat.GameObject.position = [...p]; };
const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const PORT = { key: 'port:2', name: 'Wayrest', rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 } };

test('AUDIT BAY A1: A COURSE MOVES WITH THE WORLD - the floating origin moved, a packet\'s course and her tag\'s leg move with it, a relief\'s course too, and the list\'s own leg (her lane\'s, shared) is never moved under it; before, she steered for a point an origin\'s move off till her lane spoke again, and a relief for good (mutants: the course left; the leg left; the list\'s leg moved in place)', async () => {
  const h = await sea({ hull: 2, settings: some });
  const P = under('L1-2.0.1', 11, 300, 0);
  const shared = P.leg.map((q) => [...q]);
  h.host.liners([P], { now: 0 });
  const [e] = liners(h);
  assert.ok(e?.ship.course, 'stood and steered');
  const course = [...e.ship.course];
  h.host.offsetAll([100, 0, 50]);
  assert.deepEqual(e.ship.course, [course[0] + 100, course[1] + 50], 'her course with the world');
  assert.deepEqual(e.liner.leg, shared.map(([x, z]) => [x + 100, z + 50]), 'her leg with it');
  assert.deepEqual(e.liner.way, shared.map(([x, z]) => [x + 100, z + 50]), 'and her own (AUDIT BAY A22)');
  assert.deepEqual(P.leg, shared, 'the list\'s leg untouched');
  const r = h.host._sea.get(h.host.spawnShip('navyCutter', { range: 400 }));
  r.relief = true; r.ship.course = [10, 20];
  h.host.offsetAll([5, 0, -5]);
  assert.deepEqual(r.ship.course, [15, 15], 'a relief\'s');
});

test('AUDIT BAY A2: A STRUCK PACKET IS THE SEA\'S - struck, her voyage is spent and she is her lane\'s no more: out of every player\'s sight she goes as any hulk (the director\'s law), and back by her place she is never stood again; before, the lane kept her and the director counted her its own - a hulk kept for good, 5 km off (mutants: the struck kept; the spent unrecorded)', async () => {
  const h = await sea({ hull: 2, settings: some });
  const P = under('L1-2.0.2', 12, 300, 0);
  h.host.liners([P], { now: 0 });
  const [e] = liners(h);
  h.run(SHIP_FADE_S + 0.5);
  e.ship.damage.apply({ hull: e.ship.damage.maxHull * 0.8, sail: 0, crew: 0 }, 0);
  h.run(0.5);
  assert.equal(e.ship.damage.state, SHIP_STATES.struck);
  assert.equal(e.liner, null, 'her lane\'s no more');
  at(h, [0, 0, -(DESPAWN_BEYOND + LINER_DROP_M + 1000)]);
  for (let t = 0; t < 20; t += 2) { h.host.liners([P], { now: 2 + t }); h.run(2); }
  assert.equal(h.host._sea.has(e.id), false, 'let go out of sight, as any hulk');
  at(h, [0, 0, 0]);
  h.host.liners([P], { now: 40 });
  h.host.liners([P], { now: 42 });
  assert.equal(liners(h).length, 0, 'her voyage spent: never stood again');
});

test('AUDIT BAY A3: A PACKET TAKEN OVER KEEPS HER LANE - her stander gone, the heir knows her by her seed and steers her on along it; before, she lost her lane, her course and her errand, and sailed a cruise of her own (mutants: the heir\'s copy untagged; a peer\'s copy tagged as mine)', async () => {
  const R = await room([{ id: 'a', hull: 2, settings: some }, { id: 'b', hull: 2, settings: some }]);
  const A = R.get('a').s, B = R.get('b').s;
  const P = under('L1-2.0.4', 14, 300, 0);
  for (let i = 0; i < 3; i++) { A.host.liners([P], { now: i * 2 }); B.host.liners([P], { now: i * 2 }); R.run(2); }
  const holder = [['a', A], ['b', B]].find(([, c]) => all(c).some((e) => e.ship.seed === 14 && !e.owner));
  assert.ok(holder, 'one of them stands her');
  const [gone, other] = holder[0] === 'a' ? ['a', B] : ['b', A];
  assert.ok(bySeed(other, 14)?.owner === gone && bySeed(other, 14).liner, 'the other reads her lane on her');
  R.get(gone).present = false;
  for (let i = 0; i < 12; i++) { other.host.liners([P], { now: 6 + i }); R.run(1); }
  const e = bySeed(other, 14);
  assert.ok(e && !e.owner, 'the heir\'s now');
  assert.equal(e.liner?.id, P.id, 'her lane hers still');
  assert.ok(e.ship.course && e.ship.errand === null, `steered on along it (${JSON.stringify(e.ship.course)})`);
  assert.ok(Math.abs(e.ship.course[0] - 300) < 1 && e.ship.course[1] > e.ship.pos[2], 'up her leg, ahead of her');
});

test('AUDIT BAY A5: EVERY PLAYER STANDS THEIR OWN PACKETS - a packet 900 m from one player and 2 km from the other is stood by the one she is near, whoever launches the sea\'s traffic; before, only the elected launcher stood any, and she was stood by nobody (mutants: the launcher\'s election kept)', async () => {
  const R = await room([{ id: 'a', hull: 2, settings: some }, { id: 'b', hull: 2, settings: some }]);
  const A = R.get('a').s, B = R.get('b').s;
  at(B, [0, 0, 1100]);
  const P = under('L1-2.0.3', 13, 0, 2000);
  for (let i = 0; i < 5; i++) { A.host.liners([P], { now: i * 2 }); B.host.liners([P], { now: i * 2 }); R.run(2); }
  const onB = bySeed(B, 13), onA = bySeed(A, 13);
  assert.ok(onB && !onB.owner, 'b stands her');
  assert.ok(onA && onA.owner === 'b', 'a sees her as b\'s');
});

test('AUDIT BAY A6: PURSUIT, THE LAW - the point `ahead` on along a leg from the point of it nearest her (any segment, a run past a corner carried on into the next), clamped at the leg\'s end, and how far that nearest point lies from the end along it; a lone point is itself, no leg none (mutants: the nearest segment\'s compare flipped; the projection unclamped; the remainder not carried; `left` from the start)', () => {
  assert.equal(typeof LANES.pursue, 'function', 'the law exists');
  const pursue = (...a) => { const p = LANES.pursue(...a); return p && { x: +p.x.toFixed(9), z: +p.z.toFixed(9), left: +p.left.toFixed(9) }; };
  const leg = [[0, 0], [0, 100], [100, 100]];
  assert.deepEqual(pursue(leg, 5, 20, 30), { x: 0, z: 50, left: 180 }, 'on the first leg');
  assert.deepEqual(pursue(leg, 5, 90, 30), { x: 20, z: 100, left: 110 }, 'carried round the corner');
  assert.deepEqual(pursue(leg, 50, 140, 30), { x: 80, z: 100, left: 50 }, 'nearest the second leg, off it');
  assert.deepEqual(pursue(leg, 95, 104, 30), { x: 100, z: 100, left: 5 }, 'clamped at the end');
  assert.deepEqual(pursue(leg, -10, -40, 10), { x: 0, z: 10, left: 200 }, 'before the start: from it');
  assert.deepEqual(pursue(leg, 300, 100, 10), { x: 100, z: 100, left: 0 }, 'past the end: the end');
  assert.deepEqual(pursue([[7, 8]], 0, 0, 10), { x: 7, z: 8, left: 0 });
  assert.equal(pursue([], 0, 0, 10), null);
  assert.equal(pursue(null, 0, 0, 10), null);
  assert.deepEqual(pursue([[0, 0], [0, 0], [0, 50]], 0, 10, 5), { x: 0, z: 15, left: 40 }, 'a doubled point passed over');
  assert.deepEqual(pursue([[0, 0], [0, 0], [0, 50]], 0, -5, 0), { x: 0, z: 0, left: 50 }, 'one opening the leg, no lookahead: never a point of no length\'s nought over nought');
});

test('AUDIT BAY A6: STEERED ALONG HER LEG FROM WHERE SHE IS - a packet lagging her place round a headland keeps to her leg\'s water, one that has outsailed it goes on along her leg, never back; within LINER_PORT_M of her leg\'s end she is at her port; before, she steered straight for her place on the clock, half the line over the land her lane goes round (mutants: the leg\'s end for the pursuit\'s point; the lookahead dropped; the arrival never)', async () => {
  const { LINER_LOOKAHEAD_M, LINER_PORT_M } = HOST;
  // a headland x -150..150 reaching south to z = 0; her leg down its east side, round its tip, up its west
  const land = (x, z) => x > -150 && x < 150 && z > 0;
  const h = await sea({ hull: 2, settings: some, water: (x, z) => !land(x, z) });
  at(h, [400, 0, 900]);
  const leg = [[300, 1500], [300, -200], [-300, -200], [-300, 1500]];
  const P = under('L1-2.0.5', 15, 300, 1100, { leg, ahead: [-300, 0, 450] });
  h.host.liners([P], { now: 0 });
  const [e] = liners(h);
  // her place on the clock up the west side; she lags down the east
  h.host.liners([{ ...P, pos: [-300, 0, 300] }], { now: 60 });
  const [cx, cz] = e.ship.course, [px, , pz] = e.ship.pos;
  let over = 0;
  for (let k = 1; k < 100; k++) if (land(px + ((cx - px) * k) / 100, pz + ((cz - pz) * k) / 100)) over++;
  assert.equal(over, 0, `her course (${cx}, ${cz}) over the water`);
  assert.ok(Math.abs(cx - 300) < 1e-6 && Math.abs(cz - (pz - LINER_LOOKAHEAD_M)) < 1e-6, 'LINER_LOOKAHEAD_M on down her leg');
  // outsailed her place: on along her leg from where she is
  e.ship.pos = [-300, 0, 600];
  h.host.liners([{ ...P, pos: [300, 0, 900] }], { now: 62 });
  assert.deepEqual(e.ship.course, [-300, 600 + LINER_LOOKAHEAD_M], 'on, never back');
  // within LINER_PORT_M of her leg's end: lying off her port (no harbour of it known)
  e.ship.pos = [-300, 0, 1500 - LINER_PORT_M + 10];
  h.host.liners([P], { now: 64 });
  assert.deepEqual([e.ship.course, e.ship.errand?.kind, e.ship.errand?.at], [null, 'lurk', [-300, 1500]], 'off the port, on her ring');
});

test('AUDIT BAY A7: A PACKET TAKES THE LAST OPEN BERTH - a harbour\'s own are stood at its first, so a packet lying there first leaves the day\'s roll whole; and a berth another player\'s ship lies at is no open berth; before, she took the first (a berth of the day\'s own ship, never stood) and berthed on another\'s moored ship (mutants: the first open berth; another\'s ship at a berth unread)', async () => {
  const plain = await sea({ hull: null, water: coast, settings: { ShipsAtSea: 'few' } });
  plain.view.feet = [0, 0, 300]; plain.deps.harbourNear = () => PORT; plain.run(1);
  const rolled = (h) => all(h).filter((e) => !e.liner && e.ship.errand?.kind === 'moored').map((e) => e.ship.errand.berth).sort();
  const want = rolled(plain);
  assert.ok(want.length >= 2, `the roll alone: ${want}`);
  const known = await sea({ hull: null, water: coast, settings: { ShipsAtSea: 'few' } });
  known.deps.harbourNear = () => PORT;
  known.view.feet = [0, 0, 300 + 2000];   // the harbour sounded, too far to roll
  known.host.frame(0.01);
  known.view.feet = [0, 0, 300];
  known.host.liners([under('L1-2.0.6', 16, 0, 100, { classId: 'merchantCarrack', phase: 'dwell', port: PORT, to: GLEN, from: GLEN, until: 500 })], { now: 400 });
  const [pk] = liners(known);
  const harbour = findHarbour({ rect: PORT.rect, isWater: coast });
  assert.equal(pk?.ship.errand?.berth, harbour.berths.length - 1, 'the last berth');
  known.run(1);
  assert.deepEqual(rolled(known), want, 'the day\'s roll whole');
  // another player's moored ship at the last berth: the next open one
  const R = await room([{ id: 'a', hull: null, water: coast, settings: { ShipsAtSea: 'few' } }, { id: 'b', hull: null, water: coast, settings: { ShipsAtSea: 'few' } }]);
  for (const id of ['a', 'b']) { const c = R.get(id).s; c.view.feet = [0, 0, 300]; c.deps.harbourNear = () => PORT; }
  R.get('b').s.view.feet = [0, 0, 300 + 2000];
  R.run(2);
  const A = R.get('a').s, B = R.get('b').s;
  const last = harbour.berths.length - 1;
  const lie = A.host._sea.get(A.host.spawnShip('merchantCoaster', { range: 1 }));
  lie.ship.pos = [harbour.berths[last].pos[0], 0, harbour.berths[last].pos[1]]; lie.ship.speed = 0; lie.ship.errand = { kind: 'moored', harbour: PORT.key, berth: last, until: 1e9, path: null, i: 0 };
  R.run(1);
  B.view.feet = [0, 0, 300];
  B.host.liners([under('L1-2.0.7', 17, 0, 100, { classId: 'merchantCarrack', phase: 'dwell', port: PORT, to: GLEN, from: GLEN, until: 500 })], { now: 400 });
  const mine = liners(B)[0];
  assert.ok(mine, 'stood');
  const b = harbour.berths[mine.ship.errand.berth].pos;
  assert.ok(all(B).filter((e) => e.owner === 'a').every((e) => Math.hypot(e.ship.pos[0] - b[0], e.ship.pos[2] - b[1]) > 10), 'never on a\'s ship');
  assert.notEqual(mine.ship.errand.berth, last);
});

test('AUDIT BAY A8: A PACKET IS NAMED BY HER LANE - one packet met in two crowns\' waters bears one name, her home port\'s region\'s; before, each player named a crown\'s packet by the waters they stood in (mutants: the list\'s region unread)', async () => {
  const names = [];
  for (const where of [{ region: 17, capitals: [{ region: 17, x: 100, y: 100 }] }, { region: 23, capitals: [{ region: 23, x: 100, y: 100 }] }]) {
    const h = await sea({ hull: 2, settings: some, where });
    h.host.liners([under('L1-2.0.8', 18, 300, 0, { classId: 'navyCutter', region: 23 })], { now: 0 });
    const [e] = liners(h);
    names.push([e?.ship.names.name, e?.ship.names.crown, e?.region]);
  }
  assert.deepEqual(names[0], names[1], `one ship: ${JSON.stringify(names)}`);
  assert.equal(names[0][2], 23, 'her lane\'s region');
  // stood at a berth of her port, the same
  const berthed = [];
  for (const where of [{ region: 17, capitals: [{ region: 17, x: 100, y: 100 }] }, { region: 23, capitals: [{ region: 23, x: 100, y: 100 }] }]) {
    const h = await sea({ hull: null, water: coast, settings: some, where });
    h.view.feet = [0, 0, 300]; h.deps.harbourNear = () => PORT; h.run(0.5);
    h.host.liners([under('L1-2.0.8', 18, 0, 100, { classId: 'navyCutter', region: 23, phase: 'dwell', port: PORT, to: GLEN, from: GLEN })], { now: 0 });
    const [e] = liners(h);
    berthed.push([e?.ship.errand?.kind, e?.ship.names.name, e?.region]);
  }
  assert.deepEqual(berthed, [['moored', names[0][0], 23], ['moored', names[0][0], 23]], 'at her berth, by her lane\'s region too');
});

test('AUDIT BAY A11 AND A16: WHERE SHE IS BOUND, TRULY - a crown\'s ship answering the guns is bound nowhere a tag can say (a relief comes to my aid still), and a packet leaving a harbour with no name reads her lane\'s next port; before, the one answering read "bound out to sea" and the packet nothing (mutants: \'answer\' read as \'cruise\'; the unnamed harbour\'s depart said)', async () => {
  const h = await sea({ hull: 2, settings: some });
  const n = h.host._sea.get(h.host.spawnShip('navyCutter', { range: 300 }));
  h.run(1);
  const tag = (e) => knowAll(h.host).tags().find((t) => t.id === e.id)?.bound;   // PIN MOVED (SPYGLASS): her colours made out - an unknown hull wears no tag
  n.ship.errand = { kind: 'voyage', harbour: null, path: null, i: 0 };
  n.ship.mode = 'answer';
  assert.equal(tag(n), '', 'answering the guns');
  n.relief = true;
  assert.equal(tag(n), 'coming to your aid');
  n.relief = false;
  h.host.liners([under('L1-2.0.9', 19, 0, 250)], { now: 0 });
  h.run(1);
  const [p] = liners(h);
  p.ship.errand = { kind: 'depart', harbour: 'port:none', berth: 0, path: null, i: 0 };
  assert.equal(tag(p), 'bound for Wayrest', 'out of an unnamed harbour: her lane\'s words');
  p.liner = { ...p.liner, dest: { key: 'port:7', name: null }, to: { key: 'port:7', name: null } };
  assert.equal(tag(p), '', 'a port with no name: nothing said (never "bound for null")');
});

test('AUDIT BAY A17: A PACKET SAILS ON INTO HER NEXT VOYAGE - moored at her home port as her voyage turns, she is the packet of the next (her seed among its lineage) and sails it: the same ship departs, none other stood, none faded; before, she faded out at her berth in the port\'s sight and another ship was stood at the roadstead (mutants: the lineage unread; the voyage\'s own seed alone)', async () => {
  const { LANE_LINEAGE, packetAt, laneNetwork, laneWay } = LANES;
  const h = await sea({ hull: null, water: coast, settings: some });
  h.view.feet = [0, 0, 300];
  h.deps.harbourNear = () => PORT;
  h.run(1);
  const home = { classId: 'merchantCarrack', phase: 'dwell', port: PORT, to: GLEN, from: GLEN, until: 500, leg: [[0, -3000], [0, 100]] };
  h.host.liners([under('L1-2.0.5', 105, 0, 100, { ...home, seeds: [105, 104, 103] })], { now: 400 });
  const [e] = liners(h);
  assert.equal(e?.ship.errand?.kind, 'moored', 'lying at her home port');
  h.run(SHIP_FADE_S + 0.5);
  const name = e.ship.names.name, count = all(h).length;
  const next = under('L1-2.0.6', 106, 0, 120, { classId: 'merchantCarrack', seeds: [106, 105, 104], port: null, from: PORT, to: GLEN, leg: [[0, 100], [0, -3000]], yaw: Math.PI });
  for (let t = 0; t < 6; t++) { h.host.liners([next], { now: 501 + t }); h.run(1); }
  assert.ok(h.host._sea.has(e.id) && !e.retiring && e.fade === 1, 'the same ship, whole');
  assert.equal(e.ship.names.name, name);
  assert.equal(e.liner?.id, next.id, 'the packet of her next voyage');
  assert.ok(['depart', undefined].includes(e.ship.errand?.kind) || e.ship.course, `sailing it (${e.ship.errand?.kind})`);
  assert.equal(all(h).length, count, 'none other stood');
  assert.ok(bySeed(h, 106) === null, 'no ship of the next voyage\'s own seed');
  // the pure law: a packet's seeds are her place's last LANE_LINEAGE voyages', hers first
  assert.equal(LANE_LINEAGE, 24);
  const ports = [{ id: 1, name: 'A', px: 100, py: 199, region: 5 }, { id: 2, name: 'B', px: 110, py: 199, region: 6 }];
  const open = (x, y) => y >= 200 && x >= 0 && x < 1000 && y < 500;
  const [lane] = laneNetwork(ports, open);
  const way = laneWay(lane, open, (x, z) => { const p = pixelOfNative(x, z); return open(p.x, p.y); });
  const pk = LANES.packetOf(lane, 0, 1), period = 2 * (way.len / pk.speed + LANES.LANE_DWELL_S);
  const p = packetAt(lane, way, 1.7e12, 0, 1);
  const q = packetAt(lane, way, 1.7e12 + 3 * period * 1000, 0, 1);
  assert.equal(p.seeds.length, LANE_LINEAGE);
  assert.equal(p.seeds[0], p.seed);
  assert.equal(p.region, 5, 'her home port\'s region');
  const back = q.voyage - p.voyage;
  assert.ok(back === 3 && q.seeds[back] === p.seed, `three voyages on (${back}), hers among its seeds`);
  assert.ok(q.seeds.every((sd, j) => sd === (j === 0 ? q.seed : packetAt(lane, way, 1.7e12 + (3 - j) * period * 1000, 0, 1).seed) || j > 3), 'each the voyage\'s own');
});

test('AUDIT BAY A18: A SPENT PACKET IS SPENT FOR EVERY PLAYER - her voyage\'s seed said in the word (`l`, the last NAVAL_WIRE_SPENT), and a player who never saw her go stands her never; the door reads it whole or refuses the word; before, a player who never saw her sink stood her afresh where she went down (mutants: the word\'s `l` unsaid; unread; its bound unchecked; the word of her spent alone unread)', async () => {
  const { NAVAL_WIRE_SPENT, navalWireRecord, validNavalRecord } = WIRE;
  const h = await sea({ hull: 2, settings: some });
  const P = under('L1-2.0.10', 20, 300, 0);
  h.host.liners([P], { now: 0 });
  const [e] = liners(h);
  e.ship.damage.apply({ hull: e.ship.damage.maxHull * 10, sail: 0, crew: 0 }, 0);
  h.run(0.5);
  const word = h.host.word((p) => p);
  assert.deepEqual(word.l, [20], 'said in my word');
  const x = await sea({ hull: 2, settings: some });
  assert.equal(x.host.applyWord('a', JSON.parse(JSON.stringify({ s: [], v: [], b: [], l: word.l }))), true, 'a word of her spent alone (she long gone from it)');
  x.host.liners([P], { now: 2 });
  x.host.liners([P], { now: 4 });
  assert.equal(liners(x).length, 0, 'never stood by one who never saw her go');
  // the door
  assert.equal(NAVAL_WIRE_SPENT, 8);
  const many = Array.from({ length: 12 }, (_, i) => i + 1);
  assert.deepEqual(navalWireRecord({ spent: many }).l, many.slice(-NAVAL_WIRE_SPENT), 'the last NAVAL_WIRE_SPENT');
  assert.equal(navalWireRecord({ spent: [] }), null, 'nothing to say: no word');
  assert.deepEqual(navalWireRecord({ spent: [7, -1, 1.5, 2 ** 32] }).l, [7], 'whole numbers of 32 bits alone');
  assert.deepEqual(validNavalRecord({ l: [1, 2] }).spent, [1, 2]);
  assert.deepEqual(validNavalRecord({}).spent, [], 'an older build\'s: none');
  assert.equal(validNavalRecord({ l: many }), null, 'past NAVAL_WIRE_SPENT: refused');
  assert.equal(validNavalRecord({ l: [1.5] }), null);
  assert.equal(validNavalRecord({ l: 'x' }), null);
});

test('AUDIT BAY A4: A RAIDER HANDED ON NEVER BLINKS - her stander sails off past RAIDER_DROP_M while another player lies beside her: she is held for that player\'s claim and taken over where she lies, whole on both their screens throughout; before, she faded out of the near player\'s sea and was stood in it anew - out, gone, in (mutants: the hold dropped; the claim never made; the claim made of one still held)', async () => {
  const R = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = R.get('a').s, B = R.get('b').s;
  const RA = { id: 'r17.16.99', seed: 0x5eed1, pos: [600, 0, 0], ahead: [600, 0, 200], yaw: 0 };
  at(B, [600, 0, 300]);
  const step = (s) => { for (const c of [A, B]) c.host.raiders([RA], { sight: 100, spent: new Set(), held: new Map() }); R.run(s); };
  for (let i = 0; i < 12; i++) step(0.5);
  const first = bySeed(B, RA.seed);
  assert.ok(first && first.owner === 'a' && first.fade === 1, 'a stands her; b sees her whole');
  at(A, [-(RAIDER_DROP_M + 3000), 0, 0]);
  let least = 1, leastA = 1;
  for (let i = 0; i < 40; i++) {
    for (const c of [A, B]) c.host.raiders([RA], { sight: 100, spent: new Set(), held: new Map() });
    for (let k = 0; k < 5; k++) { R.run(0.1); const e = bySeed(B, RA.seed), a = bySeed(A, RA.seed); least = Math.min(least, e ? e.fade : 0); leastA = Math.min(leastA, a ? a.fade : 0); }
  }
  assert.equal(least, 1, 'whole on b\'s screen throughout');
  assert.equal(leastA, 1, 'and on a\'s: held for b\'s claim, never faded');
  const e = bySeed(B, RA.seed);
  assert.ok(e && !e.owner && e.raider?.id === RA.id, 'b\'s own now, her raider\'s life hers');
  assert.equal(all(B).filter((x) => x.ship.seed === RA.seed).length, 1, 'one of her');
  assert.ok(bySeed(A, RA.seed)?.owner === 'b', 'a reads her as b\'s');
});

test('AUDIT BAY A4: A PACKET HANDED ON NEVER BLINKS - her stander sails off past LINER_DROP_M while another player lies within it of her: held ORPHAN_S for that player\'s claim and taken over where she lies, whole on both screens; with no player near her she sails on and fades (SHIP-FADE); before, she faded out of the near player\'s sea and was stood in it anew (mutants: the hold dropped; the claim never made)', async () => {
  const R = await room([{ id: 'a', hull: 2, settings: some }, { id: 'b', hull: 2, settings: some }]);
  const A = R.get('a').s, B = R.get('b').s;
  const P = under('L1-2.0.11', 21, 300, 0);
  at(B, [300, 0, 900]);
  const step = (now, s = 2) => { A.host.liners([P], { now }); B.host.liners([P], { now }); R.run(s); };
  step(0); step(2); step(4);
  const mine = bySeed(A, 21);
  assert.ok(mine && !mine.owner, 'a stands her');
  assert.ok(bySeed(B, 21)?.owner === 'a', 'b reads her as a\'s');
  at(A, [0, 0, -(LINER_DROP_M + 3000)]);
  let least = 1, leastA = 1;
  for (let t = 6; t < 30; t += 1) {
    A.host.liners([P], { now: t }); B.host.liners([P], { now: t });
    for (let k = 0; k < 10; k++) { R.run(0.1); const e = bySeed(B, 21), a = bySeed(A, 21); least = Math.min(least, e ? e.fade : 0); leastA = Math.min(leastA, a ? a.fade : 0); }
  }
  assert.equal(least, 1, 'whole on b\'s screen throughout');
  assert.equal(leastA, 1, 'and on a\'s: held for b\'s claim, never faded');
  const e = bySeed(B, 21);
  assert.ok(e && !e.owner && e.liner?.id === P.id, 'b\'s own, her lane hers');
  assert.ok(bySeed(A, 21)?.owner === 'b' && !bySeed(A, 21).retiring, 'a reads her as b\'s, never fading');
  assert.ok(ORPHAN_S > 2 * 2, 'the hold outlasts the claim\'s two words');
  // a player near her who stands no packets (the Ships at sea off): held ORPHAN_S, then let go
  const R2 = await room([{ id: 'a', hull: 2, settings: some }, { id: 'b', hull: 2, settings: { ShipsAtSea: 'off' } }]);
  const A2 = R2.get('a').s, B2 = R2.get('b').s;
  at(B2, [300, 0, 900]);
  A2.host.liners([P], { now: 0 }); B2.host.liners([P], { now: 0 }); R2.run(2);
  const held = bySeed(A2, 21);
  at(A2, [0, 0, -(LINER_DROP_M + 3000)]);
  for (let t = 2; t < 2 + ORPHAN_S - 1; t += 1) { A2.host.liners([P], { now: t }); B2.host.liners([P], { now: t }); R2.run(1); }
  assert.ok(held.retiring === false && !held.owner, 'held for a claim');
  for (let t = 2 + ORPHAN_S - 1; t < 2 + ORPHAN_S + 2; t += 1) { A2.host.liners([P], { now: t }); B2.host.liners([P], { now: t }); R2.run(1); }
  assert.equal(held.retiring, true, 'none made in ORPHAN_S: let go');
  // nobody near her: she sails on and fades
  const alone = await sea({ hull: 2, settings: some });
  alone.host.liners([P], { now: 0 });
  const [x] = liners(alone);
  at(alone, [0, 0, -(LINER_DROP_M + 3000)]);
  alone.host.liners([P], { now: 2 });
  assert.equal(x.retiring, true, 'alone: let go at once');
});

test('AUDIT BAY A9: ANOTHER\'S PACKET READS HER LANE - known by her seed, a peer\'s copy of a packet reads where she is bound, lying off her port or moored at a berth of it, as her stander\'s tag does; before, another\'s packet read nothing (mutants: a peer\'s copy unread; her berth unread)', async () => {
  const R = await room([{ id: 'a', hull: null, water: coast, settings: some }, { id: 'b', hull: null, water: coast, settings: some }]);
  const A = R.get('a').s, B = R.get('b').s;
  for (const c of [A, B]) { c.view.feet = [0, 0, -200]; c.deps.harbourNear = () => PORT; }
  R.run(1);
  const P = under('L1-2.0.12', 22, 200, -600, { leg: [[200, -3000], [0, 100]] });
  for (let t = 0; t < 4; t += 2) { A.host.liners([P], { now: t }); B.host.liners([], { now: t }); R.run(2); }
  const theirs = bySeed(B, 22);
  assert.ok(theirs?.owner === 'a', 'a stands her');
  B.host.liners([P], { now: 4 });
  const tag = () => knowAll(B.host).tags().find((t) => t.id === theirs.id)?.bound;   // PIN MOVED (SPYGLASS): her colours made out
  assert.equal(tag(), 'bound for Wayrest');
  const dwell = { ...P, phase: 'dwell', port: PORT, to: GLEN, from: GLEN };
  B.host.liners([dwell], { now: 6 });
  assert.equal(tag(), 'bound for Wayrest', 'her dwell begun, she not yet there');
  theirs.ship.pos = [0, 0, -100];
  assert.equal(tag(), 'lying off Wayrest', 'by her leg\'s end');
  const harbour = findHarbour({ rect: PORT.rect, isWater: coast });
  theirs.ship.pos = [harbour.berths[0].pos[0], 0, harbour.berths[0].pos[1]]; theirs.ship.speed = 0;
  assert.equal(tag(), 'moored at Wayrest', 'at a berth');
});

test('AUDIT BAY A20: THE PORT\'S OWN HANDED ON - a player in port as the one who rolled it sails past HARBOUR_LEAVE takes its moored ships over where they lie, whole throughout; before, they faded out of their berths before the eyes of the one in port, the roll long done (mutants: the port\'s own unclaimed)', async () => {
  const R = await room([{ id: 'a', hull: null, water: coast, settings: { ShipsAtSea: 'few' } }, { id: 'b', hull: null, water: coast, settings: { ShipsAtSea: 'few' } }]);
  const A = R.get('a').s, B = R.get('b').s;
  for (const c of [A, B]) { c.view.feet = [0, 0, 300]; c.deps.harbourNear = () => PORT; }
  R.run(SHIP_FADE_S + 3);
  const theirs = all(B).filter((e) => e.owner === 'a' && e.ship.speed < 0.5);
  assert.ok(theirs.length >= 2 && theirs.every((e) => e.fade === 1), `a's moored ships in b's sea, whole (${theirs.length})`);
  const seeds = theirs.map((e) => e.ship.seed);
  A.view.feet = [0, 0, 300 + HARBOUR_LEAVE + 500];
  let least = 1;
  for (let i = 0; i < 120; i++) { R.run(0.1); for (const sd of seeds) { const e = bySeed(B, sd); least = Math.min(least, e ? e.fade : 0); } }
  assert.equal(least, 1, 'whole in b\'s port throughout');
  for (const sd of seeds) { const e = bySeed(B, sd); assert.ok(e && !e.owner && e.ship.errand?.kind === 'moored', `b's own, moored (${sd})`); }
});

// ── the world's feed, lifted from world.js and run (test/systems/naval/sealanes.test.js's own lift) ─────────────────────────────

function liftFeed() {
  const i = WORLD.indexOf('  const LANE_LIST_MS = 2000');
  const j = WORLD.indexOf('    naval.liners(list);\n  }\n', i);
  assert.ok(i > 0 && j > i, 'the feed lifted');
  return WORLD.slice(i, j + '    naval.liners(list);\n  }\n'.length);
}

test('AUDIT BAY A19: THE FEED HANDS EVERY PACKET OF THE LANES ABOUT THE PLAYER - wherever her clock puts her, each with her seeds, her leg in the scene, her ports by key and name and her home port\'s region; before, only those whose PLACE ON THE CLOCK lay within 1600 m were handed over, and a packet fallen that far behind her place (the wind leaves her short of her schedule\'s way: 1 km in 20 minutes) was let go beside the player (mutants: a distance filter put back; the leg\'s reverse not taken; the region unsaid)', () => {
  const water = (x, y) => x >= 0 && y >= 200 && x < 1000 && y < 500;
  const OCEAN = 223, S = 40;
  const PORTS = [{ id: 199200, x: 200, y: 199, name: 'Glenpoint' }, { id: 199225, x: 225, y: 199, name: 'Wayrest' }];
  const origin = nativeOfPixel(200, 200);
  const got = [];
  const env = {
    tvWater: water, maps: { getClimateIndex: (px, py) => (water(px, py) ? OCEAN : 1), getRegion: () => ({ mapNames: PORTS.map((p) => p.name) }) },
    CLIMATES: { Ocean: OCEAN }, RAID_NATIVE_PIXEL: NATIVE_PIXEL, pixelOfNative,
    PORT_LOCATION_IDS: PORTS.map((p) => p.id),
    mapDict: new Map(PORTS.map((p, k) => [p.id & 0xfffff, { id: p.y * 1000 + p.x, regionIndex: 7 + k, mapIndex: k }])),
    getPixelFromPixelID: (id) => ({ x: id % 1000, y: Math.floor(id / 1000) }),
    laneNetwork: LANES.laneNetwork, laneWay: LANES.laneWay, packetsAt: LANES.packetsAt, LANE_PATH_PX: LANES.LANE_PATH_PX, LANE_MAX_PX: LANES.LANE_MAX_PX,
    performance: { now: () => 1e4 },
    naval: { enabled: true, liners: (list) => got.push({ list }) },
    playerTravelPixel: () => ({ x: 200, y: 200 }), player: { feetAt: () => [0, 0, 0] }, raidNowMs: () => 1.7e12,
    state: { localFromWorld: (x, z) => [(x - origin.x) / S, (z - origin.z) / S] },
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const run = new Function(...names, `${liftFeed()}\nreturn { laneShips, laneNet };`)(...names.map((k) => env[k]));
  run.laneShips();
  assert.equal(got.length, 1);
  const [lane] = run.laneNet();
  // a lane is fed while a port of hers lies within half her longest way and LANE_NEAR_PX of the player (a ship on her
  // within reach of the player has one there): 32 pixels off her nearer port, fed; 35, not
  const reach = (x) => { const was = got.length; env.playerTravelPixel = () => ({ x, y: 200 }); return new Function(...names, `${liftFeed()}\nreturn { laneShips };`)(...names.map((k) => env[k])); };
  const at32 = reach(225 + 32); at32.laneShips();
  assert.ok(got.at(-1).list.length > 0, '32 pixels off: fed');
  const at35 = reach(225 + 35); at35.laneShips();
  assert.equal(got.at(-1).list.length, 0, '35 pixels off: not');
  env.playerTravelPixel = () => ({ x: 200, y: 200 });
  assert.deepEqual([lane.a.region, lane.b.region], [7, 8], 'each port\'s region');
  const way = LANES.laneWay(lane, water, (x, z) => { const p = pixelOfNative(x, z); return water(p.x, p.y); });
  const want = LANES.packetsAt(lane, way, 1.7e12);
  const { list } = got[0];
  assert.deepEqual(list.map((l) => l.id), want.map((p) => p.id), 'every packet of the lane');
  const scene = (q) => env.state.localFromWorld(q.x, q.z);
  assert.ok(list.some((l) => Math.hypot(l.pos[0], l.pos[2]) > 1600), 'one far beyond the old list\'s reach');
  for (const l of list) {
    const p = want.find((q) => q.id === l.id);
    assert.deepEqual(l.seeds, p.seeds, 'her seeds');
    assert.equal(l.region, 7, 'her home port\'s region');
    assert.deepEqual(l.leg, p.leg.map(scene), 'her leg in the scene, her way\'s or its reverse');
    const key = (q) => (q ? { key: `port:${q.id}`, name: q.name } : null);
    assert.deepEqual([l.to, l.from, l.port], [key(p.to), key(p.from), key(p.port)], 'her ports by key and name');
  }
});

test('AUDIT BAY A6: AT HER PORT THE CLOCK SAILS HER - within LINER_PORT_M of her leg\'s end she makes for the last open berth of a harbour I know; come early, she lies moored there till her clock sails her on (never her own dwell\'s end); lying at it, kept; sailed on from it, out through its mouth; before, she was steered on past her port for a place beyond it, and a dwell\'s end of her own sailed her (mutants: the arrival never; the wait\'s Infinity dropped; the depart\'s port unread)', async () => {
  const { LINER_PORT_M } = HOST;
  const h = await sea({ hull: null, water: coast, settings: some });
  h.view.feet = [0, 0, 300]; h.deps.harbourNear = () => PORT; h.run(1);
  const harbour = findHarbour({ rect: PORT.rect, isWater: coast });
  const P = under('L1-2.0.13', 23, 0, -800, { leg: [[0, -3000], [0, 0]], to: PORT, from: GLEN });
  h.host.liners([P], { now: 0 });
  const [e] = liners(h);
  assert.ok(e.ship.course && e.ship.errand === null, 'under way, along her leg');
  e.ship.pos = [0, 0, -(LINER_PORT_M - 20)];
  h.host.liners([P], { now: 2 });
  assert.deepEqual([e.ship.errand?.kind, e.ship.errand?.harbour, e.ship.errand?.berth, e.ship.course], ['arrive', PORT.key, harbour.berths.length - 1, null], 'into the last open berth');
  const b = harbour.berths[e.ship.errand.berth];
  e.ship.pos = [b.pos[0], 0, b.pos[1]]; e.ship.speed = 0;
  e.ship.errand = { kind: 'moored', harbour: PORT.key, berth: harbour.berths.length - 1, until: 5, path: null, i: 0 };
  h.host.liners([P], { now: 4 });
  assert.equal(e.ship.errand.until, Infinity, 'come early: she waits for her clock');
  for (let t = 0; t < 10; t++) { h.run(1); h.host.liners([P], { now: 5 + t }); }
  assert.equal(e.ship.errand.kind, 'moored', 'still at her berth');
  h.host.liners([{ ...P, phase: 'dwell', port: PORT, to: GLEN, from: GLEN }], { now: 20 });
  assert.deepEqual([e.ship.errand.kind, e.ship.errand.until], ['moored', Infinity], 'lying at her port: kept');
  h.host.liners([{ ...P, phase: 'sail', from: PORT, to: GLEN, leg: [[0, 0], [0, -3000]], yaw: Math.PI }], { now: 30 });
  assert.deepEqual([e.ship.errand.kind, e.ship.errand.harbour, e.ship.errand.berth], ['depart', PORT.key, harbour.berths.length - 1], 'sailed on: out through its mouth, from her berth');
  e.ship.errand = { kind: 'arrive', harbour: PORT.key, berth: 1, path: null, i: 0 };
  h.host.liners([{ ...P, phase: 'sail', from: PORT, to: GLEN, leg: [[0, 0], [0, -3000]], yaw: Math.PI }], { now: 32 });
  assert.deepEqual([e.ship.errand.kind, e.ship.errand.berth], ['depart', -1], 'coming in as her clock sails her on: out by the mouth, no berth of hers to leave');
  // a berth farther than LINER_PORT_M from her leg's end: moored there, she is at her port still - her clock sails her on
  const far = await sea({ hull: null, water: coast, settings: some });
  far.view.feet = [0, 0, 300]; far.deps.harbourNear = () => PORT; far.run(1);
  const F = under('L1-2.0.24', 34, 0, -700, { leg: [[0, -3000], [0, -1500]], to: PORT, from: GLEN });
  far.host.liners([F], { now: 0 });
  const [fm] = liners(far);
  const fb = harbour.berths[0];
  fm.ship.pos = [fb.pos[0], 0, fb.pos[1]]; fm.ship.speed = 0;
  fm.ship.errand = { kind: 'moored', harbour: PORT.key, berth: 0, until: 5, path: null, i: 0 };
  far.host.liners([F], { now: 2 });
  assert.equal(fm.ship.errand.until, Infinity, 'at her port: waiting for her clock');
  far.host.liners([{ ...F, from: PORT, to: GLEN, leg: [[0, -1500], [0, -3000]], yaw: Math.PI }], { now: 4 });
  assert.equal(fm.ship.errand.kind, 'depart', 'sailed on: out of her berth, far as it lies from her leg');
  // a galley never berths: at her port she lies off it
  const g = await sea({ hull: null, water: coast, settings: some });
  g.view.feet = [0, 0, 300]; g.deps.harbourNear = () => PORT; g.run(1);
  g.host.liners([under('L1-2.0.14', 24, 0, -(LINER_PORT_M - 20), { classId: 'navyGalley', leg: [[0, -3000], [0, 0]], to: PORT })], { now: 0 });
  const [gal] = liners(g);
  assert.deepEqual([gal?.ship.errand?.kind, gal?.ship.errand?.at], ['lurk', [0, 0]], 'a galley lies off her port');
});

test('AUDIT BAY A21: THE LOOKOUT NEVER SOUNDS FOR EVER - a course sounded to a reach or from a start that is no number (a way gone NaN) is no clear course, and the soundings stop; before, they stepped for ever toward it and the sea\'s frame never returned - found by the re-judge (SHIPLIFE-AI-no-hold hung its pins on 168bf2587 alike) (mutants: the guard dropped)', async () => {
  // in a worker of its own, on a clock: soundings that never stop are a failure here, never a hung suite
  const { Worker } = await import('node:worker_threads');
  const url = new URL('../../../src/systems/naval/navalAI.js', import.meta.url).href;
  const code = `const { parentPort } = require('node:worker_threads');
import(${JSON.stringify(url)}).then(({ courseClear }) => { const open = () => true; parentPort.postMessage([
  courseClear([0, 0, 0], 0, NaN, open), courseClear([0, 0, 0], 0, Infinity, open), courseClear([0, 0, 0], 0, 100, open, { from: NaN }),
  courseClear([0, 0, 0], 0, 100, open, { step: 0 }), courseClear([0, 0, 0], 0, 100, open), courseClear([0, 0, 0], 0, 100, (x, z) => z < 50)]); });`;
  const w = new Worker(code, { eval: true });
  const answer = await Promise.race([new Promise((res) => w.once('message', res)), new Promise((res) => setTimeout(() => res(null), 20000))]);
  await w.terminate();
  assert.ok(answer, 'the soundings stopped');
  assert.deepEqual(answer, [false, false, false, false, true, false], 'a reach no number, one without end, a start no number, no step: foul; open water clear; land at 50 m foul');
});

/** A peer's word of one ship (the wire's own record), her captain at `mode`. */
const wordOf = (classId, seed, pos, { mode = 'cruise', state = 'afloat', temper = 'dutiful', n = 1, yaw = 0, speed = 0 } = {}) => WIRE.navalWireRecord({ ships: [{ n, classId, variant: 0, pos, yaw, speed, sails: 0, hull: state === 'afloat' ? 1 : 0.1, sail: 1, crew: 1, state, heel: 0, seed, fire: false, runOut: 0, gen: 0, region: -1, temper, mode, struckTo: -1 }] });
/** One peer's word of several ships, each `[classId, seed, pos, opts]`, numbered in turn. */
const wordOfAll = (...ships) => { const w = wordOf(...ships[0]); for (let i = 1; i < ships.length; i++) { const r = wordOf(ships[i][0], ships[i][1], ships[i][2], { ...ships[i][3], n: i + 1 }); w.s.push(...r.s); w.k.push(...r.k); } return w; };

test('AUDIT BAY A4: NEVER CLAIMED FROM A FIGHT, NOR A RAIDER ANOTHER\'S CHASE HOLDS OR MY LIFE HAS SPENT - a peer far off, their packet or raider beside me is claimed only while she sails about no fight of hers, a raider only one no peer\'s word holds and my life has not spent; her stander near her, never (mutants: the fight unread; the hold unread; the spent unread; the stander\'s feet unread)', async () => {
  const peers = { list: [{ id: 'a', feet: [0, 0, -(LINER_DROP_M + 3000)] }] };
  const x = await sea({ hull: 2, settings: some, online: { id: () => 'b', peers: () => peers.list, sendHit: () => true } });
  const P = under('L1-2.0.16', 31, 300, 0);
  const RA = { id: 'r9.9.9', seed: 0x5eed9, pos: [-300, 0, 0], ahead: [-300, 0, 200], yaw: 0 };
  const hear = (mode) => {
    const w = wordOf('merchantGalleon', 31, [300, 0, 0], { mode });
    const r = wordOf('pirateBrig', RA.seed, [-300, 0, 0], { mode, temper: 'bold', n: 2 });
    w.s.push(...r.s); w.k.push(...r.k);
    assert.equal(x.host.applyWord('a', w), true);
  };
  hear('engage');
  x.host.liners([P], { now: 0 });
  x.host.raiders([RA], { sight: 100, spent: new Set(), held: new Map() });
  assert.ok(bySeed(x, 31)?.owner === 'a' && bySeed(x, RA.seed)?.owner === 'a', 'fighting: neither claimed');
  hear('cruise');
  x.host.raiders([RA], { sight: 100, spent: new Set(), held: new Map([[RA.id, 'a']]) });
  assert.equal(bySeed(x, RA.seed)?.owner, 'a', 'a raider their chase holds: never');
  x.host.raiders([RA], { sight: 100, spent: new Set([RA.id]), held: new Map() });
  assert.equal(bySeed(x, RA.seed)?.owner, 'a', 'a raider my life has spent: never');
  peers.list = [{ id: 'a', feet: [0, 0, 0] }];
  x.host.liners([P], { now: 2 });
  x.host.raiders([RA], { sight: 100, spent: new Set(), held: new Map() });
  assert.ok(bySeed(x, 31)?.owner === 'a' && bySeed(x, RA.seed)?.owner === 'a', 'her stander near her: never');
  peers.list = [{ id: 'a', feet: [0, 0, -(LINER_DROP_M + 3000)] }];
  at(x, [0, 0, LINER_DROP_M + 400]);
  x.host.liners([P], { now: 4 });
  x.host.raiders([{ ...RA, pos: [-300, 0, 0] }], { sight: 100, spent: new Set(), held: new Map() });
  assert.ok(bySeed(x, 31)?.owner === 'a' && bySeed(x, RA.seed)?.owner === 'a', 'past my own reach of her: never');
  at(x, [0, 0, 0]);
  x.host.liners([P], { now: 6 });
  x.host.raiders([RA], { sight: 100, spent: new Set(), held: new Map() });
  assert.ok(!bySeed(x, 31)?.owner && !bySeed(x, RA.seed)?.owner, 'sailing about none, her stander far: both claimed');
});

test('AUDIT BAY A19: A PACKET LET GO OF HER LANE KEEPS THE SEA - her lane no longer listed (her lineage past), she is the sea\'s as any ship: at her berth she lies a dwell of her own out (never moored for ever), lying off a port she goes about an errand of her own; never faded where she was (mutants: the moored left for ever; the lurk kept)', async () => {
  const h = await sea({ hull: null, water: coast, settings: some });
  h.view.feet = [0, 0, 300]; h.deps.harbourNear = () => PORT; h.run(1);
  h.host.liners([under('L1-2.0.17', 27, 0, 100, { classId: 'merchantCarrack', phase: 'dwell', port: PORT, to: GLEN, from: GLEN })], { now: 0 });
  const [m] = liners(h);
  assert.equal(m?.ship.errand?.until, Infinity, 'moored till her clock sails her');
  h.host.liners([], { now: 2 });
  assert.ok(m.liner === null && !m.retiring, 'the sea\'s now, never faded');
  assert.ok(m.ship.errand.kind === 'moored' && Number.isFinite(m.ship.errand.until) && m.ship.errand.until > m.ship.clock, `her own dwell (${m.ship.errand.until})`);
  const g = await sea({ hull: null, water: coast, settings: some });
  g.view.feet = [0, 0, 300]; g.deps.harbourNear = () => PORT; g.run(1);
  g.host.liners([under('L1-2.0.18', 28, 0, -400, { classId: 'merchantGalleon', leg: [[0, -3000], [0, -300]], to: { key: 'port:9', name: 'Sentinel' } })], { now: 0 });
  const [l] = liners(g);
  assert.equal(l?.ship.errand?.kind, 'lurk', 'lying off a port she has no harbour of');
  g.host.liners([], { now: 2 });
  assert.ok(l.liner === null && !l.retiring && l.ship.errand?.kind !== 'lurk', `about an errand of her own (${l.ship.errand?.kind})`);
});

test('AUDIT BAY A18: A PEER\'S PACKET SEEN STRUCK IS SPENT HERE TOO - their word saying her struck, though it says no spent packet (an older build\'s), she is never stood again here once she is gone - seen so at the feed\'s read or between its reads (mutants: a peer\'s copy unspent by the feed; by the frames)', async () => {
  const x = await sea({ hull: 2, settings: some });
  const P = under('L1-2.0.19', 29, 300, 0);
  assert.equal(x.host.applyWord('a', wordOf('merchantGalleon', 29, [300, 0, 0])), true);
  x.host.liners([P], { now: 0 });
  assert.equal(bySeed(x, 29)?.liner?.id, P.id, 'known by her seed');
  const struck = wordOf('merchantGalleon', 29, [300, 0, 0], { state: 'struck', mode: 'struck' });
  delete struck.l;
  assert.equal(x.host.applyWord('a', struck), true);
  x.host.liners([P], { now: 1 });   // the world's feed reads before the frame steps (world.js navalFrame)
  x.run(0.2);
  assert.equal(x.host.applyWord('a', { s: [], v: [], b: [] }), true, 'and gone from their word');
  x.run(0.2);
  assert.ok(bySeed(x, 29) === null, 'gone');
  x.host.liners([P], { now: 2 });
  x.host.liners([P], { now: 4 });
  assert.ok(bySeed(x, 29) === null, 'never stood again');
  // seen struck and gone between the feed's reads (LANE_LIST_MS apart): the frames' own sight of her
  const y = await sea({ hull: 2, settings: some });
  assert.equal(y.host.applyWord('a', wordOf('merchantGalleon', 29, [300, 0, 0])), true);
  y.host.liners([P], { now: 0 });
  assert.equal(y.host.applyWord('a', struck), true);
  y.run(0.2);
  assert.equal(y.host.applyWord('a', { s: [], v: [], b: [] }), true);
  y.run(0.2);
  y.host.liners([P], { now: 2 });
  y.host.liners([P], { now: 4 });
  assert.ok(bySeed(y, 29) === null, 'never stood again by one who saw her struck between the feed\'s reads');
});

test('AUDIT BAY A22: THE LEG SHE SAILS IS HER OWN TILL SHE HAS SAILED IT - a packet behind her clock (her way under the wind short of her schedule\'s) sails on to her port though her clock has her lying there, or sailing home; there, with her clock gone on, she sails at once for where it has her bound; her tag reads her own leg and lies off its end; before, she came about for home short of her port as the clock turned (mutants: her own leg unkept; the clock\'s leg never taken up; her tag by her clock; lying off her clock\'s leg\'s end)', async () => {
  const { LINER_LOOKAHEAD_M, LINER_PORT_M } = HOST;
  const h = await sea({ hull: 2, settings: some });
  const out = [[0, -3000], [0, 3000]], home = [[0, 3000], [0, -3000]];
  const SENT = { key: 'port:9', name: 'Sentinel' };
  const P = under('L1-2.0.20', 30, 0, 0, { leg: out, to: SENT, from: GLEN });
  h.host.liners([P], { now: 0 });
  const [e] = liners(h);
  e.ship.pos = [0, 0, 500];
  const round = (c) => c?.map((q) => +q.toFixed(6));
  h.host.liners([{ ...P, phase: 'dwell', port: SENT, to: GLEN, from: GLEN, pos: [0, 0, 3000] }], { now: 2 });
  assert.deepEqual(round(e.ship.course), [0, 500 + LINER_LOOKAHEAD_M], 'her clock has her lying at her port: on to it');
  h.host.liners([{ ...P, phase: 'sail', to: GLEN, from: SENT, leg: home, pos: [0, 0, 2500], yaw: Math.PI }], { now: 4 });
  assert.deepEqual(round(e.ship.course), [0, 500 + LINER_LOOKAHEAD_M], 'her clock sails her home: on to her port still, never about');
  const tag = (x) => { const t = knowAll(h.host).tags().find((q) => q.id === x.id); return t?.bound; };   // PIN MOVED (SPYGLASS): her colours made out
  h.run(1);
  assert.equal(tag(e), 'bound for Sentinel', 'her tag reads her own leg');
  e.ship.pos = [0, 0, 3000 - LINER_PORT_M + 10];
  h.view.look = { origin: [0, 5, 2300], dir: [0, -0.05, 1] };
  assert.equal(tag(e), 'lying off Sentinel', 'between the feed\'s reads, off her own leg\'s end: lying off her port');
  h.host.liners([{ ...P, phase: 'sail', to: GLEN, from: SENT, leg: home, pos: [0, 0, 2000], yaw: Math.PI }], { now: 6 });
  assert.deepEqual(round(e.ship.course), [0, 3000 - LINER_PORT_M + 10 - LINER_LOOKAHEAD_M], 'at her port, her clock gone on: home at once');
  assert.deepEqual([e.liner.dest?.name, e.ship.errand], ['Glenpoint', null]);
});

test('AUDIT BAY A2: A HULK OF AN EARLIER VOYAGE SPENDS NOT THIS ONE - known by her seed among the lineage, a struck ship is never this voyage\'s packet: her place\'s next ship is stood; and a packet that fights is kept past LINER_DROP_M, never steered (mutants: the struck tagged; the engaging let go)', async () => {
  const h = await sea({ hull: 2, settings: some });
  const old = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 300 }));
  old.ship.seed = 41;   // her place's earlier voyage's
  old.ship.damage.apply({ hull: old.ship.damage.maxHull * 0.8, sail: 0, crew: 0 }, 0);
  h.run(0.5);
  assert.equal(old.ship.damage.state, SHIP_STATES.struck);
  const P = under('L1-2.0.21', 42, 0, 500, { seeds: [42, 41] });
  h.host.liners([P], { now: 0 });
  h.run(0.5);
  h.host.liners([P], { now: 2 });
  assert.ok(old.liner === null || old.liner === undefined, 'the hulk no packet');
  assert.ok(bySeed(h, 42)?.liner?.id === P.id, 'this voyage\'s ship stood');
  // a crown's packet fighting: kept past LINER_DROP_M, never steered
  const n = await sea({ hull: 2, settings: some });
  const N = under('L1-2.0.22', 43, 300, 0, { classId: 'navyCutter' });
  n.host.liners([N], { now: 0 });
  const [c] = liners(n);
  n.run(SHIP_FADE_S + 0.5);
  const p = n.host._sea.get(n.host.spawnShip('pirateBrig', { range: 200, bearing: 1.2, temper: 'bold' }));
  for (let t = 0; t < 30 && c.ship.mode !== 'engage'; t += 0.5) n.run(0.5);
  assert.equal(c.ship.mode, 'engage', `she engages (${c.ship.mode})`);
  c.ship.course = null;
  c.ship.pos = [0, 0, LINER_DROP_M + 300]; p.ship.pos = [0, 0, LINER_DROP_M + 500];
  n.host.liners([N], { now: 2 });
  assert.ok(!c.retiring && c.ship.course === null, 'kept, and her fight hers');
  // a list without a leg (no feed's) stands her, never steers her and never throws
  const q = await sea({ hull: 2, settings: some });
  q.host.liners([{ ...under('L1-2.0.23', 44, 300, 0), leg: null }], { now: 0 });
  const [z] = liners(q);
  assert.ok(z && z.ship.course === null, 'stood, unsteered');
});

test('AUDIT BAY A22: ANOTHER\'S PACKET IS FOLLOWED ALONG HER OWN LEG - known on her clock\'s leg, her copy is followed by where she lies: at her port (moored at a berth of it, however far that lies from her leg\'s end) as her clock sails her on, her tag takes up the next leg; first known under way heading back along her clock\'s leg - behind it by a leg - she is on the leg before it, for the port it left (fighting, lying at a berth or off either port, her clock\'s); taken over, she sails on the leg she was on, her errand her lane\'s; before, a peer\'s copy kept the leg she was first known on for good, and taken over she sailed it again - for the port behind her from mid-lane, or for the nearest harbour\'s berth (mutants: a peer\'s never moved on; her berth unread; the heading unread; the ports read by it; a berth read by it; a fight read by it; SHIP-LIFE\'s errand kept)', async () => {
  const peers = { list: [{ id: 'a', feet: [0, 0, 0] }] };
  const x = await sea({ hull: null, water: coast, settings: some, online: { id: () => 'b', peers: () => peers.list, sendHit: () => true } });
  x.view.feet = [0, 0, 300]; x.deps.harbourNear = () => PORT; x.run(1);
  const harbour = findHarbour({ rect: PORT.rect, isWater: coast });
  const west = [[3000, -400], [-1200, -400]], east = [[-1200, -400], [3000, -400]];
  const P = (id, seed, pos, o = {}) => under(id, seed, pos[0], pos[2], { leg: west, to: PORT, from: GLEN, yaw: -Math.PI / 2, ...o });
  const b0 = [harbour.berths[0].pos[0], 0, harbour.berths[0].pos[1]];
  const L = [P('L1-2.0.40', 60, b0), P('L1-2.0.41', 61, [1000, 0, -400]), P('L1-2.0.42', 62, [-1000, 0, -400]), P('L1-2.0.43', 63, [2800, 0, -400]), P('L1-2.0.44', 64, [1100, 0, -400])];
  const E = Math.PI / 2;   // heading east, back along her clock's leg
  assert.equal(x.host.applyWord('a', wordOfAll(['merchantGalleon', 60, b0, { yaw: E }], ['merchantGalleon', 61, [1000, 0, -400], { yaw: E, speed: 3 }], ['merchantGalleon', 62, [-1000, 0, -400], { yaw: E, speed: 3 }],
    ['merchantGalleon', 63, [2800, 0, -400], { yaw: E, speed: 3 }], ['navyCutter', 64, [1100, 0, -400], { yaw: E, speed: 3, mode: 'engage' }])), true);
  x.host.liners(L, { now: 0 });
  const dest = (seed) => bySeed(x, seed)?.liner?.dest?.key;
  assert.deepEqual([60, 61, 62, 63, 64].map((sd) => bySeed(x, sd)?.owner), ['a', 'a', 'a', 'a', 'a'], 'all a\'s');
  assert.equal(dest(61), GLEN.key, 'under way mid-lane, heading back along her clock\'s leg: the leg before it, for the port it left');
  x.view.look = { origin: [900, 5, -300], dir: [1, -0.05, 0] }; x.run(0.2);
  assert.equal(knowAll(x.host).tags().find((t) => t.id === bySeed(x, 61).id)?.bound, 'bound for Glenpoint', 'and read so');   // PIN MOVED (SPYGLASS): her colours made out
  assert.deepEqual([dest(60), dest(62), dest(63), dest(64)], [PORT.key, PORT.key, PORT.key, PORT.key], 'at a berth, off either port, or fighting: her clock\'s');
  // her clock sails her on: moored at a berth of her port, 1,196 m from her leg's end along it, she has made it
  const home = (l) => ({ ...l, from: PORT, to: GLEN, leg: east, yaw: Math.PI / 2 });
  x.host.liners(L.map(home), { now: 2 });
  assert.equal(dest(60), GLEN.key, 'at her port\'s berth: the next leg hers');
  assert.equal(dest(61), GLEN.key, 'mid-lane on her own: hers still');
  // taken over: a sails far off
  peers.list = [{ id: 'a', feet: [0, 0, -(LINER_DROP_M + 3000)] }];
  x.host.liners(L.map(home), { now: 4 });
  const m = bySeed(x, 61), q = bySeed(x, 60);
  assert.ok(!m.owner && !q.owner, 'taken over where they lie');
  // PUPPET-GLIDE (FIELD BUGS 2026-10-02d): her copy's place between words is her own glide's now, a metre off the eased
  // one - so the point she steers for is read off where she lies: on her leg, LINER_LOOKAHEAD_M ahead along it
  assert.deepEqual([m.ship.errand, Math.round(m.ship.course?.[1])], [null, -400], 'on along the leg she was on - never for a harbour\'s berth');
  assert.ok(Math.abs(m.ship.course[0] - (m.ship.pos[0] + HOST.LINER_LOOKAHEAD_M)) < 2, `nor about: ${HOST.LINER_LOOKAHEAD_M} m ahead along it (${m.ship.course[0].toFixed(1)} from ${m.ship.pos[0].toFixed(1)})`);
  assert.deepEqual([q.ship.errand?.kind, q.ship.errand?.berth], ['depart', 0], 'at her berth, her clock gone on: out of it');
});

test('AUDIT BAY A22: AT HER PORT BY HER ERRAND - moored at a berth of it however far that lies from her leg\'s end, or lying off it though a fight carried her from it, she has made her port, and her clock sails her on; fighting there, her leg is hers till her fight is done; met in her lane again, her errand is her lane\'s - SHIP-LIFE\'s for a harbour\'s berth dropped, lying at a berth or on her way out of a harbour kept; and moored at the port she left, she sails though her port\'s harbour is known (mutants: her errand at her port unread; lying off it unread; the fight unread; SHIP-LIFE\'s errand kept; the moored dropped; the departing dropped; her harbour for any)', async () => {
  const h = await sea({ hull: null, water: coast, settings: some });
  h.view.feet = [0, 0, 300]; h.deps.harbourNear = () => PORT; h.run(1);
  const harbour = findHarbour({ rect: PORT.rect, isWater: coast });
  const west = [[3000, -400], [-1200, -400]], east = [[-1200, -400], [3000, -400]];
  const sailOn = (l, leg) => ({ ...l, from: PORT, to: GLEN, leg, yaw: Math.PI / 2 });
  // moored at a berth beside her leg, 1,196 m short of its end along it
  const P = under('L1-2.0.45', 70, 800, -400, { leg: west, to: PORT, from: GLEN, yaw: -Math.PI / 2 });
  h.host.liners([P], { now: 0 });
  const e = bySeed(h, 70);
  const b = harbour.berths[0];
  e.ship.pos = [b.pos[0], 0, b.pos[1]]; e.ship.speed = 0;
  e.ship.errand = { kind: 'moored', harbour: PORT.key, berth: 0, until: 5, path: null, i: 0 };
  h.host.liners([P], { now: 2 });
  assert.equal(e.ship.errand.until, Infinity, 'at her port: she waits for her clock');
  h.host.liners([sailOn(P, east)], { now: 4 });
  assert.deepEqual([e.ship.errand.kind, e.ship.errand.berth, e.liner.dest?.key], ['depart', 0, GLEN.key], 'her clock sails her on: out of her berth');
  // a galley lying off her port, a fight carried 800 m back along her leg
  const N = [[0, -3000], [0, 0]], S = [[0, 0], [0, -3000]];
  const G = under('L1-2.0.46', 71, 0, -100, { classId: 'navyGalley', leg: N, to: PORT, from: GLEN });
  h.host.liners([G], { now: 6 });
  const g = bySeed(h, 71);
  assert.equal(g.ship.errand?.kind, 'lurk', 'lying off her port');
  g.ship.pos = [0, 0, -800];
  h.host.liners([sailOn(G, S)], { now: 8 });
  assert.deepEqual([g.liner.dest?.key, g.ship.course], [GLEN.key, [0, -1100]], 'her clock sails her on from where she is');
  // fighting at her port: her leg hers till her fight is done
  const F = under('L1-2.0.47', 72, 50, -100, { classId: 'navyGalley', leg: [[50, -3000], [50, 0]], to: PORT, from: GLEN });
  h.host.liners([F], { now: 10 });
  const f = bySeed(h, 72);
  f.ship.mode = 'engage';
  h.host.liners([sailOn(F, [[50, 0], [50, -3000]])], { now: 12 });
  assert.equal(f.liner.dest?.key, PORT.key, 'fighting: her leg kept');
  f.ship.mode = 'cruise';
  h.host.liners([sailOn(F, [[50, 0], [50, -3000]])], { now: 14 });
  assert.equal(f.liner.dest?.key, GLEN.key, 'her fight done, at her port: on');
  // met in her lane again - ships of mine her lane takes up
  const mine = (seed, pos, yaw, errand) => { const x = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 300 })); x.ship.seed = seed; x.ship.pos = pos; x.ship.yaw = yaw; x.ship.speed = 0; x.ship.errand = errand; x.ship.mode = 'cruise'; return x; };
  const out = (id, seed, pos) => under(id, seed, pos[0], pos[2], { leg: east, from: PORT, to: GLEN, yaw: Math.PI / 2 });
  const stray = mine(73, [500, 0, -400], Math.PI / 2, { kind: 'arrive', harbour: PORT.key, berth: 4, path: null, i: 0 });
  const b3 = harbour.berths[3];
  const lying = mine(74, [b3.pos[0], 0, b3.pos[1]], 0, { kind: 'moored', harbour: PORT.key, berth: 3, until: 99, path: null, i: 0 });
  const leaving = mine(75, [60, 0, 150], Math.PI, { kind: 'depart', harbour: PORT.key, berth: 1, path: null, i: 0 });
  h.host.liners([out('L1-2.0.48', 73, stray.ship.pos), out('L1-2.0.49', 74, lying.ship.pos), out('L1-2.0.50', 75, leaving.ship.pos)], { now: 16 });
  assert.deepEqual([stray.ship.errand, stray.ship.course], [null, [800, -400]], 'SHIP-LIFE\'s for a harbour\'s berth dropped: along her leg');
  assert.deepEqual([lying.ship.errand?.kind, lying.ship.errand?.berth], ['depart', 3], 'lying at a berth of the port she left: out of it');
  assert.deepEqual([leaving.ship.errand?.kind, leaving.ship.course], ['depart', null], 'on her way out of a harbour: out of it first');
  // moored at the port she left, her port's harbour known: she sails
  const PORT2 = { key: 'port:3', name: 'Daggerfall', rect: { minX: -2100, maxX: -1900, minZ: 220, maxZ: 420 } };
  h.deps.harbourNear = () => PORT2; h.run(0.5); h.deps.harbourNear = () => PORT;
  const b5 = harbour.berths[5];
  const bound = mine(76, [b5.pos[0], 0, b5.pos[1]], 0, { kind: 'moored', harbour: PORT.key, berth: 5, until: 99, path: null, i: 0 });
  h.host.liners([under('L1-2.0.51', 76, b5.pos[0], b5.pos[1], { leg: [[0, 0], [-2000, 0]], from: PORT, to: { key: PORT2.key, name: PORT2.name }, yaw: -Math.PI / 2 })], { now: 18 });
  assert.deepEqual([bound.ship.errand?.kind, bound.ship.errand?.berth], ['depart', 5], 'out of the port she left for her own');
});
