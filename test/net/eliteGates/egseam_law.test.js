// EG-H3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 10.1, 13.1, 21 and
// 31, EG3 and EG4): THE BOSS SEAM AND THE COURSE AS DATA, PINNED.
//   THE GOLDEN FRAMES - the relay's own words in a gate's court, an Abyss Dungeon's realm and a serpent's cell, played
//     through the real Room over fake objects on a seeded clock and a seeded die, hashed whole: the hashes were taken on
//     the tree before the seam (4f0e71965) and stand unchanged after it - the three bosses re-plugged, frames byte for byte.
//   THE SEAM (net/bossSeam.js) - its seven members, each brain's own where the shapes agreed and a map that hands the
//     brain exactly what the host handed it where they did not; THE TRAILS KEEP Y (the relay's trail, net/bossRef.js
//     posYAt).
//   THE COURSE AS DATA (net/eliteGates/egSpanLaw.js courseOf, world/superDungeon/sdSteps.js SD_COURSE_SPEC) - the Hour's course and every reader's
//     output byte for byte (hashed on the tree before), a made course laid by the same law, every reader fed it; THE
//     PLATFORM CLOCK in one home; THE ORRERY'S ONE JUDGE (net/superDungeon/sdBrain.js orreryJudge), the Hour's words unchanged (the
//     golden Orrery above).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fakeRooms } from '../../fakeRoom.mjs';
import { COURT_CENTRE, BRAIN_TICK_MS, newFight, joinFight, applyHit, stepBrain, stateOf, earned } from '../../../src/net/gate/gateBrain.js';
import { gateTimes, gateRoomKey, gateBossOf, gateModsOf, PIXEL_M } from '../../../src/net/gate/gateLaw.js';
import { GATE_BRAIN_V, SD_BRAIN_V, SD_KEY, SOCIAL_ROOM, worldRoom, PIXEL_UNITS, cellRoomOfWire } from '../../../src/net/wire.js';
import { realmToDungeon, SD_ARENA, SD_STONE_POS, SD_STONE_SETTLE_MS, orreryOf, orrerySolve, orreryShortest, orreryTurn, orreryFresh, orreryStep, orreryJudge, orreryRightsFresh, SD_TURN_LONG_MAX, SD_TURN_COMPANY_MS } from '../../../src/net/superDungeon/sdBrain.js';
import { sdRoomKey } from '../../../src/net/superDungeon/sdLaw.js';
import { SD_OPENING_MS, newRemnantFight, joinRemnant, applyRemnantHit, stepRemnant, remnantStateOf } from '../../../src/net/superDungeon/sdRemnant.js';
import { serpentTimes, SERPENT_BRAIN_V, SERPENT_NATIVE_PER_M } from '../../../src/net/serpent/serpentLaw.js';
import { SERPENT_TICK_MS, SERPENT_OPENING_MS, newSerpentFight, joinSerpentFight, applySerpentHit, stepSerpentBrain, serpentStateOf, serpentEarned } from '../../../src/net/serpent/serpentBrain.js';
import { SD_STEPS_COURSE, SD_CHECKPOINTS, SD_COURSE_END, SD_STEPS_FREE, SD_STEPS_FLOORS, stepAt, beatStands, beatBlinks, beatWarned, spanAt, inBreath, castBackTo, SD_COURSE, SD_COURSE_SPEC, SD_BEAT_CYCLE, SD_BEAT_SOLID, SD_BEAT_BLINK, SD_CRUMBLE_DELAY } from '../../../src/world/superDungeon/sdSteps.js';
import { SD_WAYSTONES, SD_VANE, buildChecksModel, checkFloorTris, buildBreathModel, sdWaystonesOf, sdVaneAt } from '../../../src/world/superDungeon/sdStepsModel.js';
import { SD_GHOST_STEPS, sdGhostVertices, sdGhostStepsOf, SD_GHOSTS_MAX } from '../../../src/render/superDungeon/sdStepsPass.js';
import { SD_HANG_ISLANDS, sdHangIslandsOf, buildHangModel } from '../../../src/world/superDungeon/sdIslandModel.js';
import { sdCastBackSeen, sdRewindEdgesOf } from '../../../src/scenes/superDungeon/sdFx.js';
import { sdMoteAt, sdMoteVertices } from '../../../src/render/superDungeon/sdMotes.js';
import { egPieceAt, courseOf, egDriftDx, egBeatAt, EG_BEAT_CYCLE_S, EG_BEAT_SOLID_S, EG_BEAT_BLINK_S, EG_CRUMBLE_DELAY_S, stepAt as egStepAt, beatStands as egBeatStands, beatBlinks as egBeatBlinks, beatWarned as egBeatWarned } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egCircleSpecs } from '../../../src/net/eliteGates/egLaw.js';
import { BOSS_SEAM_KEYS, bossSeam, GATE_SEAM, SD_SEAM, SERPENT_SEAM } from '../../../src/net/bossSeam.js';
import { judgeGate, judgeRemnant, judgeSerpent, posAt, posAfter, posYAt } from '../../../src/net/bossRef.js';
import { createSdSteps, sdStepKey } from '../../../src/scenes/superDungeon/sdSteps.js';
import { Collider } from '../../../src/player/collider.js';

const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };
const sha = (lines) => createHash('sha256').update(lines.join('\n')).digest('hex');
const ENFORCE = '{"enforce": true}';

