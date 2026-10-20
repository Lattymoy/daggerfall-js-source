// BODY-MOTION, HELD STEADY (2026-10-20, Mac: "When wielding 2 daggers and running, the character is super stiff and
// wobbles side to side. Might as well check the other animations also. I think we went way too stiff";
// bible/04-Characters/Body-Motion.md) - on the vendored retail biped, measured on the solved body.
//
// What is pinned: HELD-STEADY - a hand that holds a blade holds the blade's way still against the stride's counter-turn
// and counter-drop of the chest (every held weapon's tips swung side to side with it, the pair's 50 units together),
// while an empty arm still rides it by its row's swing share; a weapon in both hands binds the chest, which then takes
// none of the stride's turn (held steady, the two-hander's left hand fell off its hilt). DUAL-RUN - the pair's run: the
// arms swept behind, pumping, the elbows bent, and the forearms inside their range (they stood locked straight, turned
// 128 degrees off the elbow's hinge).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, injectSkeletonNodes, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { MW_WEAPON_TYPE } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { offWeaponBoneAddon } from '../../../src/combat/twoHands/mirrorRig.js';
import { handFrame } from '../../../src/combat/climbRig.js';
import { bodyOf, RAD } from '../../../src/characters/bodyMotion/bodyKit.js';
import { bodyFrames } from '../../../src/characters/bodyMotion/bodySolve.js';
import { createBodyMotion, sceneInput } from '../../../src/characters/bodyMotion/bodyMotion.js';
import { retailSkeleton } from '../../fixtures/mw/retailRig.mjs';

const sm = (sk, pose, root) => skeletonSpaceMatrices(sk, pose, root);
const file = parseNif(retailSkeleton());
const sk = buildSkeleton(file);
injectSkeletonNodes(sk, offWeaponBoneAddon(sk, GRAPH_ROOT, sm, file));
const body = bodyOf(sk, GRAPH_ROOT, sm);
const W = MW_WEAPON_TYPE;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const pt = (mats, name) => mats.get(sk.byName.get(name)).t;
const range = (xs) => Math.max(...xs) - Math.min(...xs);
/** The blade's way (the Weapon Bone's +Y). */
const bladeOf = (mats, name) => { const a = mats.get(sk.byName.get(name)).a; return norm([a[1], a[4], a[7]]); };
/** A blade's tip, `reach` units along it from the grip. */
const tipOf = (mats, name, reach) => { const g = pt(mats, name), b = bladeOf(mats, name); return [g[0] + b[0] * reach, g[1] + b[1] * reach, g[2] + b[2] * reach]; };

/** The layer stepped at 60 Hz for `seconds`; `each(mats)` sees every frame of the last second. */
function play(scene, seconds, each) {
  const motion = createBodyMotion();
  const dt = 1 / 60, n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    motion.step(dt, sceneInput({ ...scene, kind: 'male' }));
    const pose = new Map();
    motion.apply(sk, pose, GRAPH_ROOT, sm);
    if (i >= n - 60) each(sm(sk, pose, GRAPH_ROOT));
  }
}
/** The chest's heading off the body's facing (degrees). */
const chestYaw = (m) => { const F = bodyFrames(body, m); return Math.atan2(-F.fwd[0], F.fwd[1]) / RAD; };

const RUNS = [[8.1, true], [5.5, true]];
const HELD = { one: { weapon: W.LongBladeOneHand }, two: { weapon: W.LongBladeTwoHand }, wide: { weapon: W.BluntTwoWide }, spear: { weapon: W.SpearTwoWide }, dual: { weapon: W.ShortBladeOneHand, hands: 'dual' } };
const REACH = { one: 85, two: 110, wide: 90, spear: 110, dual: 85 };

