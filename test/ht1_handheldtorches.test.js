// HT1 - HANDHELD TORCHES 1.4.1 (RedRoryOTheGlen), THE MOD, 1:1 (2026-09-14,
// Mac: "Next mod to integrate 1:1 is this").
//
// The mod's script is a compiled DLL (four MonoBehaviours) read off the
// IL and restated in systems/handheldTorches.js (the component: the
// hand law, the keys, the first-person sprite) and scenes/droppedTorches.js
// (the pool: the dropped and thrown lights, the burning foe); the pins
// here hold that restatement to the IL's laws - UpdateFreeHand's table
// with its `== LeftOnly` quirk, the stow / drop / ignite / douse / throw
// actions with their messages and clips, the sprite's three placements
// and GetSpriteRect, the Bob and Inertia channels, the burn on the world
// clock, the pickup's ceil(time / 20), the projectile's step, bounce and
// rest, the foe set alight - and the seams: the Mods pane entry against
// the shipped modsettings (TextKey and the two Tuple kinds are new for
// it), the KeyCode table, the Features row, the credit, the rig's frame
// and draw seam, the five hosts, PlayerTorch's offset override, the save
// envelope.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createHandheldTorches, readTorchSettings, torchItemWords, spriteUrl, rotateAboutAxis,
  HANDHELD_TORCHES_VENDOR, HANDHELD_TORCHES_MOD, ON_STOW, ON_PICK, BOB_SHAPE, STEP_CONDITION, FREE_HAND,
  DROPPED_ARCHIVE, SPRITE_ARCHIVE, DROPPED_RECORD, CLIPS, MESSAGES, ANIMATION_TIME, DROP_FORWARD_CAST, DROP_DOWN_CAST,
  THROW_HAND_OFFSET, THROW_STRENGTH_MIN, THROW_STRENGTH_MAX, TORCH_LIGHT_AT, SECONDS_PER_CONDITION,
  throwArcPoints, TRAJECTORY_STEPS, TRAJECTORY_FIXED_DT, TRAJECTORY_SPEED, TRAJECTORY_GRAVITY,
} from '../src/systems/handheldTorches.js';
import {
  createDroppedTorches, ENEMY_LIGHT_EFFECT_KEY, ENEMY_FIRE_KIND, PUFF, ENEMY_LIGHT_LOCAL, PICKUP_REACH, PROJECTILE_FIXED_DT, PROJECTILE,
  WATER_HEAD, droppedTextureUrl,
} from '../src/scenes/droppedTorches.js';
import { domCodeForKeyCode, keyCodeForDomCode, isBindableKeyCode, KEYCODE_NONE } from '../src/systems/keyCodes.js';
import { MOD_SETTINGS, isIntKey, isFloatKey, isChoiceKey, isTextKey, isTupleKey, modSettingsOf, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { BOB_SHAPE as WW_BOB_SHAPE, STEP_CONDITION as WW_STEP_CONDITION } from '../src/combat/weaponWidget.js';
import { FEATURES } from '../src/systems/features.js';
import { DEFAULT_BINDINGS } from '../src/systems/inputActions.js';   // HT4: the keys DFU already answers
import { CREDITS } from '../src/ui/credits.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { EQUIP_SLOTS, ITEM_HANDS, getItemHands } from '../src/systems/equip.js';
import { SOUND } from '../src/systems/soundClips.js';
import { setWorldMinutes, worldMinutes } from '../src/systems/worldTick.js';
import { GLOBAL_SCALE, RAY_DISTANCE } from '../src/player/activate.js';
import { NATIVE_W, NATIVE_H } from '../src/combat/fpsWeapon.js';
import { playerTorchOffsetOverride, setPlayerTorchOffsetOverride, playerTorchLight, TORCH_OFFSET } from '../src/systems/playerTorch.js';
import { isTransformedLycanthrope } from '../src/systems/lycanthropy.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} ~ ${b}`);
const V = HANDHELD_TORCHES_VENDOR;
const T = TEMPLATES;
const settle = () => new Promise((r) => setTimeout(r, 5));

const defaults = () => Object.fromEntries(Object.entries(MOD_SETTINGS[V].keys).map(([k, d]) => [k, d.default]));
const torch = (cond = 50) => ({ group: 'UselessItems2', templateIndex: T.Torch, currentCondition: cond, maxCondition: 50 });
const lantern = (cond = 100) => ({ group: 'UselessItems2', templateIndex: T.Lantern, currentCondition: cond, maxCondition: 100 });
const candle = () => ({ group: 'UselessItems2', templateIndex: T.Candle, currentCondition: 16, maxCondition: 16 });
const holy = () => ({ group: 'ReligiousItems', templateIndex: T.Holy_candle, currentCondition: 20, maxCondition: 20 });
const weapon = (t) => ({ group: 'Weapons', templateIndex: t });
const shield = () => ({ group: 'Armor', templateIndex: 109 });   // a buckler: LeftOnly

/** A component with a fake frame: the store is live (flip a key between frames), the pool and audio record. */
function rig(over = {}, deps = {}) {
  const store = { ...defaults(), ...over };
  const said = [], shots = [], loops = [], sheathes = [];
  const audio = {
    playOneShot: (c, v, p) => shots.push([c, v, p]),
    loop: (c, v) => { const l = { clip: c, volume: v, stopped: false, stop() { this.stopped = true; } }; loops.push(l); return l; },
    play3d: (c, pos, v) => shots.push([c, v, 'at', pos]),
  };
  const entity = { items: [], equip: { slots: {} }, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const pool = { spawned: [], thrown: [], spawnLightSource: (t, p, time) => pool.spawned.push({ t, p, time }), spawnLightSourceProjectile: (...a) => pool.thrown.push(a), setOnPickedUp() {} };
  const keys = new Set();
  const h = createHandheldTorches({
    settings: () => readTorchSettings(() => store), audio, say: (l) => said.push(l), rolls: () => 0.5, torches: () => pool,
    handedness: deps.handedness ?? (() => false), loadSprite: deps.loadSprite ?? (async () => null),
  });
  const machine = { state: 'Idle' };
  const ctx = {
    renderer: deps.renderer ?? null, canvas: deps.canvas ?? { width: 640, height: 400 }, entity, machine, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => deps.collider ?? null, keyDown: (c) => keys.has(c), sheathWeapons: () => { ctx.sheathed = true; sheathes.push(1); },
  };
  const frame = (dt = 0.016) => { h.update(dt, ctx); h.lateUpdate(dt, ctx); };
  const press = (code, dt = 0.016) => { keys.add(code); frame(dt); };
  const release = (code, dt = 0.016) => { keys.delete(code); frame(dt); };
  const tap = (code) => { press(code); release(code); };
  return { h, store, said, shots, loops, entity, pool, keys, ctx, machine, frame, press, release, tap, sheathes };
}

// ═══ the settings ═══════════════════════════════════════════════════════

test('HT1: the Mods pane entry is the shipped modsettings.json - every key, its kind (TextKey and the two Tuple kinds new for it), its range or options, its default, the mod\'s own words where it wrote any; the manifest, the row, the credit, the README, the coercions and the pane', () => {
  const m = MOD_SETTINGS[V];
  assert.ok(m, 'the vendor entry');
  const manifest = JSON.parse(rd('vendor/handheld-torches/handheld-torches.dfmod.json'));
  assert.equal(manifest.GUID, HANDHELD_TORCHES_MOD.guid);
  assert.equal(manifest.ModTitle, HANDHELD_TORCHES_MOD.title); assert.equal(manifest.ModVersion, HANDHELD_TORCHES_MOD.version); assert.equal(manifest.ModAuthor, HANDHELD_TORCHES_MOD.author);
  assert.equal(m.title, manifest.ModTitle); assert.equal(m.author, manifest.ModAuthor);
  assert.equal(manifest.Files.filter((f) => /\.png$/i.test(f)).length, 39, 'the 39 textures the manifest names - the author\'s own art, vendored');
  assert.equal(manifest.Files.filter((f) => /\.cs$/.test(f)).length, 4, 'the four scripts the manifest names and the bundle does not carry');
  for (let f = 0; f < 4; f++) assert.ok(rd(`vendor/handheld-torches/Textures/${SPRITE_ARCHIVE}_0-${f}.png`).length > 0, `the torch hand's frame ${f}`);
  for (let f = 0; f < 4; f++) assert.ok(rd(`vendor/handheld-torches/Textures/${DROPPED_ARCHIVE}_0-${f}_Emission.png`).length > 0, `the dropped torch's emission twin ${f}`);
  assert.ok(rd(`vendor/handheld-torches/Textures/${DROPPED_ARCHIVE}_10-0.png`).length > 0, 'the doused torch');
  const shipped = JSON.parse(rd('vendor/handheld-torches/modsettings.json'));
  // MODS-ON (2026-09-14, Mac: "all mods should be on by default"): the
  // keys whose default the port sets against the bundle's, listed here
  // rather than by loosening the compare - so this pin still holds
  // every OTHER key to the shipped value, and a departure that arrives
  // without a decision behind it fails right here.
  //
  // HT4 (2026-09-15, Mac: "Pressing tab drops torches, tab is reserved
  // for the menu"): the second one. The mod ships Tab for the manual
  // drop and in Daggerfall Unity that is free; PX15 spent Tab on the
  // port's own pixel dial, so the shipped default landed on a key this
  // port had already answered and one press did both things. G is free
  // in DFU's defaults and in the mod's other two keys. The class is
  // pinned below ("no vendored mod ships a key the port has already
  // spent") so the next mod folded in cannot repeat it quietly.
  //
  // SOC5 (2026-09-16, Mac: "Players should be able to interact with others
  // in the world upon encountering them by pressing F on their body"): the
  // THIRD one, and the same class as HT4 exactly one key over. The mod ships
  // F for the ignite/douse toggle and DFU leaves F free; SOC5 spends it on
  // the port's own SocialInteract, so the shipped default would light a
  // torch on the same press that opens the F-menu on a player - and online
  // forces every vendored mod on, so it would do it for everyone by
  // default. O is free in DFU's defaults, in this mod's other two keys and
  // in every other vendored mod. The class pin below is what caught it.
  // HT5: and Bob - the widget ships its Bob on, so the torch hand's follows (the third departure, stated in the table).
  //
  // HT7 (2026-09-17, Mac: "Take care of both"): the FOURTH, and the first
  // that is not about a key. The mod ships `OnStow = Drop` and HT6
  // recorded what that means now that the hand law runs at the equip
  // moment: equipping a shield with your weapon drawn puts the lit torch
  // on the floor, in front of the player, while the window is open. The
  // port defaults it to Unequip - the light goes back to the pack and
  // RememberLastLightSource lights it again when a hand comes free -
  // and the mod's own value is one click away on the dial, which is
  // pinned below with both options in the shipped order.
  const PORT_DEFAULT = Object.freeze({ 'Modules.Sprite': true, 'Modules.Bob': true, 'Handling.ManualDropInput': 'G', 'Handling.ToggleLightInput': 'O', 'Handling.OnStow': 0 });
  let n = 0;
  const kinds = new Set();
  for (const section of shipped.Sections) {
    for (const k of section.Keys) {
      n += 1;
      const name = `${section.Name}.${k.Name}`;
      const def = m.keys[name];
      assert.ok(def, `${name} is on the pane`);
      const kind = k.$type.slice(k.$type.lastIndexOf('.') + 1);
      kinds.add(kind);
      if (kind === 'ToggleKey') { assert.equal(typeof def.default, 'boolean', name); assert.equal(def.default, PORT_DEFAULT[name] ?? k.Value, `${name} defaults as shipped`); assert.ok(!isIntKey(def) && !isFloatKey(def) && !isChoiceKey(def) && !isTextKey(def) && !isTupleKey(def), name); }
      else if (kind === 'SliderIntKey') { assert.ok(isIntKey(def), `${name} is an int slider`); assert.deepEqual([def.default, def.min, def.max], [k.Value, k.Min, k.Max], name); }
      else if (kind === 'SliderFloatKey') { assert.ok(isFloatKey(def), `${name} is a float slider`); assert.deepEqual([def.default, def.min, def.max], [k.Value, k.Min, k.Max], name); assert.ok(def.step > 0 && def.step <= (k.Max - k.Min), `${name} has a stepper`); }
      else if (kind === 'MultipleChoiceKey') { assert.ok(isChoiceKey(def), `${name} is a choice`); assert.deepEqual([...def.options], k.Options, name); assert.equal(def.default, PORT_DEFAULT[name] ?? k.Value, name); }   // HT7: the OPTIONS are always the mod's, in its order - only the chosen one may depart, and only by being named above
      else if (kind === 'TextKey') { assert.ok(isTextKey(def), `${name} is a text key`); assert.equal(def.default, PORT_DEFAULT[name] ?? k.Value, `${name} defaults to the shipped KeyCode name`); assert.ok(isBindableKeyCode(def.default), `${name}'s default parses`); }
      else if (kind === 'TupleIntKey' || kind === 'TupleFloatKey') {
        assert.ok(isTupleKey(def), `${name} is a tuple`); assert.equal(def.tuple, kind === 'TupleIntKey' ? 'int' : 'float', name);
        const v = Array.isArray(k.Value) ? k.Value : [k.Value.First, k.Value.Second];
        assert.deepEqual([...def.default], v, `${name} defaults as shipped`);
      } else assert.fail(`${name}: an unknown key kind ${kind}`);
      if (k.Description) assert.equal(def.description, k.Description, `${name}'s description is the mod's own`);
      else assert.ok(def.description?.length > 8, `${name}: the mod wrote no description, the port did`);
    }
  }
  assert.equal(n, 52, 'the eight sections carry 52 keys');
  assert.equal(Object.keys(m.keys).length, 53, 'plus the port\'s Enabled, and nothing else');
  assert.deepEqual([...kinds].sort(), ['MultipleChoiceKey', 'SliderFloatKey', 'SliderIntKey', 'TextKey', 'ToggleKey', 'TupleFloatKey', 'TupleIntKey']);
  assert.equal(m.keys.Enabled.default, true, 'MO1: every mod is on by default');
  // the choice tables the port switches on are the shipped Options, in order; the widget's two are the SAME tables (one home)
  assert.deepEqual(Object.values(ON_STOW), [0, 1]); assert.deepEqual(m.keys['Handling.OnStow'].options, ['Unequip', 'Drop']);
  assert.deepEqual(Object.values(ON_PICK), [0, 1, 2]); assert.deepEqual(m.keys['Handling.OnPick'].options, ['Store', 'Equip', 'Force Equip']);
  assert.equal(BOB_SHAPE, WW_BOB_SHAPE); assert.equal(STEP_CONDITION, WW_STEP_CONDITION);
  assert.deepEqual(m.keys['Bob.Shape'].options, ['U', 'Sideways 8', 'Inverted U']); assert.deepEqual(m.keys['Step.Condition'].options, ['Sheathe/Attack Only', 'All Transforms']);
  // the home row, the credit, the vendor note
  const row = FEATURES.find((f) => f.id === 'mod-handheld-torches');
  assert.ok(row, 'FT9: a Mod Authored row over the switch');
  assert.equal(row.control.store, 'mods'); assert.equal(row.control.key, 'Enabled'); assert.match(JSON.stringify(row.control), /handheld-torches/);
  assert.equal(row.effect, 'Takes effect at once.', 'the component reads its switches every frame');
  const credit = CREDITS.mods.find((c) => c.title === 'Handheld Torches');
  assert.ok(credit); assert.equal(credit.author, 'RedRoryOTheGlen'); assert.equal(credit.version, '1.4.1'); assert.deepEqual([...credit.vendor], ['handheld-torches']);
  assert.match(credit.link ?? '', /nexusmods\.com\/daggerfallunity\/mods\/780/);
  const readme = rd('vendor/handheld-torches/README.md');
  assert.match(readme, /RedRoryOTheGlen/); assert.match(readme, /Permission/); assert.match(readme, /39/); assert.match(readme, /Handheld Torches\.dll/);
  assert.match(readme, /author's own pixel art/, 'why the textures ARE vendored, against the doctrine\'s ARENA2 line');
  // a text key coerces: trimmed, an empty one reads as the default; a tuple: a pair, ints truncated, floats to a thousandth, anything else the default
  _resetModSettings();
  setModSetting(V, 'Handling.ToggleLightInput', ' Q ');
  assert.equal(modSettingsOf(V)['Handling.ToggleLightInput'], 'Q');
  setModSetting(V, 'Handling.ToggleLightInput', '   ');
  assert.equal(modSettingsOf(V)['Handling.ToggleLightInput'], 'O', 'an empty name reads as the default');   // SOC5: the default is O - the port spends F on SocialInteract now
  setModSetting(V, 'Throwing.Magnitude', [3.7, 9]);
  assert.deepEqual([...modSettingsOf(V)['Throwing.Magnitude']], [3, 9]);
  setModSetting(V, 'Throwing.Magnitude', [1, 2, 3]);
  assert.deepEqual([...modSettingsOf(V)['Throwing.Magnitude']], [1, 2], 'not a pair: the default');
  setModSetting(V, 'Presentation.Offset', [0.12345, 1]);
  assert.deepEqual([...modSettingsOf(V)['Presentation.Offset']], [0.123, 1]);
  setModSetting(V, 'Presentation.Offset', 'x');
  assert.deepEqual([...modSettingsOf(V)['Presentation.Offset']], [0.5, 0.5]);
  _resetModSettings();
  const pane = rd('src/ui/enhancedMenu.js');
  assert.match(pane, /\} else if \(isTextKey\(def\)\) \{/, 'the pane has a key capture');
  assert.match(pane, /b\.textContent = 'press a key';/);
  assert.match(pane, /const name = e\.code === 'Escape' \? null : keyCodeForDomCode\(e\.code\);/, 'the capture spells the key as Unity would; Escape cancels');
  assert.match(pane, /\} else if \(isTupleKey\(def\)\) \{/, 'the pane has a pair of steppers');
  assert.match(pane, /const stepOf = def\.tuple === 'int' \? 1 : \(def\.step \?\? 0\.1\);/);
});

test('HT1: the KeyCode table - Unity\'s names to the DOM codes the port polls and back, case-sensitive, None and a stranger parsing to nothing, the mouse as the held set spells it', () => {
  assert.equal(domCodeForKeyCode('F'), 'KeyF'); assert.equal(domCodeForKeyCode('Tab'), 'Tab'); assert.equal(domCodeForKeyCode('X'), 'KeyX');
  assert.equal(domCodeForKeyCode('Alpha1'), 'Digit1'); assert.equal(domCodeForKeyCode('Keypad5'), 'Numpad5'); assert.equal(domCodeForKeyCode('Return'), 'Enter');
  assert.equal(domCodeForKeyCode('LeftShift'), 'ShiftLeft'); assert.equal(domCodeForKeyCode('BackQuote'), 'Backquote'); assert.equal(domCodeForKeyCode('Mouse0'), 'Mouse0');
  assert.equal(domCodeForKeyCode('F12'), 'F12'); assert.equal(domCodeForKeyCode(' Tab '), 'Tab', 'trimmed as the pane stores it');
  assert.equal(domCodeForKeyCode('f'), null, 'Enum.TryParse is case-sensitive');
  assert.equal(domCodeForKeyCode(KEYCODE_NONE), null); assert.equal(domCodeForKeyCode('Joystick1Button0'), null, 'a member the keyboard cannot produce');
  assert.equal(domCodeForKeyCode(42), null); assert.equal(domCodeForKeyCode(null), null);
  assert.equal(keyCodeForDomCode('KeyF'), 'F'); assert.equal(keyCodeForDomCode('Digit0'), 'Alpha0'); assert.equal(keyCodeForDomCode('Enter'), 'Return');
  assert.equal(keyCodeForDomCode('Escape'), 'Escape'); assert.equal(keyCodeForDomCode('Fn'), null, 'no KeyCode member: the pane refuses the capture');
  for (const k of ['A', 'Z', 'Alpha9', 'Keypad0', 'F1', 'Space', 'LeftControl', 'RightAlt', 'UpArrow', 'Semicolon', 'KeypadEnter', 'Mouse2']) assert.equal(keyCodeForDomCode(domCodeForKeyCode(k)), k, `${k} round-trips`);
  assert.ok(isBindableKeyCode('F') && !isBindableKeyCode('None') && !isBindableKeyCode(''));
});

test('HT1: LoadSettings - the fields carry the mod\'s own multipliers (Speed x2000, Bob.Length /100, Size x2, SpeedMove x4, SpeedState x500, Shape x0.5, Inertia x500, Forward x0.2), the keys as KeyCodes, the shipped defaults', () => {
  _resetModSettings();
  const s = readTorchSettings();
  assert.equal(s.enabled, true);
  assert.deepEqual([s.toggleKey, s.dropKey, s.throwKey], ['KeyO', 'KeyG', 'KeyX'], 'the three bindings, parsed (HT4: the drop key is G - the mod ships Tab, which the port spends on the pixel dial; SOC5: the toggle is O - the mod ships F, which the port now spends on SocialInteract)');
  // HT7: the port's default is Unequip - the mod ships Drop and the dial
  // still offers it, which the pane pin above holds in the mod's own
  // order. LoadSettings reads whatever the store says, so what is pinned
  // here is that it reads it, and that the DEFAULT store says Unequip.
  assert.equal(s.onStow, ON_STOW.Unequip); assert.equal(s.onPick, ON_PICK.Equip); assert.equal(s.lastLight, true);
  assert.deepEqual([s.stowOnSpellcasting, s.stowOnClimbing, s.stowOnSwimming, s.twoHandedRelaxed, s.lanternRelaxed], [true, true, true, true, false]);
  assert.deepEqual([s.throwStrength, s.throwAngle, s.throwSpread, s.throwGravity, s.throwBounce, s.throwScale, s.throwDrawTrajectory], [1, 15, 1, 1, 0.5, 1, true]);
  assert.deepEqual([s.fire, s.fireAccuracy, s.fireDuration, s.fireChance, s.fireDamageRange, s.fireLight, s.fireLightShadows], [true, 50, 3, 50, [1, 2], true, false]);
  // MODS-ON: the SPRITE is the port's own default now (the mod's whole
  // subject, invisible without it - see the HT2 audit); the other three
  // are presentation and stay as the bundle ships them.
  assert.deepEqual([s.showSprite, s.bob, s.inertia, s.stepTransforms], [true, true, false, false], 'the sprite is ON by the port\'s decision, and Bob with it (HT5: in step with Weapon Widget\'s shipped Bob); Inertia and Step ship OFF as the widget\'s do');
  assert.deepEqual([s.mirrorSprite, s.tintSprite, s.playAudio, s.sfxVolume, s.offsetX, s.offsetY, s.scale, s.offsetSpeed, s.lockAspectRatio], [false, true, true, 0.5, 0.5, 0.5, 0.8, 2000, true]);
  assert.deepEqual([s.bobLength, s.bobOffset, s.bobSizeXMod, s.bobSizeYMod, s.moveSmoothSpeed, s.bobSmoothSpeed, s.bobShape, s.bobWhileIdle], [1, 0, 2, 2, 4, 500, 0, true]);
  assert.equal(s.inertiaScale, 500); assert.equal(s.inertiaSpeed, 500); near(s.inertiaForwardScale, 0.2); near(s.inertiaForwardSpeed, 0.2);
  assert.deepEqual([s.stepLength, s.stepCondition, s.scaleTextureFactor], [1, STEP_CONDITION.SheatheAttackOnly, 1]);
  // an injected store, the multipliers each on its own key
  const r = readTorchSettings(() => ({ ...defaults(), 'Presentation.Speed': 0.5, 'Bob.Length': 50, 'Bob.SizeX': 0.5, 'Bob.SizeY': 1.5, 'Bob.SpeedMove': 0.25, 'Bob.SpeedState': 2, 'Bob.Shape': 2,
    'Inertia.Scale': 0.1, 'Inertia.Speed': 2, 'Inertia.ForwardDepth': 0.5, 'Inertia.ForwardSpeed': 2, 'Compatibility.TextureScaleFactor': 0,
    'Handling.ToggleLightInput': 'Joystick1Button0', 'Throwing.Magnitude': [2, 5], 'Handling.OnStow': 0 }));
  assert.equal(r.offsetSpeed, 1000); assert.equal(r.bobLength, 0.5); assert.equal(r.bobSizeXMod, 1); assert.equal(r.bobSizeYMod, 3);
  assert.equal(r.moveSmoothSpeed, 1); assert.equal(r.bobSmoothSpeed, 1000); assert.equal(r.bobShape, 1);
  assert.equal(r.inertiaScale, 50); assert.equal(r.inertiaSpeed, 1000); near(r.inertiaForwardScale, 0.1); near(r.inertiaForwardSpeed, 0.4);
  assert.equal(r.scaleTextureFactor, 1, 'a zero factor would divide the sprite by nothing; floored at 1');
  assert.equal(r.toggleKey, null, 'the mod\'s "Detected an invalid key code": KeyCode.None, the key never fires');
  assert.deepEqual(r.fireDamageRange, [2, 5]); assert.equal(r.onStow, ON_STOW.Unequip);
  assert.equal(torchItemWords(torch()), 'new torch', 'Condition().ToLower() + " " + LongName.ToLower()');
  assert.equal(torchItemWords(lantern(10)), 'battered lantern');
  assert.match(spriteUrl(1, 2), /vendor\/handheld-torches\/Textures\/112359_1-2\.png$/);
  assert.match(droppedTextureUrl(0, 3, true), /Textures\/112358_0-3_Emission\.png$/);
  assert.equal(SECONDS_PER_CONDITION, 20); assert.equal(ANIMATION_TIME, 0.0625); assert.deepEqual([DROP_FORWARD_CAST, DROP_DOWN_CAST, THROW_HAND_OFFSET], [1.45, 145, 0.35]);
  assert.deepEqual([THROW_STRENGTH_MIN, THROW_STRENGTH_MAX], [0.25, 2], 'the wind-up clamp, as the IL writes it (0x19a6) - the literals, not the constants compared to themselves');
  assert.deepEqual([TRAJECTORY_STEPS, TRAJECTORY_FIXED_DT, TRAJECTORY_SPEED, TRAJECTORY_GRAVITY], [300, 0.02, 25, 9.8], 'DrawTrajectory\'s own numbers - 9.8, NOT the flight\'s 9.81');
  assert.deepEqual([CLIPS.burning, CLIPS.drop, CLIPS.throwSwing, CLIPS.douse, CLIPS.ignite, CLIPS.stow], [420, 380, 106, 381, 16, 417]);
  assert.equal(CLIPS.burning, SOUND.Burning); assert.equal(CLIPS.ignite, SOUND.Ignite);
});

// ═══ the hand law ═══════════════════════════════════════════════════════

test('HT1: UpdateFreeHand - the table over the two slots: a bare right hand in use, a one-hander, a shield, a bow taking both, a two-hander freeing the off-hand by the IL\'s `== LeftOnly` compare, sheathed, and the four stows (spell, climb, swim, lycanthrope)', () => {
  const r = rig();
  const hands = () => [r.h._w.handLeft, r.h._w.handRight];
  const slots = r.entity.equip.slots;
  // two frames each: UpdateFreeHand reads the slots, WeaponManager.Sheathed and UsingRightHand LIVE (IL 0x2c8a, 0x2cfc), but the cast, the climb and the swim are the mod's own fields latched in LateUpdate (0x1eea-0x1f25) after Update read them - the mod's own frame of lag on those three
  r.frame = ((f) => () => { f(); f(); })(r.frame);
  r.frame(); assert.deepEqual(hands(), [true, false], 'empty hands, the right in use: the left is free'); assert.equal(r.h.freeHand, FREE_HAND.Left);
  r.ctx.usingRightHand = false; r.frame(); assert.deepEqual(hands(), [true, true], 'the right not in use: both'); assert.equal(r.h.freeHand, FREE_HAND.Left, 'GetFreeHand names the left first');
  r.ctx.usingRightHand = true;
  slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Dagger); r.frame(); assert.deepEqual(hands(), [false, false], 'a dagger in the left, the bare right in use: none'); assert.equal(r.h.freeHand, FREE_HAND.None); assert.equal(r.h.hasFreeHand, false);
  delete slots[EQUIP_SLOTS.LeftHand]; slots[EQUIP_SLOTS.RightHand] = weapon(WEAPONS.Dagger); r.frame(); assert.deepEqual(hands(), [true, false], 'a dagger in the right: the left is free');
  slots[EQUIP_SLOTS.RightHand] = weapon(WEAPONS.Claymore);
  assert.equal(getItemHands(weapon(WEAPONS.Claymore)), ITEM_HANDS.Both, 'a claymore answers Both');
  r.frame(); assert.deepEqual(hands(), [true, false], 'IL 0x2d1a compares to LeftOnly (2), never Both (4): a two-hander in the right leaves the left free');
  r.store['Handling.RelaxedTwoHandedWeapons'] = false; r.frame(); assert.deepEqual(hands(), [true, false], 'the relaxed switch changes nothing - the arm fires on nothing a right hand holds');
  r.store['Handling.RelaxedTwoHandedWeapons'] = true;
  slots[EQUIP_SLOTS.LeftHand] = shield(); slots[EQUIP_SLOTS.RightHand] = weapon(WEAPONS.Dagger); r.frame(); assert.deepEqual(hands(), [false, false], 'a shield and a dagger: none');
  delete slots[EQUIP_SLOTS.RightHand]; r.ctx.usingRightHand = false; r.frame(); assert.deepEqual(hands(), [false, true], 'a shield alone, the right not in use: the right'); assert.equal(r.h.freeHand, FREE_HAND.Right);
  r.ctx.usingRightHand = true;
  slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow); r.frame(); assert.deepEqual(hands(), [false, false], 'a bow in the left takes both');
  // HT7: sheathed, a bow in the left slot now takes BOTH hands, as it does
  // drawn - the mod's sheathed arm cleared the left alone and is gone.
  r.ctx.sheathed = true; r.frame(); assert.deepEqual(hands(), [false, false], 'HT7: sheathed, the bow takes both hands, as drawn');
  // HT7 (2026-09-17, Mac: "Take care of both") - THE ONE DEPARTURE FROM
  // THIS ARM. The mod clears a hand while sheathed only for a BOW, so a
  // shield or a dagger in the left slot took nothing and a lit torch
  // stayed in that hand with the weapon on your back. HT6 recorded that
  // and defended it (a Daggerfall shield is armour, strapped rather than
  // gripped) and flagged it for Mac, whose ORIGINAL report was that very
  // case. A hand holding something is not free, sheathed or drawn.
  slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Dagger); r.frame();
  assert.deepEqual(hands(), [false, true], 'HT7: sheathed, a dagger in the left slot takes the left hand too');
  slots[EQUIP_SLOTS.LeftHand] = shield(); r.frame();
  assert.deepEqual(hands(), [false, true], 'HT7: and a SHIELD does - the case Mac reported');
  slots[EQUIP_SLOTS.RightHand] = weapon(WEAPONS.Dagger); r.frame();
  assert.deepEqual(hands(), [false, false], 'HT7: a sword and a shield, weapon lowered - BOTH hands are taken, which is what stows the torch');
  delete slots[EQUIP_SLOTS.RightHand];
  delete slots[EQUIP_SLOTS.LeftHand]; r.frame();
  assert.deepEqual(hands(), [true, true], 'sheathed with nothing worn, both hands are free - a bare hand you are not swinging with is not in use (0x2d53)');
  slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Dagger);
  r.ctx.sheathed = false; delete slots[EQUIP_SLOTS.LeftHand]; r.ctx.usingRightHand = false;
  r.frame(); assert.deepEqual(hands(), [true, true]);
  r.ctx.castPlaying = true; r.frame(); assert.deepEqual(hands(), [false, false], 'casting stows'); r.ctx.castPlaying = false;
  r.ctx.spellArmed = true; r.frame(); assert.deepEqual(hands(), [false, false], 'a readied spell too');
  r.store['Handling.StowWhenSpellcasting'] = false; r.frame(); assert.deepEqual(hands(), [true, true], 'the switch off'); r.ctx.spellArmed = false;
  r.ctx.climbing = true; r.frame(); assert.deepEqual(hands(), [false, false]); r.store['Handling.StowWhenClimbing'] = false; r.frame(); assert.deepEqual(hands(), [true, true]); r.ctx.climbing = false;
  r.ctx.swimming = true; r.frame(); assert.deepEqual(hands(), [false, false]); r.store['Handling.StowWhenSwimming'] = false; r.frame(); assert.deepEqual(hands(), [true, true]); r.ctx.swimming = false;
  r.ctx.transformedLycanthrope = true; r.frame(); assert.deepEqual(hands(), [false, false], 'a transformed lycanthrope has no hands for it, no switch'); r.ctx.transformedLycanthrope = false;
  assert.equal(isTransformedLycanthrope({}), false, 'the port\'s read of EntityEffectManager.IsTransformedLycanthrope');
  // the table is read from the slots as they stand - never minted (the rig's worn sync reads the same slot)
  const bare = rig(); delete bare.entity.equip; bare.frame(); assert.equal(bare.entity.equip, undefined, 'no equip table appears'); assert.deepEqual([bare.h._w.handLeft, bare.h._w.handRight], [true, false]);
});

