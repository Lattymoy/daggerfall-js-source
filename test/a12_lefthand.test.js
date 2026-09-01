// ROAD TO 1:1, a12 - THE LEFT-HAND WEAPON.
//
// Classic Daggerfall fights with either hand; H switches between them,
// a shield in the left hand locks you to the right, and the hand you
// are using decides which weapon swings - and therefore its damage,
// its skill tally, its hit sound and its draw clip. The port had none
// of it: one line in the rig bound EquipSlots.RightHand and that was
// the whole story, so a longsword worn in the left hand was invisible
// to combat and a shield was cosmetic.
//
// Every pin below cites WeaponManager.cs (MIT, Daggerfall Workshop):
//   usingRightHand/holdingShield/the two caches  :74-77
//   the SwitchHand leg (ActionComplete, !isAttacking)  :271-273
//   UpdateHands' shield rule and caches  :648-676
//   ToggleHand  :702-729
//   ApplyWeapon (racial override first, then the used hand)  :731-757
// plus StartGameBehaviour.cs:606 for the classic-save import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PlayerWeapon, INTERIM_WEAPON, BOW_SWITCH_DIVISOR,
  USING_RIGHT_HAND_TEXT, USING_LEFT_HAND_TEXT, usingRightHandFromSaveVars,
} from '../src/combat/playerWeapon.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { WEAPON_TYPES, weaponTypeForItem } from '../src/combat/fpsWeapon.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const weapon = (templateIndex, name) => ({ name, group: 'Weapons', templateIndex, material: 0 });
const KATANA = weapon(121, 'Katana');
const DAGGER = weapon(113, 'Dagger');
const LONG_BOW = weapon(130, 'Long Bow');
// Armor.Buckler 109 .. Tower_Shield 112 (armorMaterials SHIELD_VALUES).
const BUCKLER = { name: 'Buckler', group: 'Armor', templateIndex: 109, material: 0 };
const CUIRASS = { name: 'Cuirass', group: 'Armor', templateIndex: 102, material: 0 };

const CANVAS = { clientWidth: 1000, clientHeight: 800 };
const stubAudio = () => { const a = { played: [], playOneShot(id) { a.played.push(id); } }; return a; };
const wearing = (right, left) => ({ items: [], equip: { slots: { [EQUIP_SLOTS.RightHand]: right ?? null, [EQUIP_SLOTS.LeftHand]: left ?? null } } });
const rig = (over = {}) => {
  const audio = stubAudio();
  const said = [];
  const r = createWeaponRig({
    renderer: {}, canvas: CANVAS, fetchBytes: () => { throw new Error('no art in tests'); },
    palette: null, audio, entity: { items: [] }, say: (l) => said.push(l), ...over,
  });
  r._audio = audio; r._said = said;
  return r;
};

test('a12: the hand state starts where WeaponManager starts it (:74-77)', () => {
  const pw = new PlayerWeapon({});
  assert.equal(pw.usingRightHand, true, 'the player starts on the right hand');
  assert.equal(pw.holdingShield, false);
  assert.equal(pw.currentRightHandWeapon, null, 'both caches empty until the first UpdateHands');
  assert.equal(pw.currentLeftHandWeapon, null);
  assert.equal(pw.weapon, INTERIM_WEAPON, 'the pre-chargen fallback is untouched by any of it');
});

test('a12: ApplyWeapon binds the USED hand - the left hand can finally swing (:741-755)', () => {
  const pw = new PlayerWeapon({});
  pw.updateHands(KATANA, DAGGER);
  assert.equal(pw.applyWeapon(), KATANA, 'right hand in use: the katana is the screen weapon');
  pw.usingRightHand = false;
  assert.equal(pw.applyWeapon(), DAGGER, 'left hand in use: the DAGGER swings');
  // SetMelee (:743-746, :751-754): an empty used hand is bare hands,
  // which weaponTypeForItem already answers Melee for.
  pw.updateHands(KATANA, null);
  assert.equal(pw.applyWeapon(), null, 'an empty left hand is SetMelee');
  assert.equal(weaponTypeForItem(pw.weapon), WEAPON_TYPES.Melee);
});

test('a12: UpdateHands - a SHIELD forces the right hand and blanks the left cache (:652-661)', () => {
  const pw = new PlayerWeapon({});
  pw.usingRightHand = false;   // fighting left-handed when the shield goes on
  pw.updateHands(KATANA, BUCKLER);
  assert.equal(pw.holdingShield, true);
  assert.equal(pw.usingRightHand, true, 'the shield forces the right hand back');
  assert.equal(pw.currentLeftHandWeapon, null, 'a shield is not a left-hand WEAPON');
  assert.equal(pw.applyWeapon(), KATANA);
  // Only the four shield templates do it - a cuirass in the left slot
  // is not a shield (GetIsShield, DaggerfallUnityItem.cs:1804-1815).
  pw.updateHands(KATANA, CUIRASS);
  assert.equal(pw.holdingShield, false);
  assert.equal(pw.currentLeftHandWeapon, CUIRASS);
  // And the flag CLEARS the moment the shield comes off (:650).
  pw.updateHands(KATANA, DAGGER);
  assert.equal(pw.holdingShield, false);
  assert.equal(pw.currentLeftHandWeapon, DAGGER);
});

