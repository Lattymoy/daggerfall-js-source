// SD7b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 9): THE UNMOORED STEPS ON THE
// PAGE - world/sdStepsModel.js (the meshes and the colliders the steps are), world/sdStepsArt.js (what they wear),
// scenes/sdSteps.js (the dungeon host's set: stood, moved on the realm's clock, ridden before the motor), and the hosts'
// wiring - the ride beside the movers', the cast-back, the edge let go over the Steps, Levitate warded in the Hour. And
// the engine itself, run: the real motor on the real collider carried by a swinging step, crossing the widest gap at the
// weakest build, running up a riser at skill 0, and falling when a Beat step goes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { realmToDungeon, SD_ARENA } from '../src/net/sdBrain.js';
import { SD_REALM_FLOORS, realmClamp, SD_REALM_ARCHIVE, SD_ISLAND_SIDES } from '../src/world/sdRealm.js';
import { SD_HALL_FLOORS } from '../src/world/sdHall.js';
import { SD_HALL_GLOW_RECORD } from '../src/world/sdHallArt.js';
import {
  SD_STEPS_COURSE, SD_CHECKPOINTS, SD_STEPS_FREE, SD_STEPS_FLOORS, SD_STEPS_FREE_HALF_W, SD_STEP_THICK, SD_RISER_H,
  SD_CRUMBLE_DELAY, SD_CRUMBLE_BACK, SD_CRUMBLE_FALL_G, SD_BEAT_CYCLE, SD_BEAT_HALF, SD_CAST_BACK_LOSS, SD_DRIFT_SIZE,
  SD_BEAT_SIZE, SD_CRUMBLE_SIZE, stepAt, beatStands, beatBlinks,
} from '../src/world/sdSteps.js';
import { SD_STEP_KINDS, SD_STEP_WEAR, SD_RACK, stepBox, buildStepModel, stepTris, buildChecksModel, checkFloorTris } from '../src/world/sdStepsModel.js';
import { stepsArt, crackedArt, beatArt, SD_STEPS_CRACKED_RECORD, SD_STEPS_BEAT_RECORD, SD_STEPS_ATLAS, SD_STEPS_RECORD } from '../src/world/sdStepsArt.js';
import {
  createSdSteps, sdStepKey, SD_CHECKS_KEY, SD_STEPS_TEXT, SD_STEPS_SOUNDS, SD_STEP_GONE_Y, SD_CRUMBLE_SHAKE,
} from '../src/scenes/sdSteps.js';
import { PlayerMotor, TELEPORT_FREEZE_S } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, e = 1e-6) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < e);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A realm second of the anchored clock's size, on a whole Beat cycle and a whole pair of gusts (12 s). */
const T0 = 1_800_000_000 - (1_800_000_000 % 36);
const still = (o = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...o });

/** The set over a fake renderer, collider and ear. */
function rig() {
  const draws = [], buckets = new Map(), dropped = [], uploads = [], sounds = [];
  const renderer = { createMesh: (m) => ({ m }), destroyMesh: (x) => dropped.push(x), uploadTexture: (a, r) => uploads.push([a, r]), uploadEmissionTexture: () => {} };
  const collider = { addMesh: (key, pos, idx, matrix, t = null) => buckets.set(key, { pos, idx, matrix, t }) };
  const audio = { playOneShot: (rec, vol, pitch) => sounds.push({ rec, vol, pitch }), play3d: (rec, at, vol, o) => sounds.push({ rec, at, vol, pitch: o?.pitch }) };
  const steps = createSdSteps({ renderer, audio });
  return { draws, buckets, dropped, uploads, sounds, steps, collider, stand: () => steps.stand({ dynamicDraws: draws, collider }) };
}
/** A fake body standing at realm (x, y, z): its ground, its carry, its collider's move. */
function body(rx, ry, rz, { groundKey = null, grounded = true, jumping = false } = {}) {
  const b = {
    pos: realmToDungeon(rx, ry, rz), height: 1.8, grounded, groundKey, jumping, carried: [], moved: [],
    carryBy(dx, dy, dz) { b.carried.push([dx, dy, dz]); },
    collider: { move: (feet, dx, dy, dz, height, snap) => { b.moved.push([dx, dy, dz, height, snap]); feet[0] += dx; } },
  };
  return b;
}
const step = (i) => SD_STEPS_COURSE[i];
const restOf = (i) => realmToDungeon(step(i).x, step(i).y, step(i).z);
/** A real slab of `kind` stood at a step's rest, for the real motor (a still bucket). */
function slab(col, key, kind, at) {
  const { positions, indices } = stepTris(kind);
  col.addMesh(key, positions, indices, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, at[0], at[1], at[2], 1]);
}
/** The parkour the online page has (scenes/shared.js parkourDeps), at a skill. */
const parkourAt = (skill) => ({ enabled: () => true, inputs: () => ({ climbing: skill, jumping: skill, khajiit: false, enhanced: false, fatigue: 1, load: 0 }), tally: () => {}, say: () => {}, hold: null });

