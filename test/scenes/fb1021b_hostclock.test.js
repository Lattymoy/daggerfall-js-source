// HOST-CLOCK (2026-10-21, OWNER-CLOCK's Left in bible/01-Overview/bugs/Field-Bugs-2026-10-21c.md; bible/06-Systems/Online-Arc.md
// OWNER-CLOCK, HOST-CLOCK). OWNER-CLOCK kept a slow owner's STREET foes to its own clamped frame (scenes/ownerCatchUp.js), and
// FLAGGED the rest: a building's foes (scenes/worldModes.js) and a dungeon's (scenes/dungeonContext.js) were stepped
// inside their hosts' frames at FOE-CATCHUP's half of a slow host's frame - half speed for everyone in the room below
// 10 fps - and the town watch's bodies (scenes/cityGuards.js) kept that half while its brains, on the page's one tactics
// clock, ran on with the street's catch-up. Now every pool FOE-CATCHUP caps goes through the page's one catch-up
// (`ownerFoes`), one plan a frame for all of them:
//   1. a frame's plan is made at its first step, priced at what EVERY pool of the frame before cost a call, and every
//      pool of the frame takes it - so the extras of a frame spend OWNER_CATCHUP_SHARE at most, all its pools together,
//      and the brain's clock is carried once, as far as every body went;
//   2. a pool that did not step in the frame before (a door taken: a building's pools new, the street's back) takes the
//      host's one call; the mode machine's frame begins the catch-up's, so a door's new pools are priced at their own;
//   3. a pool's update keeps its answer (the watch's returns the batches the host draws);
//   4. the street's watch rides world.js's one statement beside its encounter pool; a building's two pools are put
//      through the page's catch-up at the mount (one statement in createWorldModes); a dungeon's foe loop is the step
//      drawFoes hands it (`stepFoes`, its body the loop as it stood - each call stands its foes whole, the last drawn).
// Executed: the law over counted pools on an injected clock; the street's real encounter pool and real watch through
// world.js's wiring on the page's own clocks; the building's real pools through worldModes' own mount statements; the
// dungeon's foe loop from drawFoes' own text over a real EnemyAI body (the record around the body is this file's -
// buildDungeonContext's producer needs a whole dungeon - and every name the loop reads that this pin does not hand it
// is a stub that answers nothing). The hosts' calls by source.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOwnerCatchUp, ownerFoes, wireOwnerClock, markModalSteps, OWNER_CATCHUP_SHARE } from '../../src/scenes/ownerCatchUp.js';
import { FOE_MAX_FRAME_DT, foeFrameDt, EnemyAI } from '../../src/characters/enemy/enemyMotor.js';
import { tickTactics, tacticsNow } from '../../src/ai/tacticsClock.js';
import { FIXED_DT } from '../../src/player/motor.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createCityGuards } from '../../src/scenes/cityGuards.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const FPS = [60, 30, 20, 15, 10, 5, 4, 3, 2, 1];
/** The host's clamped frame at `fps` - world.js's and dungeon.js's `Math.min(0.1, ...)`: the time its player takes. */
const hostDt = (fps) => Math.min(0.1, 1 / fps);
/** FOE-CATCHUP's pace against the player - every row of THE PARITY's "alone" column. */
const ALONE = [1, 1, 1, 0.75, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

// ---- the law, over counted pools on an injected clock ----
/** A pool whose calls are counted, each costing `cost()` ms of the clock and answering its call's number. */
function counted(clock, cost) { const calls = []; return { calls, update(dt) { calls.push(dt); clock.ms += typeof cost === 'function' ? cost() : cost; return calls.length; } }; }

test('HOST-CLOCK one plan a frame, every pool of it: a frame of two pools at 4 fps takes the host\'s 0.1 s in two calls for BOTH, the brain carried once (0.05 past the host\'s tick, not twice); priced at the SUM of both pools\' calls - two that each fit the share alone but not together take the host\'s one call; the first frame (nothing measured) takes it too; each update answers what its last call answered (mutants: priced at one pool; the brain carried per pool; the answer dropped)', () => {
  const clock = { ms: 0 };
  const ticks = [];
  const c = createOwnerCatchUp({ shared: () => true, clock: () => clock.ms, tick: (d) => ticks.push(d), mark: () => {} });
  let costB = 10;
  const a = counted(clock, 10), b = counted(clock, () => costB);
  c.pools(a, b);
  const frame = () => { a.calls.length = 0; b.calls.length = 0; ticks.length = 0; c.frame(); return [a.update(0.1), b.update(0.1)]; };
  clock.ms = 250; frame();
  assert.deepEqual([a.calls, b.calls], [[0.1], [0.1]], 'the first frame: nothing measured, each pool the host\'s one call');
  clock.ms = 500;
  const answers = frame();
  assert.deepEqual([a.calls, b.calls], [[0.05, 0.05], [0.05, 0.05]], '10 + 10 ms a call against a 25 ms share: both pools the host\'s frame in two');
  assert.deepEqual(answers, [2, 2], 'each update answers its LAST call\'s answer (the watch\'s batches), not its first\'s');
  assert.ok(near(sum(ticks), 0.1 - FOE_MAX_FRAME_DT), `the brain carried once, to the bodies' 0.1 s: ${sum(ticks)}`);
  costB = 20;
  clock.ms = 750; frame();   // priced at the last frame's 10 + 10: both caught up, b measured at 20
  clock.ms = 1000; frame();
  assert.deepEqual([a.calls, b.calls], [[0.1], [0.1]], '10 + 20 ms past the 25 ms share - each would fit alone; together the host\'s one call');
  assert.deepEqual(ticks, [], 'and the brain is the host\'s tick alone');
  // alone in the room: FOE-CATCHUP's law, the host's one call for every pool
  const lone = createOwnerCatchUp({ shared: () => false, clock: () => clock.ms, tick: (d) => ticks.push(d), mark: () => {} });
  const p = counted(clock, 1), q = counted(clock, 1);
  lone.pools(p, q);
  for (let k = 0; k < 4; k++) { clock.ms += 250; p.calls.length = 0; q.calls.length = 0; lone.frame(); p.update(0.1); q.update(0.1); assert.deepEqual([p.calls, q.calls], [[0.1], [0.1]]); }
});

test('HOST-CLOCK a door: a pool that did not step in the frame before takes the host\'s one call - a building\'s new pools on their first frame, the street\'s on their first frame back (their price is a building ago) - and the mode machine\'s frame begins the catch-up\'s, so the new room is priced at its own pools from its second frame, not at the room it left (mutants: a new pool follows the plan; the host\'s frame not a frame of the catch-up\'s)', () => {
  const clock = { ms: 0 };
  let shared = true;
  const sw = counted(clock, 30), sf = counted(clock, 30), bf = counted(clock, 5), bw = counted(clock, 5);
  const c = createOwnerCatchUp({ shared: () => shared, clock: () => clock.ms, tick: () => {}, mark: () => {} });
  c.pools(sw, sf, bf, bw);
  const modes = markModalSteps({ inner: null, frame(dt, now) { return modes.inner(dt, now); } }, { mark: () => {}, frame: () => c.frame() });   // as wireOwnerClock wires the page's
  const all = [sw, sf, bf, bw];
  const run = (where) => {
    clock.ms += 250;
    for (const p of all) p.calls.length = 0;
    modes.inner = () => { if (where === 'building') { bf.update(0.1); bw.update(0.1); } return where === 'building'; };
    if (!modes.frame(0.1, clock.ms)) { sw.update(0.1); sf.update(0.1); }   // world.js: the modal frame first, the street's pools after it
    return all.map((p) => p.calls.length);
  };
  run('street'); run('street');
  assert.deepEqual(run('street'), [1, 1, 0, 0], 'the street\'s two dear pools (30 + 30 ms against 25): the host\'s one call');
  assert.deepEqual(run('building'), [0, 0, 1, 1], 'a building\'s first frame: its pools new, the host\'s one call each');
  assert.deepEqual(run('building'), [0, 0, 2, 2], 'its second: priced at its own 5 + 5 ms - the host\'s frame in two, for both');
  assert.deepEqual(run('street'), [1, 1, 0, 0], 'the street\'s first frame back, the building\'s cheap 5 + 5 ms the frame before: its own dear pools the host\'s one call');
  run('building'); shared = false;
  assert.deepEqual(run('building'), [0, 0, 1, 1], 'alone, priced or not: the host\'s one call');
});

test('HOST-CLOCK the frame\'s share is all its pools\': a host frame past world.js\'s clamp (0.3 s) planned at a cheap forecast stops the second pool\'s extras once the first pool\'s have spent the frame\'s share - a later pool makes an extra only while the frame\'s extras are under it, so the extras of a frame, every pool together, never pass OWNER_CATCHUP_SHARE by more than one call (AUDIT HOST-CLOCK 3: its first extra was made on the forecast alone, one call past the share a POOL) (mutants: each pool\'s extras measured alone; HC-later-pool-past-the-share)', () => {
  const clock = { ms: 0 };
  const costs = { a: [4], b: [4] };
  const a = counted(clock, () => costs.a.shift() ?? 10), b = counted(clock, () => costs.b.shift() ?? 10);
  const c = createOwnerCatchUp({ shared: () => true, clock: () => clock.ms, tick: () => {}, mark: () => {} });
  c.pools(a, b);
  clock.ms = 250; c.frame(); a.update(0.3); b.update(0.3);
  clock.ms = 500; c.frame(); a.calls.length = 0; b.calls.length = 0;
  a.update(0.3); b.update(0.3);
  assert.equal(OWNER_CATCHUP_SHARE * 250, 25);
  assert.deepEqual([a.calls.length, b.calls.length], [4, 1], 'forecast at 4 + 4 ms (three extras each): the first pool\'s three extras spend 30 ms of the 25, so the second makes none');
  const clock2 = { ms: 0 };
  const dear = { on: false };
  const p = counted(clock2, () => (dear.on ? 10 : 5)), q = counted(clock2, () => (dear.on ? 10 : 5));
  const c2 = createOwnerCatchUp({ shared: () => true, clock: () => clock2.ms, tick: () => {}, mark: () => {} });
  c2.pools(p, q);
  clock2.ms = 250; c2.frame(); p.update(0.3); q.update(0.3);
  clock2.ms = 500; c2.frame(); p.calls.length = 0; q.calls.length = 0;
  dear.on = true;   // priced at 5 + 5 ms (two extras), each call now 10
  p.update(0.3); q.update(0.3);
  assert.deepEqual([p.calls.length, q.calls.length], [3, 2], 'the first pool\'s two extras spend 20 ms of the 25; the second\'s first goes, under the share, and its next would start past it');
  assert.equal(clock2.ms - 500 - 2 * 10, 30, 'the frame\'s extras 30 ms: past the share of 25 by less than the one call made under it');
});

test('HOST-CLOCK a pool\'s update keeps its own `this` through the catch-up (AUDIT HOST-CLOCK 5: a method that reads `this` threw) (mutants: HC-pool-method-loses-this)', () => {
  const clock = { ms: 0 };
  const c = createOwnerCatchUp({ shared: () => true, clock: () => clock.ms, tick: () => {}, mark: () => {} });
  const pool = { n: 0, update(dt, extra) { this.n += dt * extra; return this.n; } };
  c.pools(pool);
  c.frame();
  assert.equal(pool.update(0.05, 2), 0.1);
  assert.equal(pool.n, 0.1);
});

test('HOST-CLOCK the page\'s frames are its mode machine\'s, through world.js\'s wiring: the page\'s catch-up begins a frame at every frame of the mode machine wireOwnerClock wraps, so a door\'s new pools - a building\'s, cheap - are priced at their own calls from their second frame, never at the dear street they left behind (mutants: the wiring\'s frame dropped; the mode machine\'s frame unheard)', (t) => {
  const clock = { ms: 500_000 };
  t.mock.method(performance, 'now', () => clock.ms);
  const sw = counted(clock, 30), sf = counted(clock, 30), bf = counted(clock, 5), bw = counted(clock, 5);
  const modes = { inner: () => false };
  modes.frame = (dt, now) => modes.inner(dt, now);
  wireOwnerClock([sw, sf], modes, () => true);   // the street's two, dear (30 + 30 ms against a 25 ms share)
  ownerFoes.pools(bf, bw);   // a building's two, as worldModes puts them through at the mount
  const run = (where) => {
    clock.ms += 250;
    for (const p of [sw, sf, bf, bw]) p.calls.length = 0;
    modes.inner = () => { if (where === 'building') { bf.update(0.1); bw.update(0.1); } return where === 'building'; };
    if (!modes.frame(0.1, clock.ms)) { sw.update(0.1); sf.update(0.1); }
    return [sw, sf, bf, bw].map((p) => p.calls.length);
  };
  run('street'); run('street');
  assert.deepEqual(run('street'), [1, 1, 0, 0]);
  assert.deepEqual(run('building'), [0, 0, 1, 1], 'the door: new pools, the host\'s one call');
  assert.deepEqual(run('building'), [0, 0, 2, 2], 'priced at the building\'s own 5 + 5 ms: caught up');
});

// ---- the real pools (the WORLD6b-ii rig: a crafted MONSTER.BSA and the synthetic CLASS18.CFG, on flat open ground) ----
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((x, [, y]) => x + y.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
function classCfg() { const b = new Uint8Array(80); const v = new DataView(b.buffer); v.setUint16(52, 10, true); for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true); return b; }
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const collider = { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60), crimeCommitted: 4 });
const rig = (pe) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() }, collider,
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS18.CFG') return classCfg(); throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
});
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const me = [0, 0, 0], eye = [0, 1.6, 0];
/** The seconds a body was handed: its EnemyAI's update, wrapped (the motor takes every second of it at FIXED_DT). */
const bodyClock = (ai) => { const got = []; const u = ai.update.bind(ai); ai.update = (dt, ...rest) => { got.push(dt); return u(dt, ...rest); }; return got; };
/** A pool whose update the clock sees cost 1 ms (performance.now() is mocked to the page's clock in these pins). */
const costly = (clock, pool) => { const u = pool.update; pool.update = (...a) => { clock.ms += 1; return u(...a); }; return pool; };
/** A real encounter pool with one rat, and a real watch with one watchman (the crime holds him standing). */
async function realPools(pe) {
  const foes = createExteriorFoes(rig(pe));
  const rat = await foes.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  const guards = createCityGuards(rig(pe));
  await guards.spawnCityGuards(true, { playerFeet: me, playerFwd: [0, 0, 1], pool: [{ pos: [6, 0, 6], fwdYaw: 0, guard: true, disable: () => {} }] });
  for (let i = 0; i < 5; i++) await settle();
  assert.ok(rat && guards.guards.length === 1, 'a rat and a watchman stood');
  return { foes, rat, guards, watchman: guards.guards[0] };
}
/** Frames of a host at `fps` on the page's clock, in world.js's order: the brain ticked the frame's capped step, then
 *  the mode machine's frame (wired: the catch-up's frame begins) - a building's or a dungeon's `step` runs inside it,
 *  the street's after it answers that it ran nothing. */
