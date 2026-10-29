// BOW-LAW (bible/01-Overview/Port-Ledger.md, BOW-LAW): a bow reloads on the swing's law - what is left of a five-frame
// swing of the bow once the draw and the loose have played.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bowReloadSeconds, getBowCooldownTime, swingFrameSeconds, swingHeft, swingHandling, MELEE_NUM_FRAMES, BOW_NUM_FRAMES,
  HIT_FRAME_BOW, CLASSIC_UPDATE_INTERVAL, registerSwingPaceMod } from '../../src/characters/weaponStates.js';
import { WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import '../../src/combat/swingLaw.js';   // registers the swing reader the law reads the bow with

const DRAW_S = (BOW_NUM_FRAMES.StrikeUp + HIT_FRAME_BOW) * CLASSIC_UPDATE_INTERVAL;
const archer = (speed, strength = 80) => ({ stats: { speed, strength, luck: 50 }, equip: { slots: {} } });

test('BOW-LAW: a wielder the port knows reloads on a two-handed swing of the bow, after the draw and the loose', () => {
  for (const speed of [30, 50, 80, 100]) {
    const ctx = { entity: archer(speed), weaponType: WEAPON_TYPES.Bow, usingRightHand: true };
    const swing = MELEE_NUM_FRAMES.StrikeDown * swingFrameSeconds(speed, { heft: swingHeft(0, 80), handling: swingHandling(WEAPON_TYPES.Bow, false) });
    assert.ok(Math.abs(bowReloadSeconds(speed, ctx) - Math.max(0, swing - DRAW_S)) < 1e-9, `Speed ${speed}`);
    assert.ok(bowReloadSeconds(speed, ctx) < getBowCooldownTime(speed), `Speed ${speed}: quicker than DFU's line`);
  }
  assert.equal(bowReloadSeconds(70, null), getBowCooldownTime(70), 'no wielder: DFU\'s line');
});

test('BOW-LAW: the pace powers quicken the bow as they quicken a swing, down to the draw itself', () => {
  const ctx = { entity: archer(50), weaponType: WEAPON_TYPES.Bow, usingRightHand: true };
  const before = bowReloadSeconds(50, ctx);
  registerSwingPaceMod('bowLawTest', () => 50);
  try {
    const after = bowReloadSeconds(50, ctx);
    assert.ok(after < before && after >= 0, `${after} < ${before}`);
  } finally { registerSwingPaceMod('bowLawTest', null); }
});
