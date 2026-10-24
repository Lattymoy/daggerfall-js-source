// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md sections 4-7): THE VOYAGE'S DIRECTOR, RUN WHOLE - a crew taken
// aboard once, the Boarding Watch's three waves, the Gallery's Hammer Wardens asleep at their posts, THE STARVED ENGINE
// (a cell taken, carried, set; dropped struck, fallen, carried off its floor; lying and bleeding out; its cradle charging
// again; the spiders' bound), the Sailwalk unbarring the bridge, and the Tonal Warden felled - its Discord's resonators
// put right with the bridge's own cells, its forks broken, its fall owed to the crew - and a fight lost and begun again.
// tools/mutants/ketch_brain.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newVoyage, joinVoyage, stepVoyage, voyageWord, voyageStateOf, voyageEarners, watchWave, spidersMaxFor, cellsWord,
  KT_WATCH_WAIT_MS, KT_WAVE_GAP_MS, KT_RISE_MS, KT_CELL_LIES_MS, KT_DOWN_KEEP_MS, KT_CRADLE_BACK_MS, KT_BRIDGE_CRADLE_BACK_MS, KT_BRIDGE_CRADLE0, KT_RESONATOR0, KT_BODY_ID0,
  idlePlaces, freePlace, stampFightFall, fightBodyOf, KT_PLACE_KEEP_MS, KT_SAILWALK_LEAST_MS, KT_CROSS_LEAST_MS, KT_FAST_RUN_MPS, KT_CARRY_PACE, KT_STEP_SLACK, ktLeastMs,
} from '../../../src/net/ketch/ketchBrain.js';
import { ketchRoomKey, ketchVoyageOf, KT_STAGE, KT_CREW_MAX } from '../../../src/net/ketch/ketchLaw.js';
import { KT_CRADLES, KT_BRIDGE_CRADLES, KT_SOCKETS, KT_RESONATORS, KT_GANGWAY, KT_WARDEN_WAKE_Z, KT_HOLD, KT_MAIN_TOP, engineNeeds } from '../../../src/net/ketch/ketchDeck.js';
import { KW_ID, KW_FORK_ID0, KW_PHASE_AT, KW_LOST_MS } from '../../../src/net/ketch/ketchWarden.js';
import { HIT_KINDS, BUCKET_DEPTH_X, dpsRef } from '../../../src/net/gate/gateBrain.js';
import { validKetchOut, validKetchIn, validKtRcTell, KT_OUT_KINDS, KT_CELL_SPOT_MAX, KT_BODY_ID_MAX, KT_CREW_WIRE_MAX, KT_KIND_MAX } from '../../../src/net/wire.js';
import { KT_KIND_BY_K } from '../../../src/net/ketch/ketchConstructs.js';
import { ship, all, bodiesOf, poseOf, sail, strikeFloor, wireOk, toEngine, feed, toBridge, carried, OWNER, T0, SHAFT, seeded, WAIST, GALLERY, HOLD_MID } from './ketchSim.mjs';

test('KETCH THE NUMBERS: the Watch\'s waves for a crew of one, four and eight (spheres; spheres and sentries; the Captain and spheres); the engine eats three and one for each two aboard; the spiders three and the crew at once (mutants: wave one a sphere short; the Captain missing; the engine\'s appetite by the whole crew)', () => {
  assert.deepEqual([1, 2, 3].map((w) => watchWave(w, 1)), [{ sphere: 3, sentry: 0, captain: 0 }, { sphere: 2, sentry: 1, captain: 0 }, { sphere: 1, sentry: 0, captain: 1 }]);
  assert.deepEqual([1, 2, 3].map((w) => watchWave(w, 4)), [{ sphere: 6, sentry: 0, captain: 0 }, { sphere: 3, sentry: 2, captain: 0 }, { sphere: 2, sentry: 0, captain: 1 }]);
  assert.deepEqual([1, 2, 3].map((w) => watchWave(w, 8)), [{ sphere: 10, sentry: 0, captain: 0 }, { sphere: 5, sentry: 3, captain: 0 }, { sphere: 4, sentry: 0, captain: 1 }]);
  assert.deepEqual(watchWave(1, 40), watchWave(1, KT_CREW_MAX), 'never past the crew\'s eight');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(engineNeeds), [4, 4, 5, 5, 6, 6, 7, 7]);
  assert.ok(engineNeeds(8) <= KT_SOCKETS.length, 'every cell a socket');
  assert.deepEqual([1, 4, 8, 20].map(spidersMaxFor), [4, 7, 11, 11]);
});

test('KETCH A MEMBER COMES ABOARD once a voyage: taken into the crew in order with a full hand and purse at its level, its name kept short; again only seen and renamed - and the Watch\'s wait begins with the first (mutants: a member taken twice; the purse empty)', () => {
  const V = newVoyage(ketchRoomKey(1, OWNER), T0);
  assert.deepEqual([V.n, V.owner, V.sg], [1, OWNER, KT_STAGE.watch]);
  assert.equal(joinVoyage(V, 'a', 'Ada', 30, T0), true);
  assert.equal(joinVoyage(V, 'b', 'B'.repeat(40), 12, T0 + 5), true);
  assert.equal(joinVoyage(V, 'a', 'Ada II', 99, T0 + 9), false, 'known');
  assert.deepEqual(V.crew, ['a', 'b']);
  assert.equal(V.players.a.name, 'Ada II');
  assert.equal(V.players.a.lv, 30, 'its level the one it came with');
  assert.equal(V.players.b.name.length, 24);
  assert.equal(V.players.a.bucket, BUCKET_DEPTH_X * dpsRef(30));
  assert.equal(V.watch.firstAt, T0);
});

