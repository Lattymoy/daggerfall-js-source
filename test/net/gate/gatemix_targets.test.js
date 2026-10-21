// GATE-MIX (2026-10-20): a cue at its targets, thinned - world/gate/gateBoss.js cueTargetPlaces, played by the court's
// `sound` (scenes/gate/gateCourt.js). Design: bible/11-Multiplayer/World-Bosses.md, "GATE-MIX".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS } from '../../../src/net/gate/gateBrain.js';
import { createGateCourt } from '../../../src/scenes/gate/gateCourt.js';
import { GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import { BOSS_CUES, CUE_TARGET_COPIES, CUE_TARGET_APART_M, cueTargetPlaces, RELEASE_LEAD_MS } from '../../../src/world/gate/gateBoss.js';
import { destroyGateBossBar } from '../../../src/ui/gate/gateBossBar.js';

test('GATE-MIX: a targets cue\'s places - the one nearest my ear first, then the next standing CUE_TARGET_APART_M from every one kept, at most CUE_TARGET_COPIES; no ear, the first in order; none, none (mutants: the nearest not first; the spacing unread; the cap unread)', () => {
  assert.deepEqual([CUE_TARGET_COPIES, CUE_TARGET_APART_M], [2, 10]);
  const ear = [0, 1.7, 0];
  const pts = [[30, 0.5, 0], [1, 0.5, 1], [3, 0.5, 2], [-20, 0.5, 5], [31, 0.5, 2], [2, 0.5, -1]];
  assert.deepEqual(cueTargetPlaces(pts, ear), [[1, 0.5, 1], [-20, 0.5, 5]], 'mine, then the nearest one standing apart - not the pile at my feet');
  assert.deepEqual(cueTargetPlaces([[1, 0, 0], [4, 0, 0], [8, 0, 0]], ear), [[1, 0, 0]], 'a pile is one copy');
  assert.deepEqual(cueTargetPlaces([[0, 0, 0], [10, 0, 0]], ear), [[0, 0, 0], [10, 0, 0]], 'exactly apart is apart');
  assert.deepEqual(cueTargetPlaces([[0, 0, 0], [20, 0, 0], [40, 0, 0], [60, 0, 0]], ear).length, 2, 'never more than the cap');
  assert.deepEqual(cueTargetPlaces(pts, undefined), [[30, 0.5, 0], [1, 0.5, 1]], 'no ear: in order, still thinned');
  assert.deepEqual(cueTargetPlaces([], ear), []);
  assert.deepEqual(cueTargetPlaces(null, ear), []);
  const before = pts.map((p) => p.slice());
  cueTargetPlaces(pts, ear);
  assert.deepEqual(pts, before, 'the attack\'s own list untouched');
});

test('GATE-MIX: a Hellfire on five players in his third phase (ten marks) is heard twice at most as it is loosed and as it lands - at the mark at my feet first - where it was ten copies of a full-scale clip (mutants: the court plays every target again; the ear unread)', () => {
  destroyGateBossBar();
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 }, sounds = [];
  const ear = courtToDungeon(2, 1.7, 2);
  const c = createGateCourt({
    renderer: null, gl: null, link, now: () => clock.t, cam: () => ear,
    audio: { listenerPosition: () => ear, play3d: (clip, p, v, o) => sounds.push({ clip, p, pitch: o.pitch }), play3dId: (id, p, v, o) => sounds.push({ clip: `id${id}`, p, pitch: o.pitch }) },
    feet: () => courtToDungeon(2, 0, 2), player: () => ({ health: 500, maxHealth: 500 }), save: () => 0,
    strike: () => {}, rng: () => 0.5, send: () => true,
  });
  const feet = [[-14, 6], [15, -12], [2, 2], [4, 3], [0, 18]];   // mine third in the attack's own order
  const tg = feet.concat(feet.map(([x, z]) => [x + 2.5, z - 2]));   // the second volley about the same feet
  const atk = { i: 1, a: ATTACKS.hellfire.id, at: 10_000, x: 0, z: 0, yw: 0, tg };
  link.st = { ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 5, phase: 3, wrathAt: 10_000_000, atk };
  for (const t of [9000, 10_000 - RELEASE_LEAD_MS + 5, 10_005]) { clock.t = t; c.frame(); }
  const of = (cue) => sounds.filter((s) => (s.clip === cue.clip || s.clip === `id${cue.id}`) && s.pitch === cue.pitch);
  for (const cue of [BOSS_CUES.release.hellfire, BOSS_CUES.land.hellfire]) {
    const got = of(cue);
    assert.ok(got.length >= 1 && got.length <= CUE_TARGET_COPIES, `${got.length} copies`);
    assert.deepEqual(got[0].p, courtToDungeon(2, 0.5, 2), 'the mark at my feet first');
    for (let i = 1; i < got.length; i++) assert.ok(Math.hypot(got[i].p[0] - got[0].p[0], got[i].p[2] - got[0].p[2]) >= CUE_TARGET_APART_M);
  }
  c.destroy?.();
});

