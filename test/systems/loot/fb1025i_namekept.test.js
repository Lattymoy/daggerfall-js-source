// NAME-KEPT (FIELD BUGS 2026-10-25i item 1, `bible/01-Overview/bugs/Field-Bugs-2026-10-25i.md`). SaberGGaming, in
// #bug-reports: "if you've renamed your item it will revert it back into its original name like 'Sabers mule's ring
// of ...'". The Reforge (lootRarity.js reforgeAffix, one roll at the Mages Guild and with Essence) named the piece
// again from its TEMPLATE: a name the Item Maker gave (RenameItem) was lost, a Masterwork's own name (its maker's
// mark names it) took the ladder's words its mint withholds, and a crafted jewel lost its metal and gem ("Silver
// Ring" to "Ring"). Now a name is the ladder's - its words around its base, read off the piece - or the piece's own,
// which stands (AUDIT FB1025i A1-A5: the first law parsed a name by the lines it had, and kept a curse's or an unset
// gem's word stale, an older reforge's damage, a partial rename's word). Every piece from its real producer (TEST THE
// SHAPE THE PRODUCER MINTS): the jeweller's mint, the Item Maker's window, the loot ladder, the curse, the questline's
// named reward, the Imbue, the save's load.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LR from '../../../src/systems/loot/lootRarity.js';
import * as RF from '../../../src/systems/reforge.js';
import { mintPiece, reforgeItem } from '../../../src/systems/smithItems.js';
import { MINT_VERSION } from '../../../src/net/productRecord.js';
import { ItemMakerWindow } from '../../../src/ui/item/itemMakerWindow.js';
import { enchantmentSettings, PARAM_NONE } from '../../../src/systems/enchantmentCatalogue.js';
import { itemLongName } from '../../../src/systems/item/itemInfo.js';
import { welkyndShards } from '../../../src/systems/gate/gateSpoils.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { rollRewardChoice } from '../../../src/systems/questlines/qlRewards.js';
import { repairItemLists } from '../../../src/systems/save/save.js';
import { seededRng } from '../../../src/systems/wind/wind.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const PROV = '0123456789abcdef';
/** The jeweller's mint (smithItems.js mintPiece): Saber's ring at `quality` (3 Superior - Magic, 4 Masterwork - Rare). */
const ring = (quality, seed) => mintPiece({ recipe: 'ring:silver', quality, seed, maker: 'Saber', version: MINT_VERSION }, PROV);
/** A Masterwork Rare whose first line is carrying capacity, as the report's ring. */
const mule = () => { for (let s = 1; s < 500; s++) { const it = ring(4, s); if (it.affixes[0].id === 'weight') return it; } return null; };
/** The words a piece's lines put around its name, off the kinds' own words (nameAround's law). */
const words = (it) => {
  const own = it.affixes.filter((a) => a.gem == null && !LR.AFFIX_KINDS[a.id].proc);
  const at = (slot) => own.find((a) => LR.AFFIX_KINDS[a.id].slot === slot);
  return { pre: at('prefix') ? LR.affixWord(at('prefix'), it.rarity) : null, suf: at('suffix') ? LR.affixWord(at('suffix'), it.rarity) : null };
};
/** Every reforgeable line pressed once, at the Mages Guild and with Essence by turns; each press's piece handed to `seen`. */
function reforgeEvery(it, seen) {
  const me = { items: [it, welkyndShards(999)], goldPieces: 100_000_000 };
  for (const [k, i] of LR.reforgeableLines(it).entries()) {
    const was = it.affixes[i];
    const line = k % 2 ? reforgeItem(it, i, 1000 + k) : RF.reforgePiece(it, i, me, seededRng(k + 1)).line;
    assert.ok(line && line.id !== was.id, `line ${i} replaced (${was.id} -> ${line?.id})`);
    seen(it);
  }
}

