import { test } from 'node:test';
import assert from 'node:assert/strict';

import { drawFpsWeapon, FLIP_STATES, ALIGN, getWeaponAnims, WEAPON_TYPES } from '../src/combat/fpsWeapon.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';
import { ENUM_LAW } from '../src/ui/settingsLaw.js';

// AUDIT 28 - W13: HANDEDNESS (StartGameBehaviour :269 -> FPSWeapon
// .FlipHorizontal, :378-388 and :459-464). Setting 1 mirrors the weapon
// art and swaps AlignRight for AlignLeft on the three hand-symmetric
// states - Idle, StrikeDown, StrikeUp - and leaves a left or right strike
// on its own side. The port's header had recorded this as unimplemented
// "until a settings surface exists".

const canvas = { width: 640, height: 400 };
const art = (weaponType = WEAPON_TYPES.LongBlade) => ({
  weaponType, anims: getWeaponAnims(weaponType),
  records: Array.from({ length: 8 }, () => ({ width: 100, height: 80, frames: ['t0', 't1', 't2', 't3', 't4'] })),
});
const capture = () => { const calls = []; return { calls, renderer: { drawScreenQuad: (tex, dst, src) => calls.push({ tex, dst, src }) } }; };

test('AUDIT 28 W13: right hand (the default) - no mirror, AlignRight stays right', () => {
  resetToDefaults();
  const { calls, renderer } = capture();
  drawFpsWeapon(renderer, canvas, art(), 'Idle', 0);
  assert.equal(calls[0].src, undefined, 'the default source rect');
  const anim = getWeaponAnims(WEAPON_TYPES.LongBlade)[0];
  assert.equal(anim.Alignment, ALIGN.Right, 'a long blade idles on the right');
  assert.ok(Math.abs(calls[0].dst.x - (canvas.width * (1 - anim.Offset) - 100 * 2)) < 1e-9, 'AlignRight');
});

test('AUDIT 28 W13: left hand - Idle, StrikeDown and StrikeUp are mirrored (u 1 -> 0) and AlignRight becomes AlignLeft; a side strike is untouched', () => {
  assert.deepEqual([...FLIP_STATES], ['Idle', 'StrikeDown', 'StrikeUp']);
  const { calls, renderer } = capture();
  const anims = getWeaponAnims(WEAPON_TYPES.LongBlade);
  drawFpsWeapon(renderer, canvas, art(), 'Idle', 0, { flipHorizontal: true });
  assert.deepEqual(calls[0].src, { u0: 1, v0: 0, u1: 0, v1: 1 }, 'the mirror');
  assert.ok(Math.abs(calls[0].dst.x - canvas.width * anims[0].Offset) < 1e-9, 'AlignLeft\'s placement (:439-446)');
  drawFpsWeapon(renderer, canvas, art(), 'StrikeRight', 2, { flipHorizontal: true });
  assert.equal(calls[1].src, undefined, 'a side strike keeps its art');
  const sr = anims[4];
  const expected = sr.Alignment === ALIGN.Left ? canvas.width * sr.Offset : sr.Alignment === ALIGN.Center ? canvas.width / 2 - 100 : canvas.width * (1 - sr.Offset) - 200;
  assert.ok(Math.abs(calls[1].dst.x - expected) < 1e-9, 'and its own alignment');
  // AlignLeft is NOT swapped to right under the flip.
  const leftIdx = anims.findIndex((a) => a.Alignment === ALIGN.Left && FLIP_STATES.includes(['Idle', 'StrikeDown', 'StrikeDownLeft', 'StrikeLeft', 'StrikeRight', 'StrikeDownRight', 'StrikeUp'][anims.indexOf(a)]));
  if (leftIdx >= 0) {
    const state = ['Idle', 'StrikeDown', 'StrikeDownLeft', 'StrikeLeft', 'StrikeRight', 'StrikeDownRight', 'StrikeUp'][leftIdx];
    drawFpsWeapon(renderer, canvas, art(), state, 0, { flipHorizontal: true });
    assert.ok(Math.abs(calls[2].dst.x - canvas.width * anims[leftIdx].Offset) < 1e-9, 'AlignLeft stays left');
  }
});

test('AUDIT 28 W13: the setting is the default source - 1 flips, 0/2/3 do not (DFU: `== 1`); LIVE; the screen shows the two hands', () => {
  resetToDefaults();
  for (const [v, flipped] of [['0', false], ['1', true], ['2', false], ['3', false]]) {
    setValue('Controls', 'Handedness', Number(v));
    const { calls, renderer } = capture();
    drawFpsWeapon(renderer, canvas, art(), 'Idle', 0);
    assert.equal(calls[0].src !== undefined, flipped, `Handedness ${v}`);
  }
  resetToDefaults();
  assert.equal(LIVE['Controls/Handedness'], 'src/combat/fpsWeapon.js');
  assert.deepEqual([...ENUM_LAW['Controls/Handedness'].values], ['Right Hand', 'Left Hand']);
});