test('a12: ToggleHand raises the two classic lines, and the shield refuses (:702-712)', () => {
  const pw = new PlayerWeapon({});
  pw.updateHands(KATANA, DAGGER);
  assert.equal(pw.toggleHand(), USING_LEFT_HAND_TEXT, 'Internal_Strings usingLeftHand');
  assert.equal(pw.usingRightHand, false);
  assert.equal(pw.weapon, DAGGER, 'ToggleHand ends in ApplyWeapon (:728)');
  assert.equal(pw.toggleHand(), USING_RIGHT_HAND_TEXT, 'Internal_Strings usingRightHand');
  assert.equal(pw.weapon, KATANA);
  // :704-705 - the right hand plus a shield has nothing to switch to.
  pw.updateHands(KATANA, BUCKLER);
  assert.equal(pw.toggleHand(), null, 'no line, no flip');
  assert.equal(pw.usingRightHand, true);
});

test('a12: ToggleHand\'s BowLeftHandWithSwitching arm - the switch delay, verbatim (:713-727)', () => {
  const pw = new PlayerWeapon({});
  pw.updateHands(KATANA, DAGGER);
  const entity = {};
  // Default OFF (defaults.ini Enhancements/BowLeftHandWithSwitching =
  // False), which is the CLASSIC lane: switching costs nothing.
  pw.toggleHand({ entity });
  assert.equal(entity.equipCountdown ?? 0, 0, 'the classic lane pays no switch delay');
  // ON: sum over both hands of (EquipDelayTimes[GroupIndex] - 500),
  // divided by 1.7. Katana is weapon index 8 (1700), Dagger index 0
  // (500), so 1200 + 0 = 1200.
  pw.toggleHand({ entity, bowSwitching: true });
  assert.equal(entity.equipCountdown, 1200 / BOW_SWITCH_DIVISOR);
  assert.equal(BOW_SWITCH_DIVISOR, 1.7, 'WeaponManager.cs:45');
  // switchDelay <= 0 bills nothing (:720): two daggers are 0 + 0.
  const e2 = {};
  const pw2 = new PlayerWeapon({});
  pw2.updateHands(DAGGER, DAGGER);
  pw2.toggleHand({ entity: e2, bowSwitching: true });
  assert.equal(e2.equipCountdown ?? 0, 0, 'a non-positive switchDelay never bills');
});

test('a12: usingLeftHandWeapon imports off a classic save (StartGameBehaviour.cs:606)', () => {
  // formats/saveVarsFile.js has parsed the byte since SAV2; the law is
  // the inversion, and the sentinel-free default of an absent record.
  assert.equal(usingRightHandFromSaveVars({ usingLeftHandWeapon: true }), false, 'a left-handed save loads left-handed');
  assert.equal(usingRightHandFromSaveVars({ usingLeftHandWeapon: false }), true);
  assert.equal(usingRightHandFromSaveVars(null), true, 'no saveVars = WeaponManager\'s own default');
});

// ── THE RIG: the per-frame read and the H door ───────────────────────

test('a12 rig: syncWorn reads BOTH hands, so the worn left-hand weapon becomes the swing', () => {
  const entity = wearing(KATANA, DAGGER);
  const r = rig({ entity });
  r.frame(1 / 60);
  assert.equal(r.playerWeapon.weapon, KATANA);
  assert.equal(r.playerWeapon.currentLeftHandWeapon, DAGGER, 'the left cache is live, not dropped');
  assert.equal(r.switchHand(), true);
  assert.deepEqual(r._said, [USING_LEFT_HAND_TEXT]);
  assert.equal(r.playerWeapon.weapon, DAGGER, 'the left hand swings now');
  // ...and the machine follows it, per step (playerWeapon.update).
  r.frame(1 / 60);
  assert.equal(weaponTypeForItem(r.playerWeapon.weapon), WEAPON_TYPES.Dagger);
  assert.equal(r.playerWeapon.machine.isUnarmed, false);
});

test('a12 rig: an EMPTY left hand switches to bare hands - the machine goes unarmed', () => {
  const r = rig({ entity: wearing(KATANA, null) });
  r.frame(1 / 60);
  assert.equal(r.playerWeapon.machine.isUnarmed, false, 'a katana is not unarmed');
  assert.equal(r.switchHand(), true);
  r.frame(1 / 60);
  assert.equal(r.playerWeapon.weapon, null);
  assert.equal(r.playerWeapon.machine.isUnarmed, true, 'the empty hand is HandToHand');
});

