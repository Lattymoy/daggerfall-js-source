// THE ROSTER, ENFORCED.
//
// Every enemy in ENEMY_BASICS has a voxel design, with one deliberate
// exception. This test exists so that "which enemies are built" is a
// question the suite answers rather than one somebody has to count, and
// so that adding an enemy to the game without a body is a failure rather
// than a thing nobody notices.
import test from 'node:test';
import assert from 'node:assert';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { ORC_DESIGNS } from '../src/characters/orcBody.js';
import { UNDEAD_DESIGNS } from '../src/characters/undeadBody.js';
import { CLASS_DESIGNS } from '../src/characters/humanClasses.js';
import { ATRONACH_DESIGNS } from '../src/characters/atronachs.js';
import { BEAST_DESIGNS } from '../src/characters/beasts.js';
import { DAEDRA_DESIGNS } from '../src/characters/daedra.js';

const LINES = [ORC_DESIGNS, UNDEAD_DESIGNS, CLASS_DESIGNS, ATRONACH_DESIGNS, BEAST_DESIGNS, DAEDRA_DESIGNS];
const built = new Set(LINES.flat().map((d) => d.id));

/** The one entry with no design, and WHY.
 *
 *  Horse_Invalid is a placeholder in Daggerfall's own table: no level, no
 *  damage band, no health, affinity None. It is a hole in the original
 *  data rather than a creature, and building a body for it would be
 *  inventing an enemy the game does not have. */
const EXCLUDED = new Set([MOBILE_TYPES.Horse_Invalid]);

test('roster: every enemy in the game has a body', () => {
  const byId = Object.fromEntries(Object.entries(MOBILE_TYPES).map(([k, v]) => [v, k]));
  const missing = Object.keys(ENEMY_BASICS)
    .map(Number)
    .filter((id) => !built.has(id) && !EXCLUDED.has(id))
    .map((id) => byId[id] || id);
  assert.deepEqual(missing, [], `no voxel design for: ${missing.join(', ')}`);
});

test('roster: the excluded entry really is a hole in the data', () => {
  // If Daggerfall ever gave Horse_Invalid stats, this exclusion stops
  // being honest and the test says so.
  for (const id of EXCLUDED) {
    const r = ENEMY_BASICS[id];
    assert.ok(r, 'the excluded id is not in ENEMY_BASICS at all');
    assert.equal(r.level, undefined, 'the placeholder has a level now — it may be a real enemy');
    assert.equal(r.minDamage, undefined, 'the placeholder has a damage band now');
  }
});

test('roster: no enemy is built twice', () => {
  const all = LINES.flat().map((d) => d.id);
  assert.equal(all.length, new Set(all).size, 'two lines claim the same enemy');
});

test('roster: every design names a real MobileType', () => {
  const valid = new Set(Object.values(MOBILE_TYPES));
  for (const d of LINES.flat()) {
    assert.ok(valid.has(d.id), `${d.name} has an id that is not a MobileType`);
  }
});
