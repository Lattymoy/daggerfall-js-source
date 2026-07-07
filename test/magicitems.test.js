// S4c: MAGIC.DEF verbatim parse + CreateRegularMagicItem routing +
// the MI loot unlock behind the registry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMagicDef, MAGIC_ITEM_RECORD_SIZE } from '../src/formats/magicDef.js';
import {
  createRegularMagicItem, setMagicItemTemplates, generateRandomLoot,
  LOOT_MATRICES, ITEM_GROUPS,
} from '../src/systems/loot.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

function craftMagicDef(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = r.groupIndex ?? 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench?.[i]?.[0] ?? -1); v.setInt8(o++, r.ench?.[i]?.[1] ?? 0); }
    v.setInt16(o, r.uses ?? 100, true); o += 2;
    v.setInt32(o, r.value ?? 0, true); o += 4;
    buf[o++] = r.material ?? 0;
  }
  return buf;
}

test('magicDef: verbatim 62-byte records, index = stream position', () => {
  const bytes = craftMagicDef([
    { name: 'Blazing Blade', type: 0, group: 2, ench: [[3, 7], [12, 1]], uses: 250 },
    { name: 'Auriels Bow', type: 1, group: 2 },
  ]);
  const items = readMagicDef(bytes);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'Blazing Blade');
  assert.equal(items[0].index, 4);                              // first record's stream pos
  assert.equal(items[1].index, 4 + MAGIC_ITEM_RECORD_SIZE);
  assert.equal(items[0].uses, 250);
  assert.deepEqual(items[0].enchantments[0], { type: 3, param: 7 });
  assert.equal(items[0].enchantments[2].type, -1);              // unfilled slots -1
  assert.equal(items[1].type, 1);                               // artifact class 1
});

test('magic items: builder routing verbatim (group byte, arrow re-roll, name swap)', () => {
  const templates = readMagicDef(craftMagicDef([
    { name: 'Sword of Fire', type: 0, group: 2, ench: [[3, 7]], uses: 300 },
    { name: 'Ring of Luck', type: 0, group: 1 },
    { name: 'Skip Artifact', type: 1, group: 0 },
  ]));
  // group 2 -> weapon; roll .95 hits the Arrow slot then re-rolls to .0 Dagger
  const w = createRegularMagicItem(templates, 1, 'male', seq(0, 0.95, 0.5, 0, 0));
  assert.equal(w.group, 'Weapons');
  assert.equal(w.name, 'Sword of Fire');                        // magic name replaces Dagger
  assert.equal(w.magic, true);
  assert.equal(w.maxCondition, 300);
  assert.deepEqual(w.enchantments, [{ type: 3, param: 7 }]);    // -1 slots filtered
  // template pick .6 over 2 regulars -> Ring (artifact filtered out);
  // group 1 pick .8 -> index 4 of {2,3,6,12,25} = Jewellery
  const j = createRegularMagicItem(templates, 1, 'female', seq(0.6, 0.85, 0));
  assert.equal(j.group, 'Jewellery');
  assert.ok(ITEM_GROUPS.Jewellery.includes(j.templateIndex));
  assert.equal(j.name, 'Ring of Luck');
});

test('MI loot: fires with the registry, skips without', () => {
  setMagicItemTemplates(null);
  const who = { level: 1, gender: 'male' };
  // matrix T: MI 1 - dice roll 0 would hit 1%... dice100(1, 0) -> 0<1 true! craft rolls: gold, AM x2 dice(0.99 x?)...
  // simpler: a custom matrix with MI 100 and nothing else
  const M = { MinGold: 0, MaxGold: 0, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0, AM: 0, WP: 0, MI: 100, CL: 0, BK: 0, M2: 0, RL: 0 };
  const none = generateRandomLoot(M, who, seq(0.99));
  assert.equal(none.filter((i) => i.magic).length, 0);          // registry absent: skipped
  setMagicItemTemplates(readMagicDef(craftMagicDef([{ name: 'Torc', type: 0, group: 1, uses: 50 }])));
  // rolls: WP dice .99 miss, AM .99, 7 ingredients .99, MI dice .0 HIT -> template .0, group1 .0 -> Armor(2) piece .0 mat .5, MI dice .99 stop, CL/BK/RL .99
  const loot = generateRandomLoot(M, who, seq(0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0, 0, 0, 0, 0.5, 0.99));
  const magic = loot.filter((i) => i.magic);
  assert.equal(magic.length, 1);
  assert.equal(magic[0].name, 'Torc');
  assert.equal(magic[0].group, 'Armor');
  setMagicItemTemplates(null);                                  // leave the module clean
});
