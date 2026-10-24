// AUDIT CLIMB-HANDS (2026-10-02, Mac: "Audit this and ensure all the animations and stuff are perfect"). The classic
// lane's hands on the wall (combat/climbHands.js, CLIMB-HANDS) held to the climb they draw: every hand continuous through
// every change of state; the shimmy's and the free climb's grips on the beats the ear plays and the 3D body takes
// (player/climb/climbPose.js's own gaits); each move on ClimbPose's windows, from where the hands were; the hands leaving the
// wall from where they were; the large HUD's bar; the weapon and the hands never on the screen together; and, found on
// the way, ClimbPose's corner leading with the wrong hand half the time. Each finding pinned red, then fixed. Record:
// bible/03-World/Parkour-Arc.md (AUDIT CLIMB-HANDS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ClimbHands, createClimbHands, HANDS } from '../../../src/combat/climbHands.js';
import { ClimbPose, POSE } from '../../../src/player/climb/climbPose.js';
import { FEEL } from '../../../src/player/climb/climbFeel.js';
import { PARKOUR_HAND_SPAN } from '../../../src/player/parkour.js';
import { createWeaponRig } from '../../../src/combat/weapon/weaponRig.js';
import { setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';
import { resetToDefaults } from '../../../src/systems/settings/settings.js';
import { EQUIP_SLOTS } from '../../../src/systems/equip.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
const N = [0, 0, -1];   // the wall's face points -z: facing it is yaw 0, the climber's right along it +x
const SPAN = PARKOUR_HAND_SPAN;
const lerp = (a, b, t) => a + (b - a) * t;
const at = (x, y = 1) => [x, y, 0];
const hang = (x = 0, extra = {}) => ({ mode: 'hang', classic: false, normal: N, lipY: 2.8, track: at(x), feet: at(x), grip: 1, move: null, ...extra });
const climb = (x = 0, y = 1, extra = {}) => ({ mode: 'climb', classic: false, normal: N, lipY: null, track: at(x, y), feet: at(x, y), grip: 1, move: null, ...extra });
const air = (p) => ({ mode: null, classic: false, normal: null, lipY: null, track: p, feet: p, grip: 1, move: null });
const still = (n, c, view) => Array.from({ length: n }, () => ({ climb: c, view }));
/** A move over `dur` s: the motor's ONE object, its clock set frame by frame (motor.js _parkourAdvance), `base(t)` the
 *  snapshot around it. */
const moveFrames = (m, dur, base) => {
  const obj = { ...m, t: 0, dur };
  const n = Math.max(1, Math.round(dur / DT));
  return Array.from({ length: n }, (_, i) => { const t = Math.min(1, (i + 1) / n); return { climb: { ...base(t), move: obj }, mt: t }; });
};
/** Drive a law: per frame, each sprite on the screen by key (L, R, reach). */
const drive = (law, frames) => frames.map((f) => {
  if (f.mt != null) f.climb.move.t = f.mt;
  const o = law.update(DT, f.climb, f.view ?? { yaw: 0, pitch: 0 });
  const r = { present: o.present };
  for (const g of o.grips) r[g.side] = { x: g.x, y: g.y };
  if (o.reach) r.reach = { x: o.reach.x, y: o.reach.y, side: o.reach.side };
  return r;
});
const step = (seq, i, k) => { const a = seq[i - 1]?.[k], b = seq[i]?.[k]; return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : null; };
/** The pops in a run: a sprite's step between two frames over 10 design pixels AND over 2.5 times the steps either side
 *  of it, the sprite on the screen all four frames - a discontinuity, never a fast smooth motion (the slam up from below
 *  is fast and smooth). */
const pops = (seq) => {
  const out = [];
  for (let i = 1; i < seq.length; i++) {
    for (const k of ['L', 'R', 'reach']) {
      const d = step(seq, i, k), before = step(seq, i - 1, k), after = step(seq, i + 1, k);
      if (d == null || before == null || after == null || d <= 10) continue;   // judged on the screen both sides (A2 holds the exits)
      if (d > 2.5 * Math.max(before, after, 1)) out.push(`${k}@${i}:${d.toFixed(0)}px`);
    }
  }
  return out;
};
const REST_Y = 200 - HANDS.GRIP_H + HANDS.BOTTOM_SLACK;   // a fist's top at the hold, nothing moving it

test('AUDIT CLIMB-HANDS A1: no pop - every hand on the screen moves on from where it was through every change of state: a leap off the hang, a free climb turned back, the hang to the free climb and back, a lip stepped mid-shimmy, a wall run onto the face, a corner', () => {
  const runs = {
    'a leap off the hang': [...still(30, hang()),
      ...moveFrames({ kind: 'leap', from: at(0), up: [0.6, 1.2, 0], to: at(1.2), split: 0.5, hang: { normal: N, lipY: 2.8 } }, 0.6, (t) => hang(lerp(0, 1.2, t), { grip: 0.9 })),
      ...still(40, hang(1.2))],
    'a free climb turned back': [...still(10, climb()),
      ...Array.from({ length: 70 }, (_, i) => ({ climb: climb(0, 1 + (i + 1) * 0.01) })),
      ...Array.from({ length: 70 }, (_, i) => ({ climb: climb(0, 1.7 - (i + 1) * 0.01) })),
      ...Array.from({ length: 40 }, (_, i) => ({ climb: climb((i + 1) * 0.01, 1.0) }))],
    'the hang to the free climb and back': [...still(30, hang()), ...still(60, climb()), ...still(60, hang())],
    'a lip stepped mid-shimmy': [...Array.from({ length: 40 }, (_, i) => ({ climb: hang((i + 1) * 0.01) })),
      ...Array.from({ length: 30 }, (_, i) => ({ climb: hang(0.4 + (i + 1) * 0.01, { lipY: 2.9 }) }))],
    'a wall run onto the face': [...still(10, null),
      ...moveFrames({ kind: 'wallrun', from: [0, 0, 1], up: [0, 0.1, 0], to: at(1.4), split: 0.25, hang: null, wall: { normal: N } }, 0.7, (t) => air([0, lerp(0, 1.4, t), lerp(1, 0, Math.min(1, t * 4))])),
      ...still(60, climb(0, 1.4))],
    'a corner': [...still(30, hang()),
      ...moveFrames({ kind: 'corner', from: at(0), up: [0.25, 1, 0.05], to: [0.3, 1, 0.3], split: 0.5, turn: -Math.PI / 2, hang: { normal: [1, 0, 0], lipY: 2.8 } }, 0.5, () => hang()),
      ...still(40, hang(0.3, { normal: [1, 0, 0], track: [0.3, 1, 0.3], feet: [0.3, 1, 0.3] }))],
  };
  const found = Object.fromEntries(Object.entries(runs).map(([name, frames]) => [name, pops(drive(new ClimbHands(), frames))]));
  assert.deepEqual(found, Object.fromEntries(Object.keys(runs).map((n) => [n, []])), 'no hand jumps');
  // and what a change carried over is paid out: back on the hang, the hands are on its hold again
  const back = drive(new ClimbHands(), runs['the hang to the free climb and back']).at(-1);
  for (const k of ['L', 'R']) assert.ok(Math.abs(back[k].y - REST_Y) < HANDS.SWAY_Y + 0.5, `${k} back on the hold (${back[k].y.toFixed(1)})`);
});

test('AUDIT CLIMB-HANDS A1b: a new hold\'s gait counts from the hold, never from the frame that took it - ClimbPose zeroes that frame\'s travel (a hitch at a corner\'s end left the hands off their stones on the new face)', () => {
  const law = new ClimbHands();
  const rest = drive(law, still(60, hang())).at(-1);
  // a corner, then the hang on the other face, the body 0.3 m on in the frame the hold is taken (a hitch)
  drive(law, moveFrames({ kind: 'corner', from: at(0), up: [0.25, 1, 0.05], to: [0.3, 1, 0.3], split: 0.5, turn: -Math.PI / 2, hang: { normal: [1, 0, 0], lipY: 2.8 } }, 0.5, () => hang()));
  const after = drive(law, still(90, { ...hang(), normal: [1, 0, 0], track: [0.3, 1, 0.3], feet: [0.3, 1, 0.3] }, { yaw: -Math.PI / 2 })).at(-1);
  for (const k of ['L', 'R']) assert.ok(Math.abs(after[k].x - rest[k].x) < HANDS.SWAY_X + 0.5, `${k} on its stone on the new face (${(after[k].x - rest[k].x).toFixed(1)} px off)`);
});

test('AUDIT CLIMB-HANDS A2: off the wall the hands leave from where they were - a mantle\'s and a vault\'s hands, gone over the top, stay gone; a look away\'s reaching arm drops where it is and the fists never come back first', () => {
  const after = (frames, tail) => drive(new ClimbHands(), [...frames, ...still(tail, null)]).slice(frames.length);
  const mantle = moveFrames({ kind: 'mantle', from: at(0), up: [0, 2.85, 0], to: [0, 2.8, -0.5], split: 0.6, exit: null }, 0.9, (t) => hang(0, { track: [0, lerp(1, 2.8, t), lerp(0, -0.5, t)], feet: [0, lerp(1, 2.8, t), lerp(0, -0.5, t)] }));
  for (const f of after([...still(30, hang()), ...mantle], 40)) assert.ok(!f.L && !f.R, 'over the top and off the wall: the hands stay gone');
  const vault = moveFrames({ kind: 'vault', from: [0, 0, 0], up: [0, 1, 0], to: [0, 1, -1.2], split: 0.4, exit: [0, -3] }, 0.5, (t) => air([0, t, -1.2 * t]));
  for (const f of after([...still(10, null), ...vault], 40)) assert.ok(!f.L && !f.R, 'out of a vault: gone');
  const look = { yaw: 85 * Math.PI / 180, pitch: 0 };
  const run = drive(new ClimbHands(), [...still(30, hang()), ...still(40, hang(), look), ...still(40, null, look)]);
  const letGo = run.slice(70);
  assert.ok(run[69].reach && !run[69].L && !run[69].R, 'looked away: the reaching arm alone');
  for (const f of letGo) assert.ok(!f.L && !f.R, 'let go looking away: no fist comes back to the hold');
  for (let i = 1; i < letGo.length; i++) if (letGo[i].reach) assert.ok(letGo[i].reach.y >= letGo[i - 1].reach.y - 1e-9, 'the arm only drops');
  assert.ok(letGo.some((f) => f.reach), 'it drops from where it was (not cut)');
  // let go mid-shimmy, a hand off its rest: it drops from there - straight down, never back to the hold's place first
  const mid = drive(new ClimbHands(), [...still(60, hang()), ...Array.from({ length: 15 }, (_, i) => ({ climb: hang((i + 1) * 0.01) })), ...still(30, null)]);
  const lastOn = mid[74];
  const leaving = mid.slice(75).filter((f) => f.R);
  assert.ok(leaving.length >= 2, 'seen leaving');
  for (const f of leaving) assert.ok(Math.abs(f.R.x - lastOn.R.x) < 1e-9 && f.R.y >= lastOn.R.y - 1e-9, `straight down from where it let go (x ${f.R.x.toFixed(2)} against ${lastOn.R.x.toFixed(2)})`);
});

/** A swing's landings in a run: the frames where a hand, moving with the travel, turns to move against it (it took its
 *  stone and the body goes on past it). `axis` the screen axis the travel shows on, `sign` the screen way of the
 *  travel. */
const landings = (seq, key, axis, sign, travelAt) => {
  const out = [];
  for (let i = 2; i < seq.length; i++) {
    const a = seq[i - 2][key], b = seq[i - 1][key], c = seq[i][key];
    if (!a || !b || !c) continue;
    if (sign * (b[axis] - a[axis]) > 0.05 && sign * (c[axis] - b[axis]) < -0.05) out.push(travelAt(i - 1));
  }
  return out;
};

test('AUDIT CLIMB-HANDS A3: the shimmy - a hand takes the lip every span, the two in turn, the leading one first (the right going right, the left going left), as the ear plays them and the 3D body takes them; a hand on the lip goes with the wall, against the way the body goes', () => {
  for (const dir of [1, -1]) {
    const v = 0.01;   // metres a frame: 0.6 m/s
    const frames = Array.from({ length: Math.round(1.0 / v) }, (_, i) => ({ climb: hang(dir * (i + 1) * v) }));
    const seq = drive(new ClimbHands(), [...still(60, hang()), ...frames]).slice(60);   // up on the hold first
    const travelAt = (i) => (i + 1) * v;
    const lead = dir > 0 ? 'R' : 'L', trail = dir > 0 ? 'L' : 'R';
    const lands = [...landings(seq, lead, 'x', dir, travelAt).map((t) => [t, lead]), ...landings(seq, trail, 'x', dir, travelAt).map((t) => [t, trail])].sort((p, q) => p[0] - q[0]);
    assert.deepEqual(lands.map((l) => l[1]), [lead, trail, lead, trail], `going ${dir > 0 ? 'right' : 'left'}: four grips in a metre, the ${lead} first, in turn (${JSON.stringify(lands)})`);
    // the hand turns with the wall as its reach eases onto the stone - the 3D body's grip lands at 0.9 of the span, the ear's
    // at the span: each within 0.05 m (under a tenth of a second at the shimmy's pace)
    lands.forEach(([t], k) => assert.ok(t > (k + 1) * SPAN - 0.05 && t <= (k + 1) * SPAN + 0.011, `grip ${k + 1} at ${t.toFixed(2)} m: on the ear's span (${((k + 1) * SPAN).toFixed(2)})`));
    // a hand on the lip goes with the wall: between its grips it moves against the travel on the screen
    const held = seq.slice(30, 40);   // the leading hand holds its stone while the other closes up (0.3-0.4 m in)
    const xs = held.map((f) => f[lead].x);
    assert.ok(xs.every((x, i) => i === 0 || dir * (x - xs[i - 1]) < 0), `the held ${lead} hand slides against the travel (${xs.map((x) => x.toFixed(1)).join(' ')})`);
    // a reaching hand lifts off the lip, SHIMMY_LIFT at the top of its reach (the pose's HAND_LIFT and HAND_AWAY, drawn)
    const firstReach = seq.slice(0, 24).map((f) => f[lead].y);
    assert.ok(Math.max(...firstReach) - Math.min(...firstReach) > HANDS.SHIMMY_LIFT * 0.8, `the ${lead} lifts as it reaches (${(Math.max(...firstReach) - Math.min(...firstReach)).toFixed(1)} px)`);
    // a hand is off the lip for POSE.SHIMMY_REACH of its span: between the reaches both hold it (neither lifted)
    const steady = seq.slice(50);
    const low = { L: Math.max(...steady.map((f) => f.L.y)), R: Math.max(...steady.map((f) => f.R.y)) };
    const bothHold = steady.filter((f) => f.L.y > low.L - 0.6 && f.R.y > low.R - 0.6).length;
    assert.ok(bothHold >= 3, `both hands on the lip between the reaches (${bothHold} frames)`);
  }
  // a lip stepped within the motor's follow is the same hold going on (the ear plays on): the grips keep their beats
  const law = new ClimbHands();
  drive(law, [...still(60, hang()), ...Array.from({ length: 10 }, (_, i) => ({ climb: hang((i + 1) * 0.01) }))]);
  const stepped = drive(law, Array.from({ length: 40 }, (_, i) => ({ climb: hang(0.1 + (i + 1) * 0.01, { lipY: 2.9 }) })));
  const next = 0.1 + landings(stepped, 'R', 'x', 1, (i) => (i + 1) * 0.01)[0];
  assert.ok(next > SPAN - 0.05 && next <= SPAN + 0.011, `the grip after a followed step on its beat (${next.toFixed(2)} m from the hold)`);
});

test('AUDIT CLIMB-HANDS A4: the free climb - hand over hand from a new hold, the left first (the 3D body\'s gait), a hand taking the face every FEEL.REACH climbed as the ear plays it; a held hand goes down the view as the body climbs past it, and up it climbing down', () => {
  const v = 0.01;
  const up = Array.from({ length: Math.round(0.9 / v) }, (_, i) => ({ climb: climb(0, 1 + (i + 1) * v) }));
  const seq = drive(new ClimbHands(), [...still(60, climb()), ...up]).slice(60);   // up on the face first
  const travelAt = (i) => (i + 1) * v;
  // climbing up the screen's y falls: a reach moves a hand up (-y), a held hand goes down (+y)
  const lands = [...landings(seq, 'L', 'y', -1, travelAt).map((t) => [t, 'L']), ...landings(seq, 'R', 'y', -1, travelAt).map((t) => [t, 'R'])].sort((p, q) => p[0] - q[0]);
  assert.deepEqual(lands.map((l) => l[1]).slice(0, 2), ['L', 'R'], `the left first, then the right (${JSON.stringify(lands)})`);
  lands.slice(0, 2).forEach(([t], k) => assert.ok(Math.abs(t - (k + 1) * FEEL.REACH) <= 0.021, `grip ${k + 1} at ${t.toFixed(2)} m: on the ear's reach (${((k + 1) * FEEL.REACH).toFixed(2)})`));
  // a hand is off the face for 1 - POSE.CLIMB_DUTY of the stride (two reaches). On the screen it goes up the view only
  // while its eased reach outruns the climbing body - sqrt(1 - 2 / 3k) of the reach, k the stride over the reach
  const stride = 2 * FEEL.REACH, reach = (1 - POSE.CLIMB_DUTY) * stride;
  const reachL = seq.slice(0, 45).filter((f, i) => i > 0 && f.L.y < seq[i - 1].L.y - 1e-9).length;
  const want = (reach / v) * Math.sqrt(1 - 2 / (3 * (stride / reach)));
  assert.ok(Math.abs(reachL - want) <= 2, `the left reaches up the view over ${reachL} frames (${want.toFixed(1)})`);
  const heldL = seq.slice(50, 60).map((f) => f.L.y);   // the left on its stone while the right reaches (0.5-0.6 m in)
  assert.ok(heldL.every((y, i) => i === 0 || y > heldL[i - 1]), `the held left goes down the view (${heldL.map((y) => y.toFixed(1)).join(' ')})`);
  // climbing down: a held hand goes UP the view
  const law = new ClimbHands();
  drive(law, [...still(60, climb(0, 2)), ...Array.from({ length: 60 }, (_, i) => ({ climb: climb(0, 2 - (i + 1) * v) }))]);
  const down = drive(law, Array.from({ length: 30 }, (_, i) => ({ climb: climb(0, 1.4 - (i + 1) * v) })));
  const heldNow = ['L', 'R'].find((k) => down.slice(5, 15).every((f, i, a) => i === 0 || f[k].y < a[i - 1][k].y));
  assert.ok(heldNow, 'climbing down, a held hand rises in the view');
});

test('AUDIT CLIMB-HANDS A5: the catch - the hands up onto the hold by 0.45 of its clock (ClimbPose._toHang); then the weight lands: the arms straighten as the body drops under them, the hands lifting in the view (with the view\'s own dip) before they settle back', () => {
  const law = new ClimbHands();
  const c = moveFrames({ kind: 'catch', from: [0, 0.8, 0.3], up: at(0), to: at(0), split: 1, hang: { normal: N, lipY: 2.8 } }, 0.3, (t) => air([0, lerp(0.8, 1, t), 0]));
  const seq = drive(law, [...still(20, null), ...c]);
  const on = seq[20 + Math.ceil(0.45 * c.length) - 1];
  assert.ok(on.R && Math.abs(on.R.y - REST_Y) < 3, `on the hold by 0.45 (${on.R?.y.toFixed(1)} against ${REST_Y})`);
  const after = drive(law, still(150, hang()));
  const top = Math.min(...after.map((f) => f.R.y));
  assert.ok(top < REST_Y - 3, `the arms straighten: the hands lift (${top.toFixed(1)})`);
  assert.ok(after.every((f) => f.R.y <= REST_Y + HANDS.SWAY_Y + 3), 'never sagging under the hold');
  assert.ok(Math.abs(after.at(-1).R.y - REST_Y) < HANDS.SWAY_Y + 0.5, 'and settle on it (the still hang\'s sway on it)');
});

test('AUDIT CLIMB-HANDS A6: the leap - the hands push off the hold (down out of the way) from where they were, lead toward the leap\'s side across the flight, and are on the new hold by 0.8 of its clock (ClimbPose._leap)', () => {
  for (const dir of [1, -1]) {
    const law = new ClimbHands();
    const rest = drive(law, still(40, hang())).at(-1);
    const l = moveFrames({ kind: 'leap', from: at(0), up: [dir * 0.6, 1.2, 0], to: at(dir * 1.2), split: 0.5, hang: { normal: N, lipY: 2.8 } }, 0.6, (t) => hang(lerp(0, dir * 1.2, t)));
    const seq = drive(law, l);
    assert.ok(Math.abs(seq[0].R.y - rest.R.y) < 6, 'the first frame from where they were');
    assert.ok(!seq[Math.round(0.18 * l.length)].R || seq[Math.round(0.18 * l.length)].R.y > rest.R.y + 30, 'pushed off by 0.18');
    const mid = seq[Math.round(0.55 * l.length)];
    const k = dir > 0 ? 'R' : 'L';
    assert.ok(mid[k] && dir * (mid[k].x - rest[k].x) > 8, 'across the flight the hands lead toward the leap\'s side');
    const land = seq[Math.round(0.8 * l.length) - 1];
    assert.ok(land.R && Math.abs(land.R.y - rest.R.y) < 4 && Math.abs(land.R.x - rest.R.x) < 4, 'on the new hold by 0.8');
  }
});

test('AUDIT CLIMB-HANDS A7: the mantle - from the hang the hands go DOWN the view as the body rises past them (never lifting), press on the top as it crests, and leave on ClimbPose._mantle\'s let-go (a clamber\'s sooner); a step-up from the ground takes its edge low in the view, never the hang\'s hold over the head', () => {
  const law = new ClimbHands();
  drive(law, still(40, hang()));
  const split = 0.6;
  const m = moveFrames({ kind: 'mantle', from: at(0), up: [0, 2.85, 0], to: [0, 2.8, -0.5], split, exit: null }, 0.9, (t) => hang(0, { track: [0, lerp(1, 2.8, t), lerp(0, -0.5, t)], feet: [0, lerp(1, 2.8, t), lerp(0, -0.5, t)] }));
  const seq = drive(law, m);
  const rise = seq.slice(0, Math.round(split * m.length));
  assert.ok(rise.every((f, i) => i === 0 || f.R.y >= rise[i - 1].R.y - 1e-9), `through the rise the hands only go down the view (${rise.map((f) => f.R.y.toFixed(0)).join(' ')})`);
  assert.ok(rise.at(-1).R.y > REST_Y + 20, 'by the crest well down it');
  const overAt = (o) => Math.round((split + o * (1 - split)) * m.length) - 1;
  assert.ok(seq[overAt(0.5)].R, 'on the top through the press');
  assert.ok(!seq[overAt(0.96)].R && !seq[overAt(0.96)].L, 'let go by 0.95 of the way over');
  // a clamber (a move with an exit) lets go sooner: by 0.75 over
  const law2 = new ClimbHands();
  drive(law2, still(40, hang()));
  const cl = drive(law2, moveFrames({ kind: 'mantle', from: at(0), up: [0, 2.85, 0], to: [0, 2.8, -0.6], split: 0.4, exit: [0, -1] }, 0.9, (t) => hang(0, { track: [0, lerp(1, 2.8, t), lerp(0, -0.6, t)], feet: [0, lerp(1, 2.8, t), lerp(0, -0.6, t)] })));
  const clAt = Math.round((0.4 + 0.76 * 0.6) * 54) - 1;
  assert.ok(!cl[clAt].R && !cl[clAt].L, 'a clamber has let go by 0.75 over');
  // ...where a mantle the same height still presses on the top at 0.62 over, the clamber's hands are already gone
  const law3 = new ClimbHands();
  drive(law3, still(40, hang()));
  const mt = drive(law3, moveFrames({ kind: 'mantle', from: at(0), up: [0, 2.85, 0], to: [0, 2.8, -0.6], split: 0.4, exit: null }, 0.9, (t) => hang(0, { track: [0, lerp(1, 2.8, t), lerp(0, -0.6, t)], feet: [0, lerp(1, 2.8, t), lerp(0, -0.6, t)] })));
  const at62 = Math.round((0.4 + 0.62 * 0.6) * 54) - 1;
  assert.ok(mt[at62].R && !cl[at62].R, 'at 0.62 over: the mantle on the top, the clamber gone (ClimbPose: its let-go 0.45-0.75, the mantle\'s 0.6-0.95)');
  // a waist-high step-up from the ground: the edge low in the view
  const step = drive(new ClimbHands(), [...still(10, null), ...moveFrames({ kind: 'mantle', from: [0, 0, 0], up: [0, 0.6, 0], to: [0, 0.6, -0.5], split: 0.5, exit: null }, 0.6, (t) => air([0, 0.6 * t, -0.5 * t]))]);
  for (const f of step) if (f.R) assert.ok(f.R.y > REST_Y + 30, `a step-up's hands stay low (${f.R.y.toFixed(1)})`);
});

test('AUDIT CLIMB-HANDS A8: the vault - planted low on the top by 0.12 of its clock, on it through 0.55, gone by 0.8 (ClimbPose._vault\'s windows): a waist-high top, never raised to the hang\'s hold', () => {
  const v = moveFrames({ kind: 'vault', from: [0, 0, 0], up: [0, 1, 0], to: [0, 1, -1.2], split: 0.4, exit: [0, -3] }, 0.5, (t) => air([0, t, -1.2 * t]));
  const seq = drive(new ClimbHands(), [...still(10, null), ...v]).slice(10);
  const f = (t) => seq[Math.round(t * v.length) - 1];
  assert.ok(f(0.55).R, 'on the top at 0.55');
  assert.ok(!f(0.82).R && !f(0.82).L, 'gone by 0.8');
  for (const s of seq) if (s.R) assert.ok(s.R.y > REST_Y + 30, `planted low (${s.R.y.toFixed(1)})`);
});

test('AUDIT CLIMB-HANDS A9: the lower - the hands take the edge by 0.26 of its clock (ClimbPose._lower), low in the view as the body squats over it, then rise to the hang as the body drops below the edge', () => {
  const lw = moveFrames({ kind: 'lower', from: [0, 2.8, -0.5], up: [0, 2.8, 0], to: at(0), split: 0.35, hang: { normal: N, lipY: 2.8 }, stand: true }, 0.9, (t) => air([0, lerp(2.8, 1, t), lerp(-0.5, 0, t)]));
  const seq = drive(new ClimbHands(), [...still(10, null), ...lw]).slice(10);
  const f = (t) => seq[Math.round(t * lw.length) - 1];
  assert.ok(f(0.3).R && Math.abs(f(0.3).R.y - (REST_Y + HANDS.LOWER_LOW)) < 3, `on the edge by 0.26, low in the view (${f(0.3).R?.y.toFixed(1)} against ${REST_Y + HANDS.LOWER_LOW})`);
  const drop = seq.slice(Math.round(0.34 * lw.length), lw.length);
  assert.ok(drop.every((s, i) => i === 0 || s.R.y <= drop[i - 1].R.y + 1e-9), 'then only rising as the body drops');
  assert.ok(Math.abs(seq.at(-1).R.y - REST_Y) < 3, 'to the hang');
});

test('AUDIT CLIMB-HANDS A10: the corner - the hand on the side it goes leads, lifting off first, the other following from 0.4 of its clock (ClimbPose._corner) - read off the move\'s own path, as the motor sets no `way` on it', () => {
  for (const dir of [1, -1]) {
    const law = new ClimbHands();
    const rest = drive(law, still(40, hang())).at(-1);
    const seq = drive(law, moveFrames({ kind: 'corner', from: at(0), up: [dir * 0.25, 1, 0.05], to: [dir * 0.3, 1, 0.3], split: 0.5, turn: -dir * Math.PI / 2, hang: { normal: [dir, 0, 0], lipY: 2.8 } }, 0.5, () => hang()));
    const lead = dir > 0 ? 'R' : 'L', trail = dir > 0 ? 'L' : 'R';
    const liftAt = (k) => seq.findIndex((f) => f[k] && f[k].y < rest[k].y - 4);
    assert.ok(liftAt(lead) >= 0 && liftAt(trail) >= 0, 'both hands lift off for their turn');
    assert.ok(liftAt(lead) < liftAt(trail), `going ${dir > 0 ? 'right' : 'left'} the ${lead} leads`);
    assert.ok(liftAt(trail) >= Math.floor(0.4 * seq.length) - 1, 'the other from 0.4');
  }
});

test('AUDIT CLIMB-HANDS A11 (found on the way, CLIMB6): ClimbPose\'s corner leads with the hand the way the body goes - it read `m.way`, which the motor never sets on a move (only on its event), so the right hand led every corner', () => {
  for (const dir of [1, -1]) {
    const pose = new ClimbPose();
    const base = { feet: [0, 1, 0], track: [0, 1, 0], yaw: 0, floorGap: Infinity, mode: 'hang', normal: N, lipY: 2.8, grip: 1, flight: null };
    for (let i = 0; i < 10; i++) pose.update(DT, { ...base, move: null });
    const m = { kind: 'corner', from: [0, 1, 0], up: [dir * 0.25, 1, 0.05], to: [dir * 0.3, 1, 0.3], split: 0.5, turn: -dir * Math.PI / 2, hang: { normal: [dir, 0, 0], lipY: 2.8 }, t: 0, dur: 0.5 };
    const lifted = { L: null, R: null };
    for (let i = 1; i <= 30; i++) {
      m.t = i / 30;
      const out = pose.update(DT, { ...base, move: m });
      for (const s of ['L', 'R']) if (lifted[s] == null && out.hands[s].at && out.hands[s].at[1] > 2.8 + POSE.WRIST_OVER + POSE.HAND_LIFT * 0.3) lifted[s] = m.t;
    }
    const lead = dir > 0 ? 'R' : 'L', trail = dir > 0 ? 'L' : 'R';
    assert.ok(lifted[lead] != null && (lifted[trail] == null || lifted[lead] < lifted[trail]), `going ${dir > 0 ? 'right' : 'left'} the ${lead} hand leads (${JSON.stringify(lifted)})`);
  }
});

test('AUDIT CLIMB-HANDS A12: the wall run - the arms pump with the run\'s steps (a hand at every POSE.WALLRUN_STEP the body rises, in turn), then both reach for the hold from 0.55 of its clock (ClimbPose._wallrun)', () => {
  const w = moveFrames({ kind: 'wallrun', from: [0, 0, 1], up: [0, 0.1, 0], to: at(1.8), split: 0.25, hang: { normal: N, lipY: 3.6 }, wall: null }, 1.2, (t) => air([0, lerp(0, 1.8, t), lerp(1, 0, Math.min(1, t * 4))]));
  const seq = drive(new ClimbHands(), [...still(10, null), ...w]).slice(10);
  // up to 0.55 the body rises 0.99 m: two steps' turns each hand, one hand pumping while the other does not
  const run = seq.slice(Math.round(0.15 * w.length), Math.round(0.5 * w.length));
  const peaks = (k) => run.filter((f, i) => i > 0 && i < run.length - 1 && f[k] && run[i - 1][k] && run[i + 1][k] && f[k].y < run[i - 1][k].y - 1e-6 && f[k].y < run[i + 1][k].y - 1e-6).length;   // strictly: a pump's top, never a ramp's end
  assert.ok(peaks('L') >= 1 && peaks('R') >= 1, `each arm pumps with the steps (L ${peaks('L')}, R ${peaks('R')})`);
  const end = seq.at(-1);
  assert.ok(end.R && Math.abs(end.R.y - REST_Y) < 3, 'and reaches the hold');
});

test('AUDIT CLIMB-HANDS A13: the still hang\'s sway - both hands together on the one lip (the pose\'s sway, its pitch at FEEL.SWAY_HZ x 1.37), and none while the body shimmies', () => {
  const seq = drive(new ClimbHands(), still(300, hang())).slice(60);   // up on the hold
  const gap = seq.map((f) => f.L.y - f.R.y);
  assert.ok(Math.max(...gap) - Math.min(...gap) < 1e-6, 'the two hands sway as one');
  const ys = seq.map((f) => f.R.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 1, 'and they do sway');
  // moving along the lip the sway is gone: a held hand's height is its stone's alone
  const law = new ClimbHands();
  drive(law, still(120, hang()));
  const moving = drive(law, Array.from({ length: 150 }, (_, i) => ({ climb: hang((i + 1) * 0.01) }))).slice(90);
  // on its stone a hand slides against the travel at the body's own pace (0.01 m a frame): those frames, and no sway in them
  const held = moving.filter((f, i) => i > 0 && Math.abs(f.L.x - moving[i - 1].L.x + 0.01 * HANDS.GAIT_PX) < 0.03).map((f) => f.L.y);
  assert.ok(held.length > 5 && Math.max(...held) - Math.min(...held) < 0.05, `no sway on a held hand while shimmying (${held.length} frames, ${(Math.max(...held) - Math.min(...held)).toFixed(3)} px)`);
});

test('AUDIT CLIMB-HANDS A14: on the large HUD the hands stand on its bar, as the classic sprite and the spell\'s hands do (weaponOffsetHeight, FPSWeapon.cs:146-155)', async () => {
  const quads = [];
  const renderer = { uploadTexture: (k, key) => ({ key }), drawScreenQuad: (tex, rect) => quads.push(rect) };
  const hands = createClimbHands({ renderer, fetchBytes: async (f) => f, decode: async () => ({ width: 2, height: 2, data: new Uint8Array(16) }) });
  for (let i = 0; i < 60; i++) hands.update(DT, hang(), { yaw: 0 });
  const canvas = { width: 640, height: 400 };
  hands.draw(canvas, { offsetHeight: 0 });
  await new Promise((r) => setTimeout(r, 0));
  quads.length = 0;
  hands.draw(canvas, { offsetHeight: 0 });
  const flat = quads.map((q) => q.y);
  quads.length = 0;
  hands.draw(canvas, { offsetHeight: 37 });
  assert.deepEqual(quads.map((q) => q.y), flat.map((y) => y - 37), 'lifted by the bar\'s height');
  assert.match(rd('src/combat/climbHands.js'), /offsetHeight = weaponOffsetHeight\(\)/, 'the bar\'s own height by default');
});

/** WEAPON09.CIF: one WeaponAnim record, 7 frames of 100x80 (ARROW2's synthetic bow, climb4's). */
function bowCif() {
  const W = 100, H = 80, head = 12 + 31 * 2 + 2;
  const runs = Math.ceil((W * H) / 128);
  const b = new Uint8Array(head + runs * 2);
  const v = new DataView(b.buffer);
  v.setUint16(0, W, true); v.setUint16(2, H, true);
  for (let f = 0; f < 7; f++) v.setUint16(12 + f * 2, head, true);
  for (let k = 0; k < runs; k++) b[head + k * 2] = 255;
  v.setUint16(12 + 62, b.length, true);
  return b;
}

test('AUDIT CLIMB-HANDS A15: the weapon and the hands are never on the screen together - the hands come up once the weapon is half down, and the weapon comes back only once they are off the screen', async () => {
  resetToDefaults(); _resetModSettings();
  setModSetting('weapon-widget', 'Enabled', false);
  const quads = [];
  const renderer = { uploadTexture: (_k, name) => name, drawScreenQuad: (tex, rect) => quads.push({ tex, rect }) };
  const canvas = { width: 320, height: 200, clientWidth: 320, clientHeight: 200 };
  const entity = { items: [{ name: 'Arrow', templateIndex: 131, stackCount: 20 }], equip: { slots: { [EQUIP_SLOTS.RightHand]: { name: 'Long Bow', templateIndex: 130, material: 0 } } }, stats: { speed: 50 } };
  let snap = null;
  const r = createWeaponRig({
    renderer, canvas, entity, audio: { playOneShot() {} }, palette: { get: () => ({ r: 0, g: 0, b: 0 }) },
    fetchBytes: async (f) => (String(f).includes('climb-') ? new Uint8Array(0) : bowCif()),
    camera: () => ({ pos: [0, 1.7, 0], yaw: 0, pitch: 0, climbing: !!snap, move: { grounded: !snap }, climb: snap }),
  });
  r.toggleSheath();
  for (let i = 0; i < 90; i++) { r.frame(DT); r.draw(); }
  await new Promise((res) => setTimeout(res, 0));
  const frame = () => { r.frame(DT); quads.length = 0; r.draw(); const weapon = quads.some((q) => typeof q.tex === 'string' && q.tex.startsWith('fpw:')); return { weapon, hands: r.climbHands.showing(), lower: r.climbLower() }; };
  assert.ok(frame().weapon, 'the bow in the hand');
  snap = hang();
  const on = Array.from({ length: 40 }, frame);
  for (const f of on) assert.ok(!(f.hands && f.lower < 0.5), `no hand up before the weapon is half down (lower ${f.lower.toFixed(2)})`);
  assert.ok(on.at(-1).hands, 'and then up');
  snap = null;
  const off = Array.from({ length: 90 }, frame);
  for (const f of off) assert.ok(!(f.hands && f.lower < 1), `the weapon held down while a hand shows (lower ${f.lower.toFixed(2)})`);
  assert.ok(off.at(-1).lower === 0 && off.at(-1).weapon, 'and back in the hand after');
  _resetModSettings(); resetToDefaults();
});

test('AUDIT CLIMB-HANDS A16: by source - the hands are stepped on the classic lane alone (the Morrowind arms and the third-person body take the climb themselves) and the weapon\'s lowering waits on them', () => {
  const rig = rd('src/combat/weapon/weaponRig.js');
  assert.match(rig, /const handsLane = !fpArm\.active\(\) && !fpArm\.thirdActive\(\) && !eotbHidesWeapon\(\);/);
  assert.match(rig, /_climbLower = climbLowerStep\(_climbLower, climbing \|\| \(handsLane && climbHands\.showing\(\)\), dt\);/);
  // PIN MOVED (CLIMB-HANDS II): the lane's climb named first, then handed on with the look and the frame's lens.
  // PIN MOVED (FIELD BUGS 2026-10-22c SPELL-CLIMB): none while a cast's hands play
  assert.match(rig, /const handsClimb = handsLane && _climbLower >= CLIMB_HANDS_AFTER && !castTakesHands \? \(camNow\?\.climb \?\? null\) : null;[\s\S]{0,400}?climbHands\.update\(dt, handsClimb, \{ yaw: camNow\?\.yaw, pitch: camNow\?\.pitch, lens: handsLens \}\);/);
  const pose = rd('src/player/climb/climbPose.js');
  assert.doesNotMatch(pose, /m\.way \? Math\.sign\(m\.way\[0\]/, 'the corner reads its own path, not a field the motor never sets');
});

// ---- AUDIT CLIMB-HANDS, second round: an independent review's findings, on the real motor where they live ----------

import { PlayerMotor } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import { climbRigInput } from '../../../src/player/climb/climbPose.js';
import { PARKOUR_LIP_FOLLOW } from '../../../src/player/parkour.js';

const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
/** A floor and one solid of eight corners (a box, or a wedge whose top slopes), a motor on it with the parkour on. */
const world = (corners) => {
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20]), [0, 1, 2, 0, 2, 3], I4);
  col.addMesh('wall', new Float32Array(corners), BOX_IDX, I4);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
    climbing: { inputs: () => ({ climbing: 100, luck: 50 }), tally: () => {}, say: () => {}, rolls: () => 0 },
    parkour: { enabled: () => true, inputs: () => ({ climbing: 100, fatigue: 1, load: 0, enhanced: false, jumping: 100 }), say: () => {}, tally: () => {} },
  });
  m.spawn(0, 0.02, 0.4);
  return m;
};
/** A wall at z = 1 from x -3 to 3, its top `yA` at the left end and `yB` at the right. */
const wedge = (yA, yB) => world([-3, 0, 1, 3, 0, 1, 3, yB, 1, -3, yA, 1, -3, 0, 4, 3, 0, 4, 3, yB, 4, -3, yA, 4]);

