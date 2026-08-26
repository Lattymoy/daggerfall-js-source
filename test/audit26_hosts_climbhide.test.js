// AUDIT 26 - the HOST half of WeaponManager.cs:235-240.
//
//   // Do nothing if player paralyzed or is climbing
//   if (GameManager.Instance.PlayerEntity.IsParalyzed || GameManager.Instance.ClimbingMotor.IsClimbing)
//   {
//       ShowWeapons(false);
//       return;
//   }
//
// weaponRig.shown() carries that leg, but the rig holds no motor, so
// the input arrives as a `climbing()` dep - and a dep no host passes
// defaults to false and is INERT IN PLAY: the weapon stayed drawn for
// the whole climb in every mode. (StartClimbing, ClimbingMotor.cs:531-540,
// sets isClimbing with no further condition - the AdvancedClimbing
// setting only moves the wall-check tolerance - so the hide is
// unconditional on the flag alone.)
//
// These pins drive each host's OWN constructor argument: the
// `climbing:` expression text is lifted out of the scene file, compiled,
// and handed to a REAL createWeaponRig - so dropping the argument from a
// host fails the test rather than quietly re-arming the bug. The rig's
// own ladder is pinned in audit26_equipsound.test.js; this file is
// about the wiring reaching it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWeaponRig } from '../src/combat/weaponRig.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

// Every host that MOUNTS a rig. dungeon.js and interior.js are N/A:
// dungeon.js mounts no rig of its own (it drives the dungeon context,
// whose rig is wired below, and already feeds it ClimbingMotor.IsClimbing
// through reportActivity - audit26p_hostwiring.test.js F083), and
// interior.js is the standalone fly-camera building viewer with no
// PlayerMotor and no weapon at all.
const HOSTS = [
  // The two walk hosts build their own PlayerMotor, so the rig reads it.
  { file: 'src/scenes/exterior.js', channel: 'motor' },
  { file: 'src/scenes/world.js', channel: 'motor' },
  // worldModes' INTERIOR rig: the host's motor rides in as `player`.
  { file: 'src/scenes/worldModes.js', channel: 'motor' },
  // The dungeon context holds no motor - the hosts' per-frame
  // reportActivity carries the flag in for the fatigue band and the rig
  // reads that same one.
  { file: 'src/scenes/dungeonContext.js', channel: 'activity' },
];

/** Lift the host's own `climbing:` argument out of its
 *  `createWeaponRig(...)` call and compile it, so the pins below run the
 *  SHIPPED expression rather than a hand-made options bag. */
function hostClimbing(file, motor, activity) {
  const s = src(file);
  const i = s.indexOf('createWeaponRig(');
  assert.ok(i > 0, `${file} mounts a weapon rig`);
  const end = s.indexOf('});', i);
  assert.ok(end > i, `${file}: the createWeaponRig call closes`);
  const m = /^[ \t]*climbing:\s*(.+?),(?:\s*\/\/.*)?$/m.exec(s.slice(i, end));
  assert.ok(m, `${file} passes climbing (WeaponManager.cs:236 hides the weapon while ClimbingMotor.IsClimbing)`);
  return new Function('player', '_activity', `return (${m[1]});`)(motor, activity);
}

const CANVAS = { clientWidth: 1000, clientHeight: 800 };
/** A real rig on the host's real thunk - nothing else armed, so the
 *  only thing that can hide the weapon here is :236's climbing leg. */
const mount = (climbing) => createWeaponRig({
  renderer: {}, canvas: CANVAS, fetchBytes: () => { throw new Error('no art in tests'); },
  palette: null, audio: { playOneShot() {} }, entity: { items: [] },
  climbing,
});

test('audit26: every host that mounts a weapon rig feeds ClimbingMotor.IsClimbing, and the climbing player shows no weapon', () => {
  for (const { file, channel } of HOSTS) {
    const motor = { climb: { isClimbing: false } };     // the host's PlayerMotor
    const activity = { climbing: false };               // the reported activity
    const set = (on) => { if (channel === 'motor') motor.climb.isClimbing = on; else activity.climbing = on; };
    const setOther = (on) => { if (channel === 'motor') activity.climbing = on; else motor.climb.isClimbing = on; };

    const climbing = hostClimbing(file, motor, activity);
    assert.equal(climbing(), false, `${file}: a standing player is not climbing`);

    const r = mount(climbing);
    r.toggleSheath();   // weapon drawn
    assert.equal(r.shown(), true, `${file}: a drawn weapon on a standing player is shown (:290)`);

    // The flag is read LIVE at shown(), as WeaponManager.Update reads
    // ClimbingMotor.IsClimbing every frame - no reconstruction.
    set(true);
    assert.equal(climbing(), true, `${file}: the thunk is live`);
    assert.equal(r.shown(), false, `${file}: ShowWeapons(false) while climbing (WeaponManager.cs:236-239)`);

    // Letting go restores it - :236 is a per-frame test, not a latch.
    set(false);
    assert.equal(r.shown(), true, `${file}: off the wall, the weapon comes back`);

    // ...and each host reads ITS OWN source: the channel it does not
    // own must not move the weapon (one WeaponManager, one
    // ClimbingMotor).
    setOther(true);
    assert.equal(r.shown(), true, `${file}: reads only its own climb source`);
    setOther(false);

    // The hide leads the ladder: it holds with the weapon drawn, no
    // spell armed and no equip countdown running, which is exactly the
    // state :236 fires in.
    set(true);
    assert.equal(r.playerWeapon.sheathed, false, `${file}: still unsheathed underneath`);
    assert.equal(r.shown(), false, `${file}: climbing hides regardless of the legs below it`);
  }
});

test('audit26: the dungeon context reads the same climb flag its hosts report', () => {
  // dungeonContext holds no motor, so its rig reads `_activity.climbing`
  // - the field reportActivity writes for the per-minute fatigue band
  // (PlayerEntity.cs:405-407). Both ends must name the one object, or the
  // rig would be reading a flag nobody sets.
  const s = src('src/scenes/dungeonContext.js');
  const i = s.indexOf('createWeaponRig(');
  const m = /^[ \t]*climbing:\s*(.+?),(?:\s*\/\/.*)?$/m.exec(s.slice(i, s.indexOf('});', i)));
  assert.ok(m, 'dungeonContext passes climbing');
  assert.match(m[1], /_activity\.climbing/, 'the rig reads the reported activity');
  assert.match(s, /_activity\.climbing = climbing;/, 'reportActivity writes it (the hosts feed it - F083)');
});
