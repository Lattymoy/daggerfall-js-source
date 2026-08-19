// AUDIT 17n: the parity pass over U20b and the seams 17m/U20b changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { bonusOrPenaltyByEnemyType, careerAttackModifier, ENEMY_GROUPS, calculateAttackDamage } from '../src/combat/formulas.js';
import { parseCareerData, DIFFICULTY, LABELS, labelFor } from '../src/systems/specialAdvantages.js';
import { buildCustomCareer } from '../src/systems/customClass.js';
import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import { ClassFile } from '../src/formats/classFile.js';

// The corpus half rides the repo's ARENA2_PATH convention: the original
// data is freeware but NOT redistributable, so it never enters the repo
// and CI has none. Skip loudly rather than fail - the synthetic pins
// above carry the law either way.
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;
const stats = Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 50]));
const career = () => buildCustomCareer({ name: 'X', hp: 8, skills: Array(12).fill(0), stats });

// ---- F1: the player never received its own attack modifier ----

test('17n F1: an attacker carrying only a CAREER still gets its enemy-type modifier', () => {
  // DFU reads attacker.Career.<group>AttackModifier for every attacker
  // (FormulaHelper.cs:993-1030). The port flattened the byte onto the
  // entity and only the FOE builder set it (enemyEntity.js:105), so a
  // player - who carries `career` and no flat field - scored 0 on every
  // swing. The target half was wired correctly all along.
  const c = career();
  parseCareerData(c, [{ primary: 'bonusToHit', secondary: 'undead' }]);
  const player = { career: c, level: 7 };
  assert.equal(bonusOrPenaltyByEnemyType(player, ENEMY_GROUPS.Undead), 7,
    'the bonus is +1 per level against the chosen group');
  assert.equal(bonusOrPenaltyByEnemyType(player, ENEMY_GROUPS.Daedra), 0, 'and neutral elsewhere');
  // the phobia half, and the FOE shape (a flat field, no career) still works
  const d = career();
  parseCareerData(d, [{ primary: 'phobia', secondary: 'animals' }]);
  assert.equal(bonusOrPenaltyByEnemyType({ career: d, level: 3 }, ENEMY_GROUPS.Animals), -3);
  assert.equal(bonusOrPenaltyByEnemyType({ attackModifierFlags: 0x01, level: 5 }, ENEMY_GROUPS.Undead), 5,
    'the foe shape - a flat byte and no career - is unchanged');
  // and an attacker with NEITHER is still neutral, not a throw
  assert.equal(bonusOrPenaltyByEnemyType({ level: 4 }, ENEMY_GROUPS.Undead), 0);
});

test('17n F1: the classic ASSASSIN carries a humanoid bonus it had never received', { skip: skipReal }, () => {
  // Not a U20b regression - the gap predates the custom builder. This
  // pin reads the real CLASS11.CFG so it fails if the corpus ever
  // disagrees about which class carries the byte.
  const cf = new ClassFile();
  cf.load(new Uint8Array(readFileSync(join(ARENA2, 'CLASS11.CFG'))));
  assert.equal(cf.career.name, 'Assassin');
  assert.equal(cf.career.attackModifierFlags, 0x04, 'Humanoid | Bonus');
  assert.equal(careerAttackModifier(cf.career.attackModifierFlags, ENEMY_GROUPS.Humanoid), 1);
  // through the entity shape chargen actually mints
  assert.equal(bonusOrPenaltyByEnemyType({ career: cf.career, level: 6 }, ENEMY_GROUPS.Humanoid), 6);
});

test('17n F1: the modifier reaches real damage through calculateAttackDamage', () => {
  // The formula is consumed at three sites; this drives the whole call
  // so a future refactor that drops the term fails here too.
  const c = career();
  parseCareerData(c, [{ primary: 'bonusToHit', secondary: 'undead' }]);
  const attacker = { career: c, level: 10, isPlayer: true, stats, skills: new Array(40).fill(50) };
  const plain = { level: 10, isPlayer: true, stats, skills: new Array(40).fill(50) };
  const target = { isPlayer: false, careerIndex: 0, level: 1 };
  const weapon = { name: 'Longsword', minDamage: 5, maxDamage: 5, material: 0, flags: 0x10 };
  const opts = { weapon, targetGroup: ENEMY_GROUPS.Undead, rolls: () => 0, dfRand: () => 0, toHitMod: 1000 };
  const withBonus = calculateAttackDamage(attacker, target, opts);
  const without = calculateAttackDamage(plain, target, opts);
  assert.equal(withBonus - without, 10, 'exactly +level, and only for the career that bought it');
});

// ---- F2: the data transcription, checked against the sources ----