test('HELD-STEADY A HELD BLADE AT A RUN: every weapon held in the hand - a one-hander, a two-hander, a staff, a spear, a pair - keeps its tips within 8 units side to side over a stride at a run and a jog (laid on the chest\'s counter-turn whole they swung 29, 44, 45, 40 and, the pair\'s together, 50), while the empty arms and the fists still ride the chest\'s turn - the chest turning 20 degrees and more across a stride, each hand carried 11 units and more across with it (held steady too, 8) (mutants: HELD-STEADY-never-held, HELD-STEADY-blades-ride, HELD-STEADY-empty-held)', () => {
  for (const [cls, w] of Object.entries(HELD)) for (const [speed, running] of RUNS) {
    const lat = { R: [], L: [] };
    play({ ...w, forward: 1, speed, running }, 3, (m) => {
      const mid = pt(m, 'bip01 pelvis')[0];
      lat.R.push(tipOf(m, 'weapon bone', REACH[cls])[0] - mid);
      if (cls === 'dual') lat.L.push(tipOf(m, 'weapon bone left', REACH[cls])[0] - mid);
    });
    for (const side of cls === 'dual' ? ['R', 'L'] : ['R']) {
      assert.ok(range(lat[side]) < 8, `${cls} at ${speed} m/s: the ${side} tip swung ${range(lat[side]).toFixed(1)} units side to side`);
    }
  }
  for (const w of [{}, { weapon: W.HandToHand, hands: 'fists' }]) for (const [speed, running] of RUNS) {
    const yaw = [], hand = { R: [], L: [] };
    play({ ...w, forward: 1, speed, running }, 3, (m) => {
      yaw.push(chestYaw(m));
      for (const side of ['R', 'L']) hand[side].push(pt(m, `bip01 ${side.toLowerCase()} hand`)[0]);
    });
    const name = w.hands ?? 'free';
    assert.ok(range(yaw) > 20, `${name} at ${speed} m/s: the chest turned ${range(yaw).toFixed(1)} degrees across a stride`);
    for (const side of ['R', 'L']) assert.ok(range(hand[side]) > 11, `${name} at ${speed} m/s: the ${side} hand carried ${range(hand[side]).toFixed(1)} units across with the chest`);
  }
});

test('HELD-STEADY A WEAPON IN BOTH HANDS BINDS THE CHEST: at a two-hander\'s run and jog, and a staff\'s and a spear\'s walk, the chest takes under 3 degrees of the stride\'s turn (it turned 24 and 18 across a stride) and the left hand stays on the haft within 1.5 units - held steady while its shoulder rode the chest, it fell 3.2 units off the two-hander\'s hilt and 2.4 off the staff (mutants: HELD-STEADY-chest-unbound, HELD-STEADY-bound-by-the-wrong-hand)', () => {
  for (const [w, gait] of [[HELD.two, { forward: 1, speed: 8.1, running: true }], [HELD.two, { forward: 1, speed: 5.5, running: true }], [HELD.wide, { forward: 1, speed: 4.43 }], [HELD.spear, { forward: 1, speed: 4.43 }]]) {
    const yaw = [];
    let off = 0;
    play({ ...w, ...gait }, 3, (m) => {
      yaw.push(chestYaw(m));
      const g = pt(m, 'weapon bone'), b = bladeOf(m, 'weapon bone'), v = sub(pt(m, 'weapon bone left'), g), k = dot(v, b);
      off = Math.max(off, len(sub(v, [b[0] * k, b[1] * k, b[2] * k])));
    });
    const name = `${w.weapon} at ${gait.speed} m/s`;
    assert.ok(range(yaw) < 3, `${name}: the chest turned ${range(yaw).toFixed(1)} degrees across a stride`);
    assert.ok(off < 1.5, `${name}: the left hand ${off.toFixed(2)} units off the haft`);
  }
});

/** The forearm's turn (degrees, signed): the palm about the forearm against the elbow's hinge - AUDIT BODY-MOTION
 *  CARRY-7's measure, its range 85 to 90 - taken from where the idle arm, hanging palm in, reads it (`zero`). */
