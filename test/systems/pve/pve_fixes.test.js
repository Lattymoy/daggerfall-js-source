// PVE-CAST (bible/05-Combat/Fixed-PvE.md section 5): MY spell at a PvE foe lands on the mages' rework, with its start
// fading out by level 30. The bow's law is test/combat/bowlaw.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pveCastLanding, pveCastStart, pveCastHold, PVE_CAST_START, PVE_CAST_START_GONE, PVE_CAST_X, PVE_CAST_PER_SKILL } from '../../../src/systems/spell/pveCast.js';
import { casterDamageScaled } from '../../../src/systems/effects.js';
import { SKILLS } from '../../../src/systems/skills.js';

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