test('SD7b THE STEPS, MADE: each kind a box in its own frame, its top the origin - the Drift\'s, the Beat\'s and the Crumble\'s a slab, a riser reaching past the step it rises from; every face turned out, the collider\'s twelve triangles the same box; what each wears; the checkpoints B and C islands at their heights (mutants: a face turned in; a riser no deeper than a step; the wrong wear)', () => {
  // PIN MOVED (SD-LOOK S9): each step bevelled (about 36 triangles, a riser's rack of teeth more), one atlas a kind - its
  // drawn box still the law's box exactly, every face but a rack tooth's turned out from its middle (a tooth's from its own)
  assert.deepEqual(SD_STEP_KINDS, ['drift', 'beat', 'riser', 'crumble']);
  assert.deepEqual(stepBox('drift'), { w: SD_DRIFT_SIZE.w, d: SD_DRIFT_SIZE.d, h: SD_STEP_THICK });
  assert.deepEqual(stepBox('beat'), { w: SD_BEAT_SIZE.w, d: SD_BEAT_SIZE.d, h: SD_STEP_THICK });
  assert.deepEqual(stepBox('crumble'), { w: SD_CRUMBLE_SIZE.w, d: SD_CRUMBLE_SIZE.d, h: SD_STEP_THICK });
  assert.deepEqual(stepBox('riser'), { w: SD_BEAT_SIZE.w, d: SD_BEAT_SIZE.d, h: SD_RISER_H + SD_STEP_THICK }, 'a riser reaches below the step it rises from');
  for (const kind of SD_STEP_KINDS) {
    const box = stepBox(kind), centre = [0, -box.h / 2, 0];
    const m = buildStepModel(kind), P = m.positions, v = (k) => [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]];
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < P.length / 3; k++) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], v(k)[j]); hi[j] = Math.max(hi[j], v(k)[j]); }
    assert.ok(near(lo, [-box.w / 2, -box.h, -box.d / 2], 1e-5) && near(hi, [box.w / 2, 0, box.d / 2], 1e-5), `${kind}: its box, its top the origin`);
    assert.equal(m.indices.length, kind === 'riser' ? 36 * 3 + SD_RACK.n * 30 : 36 * 3, `${kind}: bevelled - top, chamfer, line, side, foot, underside (a riser's teeth besides)`);
    for (let k = 0; k < m.indices.length; k += 3) {
      const a = v(m.indices[k]), b = v(m.indices[k + 1]), c = v(m.indices[k + 2]);
      const mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      const tooth = kind === 'riser' && mid[2] < -box.d / 2 + SD_RACK.out - 1e-4 && Math.abs(mid[0]) <= SD_RACK.w / 2 + 1e-4;
      const from = tooth ? [0, -SD_RISER_H + SD_RACK.from + Math.round((mid[1] + SD_RISER_H - SD_RACK.from) / SD_RACK.pitch) * SD_RACK.pitch, -box.d / 2 + SD_RACK.out / 2] : centre;
      assert.ok(dot(cross(sub(b, a), sub(c, a)), sub(mid, from)) > 0, `${kind}: face ${k / 3} turned out`);
    }
    const recs = new Set(m.subMeshes.map((s) => s.textureRecord));
    assert.deepEqual(recs, new Set(Object.values(SD_STEP_WEAR[kind])), `${kind}: what it wears`);
    assert.ok(m.subMeshes.every((s) => s.textureArchive === SD_REALM_ARCHIVE));
    const { positions, indices } = stepTris(kind), cv = (k) => [positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]];
    assert.equal(indices.length, 36, `${kind}: the collider's twelve triangles`);
    let top = 0;
    for (let k = 0; k < indices.length; k += 3) {
      const a = cv(indices[k]), b = cv(indices[k + 1]), c = cv(indices[k + 2]);
      const n = cross(sub(b, a), sub(c, a)), mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      assert.ok(dot(n, sub(mid, centre)) > 0, `${kind}: the collider's face ${k / 3} turned out`);
      if (n[1] > 0 && a[1] === 0 && b[1] === 0 && c[1] === 0) top++;
    }
    assert.equal(top, 2, `${kind}: its top a floor`);
  }
  assert.deepEqual(SD_STEP_WEAR, { drift: { atlas: SD_STEPS_RECORD.drift }, beat: { atlas: SD_STEPS_BEAT_RECORD }, riser: { atlas: SD_STEPS_RECORD.riser }, crumble: { atlas: SD_STEPS_CRACKED_RECORD } }, 'one atlas a kind (PIN MOVED, SD-LOOK S9: the Beat\'s sides no longer glow whole - its dial is its light)');
  // the checkpoints B and C (A is the first step, the hall's)
  const floor = checkFloorTris();
  assert.equal(floor.length, 2 * SD_ISLAND_SIDES * 9);
  const [, B, C] = SD_CHECKPOINTS;
  for (let k = 0; k < floor.length; k += 9) {
    const c = realmToDungeon(B.x, B.y, B.z), cc = realmToDungeon(C.x, C.y, C.z);
    const at = [floor[k], floor[k + 1], floor[k + 2]];
    assert.ok(near(at, c, 1e-4) || near(at, cc, 1e-4), 'a fan about B or C');
    const n = cross(sub([floor[k + 3], floor[k + 4], floor[k + 5]], at), sub([floor[k + 6], floor[k + 7], floor[k + 8]], at));
    assert.ok(n[1] > 0, 'facing up');
  }
  const ys = new Set();
  const cm = buildChecksModel();
  for (let k = 1; k < cm.positions.length; k += 3) ys.add(Math.round(cm.positions[k] * 1000) / 1000);
  assert.ok(ys.has(C.y) && ys.has(B.y), 'B on the course\'s floor, C a riser and another up');
});