test('KETCH THE BOARDING WATCH: no wave until a member steps into the waist (or the wait runs out); each wave\'s bodies rise before they can be struck; each wave KT_WAVE_GAP_MS after the last is down, the Captain in the third; the last down - the Gallery, its two Hammer Wardens asleep at their posts (mutants: the first wave at once; a wave while the last stands; the wardens awake)', () => {
  const V = ship(4);
  const bow = all(V, [0, 0, 6]);
  const quiet = sail(V, T0, bow, { most: KT_WATCH_WAIT_MS - 500, until: (f) => f.k === 'wave' });
  assert.equal(quiet.now, null, 'nobody in the waist, the wait not run out: no wave');
  const late = sail(V, T0 + KT_WATCH_WAIT_MS - 250, bow, { most: 1000, until: (f) => f.k === 'wave' });
  assert.ok(late.now >= T0 + KT_WATCH_WAIT_MS, 'the wait run out: the first wave');
  const V2 = ship(4), w = all(V2, WAIST);
  const one = sail(V2, T0, w, { most: 500, until: (f) => f.k === 'wave' });
  assert.equal(one.now, T0, 'a member in the waist: at once');
  const born = one.out.filter((f) => f.k === 'nb');
  assert.equal(born.length, watchWave(1, 4).sphere);
  assert.ok(born.every((f) => f.up === T0 + KT_RISE_MS && f.b[1] === 0), 'spheres, rising');
  const B = V2.bodies[0];
  assert.equal(B.id, KT_BODY_ID0);
  assert.deepEqual(voyageWord(V2, 'mem0', { k: 'hit', o: B.id, d: 50, r: SHAFT }, poseOf(WAIST), T0 + 500, seeded(1)), []);
  assert.equal(B.h, B.m, 'not yet up: struck for nothing');
  const run = sail(V2, T0 + 250, w, { act: strikeFloor(V2, w, 'waist'), until: (f) => f.k === 'sg' });
  const waves = run.out.filter((f) => f.k === 'wave');
  assert.deepEqual(waves.map((f) => f.w), [2, 3]);
  const downs = run.out.filter((f) => f.k === 'dn'), lastDown1 = Math.max(...downs.filter((f) => f.now < waves[0].now).map((f) => f.now));
  assert.equal(waves[0].now - lastDown1, KT_WAVE_GAP_MS, 'each wave the gap after the last is down');
  const w2 = run.out.filter((f) => f.k === 'nb' && f.now === waves[0].now), w3 = run.out.filter((f) => f.k === 'nb' && f.now === waves[1].now);
  assert.deepEqual([w2.filter((f) => f.b[1] === 0).length, w2.filter((f) => f.b[1] === 1).length], [3, 2]);
  assert.deepEqual([w3.filter((f) => f.b[1] === 0).length, w3.filter((f) => f.b[1] === 4).length], [2, 1], 'the Watch-Captain and its spheres');
  assert.equal(w3.find((f) => f.b[1] === 4).up - waves[1].now, 2200, 'the Captain takes longer to come up');
  const sg = run.out.find((f) => f.k === 'sg');
  assert.equal(sg.sg, KT_STAGE.gallery);
  wireOk([...one.out, ...run.out]);
  const wardens = V2.bodies.filter((q) => q.kind === 'warden');
  assert.equal(wardens.length, 2);
  assert.ok(wardens.every((q) => !q.wake && q.floor === 'landing'), 'asleep at their posts');
  assert.ok(run.out.filter((f) => f.k === 'nb' && f.b[1] === 3).every((f) => f.wk === 0));
});

test('KETCH THE GALLERY OF HAMMERS: its Wardens sleep while the crew keeps short of z 98; a Warden struck wakes alone; a member past the line wakes both; both down - the hold opens, the engine\'s appetite the crew\'s (mutants: the wake line ignored; a struck warden sleeping on; the hold opened with one standing)', () => {
  const V = ship(4), w = all(V, WAIST);
  const a = sail(V, T0, w, { act: strikeFloor(V, w, 'waist'), until: (f) => f.k === 'sg' });
  const short = all(V, [0, -6, KT_WARDEN_WAKE_Z - 6]);
  const s = sail(V, a.now + 250, short, { most: 6000, until: (f) => f.k === 'wk' });
  assert.equal(s.now, null, 'short of the line: asleep');
  const [W0, W1] = V.bodies.filter((q) => q.kind === 'warden');
  const t = a.now + 7000;
  const woke = voyageWord(V, 'mem0', { k: 'hit', o: W0.id, d: 10, r: SHAFT }, poseOf(short.mem0), t, seeded(1));
  assert.deepEqual(woke.map((f) => f.k), ['wk']);
  assert.equal(W0.wake, true);
  assert.equal(W1.wake, false, 'the other sleeps on');
  const past = sail(V, t + 250, all(V, GALLERY), { most: 1000, until: (f) => f.k === 'wk' });
  assert.equal(past.out.find((f) => f.k === 'wk').o, W1.id, 'past the line: woken');
  // one down: the hold stays shut
  W0.h = 0; W0.downAt = t + 300;
  const one = sail(V, t + 1500, all(V, GALLERY), { most: 2000, until: (f) => f.k === 'sg' });
  assert.equal(one.now, null);
  const g = all(V, GALLERY);
  const b = sail(V, t + 4000, g, { act: strikeFloor(V, g, 'landing'), until: (f) => f.k === 'sg' });
  assert.equal(b.out.find((f) => f.k === 'sg').sg, KT_STAGE.engine);
  assert.equal(V.cells.need, engineNeeds(4));
  assert.deepEqual(b.out.filter((f) => f.k === 'cl').at(-1).nd, engineNeeds(4), 'said with the cells');
});

