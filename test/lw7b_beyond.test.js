// LW7b (2026-10-05, bible/06-Systems/Living-World.md "LW7b", Mac: "make friends or enemies"): THE ARMED BEYOND THE
// WALLS - an armed traveller who counts the player hostile draws on them, an armed friend comes to their fight, and the
// end is what happens (the slain, the died at their side); a roadside fight's enemies keep the ring; a diving company's
// hostile draws on the player in the dungeon and its enemies keep away - over mock pools and the synthetic map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { livingMap, partiesOver } from './lwRoads.mjs';
import { createRoadStands, DRAW_M, HELP_M, KEEP_M, CALM_S, FIGHT_NEAR_M } from '../src/scenes/roadStands.js';
import { createRoadFights } from '../src/scenes/roadFights.js';
import { createDungeonDivers } from '../src/scenes/dungeonDivers.js';
import { createLivingRoads } from '../src/scenes/livingRoads.js';
import { createRelations, EVENTS } from '../src/systems/livingWorld/relations.js';
import { partyAt, membersAt, CALENDAR_MPM, NATIVE_PER_M } from '../src/systems/livingWorld/trips.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));
const T = 500 * DAY_MIN + 600, DAY = 500;
const hostile = (rel, id) => rel.note(id, 'slain', DAY);
const enemy = (rel, id) => rel.note(id, 'struck', DAY);
const friend = (rel, id) => { rel.note(id, 'saved', DAY); rel.note(id, 'helped', DAY); };

/** A stands layer over a mock pool. */
function standRig({ ready = true, fighting = false } = {}) {
  const pool = new Set(), spawned = [], removed = [], said = [], slays = [], dieds = [];
  const can = { ready, fighting, refuse: false };
  const rel = createRelations();
  const stands = createRoadStands({
    spawn: async (type, feet, o) => { if (can.refuse) return null; const rec = { mobileType: type, feet, o, dead: false, entity: {} }; pool.add(rec); spawned.push(rec); return rec; },
    remove: (rec) => { pool.delete(rec); removed.push(rec); },
    inPool: (rec) => pool.has(rec),
    ready: () => can.ready, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40],
    relations: () => rel, slay: (res, t, seen) => slays.push({ res, t, seen }), died: (res, t) => dieds.push({ res, t }),
    fighting: () => can.fighting, say: (t) => said.push(t),
  });
  return { stands, pool, spawned, removed, said, slays, dieds, rel, can };
}
const ADA = { id: 'L9.t1', name: 'Ada Lark', cls: null };
const BO = { id: 'L9.t4', name: 'Bo Reed', cls: 140, level: 9, sex: 'male' };
const CY = { id: 'L9.t5', name: 'Cy Fenn', cls: 135, level: 7, sex: 'female' };
const roadTrip = () => ({ id: 'L9.t1:50', party: [ADA, BO, CY], fallen: [] });
const HERE = { x: 100000, z: 200000 };
const cand = (trip, m, dM) => ({ res: m, trip, x: HERE.x + dM * NATIVE_PER_M, z: HERE.z, yaw: 0.5 });