/** The relay's die and Math.random seeded (xorshift32) for `fn`'s run - the frames are the brains' over a known die. */
async function seededDie(fn, seed = 0x9e3779b9) {
  const c = globalThis.crypto, realGrv = c.getRandomValues, realRandom = Math.random;
  let s = seed >>> 0;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
  c.getRandomValues = (a) => { for (let i = 0; i < a.length; i++) a[i] = a instanceof Uint32Array ? next() : next() & 0xff; return a; };
  Math.random = () => next() / 4294967296;
  try { return await fn(); } finally { c.getRandomValues = realGrv; Math.random = realRandom; }
}

/** A gate's court played: two fighters `in`, walking and striking for forty seconds of beats, their bodies said, the
 *  Warden brought low and felled. Every gate word both sockets heard. */
async function gateGolden() {
  const DAY = 200, TT = gateTimes(DAY);
  const at = (x, z, extra = {}) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0, ...extra });
  const realNow = Date.now; let clock = TT.openAt + 1000;
  try {
    Date.now = () => clock;
    const r = fakeRooms({ now: () => clock }).room(gateRoomKey(DAY));
    r.env.BOSS_BODY = ENFORCE;
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'gate', ...o }));
    const tick = async () => { clock += BRAIN_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); };
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', at(0, 4)); await r.hello(b, 'peer-0002', at(3, 4));
    await say(a, { k: 'in', lv: 10, bv: GATE_BRAIN_V }); await say(b, { k: 'in', lv: 30, bv: GATE_BRAIN_V });
    for (let i = 0; i < 160; i++) {
      await r.pose(a, at(6 * Math.sin(i * 0.2), 6 * Math.cos(i * 0.2)));
      if (i % 2 === 0) await r.pose(b, at(3 + 2 * Math.sin(i * 0.1), 4 + i * 0.05));
      if (i % 3 === 0) await say(a, { k: 'hit', q: i + 1, d: 35, r: 0 });
      if (i % 5 === 0) await say(b, { k: 'hit', q: i + 1, d: 50, r: 1 });
      if (i % 10 === 0) await say(a, { k: 'vt', v: 1000 });
      await tick();
    }
    r.room._fight.hp = 20;
    await say(a, { k: 'hit', q: 999, d: 40, r: 0 });
    for (let i = 0; i < 8; i++) await tick();
    return [...a.sent, ...b.sent].filter((m) => m.t === 'gate').map((m) => JSON.stringify(m));
  } finally { Date.now = realNow; }
}

/** An Abyss Dungeon's realm opened (the hub's director driven to a found Hollow, SD6b's rig): `fn` gets the realm, its
 *  record, a beat over `ms` and the clock's step; past the Orrery unless `concord` is false. */
async function withRealmOf(fn, { concord = true } = {}) {
  const PX = 300, PY = 200, UNITS_PER_M = PIXEL_UNITS / PIXEL_M, T0 = 1_800_000_000_000;
  const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
  const realNow = Date.now; let clock = T0;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const hub = world.room(SOCIAL_ROOM);
    const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
    const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
    await fire(hub);
    clock = hub.room._sdRec.next;
    for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const c = world.room('chat:r17'); const ws = c.connect(); await c.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
    await fire(hub);
    const rec = hub.store.get(SD_KEY);
    const cell = world.room(worldRoom(PX, PY));
    const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
    await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
    const realm = world.room(sdRoomKey(rec.s));
    realm.env.BOSS_BODY = ENFORCE;
    if (concord) { const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h); }
    const beat = async (ms) => { const end = clock + ms; while (realm.alarm.at != null && realm.alarm.at <= end) { clock = Math.max(clock, realm.alarm.at); await realm.fire(); } clock = end; };
    return await fn({ realm, rec, beat, step: (ms) => { clock += ms; } });
  } finally { Date.now = realNow; }
}
const sdSay = (o) => JSON.stringify({ t: 'sd', ...o });
const inArenaAt = (x = 0, z = -10, extra = {}) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0, ...extra }; };
const atStone = (i) => { const [x, y, z] = realmToDungeon(SD_STONE_POS[i].x, 0, SD_STONE_POS[i].z); return { x, y, z, yaw: 0, pitch: 0 }; };

/** The Brass Remnant's fight: two fighters `in` on the arena, striking for thirty seconds of beats, the Last Moment
 *  brought low and felled. Every fight word heard. */
