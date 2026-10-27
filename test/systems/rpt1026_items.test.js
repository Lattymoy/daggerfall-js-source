// RPT1026-ITEMS (bible/01-Overview/bugs/, the private reports of 2026-10-26): the item group's pins.
//
// HELD-OUT - three private reports of gear lost around an Identify at the Mages Guild, one of them Legendaries identified
// there and missing once the client had restarted for a new version. A trade counter stages the
// player's own pieces OUT of the pack (DaggerfallTradeWindow.TransferItem; D7) until the window closes, and the save read
// the pack alone - so a checkpoint written while an Identify's lot stood on the counter (every five minutes online, a
// page hidden, a title exit) wrote the character without it, and a session that ended before the next one came back to
// that record. Driven through both skins' real counters over a made character's pack (chargen.js), the Legendary the
// loot ladder mints (lootRarity.js applyRarity - it drops unknown), its realm id stamped as a checkpoint stamps it
// (itemIds.js stampItemIds), the save the game writes (save.js snapshotPlayer) and the realm judge's own reading of it
// (server-account/src/judge.js ledgerPieces).
import '../modsOff.js';
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withDom } from '../invdrag.mjs';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { itemIsIdentified } from '../../src/systems/tradeModes.js';
import { stampItemIds } from '../../src/systems/item/itemIds.js';
import { heldOutOf } from '../../src/systems/item/heldOut.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { NativeTradeWindow } from '../../src/ui/native/nativeTrade.js';
import { mountEnhancedTrade } from '../../src/ui/enhanced/enhancedTrade.js';
import { ledgerPieces } from '../../server-account/src/judge.js';
import { LEGENDARIES } from '../../src/systems/loot/lootRarity.js';
import { doItemEnchantmentPayloads, PAYLOAD, DURABILITY_LOSS_ON_STRIKE } from '../../src/systems/enchantments.js';
import { createRegularMagicItem } from '../../src/systems/loot/loot.js';
import { MAGIC_ITEM_RECORD_SIZE, ENCHANTMENT_TYPES as T, readMagicDef } from '../../src/formats/magicDef.js';
import { equipItem, isEquipped } from '../../src/systems/equip.js';

const BROADSWORD = 118, LONGSWORD = 120, BATTLE_AXE = 127;
/** The classic counter's first local slot and its mode action (test/systems/road_d7_trade_residue.test.js's). */
const LOCAL_SLOT0 = [192, 48 + 20];
const MODE_ACTION = [226 + 15, 134 + 7];

/** A made character holding a plain Longsword and the ladder's Legendary Broadsword - unknown, as loot drops it, and
 *  given its realm id by an earlier checkpoint. */
function hero() {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Finder', hp: 12, primarySkills: [], majorSkills: [], minorSkills: [],
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  const legend = applyRarity(createWeapon(BROADSWORD, 3, () => 0.5), 'legendary', seededRng(7));
  p.items = [createWeapon(LONGSWORD, 1, () => 0.5), legend];
  p.goldPieces = 100_000;
  stampItemIds(p, (b) => b.fill(7));
  return { p, legend };
}
/** The save the game writes for `p`, as the wire carries it to the realm. */
const saveOf = (p) => JSON.parse(JSON.stringify(snapshotPlayer(p, {})));
/** How many times the save holds the piece of ledger key `uid` - the realm judge's own reading. */
const held = (save, uid) => ledgerPieces(save).filter((x) => x.key === uid).length;
/** The counter's hooks as the host builds them (scenes/worldModes.js openTradeWindow): the LIVE pack and the entity. */
const hooksOf = (p, mode, extra = {}) => ({
  mode, entity: p, shelfItems: () => [], packItems: () => (p.items ??= []), otherItems: () => (p.otherItems ??= []),
  isEquipped: (it) => it.equipSlot != null, accepts: () => true, enchanted: () => true,
  priceCtx: () => ({ quality: 10, priceAdjustment: 1000, skills: { mercantile: 50, personality: 50 } }),
  gold: () => p.goldPieces, rows: (id) => [{ text: `#${id}`, center: true }], weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
  commit: (m, staged) => { if (m === 'Identify') for (const it of staged) it.isIdentified = true; },
  icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
  ...extra,
});

