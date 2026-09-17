// MAC-O1 - THE READYWEAPON KEY (Mac, 2026-09-16: "Problems
// sheathing/unsheathing weapon. This also causes issues holding
// lanterns or torches.").
//
// DFU has TWO doors onto WeaponManager.ToggleSheath and the port had
// wired both to the same one:
//
//   HUDLarge.cs:477-483   the large HUD's sheath panel calls
//                         WeaponManager.ToggleSheath() on the
//                         singleton - RAW, no refusals.
//   WeaponManager.cs
//     :229-269            the ReadyWeapon KEY, read inside Update, with
//                         three refusals and one action the panel's
//                         door does not have:
//                           :230-233 the bow's cooldown returns first;
//                           :268     `!isAttacking`;
//                           :245-265 a READIED SPELL owns the key -
//                                    AbortReadySpell, sheathe if
//                                    drawn, then :268-269 toggles, so
//                                    the spell goes and the weapon
//                                    comes OUT in one press.
//
// Every host polled Z and called the panel's door, so the spell arm
// was unported: Z flipped `Sheathed` while shown()'s own HasReadySpell
// leg (WeaponManager.cs:247, weaponRig.js's `shown`) kept the sprite
// hidden. The player saw nothing happen and pressed again, and the
// weapon ended sheathed or drawn by the parity of their presses with
// no picture either way - "does not toggle / toggles twice / gets
// stuck". The torch half is downstream of the same line: Handheld
// Torches' UpdateFreeHand reads the readied spell every frame
// (handheldTorches.js:308, Handling.StowWhenSpellcasting) so a spell Z
// could not put away kept the light stowed for good.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR, ON_STOW } from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { SOUND } from '../src/systems/soundClips.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const CANVAS = { clientWidth: 1000, clientHeight: 800 };

/** A real rig with the host seam the fix needs: a LIVE readied spell
 *  that `abortSpell` clears, exactly as hostMagic's readiedSpell does. */
function rig(over = {}) {
  const played = [];
  const magic = { armed: false, aborts: 0 };
  const r = createWeaponRig({
    renderer: {}, canvas: CANVAS, fetchBytes: () => { throw new Error('no art in tests'); },
    palette: null, audio: { playOneShot: (id) => played.push(id) }, entity: { items: [] },
    spellArmed: () => magic.armed,
    abortSpell: () => { magic.aborts += 1; magic.armed = false; },
    ...over,
  });
  return { r, played, magic };
}

test('MAC-O1: a readied spell OWNS the key - Z aborts it and the weapon comes OUT (WeaponManager.cs:249-258 + :268-269)', () => {
  const { r, played, magic } = rig();
  // Drawn, then a spell is readied: DFU hides the weapon while one is
  // up (:247) but keeps Sheathed false.
  r.readyWeapon();
  assert.equal(r.playerWeapon.sheathed, false, 'the first press drew');
  played.length = 0;
  magic.armed = true;
  // THE PRESS. :251 AbortReadySpell, :254-255 sheathe (silently, a
  // sheathe plays nothing), :268-269 ToggleSheath -> drawn, with the
  // weapon's own equip clip.
  assert.equal(r.readyWeapon(), true);
  assert.equal(magic.aborts, 1, 'AbortReadySpell ran (:251)');
  assert.equal(magic.armed, false, 'the readied spell is gone');
  assert.equal(r.playerWeapon.sheathed, false, 'and the weapon is DRAWN - :254-255 put it away so :269 could draw it again');
  assert.deepEqual(played, [SOUND.EquipShortBlade], 'the draw clip, once - the inner sheathe is silent');
});

test('MAC-O1: the same press from SHEATHED also ends drawn, and the next one sheathes normally', () => {
  const { r, magic } = rig();
  magic.armed = true;
  assert.equal(r.playerWeapon.sheathed, true, 'classic starts sheathed');
  r.readyWeapon();
  assert.equal(magic.armed, false);
  assert.equal(r.playerWeapon.sheathed, false, 'ONE press with a spell up draws the weapon');
  r.readyWeapon();
  assert.equal(r.playerWeapon.sheathed, true, 'and the next press is an ordinary sheathe');
});

test('MAC-O1: `!isAttacking` (WeaponManager.cs:268) - Z does nothing mid-swing, the PANEL still toggles (HUDLarge.cs:477-483)', () => {
  const { r } = rig();
  r.readyWeapon();
  assert.equal(r.playerWeapon.sheathed, false);
  // A real drag past the threshold: the machine leaves Idle.
  r.attackInput(900, 0, true);
  r.frame(1 / 60);
  assert.notEqual(r.playerWeapon.machine.state, 'Idle', 'the swing is running');
  assert.equal(r.readyWeapon(), false, 'the KEY refuses while the blow is in the air');
  assert.equal(r.playerWeapon.sheathed, false, 'nothing moved');
  // The panel takes none of Update's refusals - it reaches the
  // singleton directly.
  r.toggleSheath();
  assert.equal(r.playerWeapon.sheathed, true, 'HUDLarge’s door is still the raw ToggleSheath');
});