test('a12 rig: a shield refuses the switch, silently, every press (:704-705)', () => {
  const r = rig({ entity: wearing(KATANA, BUCKLER) });
  r.frame(1 / 60);
  assert.equal(r.playerWeapon.holdingShield, true);
  assert.equal(r.switchHand(), false);
  assert.equal(r.switchHand(), false);
  assert.deepEqual(r._said, [], 'no popup for a switch that did not happen');
  assert.equal(r.playerWeapon.usingRightHand, true);
});

test('a12 rig: the hand never changes MID-SWING (:271, !isAttacking)', () => {
  const r = rig({ entity: wearing(KATANA, DAGGER) });
  r.toggleSheath();
  r.frame(1 / 60);
  r.attackInput(900, 0, true);
  r.frame(1 / 60);
  assert.ok(r.playerWeapon.machine.state.startsWith('Strike'), `state ${r.playerWeapon.machine.state}`);
  assert.equal(r.switchHand(), false, 'a swing in flight holds the hand');
  assert.equal(r.playerWeapon.weapon, KATANA);
  // Run the strike out; the machine returns to Idle and H works again.
  for (let f = 0; f < 240 && r.playerWeapon.machine.state !== 'Idle'; f++) r.frame(1 / 60);
  assert.equal(r.playerWeapon.machine.state, 'Idle');
  assert.equal(r.switchHand(), true);
});

test('a12 rig: the wereclaws still win over both hands (ApplyWeapon\'s first arm, :735-739)', () => {
  const entity = wearing(KATANA, DAGGER);
  // the live curse entry racialFpsWeapon reads (lycanthropy.js:125-127)
  entity.activeEffects = [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true }];
  const r = rig({ entity });
  r.frame(1 / 60);
  assert.equal(r.playerWeapon.weapon?.werecreatureClaws, true, 'transformed: the claws are the screen weapon');
  // ...and the hand caches still track underneath, as UpdateHands runs
  // ahead of ApplyWeapon either way (:646-675 then :677).
  assert.equal(r.playerWeapon.currentLeftHandWeapon, DAGGER);
});

test('a12 rig: a LEFT-hand bow is a real bow - the guard and the draw clip follow the hand', () => {
  const r = rig({ entity: wearing(KATANA, LONG_BOW) });
  r.frame(1 / 60);
  r.switchHand();
  r.frame(1 / 60);
  assert.equal(r.playerWeapon.machine.isBow, true, 'the left hand\'s bow drives the bow clock');
  r.toggleSheath();
  assert.equal(r.playerWeapon.sheathed, false);
  // FPSWeapon.UpdateWeapon's zero-arrow auto-sheathe reads the SCREEN
  // weapon, which is now the left hand's.
  r.draw();
  assert.equal(r.playerWeapon.sheathed, true);
  assert.deepEqual(r._said, [USING_LEFT_HAND_TEXT, 'You have no arrows.']);
});

test('a12 rig: bindWorn:false rigs flip the hand without losing their scripted weapon', () => {
  // The dungeon's ?weapon=bow demo drives playerWeapon.weapon itself
  // (dungeonContext: bindWorn is off there), so ApplyWeapon must not
  // overwrite it with a hand no equip table ever filled.
  const r = rig({ entity: { items: [] }, bindWorn: false });
  r.playerWeapon.weapon = LONG_BOW;
  assert.equal(r.switchHand(), true);
  assert.equal(r.playerWeapon.usingRightHand, false);
  assert.equal(r.playerWeapon.weapon, LONG_BOW, 'the scripted weapon survives the switch');
});

test('a12: the mirrored FPSWeapon draw was ALREADY ported - the handedness pin, not a second one', () => {
  // AUDIT 28 W13 landed FlipHorizontal (Controls/Handedness == 1,
  // StartGameBehaviour.cs:269) and it is NOT the hand toggle: DFU's
  // only writer of that field is the SETTING, and FPSWeapon mirrors
  // just the three symmetric states either way. This pin holds the
  // two apart so nobody wires the flip to usingRightHand.
  const fps = readFileSync(join(ROOT, 'src', 'combat', 'fpsWeapon.js'), 'utf8');
  assert.match(fps, /flipHorizontal = getInt\('Controls', 'Handedness', 0, 3\) === 1/);
  assert.match(fps, /FLIP_STATES = Object\.freeze\(\['Idle', 'StrikeDown', 'StrikeUp'\]\)/);
  const pw = readFileSync(join(ROOT, 'src', 'combat', 'playerWeapon.js'), 'utf8');
  assert.ok(!/flipHorizontal/i.test(pw), 'the hand law never touches the draw mirror');
});