test('HT1: Ambidexterity - the sprite in the free hand (flipped for the right), both busy keeping the last, the module off following Handedness; a flip writes PlayerTorch\'s position (a lantern lower) and dispose clears it', () => {
  setPlayerTorchOffsetOverride(null);
  const r = rig({ 'Presentation.Ambidexterity': true });
  const slots = r.entity.equip.slots;
  r.frame = ((f) => () => { f(); f(); })(r.frame);
  r.ctx.usingRightHand = false; r.frame(); assert.equal(r.h.flipped, false, 'both free, a right-hander: unflipped');
  slots[EQUIP_SLOTS.LeftHand] = shield(); r.frame(); assert.equal(r.h.flipped, true, 'the left busy, the right free: flipped into the right');
  slots[EQUIP_SLOTS.RightHand] = weapon(WEAPONS.Dagger); r.frame(); assert.equal(r.h.flipped, true, 'both busy: the last');
  delete slots[EQUIP_SLOTS.LeftHand]; delete slots[EQUIP_SLOTS.RightHand]; r.frame(); assert.equal(r.h.flipped, false);
  assert.equal(playerTorchOffsetOverride(), null, 'no light: the flip writes nothing');
  r.entity.items = [torch()]; r.entity.lightSource = r.entity.items[0];
  slots[EQUIP_SLOTS.LeftHand] = shield(); r.frame();
  assert.deepEqual(playerTorchOffsetOverride(), { left: -TORCH_LIGHT_AT.torch.left, up: 0.9, forward: 0.25 }, 'the torch light to the right hand (0x2f1c)');
  delete slots[EQUIP_SLOTS.LeftHand]; r.frame();
  assert.deepEqual(playerTorchOffsetOverride(), { left: 0.34, up: 0.9, forward: 0.25 }, 'and back to the left');
  r.entity.items = [lantern()]; r.entity.lightSource = r.entity.items[0];
  slots[EQUIP_SLOTS.LeftHand] = shield(); r.frame();
  assert.deepEqual(playerTorchOffsetOverride(), { left: 0.26, up: 0, forward: 0.25 }, 'a lantern hangs low, unsigned (0x2f50)');
  const lit = { _torch: { range: 5 } };
  const at = playerTorchLight(lit, [10, 0, 20], 0);
  near(at.x, 10 - 0.26); near(at.y, 0); near(at.z, 20.25); assert.equal(at.range, 5, 'playerTorchLight reads the override');
  r.h.dispose();
  assert.equal(playerTorchOffsetOverride(), null, 'dispose clears it');
  const back = playerTorchLight(lit, [10, 0, 20], 0); near(back.y, TORCH_OFFSET.up, 1e-9, 'DFU\'s own offset again');
  const left = rig({ 'Presentation.Ambidexterity': false }, { handedness: () => true });
  left.frame(); assert.equal(left.h.flipped, true, 'the module off: Handedness alone');
});