async function sdGolden() {
  return withRealmOf(async ({ realm, beat }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -6), { name: 'Ann' });
    const bo = realm.connect(); await realm.hello(bo, 'peer-bo', inArenaAt(3, -6), { name: 'Bo' });
    for (const ws of [ann, bo]) await realm.raw(ws, sdSay({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    await beat(SD_OPENING_MS);
    for (let i = 0; i < 120; i++) {
      await realm.pose(ann, inArenaAt(5 * Math.sin(i * 0.15), -6 + 2 * Math.cos(i * 0.15)));
      if (i % 2 === 0) await realm.pose(bo, inArenaAt(3, -6 - (i % 20) * 0.2));
      if (i % 3 === 0) await realm.raw(ann, sdSay({ k: 'hit', q: i + 1, d: 45, r: 0 }));
      if (i % 4 === 0) await realm.raw(bo, sdSay({ k: 'hit', q: i + 1, d: 30, r: 2 }));
      if (i % 10 === 0) await realm.raw(bo, sdSay({ k: 'vt', v: 1000 }));
      await beat(250);
    }
    const f = realm.room._sdFight;
    f.phase = 3; f.outUntil = 0; f.ec = null; f.hp = 30; f.resetAt = Date.now() + 600_000;
    await realm.raw(ann, sdSay({ k: 'hit', q: 999, d: 50, r: 2 }));
    await beat(2000);
    return [...ann.sent, ...bo.sent].filter((m) => m.t === 'sd' && m.k !== 'pz' && m.k !== 'ev').map((m) => JSON.stringify(m));
  });
}

/** THE ORRERY'S HALL, judged by the relay (EG4: the Hour's judge): Ann alone turns her stone the long way ten times, Bo
 *  comes and turns, Ann - who lengthened the road - is held and told; the company's minute passes and Bo spends the
 *  thread to its snap, its lash named; then a stone-keeper at each of the six turns the way to the Concord. Every
 *  hall word heard. */
async function orreryGolden() {
  return withRealmOf(async ({ realm, rec, step }) => {
    const o = orreryOf(rec.s);
    const socks = [];
    const hello = async (id, i) => { const ws = realm.connect(); await realm.hello(ws, id, atStone(i), { name: id.replace('peer-', ''), kind: 'linked' }); socks.push(ws); return ws; };
    let q = 0;
    const turn = async (ws, i, a) => { step(SD_STONE_SETTLE_MS); await realm.raw(ws, sdSay({ k: 'pz', i, a, q: ++q })); };
    const longWay = (i) => (orreryShortest(o, orreryTurn(o, realm.room._sdHall.st, i, 1)) > orreryShortest(o, realm.room._sdHall.st) ? 1 : -1);
    const ann = await hello('peer-ann', 0);
    for (let k = 0; k < 10; k++) await turn(ann, 0, longWay(0));
    const bo = await hello('peer-bo', 1);
    await turn(bo, 1, 1);
    await turn(ann, 0, longWay(0));
    await turn(ann, 0, 1);
    step(4000);
    await turn(ann, 0, 1);
    step(60_000);
    for (let k = 0; k < 60 && realm.room._sdHall.f > 0; k++) await turn(bo, 1, 1);
    await turn(ann, 0, 1);
    const keepers = [ann, bo];
    for (let i = 2; i < 6; i++) keepers.push(await hello(`peer-k${i}`, i));
    const way = orrerySolve(o, realm.room._sdHall.st);
    for (let i = 0; i < 6; i++) for (let k = 0; k < way[i]; k++) await turn(keepers[i], i, 1);
    await turn(ann, 0, 1);
    return socks.flatMap((ws) => ws.sent.filter((m) => m.t === 'sd' && m.k === 'pz').map((m) => JSON.stringify(m)));
  }, { concord: false });
}

/** A serpent's cell: two captains `in` by her waters, sailing and striking for a minute of beats, her health brought low
 *  and her slain. Every serpent word heard. */
async function serpentGolden() {
  const DAY = 363, TT = serpentTimes(DAY), PX = 205, PY = 214;
  const SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS;
  const at = (mx, mz, extra = {}) => ({ x: SX + mx * SERPENT_NATIVE_PER_M, y: 0, z: SZ + mz * SERPENT_NATIVE_PER_M, yaw: 0, pitch: 0, ...extra });
  const IN = (o = {}) => ({ k: 'in', d: DAY, bv: SERPENT_BRAIN_V, lv: 20, hl: 4, sx: SX, sz: SZ, ...o });
  const realNow = Date.now; let clock = TT.riseAt + 20_000;
  try {
    Date.now = () => clock;
    const r = fakeRooms({ now: () => clock }).room(cellRoomOfWire(SX, SZ));
    r.env.BOSS_BODY = ENFORCE;
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'serpent', ...o }));
    const tick = async () => { clock += SERPENT_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); };
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', at(120, 0)); await r.hello(b, 'peer-0002', at(150, 30));
    await say(a, IN()); await say(b, IN({ lv: 30, hl: 2 }));
    for (let i = 0; i < Math.ceil(SERPENT_OPENING_MS / SERPENT_TICK_MS) + 200; i++) {
      await r.pose(a, at(120 + 20 * Math.sin(i * 0.05), 20 * Math.cos(i * 0.05)));
      if (i % 2 === 0) await r.pose(b, at(150 - i * 0.1, 30));
      if (i % 3 === 0) await say(a, { k: 'hit', d: 60, z: 0, r: 0 });
      if (i % 7 === 0) await say(b, { k: 'hit', d: 40, z: 0, r: 1 });
      await tick();
    }
    const f = r.room._serpents.values().next().value;
    f.hp = 10;
    await say(a, { k: 'hit', d: 60, z: 0, r: 0 });
    for (let i = 0; i < 8; i++) await tick();
    return [...a.sent, ...b.sent].filter((m) => m.t === 'serpent').map((m) => JSON.stringify(m));
  } finally { Date.now = realNow; }
}