function runFrames(clock, modes, fps, frames, step, { street = false } = {}) {
  const dt = hostDt(fps);
  for (let k = 0; k < frames; k++) {
    clock.ms += 1000 / fps;
    tickTactics(foeFrameDt(dt));
    modes.inner = () => (street ? false : step(dt, k));
    if (!modes.frame(dt, clock.ms) && street) step(dt, k);
  }
}
/** A mode machine whose frame runs `inner` - called unbound, as markModalSteps calls the real one. */
const hostModes = () => { const m = { inner: () => false }; m.frame = (dt, now) => m.inner(dt, now); return m; };

test('HOST-CLOCK the street, executed through world.js\'s own statement: the watch rides the catch-up beside the encounter pool - online with anyone else here, a 4 fps owner\'s watchman and rat are each handed the host\'s 0.1 s a frame, and the page\'s tactics clock moves 0.1 s, once: the watch\'s brains and its bodies on one clock (the FLAG retired); the watch\'s update still answers its batches; alone, FOE-CATCHUP\'s 0.05 s for both and the brain (mutants: the watch left out of the statement; `shared` not handed on; the answer dropped)', async (t) => {
  const clock = { ms: 100_000 };
  t.mock.method(performance, 'now', () => clock.ms);
  const pe = playerEntity();
  const { foes, rat, guards, watchman } = await realPools(pe);
  costly(clock, foes); costly(clock, guards);
  const ratS = bodyClock(rat.ai), watchS = bodyClock(watchman.ai);
  const modes = hostModes();
  let shared = true;
  // world.js's one statement, executed from its own text (whatever it hands; the by-source pin below holds its words)
  const stmt = /\n {2}(wireOwnerClock\([^\n]*?\);)/.exec(rd('src/scenes/world.js'))[1];
  const online = { status: 'open', get othersHere() { return shared ? 1 : 0; } };
  new Function('wireOwnerClock', 'exteriorFoes', 'cityGuards', 'modes', 'online', stmt)(wireOwnerClock, foes, guards, modes, online);
  let batches = null;
  const street = (dt) => { batches = guards.update(dt, me, eye, senses(pe)); foes.update(dt, me, eye, senses(pe)); };   // world.js: the watch, then the encounter pool
  const brainAt = [];
  runFrames(clock, modes, 4, 1, street, { street: true });
  for (let k = 0; k < 4; k++) {
    ratS.length = 0; watchS.length = 0;
    const was = tacticsNow();
    runFrames(clock, modes, 4, 1, street, { street: true });
    brainAt.push(tacticsNow() - was);
    assert.deepEqual([ratS.length, watchS.length], [2, 2], `frame ${k}: two calls each`);
    assert.ok(near(sum(ratS), 0.1) && near(sum(watchS), 0.1), `frame ${k}: rat ${sum(ratS)}, watchman ${sum(watchS)} - the host's 0.1 s`);
    assert.ok(Array.isArray(batches) && batches.includes(watchman.batch) && batches.filter((x) => x === watchman.batch).length === 1, 'the watch\'s update answers its batches, the watchman\'s once');
  }
  assert.ok(brainAt.every((d) => near(d, 0.1)), `the tactics clock moved the bodies' 0.1 s a frame, once: ${brainAt}`);
  shared = false;
  runFrames(clock, modes, 4, 1, street, { street: true });
  ratS.length = 0; watchS.length = 0;
  const was = tacticsNow();
  runFrames(clock, modes, 4, 1, street, { street: true });
  assert.ok([sum(ratS), sum(watchS), tacticsNow() - was].every((x) => near(x, FOE_MAX_FRAME_DT)), `alone: FOE-CATCHUP's 0.05 s for the bodies and the brain alike - ${[sum(ratS), sum(watchS), tacticsNow() - was]}`);
});

