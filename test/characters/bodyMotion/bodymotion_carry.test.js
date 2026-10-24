// BODY-MOTION (2026-10-18, Mac: "Weapon specific walking/running animations ... (running with a 2 hander by the hip)
// (1 hand idle animation, holding down away from side. Running with it using the same format) (Duelhand idle away from
// sides, running with them behind you) - Improved melee 3rd person attack animations"; bible/04-Characters/
// Body-Motion.md) - THE CARRY, THE BLOWS AND THE WIRING, on the vendored retail biped with the pair's Weapon Bone Left
// made as the build makes it (combat/twoHands/mirrorRig.js offWeaponBoneAddon).
//
// What is pinned: every weapon type and hands mode to its carry class; the stances Mac named, measured on the solved
// body - a one-hander held down and away from the side, its run in the same format with the blade trailing; a two-hander
// in both hands at rest and at the hip at a run, its blade behind; a pair held away from both sides as mirror images and
// swept behind at a run; a bow and a spell left to the clip's arms; the blow's clock read off the machine's sections; a
// slash from the right, through the front on the hit with its edge leading, out to the left; a left-hand blow the
// right's mirror; a two-hander's left hand kept on the haft through a blow; the legs still walking under a blow (the
// recorded gap of rule 26, closed); and the wiring - the rig's word gated by the view, the skeleton, the creature and the
// switch, and the source pins on fpArm.js and poseAssembly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, injectSkeletonNodes, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { MW_WEAPON_TYPE, MW_UNITS_PER_METER } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { offWeaponBoneAddon } from '../../../src/combat/twoHands/mirrorRig.js';
import { bodyOf, frac } from '../../../src/characters/bodyMotion/bodyKit.js';
import { carryClassOf, CARRY, TWO_HAND_GRIP, TWO_HAND_HAFT, armByAngles } from '../../../src/characters/bodyMotion/carry.js';
import { U, blowU, blowPose, meleeFamilyOf, blowName } from '../../../src/characters/bodyMotion/melee.js';
import { createBodyMotion, sceneInput, motionWord } from '../../../src/characters/bodyMotion/bodyMotion.js';
import { bodyFrames } from '../../../src/characters/bodyMotion/bodySolve.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { retailSkeleton } from '../../fixtures/mw/retailRig.mjs';

const sm = (sk, pose, root) => skeletonSpaceMatrices(sk, pose, root);
const file = parseNif(retailSkeleton());
const sk = buildSkeleton(file);
injectSkeletonNodes(sk, offWeaponBoneAddon(sk, GRAPH_ROOT, sm, file));
const body = bodyOf(sk, GRAPH_ROOT, sm);
const A = body.arm;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const RAD = Math.PI / 180;
const deg = (a, b) => Math.acos(Math.min(1, Math.max(-1, dot(norm(a), norm(b))))) / RAD;
const pt = (mats, name) => mats.get(sk.byName.get(name)).t;
/** The blade's way (the bone's +Y) and the true edge's (its +X) of a Weapon Bone in `mats`. */
const blade = (mats, name) => { const a = mats.get(sk.byName.get(name)).a; const s = Math.hypot(a[1], a[4], a[7]); return [a[1] / s, a[4] / s, a[7] / s]; };
const edge = (mats, name) => { const a = mats.get(sk.byName.get(name)).a; const s = Math.hypot(a[0], a[3], a[6]); return [a[0] / s, a[3] / s, a[6] / s]; };

/** The motion stepped and posed `seconds` at 60 Hz on a pose that starts at the rest each frame (the clip's stand-in);
 *  `each(mats, motion, t)` sees every frame. Answers the last frame's matrices and the motion. */
function play(scene, seconds, each = null, motion = createBodyMotion(), t0 = 0) {
  const dt = 1 / 60;
  let mats = null;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    const t = t0 + i * dt;
    motion.step(dt, sceneInput(typeof scene === 'function' ? scene(t) : scene));
    const pose = new Map();
    motion.apply(sk, pose, GRAPH_ROOT, sm);
    mats = sm(sk, pose, GRAPH_ROOT);
    if (each) each(mats, motion, t);
  }
  return { mats, motion };
}
/** The chest's frame of `mats` (bodySolve.js bodyFrames). */
const frameOf = (mats) => bodyFrames(body, mats);

