// HARD2c - THE WEAPON POSE PAIR, EXTRACTED (2026-09-15).
//
// The third HARD2 seam, and the smallest of the three left open: the
// sheath and the hand.
//
// DFU writes them as ONE pair and restores them as ONE pair -
// SerializablePlayer.cs:175-176 and :420-421. The port had that pair
// written out BY HAND in three hosts and read back in three more, and
// AUDIT 63 F25 is what four copies of a two-line law cost: the port
// carried only the FIRST of the two lines, so a player fighting with
// the left-hand weapon loaded back holding the right hand's item, or
// bare fists. By the time it was found the two restore lines had
// drifted six and thirteen lines apart inside their own hosts, and the
// comment that pointed between them cited line numbers that no longer
// existed (worldModes.js named `world.js:6683` and `dungeonContext
// .js:5451` for lines that live at :4418 and :5457).
//
// HARD2's three rules, and how this slice meets them:
//
//   NOT A REWRITE. The hosts keep their rigs - which rig is in the
//   player's hands differs per host and that is a real difference. Only
//   the two-line arithmetic moves.
//
//   EXTRACT BY SEAM, SMALLEST FIRST. Of the three seams left open, this
//   one is two lines across six sites with a MEASURED drift behind it.
//   The draw ladders and the teardown order are bigger and have no
//   found defect in hand; they keep their turn.
//
//   EVERY EXTRACTION ENDS WITH THE HOSTS' PINS UNCHANGED, and the
//   differential below is how that is checked rather than asserted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { weaponPoseOf, applyWeaponPose, mergeWeaponPose } from '../src/combat/playerWeapon.js';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

/** Every .js under a directory, recursively - derived, so a new host
 *  (or a new directory of them) is covered by existing. */
function jsUnder(dir, out = []) {
  for (const name of readdirSync(new URL(`${dir}/`, ROOT))) {
    const rel = `${dir}/${name}`;
    if (statSync(new URL(rel, ROOT)).isDirectory()) jsUnder(rel, out);
    else if (name.endsWith('.js')) out.push(rel);
  }
  return out;
}

/** Every shape a pose FIELD has ever arrived in: set either way, an
 *  additive field a pre-field envelope never wrote (absent), and the
 *  two ways a composer can spell "nothing here". */
const FIELD = [true, false, null, undefined];
const RIG = [{ sheathed: true, usingRightHand: true }, { sheathed: true, usingRightHand: false },
  { sheathed: false, usingRightHand: true }, { sheathed: false, usingRightHand: false }];

test('HARD2c: the WRITE differential - the old inline arithmetic, carried verbatim', () => {
  // worldModes.js:9852 and dungeonContext.js:6268, character for
  // character as they stood before this slice.
  const oldCompose = (w) => ({ weaponDrawn: !w.sheathed, usingRightHand: w.usingRightHand });
  // world.js:6462's own, which is the MERGE - `wp` is the mode host's
  // answer for the rig actually drawn, taken PER FIELD.
  const oldMerge = (wp, rig) => ({
    weaponDrawn: wp?.weaponDrawn ?? !rig.sheathed,
    usingRightHand: wp?.usingRightHand ?? rig.usingRightHand,
  });

  let n = 0, differ = 0;
  for (const rig of RIG) {
    assert.deepEqual(weaponPoseOf(rig), oldCompose(rig));
    n++;
    for (const live of [null, undefined, ...FIELD.flatMap((a) => FIELD.map((b) => ({ weaponDrawn: a, usingRightHand: b })))]) {
      const now = mergeWeaponPose(live, weaponPoseOf(rig));
      const then = oldMerge(live, rig);
      if (now.weaponDrawn !== then.weaponDrawn || now.usingRightHand !== then.usingRightHand) differ++;
      n++;
    }
  }
  assert.equal(n, 76, 'the differential stopped covering the space it claims to');
  assert.equal(differ, 0, 'the extracted compose disagrees with the arithmetic it replaced');
});

test('HARD2c: the RESTORE differential - all three copies were the same law', () => {
  // world.js:6750/:6763, dungeonContext.js:6317/:6317 and
  // worldModes.js:9850-9851 - three copies, one law, carried verbatim.
  const oldApply = (w, pose) => {
    if (!pose) return;
    if (pose.weaponDrawn != null) w.sheathed = !pose.weaponDrawn;
    if (pose.usingRightHand != null) w.usingRightHand = !!pose.usingRightHand;
  };
  const poses = [null, undefined, {},
    ...FIELD.flatMap((a) => FIELD.map((b) => ({ weaponDrawn: a, usingRightHand: b }))),
    { weaponDrawn: true }, { usingRightHand: false }];

  let n = 0, differ = 0;
  for (const start of RIG) {
    for (const pose of poses) {
      const a = { ...start }; oldApply(a, pose);
      const b = { ...start }; applyWeaponPose(b, pose);
      if (a.sheathed !== b.sheathed || a.usingRightHand !== b.usingRightHand) differ++;
      n++;
    }
  }
  assert.equal(n, 84, 'the differential stopped covering the space it claims to');
  assert.equal(differ, 0, 'the extracted restore disagrees with the arithmetic it replaced');
});

