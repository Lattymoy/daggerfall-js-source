// AUDIT RPT1026 (lane G, ITEMS) - G2: the verdict RARE-KEPT gave its report does not hold.
//
// The report: a two-handed Wyrmbane worn out in an ELITE dungeon, and gone from the pack. An elite dungeon is a spawned
// one, and spawned dungeons stand on an online page alone (scenes/world.js spawnedDungeonAt). Online, the room forces
// Allow Magic Repairs on (onlineLane.js ONLINE_FORCED_SETTINGS, read first by settings.js getData), and the host's mounted
// enchant ctx reads it (scenes/hostEnchant.js createEnchantCtx's getter) - so the door RARE-KEPT closed
// (enchantments.js enchantLowerCondition's collection arm) keeps EVERY enchanted piece at its break online, a Legendary
// or DFU's own magic, with the RARE-KEPT line or without it. That door is offline-only, behind a player's own Off; the
// report's piece went some other way, and the record's verdict is NEEDS DATA (RARE-KEPT stays, an offline hardening).
// Driven through the real store, the host's own ctx factory, the real dispatcher and DFU's own magic axe (MAGIC.DEF's
// row, createRegularMagicItem) - the piece the RARE-KEPT line does not cover.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setValue, _resetForTests, getBool } from '../../src/systems/settings/settings.js';
import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';
import { setDefaultEnchantCtx, doItemEnchantmentPayloads, PAYLOAD } from '../../src/systems/enchantments.js';
import { createRegularMagicItem } from '../../src/systems/loot/loot.js';
import { MAGIC_ITEM_RECORD_SIZE, ENCHANTMENT_TYPES as T, readMagicDef } from '../../src/formats/magicDef.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { stampedTier } from '../../src/systems/rarityTier.js';

/** MAGIC.DEF's bytes for these records (MagicItemsFile.ReadNextMagicItem's 62 bytes each - rpt1026_items' own). */
function magicDefBytes(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench[i]?.[0] ?? -1); v.setInt8(o++, r.ench[i]?.[1] ?? -1); }
    v.setInt16(o, r.uses, true); o += 2;
    v.setInt32(o, r.value, true); o += 4;
    buf[o++] = 0;
  }
  return buf;
}
const hero = () => {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Finder', hp: 12, primarySkills: [], majorSkills: [], minorSkills: [],
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.items = [];
  return p;
};
const withSearch = (search, fn) => {
  const prev = globalThis.location;
  globalThis.location = { search, href: `http://localhost/play/${search}` };
  try { return fn(); } finally { if (prev === undefined) delete globalThis.location; else globalThis.location = prev; }
};
/** DFU's own magic axe struck to its break through the dispatcher, the host's mounted ctx under it (no per-call ctx -
 *  combat/formulas.js's strike passes none); answers whether the pack still holds it. */
function strikeToBreak() {
  const p = hero();
  setDefaultEnchantCtx(createEnchantCtx({ playerEntity: p, spellsByIndex: () => new Map(), now: () => 0, sinks: {}, magic: {} }));
  const axe = createRegularMagicItem(readMagicDef(magicDefBytes([{ name: '%it of Fire', type: 0, group: 0, ench: [[T.CastWhenStrikes, 25]], uses: 1500, value: 550 }])), 1, 'male', () => 0.99);
  assert.equal(stampedTier(axe), false, 'off the ladder - the RARE-KEPT line does not reach it');
  p.items.push(axe);
  for (let i = 0; i < 1000 && axe.currentCondition > 0; i++) doItemEnchantmentPayloads(PAYLOAD.Strikes, axe, { entity: p, target: { mobileType: 3, health: 1e9 }, damage: 5, nowMinutes: 0 });
  assert.equal(axe.currentCondition, 0, 'its own blows wore it out');
  return p.items.includes(axe);
}

test('G2 RARE-KEPT\'s verdict: ONLINE - where every elite dungeon stands - the door keeps every enchanted piece at its break, a player\'s own Off or not, so the report\'s Wyrmbane was not destroyed there; offline under the Off, DFU\'s own is consumed as DFU has it (mutant: the room\'s rule not forced)', () => {
  _resetForTests();
  try {
    withSearch('', () => setValue('Controls', 'AllowMagicRepairs', 'False'));
    withSearch('?online', () => {
      assert.equal(getBool('Controls', 'AllowMagicRepairs'), true, 'the room\'s rule, whatever the store holds');
      assert.equal(strikeToBreak(), true, 'online the broken piece stays in the pack - no enchanted piece is destroyed there');
    });
    withSearch('', () => assert.equal(strikeToBreak(), false, 'offline, under the player\'s own Off, LowerCondition\'s collection arm takes DFU\'s own'));
  } finally {
    setDefaultEnchantCtx(null);
    _resetForTests();
  }
});
