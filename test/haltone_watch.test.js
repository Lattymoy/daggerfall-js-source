// HALT-ONE (2026-10-05, Mac: "with the living world we take it further and improve the guards and also reduce the HALT
// noise"; asked how often the watch should call, "Once, then rarely"): THE WATCH CALLS AS ONE in the living watch's lane
// (bible/06-Systems/Living-World.md HALT-ONE). DFU's EnemySounds.FixedUpdate gives every watchman within 16 m his own
// attract clock - "Halt!" every 3 to 9 seconds, 80% of the time, hostile or not: eight a minute a watchman, forty from
// a crime's five, a squad arriving in chorus, allies and other players' watch among them, under the surrender box too.
// Here the watch has one voice: one Halt as it first comes for the player, then at most one every HALT_GAP_S from the
// whole watch while it is after him; never a defender's, a pacified, running or walking-away watchman's, never under a
// window, and its wind-up and stagger a person's. The classic lane keeps DFU's per-watchman cadence, pinned against it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WatchVoice, HALT_GAP_S, EnemySoundSource, ATTRACT_RADIUS, OCCLUDED_VOLUME_SCALE } from '../src/characters/enemySounds.js';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { windupFeedback, tellCues } from '../src/scenes/hostCombat.js';
import { createSiegeNpcs } from '../src/scenes/siegeNpcs.js';
import { SIEGE_UNITS_PER_M } from '../src/net/siegeRef.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { Collider } from '../src/player/collider.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { CRIMES } from '../src/systems/court.js';
import { SOUND } from '../src/systems/soundClips.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const HALT = ENEMY_BASICS[GUARD_MOBILE_TYPE].barkSound, MOVE = ENEMY_BASICS[GUARD_MOBILE_TYPE].moveSound;
const seeded = (a) => () => { a = (a * 1103515245 + 12345) >>> 0; return a / 2 ** 32; };

test('HALT-ONE the voice: the first caller at once, the nearest of them; then none for HALT_GAP_S whoever calls; none under a window, its time running on; the incident over, the next met at once (mutants: the gap; the nearest; the window; the end)', () => {
  assert.equal(HALT_GAP_S, 15);
  const v = new WatchVoice();
  const a = { dist: 9 }, b = { dist: 4 }, c = { dist: 12 };
  assert.equal(v.tick(1 / 30, []), null, 'nobody calling, nothing said');
  assert.equal(v.tick(1 / 30, [a, b, c]), b, 'the first comes at once - the nearest');
  let t = 0, said = 0;
  while (t < HALT_GAP_S - 0.05) { t += 1 / 30; if (v.tick(1 / 30, [a, b, c])) said++; }
  assert.equal(said, 0, 'nothing more inside the gap, however many call');
  t = 0;
  while (!v.tick(1 / 30, [c, a])) t += 1 / 30;
  assert.ok(t < 0.2, 'and the next as soon as the gap is out');
  for (let i = 0; i < 30 * 20; i++) assert.equal(v.tick(1 / 30, [a, b], { quiet: true }), null, 'nobody under a window');
  assert.equal(v.tick(1 / 30, [a, c]), a, 'the window gone and the gap long out: at once, the nearest calling now');
  v.end();
  assert.equal(v.tick(0, [c]), c, 'the incident over: the next met by its first call at once');
  assert.equal(v.tick(1 / 30, [c]), null);
});

// The watch pool for real (scenes/cityGuards.js), its watchmen hand-made as the WERE-FRIGHT audit's are, each with a
// seeded EnemySoundSource; the audio a recorder of every play3d.
const quad = new Uint32Array([0, 1, 2, 0, 2, 3]);
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const stubTex = { getFrameCount: () => 1, getSize: () => ({ width: 1, height: 1 }), getScale: () => ({ width: 0, height: 0 }) };
function field(wall = false) {
  const c = new Collider(() => -1000);
  c.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), quad, I4);
  if (wall) c.addMesh('wall', new Float32Array([-20, -1, 2, 20, -1, 2, 20, 4, 2, -20, 4, 2]), quad, I4);   // across z = 2
  return c;
}
function rig({ one, window = () => false, wall = false, n = 5, where = (i) => [Math.cos(i) * (3 + i), 0, Math.sin(i) * (3 + i)], crime = CRIMES.Assault } = {}) {
  const heard = [];
  const audio = { play3d: (clip, at, volume) => heard.push({ clip, at: [...at], volume }) };
  const c = field(wall);
  const player = { name: 'Mack', level: 10, health: 40, maxHealth: 40, crimeCommitted: crime, legalRep: {}, items: [], activeEffects: [], stats: {} };
  const pool = createCityGuards({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: c, fetchBytes: () => new Promise(() => {}), getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, playerEntity: player, audio, onPlayerHurt: () => {}, rand: () => 0.9,
    oneVoice: () => one, windowUp: window,
  });
  const sources = [];
  for (let i = 0; i < n; i++) {
    const feet = where(i);
    const sounds = new EnemySoundSource(GUARD_MOBILE_TYPE, seeded(7919 * (i + 1)));
    sources.push({ feet, seed: 7919 * (i + 1) });
    const ai = new EnemyAI(c, feet, Math.PI, { liveSpeed: 0 });
    ai.update = () => {};   // a watchman stood where he is put - the voice is the pin, not the walk
    pool.guards.push({
      id: i, dead: false, defender: false, batch: {}, mobileType: GUARD_MOBILE_TYPE, _swingSeq: 0, _mout: null, archive: 399, tex: stubTex,
      entity: { health: 40, maxHealth: 40, level: 10, activeEffects: [], items: [], stats: { speed: 50 } },
      mobile: { update: () => ({ record: 0, frame: 0, flip: false }), doMeleeDamage: false },
      ai, attack: { machine: { state: 'Idle' }, swingSeq: 0, update() {} }, sounds, concealment: () => 0,
    });
  }
  return { pool, heard, sources, run: (seconds, dt = 1 / 30) => { for (let f = 0; f < Math.round(seconds / dt); f++) pool.update(dt, [0, 0, 0], [0, 1.6, 0], {}); } };
}