test('LW7b an armed enemy draws: a member who counts the player HOSTILE within DRAW_M is stood as a foe of the pool\'s own - their class, level, sex and name, where they walked, facing their way - once; an enemy short of hostile, the unarmed, one past the reach, nothing able to stand, the sky: none; cut down, SLAIN (seen) and their party\'s living turned; the dead the pool\'s own; let go past KEEP_M or when nothing can stand; a body the pool would not stand is tried once and drawn again; clear() (mutants: the reach, the standing, the armed, the gate, the body, the end, the party, the let go, the failed)', async () => {
  assert.equal(DRAW_M, 45);
  assert.equal(KEEP_M, 200);
  const rig = standRig();
  const trip = roadTrip();
  hostile(rig.rel, BO.id);
  hostile(rig.rel, ADA.id);
  enemy(rig.rel, CY.id);
  rig.stands.frame([cand(trip, ADA, 5), cand(trip, BO, 30), cand(trip, CY, 10)], HERE, T);
  await settle();
  assert.equal(rig.spawned.length, 1, 'the hostile armed alone: not the unarmed, not an enemy short of hostile');
  const rec = rig.spawned[0];
  assert.equal(rec.mobileType, BO.cls);
  assert.deepEqual(rec.o, { yaw: 0.5, level: 9, allied: false, gender: 'male' });
  assert.deepEqual(rec.feet, [(HERE.x + 30 * NATIVE_PER_M) / 40, 0, HERE.z / 40], 'where they walked');
  assert.equal(rec.living.id, BO.id);
  assert.equal(rec.entity.name, 'Bo Reed');
  assert.ok(rig.stands.stood(BO.id) && !rig.stands.stood(CY.id));
  assert.deepEqual(rig.said, ['Bo draws on you!']);
  rig.stands.frame([cand(trip, BO, 30)], HERE, T + 1);
  await settle();
  assert.equal(rig.spawned.length, 1, 'once');
  // past the reach, the sky, nothing able to stand
  const far = standRig();
  hostile(far.rel, BO.id);
  far.stands.frame([cand(trip, BO, DRAW_M + 1)], HERE, T);
  far.stands.frame([cand(trip, BO, 10)], HERE, T, { ground: false });
  far.can.ready = false;
  far.stands.frame([cand(trip, BO, 10)], HERE, T);
  far.stands.frame([cand(trip, BO, 10)], null, T);
  await settle();
  assert.equal(far.spawned.length, 0, 'past DRAW_M, from the sky, nothing able to stand, nowhere');
  // cut down: slain, seen, their party's living turned; the body the pool's own
  rec.dead = true;
  rig.stands.frame([], HERE, T + 2);
  assert.deepEqual(rig.slays, [{ res: BO, t: T + 2, seen: true }]);
  assert.equal(rig.rel.regard(CY.id, DAY), Math.max(-100, EVENTS.struck + EVENTS.slain), 'their party turned against the player');
  assert.equal(rig.rel.regard(ADA.id, DAY), Math.max(-100, 2 * EVENTS.slain));
  assert.ok(!rig.stands.stood(BO.id), 'the stand over');
  assert.ok(rig.pool.has(rec) && !rig.removed.includes(rec), 'the dead the pool\'s own');
  rig.stands.frame([], HERE, T + 3);
  assert.equal(rig.slays.length, 1, 'slain once');
  // let go: the player gone past KEEP_M, nothing able to stand
  const go = standRig();
  hostile(go.rel, BO.id);
  go.stands.frame([cand(trip, BO, 20)], HERE, T);
  await settle();
  go.stands.frame([], { x: HERE.x + (KEEP_M - 5) * NATIVE_PER_M, z: HERE.z }, T + 1);
  assert.ok(go.stands.stood(BO.id), 'held within KEEP_M');
  go.stands.frame([], { x: HERE.x + (KEEP_M + 25) * NATIVE_PER_M, z: HERE.z }, T + 2);
  assert.ok(!go.stands.stood(BO.id) && go.removed.includes(go.spawned[0]), 'let go past it, the body taken out');
  const off = standRig();
  hostile(off.rel, BO.id);
  off.stands.frame([cand(trip, BO, 20)], HERE, T);
  await settle();
  off.can.ready = false;
  off.stands.frame([], HERE, T + 1);
  assert.ok(off.removed.includes(off.spawned[0]), 'nothing able to stand: let go');
  // the pool would not: tried once, the roads draw them again
  const no = standRig();
  hostile(no.rel, BO.id);
  no.can.refuse = true;
  no.stands.frame([cand(trip, BO, 20)], HERE, T);
  await settle();
  assert.ok(!no.stands.stood(BO.id), 'drawn again');
  no.can.refuse = false;
  no.stands.frame([cand(trip, BO, 20)], HERE, T + 1);
  await settle();
  assert.equal(no.spawned.length, 0, 'not tried again while the stand stands');
  assert.equal(no.said.length, 1);
  // clear: every standing body out
  const cl = standRig();
  hostile(cl.rel, BO.id);
  cl.stands.frame([cand(trip, BO, 20)], HERE, T);
  await settle();
  cl.stands.clear();
  assert.equal(cl.stands.size, 0);
  assert.ok(cl.removed.includes(cl.spawned[0]));
  const cd = standRig();
  hostile(cd.rel, BO.id);
  cd.stands.frame([cand(trip, BO, 20)], HERE, T);
  await settle();
  cd.spawned[0].dead = true;
  cd.stands.clear();
  assert.ok(cd.pool.has(cd.spawned[0]), 'a body fallen before the clear stays the pool\'s');
});

