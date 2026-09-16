// MAC-O2 - LOOKING AROUND WITH THE SWING BUTTON DOWN (Mac,
// 2026-09-16: "Can't look around when holding right click").
//
// DFU's law is PlayerMouseLook.Update:246-248 and it has THREE terms:
//
//   if (InputManager.Instance.HasAction(InputManager.Actions.SwingWeapon)
//       && DaggerfallUnity.Settings.WeaponSwingMode == 0
//       && GameManager.Instance.WeaponManager.ScreenWeapon.WeaponType
//          != WeaponTypes.Bow)
//       applyLook = false;                       // :253 SetFacing(lookCurrent)
//
// The port wrote it out four times and carried TWO of the three - the
// swing mode was never asked. In WeaponSwingMode 0 the held drag IS
// the swing gesture (WeaponManager.cs:306-315 tracks the mouse while
// the button is down), which is what the freeze is FOR; modes 1 and 2
// track no gesture at all (:316-331 rolls the direction), so DFU
// leaves the look alone and the player turns while holding the button.
// The port froze it in every mode.
//
// The three questions DFU answers by saying nothing are pinned here
// too, because "the port suppresses where DFU does not" was the shape
// of the report and the other three candidates are NOT departures:
// sheathed, bare-handed and indoors all freeze in DFU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LookFilter, swingSuppressesLook } from '../src/player/lookFilter.js';
import { setValue, loadSettings } from '../src/systems/settings.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('MAC-O2: WeaponSwingMode is a TERM - the gesture mode freezes the look, click-to-attack does not (PlayerMouseLook.cs:247)', () => {
  loadSettings();
  setValue('Controls', 'WeaponSwingMode', '0');
  assert.equal(swingSuppressesLook({ swingHeld: true }), true,
    'mode 0: the held drag IS the swing, so the camera stands still (:248)');
  setValue('Controls', 'WeaponSwingMode', '1');
  assert.equal(swingSuppressesLook({ swingHeld: true }), false,
    'mode 1 CLICK to attack: no gesture is tracked, so DFU never drops the look');
  setValue('Controls', 'WeaponSwingMode', '2');
  assert.equal(swingSuppressesLook({ swingHeld: true }), false,
    'mode 2 click OR hold: the same - the direction is rolled, not dragged');
  setValue('Controls', 'WeaponSwingMode', '0');
});

test('MAC-O2: the other two terms, and the button itself', () => {
  loadSettings();
  setValue('Controls', 'WeaponSwingMode', '0');
  assert.equal(swingSuppressesLook({ swingHeld: false }), false, 'HasAction(SwingWeapon) is the first term');
  assert.equal(swingSuppressesLook({ swingHeld: true, weaponIsBow: true }), false,
    'a BOW is the third term - it has no swing to track (:247)');
  assert.equal(swingSuppressesLook({ swingHeld: true, weaponIsBow: false }), true);
  // ...and the mode can be handed in, for a caller that already read it.
  assert.equal(swingSuppressesLook({ swingHeld: true, swingMode: 1 }), false);
  assert.equal(swingSuppressesLook({ swingHeld: true, swingMode: 0 }), true);
});

test('MAC-O2: SHEATHED is NOT a term - ApplyWeapon writes WeaponType whatever Sheathed is (WeaponManager.cs:732-757)', () => {
  loadSettings();
  setValue('Controls', 'WeaponSwingMode', '0');
  // The real driver: sheathing changes `sheathed`, never the machine's
  // weapon, so the law's answer is the same on both sides of a toggle.
  const w = new PlayerWeapon({});
  assert.equal(w.sheathed, true, 'classic starts sheathed');
  const sheathedAnswer = swingSuppressesLook({ swingHeld: true, weaponIsBow: !!w.machine.isBow });
  w.toggleSheath();
  assert.equal(w.sheathed, false);
  const drawnAnswer = swingSuppressesLook({ swingHeld: true, weaponIsBow: !!w.machine.isBow });
  assert.equal(sheathedAnswer, drawnAnswer, 'DFU asks the WeaponType, not Sheathed');
  assert.equal(sheathedAnswer, true, 'and both freeze - this is DFU behaviour, not a port bug');
});

test('MAC-O2: the filter obeys it - a held gesture DROPS the owed look, click-to-attack PAYS it', () => {
  loadSettings();
  const owed = () => {
    const f = new LookFilter();
    f.add(0.4, 0);
    return f;
  };
  // mode 0: SetFacing(lookCurrent) - the owed look is dropped (:253).
  setValue('Controls', 'WeaponSwingMode', '0');
  {
    const f = owed(); const cam = { yaw: 0, pitch: 0 };
    assert.equal(swingSuppressesLook({ swingHeld: true }), true);
    f.settle();
    f.tick(1 / 60, cam, { smoothing: 0 });
    assert.equal(cam.yaw, 0, 'the camera did not turn');
  }
  // mode 1: ApplyLook runs as usual and the smoothing pays it out.
  setValue('Controls', 'WeaponSwingMode', '1');
  {
    const f = owed(); const cam = { yaw: 0, pitch: 0 };
    assert.equal(swingSuppressesLook({ swingHeld: true }), false);
    f.tick(1 / 60, cam, { smoothing: 0 });
    assert.ok(Math.abs(cam.yaw - 0.4) < 1e-9, 'the whole delta reached the camera');
  }
  setValue('Controls', 'WeaponSwingMode', '0');
});

test('MAC-O2 (THE FOUR HOSTS RULE): every LookFilter owner asks the ONE seam, and nobody re-spells the law', () => {
  // The three that own a LookFilter AND a weapon. world.js and
  // exterior.js carry worldModes' interior and dungeon modes inside
  // their own frames (those hosts own no filter of their own), and
  // dungeon.js carries dungeonContext's.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const s = read(f);
    assert.match(s, /import \{ LookFilter, swingSuppressesLook \} from '\.\.\/player\/lookFilter\.js';/, `${f} imports the seam`);
    assert.match(s, /if \(swingSuppressesLook\(\{ swingHeld: rightHeld \|\| swipeHeld, weaponIsBow: [^)]+\}\)/, `${f} asks it`);
    // ...and does NOT write the law out again beside it.
    assert.doesNotMatch(s, /swipeHeld\) && walkMode[^\n]*isBow/, `${f}: the old inline copy is gone`);
  }
  // The FOURTH owner: src/scenes/interior.js mounts no weapon rig, so
  // nothing there can hold SwingWeapon - named, not silently skipped.
  assert.match(read('src/scenes/interior.js'), /if \(false\) lookFilter\.settle\(\);\s+\/\/ MAC-O2: the fourth LookFilter owner mounts NO weapon rig/);
  // The law itself lives once, and it reads the setting.
  const lf = read('src/player/lookFilter.js');
  assert.match(lf, /export function swingSuppressesLook\(/);
  assert.match(lf, /getInt\('Controls', 'WeaponSwingMode', 0, 2\)/);
  assert.match(lf, /return !!swingHeld && swingMode === 0 && !weaponIsBow;/);
});