test('HT1: the hand law each frame - no free hand stows a lit torch (Unequip remembers it, Drop drops it at the casts), a hand freed lights it again; a lantern is stowed with the message unless relaxed; a sheathed player is not told', () => {
  const r = rig({ 'Handling.OnStow': ON_STOW.Unequip });
  const t = torch(); r.entity.items = [t]; r.entity.lightSource = t;
  const slots = r.entity.equip.slots;
  slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow); r.frame();
  assert.equal(r.entity.lightSource, null, 'stowed'); assert.equal(r.h.lastLightSource, t, 'remembered'); assert.deepEqual(r.said, []);
  assert.deepEqual(r.entity.items, [t], 'still in the pack');
  delete slots[EQUIP_SLOTS.LeftHand]; r.frame();
  assert.equal(r.entity.lightSource, t, 'a hand freed: lit again'); assert.equal(r.h.lastLightSource, null);
  // Drop: the cast 1.45 forward from the body's centre, 145 down; the pool takes it with its seconds; the pack loses it
  const casts = [];
  const collider = { raycast: (o, d, max) => { casts.push([o, d, max]); return d[1] < 0 ? o[1] : 0.5; } };
  const d = rig({ 'Handling.OnStow': ON_STOW.Drop }, { collider });
  const t2 = torch(37); d.entity.items = [t2]; d.entity.lightSource = t2;
  d.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow); d.frame();
  assert.equal(d.pool.spawned.length, 1);
  assert.deepEqual(d.pool.spawned[0], { t: T.Torch, p: [0, 0, 0.5], time: 37 * SECONDS_PER_CONDITION }, 'currentCondition x 20 seconds, at the floor under the point 1.45 ahead');
  assert.deepEqual(casts[0], [[0, 0.9, 0], [0, 0, 1], DROP_FORWARD_CAST]); assert.deepEqual(casts[1], [[0, 0.9, 0.5], [0, -1, 0], DROP_DOWN_CAST]);
  assert.equal(d.entity.lightSource, null); assert.deepEqual(d.entity.items, [], 'gone from the pack');
  assert.deepEqual(d.said, ['You drop the slightly used torch']); assert.deepEqual(d.shots[0], [CLIPS.drop, 1, 'at', [0, 0, 0.5]], 'the drop clip at the spot');
  assert.equal(d.h.lastLightSource, null, 'a dropped light is not remembered');
  // a lantern: stowed with the message, never dropped; relaxed it stays lit
  const l = rig({ 'Handling.OnStow': ON_STOW.Drop });
  const ln = lantern(); l.entity.items = [ln]; l.entity.lightSource = ln;
  l.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow); l.frame();
  assert.equal(l.entity.lightSource, null); assert.equal(l.h.lastLightSource, ln); assert.deepEqual(l.said, [MESSAGES.noFreeHand]); assert.equal(l.pool.spawned.length, 0);
  delete l.entity.equip.slots[EQUIP_SLOTS.LeftHand]; l.frame(); assert.equal(l.entity.lightSource, ln);
  l.store['Handling.RelaxedLanterns'] = true; l.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow); l.frame();
  assert.equal(l.entity.lightSource, ln, 'relaxed: a lantern needs no hand'); assert.equal(l.said.length, 1);
  // sheathed and climbing: stowed silently
  const q = rig(); const ln2 = lantern(); q.entity.items = [ln2]; q.entity.lightSource = ln2;
  q.ctx.sheathed = true; q.ctx.climbing = true; q.frame(); q.frame();   // LateUpdate latches the climb; the next Update reads it (the mod's own frame of lag)
  assert.equal(q.entity.lightSource, null); assert.deepEqual(q.said, [], 'the sheathed player is not told');
});

// ═══ the keys and the actions ═══════════════════════════════════════════

test('HT1: the ignite / douse key - the ladder lantern, torch, candle, holy candle; the ignite clip at half volume and the douse clip; RememberLastLightSource re-lights the kind last doused; nothing to light says so; no free hand refuses (a relaxed lantern excepted)', () => {
  const r = rig();
  r.entity.items = [holy(), candle(), torch(), lantern()];
  r.tap('KeyO');
  assert.equal(r.entity.lightSource?.templateIndex, T.Lantern, 'a lantern first'); assert.deepEqual(r.said, ['You ignite the new lantern']);
  assert.deepEqual(r.shots, [[CLIPS.ignite, 0.5, 1]], 'PlayOneShot(16, 0, 0.5)');
  r.tap('KeyO');
  assert.equal(r.entity.lightSource, null); assert.equal(r.said[1], 'You douse the new lantern'); assert.deepEqual(r.shots[1], [CLIPS.douse, 1, 1]);
  r.press('KeyO'); r.frame(); r.frame(); assert.equal(r.said.length, 3, 'GetKeyDown: one edge, however long the key is held'); r.release('KeyO');
  r.entity.lightSource = null; r.said.length = 0;
  // the memory: the torch lit by the key, doused, and a lantern added - the key picks the torch again
  const m = rig();
  m.entity.items = [torch()]; m.tap('KeyO'); assert.equal(m.entity.lightSource?.templateIndex, T.Torch);
  m.tap('KeyO'); assert.equal(m.entity.lightSource, null);
  m.entity.items.push(lantern()); m.tap('KeyO'); assert.equal(m.entity.lightSource?.templateIndex, T.Torch, 'the kind last doused, over the ladder');
  m.tap('KeyO'); m.store['Handling.RememberLastLightSource'] = false; m.tap('KeyO'); assert.equal(m.entity.lightSource?.templateIndex, T.Lantern, 'the switch off: the ladder');
  const stowed = rig(); const t = torch(); stowed.entity.items = [t]; stowed.entity.lightSource = t;
  stowed.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow); stowed.store['Handling.OnStow'] = ON_STOW.Unequip; stowed.frame();
  assert.equal(stowed.h.lastLightSource, t);
  delete stowed.entity.equip.slots[EQUIP_SLOTS.LeftHand]; stowed.entity.equip.slots[EQUIP_SLOTS.RightHand] = weapon(WEAPONS.Dagger);
  stowed.frame(); assert.equal(stowed.entity.lightSource, t, 'the stowed light comes back when a hand frees');
  const none = rig(); none.tap('KeyO'); assert.deepEqual(none.said, [MESSAGES.igniteTorchless]); assert.deepEqual(none.shots, []);
  const busy = rig(); busy.entity.items = [lantern()]; busy.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow);
  busy.tap('KeyO'); assert.deepEqual(busy.said, [MESSAGES.noFreeHand]); assert.equal(busy.entity.lightSource, null);
  busy.store['Handling.RelaxedLanterns'] = true; busy.tap('KeyO'); assert.equal(busy.entity.lightSource?.templateIndex, T.Lantern, 'relaxed: a lantern in the pack lights with no hand');
});

test('HT1: the drop key - the lit light unless a lantern, else a torch, a candle, a holy candle; lanterns are never dropped; nothing to drop says so; no free hand refuses', () => {
  const r = rig();
  const t = torch(); r.entity.items = [candle(), t]; r.entity.lightSource = t;
  r.tap('KeyG'); assert.deepEqual(r.pool.spawned.map((s) => s.t), [T.Torch], 'the lit torch'); assert.equal(r.entity.lightSource, null); assert.deepEqual(r.entity.items.map((i) => i.templateIndex), [T.Candle]);
  assert.equal(r.said[0], 'You drop the new torch');
  r.tap('KeyG'); assert.deepEqual(r.pool.spawned.map((s) => s.t), [T.Torch, T.Candle], 'then the candle from the pack');
  r.entity.items = [holy(), lantern()]; r.entity.lightSource = r.entity.items[1];
  r.tap('KeyG'); assert.deepEqual(r.pool.spawned.map((s) => s.t), [T.Torch, T.Candle, T.Holy_candle], 'a lit lantern is skipped for the holy candle');
  assert.equal(r.entity.lightSource?.templateIndex, T.Lantern, 'the lantern stays lit');
  r.tap('KeyG'); assert.equal(r.said.at(-1), MESSAGES.dropTorchless); assert.equal(r.pool.spawned.length, 3);
  r.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow); r.entity.items = [torch()]; r.entity.lightSource = null;
  r.tap('KeyG'); assert.equal(r.said.at(-1), MESSAGES.noFreeHand); assert.equal(r.pool.spawned.length, 3);
  assert.equal(r.h._w.hasDroppedOrThrownLight, false, 'the sheathe jump flag is consumed by the next LateUpdate');
});