// worldModes.js: the building's mount - its own three statements, executed
const WM = rd('src/scenes/worldModes.js');
const MOUNT_FROM = WM.indexOf('      interiorFoes = makeInteriorFoes(ctx);'), MOUNT_TO = WM.indexOf('      _intNetOn = false; ensureInteriorNet();', MOUNT_FROM);
const MOUNT = MOUNT_FROM > 0 && MOUNT_TO > MOUNT_FROM && MOUNT_TO - MOUNT_FROM < 800 ? WM.slice(MOUNT_FROM, MOUNT_TO) : null;   // the pools minted, and whatever wires them before their net
const mountBuilding = (made) => {
  const state = { ctx: {}, makeInteriorFoes: () => made.foes, makeInteriorGuards: () => made.guards, ownerFoes, interiorFoes: null, interiorGuards: null };
  new Function('s', `with (s) {\n${MOUNT}\n}`)(state);   // the slice ends in its line's comment
  return state;
};

test('HOST-CLOCK THE PARITY, a building, executed through worldModes\' own mount statements on its real pools: at every rate the clamp allows, online with anyone else in the room, the building\'s rat and the watchman called in are each handed the seconds my player takes, never more; alone, FOE-CATCHUP\'s three quarters at 15 fps and half from 10 down, as before this slice; at 4 fps the rat\'s body takes six FIXED_DT steps a frame where it took three (mutants: the mount unwired; the watch left out; a pool new to the frame caught up)', async (t) => {
  assert.ok(MOUNT, 'worldModes.js mounts the building\'s two pools at the building\'s mount');
  const clock = { ms: 200_000 };
  t.mock.method(performance, 'now', () => clock.ms);
  const modes = hostModes();
  let shared = true;
  wireOwnerClock([], modes, () => shared);   // the world host's word on who is here (its street pools are this file's other pin)
  const pe = playerEntity();
  const table = [];
  for (const fps of FPS) {
    const row = [fps];
    for (const s of [true, false]) {
      shared = s;
      const made = await realPools(pe);
      costly(clock, made.foes); costly(clock, made.guards);
      const b = mountBuilding(made);
      assert.equal(b.interiorFoes, made.foes); assert.equal(b.interiorGuards, made.guards);
      const ratS = bodyClock(made.rat.ai), watchS = bodyClock(made.watchman.ai);
      const steps = { n: 0 }; const st = made.rat.ai._step.bind(made.rat.ai); made.rat.ai._step = (...a) => { steps.n++; return st(...a); };
      // worldModes' interior frame: the encounter pool in the sim block, the watch in the draw block
      const building = (dt) => { b.interiorFoes.update(dt, me, eye, senses(pe)); b.interiorGuards.update(dt, me, eye, senses(pe), {}); return true; };
      runFrames(clock, modes, fps, 1, building);
      assert.deepEqual([ratS.length, watchS.length], [1, 1], `${fps} fps: the building's first frame - its pools new to the catch-up, the host's one call`);
      ratS.length = 0; watchS.length = 0; steps.n = 0;
      runFrames(clock, modes, fps, 8, building);
      const player = 8 * hostDt(fps);
      row.push(+(sum(ratS) / player).toFixed(9), +(sum(watchS) / player).toFixed(9));
      if (fps === 4) assert.ok(Math.abs(steps.n - 8 * (s ? 6 : 3)) <= 1, `4 fps, ${s ? 'shared' : 'alone'}: ${steps.n} FIXED_DT steps in 8 frames`);
    }
    table.push(row);
  }
  assert.deepEqual(table, FPS.map((fps, i) => [fps, 1, 1, ALONE[i], ALONE[i]]),
    'fps, then the building\'s rat\'s and watchman\'s body seconds over my player\'s - online with anyone else in the room, then alone (before this slice: the alone columns, online too)');
});

