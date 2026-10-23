// FB1012d SALVAGE-CLASSIC (FIELD BUGS 2026-10-12b; bible/01-Overview/bugs/Field-Bugs-2026-10-12d.md). Discord bug-reports,
// "magic item with only cast on use effect cannot be salvaged": "like in the screenshot. it doesn't show up at all in the
// reforge menu for salvaging" - a card reading "Blazing Holy Dagger of Fireballs", Magic, "Cast when used: Fireball",
// 0.50 kg, New 100%.
//
// The piece is DFU's own magic: MAGIC.DEF's "Blazing %it of Fireballs" (one CastWhenUsed row, spell 14) on a Holy
// Dagger (ReligiousItems 270, 0.5 kg - group 0's fourth draw), uses 1500. Its card wears Magic because lootRarity.js
// rarityOf derives it for any enchanted piece; LOOT9's salvage reads the ladder's own `rarity`, which DFU's mint never
// writes - so the Salvage page dropped it without a word, and the pack card offered nothing. The law stands (a guild's
// shelf sells that magic every day and its Item Maker makes it; shards come from what was found, never bought), and
// the faces now say so: salvageRefusal answers 'classic', the Salvage page lists the piece after the ones that break
// with its press "Classic magic" and why, and the pack card's Salvage says why instead of asking.
//
// Every piece here is minted by its real producer: the reported dagger by loot.js createRegularMagicItem over DFU's own
// MAGIC.DEF rows (test/dfuMagicItems.mjs, read by formats/magicDef.js readMagicDef) and itemTemplates.js setItemFields +
// mintCondition, as the world's mint does; the guild's shelf by shopStock.js stockGuildMagicItems; an Item Maker's
// piece by enchanting.js applyEnchantments; a made piece by smithItems.js mintPiece; the ladder's by applyRarity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as RF from '../../src/systems/reforge.js';
import { readMagicDef, MAGIC_ITEM_RECORD_SIZE } from '../../src/formats/magicDef.js';
import { createRegularMagicItem, ITEM_GROUPS } from '../../src/systems/loot/loot.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { stockGuildMagicItems } from '../../src/systems/shopStock.js';
import { applyEnchantments } from '../../src/systems/enchanting.js';
import { enchantmentSettings } from '../../src/systems/enchantmentCatalogue.js';
import { mintPiece } from '../../src/systems/smithItems.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { welkyndShards } from '../../src/systems/gate/gateSpoils.js';
import { resolveItemName, itemLongName } from '../../src/systems/item/itemInfo.js';
import { withDom } from '../invdrag.mjs';
import { mountReforgeWindow, REFORGE_REFUSALS } from '../../src/ui/reforgeWindow.js';
import { mountEnhancedInventory, SALVAGE_CLASSIC } from '../../src/ui/enhanced/enhancedInventory.js';
import { destroyEnhancedNotice } from '../../src/ui/enhanced/enhancedNotice.js';
import { DFU_MAGIC_ITEMS } from '../dfuMagicItems.mjs';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;

/** DFU's MAGIC.DEF as its bytes (the tree carries no ARENA2): MagicItemTemplates.txt's 59 rows, 62 bytes each. */
function magicDefBytes(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length && i < 31; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = r.groupIndex ?? 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench?.[i]?.[0] ?? -1); v.setInt8(o++, r.ench?.[i]?.[1] ?? 0); }
    v.setInt16(o, r.uses ?? 100, true); o += 2;
    v.setInt32(o, r.value ?? 0, true); o += 4;
    buf[o++] = r.material ?? 0;
  }
  return buf;
}
const MAGIC_DEF = readMagicDef(magicDefBytes(DFU_MAGIC_ITEMS));
const REGULAR = MAGIC_DEF.filter((t) => t.type === 0);
const HOLY_DAGGER = 270;

/** A regular magic item as the world mints it (world.js's `mintCondition(setItemFields(createRegularMagicItem(...)))`),
 *  its dice chosen: MAGIC.DEF row `name`, group 0's draw `groupDraw` of seven, then the base's own draw. */
function dfuMagic(name, { groupDraw = 3, base = HOLY_DAGGER } = {}) {
  const k = REGULAR.findIndex((t) => t.name === name);
  assert.ok(k >= 0, `MAGIC.DEF holds ${name}`);
  const religious = ITEM_GROUPS.ReligiousItems;
  const dice = [(groupDraw + 0.5) / 7, (religious.indexOf(base) + 0.5) / religious.length];
  let i = 0;
  const it = mintCondition(setItemFields(createRegularMagicItem(MAGIC_DEF, 10, 'male', () => dice[i++] ?? 0.5, k)));
  return Object.assign(it, { isIdentified: true });
}
const reported = () => dfuMagic('Blazing %it of Fireballs');
const graded = (tier, seed) => Object.assign(LR.applyRarity(createWeapon(113, 1), tier, lcg(seed)), { isIdentified: true });

