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
// ── DISC14-B: Diverse Weapons' defaults (Mac, with a screenshot of the Weapon Widget tile) - REVERTED by DISC16-B ──
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

import { modSettingsOf, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { readWidgetSettings, WEAPON_WIDGET_VENDOR } from '../src/combat/weaponWidget.js';
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

// ── DISC14-B: REVERTED by DISC16-B (2026-09-24, Mac: "Weapon widget preset needs to be defaulted on with diverse
// weapons and the changes we made to the values for the weapon widget reverted"). Its pins went with it; the defaults
// are DW-CLIP's again, pinned where they were (DW1, WW1, AUDIT-DW) and in test/disc16.test.js.

// ── DISC14-C ─────────────────────────────────────────────────────────

/** The real widget walking at 60 fps: a longsword idle (100x60 classic records) on a 640x400 screen. `wHit` answers the
 *  `w_` idle with a doubled texture, as a Diverse Weapons idle is. Returns the sprite's drawn y and the arms' rect per frame. */
function walkWidget(over = {}, { wHit = false, look = [0, 0] } = {}) {
  _resetModSettings();
  // DISC16-B: the bench names its own settings - the preset off, so the chips below are what draws, and
  // DoubleScaleTextures on unless the case turns it off (the defaults are DW-CLIP's again, the preset on)
  setModSetting('diverse-weapons', 'WeaponWidgetPreset', false);
  over = { 'Modules.DoubleScaleTextures': true, ...over };
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