// dungeonContext.js drawFoes: the frame's foes, its own text - `const frameDt = dt;` to the step through the catch-up and the frame's own time taken back
const DC = rd('src/scenes/dungeonContext.js');
const STEP_FROM = DC.indexOf('    const frameDt = dt;'), STEP_TO = DC.indexOf('    // MWNPC5b: THE DEAD IN THEIR BODIES', STEP_FROM);
const DUNGEON_STEP = STEP_FROM > 0 && STEP_TO > STEP_FROM ? DC.slice(STEP_FROM, STEP_TO) : null;   // the closure and the frame's own call of it
/** Whatever the loop reads that this pin hands it not: a stub that answers nothing (a call answers undefined, a member
 *  is the stub again). */
const nothing = new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => NaN : nothing), apply: () => undefined, construct: () => nothing });
const scope = (state) => new Proxy(state, {
  has: (_t, k) => k !== '__s',
  get: (tg, k) => (k === Symbol.unscopables ? undefined : k in tg ? tg[k] : k in globalThis ? globalThis[k] : nothing),
  set: (tg, k, v) => { tg[k] = v; return true; },
});
const runDungeonStep = DUNGEON_STEP ? new Function('__s', `with (__s) {\n${DUNGEON_STEP}\n}`) : null;
/** One dungeon foe: a real EnemyAI body (FIXED_DT steps, its own accumulator) in this pin's record. */
function dungeonFoe() {
  const ai = new EnemyAI(collider, [10, 0, 10], 0, {});
  const f = {
    ai, entity: { stats: { speed: 50 } }, batch: {}, mobileType: 0, mobileArchive: 255,
    attack: { update: () => [], swingSeq: 0, firedRanged: false },
    mobile: { update: () => ({ record: 0, frame: 0, flip: false }), isPlayingOneShot: () => false, basics: { behaviour: 'General' }, doMeleeDamage: false, shootArrow: false },
  };
  return f;
}
/** The dungeon's frame state - drawFoes' locals the loop reads, and its one lane (begun, stood). */
function dungeonFrame(clock, foe) {
  const lane = { begun: 0, stood: [], begin() { this.begun++; this.stood = []; }, stand(kind, actor) { this.stood.push(kind); } };
  const spaced = [];
  const state = {
    ownerFoes, foes: [foe], dt: 0, playerFeet: me, eye, collider, foeFrameDt, _authority: true, foeDeps: null,
    _senses: { playerEntity: playerEntity(), playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true },
    _mobileBatches: [], _npcStood: [], npcLane: lane, isBodyFoe: () => true,
    spaceFoes: (fs, col, d) => { spaced.push(d); clock.ms += 1; },   // the call is seen to cost 1 ms
    foeDraw: () => ({ kind: 'plain' }), mobileBillboardSize: () => ({ w: 1, h: 2 }), renderer: { textures: new Map() },
  };
  return { state, lane, spaced, step: (dt) => { state.dt = dt; runDungeonStep(scope(state)); return true; } };
}