test('SD7b THE ART: the pictures after the hall\'s - the Crumble\'s cracked stone, its cracks alight and the rest dark; the Beat\'s brass plate, its rim alight and its hub dark - the same pixels every time (mutants: the cracks unlit; the hub alight)', () => {
  // PIN MOVED (SD-LOOK S9): an atlas a kind (world/sdStepsArt.js SD_STEPS_ATLAS - top, side, the rim's line, the chamfer,
  // the underside), the Beat's twelve frames and its falter, the Crumble's rest and three stages, the parts lit and dark
  const art = stepsArt(), R = SD_STEPS_RECORD;
  assert.deepEqual(art.map(([r]) => r), [R.crumble[0], R.beat[0], R.drift, R.riser, ...R.beat.slice(1), R.falter, ...R.crumble.slice(1), R.parts, R.partsDark]);
  assert.deepEqual([SD_STEPS_CRACKED_RECORD, SD_STEPS_BEAT_RECORD], [21, 22], 'SD7b\'s two records kept');
  assert.ok(SD_STEPS_CRACKED_RECORD > Math.max(...Object.values(SD_HALL_GLOW_RECORD)), 'after the hall\'s');
  const A = SD_STEPS_ATLAS;
  for (const [rec, a] of art) {
    const [w, h] = rec === R.parts || rec === R.partsDark ? [64, 64] : [A.w, A.h];
    for (const img of [a.albedo, a.emission]) { assert.equal(img.width, w); assert.equal(img.height, h); assert.equal(img.colors.length, w * h * 4); }
  }
  assert.deepEqual(stepsArt()[0][1].albedo.colors, art[0][1].albedo.colors, 'the same pixels');
  const lit = (img, x, y) => { const i = (y * img.width + x) * 4; return img.colors[i] + img.colors[i + 1] + img.colors[i + 2]; };
  const [tx, ty, tw, th] = A.top, c = crackedArt();
  let cracks = 0, dark = 0;
  for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) { const e = lit(c.emission, x, y); if (e > 50) cracks++; else if (e === 0) dark++; }
  assert.ok(cracks > tw * th * 0.03 && cracks < tw * th * 0.3, `the cracks alight (${cracks})`);
  assert.ok(dark > tw * th * 0.5, 'the stone dark');
  const b = beatArt();
  assert.ok(lit(b.emission, A.line[0], A.line[1]) > 150 && lit(b.emission, A.line[0] + A.line[2] - 1, A.line[1]) > 150, 'its rim alight');
  assert.equal(lit(b.emission, tx + tw / 2, ty + th / 2), 0, 'its hub dark');
});

test('SD7b STOOD: once - a mesh a kind and the checkpoints\', a draw and a MOVER\'s bucket for every step (its place read at every query), the checkpoints\' floors still (mutants: a step without its bucket; a bucket that does not move)', () => {
  const r = rig();
  assert.equal(r.stand(), true);
  assert.equal(r.stand(), false, 'once');
  assert.deepEqual(r.uploads.map(([a, rec]) => [a, rec]), stepsArt().map(([rec]) => [SD_REALM_ARCHIVE, rec]), 'PIN MOVED (SD-LOOK S9): every atlas, frame and stage');
  const n = (k) => SD_STEPS_COURSE.filter((s) => s.kind === k).length;
  assert.equal(r.draws.length, 1 + SD_STEPS_COURSE.length + 1 + n('drift') + n('crumble') * 5 + 3 + 1, 'the checkpoints, every step and (AUDIT SD II, L2 F18 - PIN MOVED) the breath\'s streaks; PIN MOVED (SD-LOOK S9): a pendulum a Drift step, four chunks and a grit a Crumble step, three waystones, the vane');
  assert.equal(r.buckets.size, SD_STEPS_COURSE.length + 1);
  for (const s of SD_STEPS_COURSE) {
    const bk = r.buckets.get(sdStepKey(s.i));
    assert.ok(bk && typeof bk.t === 'function', `step ${s.i}: a mover's bucket`);
    assert.equal(bk.idx.length, 36);
    assert.deepEqual([...bk.matrix], I, 'its triangles in its own frame');
  }
  assert.equal(r.buckets.get(SD_CHECKS_KEY).t, null, 'the checkpoints still');
  assert.equal(sdStepKey(7), 'sd:step:7');
  r.steps.clear();
  assert.equal(r.dropped.length, SD_STEP_KINDS.length + 2 + 4 + 1 + 4 + 1 + 1 + 1, 'every mesh freed (the breath\'s streaks\' too; PIN MOVED, SD-LOOK S9: the Beat\'s four dissolve stages, the pendulum, the four chunks, the grit, the waystone, the vane)');
  assert.equal(r.steps.ride(T0, 1 / 60, null), null, 'cleared: nothing rides');
});

