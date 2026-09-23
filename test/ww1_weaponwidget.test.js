// WW1 - WEAPON WIDGET 1.6 (RedRoryOTheGlen), THE MOD, 1:1 (2026-09-14,
// Mac: "This is our next mod I want to add 1:1 while also having it
// work with morrowind's first person view").
//
// The mod's script is a compiled DLL (FPSWeaponClone) read off the IL
// and restated in combat/weaponWidget.js method by method; the pins
// here hold that restatement to the IL's arithmetic, its settings'
// multipliers, GetWeaponRect's laws, the three coroutines following the
// port's machine where the clone follows FPSWeapon, the recoil's
// conditions, the Ambidexterity flip, the Bob and Inertia channels, and
// the seams: the Mods pane entry against the shipped modsettings, the
// Features row, the credit, the rig's late update and draw seam, the
// Morrowind arms' transform, the hosts' motion words, the look latch,
// the miss billboard, and the bundle door's spelling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createWeaponWidget, readWidgetSettings, widgetAnimTickTime, moveTowards, moveTowards2, roundHalfEven, snap,
  WEAPON_WIDGET_VENDOR, WINDUP, RECOVERY, BOB_SHAPE, STEP_CONDITION, RECOIL_CONDITION, MISS_VFX_AT, SHEATHE_CLIP, MISS_VFX,
} from '../src/combat/weaponWidget.js';
import {
  WEAPON_WIDGET_MOD, widgetTextureName, setWeaponWidgetSources, clearWeaponWidgetSources, weaponWidgetSourcesCount,
  weaponWidgetBundle, weaponWidgetImage, weaponWidgetTexturesAttached, DFMOD_KEY_PREFIX,
} from '../src/combat/weaponWidgetAssets.js';
import { DFMOD_KEY_PREFIX as SEASONS_PREFIX } from '../src/systems/seasonsIliacBayAssets.js';
import { WEAPON_TYPES, STATE_INDEX, GENERAL_ANIMS, DAGGER_ANIMS, BOW_ANIMS, WERECREATURE_ANIMS, NATIVE_W, NATIVE_H } from '../src/combat/fpsWeapon.js';
import {
  createWeaponMachine, machineAttack, machineStep, getMeleeWeaponAnimTime, CLASSIC_UPDATE_INTERVAL, HIT_FRAME_MELEE, MELEE_NUM_FRAMES,
} from '../src/characters/weaponStates.js';
import { WEAPON_MATERIALS, WEAPONS } from '../src/characters/weapons.js';
import { swingSoundFor, SOUND } from '../src/systems/soundClips.js';
import { MOD_SETTINGS, isFloatKey, isIntKey, isChoiceKey, modSettingsOf, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { FEATURES } from '../src/systems/features.js';
import { CREDITS } from '../src/ui/credits.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const T = WEAPON_TYPES, S = STATE_INDEX;
const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ~ ${b}`);

// ═══ the settings ═══════════════════════════════════════════════════════

test('WW1: the Mods pane entry is the shipped modsettings.json - every key, its kind, its range or options, its default, and the mod\'s own words where it wrote any', () => {
  const m = MOD_SETTINGS[WEAPON_WIDGET_VENDOR];
  assert.ok(m, 'the vendor entry');
  const manifest = JSON.parse(rd('vendor/weapon-widget/weapon-widget.dfmod.json'));
  assert.equal(manifest.GUID, WEAPON_WIDGET_MOD.guid);
  assert.equal(manifest.ModTitle, WEAPON_WIDGET_MOD.title);
  assert.equal(manifest.ModVersion, WEAPON_WIDGET_MOD.version);
  assert.equal(manifest.ModAuthor, WEAPON_WIDGET_MOD.author);
  assert.equal(m.title, manifest.ModTitle); assert.equal(m.author, manifest.ModAuthor);
  assert.equal(manifest.Files.filter((f) => /\.png$/i.test(f)).length, 173, 'the 173 double-scale textures the manifest names, none vendored');
  assert.ok(manifest.Files.some((f) => /FPSWeaponClone\.cs$/.test(f)), 'the one script the manifest names and the bundle does not carry');
  const shipped = JSON.parse(rd('vendor/weapon-widget/modsettings.json'));
  let n = 0;
  for (const section of shipped.Sections) {
    for (const k of section.Keys) {
      n += 1;
      const name = `${section.Name}.${k.Name}`;
      const def = m.keys[name];
      assert.ok(def, `${name} is on the pane`);
      const kind = k.$type.slice(k.$type.lastIndexOf('.') + 1);
      if (kind === 'ToggleKey') { assert.equal(typeof def.default, 'boolean', name); assert.equal(def.default, k.Value, `${name} defaults as shipped`); assert.ok(!isIntKey(def) && !isFloatKey(def) && !isChoiceKey(def), name); }
      else if (kind === 'SliderIntKey') { assert.ok(isIntKey(def), `${name} is an int slider`); assert.deepEqual([def.default, def.min, def.max], [k.Value, k.Min, k.Max], name); }
      else if (kind === 'SliderFloatKey') { assert.ok(isFloatKey(def), `${name} is a float slider`); assert.deepEqual([def.default, def.min, def.max], [k.Value, k.Min, k.Max], name); assert.ok(def.step > 0 && def.step <= (k.Max - k.Min), `${name} has a stepper`); }
      else if (kind === 'MultipleChoiceKey') { assert.ok(isChoiceKey(def), `${name} is a choice`); assert.deepEqual([...def.options], k.Options, name); assert.equal(def.default, k.Value, name); }
      else assert.fail(`${name}: an unknown key kind ${kind}`);
      if (k.Description) assert.equal(def.description, k.Description, `${name}'s description is the mod's own`);
      else assert.ok(def.description?.length > 8, `${name}: the mod wrote no description, the port did`);
    }
  }
  assert.equal(n, 41, 'the nine sections carry 41 keys');
  assert.equal(Object.keys(m.keys).length, 42, 'plus the port\'s Enabled, and nothing else');
  assert.equal(m.keys.Enabled.default, true, 'MO1: every mod is on by default');
  // the choice tables the port switches on are the shipped Options, in order
  assert.deepEqual(Object.values(WINDUP), [0, 1, 2]); assert.deepEqual(m.keys['Swings.Windup'].options, ['Hide', 'Idle', 'First Frame']);
  assert.deepEqual(Object.values(RECOVERY), [0, 1]); assert.deepEqual(m.keys['Swings.Recovery'].options, ['Hide', 'Last Frame']);
  assert.deepEqual(Object.values(BOB_SHAPE), [0, 1, 2]); assert.deepEqual(m.keys['Bob.Shape'].options, ['U', 'Sideways 8', 'Inverted U']);
  assert.deepEqual(Object.values(STEP_CONDITION), [0, 1]);
  assert.deepEqual(Object.values(RECOIL_CONDITION), [0, 1, 2, 3, 4, 5]); assert.equal(m.keys['Recoil.Condition'].options.length, 6);
  assert.deepEqual(Object.values(MISS_VFX_AT), [0, 1]);
  // the home row, the credit, the vendor note
  const row = FEATURES.find((f) => f.id === 'mod-weapon-widget');
  assert.ok(row, 'FT9: a Mod Authored row over the switch');
  assert.deepEqual([row.control.store, row.control.vendor ?? row.control.mod ?? row.control.key], ['mods', row.control.vendor ?? row.control.mod ?? row.control.key]);
  assert.match(JSON.stringify(row.control), /weapon-widget/);
  const credit = CREDITS.mods.find((c) => c.title === 'Weapon Widget');
  assert.ok(credit); assert.equal(credit.author, 'RedRoryOTheGlen'); assert.equal(credit.version, '1.6'); assert.deepEqual([...credit.vendor], ['weapon-widget']);
  assert.match(credit.link ?? '', /nexusmods\.com\/daggerfallunity\/mods\/860/);
  const readme = rd('vendor/weapon-widget/README.md');
  assert.match(readme, /RedRoryOTheGlen/); assert.match(readme, /Permission/); assert.match(readme, /173 textures/); assert.match(readme, /Weapon Widget\.dll/);
  // a float key coerces: clamped to its range, rounded to a thousandth; the pane steps it
  _resetModSettings();
  setModSetting(WEAPON_WIDGET_VENDOR, 'Swings.Speed', 7.7);
  assert.equal(modSettingsOf(WEAPON_WIDGET_VENDOR)['Swings.Speed'], 5);
  setModSetting(WEAPON_WIDGET_VENDOR, 'Swings.Speed', 1.23456);
  assert.equal(modSettingsOf(WEAPON_WIDGET_VENDOR)['Swings.Speed'], 1.235);
  setModSetting(WEAPON_WIDGET_VENDOR, 'Swings.Speed', 'x');
  assert.equal(modSettingsOf(WEAPON_WIDGET_VENDOR)['Swings.Speed'], 1, 'a non-number reads as the default');
  _resetModSettings();
  assert.match(rd('src/ui/enhancedMenu.js'), /isFloatKey\(def\)/, 'the pane has a float stepper');
  assert.match(rd('src/ui/enhancedMenu.js'), /def\.step \?\? 0\.1/, 'stepping by the key\'s own step');
});

test('WW1: LoadSettings - the fields carry the mod\'s own multipliers (Offset x10, Bob.Length /100, Size x2, SpeedMove x4, SpeedState x500, Shape x0.5, Inertia x500, Forward x0.2, Chance /100)', () => {
  _resetModSettings(); setModSetting('diverse-weapons', 'WeaponWidgetPreset', false);   // DW-CLIP: the preset defaults on
  const s = readWidgetSettings();
  assert.equal(s.enabled, true);
  assert.deepEqual([s.swing, s.ambidexterity, s.offset, s.bob, s.inertia, s.stepTransforms, s.doubleScale, s.trueSize, s.recoil], [true, true, true, true, false, false, false, false, false], 'the nine modules as shipped');
  assert.equal(s.swingWindup, WINDUP.Idle); assert.equal(s.swingRecovery, RECOVERY.Hide); assert.equal(s.swingSpeed, 1);
  assert.equal(s.offsetSpeed, 10); assert.equal(s.bobLength, 1); assert.equal(s.bobSizeXMod, 2); assert.equal(s.bobSizeYMod, 2);
  assert.equal(s.moveSmoothSpeed, 4); assert.equal(s.bobSmoothSpeed, 500); assert.equal(s.bobShape, 0); assert.equal(s.bobWhileIdle, true);
  assert.equal(s.inertiaScale, 500); assert.equal(s.inertiaSpeed, 500); near(s.inertiaForwardScale, 0.2); near(s.inertiaForwardSpeed, 0.2);
  assert.equal(s.stepLength, 1); assert.equal(s.stepCondition, STEP_CONDITION.SheatheAttackOnly);
  assert.equal(s.recoilChance, 1); assert.equal(s.recoilCondition, RECOIL_CONDITION.HitsOnly);
  assert.deepEqual([s.recoilEnvironment, s.playMissVFXEntity, s.playMissVFXEnvironment], [true, true, true]); assert.equal(s.playMissVFXPos, MISS_VFX_AT.Target);
  assert.deepEqual([s.mirrorBows, s.mirrorTwoHandedSwords, s.mirrorTwoHandedAxes, s.mirrorTwoHandedBlunts], [false, false, false, false]);
  assert.equal(s.textureScaleFactor, 1);
  // an injected store, the multipliers each on its own key
  const r = readWidgetSettings(() => ({ 'Offset.Speed': 2.5, 'Bob.Length': 50, 'Bob.SizeX': 0.5, 'Bob.SizeY': 1.5, 'Bob.SpeedMove': 0.25, 'Bob.SpeedState': 2, 'Bob.Shape': 2, 'Inertia.Scale': 0.1, 'Inertia.Speed': 2, 'Inertia.ForwardDepth': 0.5, 'Inertia.ForwardSpeed': 2, 'Recoil.Chance': 35, 'TrueTextureSize.TextureScaleFactor': 0 }));
  assert.equal(r.offsetSpeed, 25); assert.equal(r.bobLength, 0.5); assert.equal(r.bobSizeXMod, 1); assert.equal(r.bobSizeYMod, 3);
  assert.equal(r.moveSmoothSpeed, 1); assert.equal(r.bobSmoothSpeed, 1000); assert.equal(r.bobShape, 1);
  assert.equal(r.inertiaScale, 50); assert.equal(r.inertiaSpeed, 1000); near(r.inertiaForwardScale, 0.1); near(r.inertiaForwardSpeed, 0.4);
  assert.equal(r.recoilChance, 0.35); assert.equal(r.textureScaleFactor, 1, 'a zero factor would divide by nothing; floored at 1');
});

// ═══ the arithmetic ═════════════════════════════════════════════════════

test('WW1: GetAnimTickTime - the bow\'s classic 0.0625, FormulaHelper\'s melee tick, and the Swings remap over [0, 0.398] into [0.046, 0.352] (the bow\'s too)', () => {
  assert.equal(widgetAnimTickTime(T.Bow, 50, false), CLASSIC_UPDATE_INTERVAL);
  assert.equal(widgetAnimTickTime(T.LongBlade, 50, false), getMeleeWeaponAnimTime(50));
  assert.equal(widgetAnimTickTime(T.Melee, 80, false), getMeleeWeaponAnimTime(80));
  near(widgetAnimTickTime(T.LongBlade, 50, true), 0.198979, 1e-5, 'SPD 50 is the remap\'s middle - unchanged');
  near(widgetAnimTickTime(T.LongBlade, 115, true), 0.045917998999357224, 1e-9, 'SPD 115: the fastest');
  near(widgetAnimTickTime(T.LongBlade, -15, true), 0.35204100608825684, 1e-9, 'SPD -15: the slowest');
  near(widgetAnimTickTime(T.LongBlade, -40, true), 0.35204100608825684, 1e-9, 'InverseLerp clamps below that');
  near(widgetAnimTickTime(T.LongBlade, 0, true), 0.31672, 1e-4, 'SPD 0 is NOT the slowest - the remap reaches past the stat\'s floor');
  near(widgetAnimTickTime(T.Bow, 50, true), 0.093995, 1e-5, 'the IL\'s bow branch lands on the swing test: the classic tick remapped too');
});

test('WW1: Unity\'s pieces - MoveTowards (scalar and Vector2), Mathf.Round half to even, Snapping.Snap', () => {
  assert.equal(moveTowards(0, 10, 3), 3); assert.equal(moveTowards(10, 0, 3), 7); assert.equal(moveTowards(1, 2, 5), 2); assert.equal(moveTowards(2, 2, 0), 2);
  assert.deepEqual(moveTowards2([0, 0], [3, 4], 10), [3, 4]);
  assert.deepEqual(moveTowards2([0, 0], [3, 4], 2.5), [1.5, 2], 'half the way along the diagonal');
  assert.deepEqual(moveTowards2([1, 1], [1, 1], 0), [1, 1], 'no distance: the target, no division by zero');
  assert.deepEqual([0.5, 1.5, 2.5, 3.5, -0.5, -1.5].map((v) => roundHalfEven(v) + 0), [0, 2, 2, 4, 0, -2]);
  assert.deepEqual([0.49, 0.51, 2.7, -2.7].map(roundHalfEven), [0, 1, 3, -3]);
  assert.equal(snap(13, 5), 15); assert.equal(snap(12.5, 5), 10, 'half to even: 2.5 -> 2'); assert.equal(snap(17.5, 5), 20, '3.5 -> 4');
  assert.equal(snap(7, 0), 7, 'no interval: untouched');
});

// ═══ the component ══════════════════════════════════════════════════════

/** A store the widget reads: the shipped defaults with overrides. */
function settingsOf(over = {}) {
  _resetModSettings();
  setModSetting('diverse-weapons', 'WeaponWidgetPreset', false);   // DW-CLIP: the preset defaults on now - the clone's own numbers are the bench's subject
  const base = modSettingsOf(WEAPON_WIDGET_VENDOR);
  return () => readWidgetSettings(() => ({ ...base, ...over }));
}
/** The rig's art for one weapon type: 5 frames a strike, 1 the idle, 100x60 records. */
function artFor(weaponType, anims = GENERAL_ANIMS, { width = 100, height = 60 } = {}) {
  const records = [];
  for (let r = 0; r < 7; r++) records.push({ width, height, frames: Array.from({ length: r === 0 ? 1 : 5 }, (_, i) => `tex:${weaponType}:${r}:${i}`) });
  if (weaponType === T.Bow) records[0] = { width, height, frames: Array.from({ length: 7 }, (_, i) => `tex:bow:${i}`) };
  return { weaponType, anims, records };
}
const LONGSWORD = { templateIndex: WEAPONS.Longsword, group: 'Weapons', name: 'Longsword' };
const DAGGER = { templateIndex: WEAPONS.Dagger, group: 'Weapons', name: 'Dagger' };
const SHORT_BOW = { templateIndex: WEAPONS.Short_Bow, group: 'Weapons', name: 'Short Bow' };

/** A bench: the widget, a machine, a frame's inputs, and the rig's clock
 *  (the machine steps, then LateUpdate, then the draw, then the end of
 *  the frame). */
function bench({ weapon = LONGSWORD, weaponType = T.LongBlade, anims = GENERAL_ANIMS, over = {}, handedness = () => false, bowDrawback = () => true, canvas = { width: 640, height: 400 }, material = WEAPON_MATERIALS.Steel, envHit = null, missEffect = null, rolls = () => 0 } = {}) {
  const sounds = [];
  const audio = { playOneShot: (clip, volume, pitch) => sounds.push([clip, volume, pitch]) };
  const widget = createWeaponWidget({ settings: settingsOf(over), audio, rolls, missEffect, envHit, handedness, bowDrawback });
  const machine = createWeaponMachine(weaponType === T.Bow, weaponType === T.Melee);
  const draws = [];
  const renderer = { drawScreenQuad: (tex, rect, uv) => draws.push({ tex, rect: { ...rect }, uv: { ...uv } }), uploadTexture: () => 'up' };
  const ctx = {
    renderer, canvas, entity: null, art: artFor(weaponType, anims), weapon, weaponType, material, machine, sheathed: false, usingRightHand: true,
    equipCountdown: 0, shown: true, castPlaying: false, spellArmed: false, thirdPerson: false, reach: 2.5,
    motion: { grounded: true, crouching: false, riding: false, standing: true, speedRatio: 1, baseSpeed: 4, localVel: [0, 0, 0] },
    look: [0, 0], swingHeld: false, cursorActive: false, camera: () => ({ pos: [0, 1, 0], forward: [0, 0, 1] }), activateStarted: () => false,
  };
  const frame = (dt = 0.05, liveSpeed = 50) => {
    machineStep(machine, dt, liveSpeed);
    widget.lateUpdate(dt, ctx);
    widget.draw(renderer, canvas);
    widget.endOfFrame();
  };
  return { widget, machine, ctx, sounds, draws, frame, renderer };
}

test('WW1: GetWeaponRect over a base rect - Position (mirrored when flipped), Scale (never the werecreature\'s), Offset in the rect\'s own size, the Step snap on the screen\'s 64ths with half-to-even, and the floor', () => {
  const b = bench();
  b.frame();
  const w = b.widget._w;
  const base = { x: 100, y: 340, w: 50, h: 40 };   // resting on the floor of a 640x400 screen once scaled to 60 high
  w.position = [10, 20]; w.scale = [2, 1.5]; w.offset = [0.5, 0.25];
  let r = b.widget.transformRect(base, { flip: false, scaleIt: true, withOffset: true });
  // x: 100 + 10 = 110, then + (50*2) * 0.5 = 160; y: 340 + 20 = 360, then + (40*1.5) * 0.25 = 375; w 100, h 60
  assert.deepEqual(r, { x: 160, y: 375, w: 100, h: 60 });
  r = b.widget.transformRect(base, { flip: true, scaleIt: true, withOffset: true });
  assert.deepEqual(r, { x: 100 - 10 - 50, y: 375, w: 100, h: 60 }, 'flipped: the x terms subtract');
  r = b.widget.transformRect(base, { flip: false, scaleIt: false, withOffset: true });
  assert.deepEqual(r, { x: 100 + 10 + 25, y: 360 + 10, w: 50, h: 40 }, 'the werecreature keeps its size; the offset is in the unscaled size');
  r = b.widget.transformRect(base, { flip: false, scaleIt: true, withOffset: false });
  assert.deepEqual(r, { x: 110, y: 360, w: 100, h: 60 }, 'the arms\' form: no Offset');
  // the floor: the rect never rises above its resting place (screen height - h - weaponOffsetHeight)
  w.position = [0, -1000]; w.scale = [1, 1]; w.offset = [0, 0];
  r = b.widget.transformRect(base, { flip: false, scaleIt: true, withOffset: false });
  assert.equal(r.y, 400 - 40, 'clamped to the bottom-aligned resting y');
  w.position = [-20, -20]; w.offset = [0, -1];
  r = b.widget.transformRect(base, { flip: false, scaleIt: true, withOffset: true });
  assert.equal(r.y, 360, 'a lean upward cannot lift the sprite off its rest - the offset\'s upward half is the floor\'s');
  assert.equal(r.x, 80, 'sideways is free');
  w.position = [0, 1000];
  r = b.widget.transformRect(base, { flip: false, scaleIt: true, withOffset: false });
  assert.equal(r.y, 400, 'and never below the screen');
  // the Step snap: interval = stepLength * screenH / 64 = 2 * 400/64 = 12.5
  const st = bench({ over: { 'Modules.Step': true, 'Step.Length': 2 } });
  st.frame();
  const ws = st.widget._w;
  ws.position = [3, 0]; ws.scale = [1, 1]; ws.offset = [0, 0];
  r = st.widget.transformRect({ x: 100, y: 375, w: 50, h: 40 }, { flip: false, scaleIt: true, withOffset: false });
  assert.equal(r.x, 100, '103 / 12.5 = 8.24 -> 8 -> 100');
  ws.position = [6.25, 0];   // 106.25 / 12.5 = 8.5 -> half to even -> 8
  r = st.widget.transformRect({ x: 100, y: 375, w: 50, h: 40 }, { flip: false, scaleIt: true, withOffset: false });
  assert.equal(r.x, 100, 'Mathf.Round: 8.5 lands on 8');
  ws.position = [18.75, 0];   // 118.75 / 12.5 = 9.5 -> 10
  r = st.widget.transformRect({ x: 100, y: 375, w: 50, h: 40 }, { flip: false, scaleIt: true, withOffset: false });
  assert.equal(r.x, 125, '9.5 lands on 10');
  assert.equal(r.y, 375, '375 / 12.5 = 30 exactly');
  ws.position = [0, 4];   // 379 / 12.5 = 30.32 -> 30
  r = st.widget.transformRect({ x: 100, y: 375, w: 50, h: 40 }, { flip: false, scaleIt: true, withOffset: false });
  assert.equal(r.y, 375, 'y snaps on the same grid');
  const un = bench(); un.frame(); un.widget._w.position = [3, 4]; un.widget._w.scale = [1, 1]; un.widget._w.offset = [0, 0];
  assert.deepEqual(un.widget.transformRect({ x: 100, y: 375, w: 50, h: 40 }, { flip: false, scaleIt: true, withOffset: false }), { x: 103, y: 379, w: 50, h: 40 }, 'Step off: no snap');
});

test('WW1: UpdateWeapon - the three alignments over the 320x200 scale, the alignment override centring a StrikeDown\'s inner edge on the middle, the werecreature and a dagger exempt, the mirror reading the source right to left', () => {
  const b = bench({ canvas: { width: 640, height: 400 } });
  b.frame();
  // Idle, GENERAL_ANIMS: AlignRight, offset 0 - 100x60 at 2x -> 200x120 at the right edge, bottom-aligned
  assert.equal(b.widget.state, S.Idle);
  assert.deepEqual(b.widget.weaponPosition, { x: 640 - 200, y: 400 - 120, w: 200, h: 120 });
  assert.deepEqual(b.draws.at(-1).uv, { u0: 0, v0: 0, u1: 1, v1: 1 });
  assert.equal(b.draws.at(-1).tex, 'tex:0:0:0', 'the idle record\'s one frame');
  // a StrikeDown of a long blade under the alignment override: centred with the inner edge at the middle
  b.widget._w.weaponState = S.StrikeDown; b.widget._w.currentFrame = 1;
  b.widget.lateUpdate(0, b.ctx);
  assert.equal(b.widget.weaponPosition.x, 320, 'unflipped: the sprite starts at the middle');
  const bf = bench({ handedness: () => true }); bf.frame();
  assert.equal(bf.widget.flipHorizontal, true);
  bf.widget._w.weaponState = S.StrikeDown; bf.widget._w.currentFrame = 1;
  bf.widget.lateUpdate(0, bf.ctx);
  assert.equal(bf.widget.weaponPosition.x, 320 - 200, 'flipped: the sprite ends at the middle');
  bf.widget.draw(bf.renderer, bf.ctx.canvas);
  assert.deepEqual(bf.draws.at(-1).uv, { u0: 1, v0: 0, u1: 0, v1: 1 }, 'the mirror: the source read right to left');
  // the override off: FPSWeapon's own centring (mid - w/2); a StrikeLeft is not a StrikeDown/Up and keeps its table's Right
  const off = bench({ over: { 'Swings.VanillaAlignmentOverride': false } });
  off.frame();
  off.widget._w.weaponState = S.StrikeDown; off.widget._w.currentFrame = 1; off.widget.lateUpdate(0, off.ctx);
  assert.equal(off.widget.weaponPosition.x, 640 - 200, 'GENERAL StrikeDown is AlignRight without the override');
  // a dagger is exempt from the override
  const d = bench({ weapon: DAGGER, weaponType: T.Dagger, anims: DAGGER_ANIMS });
  d.frame();
  d.widget._w.weaponState = S.StrikeDown; d.widget._w.currentFrame = 1; d.widget.lateUpdate(0, d.ctx);
  assert.equal(d.widget.weaponPosition.x, 640 - 200, 'a dagger keeps AlignRight');
  // AlignLeft with an offset; AlignRight flipped takes AlignLeft for the mirror states
  const wc = bench({ weapon: { werecreatureClaws: true }, weaponType: T.Werecreature, anims: WERECREATURE_ANIMS });
  wc.frame();
  assert.equal(wc.widget.weaponPosition.x, 320 - 100, 'WERECREATURE idle: AlignCenter, FPSWeapon\'s own (mid - w/2)');
  wc.widget._w.weaponState = S.StrikeDown; wc.widget._w.currentFrame = 1; wc.widget.lateUpdate(0, wc.ctx);
  assert.equal(wc.widget.weaponPosition.x, 320, 'the werecreature is NOT in OverrideAlignment\'s exempt four (bow, bare hands, dagger, warhammer): its StrikeDown is centred too');
  const wo = bench({ weapon: { werecreatureClaws: true }, weaponType: T.Werecreature, anims: WERECREATURE_ANIMS, over: { 'Swings.VanillaAlignmentOverride': false } });
  wo.frame();
  wo.widget._w.weaponState = S.StrikeDown; wo.widget._w.currentFrame = 1; wo.widget.lateUpdate(0, wo.ctx);
  assert.equal(wo.widget.weaponPosition.x, 640 * (1 - 0.2) - 200, 'the override off - StrikeDown: AlignRight with the 0.2 offset');
  wo.widget._w.weaponState = S.StrikeUp; wo.widget._w.currentFrame = 1; wo.widget.lateUpdate(0, wo.ctx);
  assert.equal(wo.widget.weaponPosition.x, 640 * 0.2, 'StrikeUp: AlignLeft with the 0.2 offset');
  const wh = bench({ weapon: { templateIndex: WEAPONS.Warhammer, group: 'Weapons' }, weaponType: T.Warhammer }); wh.frame();
  wh.widget._w.weaponState = S.StrikeUp; wh.widget._w.currentFrame = 1; wh.widget.lateUpdate(0, wh.ctx);
  assert.equal(wh.widget.weaponPosition.x, 640 - 200, 'a warhammer is exempt: its StrikeUp keeps AlignRight');
  bf.widget._w.weaponState = S.Idle; bf.widget._w.currentFrame = 0; bf.widget.lateUpdate(0, bf.ctx);
  assert.equal(bf.widget.weaponPosition.x, 0, 'flipped idle: AlignRight becomes AlignLeft');
  assert.equal(NATIVE_W, 320); assert.equal(NATIVE_H, 200);
});

test('WW1: the Swings coroutine follows the ORIGINAL - the idle lean while the machine winds up, the release and the swing sound at its hit frame, a miss played through, the hidden recovery while the machine attacks, and the idle re-entry from below', () => {
  const b = bench();
  b.frame();
  assert.ok(machineAttack(b.machine, 'StrikeDown'));
  const seen = [];
  for (let i = 0; i < 40 && b.machine.state !== 'Idle'; i++) {
    b.frame(0.05);
    seen.push({ mf: b.machine.frame, ms: b.machine.state, st: b.widget.state, fr: b.widget.frame, tgt: [...b.widget._w.offsetTarget], anim: b.widget.animating });
  }
  // the wind-up: the machine below its hit frame, the clone idle and leaning (StrikeDown, unflipped: [1, -1])
  const windup = seen.filter((s) => s.ms !== 'Idle' && s.mf < HIT_FRAME_MELEE);
  assert.ok(windup.length >= 3, 'the machine takes ~0.4s to its hit frame at SPD 50');
  for (const s of windup) { assert.equal(s.st, S.Idle, 'Windup = Idle: the idle pose'); assert.deepEqual(s.tgt, [1, -1], 'the lean'); assert.equal(s.anim, true); }
  // the release: the swing sound once, at volume 1.1, when the machine reached its hit frame
  const swings = b.sounds.filter(([c]) => c === swingSoundFor(LONGSWORD));
  assert.equal(swings.length, 1, 'one swing sound');
  assert.deepEqual(swings[0], [SOUND.SwingMediumPitch, 1.1, 1]);
  const released = seen.findIndex((s) => s.st === S.StrikeDown);
  assert.ok(released >= 0 && seen[released].mf >= HIT_FRAME_MELEE, 'the strike shows once the original is at its hit frame');
  // a miss: the whole strike forward, frame by frame on the swing tick (0.199 / 5 = 0.04 s a frame)
  const frames = seen.slice(released).filter((s) => s.st === S.StrikeDown && s.fr >= 0).map((s) => s.fr);
  assert.equal(Math.max(...frames), MELEE_NUM_FRAMES.StrikeDown - 1, 'reaches the last frame');
  for (let i = 1; i < frames.length; i++) assert.ok(frames[i] >= frames[i - 1] || frames[i] === -1, 'monotone');
  // the recovery: Recovery = Hide, frame -1 while the original still attacks; then idle, offsetCurrent [0, 1] (a down strike re-enters straight up)
  assert.ok(seen.some((s) => s.fr === -1 && s.ms !== 'Idle'), 'hidden during the recovery');
  assert.equal(b.machine.state, 'Idle');
  assert.equal(b.widget.state, S.Idle); assert.equal(b.widget.animating, false);
  assert.deepEqual(b.widget._w.offsetCurrent, [0, 1], 'finishSwing: from below, no sideways lean for a StrikeDown');
  assert.deepEqual(b.draws.filter((d) => d.tex === undefined).length, 0);
  // Windup = First Frame holds frame 0 of the strike; Windup = Hide hides
  const ff = bench({ over: { 'Swings.Windup': WINDUP.FirstFrame } });
  ff.frame(); machineAttack(ff.machine, 'StrikeLeft'); ff.frame(0.05);
  assert.equal(ff.widget.state, S.StrikeLeft); assert.equal(ff.widget.frame, 0);
  const hd = bench({ over: { 'Swings.Windup': WINDUP.Hide } });
  hd.frame(); machineAttack(hd.machine, 'StrikeLeft'); hd.frame(0.05);
  assert.equal(hd.widget.frame, -1, 'hidden'); assert.equal(hd.draws.at(-1).tex, 'tex:0:0:0', 'nothing new drawn: the last draw is the idle before the swing');
  // the Swings module off: the vanilla coroutine plays the strike from its start on the machine's own tick
  const v = bench({ over: { 'Modules.Swings': false } });
  v.frame(); machineAttack(v.machine, 'StrikeDown'); v.frame(0.05);
  assert.equal(v.widget.state, S.StrikeDown); assert.equal(v.widget.frame, 1, 'PlayVanillaWeaponAnimation: the IL increments before its first yield (0x4170-0x418f), so frame 1 shows at once and frame 0 is the idle\'s');
});

test('WW1: OnAttackDamageCalculated and the recoil - the six conditions over hit / parry / miss, the chance roll, the clang and the thud placed at the target or the crosshair, and a hit played back in reverse', () => {
  const fx = [];
  const mk = (condition, roll = 0, over = {}) => bench({ over: { 'Modules.Recoil': true, 'Recoil.Condition': condition, 'Recoil.Chance': 50, ...over }, rolls: () => roll, missEffect: (kind, pos, opts) => fx.push({ kind, pos, opts }) });
  const R = RECOIL_CONDITION;
  const table = [
    // [condition, hit?, parry?, miss?]
    [R.HitsOnly, true, false, false], [R.HitsAndParries, true, true, false], [R.ParriesOnly, false, true, false],
    [R.ParriesAndMisses, false, true, true], [R.MissesOnly, false, false, true], [R.AllAttacks, true, true, true],
  ];
  for (const [c, hit, parry, miss] of table) {
    let b = mk(c); b.frame(); b.widget.onAttackDamageCalculated({ damage: 5, pos: [0, 1, 3] }); assert.equal(b.widget.hasCurrentAttackHit, hit, `condition ${c}: a hit`);
    b = mk(c); b.frame(); b.widget.onAttackDamageCalculated({ damage: 0, parrySounds: true, pos: [0, 1, 3] }); assert.equal(b.widget.hasCurrentAttackHit, parry, `condition ${c}: a parry`);
    b = mk(c); b.frame(); b.widget.onAttackDamageCalculated({ damage: 0, parrySounds: false, pos: [0, 1, 3] }); assert.equal(b.widget.hasCurrentAttackHit, miss, `condition ${c}: a miss`);
  }
  // the roll: Random.value < chance (0.5); 0.5 itself fails
  let b = mk(R.AllAttacks, 0.5); b.frame(); b.widget.onAttackDamageCalculated({ damage: 5 }); assert.equal(b.widget.hasCurrentAttackHit, false, 'the roll at the chance: no recoil');
  b = mk(R.AllAttacks, 0.49); b.frame(); b.widget.onAttackDamageCalculated({ damage: 5 }); assert.equal(b.widget.hasCurrentAttackHit, true);
  // the module off: nothing
  b = bench({ over: { 'Modules.Recoil': false, 'Recoil.Condition': R.AllAttacks } }); b.frame(); b.widget.onAttackDamageCalculated({ damage: 5 }); assert.equal(b.widget.hasCurrentAttackHit, false);
  // the billboards: a parry clangs, a miss thuds, 0.75 back from the point toward the camera; TEXTURE.380 record 2 at 20 fps, twice its size
  fx.length = 0;
  b = mk(R.HitsOnly); b.frame();
  b.widget.onAttackDamageCalculated({ damage: 0, parrySounds: true, pos: [0, 1, 4] });
  b.widget.onAttackDamageCalculated({ damage: 0, parrySounds: false, pos: [0, 1, 4] });
  b.widget.onAttackDamageCalculated({ damage: 3, pos: [0, 1, 4] });
  assert.deepEqual(fx.map((f) => f.kind), ['CLANG', 'THUD'], 'a hit draws nothing');
  assert.deepEqual(fx[0].pos, [0, 1, 3.25], 'the camera at [0,1,0]: 0.75 back along the line');
  assert.deepEqual(fx[0].opts, { ...MISS_VFX, emissive: true }); assert.deepEqual(fx[1].opts, { ...MISS_VFX, emissive: false });
  assert.deepEqual(MISS_VFX, { archive: 380, record: 2, fps: 20, scale: 2 });
  // at the crosshair: 0.75 of the distance along the look
  fx.length = 0;
  b = mk(R.HitsOnly, 0, { 'Recoil.MissEffectPlacement': MISS_VFX_AT.Crosshair }); b.frame();
  b.widget.onAttackDamageCalculated({ damage: 0, parrySounds: false, pos: [3, 1, 4] });
  assert.deepEqual(fx[0].pos, [0, 1, 3.75], '|[3,0,4]| = 5, 0.75 of it along forward [0,0,1]');
  // the entity effects switch off: the recoil still counts, nothing is drawn
  fx.length = 0;
  b = mk(R.AllAttacks, 0, { 'Recoil.PlayEntityMissEffects': false }); b.frame();
  b.widget.onAttackDamageCalculated({ damage: 0, parrySounds: true, pos: [0, 1, 4] });
  assert.equal(b.widget.hasCurrentAttackHit, true); assert.equal(fx.length, 0);
  // a non-enemy target with no damage: nothing (the IL's `isEnemy` gate)
  b = mk(R.AllAttacks); b.frame(); b.widget.onAttackDamageCalculated({ damage: 0, isEnemy: false, pos: [0, 1, 4] }); assert.equal(b.widget.hasCurrentAttackHit, false);
  // the environment: a wall within reach at the release (x1.25 for a StrikeUp) is a hit with a thud
  fx.length = 0;
  const reaches = [];
  const env = bench({ over: { 'Modules.Recoil': true, 'Recoil.Condition': R.HitsOnly }, envHit: (reach) => { reaches.push(reach); return [0, 1, 2]; }, missEffect: (kind, pos) => fx.push({ kind, pos }) });
  env.frame(); machineAttack(env.machine, 'StrikeUp');
  for (let i = 0; i < 12 && !env.widget.hasCurrentAttackHit; i++) env.frame(0.05);
  assert.deepEqual(reaches, [2.5 * 1.25], 'one cast at the release, the StrikeUp reach');
  assert.equal(env.widget.hasCurrentAttackHit, true); assert.deepEqual(fx.map((f) => f.kind), ['THUD']);
  // and a hit's swing: forward to the hit frame, held three ticks, then played back in reverse to 0 while the original recovers
  const frames = [];
  for (let i = 0; i < 40 && env.machine.state !== 'Idle'; i++) { env.frame(0.05); frames.push(env.widget.frame); }
  assert.equal(Math.max(...frames), HIT_FRAME_MELEE, 'a hit never passes the hit frame');
  const last = frames.lastIndexOf(HIT_FRAME_MELEE);
  const after = frames.slice(last + 1).filter((f) => f >= 0);
  assert.ok(after.length && after.every((f, i, a) => i === 0 || f <= a[i - 1]), 'then backwards');
  assert.equal(env.widget.state, S.Idle); assert.equal(env.widget.hasCurrentAttackHit, false, 'cleared at the exit');
});

test('WW1: the bow - BowDrawback on: the draw frames 0..3 on the classic tick while the original draws, the release to the last frame with the swing sound, the dip until the cooldown; off: the instant shot from frame 3', () => {
  const b = bench({ weapon: SHORT_BOW, weaponType: T.Bow, anims: BOW_ANIMS });
  b.frame();
  assert.equal(b.widget.state, S.Idle); assert.equal(b.widget.frame, 0);
  machineAttack(b.machine, 'StrikeUp');   // the draw
  const drawn = [];
  for (let i = 0; i < 8; i++) { b.frame(CLASSIC_UPDATE_INTERVAL); drawn.push(b.widget.frame); }
  assert.equal(b.widget.state, S.StrikeUp);
  assert.deepEqual(drawn.slice(0, 4), [1, 2, 3, 3], 'one frame a classic tick, then held at 3');
  assert.equal(b.sounds.filter(([c]) => c === SOUND.ArrowShoot).length, 0, 'no loose yet');
  machineAttack(b.machine, 'StrikeDown');   // the release
  const shot = [];
  for (let i = 0; i < 12 && b.machine.state !== 'Idle'; i++) { b.frame(CLASSIC_UPDATE_INTERVAL); shot.push([b.widget.state, b.widget.frame]); }
  assert.equal(b.sounds.filter(([c]) => c === SOUND.ArrowShoot).length, 1, 'the loose');
  assert.ok(shot.some(([st, fr]) => st === S.StrikeDown && fr >= 5), 'through the hit frame (the loop runs while the ORIGINAL is still loosing - the original leads the clone by a frame, so the last frame is the original\'s to end)');
  assert.ok(shot.every(([st, fr], i) => i === 0 || st !== S.StrikeDown || fr >= shot[i - 1][1]), 'monotone forward');
  assert.deepEqual(b.widget._w.offsetTarget, [0, 1], 'dipped until the cooldown');
  const cool = b.widget._w;
  for (let i = 0; i < 40 && b.widget.animating; i++) b.frame(0.05);
  assert.equal(cool.weaponState, S.Idle); assert.equal(b.widget.frame, 0); assert.equal(b.widget.animating, false);
  // drawback off: the weapon change lands on frame 3, StrikeDown, and an attack shoots from there
  const nd = bench({ weapon: SHORT_BOW, weaponType: T.Bow, anims: BOW_ANIMS, bowDrawback: () => false });
  nd.frame();
  assert.equal(nd.widget.state, S.StrikeDown); assert.equal(nd.widget.frame, 3, 'the drawn pose is the bow\'s idle without drawback');
  machineAttack(nd.machine, 'StrikeDown');
  for (let i = 0; i < 3; i++) nd.frame(CLASSIC_UPDATE_INTERVAL);
  assert.equal(nd.sounds.filter(([c]) => c === SOUND.ArrowShoot).length, 1);
});

test('WW1: Ambidexterity - the sprite in the hand you swing with (flipped for the left, for a left-hander\'s right, for MirrorBows), the module off following Handedness alone; NoDaggerMirroredStrikes swaps a dagger\'s sideways strikes; the mirror overrides compare GetItemHands to LeftOnly as the IL does', () => {
  let b = bench(); b.frame();
  assert.equal(b.widget.flipHorizontal, false);
  b.ctx.usingRightHand = false; b.frame();
  assert.equal(b.widget.flipHorizontal, true, 'the left hand: mirrored');
  b.ctx.usingRightHand = true; b.frame();
  assert.equal(b.widget.flipHorizontal, false);
  b = bench({ handedness: () => true }); b.frame();
  assert.equal(b.widget.flipHorizontal, true, 'a left-hander\'s right hand is the mirrored one');
  b.ctx.usingRightHand = false; b.frame();
  assert.equal(b.widget.flipHorizontal, false);
  b = bench({ weapon: SHORT_BOW, weaponType: T.Bow, anims: BOW_ANIMS, over: { 'Miscellaneous.MirrorBows': true } }); b.frame();
  assert.equal(b.widget.flipHorizontal, true, 'MirrorBows');
  b.ctx.usingRightHand = false; b.frame();
  assert.equal(b.widget.flipHorizontal, true, 'a bow ignores the hand: MirrorBows alone decides');
  b = bench({ over: { 'Modules.Ambidexterity': false }, handedness: () => true }); b.ctx.usingRightHand = false; b.frame();
  assert.equal(b.widget.flipHorizontal, true, 'the module off: FPSWeapon\'s own Handedness flip, the hand ignored');
  b.ctx.sheathed = true; b.ctx.usingRightHand = true;
  b = bench(); b.frame(); b.ctx.sheathed = true; b.ctx.usingRightHand = false; b.frame();
  assert.equal(b.widget.flipHorizontal, false, 'sheathed: the flip is not re-read');
  // NoDaggerMirroredStrikes: an unflipped dagger's StrikeRight plays as StrikeLeft
  const d = bench({ weapon: DAGGER, weaponType: T.Dagger, anims: DAGGER_ANIMS, over: { 'Swings.Windup': WINDUP.FirstFrame } });
  d.frame(); machineAttack(d.machine, 'StrikeRight'); d.frame(0.05);
  assert.equal(d.widget.state, S.StrikeLeft, 'the dagger never uses the other hand\'s strike');
  const d2 = bench({ weapon: DAGGER, weaponType: T.Dagger, anims: DAGGER_ANIMS, over: { 'Swings.Windup': WINDUP.FirstFrame, 'Swings.NoDaggerMirroredStrikes': false } });
  d2.frame(); machineAttack(d2.machine, 'StrikeRight'); d2.frame(0.05);
  assert.equal(d2.widget.state, S.StrikeRight, 'the setting off: as the original');
  const d3 = bench({ weapon: DAGGER, weaponType: T.Dagger, anims: DAGGER_ANIMS, over: { 'Swings.Windup': WINDUP.FirstFrame }, handedness: () => true });
  d3.frame(); machineAttack(d3.machine, 'StrikeDownLeft'); d3.frame(0.05);
  assert.equal(d3.widget.state, S.StrikeDownRight, 'flipped: the other way round');
  // the two-handed mirrors: `GetItemHands() == 2` is ItemHands.BOTH in DFU's enum (3ARMS: the port had read it as its own LeftOnly and the three switches fired on nothing)
  const c = bench({ weapon: { templateIndex: WEAPONS.Claymore, group: 'Weapons' }, over: { 'Miscellaneous.MirrorTwoHandedSwords': true } }); c.frame();
  assert.equal(c.widget.flipHorizontal, true, 'IL 0x3528: a claymore answers Both, and the swords switch mirrors it (FPSWeaponClone.cs:2378)');
  const c2 = bench({ weapon: { templateIndex: WEAPONS.Claymore, group: 'Weapons' }, over: { 'Miscellaneous.MirrorTwoHandedSwords': false } }); c2.frame();
  assert.equal(c2.widget.flipHorizontal, false, 'the switch off: as the original');
  assert.match(rd('src/combat/weaponWidget.js'), /getItemHands\(w\.specificWeapon\) !== ITEM_HANDS\.Both\) return false;/, 'the compare names Both');
});

test('WW1: Offset, Bob and Inertia - the channels the frame publishes: the sheathe slide off the screen (and the equip countdown\'s jump), the walking bob\'s rate and size, the look\'s lag with its sign by hand, the forward depth over the scale; DoubleScaleTextures\' half-size shift on the idle; the module switches each silence their channel', () => {
  // Offset: shown -> [0,0]; hidden -> the target [2,2], eased by LiveSpeed/100 * offsetSpeed (= 5 a second at SPD 50)
  let b = bench(); b.frame();
  assert.deepEqual(b.widget.offset, [0, 0]);
  b.ctx.shown = false; b.frame(0.1);
  near(b.widget.offset[0], 0.5 / Math.SQRT2, 1e-9, '0.1 s at 5/s along the diagonal to [2,2]');
  near(b.widget.offset[1], 0.5 / Math.SQRT2, 1e-9);
  for (let i = 0; i < 20; i++) b.frame(0.1);
  assert.deepEqual(b.widget.offset, [2, 2], 'off the screen - twice the sprite\'s size');
  assert.equal(b.draws.length > 0, true);
  b.ctx.shown = true; b.ctx.equipCountdown = 300; b.frame(0.1);
  assert.deepEqual(b.widget.offset, [2, 2], 'equipping: jumped off, no easing');
  b.ctx.equipCountdown = 0; for (let i = 0; i < 20; i++) b.frame(0.1);
  assert.deepEqual(b.widget.offset, [0, 0], 'drawn: back');
  const noOff = bench({ over: { 'Modules.Offset': false } }); noOff.frame(); noOff.ctx.shown = false; noOff.frame(0.1);
  assert.deepEqual(noOff.widget.offset, [0, 0], 'the module off: no slide');
  assert.equal(noOff.draws.length, 1, 'and the sprite draws only while the rig shows it');
  // the draw with the Offset module on draws whatever the show clocks say (the slide takes it off screen)
  assert.ok(b.draws.length > 22);
  // Bob: standing still with BobWhileIdle: a 0.1 stride; walking: the rate 1.25 * baseSpeed * s * bobLength, the size 1% of the screen * s * 2
  b = bench({ over: { 'Modules.Offset': false, 'Modules.Inertia': false } }); b.ctx.motion.standing = false;
  const ys = [];
  for (let i = 0; i < 40; i++) { b.frame(0.025); ys.push(b.widget.position[1]); }
  assert.ok(ys.some((y) => Math.abs(y) > 1), 'the sprite bobs while walking');
  const w = b.widget._w;
  // the frame's target, recomputed here from the mod's formula at the frame's time
  const s = 1, rate = 4 * 1.25 * s * 1, size = [640 * 0.01 * s * 2, 400 * 0.01 * s * 2];
  const tgt = [(-1 + Math.sin(w.time * rate)) * -size[0], (1 - Math.sin(w.time * rate * 2)) * size[1]];
  near(w.bobSmooth[0], tgt[0], 1e-6, 'x: the U\'s sideways term'); near(w.bobSmooth[1], tgt[1], 1e-6, 'y: twice the rate');
  assert.ok(w.bobSmooth[1] >= 0, 'the U never rises above the rest');
  // WW2: STANDING STILL - the slight idle stride (BobWhileIdle: s = 0.1, a tenth of the size and of the rate), never
  // the walking one (the world-hosted dungeon lane left `standing` unsent and the full stride played at rest)
  { const idle = bench({ over: { 'Modules.Offset': false, 'Modules.Inertia': false } }); idle.ctx.motion.standing = true;
    let maxX = 0, maxY = 0;
    for (let i = 0; i < 400; i++) { idle.frame(0.025); maxX = Math.max(maxX, Math.abs(idle.widget.position[0])); maxY = Math.max(maxY, Math.abs(idle.widget.position[1])); }
    assert.ok(maxX > 0.2 && maxY > 0.1, `the sprite bobs slightly while idle (${maxX.toFixed(2)}, ${maxY.toFixed(2)})`);
    assert.ok(maxX <= 640 * 0.01 * 0.1 * 2 * 2 + 1e-6 && maxY <= 400 * 0.01 * 0.1 * 2 * 2 + 1e-6, `and never past the 0.1 stride (${maxX.toFixed(2)} <= 2.56, ${maxY.toFixed(2)} <= 1.6) - the walking stride is ten times this`);
    const still = bench({ over: { 'Modules.Offset': false, 'Modules.Inertia': false, 'Bob.BobWhileIdle': false } }); still.ctx.motion.standing = true;
    for (let i = 0; i < 60; i++) still.frame(0.025);
    assert.deepEqual(still.widget.position, [0, 0], 'BobWhileIdle off: no bob at all while standing'); }
  b.ctx.motion.grounded = false; for (let i = 0; i < 60; i++) b.frame(0.025);
  assert.deepEqual(b.widget.position, [0, 0], 'airborne: moveSmooth eases to 0 (at 4 a second) and the bob is silenced');
  const nb = bench({ over: { 'Modules.Bob': false, 'Modules.Offset': false } }); nb.ctx.motion.standing = false; for (let i = 0; i < 10; i++) nb.frame(0.025);
  assert.deepEqual(nb.widget.position, [0, 0], 'the module off');
  // Inertia: a look to the right lags the sprite left (unflipped), right when flipped; the forward motion scales
  b = bench({ over: { 'Modules.Inertia': true, 'Modules.Bob': false, 'Modules.Offset': false } }); b.frame();
  b.ctx.look = [1, 0]; b.frame(0.05);
  assert.deepEqual(b.widget._w.inertiaTarget, [-250, 0], '(look + mx) * 0.5 * -inertiaScale (500)');
  assert.ok(b.widget.position[0] < 0, 'the sprite lags to the left');
  b.ctx.look = [0, 0];
  const fl = bench({ over: { 'Modules.Inertia': true, 'Modules.Bob': false, 'Modules.Offset': false }, handedness: () => true }); fl.frame(); fl.ctx.look = [1, 0]; fl.frame(0.05);
  assert.deepEqual(fl.widget._w.inertiaTarget, [250, 0], 'flipped: the sign turns');
  const fw = bench({ over: { 'Modules.Inertia': true, 'Modules.Bob': false, 'Modules.Offset': false } }); fw.frame();
  fw.ctx.motion.localVel = [0, 0, 5]; for (let i = 0; i < 40; i++) fw.frame(0.05);
  near(fw.widget.scale[0], 1 + 0.5 * 0.2, 1e-6, 'forward at 5: mz 0.5 * forwardScale 0.2 over the scale');
  near(fw.widget.scale[1], 1.1, 1e-6);
  near(fw.widget.position[0], -0.1 * 640 * 0.25, 1e-6, 'and the position pulled back a quarter screen per unit of scale');
  // a held swing gesture with the cursor off: only the sideways motion term, no look
  const held = bench({ over: { 'Modules.Inertia': true, 'Modules.Bob': false, 'Modules.Offset': false } }); held.frame();
  held.ctx.look = [1, 1]; held.ctx.swingHeld = true; held.ctx.motion.localVel = [2, 0, 0]; held.frame(0.05);
  assert.deepEqual(held.widget._w.inertiaTarget, [-0.2 * 0.5 * 500, 0]);
  // DoubleScaleTextures: the idle sits half its size in (the werecreature only down)
  // DW-CLIP: the shift is the DOUBLED box's - a `w_` hit under the module, and never under TrueTextureSize
  const seedDoubled = (x) => { const name = [...x.widget._w.customCache.keys()].find((n) => n.startsWith('w_')); assert.ok(name, 'asked by the w_ name'); x.widget._w.customCache.set(name, { tex: 'double', width: 100, height: 80, doubled: true }); };
  const ds = bench({ over: { 'Modules.DoubleScaleTextures': true, 'Modules.Offset': false, 'Modules.Bob': false } }); ds.frame();
  assert.deepEqual(ds.widget.offset, [0, 0], 'the classic frame (no w_ art) is not doubled, so not shifted');
  seedDoubled(ds); ds.frame();
  assert.deepEqual(ds.widget.offset, [0.5, 0.5]);
  const dw = bench({ weapon: { werecreatureClaws: true }, weaponType: T.Werecreature, anims: WERECREATURE_ANIMS, over: { 'Modules.DoubleScaleTextures': true, 'Modules.Offset': false, 'Modules.Bob': false } }); dw.frame();
  seedDoubled(dw); dw.frame();
  assert.deepEqual(dw.widget.offset, [0, 0.5]);
  const ts = bench({ over: { 'Modules.DoubleScaleTextures': true, 'Modules.TrueTextureSize': true, 'Modules.Offset': false, 'Modules.Bob': false } }); ts.frame();
  seedDoubled(ts); ts.frame();
  assert.deepEqual(ts.widget.offset, [0, 0], 'TrueTextureSize: the painting\'s own box, unshifted');
  assert.equal(ds.widget.rect.x, ds.widget.weaponPosition.x + ds.widget.weaponPosition.w * 0.5, 'GetWeaponRect carries it as a fraction of the rect');
});

test('WW1: the Morrowind arms take the frame\'s Position and Scale over their own composite and never the Offset slide; the sheathe edge rings clip 417 once; third person and a hidden weapon draw nothing', () => {
  const b = bench({ over: { 'Modules.Inertia': true, 'Modules.Bob': false } }); b.frame();
  b.ctx.shown = false; b.ctx.look = [1, 0]; b.frame(0.05);
  const w = b.widget._w;
  assert.ok(w.offset[0] > 0 && w.position[0] < 0, 'both channels live this frame');
  const arms = b.widget.armsTransform({ x: 0, y: 0, w: 640, h: 400 });
  assert.equal(arms.x, w.position[0], 'the arms slide with the inertia');
  assert.equal(arms.y, Math.max(0, w.position[1]), 'and not with the sheathe offset (clamped at the floor)');
  assert.deepEqual([arms.w, arms.h], [640 * w.scale[0], 400 * w.scale[1]]);
  const withOffset = b.widget.transformRect({ x: 0, y: 0, w: 640, h: 400 });
  assert.notEqual(withOffset.x, arms.x, 'the sprite\'s own rect carries the slide');
  // the sheathe edge: false -> true rings 417 once; the first frame initialises without ringing; drawing rings nothing (the rig's clip)
  const s = bench(); s.frame();
  assert.deepEqual(s.sounds.filter(([c]) => c === SHEATHE_CLIP), [], 'no clip on the first frame (the IL\'s false-initialised field is a boot artefact, not carried)');
  s.ctx.sheathed = true; s.frame(); s.frame();
  assert.deepEqual(s.sounds.filter(([c]) => c === SHEATHE_CLIP), [[417, 1, 1]], 'once');
  s.ctx.sheathed = false; s.frame();
  assert.deepEqual(s.sounds.filter(([c]) => c === SHEATHE_CLIP).length, 1, 'the draw is silent here');
  assert.equal(SHEATHE_CLIP, 417);
  // nothing drawn in third person, with the weapon hidden, or with no weapon type
  const t = bench(); t.frame(); const n = t.draws.length;
  t.ctx.thirdPerson = true; t.frame(); assert.equal(t.draws.length, n);
  t.ctx.thirdPerson = false; t.widget.setShowWeapon(false); t.frame(); assert.equal(t.draws.length, n, 'hideWeapon');
  t.widget.setShowWeapon(true); t.ctx.weaponType = T.None; t.frame(); assert.equal(t.draws.length, n);
  t.ctx.weaponType = T.LongBlade; t.frame(); assert.equal(t.draws.length, n + 1);
});

// ═══ the seams ══════════════════════════════════════════════════════════

test('WW1: the rig runs the clone beside the machine - the late update after the machine\'s step with the frame\'s inputs, the draw seam after the arms and before the classic sprite, the end-of-frame resume, the recoil fed from resolveHit, the arms\' transform, the hosts\' motion words, the look latch, the miss billboard', () => {
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /const widget = createWeaponWidget\(\{\s*audio, envHit: envCast, missEffect,/);
  assert.match(rig, /const widgetOn = \(\) => modSetting\('weapon-widget', 'Enabled'\);/);
  assert.match(rig, /playerWeapon\.onAttackResult = \(\{ foe, damage \}\) => widget\.onAttackDamageCalculated\(\{ damage, parrySounds: !!foe\?\.basics\?\.parrySounds, pos: foe\?\.pos \?\? foe\?\.ai\?\.pos \?\? null, isEnemy: true \}\);/);
  // SW1 widened the inner span from 2800: the shield widget's own frame
  // feed now sits inside it, between the torch component's and this one's.
  // AUDIT-THUNDERLOCK F8 widened the OUTER span from 1200: the port's own
  // weapon's voice rides the same frame, right after the machine's step,
  // because the trigger is what the ear is matching.
  // What the pin holds is the ORDER - the machine steps, then the clone's
  // LateUpdate - and that is untouched.
  assert.match(rig, /playerWeapon\.update\(dt\);[\s\S]{0,4200}?if \(widgetOn\(\) \|\| _torchesOn \|\| shieldOn\(\) \|\| thunderlockHeld\(\)\) \{[\s\S]{0,5200}if \(widgetOn\(\)\) widget\.lateUpdate\(dt, \{/, 'LateUpdate after the machine\'s Update (HT1: the torch component shares the frame\'s inputs; SW1b: the shield opens the block too)');
  assert.match(rig, /const look = takeFrameLook\(\);/, 'the look read once a frame'); assert.match(rig, /look, swingHeld: _held, cursorActive: cursorActive\(\), camera: camThunk,/);
  // SW1: the shield's coroutines resume on the same edge, in the same finally
  assert.match(rig, /try \{ return drawInner\(\{ paralyzed \}\); \} finally \{ widget\.endOfFrame\(\); shield\.endOfFrame\(\); \}/, 'WaitForEndOfFrame resumes after the draw');
  assert.match(rig, /fpArm\.setScreenTransform\(widgetOn\(\) \? \(base\) => widget\.armsTransform\(base\) : null\);/);
  // MAC-I: every sprite in this seam takes the frame's TINT now (FPSWeapon.Tint, off the room's light);
  // the ORDER and the returns are what this pin holds, and neither moved.
  // SW1b: the shield's verdict moved ABOVE the gate (its poses live in the frames `shown()` calls hidden), so the
  // step here is the one line, and `if (!shown()) return;` stops a shield-only frame before the clone and the sprite
  // MAP-WEAPON put one more rung between the arms and the shield: while a
  // map holds the screen the classic body paints none of the four below
  // (the arm's branch has returned above it, so the held-sheet pose is
  // untouched). The ORDER of the four is what this pin holds, and it did
  // not move.
  assert.match(rig, /if \(fpArm\.active\(\)\) \{[^}]*fpArm\.draw\(c\);[^}]*return; \}\s*(?:\/\/[^\n]*\n\s*)*if \(sheetWindowUp\(\)\) return;\s*(?:\/\/[^\n]*\n\s*)*if \(shieldRect\) shield\.draw\(\(index, rect, uv\) => drawShieldSprite\(index, rect, uv, fpTint\)\);\s*if \(handheldOn\(\) && c\) handheld\.draw\(renderer, c, fpTint\);\s*if \(torchOnly && !gunSliding\) return;[^\n]*\n\s*(?:\/\/[^\n]*\n\s*)*if \(!shown\(\) && !gunSliding\) return;[^\n]*\n\s*(?:\/\/[^\n]*\n\s*)*const tlArt = c && thunderlockHeld\(\) \? artFor\(playerWeapon\.weapon\) : null;\s*if \(tlArt\?\.anchor && tlArt\.unionBox\) \{ drawThunderlock\(tlArt, c, fpTint\); return; \}\s*(?:\/\/[^\n]*\n\s*)*if \(gunSliding && !shown\(\)\) return;\s*if \(widgetOn\(\) && c && widget\.draw\(renderer, c, fpTint\)\) return;/, 'the arms first, MAP-WEAPON\\u2019s map gate, SW1\\u2019s shield (the off hand, behind both), the torch, the clone, the classic sprite last');
  assert.match(rig, /const envCast = envHit \?\? \(\(reach\) => \{/, 'CheckForEnvDamage\'s cast from the host\'s collider');
  const pw = rd('src/combat/playerWeapon.js');
  assert.match(pw, /this\.onAttackResult\?\.\(\{ foe, damage \}\);/, 'OnAttackDamageCalculated\'s one consumer');
  const arm = rd('src/combat/fpArm.js');
  assert.match(arm, /setScreenTransform\(fn\) \{ screenTransform = typeof fn === 'function' \? fn : null; \}/);
  assert.match(arm, /const rect = screenTransform\(\{ x: 0, y: 0, w: W, h: H \}\);/, 'the composite\'s whole rect through the transform');
  assert.match(arm, /renderer\.drawScreenQuad\(tex, \{ x: rect\.x, y: rect\.y - up, w: rect\.w, h: rect\.h \+ up \}, \{ u0: 0, v0: phFull \/ CHAR_SPRITE_RT_SIZE, u1: pw \/ CHAR_SPRITE_RT_SIZE, v1: 0 \}\)/, 'drawn as a screen quad with the overlay\'s own uv (MAC-R1: the rect extended UP by the pad\'s share, the padded sub-rect sampled whole)');
  // WW2: the motor's words for the bob ride ONE bag (motionBagOf) at every site - a per-file grep let a second, partial
  // site in worldModes.js (the world-hosted dungeon lane) ship without `standing`, and the walking bob played at rest
  for (const [host, sites] of [['src/scenes/world.js', 1], ['src/scenes/exterior.js', 1], ['src/scenes/worldModes.js', 2], ['src/scenes/dungeon.js', 1]]) {
    const s = rd(host);
    assert.equal((s.match(/motionBagOf\(player\)/g) ?? []).length, sites, `${host}: every motion bag is the one bag`);
    assert.equal(/moveForward \|\| 0/.test(s), false, `${host}: no bag written out longhand`);
    if (host !== 'src/scenes/dungeon.js') assert.match(s, /missEffect: \(k, p, o\) => hitEffects\.showMissEffect\(k, p, o\)|missEffect:/, `${host}: the miss billboard`);
  }
  assert.match(rd('src/scenes/dungeonContext.js'), /missEffect: \(k, p, o\) => hitEffects\.showMissEffect\(k, p, o\)/);
  assert.match(rd('src/scenes/hitEffects.js'), /showMissEffect: \(kind, pos, \{ archive = BLOOD_ARCHIVE, record = 2, fps = 20, scale = 2 \} = \{\}\) => spawn\(record, pos, null, \{ archive, fps, scale \}\)/);
  // FIELD-GUN18 re-aimed this line, and it is worth saying what it was
  // holding. It matched `entry.size.map((v) => v * scale)` - the ARRAY
  // arm of a ternary whose value is a {w, h} RECORD, so the arm this
  // pin named had never once executed and the other arm was `size *
  // scale`, which is NaN. The x2 was pinned by SOURCE TEXT for a
  // branch that could not run, and a NaN size draws nothing, so
  // DoClang/DoThud has been invisible since WW1 shipped while this
  // assertion stayed green. It asks for the arithmetic that runs now.
  assert.match(rd('src/scenes/hitEffects.js'), /entry\.size = \{ w: entry\.size\.w \* scale, h: entry\.size\.h \* scale \};/, 'DoClang/DoThud\'s localScale x2');
  assert.match(rd('src/scenes/hitEffects.js'), /scale = 2 \} = \{\}\)/, '...and a miss effect is scaled unless a caller says otherwise');
  const lf = rd('src/player/lookFilter.js');
  assert.match(lf, /export function takeFrameLook\(\) \{ const v = \[_frameYaw, _framePitch\]; _frameYaw = 0; _framePitch = 0; return v; \}/);
  assert.match(lf, /_frameYaw \+= dyaw; _framePitch \+= dpitch;/, 'latched where the look is applied');
  // the bundle door registered from the textures pick, beside the seasons'
  assert.match(rd('src/scenes/shared.js'), /setWeaponWidgetSources\(names, loadTextureFile\);/);
  assert.match(rd('src/scenes/dataSource.js'), /setWeaponWidgetSources\(names, loadTextureFile\);/);
  assert.match(rd('src/systems/features.js'), /modFeature\('weapon-widget', 'Takes effect at once\.', '\w+'\)/);
});