test('KETCH THE STARVED ENGINE - a cell taken and set: from a charged cradle within reach, in the hold, by empty hands; into an empty socket within reach on the hold\'s floor; the cradle charging again KT_CRADLE_BACK_MS on (mutants: a cell from across the hold; a second cell in full hands; a socket fed twice; a cradle never charging again)', () => {
  const V = ship(4), t = toEngine(V), rng = seeded(2);
  const [cx, cz] = KT_CRADLES[0], [sx, sz] = KT_SOCKETS[3];
  assert.deepEqual(voyageWord(V, 'mem0', { k: 'pick', c: 0 }, poseOf([0, -12, 64]), t, rng), [], 'out of reach');
  assert.deepEqual(voyageWord(V, 'mem0', { k: 'pick', c: 0 }, poseOf([cx, -6, cz]), t, rng), [], 'a storey up: not the hold');
  const took = voyageWord(V, 'mem0', { k: 'pick', c: 0 }, poseOf([cx, -12, cz]), t, rng);
  assert.deepEqual(took.map((f) => f.k), ['pick', 'cl']);
  assert.equal(took[1].cr[0], t + KT_CRADLE_BACK_MS, 'its cradle charging');
  assert.deepEqual(took[1].ca, [['mem0', V.cells.carry.mem0.id]]);
  assert.deepEqual(voyageWord(V, 'mem1', { k: 'pick', c: 0 }, poseOf([cx, -12, cz]), t, rng), [], 'spent');
  assert.deepEqual(voyageWord(V, 'mem0', { k: 'pick', c: 1 }, poseOf(KT_CRADLES[1].length ? [KT_CRADLES[1][0], -12, KT_CRADLES[1][1]] : null), t, rng), [], 'its hands full');
  const W = carried(V, 'mem0', KT_SOCKETS[3]);
  assert.ok(W > 0);
  assert.deepEqual(voyageWord(V, 'mem0', { k: 'bank', s: 3 }, poseOf([sx, -12, sz]), t + W - 1, rng), [], 'carried there faster than the fastest run (AUDIT KETCH L1-7)');
  assert.deepEqual(voyageWord(V, 'mem0', { k: 'bank', s: 3 }, poseOf([sx + 5, -12, sz]), t + W + 10, rng), [], 'a socket out of reach');
  const set = voyageWord(V, 'mem0', { k: 'bank', s: 3 }, poseOf([sx, -12, sz]), t + W + 20, rng);
  assert.deepEqual(set.map((f) => f.k), ['bank', 'cl']);
  assert.equal(set[0].sk, 3);
  assert.deepEqual([V.cells.banked, V.cells.sk[3], V.players.mem0.banked], [1, 1, 1]);
  assert.equal(V.cells.carry.mem0, undefined);
  voyageWord(V, 'mem1', { k: 'pick', c: 1 }, poseOf([KT_CRADLES[1][0], -12, KT_CRADLES[1][1]]), t + 30, rng);
  assert.deepEqual(voyageWord(V, 'mem1', { k: 'bank', s: 3 }, poseOf([sx, -12, sz]), t + 30 + carried(V, 'mem1', KT_SOCKETS[3]) + 10, rng), [], 'that socket is fed');
  assert.ok(V.cells.carry.mem1, 'still carried');
  const back = sail(V, t + 250, all(V, HOLD_MID), { most: KT_CRADLE_BACK_MS + 1000, until: (f) => f.k === 'cl' && f.cr[0] === 1 });
  assert.ok(back.now >= t + KT_CRADLE_BACK_MS && back.now < t + KT_CRADLE_BACK_MS + 250, 'charged again');
});

test('KETCH THE STARVED ENGINE - a cell dropped: struck, it lies where the carrier stands for any member to take up, and bleeds out KT_CELL_LIES_MS on; a carrier fallen drops it at its body; one carried off the hold\'s floor or out of the census is gone with it (mutants: a struck carrier keeping its cell; a dropped cell lying forever; a cell carried up the stair)', () => {
  const V = ship(4), t = toEngine(V), rng = seeded(4);
  const pick = (sub, c, now) => voyageWord(V, sub, { k: 'pick', c }, poseOf([KT_CRADLES[c][0], -12, KT_CRADLES[c][1]]), now, rng);
  pick('mem0', 0, t);
  const hurt = voyageWord(V, 'mem0', { k: 'hurt' }, poseOf([-2, -12, 90]), t + 100, rng);
  assert.deepEqual(hurt.map((f) => f.k), ['drop', 'cl']);
  assert.equal(hurt[0].why, 'struck');
  const lying = V.cells.lo[0];
  assert.deepEqual([lying.x, lying.y, lying.z, lying.until], [-2, -12, 90, t + 100 + KT_CELL_LIES_MS]);
  assert.deepEqual(voyageWord(V, 'mem1', { k: 'pick', l: lying.id }, poseOf([-2, -6, 90]), t + 200, rng), [], 'a storey off: out of reach');
  const up = voyageWord(V, 'mem1', { k: 'pick', l: lying.id }, poseOf([-1, -12, 91]), t + 200, rng);
  assert.equal(up[0].k, 'pick');
  assert.equal(V.cells.carry.mem1.id, lying.id, 'the same cell');
  assert.equal(V.cells.lo.length, 0);
  // fallen: at its body
  const where = { ...all(V, HOLD_MID), mem1: [3, -12, 80, true] };
  const fell = sail(V, t + 250, where, { most: 500, until: (f) => f.k === 'drop' });
  assert.equal(fell.out.find((f) => f.k === 'drop').why, 'fell');
  assert.deepEqual([V.cells.lo[0].x, V.cells.lo[0].z], [3, 80]);
  // it bleeds out
  const gone = sail(V, fell.now + 250, all(V, HOLD_MID), { most: KT_CELL_LIES_MS + 1000, until: (f) => f.k === 'cl' && f.lo.length === 0 });
  assert.ok(gone.now >= fell.now + KT_CELL_LIES_MS);
  // carried up the stair: gone with it, nothing left lying
  pick('mem2', 1, gone.now);
  const off = sail(V, gone.now + 250, { ...all(V, HOLD_MID), mem2: [0, -6, 100] }, { most: 500, until: (f) => f.k === 'drop' });
  assert.equal(off.out.find((f) => f.k === 'drop').why, 'left');
  assert.equal(V.cells.lo.length, 0);
  // out of the census
  pick('mem3', 2, off.now + 250);
  const { mem3: _, ...rest } = all(V, HOLD_MID);
  const lost = sail(V, off.now + 500, rest, { most: 500, until: (f) => f.k === 'drop' });
  assert.equal(lost.out.find((f) => f.k === 'drop').s, 'mem3');
  // a member's own letting go
  pick('mem0', 3, lost.now + 250);
  assert.equal(voyageWord(V, 'mem0', { k: 'drop' }, poseOf(HOLD_MID), lost.now + 300, rng)[0].why, 'let');
  assert.deepEqual(voyageWord(V, 'mem0', { k: 'drop' }, poseOf(HOLD_MID), lost.now + 400, rng), [], 'empty hands drop nothing');
});

test('KETCH THE GALLERY WEDGES ON NO LATE BEAT: both Wardens down and taken off (KT_DOWN_KEEP_MS) before the next beat - a wake late - the hold opens all the same (AUDIT SHIP 5; mutants: the hold kept shut on wardens taken off)', () => {
  const V = ship(4), w = all(V, WAIST);
  const a = sail(V, T0, w, { act: strikeFloor(V, w, 'waist'), until: (f) => f.k === 'sg' });
  const t = a.now + 1000;
  for (const B of V.bodies.filter((q) => q.kind === 'warden')) { B.h = 0; B.downAt = t; }
  const out = stepVoyage(V, t + KT_DOWN_KEEP_MS + 5000, bodiesOf(all(V, GALLERY)), seeded(6));
  assert.equal(V.bodies.filter((q) => q.kind === 'warden').length, 0, 'taken off');
  assert.equal(out.find((f) => f.k === 'sg')?.sg, KT_STAGE.engine);
});