test('HOST-CLOCK THE PARITY, a dungeon, executed from drawFoes\' own text over a real EnemyAI body: at every rate the clamp allows, online with anyone else in the room, a dungeon foe is handed the seconds my player takes, never more; alone, FOE-CATCHUP\'s three quarters at 15 fps and half from 10 down, as before this slice; at 4 fps six FIXED_DT steps a frame where three (mutants: the loop stepped by itself, not through the catch-up)', (t) => {
  assert.ok(DUNGEON_STEP, 'drawFoes hands its foe loop to the page\'s catch-up as `stepFoes`');
  const clock = { ms: 300_000 };
  t.mock.method(performance, 'now', () => clock.ms);
  const modes = hostModes();
  let shared = true;
  wireOwnerClock([], modes, () => shared);
  const table = [];
  for (const fps of FPS) {
    const row = [fps];
    for (const s of [true, false]) {
      shared = s;
      const foe = dungeonFoe();
      const got = bodyClock(foe.ai);
      const steps = { n: 0 }; const st = foe.ai._step.bind(foe.ai); foe.ai._step = (...a) => { steps.n++; return st(...a); };
      const d = dungeonFrame(clock, foe);
      runFrames(clock, modes, fps, 1, d.step);
      assert.equal(got.length, 1, `${fps} fps: the first frame of a new dungeon - the host's one call`);
      got.length = 0; steps.n = 0;
      runFrames(clock, modes, fps, 8, d.step);
      row.push(+(sum(got) / (8 * hostDt(fps))).toFixed(9));
      if (fps === 4) assert.ok(Math.abs(steps.n - 8 * (s ? 6 : 3)) <= 1, `4 fps, ${s ? 'shared' : 'alone'}: ${steps.n} FIXED_DT steps in 8 frames`);
    }
    table.push(row);
  }
  assert.deepEqual(table, FPS.map((fps, i) => [fps, 1, ALONE[i]]),
    'fps, then a dungeon foe\'s body seconds over my player\'s - online with anyone else in the room, then alone (before this slice: the alone column, online too)');
});