test('NAME-KEPT: the report - Saber\'s Masterwork ring, given its own name at the Item Maker, keeps that name through every reforge, at the Guild and with Essence (mutants: the old law; a prefix or a suffix not checked)', () => {
  on();
  const it = mule();
  assert.ok(it, 'a Masterwork Rare ring of the jeweller\'s mint, carrying capacity its first line');
  assert.deepEqual([it.rarity, it.name, itemLongName(it)], ['rare', 'Silver Ring', "Saber's Silver Ring"], 'the mark names a Masterwork');
  const player = { items: [it], goldPieces: 10_000_000 };
  const w = new ItemMakerWindow({ player, entity: player, packItems: () => player.items });
  w._selectItem(it);
  w.itemName = 'Ward of the Wanderer';
  w.powers = [enchantmentSettings('FeatherWeight', PARAM_NONE)];
  w._enchant();
  assert.deepEqual([it.name, itemLongName(it)], ['Ward of the Wanderer', "Saber's Ward of the Wanderer"], 'RenameItem (DaggerfallItemMakerWindow.cs:761): the name the player gave');
  reforgeEvery(it, (p) => assert.deepEqual([p.name, itemLongName(p)], ['Ward of the Wanderer', "Saber's Ward of the Wanderer"], 'the player\'s name stands'));
  assert.ok(it.reforges >= 3, `${it.reforges} reforges`);
  // a name that keeps the lines' suffix and drops their prefix ("Mule's") is the player's too
  const half = mule();
  const { pre, suf } = words(half);
  assert.ok(pre != null && suf != null, `${pre} / ${suf}`);
  half.name = `Lucky Band ${suf}`;
  reforgeEvery(half, (p) => assert.equal(p.name, `Lucky Band ${suf}`));
});

test('NAME-KEPT: a Masterwork\'s own name - its mark\'s, which takes none of the ladder\'s words - is never given them by a reforge; nor a crafted jewel its metal taken ("Silver Ring" is not "Ring")', () => {
  on();
  for (let s = 1; s <= 20; s++) {
    const it = ring(4, s);
    assert.equal(it.name, 'Silver Ring');
    reforgeEvery(it, (p) => assert.equal(itemLongName(p), "Saber's Silver Ring", `seed ${s}`));
  }
});

test('NAME-KEPT: a name the ladder gave still follows its lines - a Superior ring\'s words move and its "Silver Ring" stays; a found piece is named as rarityName names it (mutants: the old law; the rest of the name not cut out)', () => {
  on();
  let moved = 0;
  for (let s = 1; s <= 40; s++) {
    const it = ring(3, s);
    assert.equal(it.rarity, 'magic');
    reforgeEvery(it, (p) => {
      const { pre, suf } = words(p);
      assert.equal(p.name, [pre, 'Silver Ring', suf].filter((x) => x != null).join(' '), `seed ${s}: ${p.name}`);
      moved++;
    });
  }
  assert.ok(moved >= 40, `${moved} reforges`);
  for (let s = 1; s <= 40; s++) {
    const found = Object.assign(LR.applyRarity(mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 }), s % 2 ? 'rare' : 'magic', seededRng(s)), { isIdentified: true });
    reforgeEvery(found, (p) => assert.equal(p.name, LR.rarityName(p, p.rarity, p.affixes), `a found ${p.rarity}: ${p.name}`));
  }
});

test('NAME-KEPT: a name an older reforge built with a set gem\'s word (AUDIT GEM: "Soldier\'s" off a Diamond) is still the ladder\'s - the next reforge names it by the piece\'s own lines alone (mutants: either read out; the gem\'s word back in)', () => {
  on();
  LR._setSocketForTests(1000);
  try {
    let checked = 0;
    for (let s = 1; s <= 400 && checked < 10; s++) {
      const it = Object.assign(LR.applyRarity(createWeapon(120, 1), 'rare', seededRng(s)), { isIdentified: true });
      if (words(it).pre != null || words(it).suf == null) continue;   // a sword whose own lines give a suffix and no prefix
      LR.socketPass([it], () => 0);
      if (!LR.setGem(it, 'diamond')) continue;
      const gem = it.affixes.find((a) => a.gem != null);
      assert.equal(LR.AFFIX_KINDS[gem.id].slot, 'prefix', 'a Diamond in a blade: its damage, a prefix');
      const gemWord = LR.affixWord(gem, it.rarity);
      it.name = LR.rarityName(it, it.rarity, it.affixes);   // the old reforge's name (`rarityName(item, tier, item.affixes)`, gems and all)
      assert.ok(it.name.startsWith(`${gemWord} `), it.name);
      const i = LR.reforgeableLines(it).find((j) => LR.AFFIX_KINDS[it.affixes[j].id].slot === 'suffix');
      assert.ok(RF.reforgePiece(it, i, { items: [it, welkyndShards(99)], goldPieces: 99_999 }, seededRng(s)).ok);
      assert.equal(it.name, LR.rarityName(it, it.rarity, it.affixes.filter((a) => a.gem == null)), `seed ${s}: named by its own lines`);
      assert.ok(!it.name.startsWith(`${gemWord} `) || words(it).pre === gemWord, `seed ${s}: never the gem's word (${it.name})`);
      // and a name of the law now (its own lines alone) beside the gem's line, reforged again: still its own lines'
      const j = LR.reforgeableLines(it).at(-1);
      assert.ok(RF.reforgePiece(it, j, { items: [it, welkyndShards(99)], goldPieces: 99_999 }, seededRng(s + 1000)).ok);
      assert.equal(it.name, LR.rarityName(it, it.rarity, it.affixes.filter((a) => a.gem == null)), `seed ${s}: again, by its own lines`);
      checked++;
    }
    assert.ok(checked >= 3, `${checked} swords`);
  } finally { LR._setSocketForTests(null); }
});