test('KETCH A CELL LET GO AND TAKEN UP AGAIN BANKS NO SOONER: the step law\'s start and its clock lie with the cell - let go by its socket a moment after its cradle and taken up again, it is set no sooner than carried from the cradle (AUDIT SHIP 3; mutants: a cell taken up afresh where it lies)', () => {
  const V = ship(4), t = toEngine(V), rng = seeded(5);
  const [cx, cz] = KT_CRADLES[0], [sx, sz] = KT_SOCKETS[3], S3 = poseOf([sx, -12, sz]);
  voyageWord(V, 'mem0', { k: 'pick', c: 0 }, poseOf([cx, -12, cz]), t, rng);
  const W = carried(V, 'mem0', KT_SOCKETS[3]);
  assert.ok(W > 400);
  assert.equal(voyageWord(V, 'mem0', { k: 'drop' }, S3, t + 50, rng)[0].k, 'drop');
  assert.equal(voyageWord(V, 'mem0', { k: 'pick', l: V.cells.lo[0].id }, S3, t + 100, rng)[0].k, 'pick');
  assert.deepEqual(voyageWord(V, 'mem0', { k: 'bank', s: 3 }, S3, t + 200, rng), [], 'by its socket in 200 ms: refused');
  assert.equal(voyageWord(V, 'mem0', { k: 'bank', s: 3 }, S3, t + W + 10, rng)[0].k, 'bank', 'as soon as carried from its cradle');
});

test('KETCH THE STARVED ENGINE - the spiders pour from the vents two at a time, never more than three and the crew at once; fed, the engine\'s hold is cleared and THE MAST-LIFT RUNS - the Sailwalk (mutants: the spiders\' bound ignored; the hold\'s constructs left standing; the engine fed one short)', () => {
  const V = ship(4), t = toEngine(V);
  const s = sail(V, t, all(V, HOLD_MID), { most: 120_000 });
  const most = (() => { let m = 0; const alive = new Set(); for (const f of s.out) { if (f.k === 'nb' && f.b[1] === 2) alive.add(f.b[0]); if (f.k === 'dn') alive.delete(f.o); m = Math.max(m, alive.size); } return m; })();
  assert.equal(most, spidersMaxFor(4), 'up to the bound and no further');
  const born = s.out.filter((f) => f.k === 'nb');
  assert.ok(born.every((f) => f.b[1] === 2 && Math.abs(f.b[3] - KT_HOLD.y) < 1e-9), 'spiders, in the hold');
  wireOk(s.out);
  V.cells.need = engineNeeds(4);
  const fed = feed(V, s.now ?? t + 120_000);
  assert.equal(V.cells.banked, V.cells.need);
  const all2 = [...fed.frames];
  assert.equal(V.sg, KT_STAGE.sailwalk);
  assert.ok(all2.some((f) => f.k === 'sg' && f.sg === KT_STAGE.sailwalk));
  assert.ok(V.bodies.filter((q) => q.floor === 'hold').every((q) => q.h <= 0), 'the hold cleared');
});

test('KETCH THE SAILWALK UNBARS THE BRIDGE: the first member on the gangway or the bridge, by name - nobody on the course moves it (mutants: the bridge unbarred from the course; its first unnamed)', () => {
  const V = ship(3), t = toEngine(V);
  const fed = feed(V, t);
  const course = sail(V, fed.now + 250, all(V, [24, 16, 70]), { most: 3000, until: (f) => f.k === 'sg' });
  assert.equal(course.now, null);
  // the step law (AUDIT KETCH L1-7): nobody on the gangway sooner than the lift's rise and the fastest crossing after the
  // engine is fed, nor sooner than the fastest crossing after it was last seen at the main top
  const early = sail(V, fed.now + 3500, { ...all(V, [24, 16, 70]), mem2: [KT_GANGWAY.ax, 0, KT_GANGWAY.az] }, { most: KT_SAILWALK_LEAST_MS - 3600, until: (f) => f.k === 'sg' });
  assert.equal(early.now, null, 'warped from the hold: barred still');
  const T = fed.now + Math.ceil(KT_SAILWALK_LEAST_MS);
  sail(V, T, { ...all(V, [24, 16, 70]), mem2: [KT_MAIN_TOP.x, KT_MAIN_TOP.y, KT_MAIN_TOP.z] }, { most: 0 });
  const fromTop = sail(V, T + 250, { ...all(V, [24, 16, 70]), mem2: [KT_GANGWAY.ax, 0, KT_GANGWAY.az] }, { most: KT_CROSS_LEAST_MS - 500, until: (f) => f.k === 'sg' });
  assert.equal(fromTop.now, null, 'seen at the top a moment ago: barred still');
  const there = sail(V, T + Math.ceil(KT_CROSS_LEAST_MS) + 250, { ...all(V, [24, 16, 70]), mem2: [KT_GANGWAY.ax, 0, KT_GANGWAY.az] }, { most: 1000, until: (f) => f.k === 'sg' });
  const sg = there.out.find((f) => f.k === 'sg');
  assert.deepEqual([sg.sg, sg.by], [KT_STAGE.bridge, 'P2']);
  assert.deepEqual(V.bridge, { at: there.now, by: 'P2' });
});

