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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { modSetting, modSettingsOf, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { readWidgetSettings, WEAPON_WIDGET_VENDOR } from '../src/combat/weaponWidget.js';
import { diverseWeaponsPresetOn, moddedWeaponHUDAnimsEnabled } from '../src/combat/diverseWeapons.js';
import { modModules, modDials } from '../src/systems/features.js';
import { gunWidgetSettings, GUN_INERTIA_SCALE } from '../src/combat/gunViewmodel.js';

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