test('AUDIT CLIMB-HANDS B1 (second round): on a lip the shimmy follows - sloping, or carried on a hull - the hands walk as on a level one: the motor re-reads the lip every step, and the gait restarted on every new height had the fists frozen square (ClimbPose\'s own hands too: found on the way)', () => {
  for (const slope of [0, 0.02]) {
    const m = wedge(2.3 - 3 * slope, 2.3 + 3 * slope);
    const law = new ClimbHands(), pose = new ClimbPose();
    const lips = new Set(), xs = [], poseXs = [];
    for (let i = 0; i < 200; i++) {
      m.update(DT, { forward: 0, strafe: i >= 80 && i < 180 ? 1 : 0, run: false, jump: i >= 10 && i < 40, crouch: false }, 0);
      const c = climbRigInput(m, 0);
      const o = law.update(DT, c, { yaw: 0, pitch: 0 });
      const po = pose.update(DT, c);
      if (i >= 80 && i < 180 && c?.mode === 'hang') {
        lips.add(c.lipY);
        const R = o.grips.find((g) => g.side === 'R');
        if (R) xs.push(R.x);
        if (po.hands.R.at) poseXs.push(po.hands.R.at[0] - c.feet[0]);
      }
    }
    if (slope) assert.ok(lips.size > 20, `the motor re-reads a sloping lip every step (${lips.size} heights)`);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 25, `slope ${slope}: the right fist walks the lip (${(Math.max(...xs) - Math.min(...xs)).toFixed(1)} px)`);
    assert.ok(Math.max(...poseXs) - Math.min(...poseXs) > 0.15, `slope ${slope}: and the body's right hand (${(Math.max(...poseXs) - Math.min(...poseXs)).toFixed(3)} m)`);
  }
  // a lip stepped further than the motor follows is another hold: the gait starts square there
  const law = new ClimbHands();
  drive(law, [...still(60, hang()), ...Array.from({ length: 10 }, (_, i) => ({ climb: hang((i + 1) * 0.01) }))]);
  const jumped = drive(law, Array.from({ length: 40 }, (_, i) => ({ climb: hang(0.1 + (i + 1) * 0.01, { lipY: 2.8 + PARKOUR_LIP_FOLLOW + 0.1 }) })));
  const first = landings(jumped, 'R', 'x', 1, (i) => (i + 1) * 0.01)[0];
  assert.ok(first > SPAN - 0.05 && first <= SPAN + 0.011, `past the follow, a new hold: the first grip a span's reach past it (${first})`);
});