/** A WebGL2 stand-in that answers every call and counts the programs linked. SHADER-STALL: `parallel` - it compiles
 *  beside the frames (KHR_parallel_shader_compile), and says a program is done only once `finish()` has been called. */
function countingGl({ parallel = false } = {}) {
  const linked = [];
  let finished = false;
  const ext = { COMPLETION_STATUS_KHR: 0x91B1 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'linked') return linked;
      if (k === 'finish') return () => { finished = true; };
      if (k === 'getExtension') return (n) => (parallel && n === 'KHR_parallel_shader_compile' ? ext : null);
      if (k === 'isContextLost') return () => false;
      if (k === 'getProgramParameter') return (p, pn) => (pn === ext.COMPLETION_STATUS_KHR ? finished : true);
      if (k === 'getShaderParameter') return () => true;
      if (k === 'linkProgram') return (p) => linked.push(p);
      if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return 1;   // the constants
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      return () => ({});
    },
  });
  return gl;
}

test('GATE-MIX: the court\'s passes are compiled as I stand in it - one a frame, under the step\'s veil as much as after it, before any attack - and never again at his first landing, the first Reckoning or his fall; SHADER-STALL: where the driver compiles beside the frames, all three started together as I come in and each built once its compile is done (mutants: the warm-up unwired; all three in one frame where it cannot; built again where they are drawn; the warm outside the court)', () => {
  for (const parallel of [false, true]) {
  destroyGateBossBar();
  const gl = countingGl({ parallel });
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  let veil = true, inside = false;
  const c = createGateCourt({
    renderer: null, gl, link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), veiled: () => veil,
    audio: { play3d() {}, play3dId() {} },
    feet: () => (inside ? courtToDungeon(1, 0, 1) : null), player: () => ({ health: 500, maxHealth: 500 }), save: () => 0,
    strike: () => {}, rng: () => 0.5, send: () => true,
  });
  const linked = () => gl.linked.length;
  const base = linked();   // the telegraph's, made with the court
  clock.t = 100; c.frame();
  assert.equal(linked(), base, 'not in the court: nothing made');
  inside = true;
  const per = [];
  for (let i = 0; i < 5; i++) { clock.t += 16; const was = linked(); if (i === 2) veil = false; c.frame(); per.push(linked() - was); }
  // PIN MOVED (SHADER-STALL, render/glProgram.js compiledPass): one pass a frame where the driver cannot compile beside the
  // frames; where it can, the three passes' six programs started in the first frame I stand here
  assert.deepEqual(per, parallel ? [6, 0, 0, 0, 0] : [2, 2, 2, 0, 0], parallel ? 'the three passes\' compiles started together' : 'the sparks and the meteor, then the crystals, then the way home\'s fire - two programs a pass, one pass a frame');
  if (parallel) gl.finish();
  // the fight: a landing and the Reckoning drawn - nothing compiled for them now
  link.st = { ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, atk: { i: 1, a: ATTACKS.slam.id, at: 10_000, x: 0, z: 0, yw: 0, tg: [] } };
  const after = linked();
  for (const t of [9000, 10_005, 10_200]) { clock.t = t; c.frame(); }
  assert.equal(linked(), after, 'his first landing compiles nothing');
  }
});