test('HT1: the throw key - the press douses the lit light (a relaxed lantern excepted) with a torch in the pack, the hold winds up by ThrowScaleSpeed and draws the arc, the release throws the lit torch or the first in the pack at a strength clamped to [0.25, 2] from the free hand; no torch says so; no free hand refuses', () => {
  const r = rig({ 'Throwing.ThrowScaleSpeed': 2 });
  const ln = lantern(); r.entity.items = [ln, torch(30), torch(20)]; r.entity.lightSource = ln;
  r.press('KeyX', 0.1);
  assert.equal(r.entity.lightSource, null, 'the wind-up douses the lantern (0x18d9)');
  near(r.h._w.throwTimer, 0.2, 1e-9, 'dt x ThrowScaleSpeed');
  near(r.h.throwStrength, THROW_STRENGTH_MIN, 1e-9, 'AUDIT 66 F9: the wind-up the arc would be drawn at, published; the arc itself is no longer integrated per frame - nothing can draw it');
  r.frame(0.1); r.frame(0.1); near(r.h._w.throwTimer, 0.6, 1e-9);
  r.release('KeyX');
  assert.equal(r.pool.thrown.length, 1);
  const [tmpl, time, centre, dir, strength, hand] = r.pool.thrown[0];
  assert.equal(tmpl, T.Torch); assert.equal(time, 30 * SECONDS_PER_CONDITION, 'the first torch in the pack, its seconds');
  assert.deepEqual(centre, [0, 0.9, 0]); assert.deepEqual(dir, [0, 0, 1]); near(strength, 0.6); assert.equal(hand, FREE_HAND.Left);
  assert.deepEqual(r.entity.items.map((i) => i.templateIndex), [T.Lantern, T.Torch], 'gone from the pack');
  assert.deepEqual(r.shots.at(-1), [CLIPS.throwSwing, 1, 1]); assert.equal(r.said.at(-1), 'You throw the used torch');
  assert.equal(r.h._w.throwTimer, 0);
  // the clamp: a tap throws at a quarter, a long hold at twice
  r.tap('KeyX'); near(r.pool.thrown[1][4], THROW_STRENGTH_MIN);
  r.entity.items.push(torch()); r.press('KeyX', 5); r.release('KeyX'); near(r.pool.thrown[2][4], THROW_STRENGTH_MAX);
  // a lit torch: the press douses it (0x18f9), so the release takes the FIRST torch in the pack - the lit one only when it is first (ThrowLightSourceAction's lit arm is reached from the key by nothing; kept as the mod has it)
  const lit = rig(); const t = torch(9); lit.entity.items = [t, torch(50)]; lit.entity.lightSource = t;
  lit.press('KeyX'); assert.equal(lit.entity.lightSource, null, 'doused on the press');
  lit.release('KeyX'); assert.equal(lit.pool.thrown[0][1], 9 * SECONDS_PER_CONDITION); assert.equal(lit.entity.items.length, 1);
  const second = rig(); const t2 = torch(9); second.entity.items = [torch(50), t2]; second.entity.lightSource = t2;
  second.tap('KeyX'); assert.equal(second.pool.thrown[0][1], 50 * SECONDS_PER_CONDITION, 'the lit torch second in the pack: the first goes'); assert.equal(second.entity.items[0], t2);
  // a relaxed lantern is not doused by the wind-up
  const rl = rig({ 'Handling.RelaxedLanterns': true }); const ln2 = lantern(); rl.entity.items = [ln2, torch()]; rl.entity.lightSource = ln2;
  rl.press('KeyX'); assert.equal(rl.entity.lightSource, ln2);
  rl.release('KeyX'); assert.equal(rl.pool.thrown.length, 1);
  const none = rig(); none.entity.items = [candle()]; none.press('KeyX'); assert.deepEqual(none.said, [MESSAGES.throwTorchless]); none.release('KeyX'); assert.equal(none.said.at(-1), MESSAGES.throwTorchless, 'the release too');
  const busy = rig(); busy.entity.items = [torch()]; busy.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow);
  busy.press('KeyX'); assert.deepEqual(busy.said, [MESSAGES.noFreeHand]); busy.release('KeyX'); assert.equal(busy.pool.thrown.length, 0); assert.equal(busy.said.length, 2);
  assert.deepEqual(rotateAboutAxis([0, 0, 1], [1, 0, 0], -15).map((v) => Math.round(v * 1e6) / 1e6), [0, Math.round(Math.sin(15 * Math.PI / 180) * 1e6) / 1e6, Math.round(Math.cos(15 * Math.PI / 180) * 1e6) / 1e6], 'Quaternion.AngleAxis(-angle, right): the look tilted up');
});

test('HT1: the burning loop - a lit TORCH plays clip 420 at AudioVolume while PlayerTorchAudio is on, a lantern or a candle does not, a douse stops it, a volume change restarts it', () => {
  const r = rig();
  const t = torch(); r.entity.items = [t]; r.entity.lightSource = t; r.frame();
  assert.equal(r.loops.length, 1); assert.deepEqual([r.loops[0].clip, r.loops[0].volume], [CLIPS.burning, 0.5]); assert.equal(r.h.burning, true);
  r.frame(); assert.equal(r.loops.length, 1, 'one loop');
  r.store['Presentation.AudioVolume'] = 1; r.frame(); assert.equal(r.loops.length, 2); assert.equal(r.loops[0].stopped, true); assert.equal(r.loops[1].volume, 1);
  r.entity.lightSource = null; r.frame(); assert.equal(r.loops[1].stopped, true); assert.equal(r.h.burning, false);
  r.entity.items = [lantern()]; r.entity.lightSource = r.entity.items[0]; r.frame(); assert.equal(r.loops.length, 2, 'a lantern burns silently');
  r.entity.items = [t]; r.entity.lightSource = t; r.store['Presentation.PlayerTorchAudio'] = false; r.frame(); assert.equal(r.loops.length, 2, 'the switch off');
  r.store['Presentation.PlayerTorchAudio'] = true; r.frame(); assert.equal(r.loops.length, 3);
  r.h.dispose(); assert.equal(r.loops[2].stopped, true, 'dispose stops it');
});

test('HT1: PickupLightSource\'s pack half - Store stows with the clip, Equip lights it in a free hand or stows it as the light to take up, Force Equip sheathes the weapons to light it; a lit light already stows', () => {
  const s = rig({ 'Handling.OnPick': ON_PICK.Store });
  s.frame(); s.h.receivePickedUp(torch(12));
  assert.deepEqual(s.entity.items.map((i) => i.templateIndex), [T.Torch]); assert.equal(s.entity.lightSource, null);
  assert.deepEqual(s.said, ['You stow the worn torch']); assert.deepEqual(s.shots, [[CLIPS.stow, 1, 1]]);
  const e = rig({ 'Handling.OnPick': ON_PICK.Equip });
  e.frame(); e.h.receivePickedUp(torch());
  assert.equal(e.entity.lightSource?.templateIndex, T.Torch); assert.deepEqual(e.said, ['You pick up the new torch']);
  e.h.receivePickedUp(candle()); assert.equal(e.entity.lightSource?.templateIndex, T.Torch, 'a light already lit: the candle is stowed'); assert.equal(e.said.at(-1), 'You stow the new candle');
  const busy = rig({ 'Handling.OnPick': ON_PICK.Equip }); busy.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow); busy.frame();
  const t = torch(); busy.h.receivePickedUp(t);
  assert.equal(busy.entity.lightSource, null); assert.equal(busy.h.lastLightSource, t, 'stowed as the light to take up when a hand frees'); assert.equal(busy.said.at(-1), 'You stow the new torch');
  delete busy.entity.equip.slots[EQUIP_SLOTS.LeftHand]; busy.frame(); assert.equal(busy.entity.lightSource, t);
  const f = rig({ 'Handling.OnPick': ON_PICK.ForceEquip }); f.entity.equip.slots[EQUIP_SLOTS.LeftHand] = weapon(WEAPONS.Long_Bow); f.frame();
  f.h.receivePickedUp(torch());
  assert.equal(f.sheathes.length, 1, 'the weapons sheathed'); assert.equal(f.entity.lightSource?.templateIndex, T.Torch); assert.equal(f.said.at(-1), 'You pick up the new torch');
});

// ═══ the sprite ═════════════════════════════════════════════════════════

/** The mod's textures, as the loader hands them over: the torch hand 90x205 x4, the lantern 110x138 x4. */
const loadSprite = async (record, frame) => (frame < 4 ? (record === 0 ? { width: 90, height: 205, colors: null } : record === 1 ? { width: 110, height: 138, colors: null } : null) : null);   // TEX1: `colors`, the shape the real door answers and uploadTexture reads
const fakeRenderer = () => { const r = { uploads: [], quads: [], uploadTexture: (a, k, img) => { const t = { a, k, img }; r.uploads.push(t); return t; }, drawScreenQuad: (tex, rect, uv) => r.quads.push({ tex, rect, uv }) }; return r; };

test('HT1: InitializeTextures, the three placements and GetSpriteRect - the guard by Offset over the screen, the attack at the corner, the sheathe a height below it, the slide at offsetSpeedLive (thrice off), the lantern\'s frames at 4, a candle without a sprite, the frame clock, Scale, the Step snap, third person and the module off drawing nothing', async () => {
  const renderer = fakeRenderer();
  const r = rig({ 'Modules.Sprite': true, 'Modules.Bob': false }, { renderer, loadSprite });   // HT5: Bob ships on now; this pin measures the placements alone
  const t = torch(); r.entity.items = [t]; r.entity.lightSource = t;
  r.frame(); await r.h._w.texturesLoading;
  assert.equal(r.h._w.textures.length, 8); assert.deepEqual([r.h._w.animTorchLength, r.h._w.animLanternLength], [4, 4]);
  assert.deepEqual(renderer.uploads.slice(0, 2).map((u) => u.k), [`ht:${SPRITE_ARCHIVE}_0-0`, `ht:${SPRITE_ARCHIVE}_0-1`]);
  // SetGuard over 640x400 (scale 2, the aspect locked): in from the left by half the width x 0.5, up from the bottom by a quarter of the height x 0.5; 90x205 at 0.8 x 2
  r.frame(1); r.frame(1);
  assert.deepEqual(r.h.positionTarget, { x: 160, y: 350, w: 144, h: 328 });
  assert.deepEqual(r.h.positionCurrent, r.h.positionTarget, 'arrived: dt x offsetSpeedLive (Speed 50 / 100 x 2000)');
  assert.deepEqual(r.h.rect, { x: 88, y: 186, w: 144, h: 328 }, 'the centre to the corner');
  assert.equal(r.h.draw(renderer, r.ctx.canvas), true); assert.deepEqual(renderer.quads[0].rect, { x: 88, y: 186, w: 144, h: 328 }); assert.deepEqual(renderer.quads[0].uv, { u0: 0, v0: 0, u1: 1, v1: 1 });
  // the Offset knob: x is half the width times it, y a quarter of the height (read when the sprite is placed, as the mod reads it at LoadSettings)
  const o = rig({ 'Modules.Sprite': true, 'Presentation.Offset': [1, 0] }, { renderer: fakeRenderer(), loadSprite });
  o.entity.items = [torch()]; o.entity.lightSource = o.entity.items[0]; o.frame(); await o.h._w.texturesLoading; o.frame(1); o.frame(1);
  assert.deepEqual([o.h.positionTarget.x, o.h.positionTarget.y], [320, 400]);
  // SetAttack: the bottom corner, the sprite's centre on it
  r.machine.state = 'StrikeDown'; r.frame(1); r.frame(1);
  assert.deepEqual([r.h.positionTarget.x, r.h.positionTarget.y], [0, 400]);
  assert.deepEqual(r.h.rect, { x: -72, y: 236, w: 144, h: 328 }, 'the centre on the corner: half of it below the bottom');
  r.h._w.positionCurrent = { ...r.h._w.positionCurrent, y: 900 }; assert.equal(r.h.rect.y, 400, 'the floor: the top never below the screen\'s bottom (0x1301)');
  r.h._w.positionCurrent = { ...r.h._w.positionCurrent, y: -900 }; assert.equal(r.h.rect.y, 400 - 328, 'nor the bottom above the HUD floor');
  r.machine.state = 'Idle'; r.frame(1); assert.deepEqual([r.h.positionTarget.x, r.h.positionTarget.y], [160, 350], 'the guard again');
  // Scale grows the rect about its centre; the Step snap on the screen's 64ths
  r.frame(1); r.h._w.scale = [0.5, 0.5]; assert.deepEqual(r.h.rect, { x: 160 - 108, y: 350 - 246, w: 216, h: 492 });
  r.h._w.scale = [0, 0]; r.store['Modules.Step'] = true; r.store['Step.Length'] = 2; r.frame(1);
  const iv = 2 * (400 / 64);
  assert.deepEqual(r.h.rect, { x: Math.round(88 / iv) * iv, y: Math.round(186 / iv) * iv, w: 144, h: 328 });
  r.store['Modules.Step'] = false;
  // SetSheathe: no light - a height below the corner, the slide thrice as fast
  r.entity.lightSource = null; r.frame(0.001);
  assert.deepEqual([r.h.positionTarget.x, r.h.positionTarget.y], [0, 728]);
  const { x: x0, y: y0 } = r.h.positionCurrent; r.frame(0.01); const { x: x1, y: y1 } = r.h.positionCurrent;
  assert.ok(y1 > y0 && x1 < x0, 'towards the sheathe corner');
  near(Math.hypot(x1 - x0, y1 - y0), 0.01 * 1000 * 3, 1e-6, 'dt x offsetSpeedLive x 3');
  // a drop jumps it off at once
  r.entity.items = [torch()]; r.entity.lightSource = r.entity.items[0]; r.frame(1); r.frame(1);
  r.h._w.hasDroppedOrThrownLight = true; r.entity.lightSource = null; r.frame(0.001);
  assert.deepEqual(r.h.positionCurrent, r.h.positionTarget, 'no slide after a drop or a throw');
  // the lantern: frames 4..7, 110x138
  r.entity.items = [lantern()]; r.entity.lightSource = r.entity.items[0]; r.frame(1); r.frame(1);
  assert.equal(r.h._w.offsetFrame, 4); near(r.h.positionTarget.w, 176); near(r.h.positionTarget.h, 220.8);
  // the frame clock: a frame every 0.0625 s, 0..3 and round
  r.h._w.animationTimer = 0; r.h._w.currentFrame = 0;
  const frames = [];
  for (let i = 0; i < 8; i++) { r.frame(0.07); frames.push(r.h._w.currentFrame); }
  assert.deepEqual(frames, [0, 1, 1, 2, 2, 3, 3, 0]);
  // a candle has no sprite: the sheathe placement, below the screen
  r.entity.items = [candle()]; r.entity.lightSource = r.entity.items[0]; r.frame(1); r.frame(1);
  assert.equal(r.h._w.offsetFrame, -1); assert.ok(r.h.rect.y >= 400, 'off the screen');
  // nothing drawn in third person, or with the module off
  r.entity.items = [torch()]; r.entity.lightSource = r.entity.items[0]; r.frame(1);
  r.ctx.thirdPerson = true; assert.equal(r.h.draw(renderer, r.ctx.canvas), false); r.ctx.thirdPerson = false;
  r.store['Modules.Sprite'] = false; r.frame(); assert.equal(r.h.draw(renderer, r.ctx.canvas), false);
  // Ambidexterity flips the placement and the uv
  const f = rig({ 'Modules.Sprite': true, 'Presentation.Ambidexterity': true }, { renderer: fakeRenderer(), loadSprite, handedness: () => true });
  f.entity.items = [torch()]; f.entity.lightSource = f.entity.items[0]; f.ctx.usingRightHand = false;
  f.frame(); await f.h._w.texturesLoading; f.frame(1); f.frame(1);
  assert.equal(f.h.flipped, true); assert.deepEqual([f.h.positionTarget.x, f.h.positionTarget.y], [480, 350]); assert.deepEqual(f.h._w.curAnimRect, { u0: 1, v0: 0, u1: 0, v1: 1 });
  assert.equal(NATIVE_W, 320); assert.equal(NATIVE_H, 200);
});