test('WW1: the bundle door - TryImportCifRci\'s spelling with the w_ prefix and the metal\'s name (none for bare hands), the pick\'s names filtered to the mod\'s bundle and its loose PNGs, nothing attached answering null without throwing, the DFMOD prefix with one home', async () => {
  assert.equal(widgetTextureName('WEAPON04.CIF', 0, 0, WEAPON_MATERIALS.Elven), 'w_WEAPON04.CIF_0-0_Elven');
  assert.equal(widgetTextureName('WEAPON04.CIF', 1, 3, WEAPON_MATERIALS.Iron, ''), 'WEAPON04.CIF_1-3_Iron');
  assert.equal(widgetTextureName('WEAPON10.CIF', 0, 0, WEAPON_MATERIALS.None), 'w_WEAPON10.CIF_0-0', 'MetalTypes.None adds nothing');
  assert.equal(widgetTextureName('WEAPON11.CIF', 0, 0, null), 'w_WEAPON11.CIF_0-0');
  assert.equal(widgetTextureName('WEAPO104.CIF', 0, 0, WEAPON_MATERIALS.Daedric), 'w_WEAPO104.CIF_0-0_Daedric');
  const manifest = JSON.parse(rd('vendor/weapon-widget/weapon-widget.dfmod.json'));
  const shippedNames = manifest.Files.filter((f) => /\.png$/i.test(f)).map((f) => f.slice(f.lastIndexOf('/') + 1).replace(/\.png$/i, ''));
  assert.ok(shippedNames.includes('w_WEAPON04.CIF_0-0_Elven'), 'the manifest names the spelling the port asks for');
  assert.ok(shippedNames.includes('w_WEAPON10.CIF_0-0'), 'bare hands, no metal');
  assert.ok(shippedNames.every((n) => /^w_WEAPO(N\d\d|1\d\d)\.CIF_0-0(_[A-Za-z]+)?$/.test(n)), 'every shipped texture is record 0 frame 0 of a weapon file');
  assert.equal(DFMOD_KEY_PREFIX, SEASONS_PREFIX, 'one home for the stored-name prefix (audit24\'s ratchet)');
  assert.equal(DFMOD_KEY_PREFIX, 'dfmod/');
  const loads = [];
  const load = async (n) => { loads.push(n); return null; };
  assert.equal(setWeaponWidgetSources(['dfmod/Seasons.dfmod', 'dfmod/Weapon Widget.dfmod', 'dfmod/weapon-widget.dfmod', 'TEXTURE.001-0.png', 'w_WEAPON04.CIF_0-0_Elven.png', 'Textures/WEAPON04.CIF_0-0.png', 'other.txt'], load), 4, 'the two bundles spelt as the mod, the two weapon PNGs');
  assert.equal(weaponWidgetSourcesCount(), 4);
  assert.equal(await weaponWidgetBundle(), null, 'a loader answering nothing: no bundle, no throw');
  assert.deepEqual(loads, ['dfmod/Weapon Widget.dfmod', 'dfmod/weapon-widget.dfmod'], 'each bundle asked once');
  assert.equal(await weaponWidgetImage('w_WEAPON04.CIF_0-0_Elven'), null, 'the loose PNG\'s bytes are nothing either');
  assert.equal(await weaponWidgetImage('w_WEAPON04.CIF_0-0_Elven'), null, 'cached: not asked again');
  assert.equal(loads.length, 3);
  assert.equal(await weaponWidgetTexturesAttached(), true, 'a loose PNG counts as attached');
  clearWeaponWidgetSources();
  assert.equal(weaponWidgetSourcesCount(), 0);
  assert.equal(await weaponWidgetTexturesAttached(), false);
  assert.equal(await weaponWidgetImage('w_WEAPON04.CIF_0-0_Elven'), null);
  assert.equal(setWeaponWidgetSources(null, null), 0);
  assert.match(rd('src/combat/weaponWidgetAssets.js'), /import \{ DFMOD_KEY_PREFIX \} from '\.\.\/systems\/seasonsIliacBayAssets\.js';/);
  // the atlas asks the door by that name and, until it lands, draws the classic frame at the classic size.
  // DW1: WHICH file is FPSWeapon.cs:637-644's choice - Diverse Weapons is on
  // by default (MO1), so a longsword asks LONGSWORD.CIF (WeaponBasics.cs
  // GetModdedWeaponFilename); with the mod off it is WEAPON04.CIF as before.
  const b = bench({ over: { 'Modules.DoubleScaleTextures': true } }); b.frame();
  assert.equal(b.draws.at(-1).tex, 'tex:0:0:0');
  assert.ok(b.widget._w.customCache.has('w_LONGSWORD.CIF_0-0_Steel'), 'asked by TryImportCifRci\'s spelling, the per-template file under Diverse Weapons');
  assert.equal(b.widget._w.customCache.get('w_LONGSWORD.CIF_0-0_Steel'), null);
  assert.ok(!b.widget._w.customCache.has('w_WEAPON04.CIF_0-0_Steel'), 'the classic file is not asked while the per-template one is');
  const off = bench({ over: { 'Modules.DoubleScaleTextures': true } });   // (bench resets the store: flip after)
  setModSetting('diverse-weapons', 'Enabled', false);
  try {
    off.frame();
    assert.ok(off.widget._w.customCache.has('w_WEAPON04.CIF_0-0_Steel'), 'the mod off: the classic atlas name, as 1.6 asked it');
    assert.ok(!off.widget._w.customCache.has('w_LONGSWORD.CIF_0-0_Steel'));
  } finally { _resetModSettings(); }
});