test('17n F2: the difficulty table matches DFU key-for-key', () => {
  // Diffed against the C# literal during the audit; this pin keeps the
  // shape (50 distinct keys, no duplicate collapsing) from drifting.
  const keys = Object.keys(DIFFICULTY);
  assert.equal(keys.length, 50);
  assert.equal(new Set(keys).size, 50, 'no key collapses onto another');
  // the concatenated keys must never collide with a bare primary, or a
  // priced pick would silently read the wrong row
  const bare = ['expertiseIn', 'immunity', 'resistance', 'criticalWeakness',
    'forbiddenShieldTypes', 'forbiddenWeaponry', 'lowTolerance', 'phobia'];
  for (const b of bare) {
    assert.ok(Object.hasOwn(DIFFICULTY, b), `${b} must be priced bare`);
    assert.ok(!keys.some((k) => k !== b && k.startsWith(b)), `${b} must have no concatenated sibling`);
  }
});

test('17n F2: every label is present and non-empty', () => {
  // The NATIVE-WINDOW RULE: a row that cannot name itself must not draw.
  for (const [k, v] of Object.entries(LABELS)) {
    assert.equal(typeof v, 'string', k);
    assert.ok(v.length > 0, k);
    assert.equal(labelFor(k), v);
  }
  assert.equal(labelFor('nosuchkey'), '', 'an unknown key answers empty rather than undefined');
});

// ---- F3: the career survives the round trip that carries it ----

test('17n F3: parseCareerData leaves every numeric field finite and unsigned', () => {
  // The bitfield writes mask and shift; a wrong mask can drive a field
  // negative or NaN, which would then be saved and reloaded as garbage.
  const c = career();
  parseCareerData(c, [
    { primary: 'acuteHearing', secondary: '' }, { primary: 'athleticism', secondary: '' },
    { primary: 'adrenalineRush', secondary: '' }, { primary: 'bonusToHit', secondary: 'undead' },
    { primary: 'expertiseIn', secondary: 'axe' }, { primary: 'immunity', secondary: 'toFire' },
    { primary: 'increasedMagery', secondary: 'intInSpellPoints3' },
    { primary: 'criticalWeakness', secondary: 'toFrost' }, { primary: 'damage', secondary: 'fromSunlight' },
    { primary: 'darknessPoweredMagery', secondary: 'unableToUseMagicInDaylight' },
    { primary: 'forbiddenArmorType', secondary: 'plate' }, { primary: 'forbiddenMaterial', secondary: 'daedric' },
    { primary: 'forbiddenShieldTypes', secondary: 'towerShield' }, { primary: 'inabilityToRegen', secondary: '' },
  ]);
  for (const [k, v] of Object.entries(c)) {
    if (typeof v !== 'number') continue;
    assert.ok(Number.isFinite(v), `${k} is not finite`);
    assert.ok(v >= 0, `${k} went negative (${v}) - a mask or shift is wrong`);
  }
  // the two packed fields, spelled out
  assert.equal(c.weaponArmorShieldsBitfield, 0x81100, 'expert axe | plate | tower shield');
  assert.equal(c.abilityFlagsAndSpellPointsBitfield & 0xff, 0x1f, 'the five ability bits');
});

test('17n F3: a career with advantages survives the save round trip', () => {
  // AUDIT 17h found the port silently dropped player reputation on
  // save. The career is spread as plain CFG data (save.js:61,88), so
  // the flags ride along - pinned because the same shape has bitten
  // this flow before.
  const c = career();
  parseCareerData(c, [
    { primary: 'immunity', secondary: 'toFire' },
    { primary: 'increasedMagery', secondary: 'intInSpellPoints2' },
  ]);
  const restored = { ...JSON.parse(JSON.stringify({ career: c })).career };
  assert.equal(restored.immunityFlags, 8);
  assert.equal(restored.abilityFlagsAndSpellPointsBitfield, c.abilityFlagsAndSpellPointsBitfield);
  assert.equal(bonusOrPenaltyByEnemyType({ career: restored, level: 2 }, ENEMY_GROUPS.Undead), 0);
});

// ---- the rule, swept rather than remembered ----

test('17n: no test reads the ARENA2 corpus by a hardcoded path', () => {
  // The original data is freeware but NOT redistributable, so it never
  // enters the repo and CI has none. Every corpus test must ride
  // process.env.ARENA2_PATH and SKIP when it is absent.
  //
  // This sweep exists because 17n's own Assassin pin shipped with
  // `/home/claude/dfdata/arena2` baked in: it passed locally, where the
  // data happens to sit, and took the DEPLOY down - the gate is the
  // only thing standing between main and a broken Pages build, and a
  // green local run is not the same check.
  const dir = new URL('.', import.meta.url);
  const offenders = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.test.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const [i, line] of src.split('\n').entries()) {
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
      if (/['"`][^'"`]*\/(dfdata|arena2)\//i.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [], 'corpus paths must come from process.env.ARENA2_PATH');
});