test('HT1: Bob and Inertia - the widget\'s laws over the torch\'s channels: at rest the bob signs its sideways term by the hand, the module off is silent; the look lags the sprite, forward motion grows it, an attack or a slide resets it', async () => {
  const r = rig({ 'Modules.Sprite': true, 'Modules.Bob': true, 'Modules.Inertia': false }, { renderer: fakeRenderer(), loadSprite });
  r.entity.items = [torch()]; r.entity.lightSource = r.entity.items[0];
  r.frame(); await r.h._w.texturesLoading; r.frame(1); r.frame(1);
  r.ctx.motion = { grounded: true, standing: false, speedRatio: 1, baseSpeed: 1.5, localVel: [0, 0, 1] };
  r.frame(0.1); r.frame(0.1);
  assert.ok(r.h._w.position[0] !== 0 || r.h._w.position[1] !== 0, 'the bob publishes into Position');
  assert.ok(r.h._w.position[0] <= 0, 'unflipped: the sideways term is (1 + sin) x -size - never to the right');
  r.store['Modules.Bob'] = false; r.frame(0.1); assert.deepEqual(r.h._w.position, [0, 0], 'the module off: zeroed each LateUpdate');
  // Inertia: the look's lag, signed
  r.store['Modules.Inertia'] = true; r.ctx.motion = { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] };
  r.ctx.look = [0.2, 0]; r.frame(0.016);
  assert.deepEqual(r.h._w.inertiaTarget, [-0.2 * 0.5 * 500, 0]); assert.ok(r.h._w.inertiaCurrent[0] < 0); assert.ok(r.h._w.position[0] < 0);
  r.ctx.look = [0, 0]; r.ctx.motion.localVel = [0, 0, 5]; r.frame(0.016);
  assert.deepEqual(r.h._w.inertiaForwardTarget, [0.5 * 0.2, 0.5 * 0.2], 'forward motion (clamped /10) x ForwardDepth into the Scale');
  assert.ok(r.h._w.scale[0] > 0);
  r.ctx.swingHeld = true; r.ctx.look = [0.5, 0.5]; r.ctx.motion.localVel = [2, 0, 0]; r.frame(0.016);
  assert.deepEqual(r.h._w.inertiaTarget, [-0.2 * 0.5 * 500, 0], 'a held swing: the body\'s motion alone, no look');
  r.ctx.swingHeld = false;
  r.machine.state = 'StrikeDown'; r.frame(0.016);
  assert.deepEqual([r.h._w.inertiaCurrent, r.h._w.inertiaForwardCurrent], [[0, 0], [0, 0]], 'an attack resets the inertia');
});

// ═══ the pool ═══════════════════════════════════════════════════════════

/** The dropped-light textures as the loader hands them: record 0 four frames 31x34, 1 five 9x19, 2 five 15x21, 10/11/12 one. */
const loadTexture = async (record, frame) => {
  const shapes = { 0: [4, 31, 34], 1: [5, 9, 19], 2: [5, 15, 21], 10: [1, 31, 34], 11: [1, 9, 19], 12: [1, 15, 21] };
  const s = shapes[record]; if (!s || frame >= s[0]) return null;
  return { width: s[1], height: s[2], data: null };
};
function pool(over = {}, deps = {}) {
  const store = { ...defaults(), ...over };
  const alive = new Set(), uploads = [], emissions = [], loops = [], shots = [], said = [], picked = [];
  const renderer = {
    uploadTexture: (a, k) => uploads.push(`${a}:${k}`), uploadEmissionTexture: (a, k, img, o) => emissions.push([`${a}:${k}`, o]),
    createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, size: { ...size }, centers: centers.map((c) => [...c]), frame: 0 }; alive.add(b); return b; },
    destroyBillboardBatch: (b) => alive.delete(b),
  };
  const audio = {
    loop3d: (clip, pos, vol, opts) => { const l = { clip, pos: [...pos], vol, opts, moves: [], stopped: false, move(p) { this.moves.push([...p]); }, stop() { this.stopped = true; } }; loops.push(l); return l; },
    play3d: (clip, pos, vol) => shots.push([clip, [...pos], vol]),
  };
  const entity = deps.entity ?? { level: 5, lightSource: null, stats: { strength: 100, agility: 50, luck: 50, speed: 50 }, skills: {}, activeEffects: [], armorValues: [] };
  const p = createDroppedTorches({
    renderer, audio, getTexture: deps.getTexture ?? null, uploadRecordFrame: deps.uploadRecordFrame ?? null, collider: () => deps.collider ?? null,
    foes: () => deps.foes ?? [], foeSinks: null, makeEnemiesHostile: null, entity, camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    inside: () => deps.inside ?? true, waterLevel: () => deps.waterLevel ?? null, pixelKeyAt: (pos) => deps.pixelKeyAt?.(pos) ?? null,
    settings: () => readTorchSettings(() => store), rolls: () => deps.roll ?? 0.5, say: (l) => said.push(l), torchLightScale: () => deps.lightScale ?? 1, loadTexture,
    onPickedUp: (item) => picked.push(item),
  });
  return { p, store, alive, uploads, emissions, loops, shots, said, picked, entity, renderer };
}

test('HT1: SpawnLightSource - the billboard of the mod\'s record at the point (a coin mirrors it), lit records with their emission masks and a torch\'s 3D loop, a light under a dungeon\'s water doused (+10, no loop); the burn on the world clock (seconds / 12 per world minute) and the death at zero; the lights by the time left', async () => {
  setWorldMinutes(5000);
  const q = pool();
  q.p.tick(0.016);
  const d = q.p.spawnLightSource(T.Torch, [1, 0, 2], 1000);
  assert.deepEqual([d.record, d.time, d.mirrored, d.pixelKey], [DROPPED_RECORD.Torch, 1000, false, null]);
  await settle();
  assert.ok(d.batch); assert.deepEqual([d.batch.archive, d.batch.record, d.batch.centers], [DROPPED_ARCHIVE, 0, [[1, 0, 2]]]);
  near(d.batch.size.w, 31 * GLOBAL_SCALE); near(d.batch.size.h, 34 * GLOBAL_SCALE);
  assert.equal(q.uploads.filter((u) => u.startsWith('112358:0#')).length, 4, 'four frames of record 0');
  assert.equal(q.emissions.filter(([k, o]) => k.startsWith('112358:0#') && o.white === true).length, 4, 'the _Emission twins, white');
  assert.equal(q.loops.length, 1); assert.deepEqual([q.loops[0].clip, q.loops[0].vol, q.loops[0].opts], [CLIPS.burning, 0.5, { maxDistance: 5, distanceModel: 'linear' }]);
  assert.ok(d.anim, 'four frames animate'); q.p.tick(0.5); assert.ok(d.batch.frame >= 0);
  const c = q.p.spawnLightSource(T.Candle, [0, 0, 0], 100); await settle();
  assert.equal(c.record, DROPPED_RECORD.Candle); assert.equal(q.loops.length, 1, 'a candle burns silently'); near(c.batch.size.w, 9 * GLOBAL_SCALE);
  const hc = q.p.spawnLightSource(T.Holy_candle, [0, 0, 0], 100); assert.equal(hc.record, DROPPED_RECORD.HolyCandle);
  assert.equal(q.p.spawnLightSource(T.Lantern, [0, 0, 0], 100), null, 'no record for a lantern - never dropped');
  const m = pool({}, { roll: 0.9 }); const md = m.p.spawnLightSource(T.Torch, [0, 0, 0], 10); await settle(); assert.ok(md.batch.size.w < 0, 'Random.value > 0.5: mirrored (a negative width)');
  // under the water: doused
  const wl = -10 / GLOBAL_SCALE;   // the plane at y = 10
  const w = pool({}, { waterLevel: wl }); const wd = w.p.spawnLightSource(T.Torch, [0, 5, 0], 100); await settle();
  assert.equal(wd.record, DROPPED_RECORD.Torch + DROPPED_RECORD.DousedOffset); assert.equal(w.loops.length, 0); assert.equal(w.emissions.length, 0, 'a doused record has no emission');
  assert.equal(w.p.spawnLightSource(T.Torch, [0, 9, 0], 100).record, DROPPED_RECORD.Torch, 'its head 1.25 above the water: lit');
  assert.equal(pool({}, { waterLevel: 10000 }).p.spawnLightSource(T.Torch, [0, -100, 0], 100).record, DROPPED_RECORD.Torch, 'no water in the block (10000)');
  assert.equal(pool({}, { waterLevel: wl, inside: false }).p.spawnLightSource(T.Torch, [0, -100, 0], 100).record, DROPPED_RECORD.Torch, 'outdoors: no water plane');
  assert.equal(WATER_HEAD, 1.25);
  // the burn: the world clock's seconds over twelve - TimeScale / 12 x deltaTime every frame, and the rest hook's elapsed / 12, ONE law
  setWorldMinutes(5002); q.p.tick(0.016);
  near(d.time, 1000 - 2 * 60 / 12); near(c.time, 100 - 10);
  q.p.tick(0.016); near(d.time, 990, 1e-9, 'no world minute passed: no burn');
  // the lights: 1 + the item's range x (time left / the item's full burn) x PlayerTorchLightScale, half a unit up
  const lights = q.p.lights();
  assert.equal(lights.length, 3);
  near(lights[0].range, 1 + 14 * (990 / (50 * 20)));
  assert.deepEqual([lights[0].x, lights[0].z], [1, 2]);
  near(lights[0].y, 34 * GLOBAL_SCALE / 2 + 0.5, 1e-9, 'AUDIT 66 F1: half the texture height (the raise the mod gives the centred quad) and then 0.5 over it');
  near(lights[1].range, 1 + 8 * (90 / (16 * 20)));
  near(lights[1].y, 19 * GLOBAL_SCALE / 2 + 0.5, 1e-9, 'the candle is shorter, so its flame sits lower');
  assert.equal(templateByIndex(T.Torch).hitPoints, 50); assert.equal(templateByIndex(T.Torch).capacityOrTarget, 14);
  // AUDIT 66 F10: no PlayerTorchLightScale term - the mod multiplies this range by it, the port's own lane holds that setting inert for a radius (playerTorch.js), and no host could feed the dep anyway
  assert.ok(!/torchLightScale/.test(rd('src/scenes/droppedTorches.js')), 'the dep no host passed is gone');
  assert.ok(!/DROPPED_LIGHT_INTENSITY/.test(rd('src/scenes/droppedTorches.js')), 'and the constant nothing read');
  // a rest of an hour: the candle (90 s left) dies, the torch burns 300 s
  setWorldMinutes(5062); q.p.tick(0.016);
  assert.equal(q.p.dropped.length, 1); near(d.time, 690); assert.equal(c.dead, true); assert.ok(!q.alive.has(c.batch), 'its billboard gone');
  setWorldMinutes(6000); q.p.tick(0.016);
  assert.equal(q.p.dropped.length, 0); assert.equal(q.loops[0].stopped, true, 'the torch dead: the loop stopped'); assert.equal(q.alive.size, 0);
  assert.equal(q.p.lights().length, 0); assert.equal(q.p.batches().length, 0);
});