test('BODY-MOTION THE CLASSES: each weapon type and hands mode to the carry it is held in - nothing in hand free, the one-handers one, the two-handers two, the staff wide, the spear spear, a pair dual, bare fists up fists, and a bow, a crossbow, a thrown weapon and a readied spell to the clip\'s own arms; a two-hander\'s left hand closes two fifths of an arm down the haft, a staff\'s and a spear\'s half an arm up it (mutants: BODY-MOTION-axe-two-as-one, BODY-MOTION-spell-carried, BODY-MOTION-two-grip-spacing)', () => {
  const T = MW_WEAPON_TYPE;
  const rows = [
    [{}, 'free'], [{ mwType: T.LongBladeOneHand, shown: false }, 'free'],
    [{ mwType: T.ShortBladeOneHand, shown: true }, 'one'], [{ mwType: T.LongBladeOneHand, shown: true }, 'one'],
    [{ mwType: T.BluntOneHand, shown: true }, 'one'], [{ mwType: T.AxeOneHand, shown: true }, 'one'],
    [{ mwType: T.LongBladeTwoHand, shown: true }, 'two'], [{ mwType: T.BluntTwoClose, shown: true }, 'two'], [{ mwType: T.AxeTwoHand, shown: true }, 'two'],
    [{ mwType: T.BluntTwoWide, shown: true }, 'wide'], [{ mwType: T.SpearTwoWide, shown: true }, 'spear'],
    [{ mwType: T.LongBladeOneHand, shown: true, hands: 'dual' }, 'dual'], [{ mwType: T.HandToHand, shown: true }, 'fists'],
    [{ mwType: T.None, shown: true, hands: 'fists' }, 'fists'], [{ mwType: T.None, shown: true }, 'fists'],   // AUDIT BODY-MOTION MELEE-3: a peer's, a person's bare hands (and the player's beside a shield or a light) - 'single'
    [{ mwType: T.MarksmanBow, shown: true }, 'clip'], [{ mwType: T.MarksmanCrossbow, shown: true }, 'clip'], [{ mwType: T.MarksmanThrown, shown: true }, 'clip'],
    [{ mwType: T.LongBladeOneHand, shown: true, spell: true }, 'clip'],
  ];
  assert.deepEqual(rows.map(([w]) => carryClassOf(w)), rows.map(([, c]) => c));
  assert.deepEqual(['one', 'dual', 'two', 'wide', 'spear', 'fists', 'free', 'clip'].map(meleeFamilyOf), ['one', 'one', 'two', 'two', 'two', 'fists', null, null]);
  assert.deepEqual({ ...TWO_HAND_GRIP }, { two: -0.4, wide: 0.5, spear: 0.55 });   // PIN MOVED (AUDIT BODY-MOTION CARRY-1): a fifth down, the left fist sat inside the right forearm
  assert.equal(blowName('slash', true), 'back');
  assert.equal(blowName('chop', true), 'chop');
});

test('BODY-MOTION THE ARM BY ITS ANGLES: hanging, flexed forward, held out and bent at the elbow on the chest\'s own frame - the wrist where the joints put it, the elbow behind the forearm\'s bend (mutants: BODY-MOTION-flex-backward, BODY-MOTION-abduct-inward, BODY-MOTION-elbow-backward)', () => {
  const F = { right: [1, 0, 0], fwd: [0, 1, 0], up: [0, 0, 1] };
  const hang = armByAngles('R', [0, 0, 0], F, 10, 10, {});
  assert.deepEqual(hang.wrist.map((v) => Math.round(v * 1e6) / 1e6), [0, 0, -20]);
  const fwd = armByAngles('R', [0, 0, 0], F, 10, 10, { flex: 90 });
  assert.ok(fwd.wrist[1] > 19.9, 'flexed 90: straight ahead');
  const out = armByAngles('R', [0, 0, 0], F, 10, 10, { abduct: 90 });
  assert.ok(out.wrist[0] > 19.9, 'the right arm out to the right');
  assert.ok(armByAngles('L', [0, 0, 0], F, 10, 10, { abduct: 90 }).wrist[0] < -19.9, 'the left to the left');
  const bent = armByAngles('R', [0, 0, 0], F, 10, 10, { elbow: 90 });
  assert.ok(bent.wrist[1] > 9.9 && Math.abs(bent.wrist[2] + 10) < 1e-6, 'the elbow bends the forearm forward');
  assert.ok(bent.pole[1] < -0.65 && bent.pole[2] < -0.65, 'and the elbow points back and down, off the shoulder-to-wrist line');
  const inward = armByAngles('R', [0, 0, 0], F, 10, 10, { elbow: 90, twist: 45 });
  assert.ok(inward.wrist[0] < -5, 'the inward twist turns the forearm toward the middle');
});

