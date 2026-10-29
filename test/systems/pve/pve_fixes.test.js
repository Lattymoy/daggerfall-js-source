// BOW-LAW and PVE-CAST (bible/05-Combat/Fixed-PvE.md section 5): the bow reloads on the swing's law, and MY spell at a
// PvE foe lands on the mages' rework, with its start fading out by level 30.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bowReloadSeconds, getBowCooldownTime, swingFrameSeconds, swingHeft, swingHandling, MELEE_NUM_FRAMES, BOW_NUM_FRAMES,
  HIT_FRAME_BOW, CLASSIC_UPDATE_INTERVAL, registerSwingPaceMod } from '../../../src/characters/weaponStates.js';
import { WEAPON_TYPES } from '../../../src/combat/fpsWeapon.js';
import { pveCastLanding, pveCastStart, pveCastHold, PVE_CAST_START, PVE_CAST_START_GONE, PVE_CAST_X, PVE_CAST_PER_SKILL } from '../../../src/systems/spell/pveCast.js';
import { casterDamageScaled } from '../../../src/systems/effects.js';
import { SKILLS } from '../../../src/systems/skills.js';
import '../../../src/combat/swingLaw.js';   // registers the swing reader the law reads the bow with

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

test('PVE-CAST: the start is whole at level 1, fades evenly and is gone by level 30', () => {
  assert.equal(pveCastStart(1), PVE_CAST_START);
  assert.equal(pveCastStart(PVE_CAST_START_GONE), 0);
  assert.equal(pveCastStart(45), 0);
  assert.ok(pveCastStart(10) < PVE_CAST_START && pveCastStart(10) > pveCastStart(20));
});

const mage = (destruction, crit, level) => ({ isPlayer: true, level, stats: { luck: 50 }, skills: { [SKILLS.Destruction]: destruction, [SKILLS.CriticalStrike]: crit } });
const foe = { isPlayer: false };

test('PVE-CAST: MY spell at a PvE foe is held to Destruction x0.15 plus the start, crits as a blow, and lands x1.1', () => {
  const m = mage(60, 40, 10), hold = PVE_CAST_PER_SKILL * 60 + pveCastStart(10);
  assert.ok(Math.abs(pveCastHold(m) - hold) < 1e-9);
  const plain = pveCastLanding(500, m, foe, { online: true, rolls: () => 0.99 });   // no crit
  assert.ok(Math.abs(plain - hold * PVE_CAST_X) < 1e-9);
  const crit = pveCastLanding(500, m, foe, { online: true, rolls: () => 0 });   // a crit: x(1 + floor(40 / 5) x 0.05)
  assert.ok(Math.abs(crit - hold * 1.4 * PVE_CAST_X) < 1e-9);
  assert.ok(Math.abs(pveCastLanding(5, m, foe, { online: true, rolls: () => 0.99 }) - 5 * PVE_CAST_X) < 1e-9, 'a spell under the hold keeps its own number');
});

test('PVE-CAST: never at a player, never offline, never a foe\'s, and the effects door rounds it', () => {
  const m = mage(60, 40, 10);
  assert.equal(pveCastLanding(500, m, { isPlayer: true }, { online: true }), null);
  assert.equal(pveCastLanding(500, m, foe, { online: false }), null);
  assert.equal(pveCastLanding(500, { isPlayer: false }, foe, { online: true }), null);
  assert.equal(pveCastLanding(500, { ...m, peer: true }, foe, { online: true }), null);
  assert.equal(casterDamageScaled(500, m, { isPlayer: true }), 500, 'offline at a player: the old law');
});