test('NAME-KEPT (AUDIT FB1025i A1): a cursed piece - its curse\'s line added after its name, often in a slot its own lines left empty - is named by every line it has at its next reforge, never kept stale', () => {
  on();
  let n = 0;
  for (let s = 1; s <= 3000 && n < 10; s++) {
    const it = Object.assign(LR.applyRarity(mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 }), 'rare', seededRng(s)), { isIdentified: true });
    if (words(it).pre != null || !LR.cursePiece(it, seededRng(s + 7)) || words(it).pre == null) continue;   // a ring whose curse filled its empty prefix
    const i = it.affixes.findIndex((a) => LR.AFFIX_KINDS[a.id].slot === 'suffix' && !LR.AFFIX_KINDS[a.id].proc);
    assert.ok(RF.reforgePiece(it, i, { items: [it, welkyndShards(99)], goldPieces: 999_999 }, seededRng(s + 99)).ok);
    assert.equal(it.name, LR.rarityName(it, it.rarity, it.affixes.filter((a) => a.gem == null)), `seed ${s}: ${it.name}`);
    n++;
  }
  assert.ok(n >= 3, `${n} cursed rings`);
});

test('NAME-KEPT (AUDIT FB1025i A2): a name an older reforge built with a set gem\'s word, the gem since unset, is named by its own lines at the next reforge - the word that outlived the gem goes, never doubled', () => {
  on();
  LR._setSocketForTests(1000);
  try {
    let n = 0;
    for (let s = 1; s <= 600 && n < 8; s++) {
      const it = Object.assign(LR.applyRarity(createWeapon(120, 1), 'rare', seededRng(s)), { isIdentified: true });
      if (words(it).pre != null) continue;
      LR.socketPass([it], () => 0);
      if (!LR.setGem(it, 'diamond')) continue;
      const gemWord = LR.affixWord(it.affixes.find((a) => a.gem != null), it.rarity);
      it.name = LR.rarityName(it, it.rarity, it.affixes);   // the reforge before AUDIT GEM
      assert.ok(LR.unsetGem(it));
      const i = LR.reforgeableLines(it)[0];
      assert.ok(RF.reforgePiece(it, i, { items: [it, welkyndShards(99)], goldPieces: 999_999 }, seededRng(s + 5)).ok);
      assert.equal(it.name, LR.rarityName(it, it.rarity, it.affixes), `seed ${s}: ${it.name}`);
      assert.ok(!it.name.startsWith(`${gemWord} ${gemWord} `), 'never doubled');
      n++;
    }
    assert.ok(n >= 3, `${n} swords`);
  } finally { LR._setSocketForTests(null); }
});