/** The hashes taken on the tree before the seam (4f0e71965), and how many words each heard. */
const GOLDEN = Object.freeze({
  // PIN MOVED (COURT-WATCH, bible/11-Multiplayer/World-Bosses.md section 24): the answer to an `in` that seats a fighter
  // says so (`me`) - the two answers here; every frame else word for word (`,"me":1` taken out, b834e08b... as before)
  // PIN MOVED (WB14a, bible/11-Multiplayer/Breach-Portents.md section 3): the Warden's new arsenal - his Chains thrown at
  // the seeded fight's fortieth second (their cooldown run from his wake), naming the chained by peer id (`pk`); every frame
  // before it word for word as COURT-WATCH's (05991c48..., 192 frames)
  gate: Object.freeze({ n: 190, h: '3db1852e7b7c714a313ceb3f19790f9cfb0e6348f2599c0905f35c97bdfe9c35' }),
  sd: Object.freeze({ n: 140, h: 'b0019f8f7fd56073923afc19176cba6cf95d3d295840299ee38804d233195ee9' }),
  serpent: Object.freeze({ n: 232, h: '8569aebc4ba221743d3191c8d952bcca99e72e164b032cfd37f00eb613ce3ded' }),
  orrery: Object.freeze({ n: 288, h: '2a803880284730aad89cc34c064edbda5b846e4ffd6c3d76631cb95567ba3bc1' }),
});

test('EG3 THE GOLDEN FRAMES: a gate\'s court, an Abyss Dungeon\'s realm and a serpent\'s cell, played through the real Room on a seeded clock and die, say word for word what they said before the seam - every frame the Warden, the Brass Remnant and the Sea Serpent send, the state, the blows, the health, the phases, the count\'s falls, the fall and its receipts, hashed whole (mutants: any brain\'s call through the seam moved)', async () => {
  const got = {};
  for (const [k, run] of [['gate', gateGolden], ['sd', sdGolden], ['serpent', serpentGolden], ['orrery', orreryGolden]]) {
    const lines = await quiet(() => seededDie(run));
    got[k] = { n: lines.length, h: sha(lines) };
  }
  if (process.env.EGSEAM_PRINT) console.log(JSON.stringify(got));
  assert.deepEqual(got, GOLDEN);
});

/** THE HOUR'S COURSE AND EVERY READER'S OUTPUT, as one record: the course, its checkpoints, its end, its edge's floors;
 *  every step's place and stand over a sweep of the clock; the ghosts and their buffer, the waystones, the vane, the
 *  checkpoints' mesh and floors, the breath, the hang's islands, the rewind's eye, the motes; and the Spire's pieces on
 *  the one clock. Typed arrays as plain lists. */
function courseRecord() {
  const L = (a) => Array.from(a);
  const model = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, ArrayBuffer.isView(v) ? L(v) : v]));
  const ts = Array.from({ length: 80 }, (_, k) => k * 0.37 - 3);
  const steps = SD_STEPS_COURSE.map((st) => ts.map((t) => [...stepAt(st, t), beatStands(st, t), beatBlinks(st, t), beatWarned(st, t)]));
  const zs = Array.from({ length: 60 }, (_, k) => k * 4 - 10);
  const pieces = [];
  // PIN MOVED (EG-ZC): the pieces read off spec law 4's courses - law 5 laid new courses (the Cooling Slag, the shafts), and
  // law 4 is kept byte for byte (test/net/eliteGates/egz_frag.test.js), so the one clock is held over the very pieces it was hashed on
  for (const [seed, c] of [[99, 1], [99, 3], [7, 7], [7, 12], [123, 17]]) for (const spec of egCircleSpecs(seed, c, 0, 4)) for (const st of spec.steps) for (const t of ts.slice(0, 12)) { const o = egPieceAt(st, t); pieces.push([o.dx, o.dz, o.solid]); }
  return {
    course: SD_STEPS_COURSE, checks: SD_CHECKPOINTS, end: SD_COURSE_END, free: SD_STEPS_FREE, floors: SD_STEPS_FLOORS, steps,
    spans: zs.map((z) => spanAt(z)), breath: zs.map((z) => inBreath(z)), back: [0, 1, 2, 5, -1].map((k) => castBackTo(k)),
    ghosts: SD_GHOST_STEPS, ghostV: L(sdGhostVertices()), way: SD_WAYSTONES, vane: SD_VANE,
    checksModel: model(buildChecksModel()), checkTris: L(checkFloorTris()), breathModel: model(buildBreathModel()), hang: SD_HANG_ISLANDS,
    seen: SD_CHECKPOINTS.map((c) => sdCastBackSeen(-40, c.x, c.y, c.z)),
    motes: L(sdMoteVertices()).length, moteAt: [0, 1, 2, 3].map((k) => sdMoteAt(k, 0.3, 0.6, 0.9, 12.5)), pieces,
  };
}
/** The hash of the record before the course was data (4f0e71965). */
const COURSE_GOLDEN = '42895b47b8195775f1b804ffca46164747a3d759bed7dc807114f6a609a6456f';

test('EG4 THE HOUR\'S COURSE, BYTE FOR BYTE: the course, its checkpoints and end, every step\'s place and stand on the clock, and every reader\'s output - the ghosts and their buffer, the waystones, the vane, the checkpoints\' mesh and floors, the breath, the hang, the rewind\'s eye, the motes - and the Spire\'s pieces on the one clock, hashed whole, stand as they stood before the course was data (mutants: the course laid off its spec; a reader fed another course; the clock moved off its law)', () => {
  const h = createHash('sha256').update(JSON.stringify(courseRecord())).digest('hex');
  if (process.env.EGSEAM_PRINT) console.log('course', h);
  assert.equal(h, COURSE_GOLDEN);
});