test('LW7b an armed friend comes: a FRIEND within HELP_M while the player is fighting (a foe on them within FIGHT_NEAR_M, the host\'s) is stood at their side - allied (team PlayerAlly, a shipmate), by name - and goes back to their party when the fight has been done CALM_S; cut down, they DIED at the player\'s side; no fight, or past the reach, none (mutants: the fight, the reach, the ally, the calm, the died)', async () => {
  assert.equal(HELP_M, 70);
  assert.equal(CALM_S, 8);
  assert.equal(FIGHT_NEAR_M, 30);
  const rig = standRig();
  const trip = roadTrip();
  friend(rig.rel, CY.id);
  rig.stands.frame([cand(trip, CY, 60)], HERE, T);
  await settle();
  assert.equal(rig.spawned.length, 0, 'no fight: they walk on');
  rig.can.fighting = true;
  rig.stands.frame([cand(trip, CY, HELP_M + 2)], HERE, T);
  await settle();
  assert.equal(rig.spawned.length, 0, 'past HELP_M');
  rig.stands.frame([cand(trip, CY, 60)], HERE, T);
  await settle();
  assert.equal(rig.spawned.length, 1);
  const rec = rig.spawned[0];
  assert.equal(rec.o.allied, true);
  assert.equal(rec.shipmate, true);
  assert.equal(rec.entity.team, 'PlayerAlly');
  assert.equal(rec.entity.mobileTeam, 'PlayerAlly');
  assert.equal(rec.entity.name, 'Cy Fenn');
  assert.deepEqual(rig.said, ['Cy comes to your side.']);
  rig.can.fighting = false;
  rig.stands.frame([], HERE, T + 1, { dt: CALM_S / 2 });
  assert.ok(rig.stands.stood(CY.id), 'the fight not long done');
  rig.can.fighting = true;
  rig.stands.frame([], HERE, T + 2, { dt: 1 });
  rig.can.fighting = false;
  rig.stands.frame([], HERE, T + 3, { dt: CALM_S / 2 + 0.5 });
  assert.ok(rig.stands.stood(CY.id), 'a fight again sets the calm back');
  rig.stands.frame([], HERE, T + 4, { dt: CALM_S / 2 });
  assert.ok(!rig.stands.stood(CY.id) && rig.removed.includes(rec), 'CALM_S after: back to their party');
  // cut down at the player's side
  const d = standRig({ fighting: true });
  friend(d.rel, CY.id);
  d.stands.frame([cand(trip, CY, 20)], HERE, T);
  await settle();
  d.spawned[0].dead = true;
  d.stands.frame([], HERE, T + 5);
  assert.deepEqual(d.dieds, [{ res: CY, t: T + 5 }]);
  assert.equal(d.slays.length, 0, 'not the player\'s hand');
  assert.ok(d.pool.has(d.spawned[0]), 'the dead the pool\'s own');
});

test('LW7b the roads hand the stands their armed: each armed member of a party on the road where they walk (none of a party at its fight, none from the sky), at the frame\'s minute; a member stood is not drawn; the roads\' clear clears the stands (mutants: the armed, the fight, the sky, the skip, the clear)', () => {
  const map = livingMap();
  const o = { mpm: CALENDAR_MPM, memo: new Map() };
  const trips = partiesOver(map, 400, 470, o);
  const P = trips.find((tr) => !tr.dive && !tr.enc && tr.party.some((m) => m.cls != null) && tr.party.some((m) => m.cls == null));
  assert.ok(P, 'a party with armed and unarmed, untroubled');
  const m = Math.floor((P.outT0 + P.outT1) / 2);
  const at = partyAt(P, m);
  const got = [];
  let cleared = 0;
  const armedOf = membersAt(P, m).filter((x) => x.cls != null);
  const skip = armedOf[0].id;
  const stands = { frame: (cands, here, t, f) => got.push({ cands, here, t, f }), stood: (id) => id === skip, clear: () => { cleared++; } };
  const synced = [];
  const sprites = { sync: (list) => { synced.length = 0; synced.push(...list.map((x) => ({ ...x }))); }, batches: () => [], persons: () => [], bodyOf: () => null, clear() {} };
  const roads = createLivingRoads({ world: map.world, mpm: CALENDAR_MPM, clock: () => m, baseRate: () => 0.2, sceneOf: (x, z) => [x / 40, 0, z / 40], here: () => ({ x: at.x, z: at.z }),
    sprites, memo: o.memo, stands });
  roads.frame(0.1, [0, 0, 0]);
  assert.equal(got.length, 1);
  const mine = got[0].cands.filter((c) => c.trip.id === P.id);
  assert.deepEqual(mine.map((c) => c.res.id).sort(), armedOf.map((x) => x.id).sort(), 'the armed alone');
  assert.ok(mine.every((c) => Number.isFinite(c.x) && Number.isFinite(c.z) && Math.hypot(c.x - at.x, c.z - at.z) < 3000), 'where they walk');
  assert.equal(got[0].t, m);
  assert.deepEqual(got[0].f, { dt: 0.1, ground: true });
  assert.ok(!synced.some((x) => x.key === skip), 'a stood member is the pool\'s to draw');
  assert.ok(synced.some((x) => x.key === armedOf[armedOf.length - 1].id || armedOf.length === 1), 'the rest drawn');
  // the Overworld up: nothing handed, the stands told it is not the ground
  roads.frame(0.1, [0, 0, 0], { overworld: { grow: 4, blend: 1 } });
  assert.deepEqual(got[1].cands, []);
  assert.equal(got[1].f.ground, false);
  // a party at its fight hands none: that is the fights'
  const B = trips.find((tr) => tr.enc && !tr.enc.camp && !tr.dive && tr.party.some((x) => x.cls != null));
  assert.ok(B, 'a party beset');
  const bm = B.enc.t0 + 2;
  const bat = partyAt(B, bm);
  assert.ok(bat.fight);
  const got2 = [];
  const roads2 = createLivingRoads({ world: map.world, mpm: CALENDAR_MPM, clock: () => bm, baseRate: () => 0.2, sceneOf: (x, z) => [x / 40, 0, z / 40], here: () => ({ x: bat.x, z: bat.z }),
    sprites, memo: o.memo, stands: { frame: (cands) => got2.push(cands), stood: () => false, clear() {} } });
  roads2.frame(0.1, [0, 0, 0]);
  assert.ok(!got2[0].some((c) => c.trip.id === B.id), 'a party at its fight: the fights\'');
  roads.clear();
  assert.equal(cleared, 1, 'the roads\' clear clears the stands');
});