test('KETCH THE TONAL WARDEN, WHOLE: `in` only on the bridge; the Discord asks two Sentries of the ship and wards it until its four resonators are put right with the bridge\'s own cells; the Last Note\'s forks broken stun it; its fall clears the ship, opens the cabin and owes the crew (mutants: `in` from the gangway; the bridge\'s cells without the ward; a resonator set twice; the fall leaving a carrier its cell)', () => {
  const { V, now: t0, core } = toBridge(4), rng = seeded(9);
  assert.deepEqual(voyageWord(V, 'mem0', { k: 'in', lv: 30 }, poseOf([KT_GANGWAY.ax, 0, KT_GANGWAY.az]), t0, rng), [], 'not on the bridge');
  const ins = V.crew.flatMap((s) => voyageWord(V, s, { k: 'in', lv: 30 }, poseOf(core[s]), t0, rng));
  assert.equal(ins.filter((f) => f.k === 'wf').length, 1, 'one fight, born with the first');
  assert.ok(ins.filter((f) => f.k === 'ws' && f.me === 1).length === 4);
  assert.deepEqual(voyageWord(V, 'mem0', { k: 'pick', c: KT_BRIDGE_CRADLE0 }, poseOf([KT_BRIDGE_CRADLES[0][0], 0, KT_BRIDGE_CRADLES[0][1]]), t0, rng), [], 'no ward, no cell');
  let rs = 0, retuned = false, forks = 0, stuns = 0;
  const act = (now) => {
    const out = [], f = V.wf;
    if (!f) return out;
    if (f.ward) {
      // the Discord: two carry from the bridge's cradles to the false resonators; the rest stand on the core
      for (const [j, sub] of [[0, 'mem0'], [1, 'mem1']]) {
        const c = V.cells.carry[sub];
        if (!c && V.cells.br[j].ready) out.push(...voyageWord(V, sub, { k: 'pick', c: KT_BRIDGE_CRADLE0 + j }, poseOf([KT_BRIDGE_CRADLES[j][0], 0, KT_BRIDGE_CRADLES[j][1]]), now, rng));
        else if (c) { const open = f.rs.flatMap((v, i) => (v === 0 ? [i] : [])), k = sub === 'mem0' ? open[0] : open.at(-1), R = KT_RESONATORS[k]; out.push(...voyageWord(V, sub, { k: 'bank', s: KT_RESONATOR0 + k }, poseOf([R[0], 0, R[1]]), now, rng)); }
      }
      return out;
    }
    for (const sub of V.crew) {
      const X = f.fk, c = X ? X.c.findIndex((q) => q.h > 0) : -1;
      if (c >= 0 && now < X.at - 500) out.push(...voyageWord(V, sub, { k: 'hit', o: KW_FORK_ID0 + c, d: 1e6, r: SHAFT }, poseOf(core[sub]), now, rng));
      else out.push(...voyageWord(V, sub, { k: 'hit', o: KW_ID, d: 1e6, r: SHAFT }, poseOf(core[sub]), now, rng));
    }
    return out;
  };
  const run = sail(V, t0, core, { act, most: 14 * 60_000, until: (f) => f.k === 'fell' });
  assert.ok(run.now, 'felled');
  wireOk([...ins, ...run.out]);
  for (const f of run.out) { if (f.k === 'rs') rs = Math.max(rs, f.rs.filter((v) => v === 1).length); if (f.k === 'ward' && f.on === 0) retuned = true; if (f.k === 'fkb') forks += 1; if (f.k === 'stun') stuns += 1; }
  assert.equal(rs, 4);
  assert.ok(retuned, 'its ward broken by the four');
  assert.ok(forks >= 3 && stuns >= 1, 'its forks broken: stunned');
  const sentries = run.out.filter((f) => f.k === 'nb' && f.b[1] === 1);
  assert.equal(sentries.length, 2, 'the Discord\'s two Sentries');
  assert.ok(sentries.every((f) => Math.hypot(f.b[2], f.b[4] - 200) < 15), 'climbing onto the core');
  assert.ok(run.out.some((f) => f.k === 'ph' && f.n === 2) && run.out.some((f) => f.k === 'ph' && f.n === 3));
  const banks = run.out.filter((f) => f.k === 'bank');
  assert.equal(new Set(banks.map((f) => f.sk)).size, 4, 'each resonator once');
  assert.equal(banks.length, 4, 'a true resonator takes no cell');
  assert.equal(V.sg, KT_STAGE.vault);
  assert.ok(run.out.some((f) => f.k === 'sg' && f.sg === KT_STAGE.vault));
  assert.ok(V.bodies.every((q) => q.h <= 0), 'the ship cleared');
  assert.deepEqual([V.cells.carry, V.cells.lo], [{}, []]);
  assert.deepEqual(V.fell.n, 4);
  assert.deepEqual(voyageEarners(V).sort(), ['mem0', 'mem1', 'mem2', 'mem3']);
  const st = voyageStateOf(V, run.now);
  assert.equal(st.k, 'st');
  assert.equal(st.sg, KT_STAGE.vault);
  assert.deepEqual(st.cr, V.crew.map((s) => [s, V.players[s].name]));
  assert.equal(st.ws.ph, 3);
  assert.ok(st.fell && st.fell.n === 4);
  assert.ok(KW_PHASE_AT[0] > KW_PHASE_AT[1]);
  assert.ok(validKetchOut(st), 'the whole ship on the wire');
  assert.equal(validKetchOut(st).ws.ph, 3);
});

test('KETCH THE WIRE\'S BOUNDS ARE THE SHIP\'S: a cradle\'s, a socket\'s and a resonator\'s number, a body\'s, the crew\'s eight and the kinds - pinned to the laws the wire imports none of; every word a member says, projected (mutants: the resonators past the wire\'s spots; a kind the wire refuses)', () => {
  assert.ok(KT_RESONATOR0 + KT_RESONATORS.length - 1 <= KT_CELL_SPOT_MAX && KT_BRIDGE_CRADLE0 + KT_BRIDGE_CRADLES.length - 1 <= KT_CELL_SPOT_MAX);
  assert.ok(KT_SOCKETS.length - 1 <= KT_CELL_SPOT_MAX && KT_CRADLES.length - 1 <= KT_CELL_SPOT_MAX);
  assert.ok(KW_FORK_ID0 + 16 <= KT_BODY_ID0 && KT_BODY_ID0 < KT_BODY_ID_MAX && KW_ID < KW_FORK_ID0);
  assert.equal(KT_CREW_WIRE_MAX, KT_CREW_MAX);
  assert.equal(KT_KIND_MAX, KT_KIND_BY_K.length - 1);
  assert.deepEqual(validKetchIn({ k: 'pick', c: KT_BRIDGE_CRADLE0 + 1 }), { k: 'pick', c: 11 });
  assert.deepEqual(validKetchIn({ k: 'pick', l: 7 }), { k: 'pick', l: 7 });
  assert.deepEqual(validKetchIn({ k: 'bank', s: KT_RESONATOR0 + 3 }), { k: 'bank', s: 13 });
  assert.equal(validKetchIn({ k: 'bank', s: KT_CELL_SPOT_MAX + 1 }), null);
  assert.deepEqual(validKetchIn({ k: 'hit', o: KW_ID, q: 3, d: 40, r: 1, x: 9 }), { k: 'hit', o: 1, q: 3, d: 40, r: 1 }, 'nothing else carried');
  assert.equal(validKetchIn({ k: 'hit', o: 0, q: 3, d: 40, r: 1 }), null);
  assert.deepEqual(validKetchIn({ k: 'in', lv: 30, bv: 1 }), { k: 'in', lv: 30, bv: 1 });
  assert.deepEqual(validKetchIn({ k: 'hurt', s: 'x' }), { k: 'hurt' });
  assert.equal(validKetchIn({ k: 'warp' }), null);
  assert.deepEqual(validKetchIn({ k: 'spent', n: 3, x: 1 }), { k: 'spent', n: 3 }, 'a share given (AUDIT KETCH L1-2)');
  assert.equal(validKetchIn({ k: 'spent', n: -1 }), null);
  const r = 'y1.e30.';
  assert.deepEqual(validKtRcTell({ n: 3, rc: [['acct-a', r], ['acct-b', 'k1.e30.'], ['bad id!', r], 7] }), { n: 3, rc: [['acct-a', r]] }, 'the wire\'s own receipts alone');
  assert.equal(validKtRcTell({ n: 'x', rc: [] }), null);
});