// ── THE SEAM ──────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG3 THE SEAM: seven members - new, join, hit, step, stateOf, judge, earned - and a boss that lacks one never reaches a host; each brain\'s own function where its shape was the contract\'s (the very reference), and where it was not, a map that hands the brain exactly what the host handed it - the birth records, the gate\'s and the serpent\'s refusals, the serpent\'s zone and a hand\'s own weapons (mutants: a member dropped; an argument mapped wrong; a hand\'s blow on the ship\'s purse)', () => {
  assert.deepEqual([...BOSS_SEAM_KEYS], ['new', 'join', 'hit', 'step', 'stateOf', 'judge', 'earned']);
  const full = Object.fromEntries(BOSS_SEAM_KEYS.map((k) => [k, () => k]));
  const seam = bossSeam('x', { ...full, extra: () => 0 });
  assert.ok(Object.isFrozen(seam));
  assert.deepEqual(Object.keys(seam), ['name', ...BOSS_SEAM_KEYS], 'the contract and its name, nothing else');
  for (const k of BOSS_SEAM_KEYS) { const m = { ...full }; delete m[k]; assert.throws(() => bossSeam('x', m), new RegExp(`keeps no ${k}`)); }
  assert.throws(() => bossSeam('x', { ...full, step: 1 }), /keeps no step/);
  // the brains' own
  assert.deepEqual([GATE_SEAM.hit, GATE_SEAM.step, GATE_SEAM.stateOf, GATE_SEAM.judge, GATE_SEAM.earned], [applyHit, stepBrain, stateOf, judgeGate, earned]);
  assert.deepEqual([SD_SEAM.join, SD_SEAM.hit, SD_SEAM.step, SD_SEAM.stateOf, SD_SEAM.judge, SD_SEAM.earned], [joinRemnant, applyRemnantHit, stepRemnant, remnantStateOf, judgeRemnant, earned], 'the Remnant earns by the gate\'s law');
  assert.deepEqual([SERPENT_SEAM.step, SERPENT_SEAM.stateOf, SERPENT_SEAM.judge, SERPENT_SEAM.earned], [stepSerpentBrain, serpentStateOf, judgeSerpent, serpentEarned]);
  assert.deepEqual([GATE_SEAM.name, SD_SEAM.name, SERPENT_SEAM.name], ['gate', 'sd', 'serpent']);
  // the births
  const T = 1_800_000_000_000, day = 200;
  assert.deepEqual(GATE_SEAM.new({ day, now: T, wrathAt: T + 9e6, boss: gateBossOf(day).id, md: gateModsOf(day) }), newFight(day, T, T + 9e6, gateBossOf(day).id, gateModsOf(day)));
  assert.deepEqual(GATE_SEAM.new({ day, now: T, wrathAt: T + 9e6, boss: 'warden' }), newFight(day, T, T + 9e6, 'warden', null), 'no marks: none');
  assert.deepEqual(SD_SEAM.new({ s: 4, fi: 3, now: T, mk: ['brazen'] }), newRemnantFight(4, 3, T, ['brazen']));
  assert.deepEqual(SD_SEAM.new({ s: 4, fi: 3, now: T }), newRemnantFight(4, 3, T, null));
  assert.deepEqual(SERPENT_SEAM.new({ day: 363, now: T, soundAt: T + 36e5, boss: 'sethrakul', sx: 5, sz: 6, yaw: 0.4 }), newSerpentFight(363, T, T + 36e5, 'sethrakul', 5, 6, 0.4));
  assert.deepEqual(SERPENT_SEAM.new({ day: 363, now: T, soundAt: T + 36e5, boss: 'sethrakul', sx: 5, sz: 6 }), newSerpentFight(363, T, T + 36e5, 'sethrakul', 5, 6, 0));
  // the joins: the same answer, the same fight
  const g1 = newFight(day, T, T + 9e6, 'warden'), g2 = structuredClone(g1);
  assert.equal(GATE_SEAM.join(g1, 'a', 'Ann', 20, T, null, { admits: true }), joinFight(g2, 'a', 'Ann', 20, T, true, null));
  assert.deepEqual(g1, g2);
  assert.equal(GATE_SEAM.join(g1, 'b', 'Bo', 20, T, null, { admits: false }), false, 'the gate sealed: refused');
  assert.equal(joinFight(g2, 'b', 'Bo', 20, T, false, null), false);
  const s1 = newSerpentFight(363, T, T + 36e5, 'sethrakul', 0, 0, 0.4), s2 = structuredClone(s1);
  assert.equal(SERPENT_SEAM.join(s1, 'a', 'Ann', 20, T, null, { hl: 4, admits: true, near: false }), joinSerpentFight(s2, 'a', 'Ann', 20, 4, T, true, null, false));
  assert.equal(SERPENT_SEAM.join(s1, 'b', 'Bo', 30, T, null, { hl: -1, admits: true }), joinSerpentFight(s2, 'b', 'Bo', 30, -1, T, true, null, true), 'near unsaid: near');
  assert.deepEqual(s1, s2);
  assert.ok(s1.players.a.retired && !s1.players.b.retired, 'the far word kept her share out; the near one\'s in');
  // the serpent's blow: its zone and a hand's own weapons (`r` 1)
  const s3 = newSerpentFight(363, T, T + 36e5, 'sethrakul', 0, 0, 0.4);
  joinSerpentFight(s3, 'a', 'Ann', 20, 4, T, true); joinSerpentFight(s3, 'b', 'Bo', 20, -1, T, true);
  const t = T + 15_000, struck = (sub, r, pose) => { const x = structuredClone(s3), y = structuredClone(s3); assert.deepEqual(SERPENT_SEAM.hit(x, sub, 60, r, pose, t, null, { z: 0 }), applySerpentHit(y, sub, 60, 0, pose, t, r === 1)); assert.deepEqual(x, y); return x.players[sub].dealt; };
  assert.equal(struck('a', 0, { x: 80, z: 0 }), 60, 'a captain\'s guns');
  assert.equal(struck('a', 1, { x: 80, z: 0 }), 0, 'a captain\'s own arrows are not heard');
  assert.ok(struck('b', 1, { x: 30, z: 0 }) > 0, 'a hand\'s own weapons');
  assert.equal(struck('b', 0, { x: 30, z: 0 }), 0, 'a hand has no guns');
});