test('HALT-ONE the pool: five watchmen after the player inside 16 m call as one - a Halt at once from the nearest, then one each HALT_GAP_S, eight in two minutes where DFU\'s clocks give some eighty; the classic lane keeps every watchman\'s own clock, call for call (mutants: the lane unread; every watchman calling; the nearest not the caller; the gap)', () => {
  const r = rig({ one: true });
  r.run(120);
  const halts = r.heard.filter((h) => h.clip === HALT);
  assert.equal(halts.length, r.heard.length, 'the Halt alone - no move voice, no second clip');
  assert.equal(halts.length, 8, 'at 0, 15, ... 105 s');
  const near = r.pool.guards.reduce((a, g) => (Math.hypot(...g.ai.feet) < Math.hypot(...a.ai.feet) ? g : a));
  for (const h of halts) assert.deepEqual(h.at, [near.ai.feet[0], near.ai.feet[1] + 1, near.ai.feet[2]], 'from the nearest, a metre over his feet');
  assert.ok(r.pool.guards.every((g) => g.quietVoice === true), 'each marked a person\'s voice for his tells');
  // the classic lane: each watchman his own clock, as DFU's EnemySounds.FixedUpdate - the plays are exactly what each
  // source's own clock gives in the radius, and many times the one voice's
  const k = rig({ one: false });
  k.run(120);
  let expect = 0;
  for (const s of k.sources) {
    const src = new EnemySoundSource(GUARD_MOBILE_TYPE, seeded(s.seed));
    for (let f = 0; f < 3600; f++) if (src.tick(1 / 30, 1)) expect++;
  }
  assert.equal(k.heard.length, expect, 'call for call the per-watchman cadence');
  assert.ok(k.pool.guards.every((g) => g.quietVoice === false), 'and their tells the watch\'s bark');
  assert.ok(expect > 60, `DFU's cadence: ${expect} in two minutes`);
});

test('HALT-ONE who calls: a defender (no crime held - a crime enlists him into its watch, DISC19-F, and then he calls), a pacified watchman, one running from a beast, one outside the radius - none; and nobody while a window is over the world, the call coming as it closes (mutants: a defender calling; the radius unread; the window unread)', () => {
  for (const [label, make, crime] of [
    ['a defender', (g) => { g.defender = true; }, CRIMES.None],
    ['a pacified watchman', (g) => { g.ai.isHostile = false; }],
    ['a man running', (g) => { g.fleeing = true; g.ai.fleeLeft = 999; }],
    ['one past the radius', (g) => { g.ai.feet[0] = ATTRACT_RADIUS + 0.5; g.ai.feet[2] = 0; }],
  ]) {
    const r = rig({ one: true, n: 1, crime });
    make(r.pool.guards[0]);
    r.run(40);
    assert.deepEqual(r.heard, [], `${label}: silent`);
  }
  let up = true;
  const w = rig({ one: true, n: 2, window: () => up });
  w.run(30);
  assert.deepEqual(w.heard, [], 'under the surrender box: silent');
  up = false;
  w.run(1 / 30);
  assert.equal(w.heard.length, 1, 'the box closed: the call');
});

test('HALT-ONE the incident: the watch walks away (the crime cleared) and a new one comes - met by its first Halt at once; a wall between and the call is dampened as DFU\'s attract sound is (mutants: the end unread; the wall unread)', () => {
  const r = rig({ one: true, n: 2 });
  r.run(1);
  assert.equal(r.heard.length, 1);
  for (const g of r.pool.guards) g.dead = true;   // walked away
  r.run(1);
  const fresh = rig({ one: true, n: 1 }).pool.guards[0];
  r.pool.guards.push(fresh);
  r.run(1 / 30);
  assert.equal(r.heard.length, 2, 'the next watch\'s first Halt at once, not fifteen seconds on');
  const walled = rig({ one: true, n: 1, wall: true, where: () => [0, 0, 6] });
  walled.run(1);
  assert.deepEqual(walled.heard.map((h) => h.volume), [OCCLUDED_VOLUME_SCALE], 'through a wall, a quarter');
  const open = rig({ one: true, n: 1, where: () => [0, 0, 6] });
  open.run(1);
  assert.deepEqual(open.heard.map((h) => h.volume), [1]);
});

