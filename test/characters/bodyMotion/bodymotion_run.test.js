// BODY-MOTION, THE RUN (2026-10-19, Mac after the merge of #1025: "the greatsword running doesnt use both hands. The
// running animation with the legs needs to be stiffer. The hands are way too close together when running both in third
// and first person."; bible/04-Characters/Body-Motion.md) - on the vendored retail biped, measured on the solved body.
//
// What is pinned: RUN-STIFF - the run's knee folds less in the swing and the hips ride higher on the standing leg (the
// knee folded 98 degrees past the standing leg's at a run, the hips sank to 0.87 of their standing height); RUN-WIDE -
// the running hands stay on their own sides of the body, as far apart as the walk's at their nearest (the run's crossed
// the middle, 4.3 units apart against the walk's 22). The greatsword's run in both hands (TWO-RUN) is pinned with the
// rest of the two-hander's carry (bodymotion_carry.test.js), the first person's running fists with the rest of the
// Morrowind arm's (test/combat/twohands_mw.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, injectSkeletonNodes, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { MW_WEAPON_TYPE } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { offWeaponBoneAddon } from '../../../src/combat/twoHands/mirrorRig.js';
import { createBodyMotion, sceneInput } from '../../../src/characters/bodyMotion/bodyMotion.js';
import { retailSkeleton } from '../../fixtures/mw/retailRig.mjs';

const sm = (sk, pose, root) => skeletonSpaceMatrices(sk, pose, root);
const file = parseNif(retailSkeleton());
const sk = buildSkeleton(file);
injectSkeletonNodes(sk, offWeaponBoneAddon(sk, GRAPH_ROOT, sm, file));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const deg = (a, b) => Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (len(a) * len(b))))) * 180 / Math.PI;
const pt = (mats, name) => mats.get(sk.byName.get(name)).t;

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
/** A knee's reading: the angle between the thigh's bone and the shin's (the retail bones are not in line even on a
 *  straight leg - the reading is taken against the standing body's own). */
const knee = (m, s) => { const th = pt(m, `bip01 ${s} thigh`), ca = pt(m, `bip01 ${s} calf`), fo = pt(m, `bip01 ${s} foot`); return deg(sub(ca, th), sub(fo, ca)); };

/** A run's legs: the knees' deepest fold past the standing body's (the swing's - the heel kicked up behind) and the
 *  hips' lowest as a share of their standing height (how far the standing leg gives under them). */
function legs(speed) {
  let rest = 0, standHips = 0;
  play({}, 1, (m) => { rest = knee(m, 'l'); standHips = pt(m, 'bip01 pelvis')[2]; });
  let fold = 0, hips = Infinity;
  play({ forward: 1, speed, running: true }, 3, (m) => {
    hips = Math.min(hips, pt(m, 'bip01 pelvis')[2]);
    for (const s of ['l', 'r']) fold = Math.max(fold, knee(m, s) - rest);
  });
  return { fold, hips: hips / standHips };
}

test('RUN-STIFF THE RUN\'S LEGS: at a run and a jog the knee folds under 65 degrees past the standing leg\'s (it folded 98 at a run, 87 at a jog - the heel kicked to the seat) and the hips ride at 0.92 of their standing height or over (they sank to 0.87 and 0.88 on a bent knee) (mutants: RUN-STIFF-the-swing-kicks, RUN-STIFF-the-run-sinks)', () => {
  for (const speed of [8.1, 5.5]) {
    const r = legs(speed);
    assert.ok(r.fold < 65, `${speed} m/s: the knee folded ${r.fold.toFixed(1)} degrees`);
    assert.ok(r.hips >= 0.92, `${speed} m/s: the hips sank to ${r.hips.toFixed(3)} of their standing height`);
  }
});

/** The hands across the body over a gait's last second: the nearest they come to each other across it, and the nearest
 *  each comes to the body's middle on its own side (- past it). */
function handsAcross(scene) {
  let across = Infinity, own = Infinity;
  play(scene, 3, (m) => {
    const mid = pt(m, 'bip01 pelvis')[0], r = pt(m, 'bip01 r hand')[0] - mid, l = mid - pt(m, 'bip01 l hand')[0];
    across = Math.min(across, r + l);
    own = Math.min(own, r, l);
  });
  return { across, own };
}

test('RUN-WIDE THE RUNNING HANDS APART: at a run, empty-handed and with the fists, each hand stays on its own side of the body\'s middle and the two come no nearer each other across it than the walk\'s do, less a tenth (they crossed the middle - 4.3 units apart, the fists 3.5, the walk\'s 22) (mutants: RUN-WIDE-the-forearm-turned-in, RUN-WIDE-the-arm-held-in)', () => {
  const walk = handsAcross({ forward: 1, speed: 4.43 });
  for (const [name, scene] of [['free', {}], ['fists', { weapon: MW_WEAPON_TYPE.HandToHand, hands: 'fists' }]]) {
    for (const speed of [8.1, 5.5]) {
      const run = handsAcross({ ...scene, forward: 1, speed, running: true });
      assert.ok(run.own > 2, `${name} at ${speed} m/s: a hand came ${run.own.toFixed(1)} units from the middle on its own side`);
      assert.ok(run.across > 0.9 * walk.across, `${name} at ${speed} m/s: the hands ${run.across.toFixed(1)} units apart at their nearest (the walk's ${walk.across.toFixed(1)})`);
    }
  }
});