test('EG3 THE TRAILS KEEP Y: the relay\'s trail of a fighter\'s poses hands its judges the height beside the frame\'s two (`[t, x, z, y]`); posAt and posAfter read the two as they did; posYAt reads the height where a body stood - its own with no trail, none where its first pose came after, none from a trail that never said one (mutants: the height dropped; read off the wrong pose)', async () => {
  const DAY = 200, TT = gateTimes(DAY);
  const realNow = Date.now; let clock = TT.openAt + 1000;
  try {
    Date.now = () => clock;
    const r = fakeRooms({ now: () => clock }).room(gateRoomKey(DAY));
    const at = (x, y, z) => ({ x: COURT_CENTRE[0] + x, y, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
    const a = r.connect();
    await quiet(async () => {
      await r.hello(a, 'peer-0001', at(0, 0, 4));
      await r.raw(a, JSON.stringify({ t: 'gate', k: 'in', lv: 10, bv: GATE_BRAIN_V }));
      for (const [x, y, z] of [[1, 0.5, 4], [2, 1.25, 4], [3, 2.75, 5]]) { clock += 100; await r.pose(a, at(x, y, z)); }
    });
    const [b] = r.room._gateBodies(r.room._fight);
    assert.equal(b.tr.length >= 3, true);
    const last = b.tr.slice(-3);
    assert.deepEqual(last.map((p) => p.slice(1)), [[1, 4, 0.5], [2, 4, 1.25], [3, 5, 2.75]], 'the court\'s x and z, then the height');
    const t1 = last[1][0];
    assert.deepEqual(posAt(b, t1), [2, 4]); assert.deepEqual(posAfter(b, t1), [3, 5]);
    assert.equal(posYAt(b, t1), 1.25);
    assert.equal(posYAt(b, t1 - 1), 0.5);
    assert.equal(posYAt({ x: 0, z: 0, y: 7 }, t1), 7, 'no trail: its own');
    assert.equal(posYAt({ x: 0, z: 0 }, t1), null);
    assert.equal(posYAt({ x: 0, z: 0, tr: [[t1 + 1, 0, 0, 3]] }, t1), null, 'all after: not known');
    assert.equal(posYAt({ x: 0, z: 0, tr: [[t1 - 1, 0, 0]] }, t1), null, 'a trail that never said a height');
  } finally { Date.now = realNow; }
});

// ── THE COURSE AS DATA ──────────────────────────────────────────────────────────────────────────────────────────────
const near = (v) => Math.round(v * 1e9) / 1e9;
const nearAll = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? near(v) : v)));
/** A course that is not the Hour's: from a start off the line, a Drift and a Beat, a checkpoint, a riser and a
 *  checkpoint, two Crumbles stepping down to nought. */
const MADE = Object.freeze({
  start: { x: 4, y: 1, z: 10, r: 2 }, x: 4, checkR: 2.5, toEnd: 1.5,
  sections: [
    { pieces: [{ kind: 'drift', gap: 2.6, size: { w: 3, d: 2.4 }, amp: 1, period: 4, phase: 0.5 }, { kind: 'beat', gap: 2.8, size: { w: 3, d: 2.6 }, beat: 1.8 }], check: 3 },
    { pieces: [{ kind: 'riser', gap: 0, size: { w: 3, d: 2.6 }, rise: 2.3 }], check: 2 },
    { pieces: [{ kind: 'crumble', gap: 2.6, size: { w: 2.6, d: 2.6 } }, { kind: 'crumble', gap: 2.4, size: { w: 2.6, d: 2.6 } }], descend: true },
  ],
});

test('EG4 THE COURSE AS DATA: the Hour\'s course is courseOf(SD_COURSE_SPEC) - the record its readers took, frozen whole; a course that is not the Hour\'s is laid by the same law - each piece its gap past the last edge, a riser lifting the course, a checkpoint after its section, a descent stepping evenly to nought, the end past the last edge, every step one shape (mutants: a gap dropped; the riser\'s rise lost; the descent uneven; the checkpoint\'s height wrong; the end short)', () => {
  assert.deepEqual(courseOf(SD_COURSE_SPEC), SD_COURSE);
  assert.ok(Object.isFrozen(SD_COURSE) && Object.isFrozen(SD_COURSE.steps) && SD_COURSE.steps.every(Object.isFrozen) && SD_COURSE.checkpoints.every(Object.isFrozen));
  assert.ok(Object.isFrozen(SD_COURSE_SPEC) && SD_COURSE_SPEC.sections.every((q) => Object.isFrozen(q) && Object.isFrozen(q.pieces) && q.pieces.every(Object.isFrozen)));
  assert.deepEqual(SD_COURSE_SPEC.sections.map((q) => q.pieces.map((p) => p.kind[0]).join('')), ['dddddddd', 'bbbrbbrbb', 'cccccccc']);
  const c = courseOf(MADE);
  const step = (i, kind, span, y, z, w, d, o = {}) => ({ i, kind, span, x: 4, y, z, w, d, amp: 0, period: 0, phase: 0, beat: 0, ...o });
  assert.deepEqual(nearAll(c), {
    steps: [
      step(0, 'drift', 0, 1, 15.8, 3, 2.4, { amp: 1, period: 4, phase: 0.5 }),
      step(1, 'beat', 0, 1, 21.1, 3, 2.6, { beat: 1.8 }),
      step(2, 'riser', 1, 3.3, 31.7, 3, 2.6),
      step(3, 'crumble', 2, 1.65, 43.9, 2.6, 2.6),
      step(4, 'crumble', 2, 0, 48.9, 2.6, 2.6),
    ],
    checkpoints: [{ x: 4, y: 1, z: 10, r: 2 }, { x: 4, y: 1, z: 27.9, r: 2.5 }, { x: 4, y: 3.3, z: 37.5, r: 2.5 }],
    end: 51.7,
  });
  for (const s of c.steps) assert.deepEqual(Object.keys(s), ['i', 'kind', 'span', 'x', 'y', 'z', 'w', 'd', 'amp', 'period', 'phase', 'beat'], 'one shape');
});