test('SD7b ON THE REALM\'S CLOCK: every step stood where the law has it - the Drift swinging; a Beat step there or gone (its bucket sunk out of all reach, its draw hidden) and blinking before it goes; the risers and the untouched Crumble always there (mutants: a gone step still solid; no blink; the swing not followed)', () => {
  const r = rig();
  r.stand();
  for (const dt of [0.3, 1.1, 2.15, 2.5, 3.0]) {
    const t = T0 + dt;
    r.steps.ride(t, 1 / 60, null);
    const all = r.steps.steps;
    for (const st of all) {
      const s = step(st.i), at = realmToDungeon(...stepAt(s, t));
      assert.deepEqual(r.buckets.get(st.key).t(), st.T, 'the bucket reads the step\'s place');
      const m = st.matrix;
      if (s.kind === 'beat' && !beatStands(s, t)) {
        assert.equal(st.solid, false);
        assert.deepEqual(st.T, [at[0], SD_STEP_GONE_Y, at[2]], `step ${st.i} at ${dt}: sunk out of reach`);
        assert.ok(m.every((x) => x === 0), 'hidden');
        continue;
      }
      assert.equal(st.solid, true, `step ${st.i} at ${dt}: there`);
      assert.ok(near(st.T, at), `step ${st.i} at ${dt}: where the law has it`);
      if (m.some((x) => x !== 0)) assert.ok(near([m[12], m[13], m[14]], at, 1e-4), 'drawn there');
      else assert.ok(s.kind === 'beat' && beatBlinks(s, t), 'only a blinking step is ever hidden while it stands');
    }
  }
  // a Beat step's blink: faltered for some of its last 0.4 s, lit for the rest - PIN MOVED (SD-LOOK S9): the falter is its
  // light (its falter frame, a draw's texRemap), never the plate: a step that holds stays seen
  const s = step(8), falterRec = `${SD_REALM_ARCHIVE}_${SD_STEPS_RECORD.falter}`;
  let lit = 0, faltered = 0;
  for (let k = 0; k < 24; k++) {
    const t = T0 + s.beat + 2.0 + k / 60;
    r.steps.ride(t, 1 / 60, null);
    const st = r.steps.steps[8];
    assert.ok(st.matrix.some((x) => x !== 0), 'seen while it holds');
    if (st.remap && [...st.remap.values()][0] === falterRec) faltered++; else lit++;
    assert.equal(st.solid, true, 'blinking, still there');
  }
  assert.ok(faltered >= 8 && lit >= 8, `it blinks (${lit} lit, ${faltered} faltered)`);
  assert.ok(SD_STEP_GONE_Y < -300, 'gone far under the void\'s floor');
});

test('SD7b CARRIED: a body standing on a swinging step is carried by the step\'s own move, as a deck carries one - a hitch\'s whole move too; never by a step that went or came back; never off another\'s ground (mutants: no carry; carried by a vanish)', () => {
  const r = rig();
  r.stand();
  const b = body(0, 0, step(5).z, { groundKey: sdStepKey(5) });
  r.steps.ride(T0, 1 / 60, b);
  assert.deepEqual(b.carried, [], 'the first frame: no move to carry yet');
  r.steps.ride(T0 + 0.05, 1 / 60, b);
  const dx = stepAt(step(5), T0 + 0.05)[0] - stepAt(step(5), T0)[0];
  assert.equal(b.carried.length, 1);
  assert.ok(near(b.carried[0], [dx, 0, 0], 1e-9), 'the swing\'s own move');
  assert.ok(Math.abs(dx) > 0.01);
  // not my ground
  const o = body(0, 0, step(5).z, { groundKey: 'dungeon' });
  r.steps.ride(T0 + 0.1, 1 / 60, o);
  assert.deepEqual(o.carried, []);
  const air = body(0, 0, step(5).z, { groundKey: sdStepKey(5), grounded: false });
  r.steps.ride(T0 + 0.15, 1 / 60, air);
  assert.deepEqual(air.carried, [], 'in the air: nothing carries');
  // a Beat step going, and coming back: never a carry
  const s8 = step(8), go = T0 + s8.beat + 2.39;
  const on8 = body(0, 0, s8.z, { groundKey: sdStepKey(8) });
  for (const t of [go, go + 0.02, T0 + s8.beat + SD_BEAT_CYCLE - 0.01, T0 + s8.beat + SD_BEAT_CYCLE + 0.01]) r.steps.ride(t, 1 / 60, on8);
  assert.deepEqual(on8.carried, [], 'a Beat step stands still - and its going and coming are no move');
  // a hitch: a second gone by in one frame - the body stays on its step, carried the whole of its move
  const hb = body(0, 0, step(5).z, { groundKey: sdStepKey(5) });
  r.steps.ride(T0 + 3, 1 / 60, hb);
  r.steps.ride(T0 + 4, 1, hb);
  const dh = stepAt(step(5), T0 + 4)[0] - stepAt(step(5), T0 + 3)[0];
  assert.ok(Math.abs(dh) > 1 && near(hb.carried[hb.carried.length - 1], [dh, 0, 0], 1e-9), `carried ${dh.toFixed(2)} m`);
});