test('WW4 (Mac\'s curated fix): a clone that chooses silence OWNS the draw seam - frame -1, hideWeapon and third person answer true and draw nothing, so the classic sprite never falls in behind a Hide wind-up or recovery', () => {
  const hd = bench({ over: { 'Swings.Windup': WINDUP.Hide } });
  hd.frame(); machineAttack(hd.machine, 'StrikeLeft'); hd.frame(0.05);
  assert.equal(hd.widget.frame, -1, 'hidden by the wind-up');
  const before = hd.draws.length;
  assert.equal(hd.widget.draw(hd.renderer, hd.ctx.canvas), true, 'frame -1: the seam is the clone\'s (the rig returns and draws no sprite)');
  assert.equal(hd.draws.length, before, 'and nothing was drawn');
  const b = bench(); b.frame();
  b.widget.setShowWeapon(false);
  assert.equal(b.widget.draw(b.renderer, b.ctx.canvas), true, 'a hideWeapon message: owned, silent');
  b.widget.setShowWeapon(true);
  b.ctx.thirdPerson = true;
  assert.equal(b.widget.draw(b.renderer, b.ctx.canvas), true, 'third person: owned, silent');
  b.ctx.thirdPerson = false;
  // genuine NOT-APPLICABLE still falls through to the classic sprite
  const none = bench({ weaponType: T.None }); none.frame();
  assert.equal(none.widget.draw(none.renderer, none.ctx.canvas), false, 'no weapon type: not the clone\'s');
  // and the rig's seam reads the answer exactly that way
  assert.match(rd('src/combat/weaponRig.js'), /if \(widgetOn\(\) && c && widget\.draw\(renderer, c, fpTint\)\) return;/);
});

