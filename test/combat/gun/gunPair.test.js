// AUDIT PISTOLET D12 (bible/01-Overview/audits/Audit-Pistolet.md): A PAIR OF GUNS, STEPPED - combat/gun/gunPair.js through a
// real PlayerWeapon pair's shots, reloads and sheath: each hand's frame, the draw order, each hand's own reload dip and its
// two clacks, the left stepped flipped, each hand's own spring at the gun's kick, and the slide away while either pistol
// is still on screen. Only the guard was pinned before; ten mutants of the rest survived.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGunPair, PAIR_CLOSE_LEAD } from '../../../src/combat/gun/gunPair.js';
import { PISTOLET_FEEL, RELOAD_CLOSE_LEAD } from '../../../src/combat/gun/gunFeel.js';
import { gunWidgetSettings, gunMotion } from '../../../src/combat/gun/gunViewmodel.js';
import { PlayerWeapon } from '../../../src/combat/playerWeapon.js';
import { createPistolet } from '../../../src/systems/pistolet.js';

const DT = 1 / 60;
function pairRig() {
  const pw = new PlayerWeapon();
  pw.currentRightHandWeapon = createPistolet(); pw.currentLeftHandWeapon = createPistolet(); pw.usingRightHand = true;
  pw.applyWeapon();
  const pair = createGunPair();
  const settings = gunWidgetSettings(null, PISTOLET_FEEL.widget);
  const played = [];
  const frame = (o = {}) => {
    pw.update(DT);
    pair.step(DT, pw, { feel: PISTOLET_FEEL, settings, frame: { width: 320, height: 200, motion: gunMotion({}), look: o.look ?? [0, 0] }, sheathed: !!o.sheathed });
    pair.voice(pw, (k) => played.push({ k, at: pw.machine.now }));
  };
  return { pw, pair, frame, played };
}
const until = (cond, step, max = 900) => { for (let i = 0; i < max && !cond(); i++) step(); };

test('the striking hand plays the machine\'s frames, the other rests on its idle; the striking hand is drawn last (mutants: the frame stuck; the order fixed)', () => {
  const { pw, pair, frame } = pairRig();
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'R');
  const seen = new Set();
  until(() => pw.machine.state === 'Idle', () => {
    frame();
    if (pw.machine.state !== 'Idle') {
      seen.add(pair.frameOf('R', pw).frame);
      assert.deepEqual(pair.frameOf('L', pw), { record: 0, frame: 0 }, 'the left rests');
      assert.deepEqual(pair.order(pw), ['L', 'R'], 'the right, firing, over the left');
    }
  });
  assert.ok(seen.size > 2 && [...seen].some((f) => f > 0), `the right played its frames (${[...seen]})`);
  until(() => pw.handLoaded('L') && pw.machine.state === 'Idle', frame);
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'L');
  frame();
  assert.equal(pair.frameOf('L', pw).record, 1);
  assert.deepEqual(pair.order(pw), ['R', 'L'], 'the left, firing, over the right');
});

test('each hand dips on its OWN reload and comes back; the other stays up; its two clacks at the reload\'s start and RELOAD_CLOSE_LEAD before its end (mutants: no dip; both dip; the close at the end; no open)', () => {
  const { pw, pair, frame, played } = pairRig();
  assert.equal(PAIR_CLOSE_LEAD, RELOAD_CLOSE_LEAD);
  for (let i = 0; i < 30; i++) frame();
  assert.ok(pw._attack('StrikeDown'));
  until(() => pw.machine.state === 'Idle', frame);
  const reloadEnds = pw.handReloadUntil('R');
  for (let i = 0; i < 30; i++) frame();
  const dip = (h) => pair.hands[h].rig.offsetCurrent[1];
  assert.ok(dip('R') > 0.3, `the right dips while it reloads (${dip('R').toFixed(2)})`);
  assert.ok(Math.abs(dip('L')) < 0.05, `the left stays up (${dip('L').toFixed(2)})`);
  until(() => pw.machine.now > reloadEnds + 0.6, frame);
  assert.ok(Math.abs(dip('R')) < 0.05, 'and the right comes back up loaded');
  const open = played.filter((p) => p.k === 'open'), close = played.filter((p) => p.k === 'close');
  assert.equal(open.length, 1, 'one open clack'); assert.equal(close.length, 1, 'one close clack');
  assert.ok(close[0].at >= reloadEnds - RELOAD_CLOSE_LEAD - 1e-9 && close[0].at < reloadEnds - RELOAD_CLOSE_LEAD + 2 * DT, `the close ${RELOAD_CLOSE_LEAD}s before ready (at ${close[0].at.toFixed(3)}, ready ${reloadEnds.toFixed(3)})`);
  assert.ok(open[0].at < close[0].at - 0.5, 'the open at the reload\'s start');
});

test('the left is stepped FLIPPED - its inertia pre-signed against the right\'s, so both sway the screen\'s way (mutant: never flipped)', () => {
  const { pair, frame } = pairRig();
  for (let i = 0; i < 20; i++) frame({ look: [6, 0] });
  const r = pair.hands.R.rig.inertiaCurrent[0], l = pair.hands.L.rig.inertiaCurrent[0];
  assert.ok(Math.abs(r) > 1e-3, `the look moved the inertia (${r})`);
  assert.ok(Math.abs(r + l) < 1e-9, `the left's the right's mirrored (${r} / ${l})`);
  assert.equal(pair.flipOf('L'), true); assert.equal(pair.flipOf('R'), false);
  assert.equal(pair.flipOf('R', true), true, 'a left-handed player\'s pair is the mirror');
});

test('a shot kicks its OWN hand\'s spring, at the gun\'s kick, and the hand is drawn by its spring (mutants: the kick ignored; the spring ignored)', () => {
  const { pair } = pairRig();
  pair.punch('R', { ...PISTOLET_FEEL, kick: 0 });
  pair.hands.R.kick = pair.hands.R.recoil.step(DT);
  assert.equal(pair.kickOf('R', 100).y, 0, 'a kick of nothing moves nothing');
  pair.punch('L', PISTOLET_FEEL);
  pair.hands.L.kick = pair.hands.L.recoil.step(DT);
  assert.ok(Math.abs(pair.kickOf('L', 100).y) > 0.5, `the gun's kick, drawn (${pair.kickOf('L', 100).y.toFixed(2)})`);
  assert.equal(pair.kickOf('R', 100).y, 0, 'and only its own hand');
});

test('sheathed, the pair slides away while EITHER pistol is still on screen (mutant: both needed)', () => {
  const { pw, pair, frame } = pairRig();
  assert.ok(pw._attack('StrikeDown'));
  until(() => pw.machine.state === 'Idle', frame);
  for (let i = 0; i < 40; i++) frame();   // the right dipped for its reload
  let sawOneDown = false;
  for (let i = 0; i < 200 && pair.sliding(PISTOLET_FEEL); i++) {
    frame({ sheathed: true });
    const down = (h) => Math.abs(pair.hands[h].rig.offsetCurrent[1]) >= Math.abs(PISTOLET_FEEL.sheathTarget[1]) - 1e-3;
    if (down('R') !== down('L')) { sawOneDown = true; assert.ok(pair.sliding(PISTOLET_FEEL), 'one still up: still sliding'); }
  }
  assert.ok(sawOneDown, 'one pistol reached the bottom before the other');
  assert.equal(pair.sliding(PISTOLET_FEEL), false, 'and both away at the end');
});
