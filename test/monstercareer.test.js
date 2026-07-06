// E4a: monster careers - ENEMY{nnn}.CFG inside MONSTER.BSA through the
// shared BsaFile + ClassFile readers, on a crafted container.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMonsterCareer, makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74);
  const v = new DataView(b.buffer);
  b[10] = atkFlags;                                     // AttackModifierFlags (offset per the classFile map)
  v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}

function craftMonsterBsa(records) {   // [[name, bytes]] -> NameRecord BSA
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length);
  const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true);
  v.setUint16(2, 0x0100, true);                         // NameRecord
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) {
    for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i);
    v.setInt32(pos + NAME_FIELD, bytes.length, true);
    pos += ENTRY;
  }
  return out;
}

test('monster career: ENEMY{nnn}.CFG through the shared readers, entity fields real', async () => {
  const bsa = craftMonsterBsa([
    ['ENEMY000.CFG', craftCfg({ speed: 0 })],     // placeholder slot
    ['ENEMY015.CFG', craftCfg({ hpPerLevel: 4, speed: 90, agi: 85, atkFlags: 0x08 })],
  ]);
  const fetchBytes = async (n) => { assert.equal(n, 'MONSTER.BSA'); return bsa; };
  const career = await loadMonsterCareer(15, fetchBytes);
  assert.equal(career.speed, 90);
  assert.equal(career.agility, 85);
  assert.equal(career.attackModifierFlags, 0x08);
  // cached: a throwing fetch proves no re-read
  const again = await loadMonsterCareer(15, async () => { throw new Error('re-read'); });
  assert.equal(again, career);
  // missing index -> null (verbatim GetRecordIndex -1 path)
  assert.equal(await loadMonsterCareer(200, fetchBytes), null);
  // the entity consumes it: rat basics + this career
  const e = makeEnemyEntity(0, ENEMY_BASICS['0'], career, 1, () => 0);
  assert.equal(e.liveSpeed, 90);
  assert.equal(e.stats.agility, 85);
  assert.equal(e.attackModifierFlags, 0x08);
  assert.equal(e.maxHealth, 9);                          // monster HP stays the basics range
  assert.equal(e.armor, 30);                             // armorValue * 5 unchanged
});