test('BODY-MOTION A ONE-HANDER, HELD DOWN AND AWAY FROM THE SIDE (Mac\'s stance): the hand low by the thigh and out from it, the blade forward and down and out; running "in the same format" - the arm still low and out, the blade trailing behind and down - the free arm swinging (mutants: BODY-MOTION-one-idle-blade, BODY-MOTION-one-run-blade, BODY-MOTION-carry-weapon-unturned)', () => {
  const idle = play({ weapon: MW_WEAPON_TYPE.LongBladeOneHand }, 1.5).mats;
  const F = frameOf(idle);
  const wrist = pt(idle, 'bip01 r hand'), shoulder = pt(idle, 'bip01 r upperarm'), thigh = pt(idle, 'bip01 r thigh');
  assert.ok(shoulder[2] - wrist[2] > 0.75 * A, 'held down');
  assert.ok(wrist[0] - thigh[0] > 0.3 * A, `away from the side (${((wrist[0] - thigh[0]) / A).toFixed(2)} arms out from the hip)`);
  const b = blade(idle, 'weapon bone');
  assert.ok(deg(b, [F.right, F.fwd, F.up].reduce((acc, axis, i) => acc.map((v, k) => v + axis[k] * CARRY.one.idle.R.blade[i]), [0, 0, 0])) < 4, 'the blade where its row says');
  assert.ok(b[1] > 0.5 && b[2] < -0.4 && b[0] > 0.1, `forward, down and out (${b.map((v) => v.toFixed(2))})`);
  // running
  const runB = [], runOut = [], freeSwing = [];
  // PIN MOVED (AUDIT BODY-MOTION CARRY-4/6): the carry's gait shares follow the gait's on a spring now, the blade brought
  // round the outside of the body - the last hundredth of the run's share comes in after the first second, from above
  play({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, forward: 1, speed: 8.1, running: true }, 2.2, (m, mo, t) => {
    if (t < 1.2) return;
    runB.push(blade(m, 'weapon bone'));
    runOut.push(pt(m, 'bip01 r hand')[0] - pt(m, 'bip01 r thigh')[0]);
    freeSwing.push(pt(m, 'bip01 l hand')[1]);
  });
  assert.ok(runB.every((v) => v[1] < -0.2 && v[2] < -0.5), 'running: the blade trails behind and down');
  assert.ok(Math.min(...runOut) > 0.2 * A, 'the arm still out from the side');
  assert.ok(Math.max(...freeSwing) - Math.min(...freeSwing) > 0.5 * A, 'the free arm swings');
});

test('BODY-MOTION A TWO-HANDER: at rest a low guard with both hands on the grip (the left on the haft toward the pommel - AUDIT BODY-MOTION CARRY-NIT: it said below); at a run carried at the hip (Mac: "running with a 2 hander by the hip") in BOTH hands - TWO-RUN, Mac after the merge: "the greatsword running doesnt use both hands", then "held lower at the hip, but not attached to the hip" - the grip low by the hip, under its joint by more than a twentieth of a leg (it stood 0.02 to 0.06 under), held clear of the thigh by 7 units and ahead of the hip by 4 (it stood 5 off the thigh and beside the hip), the blade trailing behind and down, the left hand on the hilt toward the pommel and the chest turned toward the weapon to reach it (mutants: BODY-MOTION-haft-hand-unplaced, BODY-MOTION-two-run-at-the-chest, TWO-RUN-the-left-lets-go, TWO-RUN-the-chest-square, TWO-RUN-the-arms-swing, TWO-RUN-held-against-the-hip, TWO-RUN-the-chest-upright)', () => {
  const idle = play({ weapon: MW_WEAPON_TYPE.LongBladeTwoHand }, 1.5).mats;
  const grip = pt(idle, 'weapon bone'), b = blade(idle, 'weapon bone');
  const haft = [grip[0] + b[0] * TWO_HAND_GRIP.two * A, grip[1] + b[1] * TWO_HAND_GRIP.two * A, grip[2] + b[2] * TWO_HAND_GRIP.two * A];
  // the left hand's grip point: where its fist closes - the left Weapon Bone's origin (the mirror of the right's)
  assert.ok(len(sub(pt(idle, 'weapon bone left'), haft)) < 0.12 * A, `the left hand closed on the haft (${(len(sub(pt(idle, 'weapon bone left'), haft)) / A).toFixed(2)} arms off)`);
  assert.ok(b[1] > 0.5 && b[2] < -0.3, 'a low guard: the blade forward and down');
  const hipZ = [], blades = [], off = [], along = [], facing = [], clear = [], ahead = [];
  const toSeg = (a, b, p) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return len(sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])); };
  for (const speed of [8.1, 5.5]) {
    play({ weapon: MW_WEAPON_TYPE.LongBladeTwoHand, forward: 1, speed, running: true }, 2, (m, mo, t) => {
      if (t < 1.2) return;
      hipZ.push(pt(m, 'weapon bone')[2] - pt(m, 'bip01 r thigh')[2]);
      const b = blade(m, 'weapon bone'), v = sub(pt(m, 'weapon bone left'), pt(m, 'weapon bone')), k = dot(v, b);
      blades.push(b);
      off.push(len(sub(v, [b[0] * k, b[1] * k, b[2] * k])));
      along.push(k / A);
      facing.push(frameOf(m).fwd[0]);
      const g = pt(m, 'weapon bone'), hip = pt(m, 'bip01 r thigh');
      clear.push(toSeg(hip, pt(m, 'bip01 r calf'), g) - 6.5);   // the thigh as a capsule (the audit's radius)
      ahead.push(g[1] - hip[1]);
    });
  }
  assert.ok(hipZ.every((z) => Math.abs(z) < 0.3 * body.leg), `the grip at the hip (${hipZ.map((z) => (z / body.leg).toFixed(2)).slice(0, 4)})`);
  assert.ok(Math.max(...hipZ) < -0.05 * body.leg, `held low: the grip at most ${(Math.max(...hipZ) / body.leg).toFixed(3)} of a leg under the hip joint`);
  assert.ok(Math.min(...clear) > 7, `held off the hip: the grip ${Math.min(...clear).toFixed(1)} units off the thigh at its nearest`);
  assert.ok(Math.min(...ahead) > 4, `held ahead of the hip: ${Math.min(...ahead).toFixed(1)} units at its least`);
  assert.ok(blades.every((v) => v[1] < -0.55 && v[2] < -0.25), 'the blade trailing behind and down');
  assert.ok(Math.max(...off) < 1.5, `the left hand on the hilt: at most ${Math.max(...off).toFixed(2)} units off the blade's line (it let go and swung)`);
  assert.ok(along.every((a) => a >= TWO_HAND_HAFT.two[0] - 0.02 && a <= TWO_HAND_HAFT.two[1] + 0.02), `toward the pommel, on the hilt (${Math.min(...along).toFixed(2)} to ${Math.max(...along).toFixed(2)} arm lengths)`);
  assert.ok(facing.reduce((a, x) => a + x, 0) / facing.length > Math.sin(15 * RAD), 'the chest turned toward the weapon, to the right');
});