test('EG4 EVERY READER FED: the ghosts and their buffer (at most the pass\'s fifteen), the waystones, the vane, the checkpoints\' islands and floors, the breath\'s streaks, the rewind\'s edges and eye, the hang\'s islands, the span, the breath and the cast-back, and the Steps\' riders all take a course - fed a course that is not the Hour\'s, each reads that course; fed none, the Hour\'s (mutants: a reader left on the Hour\'s course; the ghosts past the maximum)', () => {
  const c = courseOf(MADE), [, B1, C2] = c.checkpoints;
  assert.deepEqual(sdGhostStepsOf(c).map((s) => s.i), [1, 3, 4]);
  assert.equal(sdGhostVertices(sdGhostStepsOf(c)).length, 3 * 13 * 6 * 10);
  assert.equal(SD_GHOSTS_MAX, 15);
  const many = Array.from({ length: 20 }, () => c.steps[1]);
  assert.equal(sdGhostVertices(many).length, SD_GHOSTS_MAX * 13 * 6 * 10, 'the pass\'s count a maximum');
  assert.deepEqual(sdWaystonesOf(c), c.checkpoints.map((q) => [q.x - 1.9, q.y, q.z + 0.4]));
  assert.deepEqual(sdVaneAt(c), [C2.x + 1.6, C2.y, C2.z + 1.4]);
  assert.deepEqual(sdVaneAt(SD_COURSE), [...SD_VANE.at]);
  const tris = checkFloorTris(c);
  assert.deepEqual([...tris.slice(0, 3)].map(near), realmToDungeon(B1.x, B1.y, B1.z).map((v) => near(Math.fround(v))), 'its second checkpoint first');
  assert.equal(tris.length, checkFloorTris().length, 'two islands, as the Hour\'s two');
  assert.notDeepEqual(Array.from(tris), Array.from(checkFloorTris()));
  assert.notDeepEqual(Array.from(buildChecksModel(c).positions), Array.from(buildChecksModel().positions));
  const P = buildBreathModel(c).positions;
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 2; i < P.length; i += 3) { z0 = Math.min(z0, P[i]); z1 = Math.max(z1, P[i]); }
  assert.ok(z0 >= C2.z + C2.r - 0.1 && z1 <= c.end + 0.1, 'the breath over the course\'s last span');
  assert.deepEqual(sdRewindEdgesOf(c), c.checkpoints.map((q) => { const d = realmToDungeon(q.x, q.y, q.z); return [d[0], d[2], q.r]; }));
  assert.equal(sdCastBackSeen(-40, B1.x, B1.y, B1.z, c), 1);
  assert.equal(sdCastBackSeen(-40, B1.x, B1.y, B1.z), -1, 'not on the Hour\'s');
  const isl = sdHangIslandsOf(c).filter((q) => q.stage === 'steps');
  assert.deepEqual(isl.map((q) => [q.x, q.y, q.z, q.r]), c.checkpoints.map((q) => [q.x, q.y, q.z, q.r]));
  assert.notDeepEqual(Array.from(buildHangModel('steps', { lite: true, islands: sdHangIslandsOf(c) }).positions), Array.from(buildHangModel('steps', { lite: true }).positions));
  assert.equal(spanAt(B1.z - B1.r + 0.1, c), 1); assert.equal(spanAt(B1.z - B1.r - 0.1, c), 0); assert.equal(spanAt(C2.z, c), 2);
  assert.equal(inBreath(C2.z + C2.r + 0.5, c), true); assert.equal(inBreath(c.end + 0.5, c), false); assert.equal(inBreath(B1.z, c), false);
  assert.deepEqual(castBackTo(1, c), [B1.x, B1.y, B1.z]); assert.deepEqual(castBackTo(9, c), [C2.x, C2.y, C2.z]);
  // the riders: the Steps on a course of their own
  const col = new Collider(() => -Infinity), draws = [];
  const r = createSdSteps({ course: c, renderer: { createMesh: (m) => ({ m }), destroyMesh() {}, uploadTexture() {} }, lite: true });
  assert.deepEqual(r.steps.map((q) => [q.i, q.kind, q.key]), c.steps.map((q) => [q.i, q.kind, sdStepKey(q.i)]));
  r.stand({ dynamicDraws: draws, collider: col });
  for (const q of c.steps) assert.ok(col._buckets.has(sdStepKey(q.i)), `step ${q.i} stood`);
  const body = { pos: realmToDungeon(B1.x, -35, B1.z + 1), grounded: false, height: 1.8, collider: col };
  assert.deepEqual(r.ride(0.5, 0.016, body, true).map(near), realmToDungeon(...castBackTo(-1, c)).map(near), 'cast back on its own first stone');
});