test('HELD-OUT, the classic counter: a Legendary staged for the Mages Guild\'s Identify is in every save written while it stands - unknown, then known - and once more in the pack after the counter closes, never twice (mutants: the save reads the pack alone; the counter holds nothing)', () => {
  const { p, legend } = hero();
  const uid = legend.uid;
  assert.equal(legend.rarity, 'legendary', 'the ladder minted a Legendary');
  assert.equal(itemIsIdentified(legend), false, 'and it is unknown, as loot drops it');
  assert.equal(held(saveOf(p), uid), 1, 'the save before the counter holds it');
  const w = new NativeTradeWindow(hooksOf(p, 'Identify'));
  w.click(...LOCAL_SLOT0);
  assert.deepEqual(w.staged, [legend], 'staged on the counter');
  assert.equal(p.items.includes(legend), false, 'and out of the pack, as TransferItem moves it');
  const under = saveOf(p);
  assert.equal(held(under, uid), 1, 'a checkpoint under the counter still holds the piece - the record the next join reads');
  w.click(...MODE_ACTION);
  w.input('KeyY');
  assert.equal(itemIsIdentified(legend), true, 'the guild named it');
  const known = saveOf(p);
  assert.equal(held(known, uid), 1, 'and a checkpoint after the payment holds it, known');
  assert.equal(known.items.find((it) => it.uid === uid)?.isIdentified, true);
  w.input('Escape');
  assert.equal(p.items.includes(legend), true, 'the pop hands it back');
  assert.equal(held(saveOf(p), uid), 1, 'and the save holds it once, never twice');
  assert.deepEqual(heldOutOf(p), [], 'the closed counter holds nothing any more');
  // the next join, off the record written under the counter
  const back = structuredClone(playerEntity);
  restorePlayer(back, under);
  assert.equal(back.items.filter((it) => it.uid === uid).length, 1, 'a session ended under the counter comes back with the piece');
});

test('HELD-OUT, the enhanced counter: the same law through the default skin\'s window - staged by its double click, saved while staged, back once at the close (mutant: the counter holds nothing)', () => {
  withDom((dom) => {
    const { p, legend } = hero();
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountEnhancedTrade(host, hooksOf(p, 'Identify'));
    const row = host.querySelectorAll('.itemrow').find((r) => r._tradeItem === legend);
    assert.ok(row, 'the Legendary is on the counter\'s list');
    row.onclick({ timeStamp: 1000 });
    row.onclick({ timeStamp: 1010 });
    assert.equal(p.items.includes(legend), false, 'the double click staged it out of the pack');
    assert.equal(held(saveOf(p), legend.uid), 1, 'a checkpoint under the counter holds it');
    view.unmount();
    assert.equal(p.items.includes(legend), true, 'the teardown hands it back');
    assert.equal(held(saveOf(p), legend.uid), 1, 'once');
  });
});

test('HELD-OUT holds only the counter\'s own player\'s goods, and never a Buy basket - the shop\'s piece is no save\'s (mutant: every window\'s goods in every save)', () => {
  const a = hero(), b = hero();
  const w = new NativeTradeWindow(hooksOf(a.p, 'Identify'));
  w.click(...LOCAL_SLOT0);
  assert.equal(held(saveOf(a.p), a.legend.uid), 1, 'the counter\'s player holds it');
  assert.equal(saveOf(b.p).items.length, b.p.items.length, 'another character\'s save is its own pack and nothing else');
  w.input('Escape');
  const shelf = [createWeapon(LONGSWORD, 2, () => 0.5)];
  const buy = new NativeTradeWindow(hooksOf(b.p, 'Buy', { shelfItems: () => shelf }));
  buy.basket.push(shelf.pop());
  assert.equal(saveOf(b.p).items.length, b.p.items.length, 'a basket is the shop\'s goods until the deal');
  buy.input('Escape');
});