test('HARD2c: the law itself, against SerializablePlayer.cs', () => {
  // :175-176 - weaponDrawn is the NEGATION of sheathed, the hand is not
  // negated here (the port stores the positive sense because
  // PlayerWeapon holds `usingRightHand`; it is the same bit).
  assert.deepEqual(weaponPoseOf({ sheathed: false, usingRightHand: false }), { weaponDrawn: true, usingRightHand: false });
  assert.equal(weaponPoseOf(null), null, 'null in, null out - "this mode has no rig of its own to answer for"');

  // :420-421 - and back, as a PAIR. F25 was the second line missing.
  const rig = { sheathed: true, usingRightHand: true };
  applyWeaponPose(rig, { weaponDrawn: true, usingRightHand: false });
  assert.deepEqual(rig, { sheathed: false, usingRightHand: false }, 'both halves land, which is what AUDIT 63 F25 found missing');

  // PRESENCE-GATED: a pre-field envelope leaves the live hand alone
  // rather than reading `undefined` as "sheathed, right hand".
  const live = { sheathed: false, usingRightHand: false };
  applyWeaponPose(live, { weaponDrawn: undefined, usingRightHand: undefined });
  assert.deepEqual(live, { sheathed: false, usingRightHand: false });

  // FLAG ONLY: nothing here re-binds the screen weapon. The rig's
  // per-frame syncWorn is DFU's UpdateHands+ApplyWeapon (:699), and a
  // bare applyWeapon() here would drop the racial claws for a frame.
  const spy = { sheathed: true, usingRightHand: true, applyWeapon() { throw new Error('applyWeaponPose must not re-bind the weapon'); } };
  applyWeaponPose(spy, { weaponDrawn: true, usingRightHand: true });

  // AUDIT-176: THE ONE BEHAVIOUR THIS EXTRACTION CHANGED, pinned rather
  // than left to be found. The inline arithmetic dereferenced the rig
  // unguarded (`!rig.sheathed`), so a null rig THREW at the save; this
  // returns null and the composed bag omits the pair, which a
  // presence-gated restore reads as "leave the live hand". Quieter, and
  // quieter is worse - so the difference is recorded here. No caller
  // passes null today; the day one does, this says what it costs.
  assert.throws(() => ({ weaponDrawn: !(/** @type {any} */ (null)).sheathed }), TypeError,
    'the arithmetic this replaced threw on a null rig');
  assert.equal(weaponPoseOf(null), null, '...and this does not');
  assert.deepEqual({ yaw: 1, ...weaponPoseOf(null) }, { yaw: 1 },
    'so the bag silently omits the pair instead of failing the save - the change, stated');

  // SL-2's merge is PER FIELD and uses `??`, so a legitimately FALSE
  // flag from the live rig survives instead of falling through.
  assert.deepEqual(mergeWeaponPose({ weaponDrawn: false, usingRightHand: false }, { weaponDrawn: true, usingRightHand: true }),
    { weaponDrawn: false, usingRightHand: false }, '`||` here would have read a sheathed live rig as the host\'s own drawn one');
  assert.deepEqual(mergeWeaponPose({ usingRightHand: false }, { weaponDrawn: true, usingRightHand: true }),
    { weaponDrawn: true, usingRightHand: false }, 'a PARTIAL bag composes member by member, which is why this is not a whole-bag pick');
});

test('HARD2c: no host spells the pair out again - a fourth copy fails here', () => {
  // The gate HARD2a uses, aimed at this law. The hosts may hold any rig
  // they like; what they may not do is restate the arithmetic.
  // AUDIT-176: THIS LIST USED TO NAME THREE HOSTS BY HAND, which is the
  // enumeration this whole program exists to remove - a FOURTH host
  // spelling the pair out would not have been seen. It walks `src/`
  // now, so a copy anywhere fails here.
  const inline = [];
  for (const host of jsUnder('src').filter((p) => p !== 'src/combat/playerWeapon.js')) {
    const src = read(host);
    src.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;            // a citation is not a copy
      if (/weaponDrawn:\s*!\w+[\w.?]*\.sheathed/.test(line)) inline.push(`${host}:${i + 1} composes the pair inline`);
      if (/\.sheathed\s*=\s*!\w+[\w.?]*\.weaponDrawn/.test(line)) inline.push(`${host}:${i + 1} restores the pair inline`);
    });
  }
  assert.deepEqual(inline, [],
    'this is the two-line law AUDIT 63 F25 lost a line of while it lived in four places. It lives in\n'
    + 'src/combat/playerWeapon.js now - weaponPoseOf / applyWeaponPose / mergeWeaponPose - beside\n'
    + 'usingRightHandFromSaveVars, which is the CLASSIC-save half of the same pair.');
});
