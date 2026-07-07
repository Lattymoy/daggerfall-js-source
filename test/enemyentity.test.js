// E3a: the entity layer, verbatim - ClassFile parse on a crafted
// 74-byte record, SetEnemyCareer rules, HP roll bounds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClassFile } from '../src/formats/classFile.js';
import { makeEnemyEntity, rollEnemyClassMaxHealth, skillsLevel, KNIGHT_CITYWATCH_ID } from '../src/characters/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

function craftCfg({ name = 'Mage', hpPerLevel = 8, speed = 60 } = {}) {
  const b = new Uint8Array(74);
  const v = new DataView(b.buffer);
  b[0] = 0x11; b[1] = 0x22; b[2] = 0x33; b[3] = 0x44;   // resist/imm/lowtol/critweak
  v.setUint16(4, 0xBEEF, true);                          // ability/spellpoints
  b[6] = 5; b[7] = 6; b[8] = 7; b[9] = 8; b[10] = 9;     // rapid/regen/unk/absorb/atkmod
  v.setUint16(11, 0xCAFE, true);                         // forbidden materials
  b[13] = 0xAA; b[14] = 0xBB; b[15] = 0xCC;              // a, b, c -> (a<<16)|(c<<8)|b
  for (let i = 0; i < 12; i++) b[16 + i] = 40 + i;       // 3+3+6 skills
  for (let i = 0; i < name.length; i++) b[28 + i] = name.charCodeAt(i);
  v.setUint16(52, hpPerLevel, true);
  v.setUint32(54, 0x18000, true);                        // 16.16 fixed: 1.5
  const attrs = [55, 66, 45, 50, 40, 35, speed, 30];     // STR INT WIL AGI END PER SPD LUC
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}

test('classFile: verbatim 74-byte parse incl the (a<<16)|(c<<8)|b shuffle', () => {
  const cf = new ClassFile();
  cf.load(craftCfg());
  const c = cf.career;
  assert.equal(c.resistanceFlags, 0x11);
  assert.equal(c.abilityFlagsAndSpellPointsBitfield, 0xBEEF);
  assert.equal(c.forbiddenMaterialsFlags, 0xCAFE);
  assert.equal(c.weaponArmorShieldsBitfield, (0xAA << 16) | (0xCC << 8) | 0xBB);
  assert.deepEqual(c.primarySkills, [40, 41, 42]);
  assert.deepEqual(c.minorSkills, [46, 47, 48, 49, 50, 51]);
  assert.equal(c.name, 'Mage');
  assert.equal(c.hitPointsPerLevel, 8);
  assert.equal(c.advancementMultiplierRaw, 0x18000);
  assert.equal(c.advancementMultiplier, 1.5);            // fixed-point converted + 2dp (the raw-u32 latent bug, caught in S3b)
  assert.equal(c.strength, 55);
  assert.equal(c.speed, 60);
  assert.equal(c.luck, 30);
});

test('enemyEntity: class rules verbatim (level, HP roll bounds, skills, LiveSpeed)', () => {
  const cf = new ClassFile(); cf.load(craftCfg({ hpPerLevel: 8, speed: 60 }));
  // min roll: base 10 + level x 1; max roll: base 10 + level x hpPerLevel
  assert.equal(rollEnemyClassMaxHealth(5, 8, () => 0), 15);
  assert.equal(rollEnemyClassMaxHealth(5, 8, () => 0.999999), 10 + 5 * 8);
  assert.equal(skillsLevel(1), 35);
  assert.equal(skillsLevel(14), 100);   // clamps
  assert.equal(skillsLevel(20), 100);
  const e = makeEnemyEntity(128, ENEMY_BASICS['128'], cf.career, 1, () => 0);
  assert.equal(e.level, 1);
  assert.equal(e.maxHealth, 11);
  assert.equal(e.liveSpeed, 60);        // the career's Speed attribute
  assert.equal(e.skills, 35);
  assert.equal(e.armor, 0);             // class armor from equipment (E3b)
  // city watch: +Range(3,7) levels
  const cw0 = makeEnemyEntity(KNIGHT_CITYWATCH_ID, ENEMY_BASICS['146'], cf.career, 1, () => 0);
  assert.equal(cw0.level, 4);
  const cw1 = makeEnemyEntity(KNIGHT_CITYWATCH_ID, ENEMY_BASICS['146'], cf.career, 1, () => 0.999999);
  assert.equal(cw1.level, 7);
});

test('enemyEntity: monster rules verbatim (predefined level, HP range, armor*5)', () => {
  const rat = ENEMY_BASICS['0'];
  const e0 = makeEnemyEntity(0, rat, null, 1, () => 0);
  assert.equal(e0.level, 1);
  assert.equal(e0.maxHealth, 9);        // Range(min, max+1) min roll
  const e1 = makeEnemyEntity(0, rat, null, 1, () => 0.999999);
  assert.equal(e1.maxHealth, 16);       // inclusive max
  assert.equal(e0.armor, 6 * 5);
  assert.equal(e0.minMetalToHit, -1);
});