test('LW7b a roadside fight\'s enemies keep the ring: a member of a beset party who counts the player an enemy (or hostile) is not stood beside them - the rest are (mutants: the enemy stood)', async () => {
  const pool = new Set(), spawned = [];
  const rel = createRelations();
  enemy(rel, BO.id);
  const fights = createRoadFights({
    spawn: async (type, feet, o) => { const rec = { mobileType: type, feet, o, dead: false, entity: {} }; pool.add(rec); spawned.push(rec); return rec; },
    remove: (rec) => pool.delete(rec), inPool: (rec) => pool.has(rec),
    owner: () => true, ready: () => true, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40],
    clock: () => T, relations: () => rel, turnKeyOf: (res) => `${res.id}@K`, dies: () => false,
  });
  const trip = { id: 'L9.t1:50', kind: 'merchant', leader: ADA, party: [ADA, BO, CY], enc: { id: 'L9.t1:50:e', foes: [7, 7], level: 6, t0: T - 10, t1: T + 50, fightEnd: T + 15, x: 40000, z: 80000 }, fallen: [] };
  fights.frame([{ trip, at: { x: trip.enc.x, z: trip.enc.z, fight: true } }], { x: trip.enc.x + 1000, z: trip.enc.z }, T);
  await settle();
  const allies = spawned.filter((r) => r.o.allied);
  assert.deepEqual(allies.map((r) => r.mobileType), [CY.cls], 'the enemy keeps the ring');
  assert.equal(spawned.filter((r) => !r.o.allied).length, 2, 'the foes stood as ever');
});