test('MAC-O1: the bow COOLDOWN returns before the sheath block (WeaponManager.cs:230-233)', () => {
  const { r } = rig();
  r.readyWeapon();
  assert.equal(r.playerWeapon.sheathed, false);
  const m = r.playerWeapon.machine;
  m.isBow = true;
  m.cooldownUntil = m.now + 1.3;   // GetBowCooldownTime's recovery, as machineAttack sets it
  assert.equal(r.readyWeapon(), false, 'Z is dead until the shot has recovered');
  assert.equal(r.playerWeapon.sheathed, false);
  m.cooldownUntil = 0;
  assert.equal(r.readyWeapon(), true, 'and live again after it');
  assert.equal(r.playerWeapon.sheathed, true);
});

test('MAC-O1: the TORCH comes back - a spell Z can put away no longer keeps the light stowed', () => {
  // The real component, on the mod's own defaults
  // (Handling.StowWhenSpellcasting ships true).
  const store = Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default]));
  assert.equal(store['Handling.StowWhenSpellcasting'], true, 'the mod stows on a readied spell');
  // Handling.OnStow ships Drop; Unequip is the arm that REMEMBERS the
  // light (handheldTorches.js:473-480), which is what makes the return
  // visible at all - the free hand is the law either way.
  store['Handling.OnStow'] = ON_STOW.Unequip;
  const { r, magic } = rig();
  const entity = { items: [], equip: { slots: {} }, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const h = createHandheldTorches({
    settings: () => readTorchSettings(() => store), audio: { playOneShot() {}, loop: () => ({ stop() {} }) },
    say: () => {}, torches: () => ({ spawnLightSource() {}, spawnLightSourceProjectile() {}, setOnPickedUp() {} }),
    loadSprite: async () => null,
  });
  // The rig's own record, as weaponRig.js builds it for the component.
  const ctx = {
    renderer: null, canvas: { width: 640, height: 400 }, entity, machine: r.playerWeapon.machine,
    get sheathed() { return r.playerWeapon.sheathed; }, usingRightHand: true,
    castPlaying: false, get spellArmed() { return magic.armed; }, thirdPerson: false,
    climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] },
    look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, sheathWeapons: () => { if (!r.playerWeapon.sheathed) r.toggleSheath(); },
  };
  const frame = () => { h.update(1 / 60, ctx); h.lateUpdate(1 / 60, ctx); };
  entity.lightSource = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50 };
  frame();
  assert.equal(h.hasFreeHand, true, 'bare hands, weapon sheathed: the torch is held');
  assert.ok(entity.lightSource, 'and it is still the player’s light');
  // Ready a spell: UpdateFreeHand takes both hands (:308) and the
  // light is stowed, remembered.
  magic.armed = true;
  frame(); frame();
  assert.equal(h.hasFreeHand, false, 'a readied spell takes both hands');
  assert.equal(entity.lightSource, null, 'the torch is stowed');
  // THE PRESS. The spell goes; the weapon comes out, which is one
  // hand, not two - so the light comes back.
  r.readyWeapon();
  assert.equal(magic.armed, false, 'Z put the spell away (:251)');
  frame(); frame();
  assert.equal(r.playerWeapon.sheathed, false, 'and drew the weapon');
  assert.equal(h.hasFreeHand, true, 'a drawn weapon leaves the off hand free');
  assert.ok(entity.lightSource, 'so the remembered light is taken up again');
});

test('MAC-O1 (THE FOUR HOSTS RULE): every host polls the KEY’s door and hands the rig AbortReadySpell', () => {
  // The four hosts, plus the standalone dungeon scene that shares
  // dungeonContext's rig.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    const s = read(f);
    assert.match(s, /held\(keys, 'ReadyWeapon'\)/, `${f} still polls the key`);
    assert.match(s, /readyWeapon\(\)|readyWeapon\?\.\(\)/, `${f}: the Z edge takes WeaponManager.Update's arm`);
  }
  // ...and the arm is reachable on the dungeon ctx the two dungeon
  // hosts are handed, beside the panel's raw door.
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /readyWeapon: weaponRig\.readyWeapon,/);
  assert.match(dc, /^    toggleSheath: weaponRig\.toggleSheath,$/m);
  // The spell door: all four rigs get it, or :251 has nothing to call.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(read(f), /abortSpell: \(\) => magic\??\.?\.?abortReadySpell\(\)/,
      `${f}: the rig is handed EntityEffectManager.AbortReadySpell`);
  }
});