test('KETCH A FIGHT LOST: nobody living on the bridge for KW_LOST_MS - the bridge\'s constructs go, its cells with them, the Warden stands at its helm again, and the next `in` is a fresh fight; earners only at a fall (mutants: a lost fight kept; its bridge cells left lying)', () => {
  const { V, now: t0, core } = toBridge(2), rng = seeded(11);
  for (const s of V.crew) voyageWord(V, s, { k: 'in', lv: 30 }, poseOf(core[s]), t0, rng);
  // strike it into the Discord
  const d = sail(V, t0 + 250, core, { act: (now) => V.crew.flatMap((s) => voyageWord(V, s, { k: 'hit', o: KW_ID, d: 1e6, r: SHAFT }, poseOf(core[s]), now, rng)), until: (f) => f.k === 'ward' && f.on === 1 });
  assert.ok(d.now);
  voyageWord(V, 'mem0', { k: 'pick', c: KT_BRIDGE_CRADLE0 }, poseOf([KT_BRIDGE_CRADLES[0][0], 0, KT_BRIDGE_CRADLES[0][1]]), d.now + 3000, rng);
  voyageWord(V, 'mem1', { k: 'pick', c: KT_BRIDGE_CRADLE0 + 1 }, poseOf([KT_BRIDGE_CRADLES[1][0], 0, KT_BRIDGE_CRADLES[1][1]]), d.now + 3000, rng);
  voyageWord(V, 'mem1', { k: 'drop' }, poseOf(core.mem1), d.now + 3100, rng);
  assert.equal(V.cells.lo.length, 1);
  assert.deepEqual(voyageEarners(V), [], 'no fall, no receipt');
  // everyone falls back to the gangway; mem0 is carried off the bridge (its cell goes)
  const away = all(V, [KT_GANGWAY.ax, 0, KT_GANGWAY.az]);
  const lost = sail(V, d.now + 3250, away, { most: KW_LOST_MS + 2000, until: (f) => f.k === 'wl' });
  assert.ok(lost.now >= d.now + 3250 + KW_LOST_MS - 250, 'the whole of the wait');
  assert.equal(V.wf, null);
  assert.equal(V.cells.lo.length, 0, 'its cells gone with it');
  assert.ok(V.bodies.filter((q) => q.floor === 'bridge').every((q) => q.h <= 0), 'its Sentries gone');
  const again = voyageWord(V, 'mem0', { k: 'in', lv: 30 }, poseOf(core.mem0), lost.now + 1000, rng);
  assert.deepEqual(again.find((f) => f.k === 'wf').fi, 2, 'a fresh fight');
  assert.equal(V.sg, KT_STAGE.bridge);
});

test('KETCH THE CELLS ON THE WIRE: the cradles (1 charged, else when), the cells lying, who carries which, the engine\'s count and appetite, its sockets; said only when they move (mutants: a cradle said charged while it charges; the cells said every beat)', () => {
  const V = ship(2), t = toEngine(V), rng = seeded(5);
  voyageWord(V, 'mem0', { k: 'pick', c: 2 }, poseOf([KT_CRADLES[2][0], -12, KT_CRADLES[2][1]]), t, rng);
  const w = cellsWord(V);
  assert.deepEqual(w.cr, [1, 1, t + KT_CRADLE_BACK_MS, 1, 1, 1]);
  assert.deepEqual(w.br, [1, 1]);
  assert.deepEqual([w.bk, w.nd, w.sk], [0, engineNeeds(2), [0, 0, 0, 0, 0, 0, 0]]);
  const s = sail(V, t + 250, all(V, HOLD_MID), { most: 3000 });
  assert.equal(s.out.filter((f) => f.k === 'cl').length, 0, 'nothing moved: nothing said');
  assert.ok(KT_BRIDGE_CRADLE_BACK_MS < KT_CRADLE_BACK_MS, 'the bridge\'s cradles quicker');
});

/** The bridge's fight struck into its Discord (the ward up) for the members `fighters` - at the moment answered. */
function toDiscord(V, t0, core, fighters, rng) {
  for (const s of fighters) voyageWord(V, s, { k: 'in', lv: 30 }, poseOf(core[s]), t0, rng);
  const d = sail(V, t0 + 250, core, { act: (now) => fighters.flatMap((s) => voyageWord(V, s, { k: 'hit', o: KW_ID, d: 1e6, r: SHAFT }, poseOf(core[s]), now, rng)), until: (f) => f.k === 'ward' && f.on === 1 });
  assert.ok(d.now, 'warded');
  return d.now + 3000;
}
const BC = (j) => [KT_BRIDGE_CRADLES[j][0], 0, KT_BRIDGE_CRADLES[j][1]];
const RS = (k) => [KT_RESONATORS[k][0], 0, KT_RESONATORS[k][1]];

test('KETCH THE DISCORD\'S RESONATORS TAKE A CELL EACH: one set true takes no second cell - the second carrier keeps its own (mutants: a resonator set twice)', () => {
  const { V, now: t0, core } = toBridge(2), rng = seeded(21);
  const t = toDiscord(V, t0, core, ['mem0', 'mem1'], rng);
  voyageWord(V, 'mem0', { k: 'pick', c: KT_BRIDGE_CRADLE0 }, poseOf(BC(0)), t, rng);
  voyageWord(V, 'mem1', { k: 'pick', c: KT_BRIDGE_CRADLE0 + 1 }, poseOf(BC(1)), t, rng);
  const was = V.players.mem1.banked;
  const w = Math.max(carried(V, 'mem0', KT_RESONATORS[0]), carried(V, 'mem1', KT_RESONATORS[0]));
  assert.deepEqual(voyageWord(V, 'mem0', { k: 'bank', s: KT_RESONATOR0 }, poseOf(RS(0)), V.cells.carry.mem0.at + carried(V, 'mem0', KT_RESONATORS[0]) - 1, rng), [], 'carried there faster than the fastest run (AUDIT KETCH L1-7)');
  const first = voyageWord(V, 'mem0', { k: 'bank', s: KT_RESONATOR0 }, poseOf(RS(0)), t + w + 100, rng);
  assert.deepEqual(first.filter((f) => f.k === 'rs').map((f) => f.rs), [[1, 0, 0, 0]]);
  assert.deepEqual(voyageWord(V, 'mem1', { k: 'bank', s: KT_RESONATOR0 }, poseOf(RS(0)), t + w + 200, rng), [], 'true already: no cell taken');
  assert.ok(V.cells.carry.mem1, 'its cell still in its hands');
  assert.equal(V.players.mem1.banked, was, 'none counted to it');
});