function forearmTurn(m, side, zero = null) {
  const s = side.toLowerCase();
  const up = norm(sub(pt(m, `bip01 ${s} forearm`), pt(m, `bip01 ${s} upperarm`))), fo = norm(sub(pt(m, `bip01 ${s} hand`), pt(m, `bip01 ${s} forearm`)));
  const h = norm(cross(up, fo)), ref = side === 'R' ? [-h[0], -h[1], -h[2]] : h;
  const palm = handFrame(m, body.bones[side], side).palm, k = dot(palm, fo);
  const pp = norm([palm[0] - fo[0] * k, palm[1] - fo[1] * k, palm[2] - fo[2] * k]);
  let a = Math.atan2(dot(cross(ref, pp), fo), dot(ref, pp)) / RAD - (zero?.[side] ?? 0);
  if (a > 180) a -= 360; else if (a < -180) a += 360;
  return a;
}
/** The elbow's bend (degrees): the forearm off the upper arm's line. */
const elbowOf = (m, s) => { const u = pt(m, `bip01 ${s} upperarm`), f = pt(m, `bip01 ${s} forearm`), h = pt(m, `bip01 ${s} hand`); const a = norm(sub(f, u)), b = norm(sub(h, f)); return Math.acos(Math.min(1, Math.max(-1, dot(a, b)))) / RAD; };

test('DUAL-RUN THE PAIR\'S RUN, NOT STIFF: both hands behind the hips with the blades trailing behind (Mac\'s "running with them behind you"), the arms pumping - each hand 15 units and more fore and aft over a stride, one forward as the other goes back - the elbows bent 15 degrees and more and bending with the stride, and each forearm turned no more than 75 degrees off its elbow\'s hinge (they stood locked straight, swinging 8.5 units, the forearms turned 128 - past the 85 to 90 AUDIT CARRY-7 holds every run\'s to) (mutants: DUAL-RUN-the-old-row, DUAL-RUN-the-shoulder-square, DUAL-RUN-the-arms-held, DUAL-RUN-the-elbow-still)', () => {
  let zero = null;
  play({}, 1, (m) => { zero = { R: forearmTurn(m, 'R'), L: forearmTurn(m, 'L') }; });
  for (const [speed, running] of RUNS) {
    const fa = { R: [], L: [] }, bend = { R: [], L: [] }, apart = [];
    let behind = Infinity, turn = 0, trail = -Infinity;
    play({ ...HELD.dual, forward: 1, speed, running }, 3, (m) => {
      const pel = pt(m, 'bip01 pelvis');
      for (const side of ['R', 'L']) {
        const s = side.toLowerCase(), h = pt(m, `bip01 ${s} hand`);
        fa[side].push(h[1] - pel[1]);
        bend[side].push(elbowOf(m, s));
        behind = Math.min(behind, pel[1] - h[1]);
        turn = Math.max(turn, Math.abs(forearmTurn(m, side, zero)));
        trail = Math.max(trail, bladeOf(m, side === 'R' ? 'weapon bone' : 'weapon bone left')[1]);
      }
      apart.push((pt(m, 'bip01 r hand')[1] - pel[1]) - (pt(m, 'bip01 l hand')[1] - pel[1]));
    });
    const at = `${speed} m/s`;
    assert.ok(behind > 4, `${at}: a hand came within ${behind.toFixed(1)} units of the hips' front`);
    assert.ok(trail < -0.5, `${at}: a blade pointed ${trail.toFixed(2)} along the facing - not trailing behind`);
    for (const side of ['R', 'L']) {
      assert.ok(range(fa[side]) > 15, `${at}: the ${side} hand swung ${range(fa[side]).toFixed(1)} units fore and aft`);
      assert.ok(Math.min(...bend[side]) > 15 && range(bend[side]) > 2, `${at}: the ${side} elbow bent ${Math.min(...bend[side]).toFixed(1)} to ${Math.max(...bend[side]).toFixed(1)} degrees`);
    }
    assert.ok(Math.min(...apart) < -12 && Math.max(...apart) > 12, `${at}: the hands alternate (one ahead of the other by ${Math.min(...apart).toFixed(1)} to ${Math.max(...apart).toFixed(1)})`);
    assert.ok(turn < 75, `${at}: a forearm turned ${turn.toFixed(1)} degrees off its elbow's hinge`);
  }
});
