// DISC14 (2026-09-23, Discord through Mac). Each pin here fails at d80fe4ef and passes with its fix
// (bible/01-Overview/Field-Bugs-2026-09-23.md, DISC14).
//
// ── DISC14-A: "is there a way to make it so I can see my weapon above my horse?" (Starempire42) ──
// Riding, the horse's head covered the hand and the root of the blade. DFU draws the mount in OnGUI at GUI.depth 2,
// "behind other HUD elements & weapons" (TransportManager's comment, carried word for word into Roleplay & Realism's
// EnhancedRiding.cs:234-235), and the weapon at the depth in front of it. Both hosts that ride drew the weapon rig
// inside the walk block and the mount later, in the HUD block - so the mount landed on top. The rig now draws after
// the mount and before drawHud, under the walk block's own gate.
//
// ── DISC14-B: Diverse Weapons' defaults (Mac, with a screenshot of the Weapon Widget tile) ──
// "these need to be the default values ingame for diverse weapons. The current defaults are wrong on the screen":
// Swings, Ambidexterity, Offset, Bob and DoubleScaleTextures on; Inertia, Step, TrueTextureSize and Recoil off;
// Swings.Speed 1, Bob.Length 100, Inertia.Scale 0. The defaults were the mod's preset laid OVER the player's Weapon
// Widget settings (DW-CLIP had switched it on): true texture size, inertia, step, recoil, a 142 bob - and the tile
// kept showing the player's own values underneath, so what it showed was not what drew. The preset ships off again,
// and Weapon Widget ships Mac's values: its own defaults with DoubleScaleTextures on and Inertia.Scale 0.
//
// ── DISC14-C: "I also notice littering on the morrowind model" (Mac, after B) ──
// Jitter, measured: B's DoubleScaleTextures default turned on the doubled idle's bob (centred on the rest) for every
// idle, and on anything that rests on transformRect's floor - the Morrowind arms' full-screen composite, a classic
// frame, a plain hit through the fall-through - the upper half of every sway was pinned to the floor: 53 of 120 frames
// on the arms (a jerk of 3.37 against 0.73), 63 on a classic sprite. The doubled bob now rides the doubled `w_` hit, as
// DW-CLIP's half-size shift does, and the arms keep their own plain bob.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { modSetting, modSettingsOf, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { readWidgetSettings, WEAPON_WIDGET_VENDOR } from '../src/combat/weaponWidget.js';
import { diverseWeaponsPresetOn, moddedWeaponHUDAnimsEnabled } from '../src/combat/diverseWeapons.js';
import { modModules, modDials } from '../src/systems/features.js';
import { gunWidgetSettings, GUN_INERTIA_SCALE } from '../src/combat/gunViewmodel.js';
import { createWeaponWidget } from '../src/combat/weaponWidget.js';
import { WEAPON_TYPES, GENERAL_ANIMS } from '../src/combat/fpsWeapon.js';
import { createWeaponMachine, machineStep } from '../src/characters/weaponStates.js';
import { WEAPON_MATERIALS, WEAPONS } from '../src/characters/weapons.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('DISC14-A: in both hosts that ride, the weapons draw over the mount - the mount\'s frame, then the weapon rig, then the HUD (mutants: the rig back in the walk block; the rig drawn before the mount)', () => {
  for (const [file, gate] of [['src/scenes/world.js', 'walkMode && playerSpawned'], ['src/scenes/exterior.js', 'walkMode && !tpMode']]) {
    const src = rd(file);
    const draws = [...src.matchAll(/weaponRig\.draw\(\{ paralyzed \}\)/g)].map((m) => m.index);
    assert.equal(draws.length, 1, `${file}: the rig draws once a frame`);
    const mount = src.indexOf('mountRig.frame(dt)');
    assert.ok(mount > 0 && mount < draws[0], `${file}: the mount first (GUI.depth 2 is behind the weapons)`);
    assert.ok(src.indexOf('drawHud(renderer', draws[0]) > draws[0], `${file}: and the HUD over both`);
    assert.ok(src.includes(`if (${gate}) weaponRig.draw({ paralyzed });`), `${file}: under the walk block's own gate`);
  }
  assert.match(rd('vendor/roleplay-realism/Scripts/EnhancedRiding.cs'), /Draw horse texture behind other HUD elements & weapons[^\n]*\n\s*GUI\.depth = 2;/, 'the law, in the vendored mod');
});

// ── DISC14-B ─────────────────────────────────────────────────────────

const MAC = Object.freeze({
  'Modules.Swings': true, 'Modules.Ambidexterity': true, 'Modules.Offset': true, 'Modules.Bob': true, 'Modules.Inertia': false,
  'Modules.Step': false, 'Modules.DoubleScaleTextures': true, 'Modules.TrueTextureSize': false, 'Modules.Recoil': false,
  'Swings.Speed': 1, 'Bob.Length': 100, 'Inertia.Scale': 0,
});