test('BODY-MOTION A PAIR: at rest both held down and away from the sides as mirror images across the body\'s middle, both blades forward and down; at a run both swept behind the body, the blades trailing (Mac: "Duelhand idle away from sides, running with them behind you") (mutants: BODY-MOTION-pair-left-unmirrored, BODY-MOTION-pair-run-forward)', () => {
  const idle = play({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, hands: 'dual' }, 1.5).mats;
  const R = pt(idle, 'bip01 r hand'), L = pt(idle, 'bip01 l hand');
  const mid = (pt(idle, 'bip01 l upperarm')[0] + pt(idle, 'bip01 r upperarm')[0]) / 2;
  assert.ok(Math.abs((R[0] - mid) + (L[0] - mid)) < 0.05 * A && Math.abs(R[1] - L[1]) < 0.05 * A && Math.abs(R[2] - L[2]) < 0.05 * A, 'the hands mirror images');
  const bR = blade(idle, 'weapon bone'), bL = blade(idle, 'weapon bone left');
  assert.ok(Math.abs(bR[0] + bL[0]) < 0.05 && Math.abs(bR[1] - bL[1]) < 0.05 && Math.abs(bR[2] - bL[2]) < 0.05, `the blades mirror images (${bR.map((v) => v.toFixed(2))} / ${bL.map((v) => v.toFixed(2))})`);
  assert.ok(R[0] - pt(idle, 'bip01 r thigh')[0] > 0.3 * A && pt(idle, 'bip01 l thigh')[0] - L[0] > 0.3 * A, 'both away from the sides');
  const behind = [];
  play({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, hands: 'dual', forward: 1, speed: 8.1, running: true }, 2, (m, mo, t) => {
    if (t < 1.2) return;
    const s = (pt(m, 'bip01 l upperarm')[1] + pt(m, 'bip01 r upperarm')[1]) / 2;
    behind.push([pt(m, 'bip01 r hand')[1] - s, pt(m, 'bip01 l hand')[1] - s, blade(m, 'weapon bone')[1], blade(m, 'weapon bone left')[1]]);
  });
  assert.ok(behind.every(([r, l]) => r < -0.4 * A && l < -0.4 * A), 'both hands behind the shoulders');
  assert.ok(behind.every(([, , br, bl]) => br < -0.6 && bl < -0.6), 'both blades trailing');
});