test('SALVAGE-CLASSIC: the reported piece, as DFU mints it - "Blazing Holy Dagger of Fireballs", wearing Magic, one Cast When Used row, and no ladder grade; the law refuses it as classic, nothing taken', () => {
  on();
  const dagger = reported();
  assert.equal(resolveItemName(dagger), 'Blazing Holy Dagger of Fireballs', 'the card\'s own name');
  assert.deepEqual([dagger.group, dagger.templateIndex, dagger.magic, dagger.enchantments, dagger.maxCondition, dagger.currentCondition],
    ['ReligiousItems', HOLY_DAGGER, true, [{ type: 0, param: 14 }], 1500, 1500], 'Cast When Used: Fireball (spell 14), new');
  assert.equal(dagger.rarity, undefined, 'DFU\'s mint writes no grade');
  assert.equal(LR.tierLabel(dagger), 'Magic', 'and its card says Magic all the same');
  assert.equal(RF.salvageShards(dagger), 0, 'LOOT9: it breaks for no shard');
  assert.equal(RF.salvageRefusal(dagger), 'classic', 'and the law says why');
  const items = [dagger];
  assert.deepEqual(RF.salvagePiece(dagger, { items }), { ok: false, reason: 'classic' });
  assert.deepEqual(items, [dagger], 'nothing taken, no shard made');
});

test('SALVAGE-CLASSIC: the class - every DFU magic row whatever its kind, a guild shelf\'s bought piece and an Item Maker\'s are classic; a Common and a made piece stay "not"; the ladder\'s Magic and Rare still break', () => {
  on();
  // DFU's own magic of other kinds: a Held row, a Strikes row, an Absorbs row - none is graded, every one wears Magic
  for (const name of ['%it of the Wise', '%it of Life Stealing', '%it of Magicka', 'Frosty %it of Ice Storms']) {
    const it = dfuMagic(name);
    assert.deepEqual([LR.tierLabel(it), RF.salvageShards(it), RF.salvageRefusal(it)], ['Magic', 0, 'classic'], name);
  }
  // THE DOOR THIS LAW KEEPS SHUT: a guild shelf mints that magic every day, for gold
  const shelf = stockGuildMagicItems({ quality: 10, gameMinutes: 0 }, { magicItemTemplates: MAGIC_DEF, playerLevel: 10, gender: 0 });
  const bought = shelf.filter((it) => it.magic === true);
  assert.ok(bought.length >= 2, 'the shelf holds DFU magic');
  for (const it of bought) {
    assert.deepEqual([RF.salvageShards(it), RF.salvageRefusal(it)], [0, 'classic'], `${it.name} - bought, never broken`);
    const pack = [it];
    assert.equal(RF.salvagePiece(it, { items: pack }).ok, false);
    assert.deepEqual(pack, [it]);
  }
  // an Item Maker's piece: DFU's SetEnchantments on a plain sword - Magic on its card, never graded
  const made = applyEnchantments(createWeapon(113, 1), [enchantmentSettings('FeatherWeight')]);
  assert.deepEqual([made.rarity, LR.tierLabel(made), RF.salvageRefusal(made)], [undefined, 'Magic', 'classic']);
  // a Common is nothing to salvage, and a crafted piece's door is the Enchanting Station's (AUDIT LOOT F2 stands)
  assert.equal(RF.salvageRefusal(createWeapon(113, 1)), 'not', 'a Common');
  const sup = mintPiece({ recipe: 'longsword:mithril', quality: 3, seed: 9 }, '00000000000000a3');
  assert.deepEqual([sup.rarity, LR.tierLabel(sup), RF.salvageRefusal(sup)], ['magic', 'Magic', 'not'], 'a Superior - made, never classic');
  // the ladder's own, whatever their lines: a Magic and a Rare break as ever
  assert.deepEqual([graded('magic', 3), graded('rare', 4)].map((it) => [RF.salvageShards(it), RF.salvageRefusal(it)]), [[1, null], [3, null]]);
  // with the ladder off, nothing salvages and nothing is said beyond it (OFF IS DFU EXACTLY)
  _resetForTests(); setPref('lootRarity', false);
  assert.equal(RF.salvageRefusal(reported()), 'off');
});