test('HOST-CLOCK a dungeon\'s caught-up frame stands its foes ONCE: each call begins the lane and lists the frame\'s foes afresh, so after the frame every live foe is listed once and stood once (the last call\'s stand is what drawFoes draws); every call spaces its foes on the call\'s own step (mutants: the batches kept across calls; the stood kept across calls; the lane begun once a frame)', (t) => {
  assert.ok(DUNGEON_STEP);
  const clock = { ms: 400_000 };
  t.mock.method(performance, 'now', () => clock.ms);
  const modes = hostModes();
  wireOwnerClock([], modes, () => true);
  const foe = dungeonFoe();
  const d = dungeonFrame(clock, foe);
  runFrames(clock, modes, 4, 1, d.step);
  d.spaced.length = 0; d.lane.begun = 0;
  runFrames(clock, modes, 4, 1, d.step);
  assert.deepEqual(d.spaced, [FOE_MAX_FRAME_DT, FOE_MAX_FRAME_DT], 'two calls, each spacing the foes on its own 0.05 s');
  assert.equal(d.lane.begun, 2, 'the lane begun by each call');
  assert.deepEqual([d.state._mobileBatches.length, d.state._npcStood.length, d.lane.stood.length], [1, 1, 1], 'the foe listed once, stood once - not once a call');
  assert.equal(d.state._mobileBatches[0], foe.batch);
  assert.equal(d.state.dt, hostDt(4), 'and the rest of the frame takes its own time back - not the last call\'s (MAC-L1b: the call\'s time is written into the frame\'s own name, never a binding that shadows it)');
});