test('WW4b (Mac\'s curated fix): after a swing under Recovery = Hide the melee idle re-enters on a DRAWABLE frame, so it slides back into view instead of staying at -1 for ever', () => {
  const b = bench();
  b.frame();
  assert.ok(machineAttack(b.machine, 'StrikeDown'));
  for (let i = 0; i < 40 && b.machine.state !== 'Idle'; i++) b.frame(0.05);
  assert.equal(b.machine.state, 'Idle'); assert.equal(b.widget.state, S.Idle);
  assert.equal(b.widget.frame, 0, 'the idle holds frame 0 again, not the recovery\'s -1');
  const before = b.draws.length;
  b.frame(0.05);
  assert.equal(b.draws.length, before + 1, 'and it draws');
  assert.equal(b.draws.at(-1).tex, 'tex:0:0:0', 'the idle sprite');
  // Recovery = LastFrame already held a real frame and is left as it was
  const lf = bench({ over: { 'Swings.Recovery': RECOVERY.LastFrame } });
  lf.frame(); machineAttack(lf.machine, 'StrikeDown');
  for (let i = 0; i < 40 && lf.machine.state !== 'Idle'; i++) lf.frame(0.05);
  assert.equal(lf.widget.state, S.Idle);
  assert.ok(lf.widget.frame >= 0, 'a real frame, untouched by the re-entry');
});