// RARE-KEPT - a private report: a two-handed Wyrmbane worn to nothing in a hard dungeon, and gone from the pack after.
// Wyrmbane's own enchantment is DFU's Cast When Strikes (lootRarity.js LEGENDARIES), which bills
// DURABILITY_LOSS_ON_STRIKE a blow through LowerCondition's collection arm - and that arm DESTROYS a broken enchanted piece
// wherever Allow Magic Repairs is off (DaggerfallUnityItem.LowerCondition). RARE-BREAK1's law (the owner: "Rarity loot
// breaks, not destroyed") held for the overhaul's fading alone. Driven through the real payload dispatcher over the
// ladder's own Wyrmbane on a Battle Axe, beside DFU's own magic axe (MAGIC.DEF's row, createRegularMagicItem), which keeps
// DFU's law.

/** MAGIC.DEF's bytes for these records (MagicItemsFile.ReadNextMagicItem's 62 bytes each - fb1001_identify's). */
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
/** Blows until the piece breaks, through DoItemEnchantmentPayloads' Strikes arm with Allow Magic Repairs OFF. */
function strikeUntilBroken(p, weapon, said) {
  const target = { mobileType: 3, health: 1e9 };
  for (let i = 0; i < 1000 && (weapon.currentCondition ?? 0) > 0; i++) {
    doItemEnchantmentPayloads(PAYLOAD.Strikes, weapon, { entity: p, target, damage: 5, nowMinutes: 0, ctx: { allowMagicRepairs: false, say: (l) => said.push(l) } });
  }
}

test('RARE-KEPT: a Legendary its own Cast When Strikes wears to nothing BREAKS AND STAYS in the pack, unequipped and said - where DFU\'s own magic axe is consumed by the same blows, as DaggerfallUnityItem.LowerCondition has it (mutant: the ladder\'s piece consumed again)', () => {
  const { p } = hero();
  const wyrmbane = LEGENDARIES.find((l) => l.id === 'wyrmbane');
  const axe = applyRarity(createWeapon(BATTLE_AXE, 3, () => 0.5), 'legendary', seededRng(3), [wyrmbane]);
  assert.deepEqual([axe.rarity, axe.legendary, axe.name], ['legendary', 'wyrmbane', 'Wyrmbane'], 'the ladder\'s Wyrmbane, on a Battle Axe');
  assert.ok((axe.enchantments ?? []).some((e) => e.type === T.CastWhenStrikes), 'its flavour is DFU\'s Cast When Strikes');
  p.items.push(axe);
  equipItem(p, axe);
  assert.equal(isEquipped(axe), true, 'wielded');
  const said = [];
  strikeUntilBroken(p, axe, said);
  assert.equal(axe.currentCondition, 0, `its blows wore it out, ${DURABILITY_LOSS_ON_STRIKE} a blow`);
  assert.equal(p.items.includes(axe), true, 'and it is still in the pack - broken, repairable');
  assert.equal(isEquipped(axe), false, 'taken off as a broken piece is');
  assert.ok(said.some((l) => /has broken/.test(l)), `the player is told: ${JSON.stringify(said)}`);
  // DFU's own magic item, the same blows: LowerCondition's collection arm, as DFU has it
  const dfuAxe = createRegularMagicItem(readMagicDef(magicDefBytes([{ name: '%it of Fire', type: 0, group: 0, ench: [[T.CastWhenStrikes, 25]], uses: 1500, value: 550 }])), 1, 'male', () => 0.99);
  assert.equal(dfuAxe.rarity, undefined, 'DFU\'s own magic is off the ladder');
  p.items.push(dfuAxe);
  strikeUntilBroken(p, dfuAxe, said);
  assert.equal(p.items.includes(dfuAxe), false, 'DFU\'s own enchanted piece is consumed at its break, Allow Magic Repairs off');
});