test('LW7b a company\'s regard in the deep: one who counts the player HOSTILE draws on them (the dungeon\'s loose stand, not allied, before the player, by name) and the rest keep to their dive; cut down, SLAIN and the company\'s living turned; their hours done the dead stay the pool\'s, the living go; with none hostile its enemies keep away and the rest stand with the player; a company all enemies passes by (mutants: the hostile, the foe stand, the slain, the company, the dead kept, the enemies, the pass-by)', async () => {
  const rig = (setup) => {
    const pool = new Set(), spawned = [], foes = [], said = [], slays = [];
    const rel = createRelations();
    setup(rel);
    const divers = createDungeonDivers({
      spawn: async (type, feet, o) => { const rec = { mobileType: type, feet, o, dead: false, entity: {}, ai: {} }; pool.add(rec); spawned.push(rec); return rec; },
      spawnFoe: async (type, feet, o) => { const rec = { mobileType: type, feet, o, dead: false, entity: {}, ai: {} }; pool.add(rec); foes.push(rec); return rec; },
      remove: (rec) => pool.delete(rec), inPool: (rec) => pool.has(rec),
      leader: () => ({ feet: [0, 0, 0], yaw: 0 }), spot: (from, dx, dz) => [from[0] + dx, from[1], from[2] + dz],
      owner: () => true, relations: () => rel, turnKeyOf: (res) => `${res.id}@K`, dies: () => false, day: () => DAY,
      say: (t) => said.push(t), slay: (res, t, seen) => slays.push({ res, t, seen }),
    });
    return { divers, pool, spawned, foes, said, slays, rel };
  };
  const LEAD = { id: 'L5.t2', name: 'Ada Lark', cls: 140, level: 12, sex: 'female' };
  const MATE = { id: 'L5.t6', name: 'Bo Reed', cls: 136, level: 8, sex: 'male' };
  const company = () => ({ trip: { id: 'L5.t2:60', leader: LEAD, party: [LEAD, MATE], to: { name: 'Mournoth' }, backT0: 2000, outT0: 100, fallen: [] }, members: [LEAD, MATE] });
  const h = rig((rel) => hostile(rel, MATE.id));
  const c = company();
  h.divers.frame([c], 1000);
  await settle();
  assert.equal(h.spawned.length, 0, 'the rest keep to their dive');
  assert.equal(h.foes.length, 1);
  const f = h.foes[0];
  assert.equal(f.mobileType, MATE.cls);
  assert.equal(f.entity.name, 'Bo Reed');
  assert.equal(f.living.id, MATE.id);
  assert.ok(f.feet[2] > 0, 'before the player');
  assert.deepEqual(h.said, ['Ada Lark\'s company - and Bo draws on you!']);
  f.dead = true;
  h.divers.frame([c], 1001);
  assert.deepEqual(h.slays, [{ res: MATE, t: 1001, seen: true }]);
  assert.equal(h.rel.regard(LEAD.id, DAY), EVENTS.slain, 'the company\'s living turned');
  h.divers.frame([c], 1002);
  assert.equal(h.slays.length, 1, 'once');
  h.divers.frame([c], 2000);
  assert.ok(h.pool.has(f), 'their hours done: the dead stay the pool\'s');
  // a living foe goes with the company
  const g = rig((rel) => hostile(rel, MATE.id));
  g.divers.frame([company()], 1000);
  await settle();
  g.divers.frame([company()], 2000);
  assert.ok(!g.pool.has(g.foes[0]), 'the living go');
  // enemies keep away; all enemies pass by
  const e = rig((rel) => enemy(rel, MATE.id));
  e.divers.frame([company()], 1000);
  await settle();
  assert.deepEqual(e.spawned.map((r) => r.mobileType), [LEAD.cls], 'the enemy keeps away');
  assert.equal(e.foes.length, 0);
  const all = rig((rel) => { enemy(rel, MATE.id); enemy(rel, LEAD.id); });
  all.divers.frame([company()], 1000);
  await settle();
  assert.equal(all.spawned.length + all.foes.length, 0);
  assert.deepEqual(all.said, ['Ada Lark\'s company passes you by.']);
});

test('LW7b the streaming host: the stands on the roads (the pool\'s loose transient body, allied for a friend; the fights\' own gate; the hand turns; the fight a foe on the player within FIGHT_NEAR_M by the threat law; the HUD line); a death at the player\'s side; the divers\' foe stand and the slaying (mutants: each seam)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /stands: createRoadStands\(\{\n\s*spawn: \(type, feet, o\) => exteriorFoes\.spawnFoe\(type, feet, \{ allied: o\.allied, yaw: o\.yaw, gender: o\.gender, level: o\.level, loose: true, transient: true \}\),/);
  assert.match(w, /slay: livingSlay, died: livingDied,\n\s*deadAt: livingDeadAt,[^\n]*\n\s*fighting: \(\) => hccThreats\(\)\.some\(\(q\) => Math\.hypot\(q\[0\] - player\.pos\[0\], q\[2\] - player\.pos\[2\]\) <= FIGHT_NEAR_M\),\n\s*say: \(text\) => townTalk\.say\(text\),/);
  assert.match(w, /const livingDied = \(res, t\) => \{ livingRelations\.turn\('died', turnKey\(res, livingCycleOf\(res, Math\.floor\(\(t - 240\) \/ 1440\)\)\), \{ t, who: res\.name \}\); \};/);
  assert.match(w, /spawnFoe: \(type, feet, o\) => d\.spawnLooseFoe\(type, feet, \{ yawRad: o\.yaw, allied: false, gender: o\.gender, level: o\.level \}\),/);
  assert.match(w, /spawnFoe: [^\n]*\n\s*slay: livingSlay,\n\s*died: livingDied,[^\n]*\n\s*\}\), \{ pool: d \}\);/);
  const lr = rd('src/scenes/livingRoads.js');
  assert.match(lr, /if \(deps\.stands\?\.stood\(m\.res\.id\)\) continue;/);
  assert.match(lr, /deps\.fights\?\.clear\(\); deps\.stands\?\.clear\(\);/);
});