test('F1 (2026-09-17, Mac: "when thrusting with a weapon, it can be glitchy"): a StrikeUp recovers in reverse ONCE - under Recovery = Last Frame the reverse used to run again every lap until the original\'s swing ended (mutant: the latch dropped)', () => {
  const b = bench({ over: { 'Swings.Recovery': RECOVERY.LastFrame } });
  b.frame();
  assert.ok(machineAttack(b.machine, 'StrikeUp'));
  const trace = [];
  for (let i = 0; i < 80 && b.machine.state !== 'Idle'; i++) { b.frame(0.02); trace.push(b.widget.frame); }
  assert.equal(b.machine.state, 'Idle');
  // the strike went forward to its last frame, back down to 0 once, then held the last frame (the setting's pose) until the swing ended
  let descents = 0, climbsAfterReverse = 0, reversed = false;
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1], c = trace[i];
    if (a > 0 && c === a - 1) { descents++; if (c === 0) reversed = true; }
    else if (reversed && c > a && a === 0) climbsAfterReverse++;
  }
  assert.ok(trace.includes(0) && trace.includes(4), `the strike rose to 4 and came back to 0 (${trace.join(',')})`);
  assert.equal(descents, 4, `one reverse of four steps (${trace.join(',')})`);
  assert.ok(climbsAfterReverse <= 1, `after the reverse the frame is set to the last once and held, never reversed again (${trace.join(',')})`);
  // and under the shipped Hide the reverse runs once too, then the hidden frame
  const h = bench();
  h.frame(); machineAttack(h.machine, 'StrikeUp');
  const t2 = [];
  for (let i = 0; i < 80 && h.machine.state !== 'Idle'; i++) { h.frame(0.02); t2.push(h.widget.frame); }
  let d2 = 0; for (let i = 1; i < t2.length; i++) if (t2[i - 1] > 0 && t2[i] === t2[i - 1] - 1) d2++;
  assert.equal(d2, 4, `Hide: one reverse (${t2.join(',')})`);
});