test('DISC14-B: a fresh game draws Diverse Weapons with Mac\'s values - the nine modules and the tile\'s three dials as the screenshot has them, the mod on and its preset off (mutants: the preset back on; either departure back to the mod\'s default)', () => {
  _resetModSettings();
  assert.equal(moddedWeaponHUDAnimsEnabled(), true, 'Diverse Weapons is on');
  assert.equal(diverseWeaponsPresetOn(), false, 'and its preset is not laid over them');
  const store = modSettingsOf(WEAPON_WIDGET_VENDOR);
  for (const [k, v] of Object.entries(MAC)) assert.equal(store[k], v, `${k} defaults to ${v}`);
  assert.deepEqual(modModules(WEAPON_WIDGET_VENDOR).concat(modDials(WEAPON_WIDGET_VENDOR)), Object.keys(MAC), 'the tile carries exactly these twelve');
  // and what draws is what the tile shows - the widget's own reading of the store, nothing over it
  const s = readWidgetSettings();
  assert.deepEqual([s.swing, s.ambidexterity, s.offset, s.bob, s.inertia, s.stepTransforms, s.doubleScale, s.trueSize, s.recoil], [true, true, true, true, false, false, true, false, false]);
  assert.deepEqual([s.swingSpeed, s.bobLength, s.inertiaScale], [1, 1, 0], 'Swings.Speed 1, Bob.Length 100 / 100, Inertia.Scale 0 x 500');
});

test('DISC14-B: the tile shows what draws - every chip and dial reads the value the widget uses, preset off; the preset, asked for, still lays the mod\'s values over them', () => {
  _resetModSettings();
  const field = { 'Modules.Swings': 'swing', 'Modules.Ambidexterity': 'ambidexterity', 'Modules.Offset': 'offset', 'Modules.Bob': 'bob', 'Modules.Inertia': 'inertia',
    'Modules.Step': 'stepTransforms', 'Modules.DoubleScaleTextures': 'doubleScale', 'Modules.TrueTextureSize': 'trueSize', 'Modules.Recoil': 'recoil' };
  for (const [k, f] of Object.entries(field)) {
    setModSetting(WEAPON_WIDGET_VENDOR, k, !modSetting(WEAPON_WIDGET_VENDOR, k));   // a player's press on the chip
    assert.equal(readWidgetSettings()[f], modSetting(WEAPON_WIDGET_VENDOR, k), `${k}: the press reaches the weapon`);
  }
  for (const [k, v, f, want] of [['Swings.Speed', 1.5, 'swingSpeed', 1.5], ['Bob.Length', 120, 'bobLength', 1.2], ['Inertia.Scale', 0.5, 'inertiaScale', 250]]) {
    setModSetting(WEAPON_WIDGET_VENDOR, k, v);   // a turn of the dial
    assert.equal(readWidgetSettings()[f], want, `${k}: the dial reaches the weapon`);
  }
  _resetModSettings();
  setModSetting('diverse-weapons', 'WeaponWidgetPreset', true);
  const p = readWidgetSettings();
  assert.deepEqual([p.inertia, p.trueSize, p.recoil, p.bobLength], [true, true, true, 1.42], 'the mod\'s own preset, when a player asks for it');
  _resetModSettings();
});

test('DISC14-B: the Thunderlock keeps its sway - its inertia runs at the mod\'s shipped scale while the player\'s module is off, and at the player\'s own once they turn it on (mutants: the gun on the store\'s 0)', () => {
  _resetModSettings();
  assert.equal(GUN_INERTIA_SCALE, 1);
  const shipped = JSON.parse(rd('vendor/weapon-widget/modsettings.json')).Sections.find((x) => x.Name === 'Inertia').Keys.find((k) => k.Name === 'Scale').Value;
  assert.equal(GUN_INERTIA_SCALE, shipped, 'the mod\'s own value, not a number made here');
  const g = gunWidgetSettings();
  assert.deepEqual([g.inertia, g.inertiaScale], [true, 500], 'the gun\'s one declared departure, at the mod\'s scale');
  setModSetting(WEAPON_WIDGET_VENDOR, 'Modules.Inertia', true);
  setModSetting(WEAPON_WIDGET_VENDOR, 'Inertia.Scale', 0.4);
  assert.equal(gunWidgetSettings().inertiaScale, 200, 'a player who turns the module on sets its scale for the gun too');
  _resetModSettings();
  assert.equal(gunWidgetSettings({}).inertiaScale, 500, 'and the lab, which has no player, runs at the mod\'s scale');
});

// ── DISC14-C ─────────────────────────────────────────────────────────

/** The real widget walking at 60 fps: a longsword idle (100x60 classic records) on a 640x400 screen. `wHit` answers the
 *  `w_` idle with a doubled texture, as a Diverse Weapons idle is. Returns the sprite's drawn y and the arms' rect per frame. */
