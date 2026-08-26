// AUDIT 26, the frame-4 bow loose: ONE law, one export.
//
// WeaponManager.cs:376-379 sounds the loose with ScreenWeapon.PlaySwingSound(),
// which plays FPSWeapon.SwingWeaponSound at volume 1.1 (FPSWeapon.cs:299-305,
// PlayOneShot(clip, 0, 1.1f)); SetWeapon (WeaponManager.cs:781) fills
// SwingWeaponSound from the wielded weapon's own GetSwingSound
// (DaggerfallUnityItem.cs:878-906), whose bow arm answers ArrowShoot. The
// frame-4 loose and the hit-frame whiff (WeaponManager.cs:424) are therefore
// the SAME member, and swingSoundFor is its one export - the four hosts used
// to spell SOUND.ArrowShoot inline.
//
// These pins watch the SOUND, not the spelling: each host's bow arm is
// evaluated with a bow in hand and the clip + volume it plays is the
// assertion, so a host that stops sounding the loose - or a swingSoundFor
// that stops answering ArrowShoot for a bow - fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUND, swingSoundFor } from '../src/systems/soundClips.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { CLASSIC_UPDATE_INTERVAL, BOW_SOUND_FRAME } from '../src/characters/weaponStates.js';
import { WEAPONS } from '../src/characters/weapons.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const SHORT_BOW = { name: 'Short Bow', templateIndex: WEAPONS.Short_Bow };
const LONG_BOW = { name: 'Auriel\'s Bow', templateIndex: WEAPONS.Long_Bow };   // renamed by createRegularMagicItem: still a bow

/** Run one host's `ev === 'bowSound'` arm with `weapon` in hand and return
 *  the [clip, volume] pairs it sounded. The arm is the host's own text: a
 *  host that drops the call (or the arm) plays nothing and fails. */
function hostLooseSounds(text, weapon) {
  const arm = /if \(ev === 'bowSound'\) \{([^}]*)\}/.exec(text);
  assert.ok(arm, 'the frame-4 bow arm is wired in this host');
  const played = [];
  const rig = { playerWeapon: { weapon } };
  const audio = { playOneShot: (clip, volume) => played.push([clip, volume]), play3d: () => {} };
  // Every host name the arm can legally read; `continue` is the loop's, not the arm's.
  new Function('ev', 'audio', 'SOUND', 'swingSoundFor', 'weaponRig', 'interiorWeapon', 'playerWeapon',
    arm[1].replace('continue;', ''))(
    'bowSound', audio, SOUND, swingSoundFor, rig, rig, rig.playerWeapon);
  return played;
}

const HOSTS = [
  ['world', 'src/scenes/world.js'],
  ['exterior', 'src/scenes/exterior.js'],
  ['worldModes (interior)', 'src/scenes/worldModes.js'],
  ['dungeonContext', 'src/scenes/dungeonContext.js'],
];

test('audit26 loose: all four hosts sound the wielded bow\'s own swing clip at 1.1', () => {
  for (const [name, file] of HOSTS) {
    const text = src(file);
    assert.deepEqual(hostLooseSounds(text, SHORT_BOW), [[SOUND.ArrowShoot, 1.1]],
      `${name}: PlaySwingSound = SwingWeaponSound at 1.1, ArrowShoot for a Short Bow`);
    assert.deepEqual(hostLooseSounds(text, LONG_BOW), [[SOUND.ArrowShoot, 1.1]],
      `${name}: a RENAMED Long Bow looses the same clip - the switch is on the template`);
  }
});

test('audit26 loose: the loose is GetSwingSound, not a second literal - it moves with the member', () => {
  // Not a spelling assertion: the hosts are re-run against a swingSoundFor
  // that answers a different clip, and every host must follow it. A host
  // holding its own ArrowShoot literal would not.
  assert.equal(swingSoundFor(SHORT_BOW), SOUND.ArrowShoot, 'GetSwingSound bow arm (DaggerfallUnityItem.cs:900-902)');
  assert.equal(swingSoundFor(LONG_BOW), SOUND.ArrowShoot);
  for (const [name, file] of HOSTS) {
    const arm = /if \(ev === 'bowSound'\) \{([^}]*)\}/.exec(src(file));
    assert.ok(arm, `${name}: the frame-4 bow arm is wired`);
    const played = [];
    const rig = { playerWeapon: { weapon: SHORT_BOW } };
    new Function('ev', 'audio', 'SOUND', 'swingSoundFor', 'weaponRig', 'interiorWeapon', 'playerWeapon',
      arm[1].replace('continue;', ''))(
      'bowSound', { playOneShot: (c, v) => played.push([c, v]), play3d: () => {} },
      SOUND, () => SOUND.SwingLowPitch, rig, rig, rig.playerWeapon);
    assert.deepEqual(played, [[SOUND.SwingLowPitch, 1.1]],
      `${name}: the loose reads the member, so it moves when the member moves`);
  }
});

test('audit26 loose: the sound rides frame 4 of the bow release, before the loose', () => {
  // WeaponManager.cs:376 - GetCurrentFrame() == 4, once per release
  // (isBowSoundFinished), and the arrow leaves at the hit frame after it.
  assert.equal(BOW_SOUND_FRAME, 4, 'GetCurrentFrame() == 4');
  const pw = new PlayerWeapon({ weapon: SHORT_BOW, liveSpeed: 50 });
  pw.sheathed = false;
  pw.update(0);
  assert.equal(pw.gesture(0, 0, true, 1 / 60, 1000), 'StrikeDown');
  const seen = [];
  for (let i = 0; i < 200 && !seen.some((e) => e.ev === 'done'); i++) {
    for (const ev of pw.update(CLASSIC_UPDATE_INTERVAL)) seen.push({ ev, frame: pw.machine.frame });
  }
  const loose = seen.filter((e) => e.ev === 'bowSound');
  assert.equal(loose.length, 1, 'one loose sound per release');
  assert.equal(loose[0].frame, BOW_SOUND_FRAME, 'sounded at frame 4');
  assert.ok(seen.findIndex((e) => e.ev === 'bowSound') < seen.findIndex((e) => e.ev === 'hit'),
    'the sound precedes the arrow');
});