test('BODY-MOTION THE CLIP KEEPS WHAT IT CARRIES: a bow and the draw leave the arms to the clip (the layer\'s arms at no weight), a lit torch the left arm and the right still the carry\'s, and a shield the left arm with a one-hander drawn or the weapon sheathed - standing and at a run, where the free run\'s pump swung it up behind the head (SHIELD-RUN, the Discord: "sprinting with my mace and shield out just makes me look incredibly stupid") - but not with fists drawn, which hide it (a spell, and the trunk under the clip\'s arms: AUDIT BODY-MOTION RIG-4\'s pin) (mutants: BODY-MOTION-torch-arm-taken, BODY-MOTION-equip-arms-taken, SHIELD-RUN-the-shield-pumped, SHIELD-RUN-fists-lose-the-guard)', () => {
  const rest = sm(sk, new Map(), GRAPH_ROOT);
  const still = (scene, side) => len(sub(play(scene, 1.2).mats.get(sk.byName.get(`bip01 ${side} hand`)).t, rest.get(sk.byName.get(`bip01 ${side} hand`)).t));
  assert.ok(still({ weapon: MW_WEAPON_TYPE.MarksmanBow }, 'r') < 3 && still({ weapon: MW_WEAPON_TYPE.MarksmanBow }, 'l') < 3, 'a bow: the clip\'s arms (the hands where the trunk carries them)');
  assert.ok(still({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, equip: true }, 'r') < 3, 'the draw: the clip\'s');
  assert.ok(still({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, torch: true }, 'l') < 3, 'a torch: the clip\'s left arm');
  assert.ok(still({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, torch: true }, 'r') > 3, 'and the right still the carry\'s');
  for (const scene of [{ weapon: MW_WEAPON_TYPE.BluntOneHand, shield: true }, { shield: true }]) {
    assert.ok(still(scene, 'l') < 3, `a shield (${scene.weapon ? 'a mace drawn' : 'sheathed'}): the clip's left arm`);
  }
  assert.ok(still({ weapon: MW_WEAPON_TYPE.BluntOneHand, shield: true }, 'r') > 3, 'and the mace\'s arm still the carry\'s');
  assert.ok(still({ weapon: MW_WEAPON_TYPE.HandToHand, hands: 'fists', shield: true }, 'l') > 3, 'fists drawn hide the shield: the guard keeps both arms');
  // at a run: the layer writes no bone of the shield's arm (the free run's pump stood its Shield Bone 10 units under the head)
  let written = 0;
  const runner = createBodyMotion();
  for (let i = 0; i < 120; i++) {
    runner.step(1 / 60, sceneInput({ weapon: MW_WEAPON_TYPE.BluntOneHand, shield: true, forward: 1, speed: 8.1, running: true }));
    const pose = new Map();
    runner.apply(sk, pose, GRAPH_ROOT, sm);
    if (i > 60) for (const bone of ['bip01 l upperarm', 'bip01 l forearm', 'bip01 l hand']) if (pose.has(sk.byName.get(bone))) written++;
  }
  assert.equal(written, 0, 'running with a mace and a shield, the left arm is the clip\'s');
});

test('BODY-MOTION THE BLOW\'S CLOCK is the machine\'s: the wind-up spans u 0..U.windup, the release ends ON U.hit (the blade meets the target on the frame Daggerfall deals the blow), the follow runs out to 1 - each section monotonic (mutants: BODY-MOTION-release-misses-the-hit, BODY-MOTION-windup-unfinished)', () => {
  assert.equal(blowU('windup', 0), 0);
  assert.equal(blowU('windup', 1), U.windup);
  assert.equal(blowU('release', 0), U.windup);
  assert.equal(blowU('release', 1), U.hit);
  assert.equal(blowU('follow', 0), U.hit);
  assert.equal(blowU('follow', 1), 1);
  for (const sec of ['windup', 'release', 'follow']) {
    let last = -1;
    for (let p = 0; p <= 1; p += 0.05) { const u = blowU(sec, p); assert.ok(u >= last); last = u; }
  }
  const bp = blowPose('one', 'slash', 0, 'R');
  assert.ok(bp.w < 0.01, 'a blow starts on the carry');
  assert.ok(blowPose('one', 'slash', U.hit, 'R').w > 0.99, 'and owns the arm at the hit');
  assert.ok(blowPose('one', 'slash', 1, 'R').w < 0.01, 'and ends on it');
});

/** One blow on the body: windup, release, follow over `seconds`, sampled at u - the right-hand grip and blade. */
function strike(scene, blow, at = []) {
  const motion = createBodyMotion();
  play(scene, 1, null, motion);   // the stance held first
  const seen = {};
  const T = 0.9, wEnd = 0.3, rEnd = 0.45;
  const dt = 1 / 60;
  for (let i = 0; i <= Math.round(T / dt); i++) {
    const t = i * dt;
    const section = t < wEnd ? 'windup' : t < rEnd ? 'release' : 'follow';
    const progress = section === 'windup' ? t / wEnd : section === 'release' ? (t - wEnd) / (rEnd - wEnd) : Math.min(1, (t - rEnd) / (T - rEnd));
    motion.step(dt, sceneInput({ ...(typeof scene === 'function' ? scene(t) : scene), blow: { ...blow, section, progress, strength: 1 } }));
    const pose = new Map();
    motion.apply(sk, pose, GRAPH_ROOT, sm);
    const mats = sm(sk, pose, GRAPH_ROOT);
    const u = blowU(section, progress);
    for (const want of at) if (seen[want] == null && u >= want - 1e-9) seen[want] = mats;
  }
  return seen;
}