test('SD7b THE CRUMBLE, MY OWN: my foot on a Crumble step starts it - its grind heard; it shudders 0.7 s and stays under me, then its bucket sinks and its draw falls; it is whole again 5 s after it fell, ready to break again; a window held over the motor touches nothing (mutants: the touch under a window; no shudder; never back)', () => {
  const r = rig();
  r.stand();
  const i = 17, s = step(i), t0 = T0 + 1.5;
  const b = body(0, s.y, s.z, { groundKey: sdStepKey(i) });
  r.steps.ride(t0, 1 / 60, b, false);
  assert.equal(r.steps.steps[i].touched, null, 'a held motor touches nothing');
  r.steps.ride(t0, 1 / 60, b, true);
  assert.equal(r.steps.steps[i].touched, t0);
  const grind = r.sounds.filter((x) => x.rec === SD_STEPS_SOUNDS.grind);
  assert.equal(grind.length, 1);
  assert.ok(near(grind[0].at, restOf(i)), 'heard at the step');
  let st, most = 0;
  for (let k = 1; k <= 12; k++) {
    r.steps.ride(t0 + k * 0.05, 1 / 60, b, true);
    st = r.steps.steps[i];
    assert.equal(st.solid, true, 'still under me');
    assert.ok(near(st.T, restOf(i)), 'its bucket still');
    const m = st.matrix, off = Math.hypot(m[12] - restOf(i)[0], m[14] - restOf(i)[2]);
    assert.ok(off <= SD_CRUMBLE_SHAKE * Math.SQRT2 + 1e-4 && Math.abs(m[13] - restOf(i)[1]) < 1e-4, 'a shudder, no more');
    most = Math.max(most, off);
  }
  assert.ok(most > SD_CRUMBLE_SHAKE * 0.5, `it shudders (${most.toFixed(4)} m)`);
  assert.equal(r.sounds.filter((x) => x.rec === SD_STEPS_SOUNDS.grind).length, 1, 'heard once - the touch, not every frame stood on it');
  r.steps.ride(t0 + SD_CRUMBLE_DELAY + 0.1, 1 / 60, null, true);
  st = r.steps.steps[i];
  assert.equal(st.solid, false);
  assert.equal(st.T[1], SD_STEP_GONE_Y, 'its bucket gone - a body falls');
  // PIN MOVED (SD-LOOK S9): fallen, its draw hidden and its four chunks falling in its stead, at the law's own gravity
  assert.ok(st.matrix.every((x) => x === 0), 'its draw gone');
  assert.ok(st.chunks.length === 4 && st.chunks.every((m) => Math.abs(m[13] - (restOf(i)[1] - SD_STEP_THICK / 2 - 0.5 * SD_CRUMBLE_FALL_G * 0.01 * (1 + 0.06 * (st.chunks.indexOf(m) - 1.5)))) < 1e-4), 'its chunks falling');
  r.steps.ride(t0 + SD_CRUMBLE_DELAY + 4, 1 / 60, null, true);
  assert.ok(r.steps.steps[i].matrix.every((x) => x === 0), 'fallen out of sight');
  r.steps.ride(t0 + SD_CRUMBLE_DELAY + SD_CRUMBLE_BACK + 0.05, 1 / 60, null, true);
  st = r.steps.steps[i];
  assert.equal(st.solid, true, 'whole again');
  assert.equal(st.touched, null);
  r.steps.ride(t0 + 7, 1 / 60, b, true);
  assert.equal(r.steps.steps[i].touched, t0 + 7, 'and breaks again under the next foot');
  // the other Crumble steps never heard my foot
  assert.ok(r.steps.steps.filter((x) => x.kind === 'crumble' && x.i !== i).every((x) => x.touched == null && x.solid));
});

test('SD7b THE WARP\'S BREATH: over the Crumble a body is moved through the resolver - 3 m/s across, the way the gust blows, snapped only when it stands - its wind heard once a gust, the second before; never over the Beat, never under a window, never a hitch\'s worth; the Beat\'s tick on each half beat (mutants: the breath over the Beat; no snap rule; the wind every frame; no tick)', () => {
  const r = rig();
  r.stand();
  const cz = step(20).z;
  const b = body(0, step(20).y, cz, { groundKey: sdStepKey(20) });
  r.steps.ride(T0 + 0.5, 1 / 60, b);
  assert.deepEqual(b.moved, [[3 / 60, 0, 0, 1.8, true]], 'pushed +x, snapped to its step');
  const j = body(0, 3, cz, { grounded: false, jumping: true });
  r.steps.ride(T0 + 6.5, 1 / 60, j);
  assert.deepEqual(j.moved, [[-3 / 60, 0, 0, 1.8, false]], 'the next gust the other way; a jump not snapped');
  const h = body(0, 3, cz, { grounded: false });
  r.steps.ride(T0 + 0.5, 1, h);
  assert.ok(Math.abs(h.moved[0][0] - 0.3) < 1e-9, 'a hitch is not a gale');
  const calm = body(0, 3, cz);
  r.steps.ride(T0 + 2, 1 / 60, calm);
  assert.deepEqual(calm.moved, [], 'between gusts, nothing');
  const beat = body(0, 0, step(9).z);
  r.steps.ride(T0 + 0.5, 1 / 60, beat);
  assert.deepEqual(beat.moved, [], 'not over the Beat');
  const held = body(0, 3, cz);
  r.steps.ride(T0 + 0.5, 1 / 60, held, false);
  assert.deepEqual(held.moved, [], 'not under a window');
  // the wind: once a gust, the second before it, on the Crumble
  r.sounds.length = 0;
  for (let k = 0; k < 60; k++) r.steps.ride(T0 + 5 + k / 60, 1 / 60, body(0, 3, cz));
  assert.deepEqual(r.sounds.filter((x) => x.rec === SD_STEPS_SOUNDS.wind).length, 1, 'once');
  for (let k = 0; k < 60; k++) r.steps.ride(T0 + 11 + k / 60, 1 / 60, body(0, 3, cz));
  assert.deepEqual(r.sounds.filter((x) => x.rec === SD_STEPS_SOUNDS.wind).length, 2, 'and once at the next');
  r.sounds.length = 0;
  for (let k = 0; k < 60; k++) r.steps.ride(T0 + 5 + k / 60, 1 / 60, body(0, 0, step(3).z));
  assert.equal(r.sounds.length, 0, 'not heard over the Drift');
  // the Beat's tick: on each half beat, there
  for (let k = 0; k < 4 * 60; k++) r.steps.ride(T0 + 0.5 + k / 60, 1 / 60, body(0, 0, step(9).z));
  const ticks = r.sounds.filter((x) => x.rec === SD_STEPS_SOUNDS.tick);
  assert.equal(ticks.length, Math.floor((0.5 + 4) / SD_BEAT_HALF), 'a tick each half beat');
});