test('HALT-ONE the tells: in the lane a watchman\'s stagger and wind-up are a person\'s - no Halt; the classic watch keeps its bark in both, as TELL1 and TELL2 built them (mutants: the stagger\'s Halt kept; the wind-up\'s Halt kept)', () => {
  const heard = [];
  const audio = { play3d: (clip) => heard.push(clip) };
  const watch = (quietVoice) => ({ mobileType: GUARD_MOBILE_TYPE, quietVoice, ai: { feet: [0, 0, 0], height: 1.8 } });
  windupFeedback('stagger', watch(true), { audio });
  assert.ok(!heard.includes(HALT), 'the lane: a stagger with no Halt');
  heard.length = 0;
  windupFeedback('stagger', watch(false), { audio });
  assert.ok(heard.includes(HALT), 'classic: the watch\'s bark low, as TELL1');
  const windup = (quietVoice) => {
    const f = watch(quietVoice);
    f.ai._tac = { state: 'windup', key: 'someone else', blow: { land: 10, feint: false, kind: 'lunge' } };
    heard.length = 0;
    tellCues(f, audio, 1, 9);
    return [...heard];
  };
  assert.deepEqual(windup(true), [SOUND.SwingMediumPitch], 'the lane: a person\'s low swing');
  assert.deepEqual(windup(false), [HALT], 'classic: the bark at the wind pitch');
});

test('HALT-ONE beyond the pool: a peer\'s watchman is silent here in the lane (his call is his owner\'s); the siege\'s Town Guard cries his move voice when hurt, never a Halt (mutants: the peer\'s watch calling; the siege\'s Halt)', async () => {
  const foes = rd('src/scenes/exteriorFoes.js');
  assert.match(foes, /f\.quietVoice = f\.mobileType === KNIGHT_CITY_WATCH && !!oneVoice\(\);/);
  assert.match(foes, /if \(!f\.quietVoice\) tickEnemySound\(f\.sounds, f\.ai\.feet, playerFeet, dt,/, 'the puppet\'s attract clock gated by it');
  const M = SIEGE_UNITS_PER_M, T = 1_800_000_000_000;
  const heard = [];
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ x: 0, y: 0 }) };
  const renderer = { textures: new Set(), createBillboardBatch: () => ({ bounds: [0, 0, 0, 0] }), destroyBillboardBatch: () => {} };
  const d = createSiegeNpcs({ renderer, getTexture: async () => tex, uploadRecordFrame: () => {}, cam: () => [0, 2, 10], toScene: (x, z) => [x / M, 7, z / M],
    audio: { play3d: (clip) => heard.push(clip) } });
  const n = { id: 'n0', kind: 'guard', hp: 360, max: 360, x: 0, z: 0, tx: 0, tz: 0, at: T, down: false, atk: 0, hurtAt: -Infinity };
  d.frame([n], T);
  d.frame([{ ...n, hp: 300, hurtAt: T + 100 }], T + 100);
  assert.deepEqual(heard, [MOVE], 'hurt: his move voice');
  d.leave();
});

test('HALT-ONE the hosts: the street\'s and a building\'s watch read the living lane and the window; the street\'s foe pool the lane, for a peer\'s watchman; the fixed-city page and the dungeon keep DFU\'s cadence (FLAGGED) - and the record names all four', () => {
  const W = rd('src/scenes/world.js'), M = rd('src/scenes/worldModes.js');
  assert.match(W, /oneVoice: \(\) => livingWorldOn\(\), windowUp: \(\) => townTalk\.overlayActive,/, 'world.js: the street\'s watch');
  assert.match(W, /const exteriorFoes = createExteriorFoes\(\{\n {4}oneVoice: \(\) => livingWorldOn\(\),/, 'world.js: the street\'s foes');
  assert.match(M, /oneVoice: \(\) => livingWorldOn\(\), windowUp: \(\) => !!townTalk\?\.overlayActive,/, 'worldModes.js: a building\'s watch');
  assert.doesNotMatch(rd('src/scenes/exterior.js'), /oneVoice/, 'exterior.js: no living town, DFU\'s watch');
  const bible = rd('bible/06-Systems/Living-World.md');
  const rec = bible.slice(bible.indexOf('## HALT-ONE'), bible.indexOf('\n## ', bible.indexOf('## HALT-ONE') + 5));
  for (const host of ['scenes/world.js', 'scenes/worldModes.js', 'scenes/exterior.js', 'scenes/dungeonContext.js']) assert.ok(rec.includes(host), `the record names ${host}`);
});