test('HT1: the activation - the six records at 3.2 as targets, Grab or Steal picks it up (the item minted with ceil(time / 20) condition, the billboard gone, the component told), Info or Talk names it; the transitions destroy all; the streaming sweep; the recenter; the save data restored by spawning', async () => {
  setWorldMinutes(7000);
  const q = pool();
  q.p.tick(0);
  const d = q.p.spawnLightSource(T.Torch, [3, 0, 4], 981);
  assert.deepEqual(q.p.targets(), [], 'not until its billboard stands');
  await settle();
  const tg = q.p.targets();
  assert.equal(tg.length, 1);
  assert.equal(tg[0].key, `droppedTorch:${d.id}`); assert.equal(tg[0].reach, PICKUP_REACH); assert.equal(PICKUP_REACH, 3.2); assert.equal(tg[0].distance, RAY_DISTANCE);
  assert.deepEqual(tg[0].aabb.min, [2.6, 0, 3.6]); near(tg[0].aabb.max[1], 34 * GLOBAL_SCALE);
  assert.equal(q.p.activate(tg[0].key, 'info'), true); assert.deepEqual(q.said, ['You see a torch']);
  assert.equal(q.p.activate(tg[0].key, 'dialogue'), true); assert.equal(q.said.length, 2);
  assert.equal(q.p.activate(tg[0].key, 'walk'), false, 'no arm for another mode'); assert.equal(q.p.activate('droppedTorch:999', 'grab'), false);
  assert.equal(q.p.activate(tg[0].key, 'grab'), true);
  assert.deepEqual(q.picked, [{ group: 'UselessItems2', templateIndex: T.Torch, maxCondition: 50, currentCondition: Math.ceil(981 / 20) }]);
  assert.equal(q.picked[0].currentCondition, 50);
  assert.equal(q.p.dropped.length, 0); assert.equal(q.alive.size, 0); assert.equal(q.loops[0].stopped, true);
  const h = q.p.spawnLightSource(T.Holy_candle, [0, 0, 0], 10); await settle();
  assert.equal(q.p.activate(`droppedTorch:${h.id}`, 'steal'), true);
  assert.deepEqual(q.picked[1], { group: 'ReligiousItems', templateIndex: T.Holy_candle, maxCondition: 20, currentCondition: 1 });
  // destroyAll: every transition and every load
  q.p.spawnLightSource(T.Torch, [0, 0, 0], 100); q.p.spawnLightSource(T.Candle, [0, 0, 0], 100); await settle();
  assert.equal(q.alive.size, 2); q.p.destroyAll(); assert.equal(q.p.dropped.length, 0); assert.equal(q.alive.size, 0); assert.equal(q.loops.at(-1).stopped, true);
  // outdoors: stamped with the pixel it fell on, and swept with it
  const o = pool({}, { inside: false, pixelKeyAt: (pos) => `px:${Math.floor(pos[0] / 100)}` });
  o.p.tick(0); const a = o.p.spawnLightSource(T.Torch, [50, 0, 0], 100); const b = o.p.spawnLightSource(T.Torch, [150, 0, 0], 100); await settle();
  assert.deepEqual([a.pixelKey, b.pixelKey], ['px:0', 'px:1']);
  o.p.collectPixel('px:0'); assert.deepEqual(o.p.dropped, [b]); assert.equal(o.alive.size, 1);
  o.p.offsetAll([-100, 0, 7]);
  assert.deepEqual(b.pos, [50, 0, 7]); assert.deepEqual(b.batch.centers, [[50, 0, 7]]); assert.deepEqual(o.loops[1].moves, [[50, 0, 7]]);
  // HandheldTorchesSaveData: position, time, template; restored by spawning; a dead or unknown one skipped
  const snap = o.p.snapshot((p) => [p[0] + 1000, p[1], p[2]]);
  assert.deepEqual(snap, [{ position: [1050, 0, 7], time: 100, itemTemplateIndex: T.Torch }]);
  const back = pool(); back.p.tick(0);
  back.p.restore([...snap, { position: [0, 0, 0], time: 0, itemTemplateIndex: T.Torch }, { position: [0, 0, 0], time: 5, itemTemplateIndex: T.Lantern }, null], (p) => [p[0] - 1000, p[1], p[2]]);
  assert.equal(back.p.dropped.length, 1); assert.deepEqual(back.p.dropped[0].pos, [50, 0, 7]); assert.equal(back.p.dropped[0].time, 100);
  back.p.restore(null); assert.equal(back.p.dropped.length, 0, 'a restore clears first');
});

test('HT1: the projectile - from the free hand\'s side, the look tilted by the angle and scattered by the dispersion, 25 x Strength x ThrowStrength x the wind-up; FixedUpdate at 0.02: the gravity vector growing, the spin, a wall at under a fifth of the start speed landing it (a dropped light, the drop clip), faster bouncing (reflected, Bounciness, the gravity dropped, the clip no oftener than 0.2 s)', async () => {
  setWorldMinutes(8000);
  const q = pool({ 'Throwing.ThrowDispersion': 0, 'Throwing.ThrowAngleOffset': 0 });
  q.p.tick(0);
  const p = q.p.spawnLightSourceProjectile(T.Torch, 1000, [0, 1, 0], [0, 0, 1], 1, FREE_HAND.Right);
  assert.deepEqual(p.pos, [THROW_HAND_OFFSET, 1, 0]); assert.deepEqual(p.dirStart, [0, 0, 1]); assert.equal(p.speedStart, 25); assert.equal(p.gravityDrag, 0.05); assert.equal(p.bounce, 0.5);
  await settle();
  assert.ok(p.batch); assert.equal(q.loops.length, 1, 'a thrown torch burns aloud');
  const l = q.p.spawnLightSourceProjectile(T.Torch, 1000, [0, 1, 0], [0, 0, 1], 0.5, FREE_HAND.Left);
  assert.deepEqual(l.pos, [-THROW_HAND_OFFSET, 1, 0]); assert.equal(l.speedStart, 12.5, 'half the wind-up');
  const tilted = pool({ 'Throwing.ThrowDispersion': 0, 'Throwing.ThrowAngleOffset': 15 });
  const tp = tilted.p.spawnLightSourceProjectile(T.Torch, 100, [0, 1, 0], [0, 0, 1], 1);
  near(tp.dirStart[1], Math.sin(15 * Math.PI / 180)); near(tp.dirStart[2], Math.cos(15 * Math.PI / 180));
  const spread = pool({ 'Throwing.ThrowDispersion': 3, 'Throwing.ThrowAngleOffset': 0 }, { roll: 1 });
  const sp = spread.p.spawnLightSourceProjectile(T.Torch, 100, [0, 1, 0], [0, 0, 1], 1);
  near(sp.dirStart[1], -Math.sin(3 * Math.PI / 180), 1e-6, 'Random.Range(-1, 1) x Dispersion about the right (a full roll: 3 degrees down)');
  assert.equal(pool().p.spawnLightSourceProjectile(T.Lantern, 100, [0, 1, 0], [0, 0, 1], 1), null);
  // one step in the open: the gravity grows by 9.81 x 0.05 x 0.02, the position by dir x speed x dt + gravity
  q.p.tick(PROJECTILE_FIXED_DT);
  near(p.gravity[1], -9.81 * 0.05 * 0.02); near(p.pos[2], 0.5); near(p.pos[1], 1 - 9.81 * 0.05 * 0.02); near(p.pos[0], 0.35);
  assert.equal(PROJECTILE_FIXED_DT, 0.02); assert.deepEqual([PROJECTILE.restFraction, PROJECTILE.spinRate, PROJECTILE.restRaise, PROJECTILE.audioGap, PROJECTILE.baseSpeed], [0.2, 20, 0.016, 0.2, 25]);
  near(p.size.w, p.base.w * Math.sin(20 * PROJECTILE_FIXED_DT), 1e-9, 'the spin: localScale.x = sin(20t)');
  q.p.tick(0.03); near(p.pos[2], 1.0, 1e-9, 'the accumulator: one more step at 0.05'); q.p.tick(0.012); near(p.pos[2], 1.5, 1e-9);
  // a wall: 25 bounces to 12.5, to 6.25, to 3.125 - under a fifth of 25 - then rests as a dropped light at the point
  const wall = { raycastHit: (o, d, max) => ({ dist: Math.min(max, 0.1), normal: [0, 1, 0] }) };
  const b = pool({ 'Throwing.ThrowDispersion': 0, 'Throwing.ThrowAngleOffset': 0 }, { collider: wall });
  b.p.tick(0);
  const bp = b.p.spawnLightSourceProjectile(T.Torch, 400, [0, 1, 0], [0, 0, 1], 1); await settle();
  b.p.tick(PROJECTILE_FIXED_DT);
  assert.equal(bp.speedCurrent, 12.5); assert.deepEqual(bp.gravity, [0, 0, 0], 'the gravity dropped');
  near(bp.dirStart[1], 9.81 * 0.05 * 0.02, 1e-9, 'the flight\'s x/z with the gravity\'s y, reflected over the normal');
  near(bp.pos[1], 1 + (9.81 * 0.05 * 0.02 * -1) * 0 + 0.1 * (-9.81 * 0.05 * 0.02) / Math.hypot(0, -9.81 * 0.05 * 0.02, 0.5) + 34 * 0.016, 1e-6, 'the point, raised by the texture\'s height x 0.016 along the normal');
  assert.equal(b.shots.length, 1); assert.equal(b.shots[0][0], CLIPS.drop);
  b.p.tick(PROJECTILE_FIXED_DT); assert.equal(bp.speedCurrent, 6.25); assert.equal(b.shots.length, 1, 'no clip within 0.2 s');
  b.p.tick(PROJECTILE_FIXED_DT); assert.equal(bp.speedCurrent, 3.125);
  b.p.tick(PROJECTILE_FIXED_DT);
  assert.equal(bp.dead, true); assert.equal(b.p.projectiles.length, 0); assert.equal(b.p.dropped.length, 1);
  assert.equal(b.p.dropped[0].time, 400, 'the torch lands with its seconds'); assert.equal(b.loops[0].stopped, true, 'the flight\'s loop stopped'); assert.equal(b.loops.length, 2, 'the dropped light\'s begins');
  b.p.offsetAll([1, 0, 0]); q.p.offsetAll([1, 0, 0]); near(p.pos[0], 1.35, 1e-9, 'a recenter moves the flight too');
});

test('HT1: a foe struck - hostile, the to-hit roll with Accuracy, ContinuousDamage-Health with the mod\'s Duration and Magnitude on the foe (no roll of Chance: DFU\'s effect declares none), the light effect stacking a re-hit\'s rounds, the ignite clip; the flame billboard upside down and the light behind and above its feet while the rounds last; Combustion off spends the torch with no fire', async () => {
  setWorldMinutes(9000);
  const foe = { entity: { level: 1, health: 30, maxHealth: 30, activeEffects: [], armorValues: [], stats: { agility: 50, luck: 50 }, skills: {} }, ai: { feet: [0.35, 0, 1], height: 1.8, yaw: 0, isHostile: true }, dead: false };
  const uploads = [];
  const q = pool({ 'Throwing.ThrowDispersion': 0, 'Throwing.ThrowAngleOffset': 0, 'Throwing.Duration': 3, 'Throwing.Magnitude': [4, 4] }, {
    foes: [foe], roll: 0, getTexture: async () => ({ getFrameCount: () => 6, getSize: () => ({ width: 32, height: 64 }) }), uploadRecordFrame: (a, r, i) => uploads.push([a, r, i]),
  });
  q.p.tick(0);
  const p = q.p.spawnLightSourceProjectile(T.Torch, 1000, [0, 1, 0], [0, 0, 1], 1); await settle();
  q.p.tick(PROJECTILE_FIXED_DT); assert.equal(q.p.projectiles.length, 1, 'the first step ends short of it');
  q.p.tick(PROJECTILE_FIXED_DT);
  assert.equal(q.p.projectiles.length, 0, 'spent'); assert.equal(p.dead, true); assert.equal(q.p.dropped.length, 0, 'no light on the floor');
  const cd = foe.entity.activeEffects.find((a) => a.kind === 'continuousDamage');
  assert.ok(cd, 'DFU\'s own Continuous Damage-Health on the foe'); assert.equal(cd.roundsRemaining, 2, 'Duration 3 + 1 x level 1 - the first round is applied at once');
  assert.equal(foe.entity.health, 26, 'the magnitude, at once');
  const fire = foe.entity.activeEffects.find((a) => a.kind === ENEMY_FIRE_KIND);
  assert.deepEqual(fire, { kind: ENEMY_FIRE_KIND, key: ENEMY_LIGHT_EFFECT_KEY, roundsRemaining: 3 }); assert.equal(ENEMY_LIGHT_EFFECT_KEY, 'HandheldTorchesEnemyLight');
  assert.equal(q.p.foeBurning(foe), true);
  assert.deepEqual(q.shots.at(-1)[0], CLIPS.ignite, 'the ignite clip at the point');
  q.p.igniteFoe(foe); assert.equal(fire.roundsRemaining, 6, 'AddState: a re-hit stacks its rounds');
  await settle(); q.p.tick(0.016);
  assert.deepEqual(uploads.slice(0, 6).map((u) => u.join(':')), ['375:0:0', '375:0:1', '375:0:2', '375:0:3', '375:0:4', '375:0:5']);
  const flame = q.p.batches().find((b) => b.archive === PUFF.archive);
  assert.ok(flame, 'the flame rides the foe'); assert.equal(flame.record, PUFF.record);
  near(flame.size.w, 32 * GLOBAL_SCALE); near(flame.size.h, -64 * GLOBAL_SCALE, 1e-9, 'localScale.y negated: drawn upside down');
  assert.deepEqual(flame.centers, [[0.35, ENEMY_LIGHT_LOCAL.up, 1 - ENEMY_LIGHT_LOCAL.back]]); assert.deepEqual([ENEMY_LIGHT_LOCAL.back, ENEMY_LIGHT_LOCAL.up], [0.4, 0.6]); assert.equal(PUFF.fps, 15);
  const lights = q.p.lights();
  assert.equal(lights.length, 1); assert.deepEqual([lights[0].x, lights[0].y, lights[0].z], [0.35, 0.6, 0.6]); assert.equal(lights[0].range, 14, 'the player torch\'s range - a torch\'s 14 with none lit');
  foe.ai.feet = [2, 0, 3]; q.p.tick(0.016); assert.deepEqual(q.p.batches().find((b) => b.archive === PUFF.archive).centers, [[2, 0.6, 2.6]], 'it follows');
  fire.roundsRemaining = 0; q.p.tick(0.016);
  assert.equal(q.p.foeBurning(foe), false); assert.equal(q.p.batches().some((b) => b.archive === PUFF.archive), false, 'the rounds spent: the flame goes'); assert.equal(q.p.lights().length, 0);
  // Emission off: the fire without the light; Combustion off: no fire at all
  const cold = { entity: { level: 1, health: 30, maxHealth: 30, activeEffects: [], armorValues: [], stats: { agility: 50, luck: 50 }, skills: {} }, ai: { feet: [0.35, 0, 1], height: 1.8, yaw: 0, isHostile: true } };
  const off = pool({ 'Throwing.ThrowDispersion': 0, 'Throwing.ThrowAngleOffset': 0, 'Throwing.Combustion': false }, { foes: [cold], roll: 0 });
  off.p.tick(0); const op = off.p.spawnLightSourceProjectile(T.Torch, 1000, [0, 1, 0], [0, 0, 1], 1); await settle();
  off.p.tick(PROJECTILE_FIXED_DT); off.p.tick(PROJECTILE_FIXED_DT);
  assert.equal(op.dead, true); assert.deepEqual(cold.entity.activeEffects, []); assert.equal(cold.entity.health, 30); assert.equal(off.shots.length, 0);
  const noLight = { entity: { level: 1, health: 30, maxHealth: 30, activeEffects: [], armorValues: [], stats: { agility: 50, luck: 50 }, skills: {} }, ai: { feet: [0.35, 0, 1], height: 1.8, yaw: 0 } };
  pool({ 'Throwing.Emission': false }).p.igniteFoe(noLight);
  assert.ok(noLight.entity.activeEffects.some((a) => a.kind === 'continuousDamage')); assert.ok(!noLight.entity.activeEffects.some((a) => a.kind === ENEMY_FIRE_KIND), 'Emission off: the damage without the light');
});

// ═══ the seams ══════════════════════════════════════════════════════════