test('SD7b THE VOID: a body fallen past y -30 is answered with the checkpoint of the span it last STOOD in - A over the Drift, B over the Beat, C over the Crumble - the moan heard; any fall caught, one that stood on no span answered with A; above it, or under a window, nothing (mutants: every fall to A; the void heard nowhere)', () => {
  // AUDIT SD II (L4 F1 - PIN MOVED): the span the body stood in, never the one its fall crosses the void's floor over;
  // and no fall goes uncaught - this pin held that a fall before the first step was answered with nothing
  const r = rig();
  r.stand();
  const [A, B, C] = SD_CHECKPOINTS;
  const cases = [[step(3), A], [step(9), B], [step(14), B], [step(22), C], [{ i: null, y: C.y, z: C.z + 1 }, C]];
  for (const [s, to] of cases) {
    r.steps.ride(T0 + 2, 1 / 60, body(0, s.y, s.z, { groundKey: s.i == null ? SD_CHECKS_KEY : sdStepKey(s.i) }));   // stood there
    r.sounds.length = 0;
    assert.deepEqual(r.steps.ride(T0 + 2, 1 / 60, body(1, -31, s.z, { grounded: false })), realmToDungeon(to.x, to.y, to.z), `z ${s.z}`);
    assert.deepEqual(r.sounds.map((x) => x.rec), [SD_STEPS_SOUNDS.moan]);
  }
  assert.equal(r.steps.ride(T0 + 2, 1 / 60, body(1, -29, step(3).z, { grounded: false })), null, 'still above it');
  assert.equal(r.steps.ride(T0 + 2, 1 / 60, body(1, -31, step(3).z, { grounded: false }), false), null, 'a window held');
  const hall = rig();
  hall.stand();
  hall.steps.ride(T0 + 2, 1 / 60, body(0, 0, 42, { groundKey: 'sd:realm' }));   // the Orrery's floor
  assert.deepEqual(hall.steps.ride(T0 + 2, 1 / 60, body(1, -31, 42, { grounded: false })), realmToDungeon(A.x, A.y, A.z), 'stood on no span: A');
  assert.equal(SD_STEPS_TEXT.cast, 'The Hour casts you back.');
});

test('SD7b THE EDGE: with the Concord the edge lets go over the whole of the Steps - the void\'s to take, the cast-back its edge - and holds the arena; past the band\'s sides, or past the arena, a body is put back (mutants: the band narrowed to the course; the arena left off)', () => {
  const floors = [...SD_REALM_FLOORS, ...SD_HALL_FLOORS, ...SD_STEPS_FLOORS];
  const at = (x, z) => realmToDungeon(x, 0, z);
  assert.deepEqual(SD_STEPS_FLOORS[0], { kind: 'band', x: 0, z0: SD_STEPS_FREE.z0, z1: SD_STEPS_FREE.z1, halfW: SD_STEPS_FREE_HALF_W });
  assert.deepEqual(SD_STEPS_FLOORS[1], { kind: 'disc', ...SD_ARENA });
  for (const [x, z, what] of [[0, 100, 'over the Drift'], [12, 150, 'well off the line over the Beat'], [-25, 200, 'far off it over the Crumble'], [0, SD_ARENA.z, 'the arena'], [20, SD_ARENA.z, 'its rim'], [0, 74, 'the first step']]) {
    assert.equal(realmClamp(at(x, z), 0.35, floors), null, what);
  }
  assert.notEqual(realmClamp(at(SD_STEPS_FREE_HALF_W + 5, 150), 0.35, floors), null, 'past the band\'s side');
  assert.notEqual(realmClamp(at(0, SD_ARENA.z + SD_ARENA.r + 3), 0.35, floors), null, 'past the arena');
  assert.notEqual(realmClamp(at(0, 100), 0.35, [...SD_REALM_FLOORS, ...SD_HALL_FLOORS]), null, 'without them the Steps are held off');
  assert.ok(SD_STEPS_FREE_HALF_W > 30, 'no fall meets the band\'s sides before the void');
});