// dungeonContext.js's own predicates for whose foe is whose - a room foe (the layout's, a shared encounter's) is the
// authority's, and a page without it leads that foe as a puppet of the host's stream
const PREDICATES = ['  const isRoomFoe = ', '  const isPuppetFoe = '].map((head) => { const at = DC.indexOf(head); return DC.slice(at, DC.indexOf('\n', at)); });
test('HOST-CLOCK a dungeon joiner\'s foes are the host\'s puppets, led by its stream: the frame steps them once, caught up only with a live foe of mine among them (AUDIT HOST-CLOCK 1: a joiner below 20 fps ran the whole loop twice a frame - every puppet\'s step, its senses, its sounds - for nothing); the room\'s authority, or a joiner with a foe of its own, takes the plan (mutants: HC-joiner-caught-up; HC-joiner-gate-unwired; HC-dead-foe-mine)', (t) => {
  assert.ok(DUNGEON_STEP && PREDICATES.every((p) => p.startsWith('  const ')), 'drawFoes\' loop and dungeonContext\'s predicates');
  const clock = { ms: 500_000 };
  t.mock.method(performance, 'now', () => clock.ms);
  const modes = hostModes();
  wireOwnerClock([], modes, () => true);
  const calls = (authority, extra = null) => {
    const foe = dungeonFoe();
    const d = dungeonFrame(clock, foe);
    if (extra) d.state.foes.push(extra);
    Object.assign(d.state, { _authority: authority, _layoutFoes: 1, puppetStep: () => {} });
    new Function('__s', `with (__s) {\n${PREDICATES.join('\n')}\n__s.isRoomFoe = isRoomFoe; __s.isPuppetFoe = isPuppetFoe;\n}`)(scope(d.state));
    runFrames(clock, modes, 4, 1, d.step);
    d.lane.begun = 0;
    runFrames(clock, modes, 4, 1, d.step);
    return d.lane.begun;
  };
  assert.equal(calls(true), 2, 'the room\'s authority at 4 fps, shared: the plan\'s two calls');
  assert.equal(calls(false), 1, 'a joiner, its one foe the room\'s - the host\'s puppet: one call');
  const own = dungeonFoe();
  assert.equal(calls(false, own), 2, 'a joiner with a foe of its own beside the puppet: the plan');
  const gone = dungeonFoe(); gone.dead = true;
  assert.equal(calls(false, gone), 1, 'its own foe dead: nothing of mine to step, one call');
});