test('NAME-KEPT (AUDIT FB1025i A3): a crafted name an older reforge broke - the report\'s Masterwork with the ladder\'s words, a jewel without its metal - is its own base\'s again: at the next reforge, and on load (repairCraftedNames, once)', () => {
  on();
  const oldLaw = (it) => { it.name = LR.rarityName(it, it.rarity, it.affixes.filter((a) => a.gem == null)); return it; };   // the reforge before NAME-KEPT
  const master = oldLaw(mule());
  assert.equal(master.name, `${words(master).pre} Ring ${words(master).suf}`, 'the old law: the ladder\'s words on the bare template');
  const again = structuredClone(master);
  assert.ok(RF.reforgePiece(again, 0, { items: [again, welkyndShards(99)], goldPieces: 999_999 }, seededRng(3)).ok);
  assert.equal(itemLongName(again), "Saber's Silver Ring", 'a reforge: the mark\'s name again');
  const superior = oldLaw(ring(3, 2));
  assert.ok(!superior.name.includes('Silver'));
  const found = Object.assign(LR.applyRarity(mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 }), 'magic', seededRng(4)), { isIdentified: true });
  const own = Object.assign(ring(3, 5), { name: 'Ward of the Wanderer' });
  let cursed = null;   // a found piece whose curse's line names no part of its name - by design, never repaired
  for (let s = 1; s < 3000 && !cursed; s++) {
    const it = Object.assign(LR.applyRarity(mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 }), 'rare', seededRng(s)), { isIdentified: true });
    if (words(it).pre == null && LR.cursePiece(it, seededRng(s + 7)) && words(it).pre != null) cursed = it;
  }
  const list = [master, superior, found, own, cursed];
  const [foundName, cursedName] = [found.name, cursed.name];
  assert.notEqual(cursedName, LR.rarityName(cursed, 'rare', cursed.affixes));
  assert.equal(LR.repairCraftedNames(structuredClone(list)), 2, 'the two crafted names the old law built');
  repairItemLists([list]);   // the save's load (save.js) - every repair, this one among them
  assert.deepEqual([itemLongName(master), superior.name, found.name, own.name, cursed.name],
    ["Saber's Silver Ring", [words(superior).pre, 'Silver Ring', words(superior).suf].filter((x) => x != null).join(' '), foundName, 'Ward of the Wanderer', cursedName]);
  assert.equal(LR.repairCraftedNames(list), 0, 'a second load finds nothing to do');
});

test('NAME-KEPT (AUDIT FB1025i A5, A6): a rename that keeps a word of the ladder\'s ("Porter\'s Pride", "Porter\'s", "Porter\'sRing") is the player\'s own and stands', () => {
  on();
  let it = null;
  for (let s = 1; s < 300 && !it; s++) { const r = ring(3, s); if (r.affixes.length === 1 && r.affixes[0].id === 'weight') it = r; }
  assert.ok(it, 'a Superior ring of one line, carrying capacity');
  const pre = words(it).pre;
  for (const name of [`${pre} Pride`, pre, `${pre}Ring`, `${pre} Silver Ring of`]) {
    const p = Object.assign(structuredClone(it), { name });
    const player = { items: [p], goldPieces: 10_000_000 };
    const w = new ItemMakerWindow({ player, entity: player, packItems: () => player.items });
    w._selectItem(p);
    w.itemName = name;
    w.powers = [enchantmentSettings('FeatherWeight', PARAM_NONE)];
    w._enchant();
    assert.equal(p.name, name);
    reforgeEvery(p, (q) => assert.equal(q.name, name, `"${name}" stands`));
  }
});

test('NAME-KEPT (AUDIT FB1025i A4): the Imbue at the Reforge keeps a name of the piece\'s own - a questline\'s named reward - and names a ladder-named piece by the ladder', () => {
  on();
  const named = { name: 'Seal of the Hour', kind: 'jewel', base: 'Ring' };
  let reward = null;
  for (let s = 1; s < 4000 && !reward; s++) for (const c of rollRewardChoice({ seed: s, level: 10, tier: 1, named })) if (c.named && c.item.rarity === 'magic') reward = c.item;
  assert.ok(reward?.qlNamed === true, 'a Magic named reward of the real roll');
  const me = (it) => ({ items: [it, welkyndShards(999)], goldPieces: 10_000_000 });
  assert.equal(RF.imbueTarget(reward), 'rare');
  assert.equal(RF.imbuePiece(reward, me(reward), seededRng(5)).ok, true);
  assert.deepEqual([reward.rarity, reward.name], ['rare', 'Seal of the Hour']);
  const found = Object.assign(LR.applyRarity(mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 }), 'magic', seededRng(8)), { isIdentified: true });
  assert.equal(RF.imbuePiece(found, me(found), seededRng(6)).ok, true);
  assert.equal(found.name, LR.rarityName(found, 'rare', found.affixes), 'a found piece the ladder named is named by it again');
});