test('SD7b THE ENGINE, RUN: the real motor on the real collider - carried a whole swing on the widest-swinging Drift step; across the widest gap from a standing start at the weakest build; up a riser at skill 0 with the online page\'s parkour; and a Beat step gone from under it, falling to the void and answered with B (mutants: no carry; a gone step still solid)', () => {
  // carried two swings, standing still on step 5 (the widest: 2 m either way)
  {
    const col = new Collider(() => -Infinity), r = createSdSteps({});
    r.stand({ dynamicDraws: [], collider: col });
    let t = T0;
    r.ride(t, 0, null, false);
    const m = new PlayerMotor(col, { speed: 40, running: 20, swimming: 30 });
    const at = realmToDungeon(...stepAt(step(5), t));
    m.spawn(at[0], at[1] + 0.05, at[2]);
    let worst = 0;
    for (let k = 0; k < 2 * step(5).period * 60; k++) {
      assert.equal(r.ride(t, 1 / 60, m, true), null, 'never cast back');
      m.update(1 / 60, still(), 0);
      t += 1 / 60;
      worst = Math.max(worst, Math.abs(m.pos[0] - realmToDungeon(...stepAt(step(5), t))[0]));
    }
    assert.equal(m.groundKey, sdStepKey(5), 'still standing on it');
    assert.ok(worst < 0.1, `kept on it (${worst.toFixed(3)} m at most off its middle)`);
  }
  // the widest gap (3.2 m, between Drift steps 4 and 5 lined up), from rest on step 4, at Speed 10 and Running 0
  {
    const col = new Collider(() => -Infinity);
    slab(col, 'a', 'drift', restOf(4));
    slab(col, 'b', 'drift', restOf(5));
    assert.ok(Math.abs((step(5).z - step(5).d / 2) - (step(4).z + step(4).d / 2) - 3.2) < 1e-9, 'the widest gap');
    const m = new PlayerMotor(col, { speed: 10, running: 0, swimming: 30 });
    const r4 = restOf(4);
    m.spawn(r4[0], r4[1], r4[2] - step(4).d / 2 + 0.4);
    const edge = r4[2] + step(4).d / 2;
    let jumped = false, landed = false;
    for (let k = 0; k < 240 && !landed; k++) {
      const go = !jumped && m.pos[2] >= edge - 0.1;
      m.update(1 / 60, still({ forward: 1, run: true, jump: go, up: go }), 0);
      if (go) jumped = true;
      assert.ok(m.pos[1] > -2, 'never fell');
      landed = jumped && m.grounded && m.groundKey === 'b';
    }
    assert.ok(landed, 'across, onto the next');
  }
  // up a riser (Beat step 10, riser 11 against it) at skill 0
  {
    const col = new Collider(() => -Infinity);
    slab(col, 'beat', 'beat', restOf(10));
    slab(col, 'riser', 'riser', restOf(11));
    const m = new PlayerMotor(col, { speed: 40, running: 20, swimming: 30 }, { parkour: parkourAt(0) });
    const r10 = restOf(10);
    m.spawn(r10[0], r10[1], r10[2] - step(10).d / 2 + 0.4);
    const wall = restOf(11)[2] - step(11).d / 2;
    let pressed = false, up = false;
    for (let k = 0; k < 300 && !up; k++) {
      const go = !pressed && m.pos[2] >= wall - 0.8;
      m.update(1 / 60, still({ forward: 1, run: true, jump: go, up: go }), 0);
      if (go) pressed = true;
      up = m.grounded && m.groundKey === 'riser' && Math.abs(m.pos[1] - (r10[1] + SD_RISER_H)) < 0.05;
    }
    assert.ok(up, 'run up it, onto its top');
  }
  // a Beat step gone from under a body: it falls, and the void answers with B
  {
    const col = new Collider(() => -Infinity), r = createSdSteps({});
    r.stand({ dynamicDraws: [], collider: col });
    const s = step(8);
    let t = T0 + s.beat + 0.5;
    r.ride(t, 0, null, false);
    const m = new PlayerMotor(col, { speed: 40, running: 20, swimming: 30 });
    const at = restOf(8);
    m.spawn(at[0], at[1] + 0.05, at[2]);
    let back = null, frames = 0;
    for (; frames < 6 * 60 && !back; frames++) {
      back = r.ride(t, 1 / 60, m, true);
      if (!back) m.update(1 / 60, still(), 0);
      t += 1 / 60;
    }
    const B = SD_CHECKPOINTS[1];
    assert.deepEqual(back, realmToDungeon(B.x, B.y, B.z), 'back to B');
    assert.ok(frames > (SD_BEAT_CYCLE - 1.2 - 0.5) * 60, 'only once it went');
  }
});