test('KETCH THE FALL EMPTIES EVERY HAND: a member still carrying a bridge cell when the Warden falls carries it no more (mutants: the fall leaving a carrier its cell)', () => {
  const { V, now: t0, core } = toBridge(2), rng = seeded(23);
  let t = toDiscord(V, t0, core, ['mem0', 'mem1'], rng);
  voyageWord(V, 'mem1', { k: 'pick', c: KT_BRIDGE_CRADLE0 + 1 }, poseOf(BC(1)), t, rng);
  assert.ok(V.cells.carry.mem1, 'carried, and kept to the end');
  const act = (now) => {
    const f = V.wf, out = [];
    if (!f) return out;
    if (f.ward) {
      const c = V.cells.carry.mem0;
      if (!c && V.cells.br[0].ready) out.push(...voyageWord(V, 'mem0', { k: 'pick', c: KT_BRIDGE_CRADLE0 }, poseOf(BC(0)), now, rng));
      else if (c) out.push(...voyageWord(V, 'mem0', { k: 'bank', s: KT_RESONATOR0 + f.rs.indexOf(0) }, poseOf(RS(f.rs.indexOf(0))), now, rng));
      return out;
    }
    for (const sub of ['mem0', 'mem1']) {
      const X = f.fk, c = X ? X.c.findIndex((q) => q.h > 0) : -1;
      out.push(...voyageWord(V, sub, { k: 'hit', o: c >= 0 && now < X.at - 500 ? KW_FORK_ID0 + c : KW_ID, d: 1e6, r: SHAFT }, poseOf(core[sub]), now, rng));
    }
    return out;
  };
  const run = sail(V, t, core, { act, most: 14 * 60_000, until: (f) => f.k === 'fell' });
  assert.ok(run.now, 'felled');
  assert.deepEqual(V.cells.carry, {}, 'no hand holds a cell');
});

test('KETCH A LOST FIGHT TAKES ITS CELLS: a bridge cell lying when the fight is lost - let go by a member who never joined it - goes with the fight (mutants: its bridge cells left lying)', () => {
  const { V, now: t0, core } = toBridge(3), rng = seeded(25);
  const t = toDiscord(V, t0, core, ['mem0', 'mem1'], rng);
  voyageWord(V, 'mem2', { k: 'pick', c: KT_BRIDGE_CRADLE0 }, poseOf(BC(0)), t, rng);
  assert.ok(V.cells.carry.mem2, 'a member outside the fight carries one');
  const away = (now) => ({ mem0: [KT_GANGWAY.ax, 0, KT_GANGWAY.az], mem1: [KT_GANGWAY.ax, 0, KT_GANGWAY.az], mem2: core.mem2 });
  const dropAt = t + KW_LOST_MS - 8000;
  let dropped = false;
  const lost = sail(V, t + 250, away, { most: KW_LOST_MS + 3000, act: (now) => { if (!dropped && now >= dropAt) { dropped = true; return voyageWord(V, 'mem2', { k: 'drop' }, poseOf(core.mem2), now, rng); } return []; }, until: (f) => f.k === 'wl' });
  assert.ok(dropped && lost.now, 'let go eight seconds before the loss, and lost');
  assert.deepEqual(V.cells.lo, [], 'its cell gone with the fight');
});

test('KETCH A CONSTRUCT IS NEVER A FORK BY ITS NUMBER: the Engine\'s spiders killed as they come for ten minutes - every blow on one lands, never routed to the Warden\'s forks (AUDIT KETCH L1-1; mutants: constructs numbered among the forks)', () => {
  assert.ok(KT_BODY_ID0 >= KW_FORK_ID0 + 16, 'numbered above the forks\' sixteen');
  const V = ship(1), t0 = toEngine(V), where = all(V, HOLD_MID), rng = seeded(5), sub = V.crew[0];
  let now = t0, struck = 0;
  while (now < t0 + 10 * 60_000 && V.sg === KT_STAGE.engine) {
    now += 250;
    stepVoyage(V, now, bodiesOf(where), rng);
    for (const B of V.bodies.filter((b) => b.kind === 'spider' && b.h > 0 && now >= b.upAt)) {
      voyageWord(V, sub, { k: 'hit', o: B.id, d: 1e6, r: SHAFT, q: null }, poseOf(where[sub]), now, rng);
      assert.equal(B.h, 0, `spider #${B.id} felled`);
      struck++;
    }
  }
  assert.ok(struck > 120, `past where the forks' numbers began (${struck} spiders)`);
});

test('KETCH A PLACE FREES ONLY WHEN IDLE: a member with no socket aboard, unseen KT_PLACE_KEEP_MS, with no real part in the Warden\'s fight - freed out of the crew, its record and its seat in the fight (AUDIT KETCH L1-5; mutants: a present member freed; the keep forgotten; a part in the fight freed)', () => {
  const { V, now: t0, core } = toBridge(4), rng = seeded(3);
  const [a, b, c, d] = V.crew;
  for (const s of V.crew) voyageWord(V, s, { k: 'in', lv: 30 }, poseOf(core[s]), t0, rng);
  for (const s of V.crew) V.players[s].seenAt = t0;
  V.wf.players[d].dealt = 1e9;   // d has a real part in the fight
  const later = t0 + KT_PLACE_KEEP_MS;
  assert.deepEqual(idlePlaces(V, new Set([a]), later - 1), [], 'kept KT_PLACE_KEEP_MS');
  assert.deepEqual(idlePlaces(V, new Set([a]), later), [b, c], 'not the one aboard, not the one with a part');
  const share = V.wf.players[b].share, max = V.wf.max;
  freePlace(V, b, later);
  assert.deepEqual(V.crew, [a, c, d]);
  assert.equal(V.players[b], undefined);
  assert.equal(V.wf.players[b], undefined, 'its seat in the fight with it');
  assert.ok(Math.abs(V.wf.max - (max - share)) < 1e-6, 'its share of the Warden\'s health out');
  assert.deepEqual(freePlace(V, b, later), [], 'once');
  assert.ok(validKetchOut(voyageStateOf(V, later)));
});