function walkWidget(over = {}, { wHit = false, look = [0, 0] } = {}) {
  _resetModSettings();
  const widget = createWeaponWidget({ settings: () => readWidgetSettings(() => ({ ...modSettingsOf(WEAPON_WIDGET_VENDOR), ...over })), audio: { playOneShot() {} }, rolls: () => 0, handedness: () => false, bowDrawback: () => true });
  const machine = createWeaponMachine(false, false);
  const draws = [];
  const canvas = { width: 640, height: 400 };
  const renderer = { drawScreenQuad: (tex, rect) => draws.push({ tex, rect: { ...rect } }), uploadTexture: () => 'up' };
  const records = [];
  for (let r = 0; r < 7; r++) records.push({ width: 100, height: 60, frames: Array.from({ length: r === 0 ? 1 : 5 }, (_, i) => `tex:${r}:${i}`) });
  const ctx = { renderer, canvas, entity: null, art: { weaponType: WEAPON_TYPES.LongBlade, anims: GENERAL_ANIMS, records },
    weapon: { templateIndex: WEAPONS.Longsword, group: 'Weapons', name: 'Longsword' }, weaponType: WEAPON_TYPES.LongBlade, material: WEAPON_MATERIALS.Steel, machine,
    sheathed: false, usingRightHand: true, equipCountdown: 0, shown: true, castPlaying: false, spellArmed: false, thirdPerson: false, reach: 2.5,
    motion: { grounded: true, crouching: false, riding: false, standing: false, speedRatio: 1, baseSpeed: 4, localVel: [0, 0, 4] },
    look, swingHeld: false, cursorActive: false, camera: () => ({ pos: [0, 1, 0], forward: [0, 0, 1] }), activateStarted: () => false };
  const frame = () => { machineStep(machine, 1 / 60, 50); widget.lateUpdate(1 / 60, ctx); widget.draw(renderer, canvas); widget.endOfFrame(); };
  frame();
  const w = widget._w;
  w.customMisses.add('LONGSWORD.CIF_0-0_Steel');   // no plain Diverse Weapons idle: the classic frame, unless the doubled one answers
  if (wHit) w.customCache.set([...w.customCache.keys()].find((n) => n.startsWith('w_')), { tex: 'double', width: 100, height: 60, doubled: true });
  else w.customMisses.add('w_LONGSWORD.CIF_0-0_Steel');
  const sprite = [], arms = [];
  for (let i = 0; i < 240; i++) {
    frame();
    sprite.push(draws.at(-1).rect.y);
    arms.push(widget.armsTransform({ x: 0, y: 0, w: 640, h: 400 }));
  }
  return { sprite: sprite.slice(120), arms: arms.slice(120) };
}
const pinned = (ys) => { const lo = Math.min(...ys); return ys.filter((y) => Math.abs(y - lo) < 1e-9).length; };

test('DISC14-C: the Morrowind arms bob the plain bob whatever DoubleScaleTextures says - never pinned to the screen\'s top for half a stride (mutants: the arms back on the sprite\'s position; the arms\' bob taking the doubled shape)', () => {
  const on = walkWidget({}, { wHit: true }), off = walkWidget({ 'Modules.DoubleScaleTextures': false });
  assert.deepEqual(on.arms, off.arms, 'the arms\' composite moves exactly as with the module off, even over a doubled Diverse Weapons idle');
  assert.ok(pinned(on.arms.map((r) => r.y)) <= 2, `pinned at the top on ${pinned(on.arms.map((r) => r.y))} of 120 frames (53 before the fix)`);
  assert.ok(Math.max(...on.arms.map((r) => r.y)) > 10, 'and it still bobs');
});

test('DISC14-C: a sprite takes the doubled idle\'s centred bob only over a doubled `w_` hit - a classic frame under DoubleScaleTextures bobs exactly as with it off (mutants: the bob\'s gate back to the module alone)', () => {
  const classic = walkWidget({}, { wHit: false }), plain = walkWidget({ 'Modules.DoubleScaleTextures': false });
  assert.deepEqual(classic.sprite, plain.sprite, 'no `w_` texture: the plain bob');
  assert.ok(pinned(classic.sprite) <= 2, `a classic idle pinned on ${pinned(classic.sprite)} of 120 frames (63 before the fix)`);
  const doubled = walkWidget({}, { wHit: true });
  assert.notDeepEqual(doubled.sprite, plain.sprite, 'a doubled Diverse Weapons idle keeps the mod\'s centred bob');
  assert.ok(pinned(doubled.sprite) <= 2, 'and it is not pinned either - its box sits half its size in');
});

test('DISC14-C: the arms still lag the look with Inertia on - the arms\' position is the plain bob plus the same inertia the sprite takes', () => {
  const still = walkWidget({ 'Modules.Inertia': true, 'Inertia.Scale': 1 }), glance = walkWidget({ 'Modules.Inertia': true, 'Inertia.Scale': 1 }, { look: [0.5, 0] });
  assert.notDeepEqual(glance.arms.map((r) => r.x), still.arms.map((r) => r.x), 'a glance moves the arms');
});