test('HT1: the rig runs the component beside the widget - one per rig, the pool bound to it, Update then LateUpdate with the frame\'s inputs (the machine, the sheathe, the hand, the cast, the third person, the climb, the swim, the lycanthrope, the motion, the look, the camera, the collider, the raw keys, the sheathe door), the draw seam after the arms and before the widget', () => {
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /import \{ createHandheldTorches, isHeldLight \} from '\.\.\/systems\/handheldTorches\.js';/);   // TORCH-VIS: and the mod's own light test, so the ladder asks it in the mod's words
  assert.match(rig, /const handheld = createHandheldTorches\(\{ audio, say, torches \}\);/);
  assert.match(rig, /const handheldOn = \(\) => modSetting\('handheld-torches', 'Enabled'\);/);
  assert.match(rig, /pool\.setOnPickedUp\?\.\(\(item\) => handheld\.receivePickedUp\(item\)\);/, 'the pool hands a picked-up light to the component');
  // SW1b: the shield opens this block too - it was a third consumer inside a gate written for the other two,
  // so a profile with only Shield Widget on never got a frame at all (bible SW1b.1)
  assert.match(rig, /const _torchesOn = handheldOn\(\);\s*(?:\/\/[^\n]*\n\s*)*if \(!_torchesOn && _handheldWasOn\) handheld\.dispose\(\);[^\n]*\n\s*_handheldWasOn = _torchesOn;\s*(?:\/\/[^\n]*\n\s*)*if \(widgetOn\(\) \|\| _torchesOn \|\| shieldOn\(\)\) \{/);
  // AUDIT-EOTB2: the torch hand's third-person gate asks the sprite body too (Eye Of The Beholder's ToggleBillboard hides the FPV hand)
  assert.match(rig, /if \(_torchesOn\) \{\s*bindTorches\(\);\s*const tctx = \{\s*renderer, canvas: c, entity, machine: playerWeapon\.machine, sheathed: playerWeapon\.sheathed, usingRightHand: playerWeapon\.usingRightHand,\s*castPlaying: fpsSpellCasting\.isPlayingAnim, spellArmed: spellArmed\(\), thirdPerson: fpArm\.thirdActive\(\) \|\| eotbHidesWeapon\(\),[^\n]*\n\s*climbing: !!cam\?\.climbing, swimming: !!mv\.swimming, transformedLycanthrope: !!entity && isTransformedLycanthrope\(entity\),/);
  assert.match(rig, /look, swingHeld: _held, cursorActive: cursorActive\(\), camera: camThunk, collider: \(\) => collider\?\.\(\) \?\? null,\s*keyDown: \(code\) => !!keyDown\?\.\(code\), sheathWeapons: \(\) => \{ if \(!playerWeapon\.sheathed\) playerWeapon\.toggleSheath\(\); \},\s*\};\s*handheld\.update\(dt, tctx\);\s*handheld\.lateUpdate\(dt, tctx\);/);
  // MAC-I: every sprite in this seam takes the frame's TINT now (FPSWeapon.Tint, off the room's light);
  // the ORDER and the returns are what this pin holds, and neither moved.
  // SW1: the shield draws between the arms' return and the torch hand -
  // the OFF hand, behind both the torch and the weapon.
  // SW1b: the shield's verdict is now taken BEFORE the gate (its poses live in frames where `shown()` is false),
  // so the draw step is the one line, and `if (!shown()) return;` stops a shield-only frame before the weapon
  // MAP-WEAPON: one more rung between the arms and the shield - a map
  // holding the screen stops the classic body's four painters, the torch
  // hand among them (hands holding a map hold no torch either).
  assert.match(rig, /if \(fpArm\.active\(\)\) \{[^}]*fpArm\.draw\(c\);[^}]*return; \}\s*(?:\/\/[^\n]*\n\s*)*if \(sheetWindowUp\(\)\) return;\s*(?:\/\/[^\n]*\n\s*)*if \(shieldRect\) shield\.draw\(\(index, rect, uv\) => drawShieldSprite\(index, rect, uv, fpTint\)\);\s*if \(handheldOn\(\) && c\) handheld\.draw\(renderer, c, fpTint\);\s*if \(torchOnly\) return;[^\n]*\n\s*(?:\/\/[^\n]*\n\s*)*if \(!shown\(\)\) return;\s*if \(widgetOn\(\) && c && widget\.draw\(renderer, c, fpTint\)\) return;/, 'the arms return first (no classic hand under the Morrowind arms), the shield behind the torch hand, the torch hand under the weapon');
  assert.match(rig, /keyDown = null, torches = \(\) => null, sheetWindowUp = \(\) => false \}\)/, 'the two deps the hosts feed, and MAP-WEAPON\'s third - defaulted so a host that never heard of it draws what it always drew');
  assert.match(rig, /if \(!_torchesOn && _handheldWasOn\) handheld\.dispose\(\);/, 'AUDIT 66 F8: the switch off is a teardown - update() runs only while the mod is on, so the burning loop could not stop itself');
  assert.match(rig, /dispose\(\) \{ handheld\.dispose\(\); _handheldWasOn = false; \}/, 'AUDIT 66 F8: and the host has a door to call');
  assert.match(rig, /handheld,\s*\/\/ HT1/);
  assert.match(rd('src/systems/lycanthropy.js'), /export const isTransformedLycanthrope = \(entity\) => isTransformedNow\(entity\);/);
  assert.match(rd('src/systems/playerTorch.js'), /const o = _offsetOverride \?\? TORCH_OFFSET;/);
  assert.match(rd('src/systems/features.js'), /modFeature\('handheld-torches', 'Takes effect at once\.', '\w+'\)/);
  // GUARD1 (2026-09-15): this line USED to read `/160 modules/`. It was
  // a hand-written copy of a number `audit18_bible_docs.test.js` (U42)
  // already DERIVES from the directory, so it said nothing U42 does not
  // say better - and it went red the day an unrelated slice added a
  // module, which is the only thing an enumerated count can ever do.
  // What HT1 actually wants held is that the page counts THIS
  // directory and that the count is live, so that is what it asks.
  {
    const m = /(\d+) modules\s*\n?\s*live under\s*\n?\s*`src\/systems\/`/.exec(rd('bible/06-Systems/Systems.md'));
    assert.ok(m, 'Systems.md lost its "N modules live under `src/systems/`" line');
    assert.equal(Number(m[1]), readdirSync(join(root, 'src/systems')).filter((f) => f.endsWith('.js')).length,
      'Systems.md counts src/systems/ live - HT1 put playerTorch.js in that count');
  }
});