test('EG4 THE PLATFORM CLOCK, ONE HOME: the Steps\' stepAt, beatStands, beatBlinks and beatWarned are the span law\'s own, its Beat and Crumble numbers theirs; the Spire\'s pieces move by the same swing and the same beat (mutants: the clock copied apart; a swing or a beat off its law)', () => {
  assert.deepEqual([stepAt, beatStands, beatBlinks, beatWarned], [egStepAt, egBeatStands, egBeatBlinks, egBeatWarned]);
  assert.deepEqual([SD_BEAT_CYCLE, SD_BEAT_SOLID, SD_BEAT_BLINK, SD_CRUMBLE_DELAY], [EG_BEAT_CYCLE_S, EG_BEAT_SOLID_S, EG_BEAT_BLINK_S, EG_CRUMBLE_DELAY_S]);
  assert.deepEqual([EG_BEAT_CYCLE_S, EG_BEAT_SOLID_S, EG_BEAT_BLINK_S, EG_CRUMBLE_DELAY_S], [3.6, 2.4, 0.4, 0.7]);
  const drift = SD_COURSE.steps.find((q) => q.kind === 'drift' && q.phase > 0), beat = SD_COURSE.steps.find((q) => q.kind === 'beat' && q.beat > 0);
  for (let t = -4; t < 16; t += 0.23) {
    assert.equal(egPieceAt(drift, t).dx, stepAt(drift, t)[0] - drift.x);
    assert.equal(egDriftDx(drift, t), drift.amp * Math.sin((2 * Math.PI * t) / drift.period + drift.phase));
    assert.equal(egPieceAt(beat, t).solid, beatStands(beat, t));
    assert.equal(egBeatAt(beat, t), (((t - beat.beat) % 3.6) + 3.6) % 3.6);
    assert.equal(beatBlinks(beat, t), egBeatAt(beat, t) >= 2.0 && egBeatAt(beat, t) < 2.4);
  }
});

// ── THE ORRERY'S ONE JUDGE ──────────────────────────────────────────────────────────────────────────────────────────
test('EG4 THE ORRERY\'S ONE JUDGE (orreryJudge): nothing while the stone\'s gear settles or the Concord holds; the turn otherwise, orreryStep\'s own; under the stones\' rights a turner that lengthened the road its six times waits while another turns, and every turn taken is counted to its turner by the road; with no rights (the Spire\'s company) nobody waits (mutants: the settle skipped; the Concord turned; the rights unasked; a turn uncounted)', () => {
  const o = orreryOf(3), lock = orreryFresh(o), last = [0, 0, 0, 0, 0, 0];
  assert.equal(orreryJudge(o, lock, last, 0, 1, SD_STONE_SETTLE_MS - 1), null, 'its gear still settling');
  const res = orreryJudge(o, lock, last, 0, 1, SD_STONE_SETTLE_MS);
  assert.deepEqual(res, { wait: false, ...orreryStep(o, lock, 0, 1) });
  assert.equal(orreryJudge(o, { ...lock, ok: true }, last, 0, 1, 10_000), null, 'the Concord holds');
  assert.equal(orreryJudge(o, lock, [0, 9000, 0, 0, 0, 0], 1, 1, 9000 + SD_STONE_SETTLE_MS - 1), null, 'each stone its own gear');
  // the rights
  const R = orreryRightsFresh();
  let st = lock;
  /** a turn that lengthens the road from where the stones stand (a stone at its farthest lengthens neither way) */
  const longTurn = () => { for (let i = 0; i < 6; i++) for (const a of [1, -1]) if (orreryShortest(o, orreryTurn(o, st.st, i, a)) > orreryShortest(o, st.st)) return [i, a]; return null; };
  for (let k = 0; k < SD_TURN_LONG_MAX; k++) { const [i, a] = longTurn(); const r = orreryJudge(o, st, last, i, a, 10_000 + k * 1000, R, 'a:ann', 'peer-ann'); assert.equal(r.wait, false); st = r; }
  assert.equal(R.by['a:ann'].long, SD_TURN_LONG_MAX, 'every long turn counted');
  assert.equal(R.ids['peer-ann'], SD_TURN_LONG_MAX);
  const bo = orreryJudge(o, st, last, 1, 1, 20_000, R, 'a:bo', 'peer-bo');
  assert.equal(bo.wait, false); st = bo;
  assert.deepEqual(orreryJudge(o, st, last, 0, 1, 21_000, R, 'a:ann', 'peer-ann'), { wait: true }, 'held while another turns');
  assert.equal(orreryJudge(o, { ...st, ok: true }, last, 0, 1, 21_000, R, 'a:ann', 'peer-ann'), null, 'the Concord holds before any right is asked');
  assert.equal(orreryJudge(o, st, last, 0, 1, 21_000, null).wait, false, 'no rights: no wait');
  assert.equal(orreryJudge(o, st, last, 0, 1, 21_000 + SD_TURN_COMPANY_MS, R, 'a:ann', 'peer-ann').wait, false, 'the company gone quiet: free again');
});