/** The world host's cast-back, run from its own text. */
function worldCast({ health = 80, max = 100 } = {}) {
  const w = read('src/scenes/world.js');
  const i = w.indexOf('\n  function sdCastBack('); assert.ok(i > 0);
  const text = w.slice(i + 1, w.indexOf('\n  }\n', i) + 4);
  const log = [], playerEntity = { health, maxHealth: max };
  const env = {
    playerEntity, SD_CAST_BACK_LOSS, SD_STEPS_TEXT,
    hurtPlayer: (e, n, o) => { log.push(['hurt', n, !!o?.bypassShield]); e.health -= n; }, flashPlayerDamage: (n) => log.push(['flash', n]),
    setMidScreenText: (t) => log.push(['said', t]),
    sdSay: (t) => log.push(['said', t]),   // AUDIT SD II (SD11d, PIN MOVED): through the Hour's voice
  };
  return { sdCastBack: new Function(...Object.keys(env), `${text}\nreturn sdCastBack;`)(...Object.values(env)), log };
}
/** The mode machine's cast-back, run from its own text. */
function modesCast() {
  const W = read('src/scenes/worldModes.js');
  const i = W.indexOf('\n  function sdCastBack('); assert.ok(i > 0);
  const text = W.slice(i + 1, W.indexOf('\n  }\n', i) + 4);
  const log = [];
  const player = { eye: [9, 9, 9], freezeMotor: 0, spawn: (x, y, z) => log.push(['spawn', x, y, z]) };
  const cam = { pos: null };
  const host = { sdCastBack: () => log.push(['told']) };
  const fn = new Function('player', 'cam', 'host', 'TELEPORT_FREEZE_S', `${text}\nreturn sdCastBack;`)(player, cam, host, TELEPORT_FREEZE_S);
  return { fn, log, player, cam };
}

test('SD7b THE CAST-BACK, run from the hosts\' own text: the mode machine stands the body on the checkpoint as the action teleport does - its settle, the eye with it - and tells the world host, which takes 15% of my health, no shield taking it, and says so; the dead are only told (mutants: no settle; the shield takes it; the loss forgotten)', () => {
  const mc = modesCast();
  mc.fn([1, 2, 3]);
  assert.deepEqual(mc.log, [['spawn', 1, 2, 3], ['told']]);
  assert.equal(mc.player.freezeMotor, TELEPORT_FREEZE_S, 'the settle');
  assert.deepEqual(mc.cam.pos, [9, 9, 9], 'the eye with it');
  assert.equal(SD_CAST_BACK_LOSS, 0.15);
  const w = worldCast();
  w.sdCastBack();
  assert.deepEqual(w.log, [['hurt', 15, true], ['flash', 15], ['said', SD_STEPS_TEXT.cast]]);
  const low = worldCast({ health: 2, max: 3 });
  low.sdCastBack();
  assert.deepEqual(low.log[0], ['hurt', 1, true], 'at least one');
  const dead = worldCast({ health: 0 });
  dead.sdCastBack();
  assert.deepEqual(dead.log, [['said', SD_STEPS_TEXT.cast]]);
});

test('SD7b the hosts by source: the dungeon host makes the Steps in the Hour alone, stands them once, rides them on the outer host\'s clock and frees them; the mode machine rides them beside the movers\' ride, BEFORE the motor, every frame of the dungeon - live only while the motor runs - stands a body cast back and hands the realm\'s clock on; the world host widens the edge, wards Levitate in the Hour and takes what the void costs', () => {
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /import \{ createSdSteps \} from '\.\/sdSteps\.js';/);
  assert.match(D, /const sdSteps = _sdRealm \? createSdSteps\(\{ ending: sdMarksOf\(dfLocation\.sdRealm\)\[0\], renderer, audio \}\) : null;/);   // PIN MOVED (SD-LOOK S9): its Hollow's Ending on the vane
  assert.match(D, /if \(!_sdStepsStood\) \{ _sdStepsStood = true; sdSteps\.stand\(\{ dynamicDraws, collider \}\); \}\n\s+return sdSteps\.ride\(opts\.sdClock\?\.\(\) \?\? performance\.now\(\) \/ 1000, dt, body, live\);/);
  assert.match(D, /sdStepsRide\(dt, body, live = true\) \{ return sdStepsRide\(dt, body, live\); \},/);
  assert.match(D, /sdSteps\?\.clear\(\);/);
  const W = read('src/scenes/worldModes.js');
  const ride = W.indexOf("const sdBack = mode === 'dungeon' ? dungeonCtx?.sdStepsRide?.(dt, player, !overlayHeld) ?? null : null;\n    if (sdBack) sdCastBack(sdBack);");
  const movers = W.indexOf("if (!overlayHeld) ridePlatform(player, mode === 'dungeon' ? dungeonCtx?.actions : interiorCtx?.actions);");
  const motor = W.indexOf('player.update(dt, paralyzed ?', movers);
  assert.ok(movers > 0 && ride > movers && motor > ride, 'after the movers\' ride, before the motor');
  assert.match(W, /sdClock: \(\) => host\.deadlandsSeconds\?\.\(\) \?\? performance\.now\(\) \/ 1000,/);
  const w = read('src/scenes/world.js');
  assert.match(w, /registerLevitateWard\(\(\) => inSiegeRoom\(\) \|\| modes\?\.sdRealmSlot\?\.\(\) != null\);/);
  assert.match(w, /const _realmArenaBridged = realmArena\(\[\.\.\.SD_REALM_FLOORS, \.\.\.SD_HALL_FLOORS, \.\.\.SD_STEPS_FLOORS\]\);/);
  assert.match(w, /sdCastBack: \(\) => sdCastBack\(\),/);
  assert.match(w, /deadlandsSeconds: \(\) => deadlandsSeconds\(\),/);
  assert.match(read('bible/11-Multiplayer/Super-Dungeons.md'), /### SD7b - shipped 2026-10-07/);
});