test('BODY-MOTION A SLASH WITH THE WHOLE BODY: wound up to the right and behind with the chest turned right; on the hit the blade out in front with its true edge leading the sweep (to the left); followed through out to the left with the chest turned left (mutants: BODY-MOTION-slash-hit-behind, BODY-MOTION-slash-edge-trailing, BODY-MOTION-blow-chest-unturned)', () => {
  const seen = strike({ weapon: MW_WEAPON_TYPE.LongBladeOneHand }, { type: 'slash', reversed: false, hand: 'R' }, [U.windup, U.hit, 0.68]);
  const wind = seen[U.windup], hit = seen[U.hit], follow = seen[0.68];
  const chestYaw = (m) => { const F = frameOf(m); return Math.atan2(F.right[1], F.right[0]) / RAD; };
  assert.ok(pt(wind, 'weapon bone')[0] > 0.5 * A && blade(wind, 'weapon bone')[1] < -0.5, 'wound up: the grip out to the right, the blade behind');
  assert.ok(chestYaw(wind) < -20, `the chest turned right (${chestYaw(wind).toFixed(1)})`);
  const sh = (pt(hit, 'bip01 l upperarm')[1] + pt(hit, 'bip01 r upperarm')[1]) / 2;
  assert.ok(pt(hit, 'weapon bone')[1] - sh > 0.5 * A && blade(hit, 'weapon bone')[1] > 0.85, 'on the hit: in front, the blade out ahead');
  assert.ok(edge(hit, 'weapon bone')[0] < -0.7, 'its true edge leading the sweep to the left');
  assert.ok(pt(follow, 'weapon bone')[0] < 0 && chestYaw(follow) > 15, 'followed through to the left, the chest turned left');
});

test('BODY-MOTION THE OTHER BLOWS: the chop wound up by the head, its blade up, and down through the front; the thrust driven straight out ahead from its wind-up; the backhand wound up across the body to the left and swept out to the right with its edge leading (mutants: BODY-MOTION-chop-from-below, BODY-MOTION-thrust-short, BODY-MOTION-backhand-the-forehand)', () => {
  const chop = strike({ weapon: MW_WEAPON_TYPE.LongBladeOneHand }, { type: 'chop', hand: 'R' }, [U.windup, 0.68]);
  assert.ok(pt(chop[U.windup], 'weapon bone')[2] > pt(chop[U.windup], 'bip01 head')[2] - 0.2 * A, 'the chop wound up by the head');
  assert.ok(blade(chop[U.windup], 'weapon bone')[2] > 0.4, 'the blade up');
  assert.ok(blade(chop[0.68], 'weapon bone')[2] < -0.7, 'and down through the front');
  const thrust = strike({ weapon: MW_WEAPON_TYPE.LongBladeOneHand }, { type: 'thrust', hand: 'R' }, [U.windup, U.hit]);
  const reach = (m) => pt(m, 'weapon bone')[1] - pt(m, 'bip01 r upperarm')[1];
  assert.ok(reach(thrust[U.hit]) - reach(thrust[U.windup]) > 0.8 * A, 'the thrust driven out');
  assert.ok(blade(thrust[U.hit], 'weapon bone')[1] > 0.95, 'straight ahead');
  const back = strike({ weapon: MW_WEAPON_TYPE.LongBladeOneHand }, { type: 'slash', reversed: true, hand: 'R' }, [U.windup, U.hit, 0.68]);
  assert.ok(pt(back[U.windup], 'weapon bone')[0] < 0, 'the backhand wound up across to the left');
  assert.ok(edge(back[U.hit], 'weapon bone')[0] > 0.7, 'its edge leading to the right');
  assert.ok(pt(back[0.68], 'weapon bone')[0] > 0.5 * A, 'out to the right');
});

test('BODY-MOTION THE LEFT HAND\'S BLOW: a pair\'s left blade\'s is the right\'s mirror, its grip and its blade (its trunk: bodymotion_claims.test.js); a two-hander\'s left hand stays on the haft through the whole blow (mutants: BODY-MOTION-left-blow-unmirrored, BODY-MOTION-two-blow-haft-dropped)', () => {
  const r = strike({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, hands: 'dual' }, { type: 'slash', hand: 'R' }, [U.windup, U.hit]);
  const l = strike({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, hands: 'dual' }, { type: 'slash', hand: 'L' }, [U.windup, U.hit]);
  for (const u of [U.windup, U.hit]) {
    const gr = pt(r[u], 'weapon bone'), gl = pt(l[u], 'weapon bone left');
    assert.ok(Math.abs(gr[0] + gl[0]) < 0.12 * A && Math.abs(gr[1] - gl[1]) < 0.12 * A && Math.abs(gr[2] - gl[2]) < 0.12 * A, `at u ${u} the left grip the right's mirror (${gr.map((v) => v.toFixed(1))} / ${gl.map((v) => v.toFixed(1))})`);
    const br = blade(r[u], 'weapon bone'), bl = blade(l[u], 'weapon bone left');
    assert.ok(Math.abs(br[0] + bl[0]) < 0.12 && Math.abs(br[1] - bl[1]) < 0.12, `and its blade too (u ${u})`);
  }
  const two = strike({ weapon: MW_WEAPON_TYPE.LongBladeTwoHand }, { type: 'slash', hand: 'R' }, [0.15, U.windup, 0.4, U.hit, 0.68]);
  for (const [u, m] of Object.entries(two)) {
    const grip = pt(m, 'weapon bone'), b = blade(m, 'weapon bone');
    const haft = [grip[0] + b[0] * TWO_HAND_GRIP.two * A, grip[1] + b[1] * TWO_HAND_GRIP.two * A, grip[2] + b[2] * TWO_HAND_GRIP.two * A];
    assert.ok(len(sub(pt(m, 'weapon bone left'), haft)) < 0.15 * A, `u ${u}: the left hand on the haft`);
  }
});