test('AUDIT CLIMB-HANDS B2 (second round): a free climb whose way wavers frame to frame (a diagonal over mouldings, a pad\'s stick) keeps its hands climbing - every change of way past 6 degrees was a change of state, and the carry pinned both fists', () => {
  const law = new ClimbHands();
  drive(law, still(60, climb()));
  let x = 0, y = 1;
  const frames = Array.from({ length: 240 }, (_, i) => {
    const a = Math.PI / 4 + (Math.floor(i / 3) % 2 ? 0.25 : -0.25);   // up and right, the way swinging 14 degrees each side
    x += 0.01 * Math.sin(a); y += 0.01 * Math.cos(a);
    return { climb: climb(x, y) };
  });
  const seq = drive(law, frames);
  const still2 = seq.filter((f, i) => i > 0 && Math.hypot(f.L.x - seq[i - 1].L.x, f.L.y - seq[i - 1].L.y) < 1e-6 && Math.hypot(f.R.x - seq[i - 1].R.x, f.R.y - seq[i - 1].R.y) < 1e-6).length;
  assert.ok(still2 < 5, `both fists frozen on ${still2} of ${seq.length - 1} frames of climbing`);
  assert.deepEqual(pops(seq), [], 'and no hand jumps');
});

test('AUDIT CLIMB-HANDS B3 (second round, and found on the way for CLIMB6): a catch\'s landing is as hard as the body came - the motor said its speed on the move\'s event alone, so the hands\' landing and ClimbPose\'s pendulum (`m.speed`) both read a standstill on every catch', () => {
  const m = wedge(2.3, 2.3);
  let caught = null, said = null;
  for (let i = 0; i < 80 && !caught; i++) {
    m.update(DT, { forward: 0, strafe: 0, run: false, jump: i >= 10 && i < 40, crouch: false }, 0);
    for (const e of m.climbEvents ?? []) if (e.type === 'move' && e.kind === 'catch') said = e.speed;
    if (m.climbMove?.kind === 'catch') caught = m.climbMove;
  }
  assert.ok(caught && said > 1, `a jump caught at the lip (${said?.toFixed(2)} m/s)`);
  assert.equal(caught.speed, said, 'the move carries the speed its event says');
  // the hands land harder the faster the body came
  const lift = (speed) => {
    const law = new ClimbHands();
    drive(law, still(10, null));
    drive(law, moveFrames({ kind: 'catch', from: [0, 0.8, 0.3], up: at(0), to: at(0), split: 1, speed, hang: { normal: N, lipY: 2.8 } }, 0.3, (t) => air([0, lerp(0.8, 1, t), 0])));
    return REST_Y - Math.min(...drive(law, still(60, hang())).map((f) => f.R.y));
  };
  assert.ok(lift(4) > lift(0) + 1, `a fall caught lands harder (${lift(4).toFixed(1)} px against ${lift(0).toFixed(1)})`);
  // ...and the body's pendulum
  const swing = (speed) => { const p = new ClimbPose(); const mv = { ...caught, t: 0.01, speed }; p.update(DT, { ...hang(), move: mv }); return p.swingAmp; };
  assert.ok(swing(4) > swing(0), 'the body swings harder the faster it came');
});