test('KETCH THE STEP LAW\'S NUMBERS: the fastest build\'s run (the Elite Gates\' own, pinned equal), a carrier at KT_CARRY_PACE of it - the page\'s own pace - less KT_STEP_SLACK and a body\'s breadth; the Sailwalk\'s least crossing and the mast-lift\'s rise before it (AUDIT KETCH L1-7; mutants: the carrier at a runner\'s pace)', async () => {
  const { EG_FAST_RUN_MPS, EG_CROSS_SLACK } = await import('../../../src/net/eliteGates/egSpanLaw.js');
  const { KT_CARRY_PACE: PAGE_PACE } = await import('../../../src/scenes/ketch/ketchClient.js');
  const { KT_LIFT, KT_COURSE_SPEC } = await import('../../../src/net/ketch/ketchDeck.js');
  assert.equal(KT_FAST_RUN_MPS, EG_FAST_RUN_MPS);
  assert.equal(KT_STEP_SLACK, EG_CROSS_SLACK);
  assert.equal(PAGE_PACE, KT_CARRY_PACE);
  assert.equal(KT_CARRY_PACE, 0.72);
  assert.equal(ktLeastMs(2), 0, 'a body\'s breadth');
  assert.ok(Math.abs(ktLeastMs(12) - (10 / KT_FAST_RUN_MPS) * (1 - KT_STEP_SLACK) * 1000) < 1e-9);
  assert.ok(Math.abs(ktLeastMs(12, true) - ktLeastMs(12) / KT_CARRY_PACE) < 1e-9);
  assert.ok(Math.abs(KT_CROSS_LEAST_MS - ktLeastMs(KT_GANGWAY.az - KT_COURSE_SPEC.start.z)) < 1e-9);
  assert.ok(Math.abs(KT_SAILWALK_LEAST_MS - KT_CROSS_LEAST_MS - KT_LIFT.rise * 1000 * (1 - KT_STEP_SLACK)) < 1e-9);
});

test('KETCH A RECEIPT\'S MEASURE IS THE FIGHT\'S: a member felled before it joined the Warden\'s fight stood at nothing in it - its receipt would not have stood; one felled in it stood at the fight\'s own figures then, never the voyage\'s (AUDIT KETCH L1-12; mutants: the voyage\'s figures read; a fall before the fight unmarked)', async () => {
  const { bodyMeasure } = await import('../../../src/net/bossBody.js');
  const { KETCH_SEAM } = await import('../../../src/net/ketch/ketchWarden.js');
  const { V, now: t0, core } = toBridge(2), rng = seeded(4);
  V.players.mem0.bd = { sd: 1, t: 1, h: 0, o: 0, w: 1, v: 0, fs: V.players.mem0.stoodMs, fd: 1e9 };   // felled in the Gallery, the voyage's figures
  V.players.mem1.bd = { sd: 1, t: 0, h: 0, o: 0, w: 0, v: 1 };
  for (const s of V.crew) voyageWord(V, s, { k: 'in', lv: 30 }, poseOf(core[s]), t0, rng);
  const f = V.wf, kept = (s) => (q) => KETCH_SEAM.earned({ ...f, players: { ...f.players, [s]: q } }, s);
  for (const s of V.crew) { f.players[s].dealt = f.players[s].share; f.players[s].stoodMs = 60_000; }
  f.fell = { at: t0 + 60_000, top: [], n: 2 }; f.liveMs = 60_000;
  const measure = (s) => bodyMeasure({ ...f.players[s], bd: fightBodyOf(V, s) }, kept(s));
  assert.equal(measure('mem0')[4], 0, 'felled before the fight: it stood at nothing there');
  assert.equal(bodyMeasure({ ...f.players.mem0, bd: V.players.mem0.bd }, kept('mem0'))[4], 1, 'the voyage\'s figures would say it stood');
  // mem1 felled in the fight, its share dealt: the fight's own figures then
  V.players.mem1.bd = { ...V.players.mem1.bd, w: 1, fs: V.players.mem1.stoodMs, fd: 0 };
  stampFightFall(V);
  assert.deepEqual(f.players.mem1.bf, { s: 60_000, d: f.players.mem1.share });
  assert.equal(measure('mem1')[4], 1);
  stampFightFall(V);
  assert.deepEqual(f.players.mem0.bf, { s: 0, d: 0 }, 'kept as it was');
});

test('KETCH EVERY BODY RISES CLEAR: every Watch spot and every bridge spawn clear of its floor\'s obstacles by its body\'s breadth - the lift\'s tower, the helm\'s pedestal, the bridge\'s cradles among them; the Warden\'s home before its helm, never in the pedestal (AUDIT KETCH L4-10; mutants: a spot in the tower; a spawn in a cradle)', async () => {
  const { KT_WATCH_SPOTS, KT_WARDEN_HOME, KT_HELM, KT_HELM_PEDESTAL_R, KT_BRIDGE_CRADLES } = await import('../../../src/net/ketch/ketchDeck.js');
  const { KT_OBSTACLES, KT_KINDS } = await import('../../../src/net/ketch/ketchConstructs.js');
  const { KT_BRIDGE_SPAWNS } = await import('../../../src/net/ketch/ketchBrain.js');
  const { KW_BODY } = await import('../../../src/net/ketch/ketchWarden.js');
  const clear = (floor, [x, z], r) => KT_OBSTACLES[floor].every(([ox, oz, or]) => Math.hypot(x - ox, z - oz) >= or + r - 1e-9);
  for (const kind of ['sphere', 'sentry']) for (const p of KT_WATCH_SPOTS[kind]) assert.ok(clear('waist', p, KT_KINDS[kind].r), `${kind} at ${p}`);
  assert.ok(clear('waist', KT_WATCH_SPOTS.captain, KT_KINDS.captain.r), 'the Captain');
  for (const p of KT_BRIDGE_SPAWNS) assert.ok(clear('bridge', p, KT_KINDS.sentry.r), `a bridge spawn at ${p}`);
  for (const [x, z] of KT_BRIDGE_CRADLES) assert.ok(KT_OBSTACLES.bridge.some(([ox, oz]) => ox === x && oz === z), 'the cradles walked round');
  assert.ok(Math.hypot(KT_WARDEN_HOME.x - KT_HELM.x, KT_WARDEN_HOME.z - KT_HELM.z) >= KW_BODY.r + KT_HELM_PEDESTAL_R, 'the Warden before its helm');
});