test('BODY-MOTION THE LEGS KEEP WALKING UNDER A BLOW (rule 26\'s gap, closed): mid-swing while walking, each foot still strides where the gait puts it - the planted foot still stands still in the world (mutants: BODY-MOTION-blow-stops-the-legs)', () => {
  const motion = createBodyMotion();
  const walk = { weapon: MW_WEAPON_TYPE.LongBladeOneHand, forward: 1, speed: 3 };
  play(walk, 1.5, null, motion);
  let travel = 0, worst = 0, n = 0;
  const planted = { L: null, R: null };
  const dt = 1 / 240;
  for (let i = 0; i < 0.6 / dt; i++) {
    const t = i * dt;
    motion.step(dt, sceneInput({ ...walk, blow: { type: 'slash', hand: 'R', section: t < 0.2 ? 'windup' : t < 0.3 ? 'release' : 'follow', progress: t < 0.2 ? t / 0.2 : t < 0.3 ? (t - 0.2) / 0.1 : (t - 0.3) / 0.3, strength: 1 } }));
    const pose = new Map();
    motion.apply(sk, pose, GRAPH_ROOT, sm);
    const mats = sm(sk, pose, GRAPH_ROOT);
    travel += 3 * dt * MW_UNITS_PER_METER;
    const st = motion.status();
    for (const side of ['L', 'R']) {
      const u = frac(st.phase - (side === 'L' ? 0 : 0.5));
      const flat = u > 0.15 && u < 0.3;   // inside the flat of a walk's stance at this pace
      if (!flat) { planted[side] = null; continue; }
      const a = pt(mats, `bip01 ${side.toLowerCase()} foot`);
      const world = [a[0], a[1] + travel, a[2]];
      if (!planted[side]) planted[side] = world; else { worst = Math.max(worst, len(sub(world, planted[side]))); n++; }
    }
  }
  assert.ok(n > 20, `planted frames seen (${n})`);
  assert.ok(worst < 0.03 * body.leg, `the planted foot stood (${worst.toFixed(3)} units)`);
});

test('BODY-MOTION SWITCHED BACK ON (third person again, the switch thrown) with the heading moved while it was off: no step and no bank from a stale heading read as one frame\'s turn - however far it moved (mutants: BODY-MOTION-stale-heading)', () => {
  const motion = createBodyMotion();
  play({}, 1, null, motion);
  for (let i = 0; i < 30; i++) motion.step(1 / 60, sceneInput({ on: false, yaw: 0 }));
  let worstBank = 0, stepped = null;
  play({ yaw: 1.1 }, 0.5, (m, mo) => { worstBank = Math.max(worstBank, Math.abs(mo.status().bank)); stepped = stepped ?? mo.status().stepping; }, motion);
  assert.equal(stepped, null, 'no step');
  assert.ok(worstBank < 1e-3, `no bank (${worstBank})`);
  // PIN ADDED (AUDIT BODY-MOTION, the author's pass): a heading moved that far is a snap - the feet re-planted however
  // the state stood - so a turn too small to snap, from a walk, is the stale state's tell (kept, it banked and stepped)
  const again = createBodyMotion();
  play({ forward: 1, speed: 4.43 }, 1, null, again);
  for (let i = 0; i < 30; i++) again.step(1 / 60, sceneInput({ on: false, yaw: 0 }));
  let bank = 0, step = null;
  play({ yaw: 0.12 }, 0.5, (m, mo) => { bank = Math.max(bank, Math.abs(mo.status().bank)); step = step ?? mo.status().stepping; }, again);
  assert.equal(step, null, 'a small turn while off: no step');
  assert.ok(bank < 1e-3, `a small turn while off: no bank (${bank})`);
});