test('SALVAGE-CLASSIC: the Salvage page lists the classic piece after every piece that breaks - "Classic magic", no shards, why in its title; its press does nothing and the every-Magic sweep passes it by', () => {
  on();
  assert.equal(REFORGE_REFUSALS.classic, "Classic magic items can't be salvaged. Only pieces with a rarity give shards");
  withDom((dom) => {
    const dagger = reported();
    const a = graded('magic', 21);
    const b = graded('magic', 22);
    const plain = createWeapon(113, 1);
    const me = { items: [dagger, a, plain, b, welkyndShards(1)], goldPieces: 0 };
    const calls = [];
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      page: 'salvage', items: () => me.items, payer: () => me, gold: () => 0, picture: () => null, nameOf: (it) => itemLongName(it),
      reforge: () => ({ ok: false }), salvage: (it) => { calls.push(it); return RF.salvagePiece(it, { items: me.items }); },
    });
    try {
      const shell = one(host, 'reforge-shell');
      const rows = kids(shell, 'broker-offer');
      assert.deepEqual(rows.map((r) => one(r, 'broker-name').textContent), [itemLongName(a), itemLongName(b), 'Blazing Holy Dagger of Fireballs'],
        'the two that break, then the classic piece - never the Common');
      const row = rows[2];
      assert.equal(one(row, 'broker-set').textContent, 'Magic');
      assert.equal(one(row, 'broker-price').textContent, 'No shards');
      const btn = one(row, 'broker-buy');
      assert.equal(btn.textContent, 'Classic magic');
      assert.equal(btn.attrs['aria-disabled'], 'true', 'MENU-ORDER: refused, never disabled - pressed, it says why');
      assert.equal(btn.attrs.title, REFORGE_REFUSALS.classic);
      assert.equal(btn.attrs['aria-label'], `Classic magic - Blazing Holy Dagger of Fireballs: ${REFORGE_REFUSALS.classic}`, 'PIN MOVED (AUDIT MENU-ORDER U15): its name starts with the word it shows');
      one(rows[0], 'broker-buy').onclick({ stopPropagation() {} });   // a break asked of another piece first...
      assert.equal(one(kids(shell, 'broker-offer')[0], 'broker-buy').textContent, 'Break it');
      btn.onclick({ stopPropagation() {} });
      assert.deepEqual(calls, [], 'its press asks nothing and breaks nothing');
      assert.equal(one(shell, 'broker-note').textContent, REFORGE_REFUSALS.classic, 'and says its whole reason under the header');
      assert.equal(one(kids(shell, 'broker-offer')[0], 'broker-buy').textContent, 'Salvage', 'MENU-ORDER: ...and the ask let go with it (AUDIT LOOT II B4)');
      assert.equal(kids(shell, 'reforge-keep').length, 0);
      assert.ok(me.items.includes(dagger));
      assert.equal(one(shell, 'every-magic').textContent, 'Salvage every Magic (2)', 'the sweep counts the ladder\'s two alone');
      assert.equal(one(rows[0], 'broker-price').textContent, '1 Welkynd Shard', 'a piece that breaks says its yield as ever');
    } finally { view.unmount(); }
  });
});

test('SALVAGE-CLASSIC: the pack card offers Salvage on the classic piece, and its press says why - no question asked, nothing broken', () => {
  on();
  _resetForTests();
  setPref('lootRarity', true);
  destroyEnhancedNotice();
  globalThis.location = { search: '?skin=enhanced' };
  const dagger = reported();
  const name = itemLongName(dagger);
  assert.equal(SALVAGE_CLASSIC(name), 'Blazing Holy Dagger of Fireballs will not break: its magic is the classic kind the guilds sell and make. Welkynd Shards come only from loot with a rarity grade.');
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [dagger, createWeapon(120, 1)], goldPieces: 10 };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
    let t = 0;
    const press = (b) => b.onclick({ timeStamp: (t += 5000), detail: 1, stopPropagation() {} });
    try {
      const rowOf = (n) => host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(n)) ?? null;
      const actOf = (label) => host.querySelectorAll('.act').find((b) => b.textContent === label) ?? null;
      for (const tab of host.querySelectorAll('.packtab')) { tab.onclick(); if (rowOf(name)) break; }
      assert.ok(rowOf(name), 'the dagger is in the pack');
      rowOf(name).onclick({ timeStamp: (t += 5000), detail: 1 });
      if (!actOf('Info')) rowOf(name).onclick({ timeStamp: (t += 5000), detail: 1 });
      assert.ok(actOf('Salvage'), 'the card offers it');
      press(actOf('Salvage'));
      assert.equal(dom.doc.querySelectorAll('.inv-salvage')[0] ?? null, null, 'no question: it will never break');
      assert.ok(textOf(dom.body).includes(SALVAGE_CLASSIC(name)), 'the card says why');
      assert.ok(e.items.includes(dagger), 'nothing broken');
      assert.equal(RF.shardsHeld(e.items), 0, 'no shard made');
    } finally { view.unmount(); }
  });
});
