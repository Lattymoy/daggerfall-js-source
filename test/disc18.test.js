// DISC18 (2026-09-24, Mac: "my characterless [character's legs] are in the ground", unsure whether it was the save).
// bible/01-Overview/Field-Bugs-2026-09-23.md, DISC18.
//
// Not the save. The hosts drew the third-person body - the Morrowind body and Eye Of The Beholder's sprite alike,
// both through mwViewDrawBody - at player.feetAt(), the height the CAMERA rides: EV1's interpolation with MAC1's
// low-pass over STEP_SMOOTH_TAU, so a rung or a facet does not pop the view. A low-pass trails a climb by the climb's
// vertical speed times its time constant, so on every hill the body was drawn under the ground it stood on (13 cm
// walking up 30 degrees, 23 running, 33 running up 40) and over it going down. The body now stands on
// bodyFeetAt(), the capsule's own interpolated feet; the camera keeps its smoothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PlayerMotor, STEP_OFFSET } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const rad = (deg) => deg * Math.PI / 180;
const go = (run, dir = 1) => ({ forward: dir, strafe: 0, run, jump: false, up: false, down: false });

/** Walk (or run) a plane of `deg` grade rising along +z for six seconds at `hz`; per frame, how far each feet reading
 *  stands under (+) or over (-) the capsule's rest on the ground beneath it. */
function onHill(deg, { run = false, dir = 1, hz = 60 } = {}) {
  const g = Math.tan(rad(deg));
  const col = new Collider((x, z) => g * z);
  const m = new PlayerMotor(col);
  m.pos = [0, 0, 0]; m.grounded = true;
  const under = (f) => col.restFloor(f[0], f[2]) - f[1];
  let body = 0, cam = 0, camOver = 0;
  for (let i = 0; i < hz * 6; i++) {
    m.update(1 / hz, go(run, dir), 0);
    if (i < hz) continue;   // a second to reach its pace
    const b = under(m.bodyFeetAt()), c = under(m.feetAt());
    body = Math.max(body, Math.abs(b)); cam = Math.max(cam, c); camOver = Math.max(camOver, -c);
  }
  return { body, cam, camOver };
}

test('DISC18: the body stands on the ground on every hill, walking or running, up or down, at 60 and 144 Hz - where the camera\'s smoothed feet it was drawn at trail the climb (mutant: the body back on the camera\'s low-pass)', () => {
  for (const deg of [10, 20, 30, 40]) {
    for (const run of [false, true]) {
      for (const hz of [60, 144]) {
        const up = onHill(deg, { run, hz }), down = onHill(deg, { run, hz, dir: -1 });
        assert.ok(up.body < 1e-4 && down.body < 1e-4, `${deg} degrees, ${run ? 'running' : 'walking'}, ${hz} Hz: the body on the ground to a tenth of a millimetre - the motor's span is Float32 (up ${up.body}, down ${down.body})`);
      }
    }
  }
  // what the report saw: the camera's feet under the ground climbing, over it descending
  const walk30 = onHill(30), run30 = onHill(30, { run: true }), run40 = onHill(40, { run: true });
  assert.ok(walk30.cam > 0.12 && run30.cam > 0.2 && run40.cam > 0.3, `the old placement sank ${walk30.cam.toFixed(3)} / ${run30.cam.toFixed(3)} / ${run40.cam.toFixed(3)} m`);
  assert.ok(onHill(30, { dir: -1 }).camOver > 0.12, 'and floated going down');
});

test('DISC18: the body\'s feet are EV1\'s interpolation - the capsule\'s own span, never the camera\'s filter, and reading them leaves the filter alone; the camera keeps MAC1\'s smoothing (mutant: the body\'s snap primes the camera\'s filter)', () => {
  const m = new PlayerMotor(new Collider(() => 0));
  m.pos = [0, 0, 0]; m.grounded = true;
  for (let i = 0; i < 20; i++) m.update(1 / 144, go(false), 0);
  const q = m._prevPos, p = m.pos, a = m._alpha;
  const f = m.bodyFeetAt();
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(f[k] - (q[k] + (p[k] - q[k]) * a)) < 1e-12, `axis ${k}: the span's lerp`);
  // a filter mid-trail: the body ignores it, the camera reads it
  m._eyeFeetY = p[1] - 0.2;
  assert.ok(Math.abs(m.bodyFeetAt()[1] - (q[1] + (p[1] - q[1]) * a)) < 1e-12, 'the body is not on the filter');
  assert.equal(m.feetAt()[1], p[1] - 0.2, 'the camera is');
  // a placement: the raw feet, and the camera's filter is the camera's to prime
  m.pos[2] += 50;
  assert.deepEqual(m.bodyFeetAt(), [m.pos[0], m.pos[1], m.pos[2]]);
  assert.equal(m._eyeFeetY, p[1] - 0.2, 'reading the body did not touch the camera\'s filter');
  // MAC1 holds for the camera: never more than a rung behind the capsule
  assert.ok(STEP_OFFSET === 0.5);
});

test('DISC18: every host draws the body at the body\'s feet and still hands the camera the smoothed ones (mutants: each host\'s body draw back on feetAt)', () => {
  const sites = [['src/scenes/world.js', 1], ['src/scenes/exterior.js', 1], ['src/scenes/dungeon.js', 1], ['src/scenes/worldModes.js', 2]];
  for (const [host, n] of sites) {
    const s = rd(host);
    const draws = [...s.matchAll(/mwViewDrawBody\(canvas, \{[^}]*\}\)/g)].map((m) => m[0]);
    assert.equal(draws.length, n, `${host}: ${n} body draw(s)`);
    for (const d of draws) assert.match(d, /feet: player\.bodyFeetAt\(\)/, `${host}: ${d}`);
    for (const m of s.matchAll(/mwViewFrame\(\{[^}]*?feet: ([^,]+),/g)) assert.equal(m[1], 'player.feetAt()', `${host}: the camera keeps the smoothed feet`);
  }
});