test('BODY-MOTION THE RIG\'S WORD: on only in third person, on a base_anim skeleton (male, female, beast), never a creature\'s or a werewolf\'s body, and only while the switch is on; the word naming the body the clip\'s while dead, recoiling, climbing or seated (the layer stepping aside for it: bodymotion_claims.test.js DOC-9); the machine\'s upper-body state its blow\'s section; a shield read off the pieces the body wears (SHIELD-RUN) (mutants: BODY-MOTION-on-in-first-person, BODY-MOTION-creature-walked, BODY-MOTION-switch-ignored, BODY-MOTION-section-misnamed, SHIELD-RUN-no-shield-seen)', () => {
  const rig = { ok: true, settingsSkeleton: 'meshes/base_anim_female.nif', mwType: MW_WEAPON_TYPE.LongBladeOneHand };
  const cam = { yaw: 0.4, move: { forward: 1, strafe: 0, speed: 4, running: true, grounded: true } };
  const base = { cam, third: true, rig, built: { raceScale: { height: 1.1, weight: 0.9 } } };
  const w = motionWord(base);
  assert.equal(w.on, true);
  assert.equal(w.kind, 'female');
  assert.deepEqual([w.speed, w.forward, w.running, w.yaw, w.height, w.weight], [4, 1, true, 0.4, 1.1, 0.9]);
  assert.equal(motionWord({ ...base, third: false }).on, false, 'first person: off');
  assert.equal(motionWord({ ...base, built: { creature: { bipedal: true } } }).on, false, 'a creature: off');
  assert.equal(motionWord({ ...base, built: { werewolf: true } }).on, false, 'a werewolf: off');
  assert.equal(motionWord({ ...base, rig: { ...rig, settingsSkeleton: 'meshes/r/xskeleton.nif' } }).on, false, 'not a base_anim skeleton: off');
  try {
    setPref('mwBodyMotion', false);
    assert.equal(motionWord(base).on, false, 'the switch off: off');
  } finally { setPref('mwBodyMotion', true); }
  assert.deepEqual(['dead', 'hit'].map((k) => motionWord({ ...base, [k]: true }).busy), ['dead', 'hit']);
  assert.equal(motionWord({ ...base, climb: 0.5 }).busy, 'climb');
  assert.equal(motionWord({ ...base, cam: { ...cam, seat: {} } }).busy, 'seat');
  assert.deepEqual(['AttackWindUp', 'AttackRelease', 'AttackEnd'].map((upper) => motionWord({ ...base, upper, attackType: 'chop', progress: 0.5 }).blow.section), ['windup', 'release', 'follow']);
  assert.equal(motionWord({ ...base, upper: 'WeaponEquipped', attackType: 'chop' }).blow, null);
  assert.equal(motionWord({ ...base, upper: 'Equipping' }).equip, true);
  // SHIELD-RUN: a shield is a piece the body wears in the composer's shield slot, named for its record
  assert.equal(w.shield, false, 'no pieces: no shield');
  for (const slot of ['shield (iron_shield)', "shield (nordic_trollbone_shield) - ground mesh, the reference's own fallback"]) {
    assert.equal(motionWord({ ...base, rig: { ...rig, arm: { pieces: [{ slot: 'cuirass (iron_cuirass)' }, { slot }] } } }).shield, true, `a shield worn: ${slot}`);
  }
  assert.equal(motionWord({ ...base, rig: { ...rig, arm: { pieces: [{ slot: 'left hand (iron_gauntlet_left)' }] } } }).shield, false, 'a gauntlet is no shield');
});

test('BODY-MOTION THE WIRING, by source: poseAssembly lays the `motion` slot after the mirror and the neck and under the run, the climb and the hold; the rig steps its motion after the clips with its own word and hands the slot to the THIRD-person body\'s pose only; the hip lantern follows the gait\'s stride while it walks the legs; and the switch is the viewer\'s, on by default (mutants: BODY-MOTION-slot-unwired, BODY-MOTION-never-stepped, BODY-MOTION-lantern-off-the-gait)', () => {
  const fp = readFileSync(new URL('../../../src/formats/morrowind/mwFirstPerson.js', import.meta.url), 'utf8');
  assert.match(fp, /applyFirstPersonNeck\([^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*assembly\.motionFit = motion \? motion\(skeleton, pose, GRAPH_ROOT, fns\.skelMats\) : null;\n(?:\s*\/\/[^\n]*\n)*\s*assembly\.runFit = run/);
  const arm = readFileSync(new URL('../../../src/combat/fpArm.js', import.meta.url), 'utf8');
  assert.equal((arm.match(/motion: motion\.slot,/g) ?? []).length, 1, 'one pose takes the slot');
  assert.match(arm, /hold: rifleHold\('third', t\),[^\n]*\n\s*motion: motion\.slot,/, 'the third-person body\'s');
  assert.match(arm, /aimFactor = aimingFactor\(aimFactor, accurateAiming\(upper\), dt\);\n(?:\s*\/\/[^\n]*\n)*\s*motion\.step\(dt, motionWord\(\{\s*cam, third: viewMode === 'third', rig: thirdBuilt, built, dead, hit: !!hitState && !actionState,/, 'stepped after the clips, every frame - a recoil taking the body only out of a blow (PIN MOVED, AUDIT BODY-MOTION MELEE-5: taken mid-blow, the layer let go and the raw attack clip froze the legs)');
  assert.match(arm, /hipLantern\.step\(cam, dt, motion\.stride\(\)\.move > 0\.5 \? motion\.stride\(\)\.phase : /, 'the lantern on the gait\'s stride');
  const features = readFileSync(new URL('../../../src/systems/features.js', import.meta.url), 'utf8');
  assert.match(features, /id: 'mw-body-motion',[\s\S]*?control: Object\.freeze\(\{ store: 'prefs', key: 'mwBodyMotion', initial: true, online: 'player' \}\)/);
});