test('AUDIT CLIMB-HANDS B4 (second round): a leap\'s lead is as much as it goes across - a leap straight up, its hold a fraction of a millimetre aside, swung the hands the whole 26 px', () => {
  const lead = (across) => {
    const law = new ClimbHands();
    const rest = drive(law, still(40, hang())).at(-1);
    const seq = drive(law, moveFrames({ kind: 'leap', from: at(0), up: [across, 1.6, 0], to: at(across, 2.2), split: 0.5, hang: { normal: N, lipY: 4.0 } }, 0.6, (t) => hang(lerp(0, across, t), { track: at(lerp(0, across, t), lerp(1, 2.2, t)), feet: at(lerp(0, across, t), lerp(1, 2.2, t)) })));
    return Math.max(...seq.filter((f) => f.R).map((f) => Math.abs(f.R.x - rest.R.x)));
  };
  assert.ok(lead(0.0002) < 1, `straight up: no lead (${lead(0.0002).toFixed(2)} px)`);
  assert.ok(lead(1.2) > HANDS.LEAP_LEAD * 0.9, `a leap well across: the whole lead (${lead(1.2).toFixed(1)} px)`);
});

test('AUDIT CLIMB-HANDS B5 (second round): looking straight back from the wall the reaching arm keeps its side - turning past 180 degrees flipped the look\'s sign, and the fists flashed up onto the hold between the two arms', () => {
  const law = new ClimbHands();
  drive(law, still(60, hang(), { yaw: Math.PI - 0.002, pitch: 0 }));
  const sweep = drive(law, Array.from({ length: 40 }, (_, i) => ({ climb: hang(), view: { yaw: Math.PI - 0.002 + (i * 0.004) / 39, pitch: 0 } })));
  for (const f of sweep) assert.ok(!f.L && !f.R, 'no fist comes up while looking away');
  assert.ok(sweep.every((f) => f.reach), 'the reaching arm stays up');
  // turned on round to the other side for real, the arm goes over to it - down off the one, up on the other, the fists
  // still down all the way
  const over = drive(law, Array.from({ length: 60 }, (_, i) => ({ climb: hang(), view: { yaw: Math.PI + 0.002 + (i / 59) * (Math.PI / 2), pitch: 0 } })));
  for (const f of over) assert.ok(!f.L && !f.R, 'no fist between the arms');
  assert.ok(over.some((f) => !f.reach), 'the arm went down off its side...');
  assert.equal(over.at(-1).reach?.side, 'L', '...and is up on the side looked to');
});

test('AUDIT CLIMB-HANDS B6 (second round): by source - the law is handed no climb when the Morrowind body is drawn in third person (the arm is not first person\'s alone: fpArm.active() is), so it never holds that weapon down', () => {
  assert.match(rd('src/combat/weapon/weaponRig.js'), /const handsLane = !fpArm\.active\(\) && !fpArm\.thirdActive\(\) && !eotbHidesWeapon\(\);/);
});