test('HT1: the five hosts - each owns a pool, feeds the rig its raw keys and the pool, composes the dropped lights into the point lights, draws the batches on the billboard pass, ticks the burn, puts the targets on the activation ray with a droppedTorch: arm, destroys all on a transition, and the streaming host stamps, sweeps and recenters them; the save envelope carries HandheldTorchesSaveData', () => {
  const world = rd('src/scenes/world.js'), ext = rd('src/scenes/exterior.js'), wm = rd('src/scenes/worldModes.js'), dc = rd('src/scenes/dungeonContext.js'), dj = rd('src/scenes/dungeon.js');
  for (const [name, src] of [['world', world], ['exterior', ext], ['worldModes', wm], ['dungeonContext', dc]]) {
    assert.match(src, /import \{ createDroppedTorches \} from '\.\/droppedTorches\.js';/, `${name}: the pool`);
    assert.match(src, /= createDroppedTorches\(\{/, `${name}: owns one`);
    assert.match(src, /keyDown: \(code\) => (?:keys\.has\(code\)|!!opts\.keyDown\?\.\(code\)), torches: \(\) => (?:droppedTorches|interiorTorches),/, `${name}: the rig's two deps`);
  }
  for (const [name, src] of [['world', world], ['exterior', ext]]) {
    assert.match(src, /\.\.\.droppedTorches\.lights\(\)\)/, `${name}: the dropped lights in the point-light channel`);
    assert.match(src, /const _torchPick = pickActivatableHit\(cam\.pos, useFwd, droppedTorches\.targets\(\), collider\);/, `${name}: the mod's RegisterCustomActivation on the same ray`);
    assert.match(src, /const _torchNearest = _race\.torchWins;/, `${name}: the torch arm reads the one race (HARD2)`);
    assert.match(src, /if \(_torchNearest\) \{ if \(_torchPick\.distance > _torchPick\.reach\) setMidScreenText\(TOO_FAR_AWAY_TEXT\); else droppedTorches\.activate\(_torchPick\.key, getInteractionMode\(\)\); \}/, `${name}: the 3.2 reach and the mode`);
    assert.match(src, /if \(_mode\(\) !== _torchesMode\) \{ droppedTorches\.destroyAll\(\); _torchesMode = _mode\(\); \}[^\n]*\n\s*if \(modes\.frame\(dt, now\)\) \{/, `${name}: AUDIT 66 F11 - the transition sweep runs ABOVE the modal return, where the transition is`);
    assert.match(src, /droppedTorches\.tick\(dt\);/, `${name}: the burn`);
    assert.match(src, /\.\.\.droppedTorches\.batches\(\)\)/, `${name}: drawn with the people`);
  }
  assert.match(world, /if \(collectLoose\) droppedTorches\.collectPixel\(key\);/, 'world: a dropped torch is a loose object, swept with its pixel');
  assert.match(world, /droppedTorches\.offsetAll\(r\.offset\);/, 'world: the recenter');
  assert.match(world, /droppedTorches: droppedTorches\.snapshot\(\(pos\) => \{ const wc = state\.worldCoords\(pos\); return \[wc\.x, pos\[1\] - state\.compensation\[1\], wc\.z\]; \}\),/, 'world: the save data in world coordinates');
  assert.match(world, /droppedTorches\.restore\(w\.droppedTorches, \(p\) => \{ const \[lx, lz\] = state\.localFromWorld\(p\[0\], p\[2\]\); return \[lx, p\[1\] \+ state\.compensation\[1\], lz\]; \}\);/, 'world: restored into the local frame');
  assert.match(world, /droppedTorches\.restore\(arrived\.droppedTorches,/, 'world: the F9 envelope too');
  // the interior mode
  assert.match(wm, /const interiorTorches = createDroppedTorches\(\{/);
  assert.match(wm, /\.\.\.interiorTorches\.lights\(\)\);/); assert.match(wm, /interiorTorches\.tick\(dt\);/); assert.match(wm, /const _torches = interiorTorches\.batches\(\);/);
  assert.match(wm, /targets\.push\(\.\.\.interiorTorches\.targets\(\)\);/);
  assert.match(wm, /if \(key\.startsWith\('droppedTorch:'\)\) \{ interiorTorches\.activate\(key, getInteractionMode\(\)\); return true; \}/);
  // AUDIT 66 F4: the sweep runs with the TRANSITION, before the scene cache puts the room's own torches back - it used to sit at the foot of the same function and destroyed what the restore had just spawned
  assert.match(wm, /dismountPlayer\('ToBuildingInterior'\);\s*transitioning = true;\s*try \{\s*(?:\/\/[^\n]*\n\s*)*interiorTorches\.destroyAll\(\);/, 'the way in: before the build, not after the restore');
  const _wmEnter = wm.indexOf("interiorTorches.destroyAll();");
  assert.ok(_wmEnter > 0 && _wmEnter < wm.indexOf('restoreInteriorScene();'), 'and it lands ABOVE the restore in the file, as it does in the frame');
  assert.equal((wm.match(/interiorTorches\.destroyAll\(\);/g) ?? []).length, 3, 'the way in, the way out, and AUDIT 66 F6 the quest-teleport / load exit');
  assert.match(wm, /interiorDropped\.restorePiles\(null\);[^\n]*\n\s*interiorTorches\.destroyAll\(\);[^\n]*\n\s*interiorHitEffects\.clear\(\);/, 'AUDIT 66 F6: in the teardown list with its siblings');
  assert.match(wm, /const droppedTorches = interiorTorches\.snapshot\(\);/); assert.match(wm, /interiorTorches\.restore\(data\.droppedTorches\);/);
  assert.match(wm, /key\.startsWith\('droppedTorch:'\)\) \{/, 'the dungeon arm\'s loot ladder takes the key');
  assert.match(wm, /\.\.\.dungeonCtx\.torchLights\(\)\)/); assert.match(wm, /\.\.\.dungeonCtx\.torchBatches\(\)/);
  // the dungeon context and the standalone dungeon
  assert.match(dc, /droppedTorches, torchBatches: \(\) => droppedTorches\.batches\(\), torchLights: \(\) => droppedTorches\.lights\(\),/);
  assert.match(dc, /targets\.push\(\.\.\.droppedTorches\.targets\(\)\);/); assert.match(dc, /if \(kind === 'droppedTorch'\) return droppedTorches\.activate\(key, mode\) \? 1 : 0;/);
  assert.match(dc, /droppedTorches: droppedTorches\.snapshot\(\),/); assert.match(dc, /if \(truncate\) droppedTorches\.restore\(w\.droppedTorches\);/);
  assert.match(dc, /delete w\.droppedLoot;\s*delete w\.droppedTorches;/, 'the shared world carries nothing of the player\'s own');
  assert.match(dc, /waterLevel: \(\) => \(_fpFeet \? blockWaterLevelAt\(/, 'the dungeon\'s water plane for the douse');
  assert.match(dc, /droppedTorches\.destroyAll\(\);\s*weaponRig\.dispose\?\.\(\);/, 'AUDIT 66 F5/F8: the pool and the rig\'s component leave with the dungeon, beside the foes\' batches and the wall torches\' loops');
  assert.match(dj, /\.\.\.ctx\.torchLights\(\)\)/); assert.match(dj, /\.\.\.ctx\.torchBatches\(\)\]/); assert.match(dj, /key\.startsWith\('droppedTorch:'\)\)\) \{/);
  assert.match(dj, /keyDown: \(code\) => keys\.has\(code\)/);
});

// HT4 (2026-09-15, Mac: "Pressing tab drops torches, tab is reserved for the menu"):
// A VENDORED MOD'S KEY MAY NOT LAND ON A KEY THE PORT HAS ALREADY SPENT.
//
// Handheld Torches ships Handling.ManualDropInput = "Tab". In Daggerfall Unity
// that is free, so the mod was right; here it is not, because PX15 gave Tab to
// the port's own pixel dial - a radial menu DFU has not got - and one press
// both opened the dial and dropped the light.
//
// The fix is the default (now G). THE PIN IS THE CLASS: it walks every text key
// a vendored mod declares against DFU's own bindings AND the keys the port
// spends on top of them, so the next mod folded in cannot repeat this quietly.
// A player may still bind whatever they like; this is about what SHIPS.
test('HT4: no vendored mod ships a key the port has already spent', () => {
  // AUDIT HT4 F1: this read `Object.keys(DEFAULT_BINDINGS)`, and
  // DEFAULT_BINDINGS is an ARRAY of [code, action] pairs - so the set
  // held '0'..'43' and `dfuBound.has('KeyR')` was permanently false.
  // The DFU half of this pin could not fire, while four records called
  // that half the whole point of it. Proven by driving it: a vendored
  // mod shipping "R" (DFU's Rest) passed. The codes, not the indices.
  const dfuBound = new Set(DEFAULT_BINDINGS.map(([code]) => code));
  // The keys the PORT spends that DFU does not - each read straight from the
  // source that spends it, so a rename there fails here rather than drifting.
  const input = rd('src/ui/input.js');
  assert.match(input, /if \(e\.code === 'Tab'\) \{ return ctx\.toggleDial/, 'PX15: Tab is the pixel dial');
  // AUDIT HT4 F1b: Escape was left out of this set BECAUSE the dead
  // half above was trusted to catch it. It is named here now, and the
  // assertion below proves the DFU half is live rather than assuming it.
  const portSpent = new Set(['Tab', 'Escape']);   // the dial, and the door out of every pane
  assert.ok(dfuBound.has('KeyR') && dfuBound.has('Escape'),
    'the DFU half is LIVE - this set holds key CODES, not array indices (AUDIT HT4 F1)');

  const offenders = [];
  for (const [vendor, mod] of Object.entries(MOD_SETTINGS)) {
    for (const [key, def] of Object.entries(mod.keys)) {
      // EOTB0: `text` alone is not enough. DFU's TextKey carries two
      // different kinds - a KeyCode binding AND an input AXIS name
      // ("Mouse ScrollWheel") - and Eye Of The Beholder ships both.
      // An axis is not a key and cannot collide with one, so the
      // port declares the kind (`axis: true`) and this gate reads
      // the DECLARATION rather than guessing from the value. The
      // assertion below stays strict for everything that IS a key.
      if (!def.text || def.axis || typeof def.default !== 'string') continue;   // only the KeyCode fields
      // TO1: ...and an EMPTY default is not a key either. Travel
      // Options' `RoadsIntegration.FollowPathsCustomKeyBind` ships ""
      // because it is only read when the CHOICE above it is set to
      // "Custom Key Bind" (TravelOptionsMod.cs:224-232), and an unset
      // custom bind falls back to F there. Nothing is bound, so nothing
      // can collide; the gate below stays strict for every key that
      // names one.
      if (def.default === '') continue;
      const code = domCodeForKeyCode(def.default);
      assert.ok(code, `${vendor}/${key} ships "${def.default}", which is not a KeyCode the port can bind`);
      if (portSpent.has(def.default) || dfuBound.has(code)) offenders.push(`${vendor}/${key} = ${def.default} (${code})`);
    }
    // AUDIT-TO1 I1: ...AND A MULTIPLE-CHOICE KEY THAT CHOOSES A KEY.
    // Travel Options' RoadsIntegration.FollowPathsKey is a
    // MultipleChoiceKey over ["None", "F", "G", "K", "O", "X", "Custom
    // Key Bind"] whose default is an INDEX, so the TextKey walk above
    // (`typeof def.default !== 'string'`) stepped straight over it - and
    // it shipped on F, the key SOC5 spends on SocialInteract, for three
    // days with this gate green. The setting DECLARES the kind
    // (`keyChoice: true`, the `axis` precedent), because a walk that
    // guessed from the value took Weapon Widget's Bob.Shape "U" for a
    // key. The option at the default index is judged exactly as a
    // TextKey default; "None" and "Custom Key Bind" name no key.
    for (const [key, def] of Object.entries(mod.keys)) {
      if (!def.keyChoice) continue;
      assert.ok(Array.isArray(def.options) && typeof def.default === 'number', `${vendor}/${key} declares keyChoice and is not a choice list`);
      const choice = def.options[def.default];
      const code = domCodeForKeyCode(choice);
      if (!code) continue;   // "None" / "Custom Key Bind"
      if (portSpent.has(choice) || dfuBound.has(code)) offenders.push(`${vendor}/${key} = option ${def.default} "${choice}" (${code})`);
    }
  }
  assert.deepEqual(offenders, [],
    'these ship on a key the port or DFU already answers - one press would do two things');

  // AUDIT-TO1 I1 (b): ...AND NO TWO VENDORED MODS SHIP THE SAME KEY. The
  // walk above judges a mod against DFU and the port; it never judged
  // two mods against EACH OTHER, and the first pick for the follow key
  // was X - Handheld Torches' throw. Every shipped key code across every
  // vendor, once.
  const shipped = new Map();   // code -> first owner
  const twice = [];
  for (const [vendor, mod] of Object.entries(MOD_SETTINGS)) {
    for (const [key, def] of Object.entries(mod.keys)) {
      let name = null;
      if (def.text && !def.axis && typeof def.default === 'string' && def.default !== '') name = def.default;
      else if (def.keyChoice) name = def.options[def.default];
      const code = name ? domCodeForKeyCode(name) : null;
      if (!code) continue;
      const owner = `${vendor}/${key}`;
      if (shipped.has(code)) twice.push(`${owner} and ${shipped.get(code)} both ship ${code}`);
      else shipped.set(code, owner);
    }
  }
  assert.deepEqual(twice, [], 'two vendored mods ship the same key - one press would do two things');

  // ...AND THE AXIS EXEMPTION IS NOT A HOLE. It is still a `text` key -
  // the pane shows it as one - so the skip above turns on the declared
  // KIND and nothing else, and it is driven here rather than trusted:
  // the value really is one no KeyCode resolver can answer, which is
  // why it must not reach the assertion, and at least one such key
  // exists so the clause is not dead.
  const axes = Object.entries(MOD_SETTINGS).flatMap(([v, m]) =>
    Object.entries(m.keys).filter(([, d]) => d.axis).map(([k, d]) => [`${v}/${k}`, d]));
  assert.ok(axes.length >= 1, 'no key declares itself an axis - the exemption above is dead code');
  for (const [name, d] of axes) {
    assert.equal(d.text, true, `${name}: an axis is still a text field in the pane`);
    assert.equal(domCodeForKeyCode(d.default), null, `${name} resolves as a KeyCode - then it is a key, not an axis`);
  }

  // and the three this mod ships are the three it ships, named, so a silent
  // repoint of one of them is a failure rather than a diff nobody reads
  const k = MOD_SETTINGS['handheld-torches'].keys;
  assert.equal(k['Handling.ToggleLightInput'].default, 'O', 'SOC5: repointed off the F-menu\'s F');
  assert.equal(k['Handling.ManualDropInput'].default, 'G', 'HT4: repointed off the dial\'s Tab');
  assert.equal(k['Throwing.ThrowTorchInput'].default, 'X');
});

// HT5 (2026-09-16, Mac: "the torch when being held isn't affected by the
// weapon bob like everything else"). The mod ships its motion modules off
// and leaves matching them to the weapon's to the player; the port ships
// Weapon Widget's Bob ON, so the torch hand stood still beside a swaying
// weapon. The three modules the two mods share ship with the SAME answer
// here - one walk, two hands - and the mod's own file is untouched.
test('HT5: the torch hand moves as the weapon does - every motion module the two mods share ships with the same default (mutant: one hand\u2019s module flipped alone)', async () => {
  const { MOD_SETTINGS } = await import('../src/systems/modSettings.js');
  const torchKeys = MOD_SETTINGS['handheld-torches'].keys;
  const widget = MOD_SETTINGS['weapon-widget'].keys;
  for (const m of ['Modules.Bob', 'Modules.Inertia', 'Modules.Step']) {
    assert.equal(torchKeys[m].default, widget[m].default, `${m}: the torch hand and the weapon ship the same answer`);
  }
  assert.equal(torchKeys['Modules.Bob'].default, true, 'and that answer, for Bob, is on - the widget\u2019s own shipped default');
  assert.match(rd('vendor/handheld-torches/modsettings.json'), /"Value": false,\s*\n\s*"Name": "Bob",/, 'the mod\u2019s own file still ships Bob off - the departure is the port\u2019s, stated in the table');
  // and the law it turns on is the one the component runs: Bob on, at
  // rest, walking - the sprite moves off its target
  const r = rig({ 'Modules.Sprite': true, 'Modules.Bob': true, 'Modules.Inertia': false }, { renderer: fakeRenderer(), loadSprite });
  r.entity.items = [torch()]; r.entity.lightSource = r.entity.items[0];
  r.frame(); await r.h._w.texturesLoading; r.frame(1); r.frame(1);
  r.ctx.motion = { grounded: true, standing: false, speedRatio: 1, baseSpeed: 1.5, localVel: [0, 0, 1] };
  r.frame(0.1); r.frame(0.1);
  assert.ok(r.h._w.position[0] !== 0 || r.h._w.position[1] !== 0, 'walking with Bob on: the hand has moved off its rest');
});


// ── TORCH-VIS: A SHEATHED STANCE IS NOT A STOWED LIGHT ──────────────
//
// Mac, 2026-09-18: "If you only have the torch equipped and no weapon, it doesn't show you holding it in first
// person (morrowind)." Pre-existing, and the cause was one clause too wide. The weapon rig's draw ladder opens on
// `shown()`, which is the WEAPON's visibility - the file says so itself where the classic spellcasting hands were
// hoisted above it, "NOT under shown() - the weapon is the thing shown() hides" - and one leg of it is
// `playerWeapon.sheathed`. A player walking around with a torch and nothing drawn IS sheathed, so the ladder
// returned before either lane could draw the light: the Morrowind arm never got its `fpArm.draw(c)`, and the
// classic torch hand never got its screen quad. The one state a carried light exists for was the one state it
// never drew in.
//
// The two tests below are the two halves of the fix: the LAW it rests on (the Morrowind rig's own, driven for
// real) and the LADDER that now honours it.
test('TORCH-VIS (the law): the Morrowind rig already says a SHEATHED stance keeps the carried light visible, and a READIED SPELL hides it - so `sheathed` was the one leg of shown() that must not take the torch down with the weapon', async () => {
  const { animWeaponType, carriedLeftVisible } = await import('../src/combat/fpArm.js');
  // MW-D51 is NpcAnimation::updateCarriedLeftVisible verbatim: visible unless the stance's flags say two-handed.
  // A sheathed stance idles in None whatever is owned, and None is not two-handed - so the reference draws the
  // torch for a weaponless player. Driven over every owned type, so this cannot pass on one lucky weapon.
  for (const owned of [-1, 0, 1, 2, 3, 4, 5, 6]) {
    assert.equal(carriedLeftVisible(animWeaponType(owned, true, false)), true,
      `THE LAW: sheathed still carries the light (owning type ${owned})`);
  }
  // ...and the case that must keep hiding it, which is why the fix does not simply drop the gate
  assert.equal(carriedLeftVisible(animWeaponType(1, false, true)), false, 'a readied spell hides the carried left - the reference\'s own case');
  // the mod's half of it: a free hand is what lets a weaponless player carry a light at all (HT7)
  const { isHeldLight } = await import('../src/systems/handheldTorches.js');
  const { TEMPLATES } = await import('../src/systems/useItem.js');
  assert.equal(isHeldLight({ templateIndex: TEMPLATES.Torch }), true);
  assert.equal(isHeldLight({ templateIndex: TEMPLATES.Lantern }), true);
  assert.equal(isHeldLight({ templateIndex: TEMPLATES.Torch + 1000 }), false, 'a sword is not a light');
  assert.equal(isHeldLight(null), false, 'and an empty hand is not one either');
  // ...and the ladder's test and the ARM's test are deliberately NOT the same question, which is why the arm gets
  // a veto: the Morrowind held-light art is the TORCH alone, so a lit LANTERN is a light the entity has and the
  // arm cannot paint. Opening the gate on the entity's answer alone would paint a sheathed idle holding nothing.
  const { isLitTorch } = await import('../src/combat/weaponRig.js');
  const lantern = { templateIndex: TEMPLATES.Lantern }, torch = { templateIndex: TEMPLATES.Torch };
  assert.equal(isHeldLight(lantern), true, 'the ladder counts a lantern as a held light...');
  assert.equal(isLitTorch(lantern), false, '...and the Morrowind arm does not - it has no lantern in hand');
  assert.equal(isHeldLight(torch) && isLitTorch(torch), true, 'a torch is both');
});

test('TORCH-VIS (the ladder): a lit hand draws while merely sheathed, the weapon does NOT come back with it, and the other three hiding laws stand', () => {
  const rig = rd('src/combat/weaponRig.js');
  // the exception is computed from the OTHER legs of shown(), never from `sheathed` - so it can only ever widen
  // the sheathed case, and a readied spell, a cast in flight and an equip countdown all still hide the torch
  assert.match(rig, /const torchOnly = !shown\(\) && !spellArmed\(\) && !fpsSpellCasting\.isPlayingAnim\s*\n\s*&& \(entity\?\.equipCountdown \?\? 0\) <= 0 && isHeldLight\(entity\?\.lightSource\)\s*\n\s*&& \(!fpArm\.active\(\) \|\| fpArm\.torchShown\(\)\);/,
    'the exception names every leg of shown() it does NOT relax, asks the mod\'s own light test, and lets the Morrowind arm veto a light it has no art for');
  assert.match(rig, /if \(paralyzed \|\| \(!shown\(\) && !torchOnly && !sheetOnly && !shieldRect\)\) return;/, 'the gate takes the exception, and paralysis still takes everything (MAP-FIELD put the held sheet\'s own leg beside the torch\'s, SW1b the shield\'s - the same law, three things that are not the weapon)');
  // and the weapon stays hidden: the return sits AFTER the torch hand and BEFORE the clone and the sprite
  const draw = rig.slice(rig.indexOf('const torchOnly ='));
  const torchAt = draw.indexOf('handheld.draw(renderer, c, fpTint)');
  const stopAt = draw.indexOf('if (torchOnly) return;');
  const cloneAt = draw.indexOf('widget.draw(renderer, c, fpTint)');
  const spriteAt = draw.indexOf('drawFpsWeapon(');
  assert.ok(torchAt > 0 && stopAt > 0 && cloneAt > 0 && spriteAt > 0, 'all four are in the ladder');
  assert.ok(torchAt < stopAt, 'the lit hand draws first...');
  assert.ok(stopAt < cloneAt && stopAt < spriteAt, '...and then the torch-only pass STOPS: no weapon clone, no weapon sprite, while sheathed');
  // the Morrowind lane is served by the arm's own return above, which is why this needed no second torch draw
  assert.ok(draw.indexOf('fpArm.draw(c); return; }') < torchAt, 'the arm still returns whole, above the classic hand');
  assert.match(rd('src/combat/fpArm.js'), /torchShown: \(\) => torchVisible\(\),/, 'the veto is a real read on the arm, not a literal that satisfies a regex');
  // THE FOUR HOSTS: the fix is in the rig, and every host builds its torch through that one rig
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(host), /createWeaponRig\(\{/, `${host} builds its viewmodel through the one rig`);
  }
});
