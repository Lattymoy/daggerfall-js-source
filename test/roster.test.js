// THE ROSTER, ENFORCED.
//
// Every enemy in ENEMY_BASICS has a voxel design, with one deliberate
// exception. This test exists so that "which enemies are built" is a
// question the suite answers rather than one somebody has to count, and
// so that adding an enemy to the game without a body is a failure rather
// than a thing nobody notices.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
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

// ── A DESIGN WEARS WHAT ITS DESIGN SAYS ──────────────────────────
// Third time this rule has had to be enforced somewhere. First the
// loose armour pieces, which stayed on when a villager was picked.
// Then the drape FIT, which sized a garment for the wrong body. Now the
// drape SELECTION, which was left wherever the user had put it.

test('drape: a design with none is passed to the drape path, not null', () => {
  // `applyVillagerDrape(null)` means "no design is selected, leave the
  // control where the user put it" — right for the bare rig, where
  // cycling garments is the whole point, and absurd for an enemy.
  // Handing it null for every design without a drape meant a bat wore
  // whatever happened to be showing: cycle the control to a skirt, pick
  // an animal, and the animal is in a skirt.
  const src = readFileSync(new URL('../src/tools/paperdollViewer.js', import.meta.url), 'utf8');
  assert.ok(
    /applyVillagerDrape\(o\);/.test(src),
    'the enemy path still hands the drape function null for undressed designs',
  );
  assert.ok(
    !/applyVillagerDrape\(o\.drape \? o : null\)/.test(src),
    'the old null-for-no-drape call is back',
  );
});

test('drape: the animals ask for none, and would be absurd in one', () => {
  // Not a code check: a statement about the designs. If somebody ever
  // gives a slaughterfish a gown this fails and they have to mean it.
  const ANIMALS = ['Giant Rat', 'Grizzly Bear', 'Sabertooth Tiger', 'Giant Bat', 'Giant Spider',
                   'Giant Scorpion', 'Slaughterfish', 'Dragonling', 'Dragonling (elder)'];
  for (const name of ANIMALS) {
    const d = BEAST_DESIGNS.find((x) => x.name === name);
    assert.ok(d, `${name} is missing`);
    assert.ok(!d.drape, `${name} is wearing ${d.drape && d.drape.name} — it is an animal`);
  }
  // And the two that DO wear something are not animals: a spriggan's
  // canopy is foliage, and it is a walking tree.
  const spriggan = BEAST_DESIGNS.find((x) => x.name === 'Spriggan');
  assert.ok(spriggan.drape, 'the spriggan lost its canopy');
});