test('HOST-CLOCK the hosts by source: world.js\'s one statement hands the street\'s watch beside its encounter pool; worldModes puts the building\'s two pools through the page\'s catch-up at the mount and its frame\'s calls stand as they stood; drawFoes hands its foe loop - the loop as it stood, its spacing inside it - to the page\'s catch-up keyed by its foe list, its peers read once a frame outside it; no host keeps a catch-up of its own (mutants: none - the executed pins above hold the wiring)', () => {
  const w = rd('src/scenes/world.js');
  assert.equal((w.match(/wireOwnerClock\(/g) ?? []).length, 1);
  assert.match(w, /\n {2}wireOwnerClock\(\[exteriorFoes, cityGuards\], modes, \(\) => online\?\.status === 'open' && online\.othersHere > 0\);/);
  assert.match(w, /livePersonBatches\.push\(\.\.\.cityGuards\.update\(foeDt,/, 'the street\'s watch: its answer drawn, as before');
  assert.match(WM, /import \{ ownerFoes \} from '\.\/ownerCatchUp\.js';/);
  assert.equal((WM.match(/ownerFoes\./g) ?? []).length, 1, 'one wiring statement in createWorldModes');
  assert.match(WM, /interiorFoes\.update\(foeDt, player\.pos, cam\.pos, _interiorSenses\(\)\);/, 'the building\'s encounter pool steps where it stepped');
  assert.match(WM, /const _guardBatches = interiorGuards\.update\(foeDt, player\.pos, cam\.pos,/, 'and its watch, its batches drawn');
  assert.match(DC, /import \{ ownerFoes \} from '\.\/ownerCatchUp\.js';/);
  const body = DUNGEON_STEP;
  assert.match(body, /^ {4}const frameDt = dt;[^\n]*\n {4}const stepFoes = \(stepDt\) => \{\n {4}dt = stepDt;[^\n]*\n {4}_mobileBatches\.length = 0;\n {4}_npcStood\.length = 0;\n {4}npcLane\?\.begin\(\);\n {4}let _fi = -1;\n/, 'each call: the frame\'s lists afresh, the lane begun, the count from the top');
  assert.match(body, /\n {4}spaceFoes\(foes, collider, foeFrameDt\(dt\), [^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*clearDoorways\(foes, [^\n]*\n\s*for \(const f of foes\) \{\n {6}_fi\+\+;/, 'the spacing and the loop, inside it, on the call\'s step');
  assert.match(body, /f\.ai\.update\(foeFrameDt\(dt\), _pf, /, 'the body handed FOE-CATCHUP\'s step of the CALL');
  assert.match(body, /\n {4}\};\n {4}ownerFoes\.step\(foes, frameDt, stepFoes, foes\.some\(\(f, i\) => !f\.dead && !isPuppetFoe\(f, i\)\)\);[^\n]*\n {4}dt = frameDt;/, 'the loop handed to the page\'s catch-up, keyed by the context\'s one foe list - caught up with a live foe of mine among them');
  assert.match(DC, /_peerFrame\+\+;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*const frameDt = dt;[^\n]*\n\s*const stepFoes = \(stepDt\) => \{/, 'the peers read once a frame, outside the calls');
  assert.equal((DC.match(/ownerFoes\./g) ?? []).length, 1);
  for (const [f, t] of [['world.js', w], ['worldModes.js', WM], ['dungeonContext.js', DC]]) assert.doesNotMatch(t, /catchUpOwnerFoes|createOwnerCatchUp/, `${f}: the page's one catch-up, never one of its own`);
});
