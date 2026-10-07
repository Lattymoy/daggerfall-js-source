// LOOT18 - SEEN: THE LINE COMPARE, THE JUNK AND THE FILTER (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 10; Mac:
// "what could we do to make it even more amazing, while also balancing everyrhing?", then "Lets go all in").
//
// Four things that let a player see and sort what the ladder hands them, none a new rule of the ladder's:
//   - THE CARD COMPARES LINES - beside AC-COMPARE's numbers, each line of a picked piece against the same line on what a
//     wear would replace (up, down, new), their lines it would lose, and a resistance line's count under LOOT12's cap;
//   - JUNK - a mark beside the lock (systems/itemJunk.js), the lock's twin: a shop's Sell junk lays every junk piece on
//     its counter in one press, at its own price and confirm; quick loot's take-all leaves one where it lies;
//   - SALVAGE EVERY MAGIC - one press on the Reforge's Salvage page, asked first;
//   - QUICK LOOT BY TIER - a part of the quick-loot row: the take-all takes all gear, or Magic and up, or Rare and up -
//     gold, supplies, a quest's items and DFU's own magic items always taken.
//
// Pinned by execution: the mark's law, its field and the wire; the pack's card (its button on gear alone - a bandage's
// card is DISC13's still - the line, the picture's mark, the lock and the mark each lifting the other); the counter
// (the junk on it in one press and the counter's own confirm, a refused piece left, none at a Buy); the Salvage page's
// press (asked, then every Magic broken through the host's own salvage, Keep, none for one); the take-all by tier
// (every tier, the junk, what is always taken, the ladder off, the line, a lit row taken whatever it is); and the line
// compare's law and its block.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { isJunk, junkable, setJunk, toggleJunk, lockLiftsJunk, JUNK_GROUPS, JUNK_LINE } from '../src/systems/itemJunk.js';
import { isLocked, setLocked, toggleLocked } from '../src/systems/itemLock.js';
import { isDeclaredItemField } from '../src/systems/itemFields.js';
import { validLootItem } from '../src/systems/loot.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { equipItem } from '../src/systems/equip.js';
import { welkyndShards } from '../src/systems/gateSpoils.js';
import * as RF from '../src/systems/reforge.js';
import { FEATURES } from '../src/systems/features.js';
import { foldQuickLoot, quickLootArm, quickLootTake, resetQuickLoot, takeAllLeaves, QUICK_LOOT_TIER, QUICK_LOOT_FLOORS, QUICK_LOOT_LEFT } from '../src/systems/quickLoot.js';
import { hoverLines } from '../src/systems/worldHover.js';
import { GOLD_TEMPLATE } from '../src/systems/inventory.js';
import { mountReforgeWindow, EVERY_MAGIC_LABEL, EVERY_MAGIC_ASK, SALVAGED_EVERY } from '../src/ui/reforgeWindow.js';
import { mountEnhancedTrade } from '../src/ui/enhancedTrade.js';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { lineCompareBlock, LINES_HEAD } from '../src/ui/armourCard.js';
import { PAGE_IDS } from '../src/ui/packPages.js';
import { withDom } from './invdrag.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const known = (it) => Object.assign(it, { isIdentified: true });
const sword = () => createWeapon(120, 1);
const cuirass = () => mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'Cuirass', flags: 0 });
const ruby = () => mintCondition(setItemFields({ group: 'Gems', templateIndex: 0 }));
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
const player = (items = []) => ({ isPlayer: true, items, goldPieces: 0, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100 });

test('LOOT18: the junk mark - gear alone, never a quest\'s item or a bound one; the lock\'s twin (each lifts the other); a field the save and the wire carry', () => {
  assert.deepEqual(JUNK_GROUPS, ['Weapons', 'Armor', 'Jewellery', 'MensClothing', 'WomensClothing']);
  for (const it of [sword(), cuirass(), mintCondition({ group: 'Jewellery', templateIndex: 133, flags: 0 }), mintCondition({ group: 'MensClothing', templateIndex: 155, flags: 0, variant: 0 })]) {
    assert.ok(junkable(it), `${it.group} takes the mark`);
  }
  assert.ok(!junkable(ruby()), 'a gem is no gear');
  assert.ok(!junkable({ ...sword(), questItem: true }), 'a quest\'s item');
  assert.ok(!junkable({ ...sword(), bound: true }), 'a bound piece - no counter takes it');
  assert.ok(!junkable(null));
  const s = sword();
  assert.equal(isJunk(s), false);
  assert.equal(toggleJunk(s), true);
  assert.equal(s.junk, true);
  assert.equal(toggleJunk(s), false);
  assert.ok(!('junk' in s), 'cleared is the field absent');
  setLocked(s, true);
  setJunk(s, true);
  assert.deepEqual([isJunk(s), isLocked(s)], [true, false], 'marked junk, its lock lifted');
  toggleLocked(s);
  lockLiftsJunk(s);
  assert.deepEqual([isJunk(s), isLocked(s)], [false, true], 'locked, its mark lifted');
  assert.equal(setJunk(null, true), false);
  assert.ok(isDeclaredItemField('junk'));
  const marked = { ...sword(), junk: true };
  assert.ok(validLootItem(JSON.parse(JSON.stringify(marked))), 'the wire carries it');
  assert.equal(validLootItem({ ...marked, junk: 'yes' }), null, 'and no other shape of it');
});

test('LOOT18: the pack\'s card - Junk beside the lock on gear in the pack, its line and the picture\'s mark; the lock lifts it; a bandage\'s card stands as DISC13 pins it', () => {
  on();
  const s = sword();
  const e = player([s]);
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    const q = (cls) => dom.doc.querySelectorAll('.' + cls)[0] ?? null;
    q('packtabs').querySelectorAll('.packtab')[PAGE_IDS.indexOf('weapons')].onclick({});
    const pick = () => q('packlists').querySelectorAll('.itemrow')[0].onclick?.({});
    pick();
    const acts = () => (q('packdetail')?.querySelectorAll('.acts')[0]?.querySelectorAll('.act') ?? []);
    const labels = () => acts().map((b) => b.textContent);
    assert.ok(labels().includes('Junk'), `the card offers it (${labels().join(', ')})`);
    assert.equal(labels().indexOf('Junk'), labels().indexOf('Lock') + 1, 'beside the lock');
    acts().find((b) => b.textContent === 'Junk').onclick({});
    assert.equal(isJunk(s), true);
    assert.ok(labels().includes('Not junk'), 'and it says so');
    assert.ok(textOf(q('packdetail')).includes(JUNK_LINE), 'the card\'s line');
    assert.ok(dom.doc.querySelectorAll('.itemrow').some((r) => r.dataset?.junk === ''), 'the picture\'s mark');
    acts().find((b) => b.textContent === 'Lock').onclick({});
    assert.deepEqual([isLocked(s), isJunk(s)], [true, false], 'the lock lifts the mark');
  });
  // a worn piece takes none, nor anything but gear (a bandage's card stands as DISC13 pins it)
  assert.match(read('src/ui/enhancedInventory.js'), /if \(side === 'local' && !line\.equipped && junkable\(picked\)\) \{\n\s+const j = el\('button', 'act', isJunk\(picked\) \? 'Not junk' : 'Junk'\);/, 'local, unworn gear alone');
  assert.match(read('src/ui/enhancedPlusStyle.js'), /\.pack-shell \[data-junk\] \.tile > \*/, 'the sheet dims the mark\'s picture');
  _resetForTests();
});

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const tradeHooks = (mode, bag, more = {}) => ({
  mode, shelfItems: () => [], packItems: () => bag, entity: { items: bag }, accepts: () => true, enchanted: () => true,
  priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }), gold: () => 100000,
  rows: (id) => [{ text: `#${id}`, center: true }], weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
  commit: () => {}, icons: ICONS, isEquipped: (it) => it?.equipSlot != null, ...more,
});

test('LOOT18: Sell junk - every junk piece of the pack onto a Sell counter in one press and the counter\'s own confirm; a worn, bound or unaccepted one stays; never at a Buy', () => {
  on();
  withDom((dom) => {
    const a = Object.assign(sword(), { junk: true }), b = Object.assign(cuirass(), { junk: true });
    const keep = sword(), worn = Object.assign(sword(), { junk: true, equipSlot: 0 }), bound = Object.assign(sword(), { junk: true, bound: true });
    const bag = [a, keep, b, worn, bound];
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountEnhancedTrade(host, tradeHooks('Sell', bag));
    try {
      const btn = () => host.querySelectorAll('.sell-junk')[0] ?? null;
      assert.equal(btn()?.textContent, 'Sell junk (2)', 'the two it may sell');
      btn().onclick();
      assert.deepEqual(bag, [keep, worn, bound], 'onto the counter, whole');
      assert.ok(host.querySelectorAll('.sb-ask').length, 'the counter\'s own confirm');
      assert.ok(host.querySelectorAll('.act.primary').some((x) => x.textContent === 'Yes'));
      assert.equal(btn(), null, 'nothing left to lay');
    } finally { view.unmount(); }
  });
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const bag = [Object.assign(sword(), { junk: true })];
    const view = mountEnhancedTrade(host, tradeHooks('Buy', bag));
    try { assert.equal(host.querySelectorAll('.sell-junk').length, 0, 'a Buy sells nothing'); } finally { view.unmount(); }
  });
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const bag = [Object.assign(sword(), { junk: true })];
    const view = mountEnhancedTrade(host, tradeHooks('Sell', bag, { accepts: () => false }));
    try { assert.equal(host.querySelectorAll('.sell-junk').length, 0, 'a counter that takes none of it offers none'); } finally { view.unmount(); }
  });
});

test('LOOT18: Salvage every Magic - one press at the head of the Salvage page, asked first; every Magic the page could break, through the host\'s own salvage; Keep; none for one', () => {
  on();
  withDom((dom) => {
    const m1 = known(LR.applyRarity(sword(), 'magic', lcg(1))), m2 = known(LR.applyRarity(sword(), 'magic', lcg(2)));
    const m3 = known(LR.applyRarity(cuirass(), 'magic', lcg(3)));
    const locked = Object.assign(known(LR.applyRarity(sword(), 'magic', lcg(4))), { locked: true });
    const rare = known(LR.applyRarity(sword(), 'rare', lcg(5)));
    const me = { items: [m1, rare, m2, locked, m3], goldPieces: 0 };
    const calls = [];
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      page: 'salvage', items: () => me.items, payer: () => me, gold: () => 0, picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: (it) => { calls.push(it); return RF.salvagePiece(it, { items: me.items }); },
    });
    try {
      const shell = one(host, 'reforge-shell');
      const press = () => one(shell, 'every-magic');
      assert.equal(press().textContent, EVERY_MAGIC_LABEL(3), 'the three it could break - never the locked one or the Rare');
      press().onclick({ stopPropagation() {} });
      assert.deepEqual(calls, [], 'the first press only asks');
      assert.equal(one(shell, 'broker-note').textContent, EVERY_MAGIC_ASK(3, 3));
      one(one(shell, 'salvage-every'), 'reforge-keep').onclick({ stopPropagation() {} });
      assert.equal(press().textContent, EVERY_MAGIC_LABEL(3), 'Keep: asked no more');
      press().onclick({ stopPropagation() {} });
      press().onclick({ stopPropagation() {} });
      assert.deepEqual(calls, [m1, m2, m3]);
      assert.deepEqual(me.items.filter((it) => it.rarity), [rare, locked], 'broken, the rest kept');
      assert.equal(RF.shardsHeld(me.items), 3);
      assert.equal(one(shell, 'broker-note').textContent, SALVAGED_EVERY(3, 3));
      assert.equal(press(), null, 'none left: no press');
    } finally { view.unmount(); }
  });
  withDom((dom) => {
    const me = { items: [known(LR.applyRarity(sword(), 'magic', lcg(1)))], goldPieces: 0 };
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, { page: 'salvage', items: () => me.items, payer: () => me, gold: () => 0, picture: () => null, nameOf: (it) => it.name, reforge: () => ({ ok: false }), salvage: () => ({ ok: false }) });
    try { assert.equal(one(one(host, 'reforge-shell'), 'every-magic'), null, 'one Magic: its own row\'s press'); } finally { view.unmount(); }
  });
});

const gold = (n) => ({ name: 'Gold', group: 'Currency', templateIndex: GOLD_TEMPLATE, stackCount: n });
const frameOf = (key, items) => { const { shown, rest, empty } = hoverLines(items); return { key, kind: 'items', title: 'Loot Pile', subs: [], rows: shown, rest, empty }; };
function takeAll(items, tier) {
  setPref('quickLoot', true);
  setPref(QUICK_LOOT_TIER, tier);
  resetQuickLoot();
  const p = { items: [], goldPieces: 0, stats: { strength: 90 } };
  foldQuickLoot(frameOf('pile:1', items));
  assert.equal(quickLootArm('QuickLootAll'), true);
  const said = [];
  const got = quickLootTake('pile:1', { items: () => items }, p, (l) => said.push(l));
  resetQuickLoot();
  return { p, said, got };
}

test('LOOT18: quick loot by tier - the take-all leaves gear under the row\'s part and every junk piece; gold, supplies, a quest\'s item and DFU\'s own magic always taken; the ladder off, no tier; the line says what stayed; a lit row is taken whatever it is', () => {
  on();
  const row = FEATURES.find((f) => f.id === 'quick-loot');
  assert.deepEqual(row.control.parts, [{ key: 'quickLootTier', label: 'Take gear', tiers: [['all', 'All'], ['magic', 'Magic+'], ['rare', 'Rare+']] }]);
  assert.equal(PREF_DEFAULTS.quickLootTier, 'all', 'All by default - the take-all as it was');
  assert.deepEqual(QUICK_LOOT_FLOORS, { all: 0, magic: 1, rare: 2 });
  const pile = () => {
    const plain = sword(), magic = LR.applyRarity(sword(), 'magic', lcg(1)), rare = LR.applyRarity(cuirass(), 'rare', lcg(2));
    const arrows = Object.assign(createWeapon(131, 1), { stackCount: 20 });
    const dfu = Object.assign(sword(), { enchantments: [{ type: 3, param: 0 }], name: 'Old Magic Sword' });
    const junk = Object.assign(LR.applyRarity(sword(), 'rare', lcg(3)), { junk: true });
    return { plain, magic, rare, arrows, dfu, junk, all: [gold(5), plain, magic, rare, arrows, ruby(), dfu, junk] };
  };
  const all = pile();
  let r = takeAll(all.all, 'all');
  assert.deepEqual(all.all, [all.junk], 'All: every piece but the junk');
  assert.ok(r.said[0].endsWith(QUICK_LOOT_LEFT(1)), r.said[0]);
  const mg = pile();
  r = takeAll(mg.all, 'magic');
  assert.deepEqual(mg.all, [mg.plain, mg.junk], 'Magic+: the Common sword stays, and the junk');
  assert.equal(r.said[0], `You take 6 items. ${QUICK_LOOT_LEFT(2)}`);
  const rr = pile();
  takeAll(rr.all, 'rare');
  assert.deepEqual(rr.all, [rr.plain, rr.magic, rr.junk], 'Rare+: the Magic too');
  for (const it of [rr.arrows, rr.dfu]) assert.ok(!rr.all.includes(it), `${it.name}: always taken`);
  assert.equal(takeAllLeaves(Object.assign(sword(), { questItem: true, junk: true })), false, 'a quest\'s item: never the filter\'s (the quest arm is its own law)');
  // nothing taken: the line, and the press handled (no window opens over a pile the filter left whole)
  const only = [sword()];
  r = takeAll(only, 'rare');
  assert.equal(only.length, 1);
  assert.deepEqual(r.said, [QUICK_LOOT_LEFT(1)]);
  assert.ok(r.got && r.got.refused, 'handled');
  // the ladder off: no tier to read - only the junk is left
  setPref('lootRarity', false);
  const offPile = [sword(), Object.assign(sword(), { junk: true })];
  takeAll(offPile, 'rare');
  assert.equal(offPile.length, 1);
  assert.equal(offPile[0].junk, true);
  setPref('lootRarity', true);
  // a lit row is taken whatever it is - the part is the take-all's
  setPref(QUICK_LOOT_TIER, 'rare');
  resetQuickLoot();
  const lit = [sword()];
  foldQuickLoot(frameOf('pile:2', lit));
  const p = { items: [], goldPieces: 0, stats: { strength: 90 } };
  assert.ok(quickLootTake('pile:2', { items: () => lit }, p, () => {}));
  assert.equal(p.items.length, 1, 'the row the player lit');
  assert.equal(takeAllLeaves(null), false);
  resetQuickLoot();
  setPref(QUICK_LOOT_TIER, PREF_DEFAULTS.quickLootTier);
  setPref('quickLoot', PREF_DEFAULTS.quickLoot);
});

test('LOOT18: the line compare - each line against the same on what a wear replaces (up, down, new), their lines it would lose, a resistance line\'s count under the cap; nothing for an unknown piece, a wear that replaces nothing, or the switch off; the card draws it', () => {
  on();
  const worn = known(LR.applyRarity(sword(), 'rare', lcg(11)));
  const cand = known(LR.applyRarity(sword(), 'rare', lcg(12)));
  worn.affixes = [{ id: 'damage', value: 12 }, { id: 'stat', param: 'strength', value: 5 }, { id: 'resist', param: 'fire', value: 20 }];
  cand.affixes = [{ id: 'damage', value: 18 }, { id: 'stat', param: 'agility', value: 6 }, { id: 'resist', param: 'fire', value: 15 }];
  const e = player([worn, cand]);
  equipItem(e, worn);
  const cmp = LR.lineComparison(e, cand, [worn]);
  assert.deepEqual(cmp.rows.map((r) => [r.text, r.delta]), [[LR.affixLabel(cand.affixes[0]), 6], [LR.affixLabel(cand.affixes[1]), null], [LR.affixLabel(cand.affixes[2]), -5]]);
  assert.deepEqual(cmp.lost, [LR.affixLabel(worn.affixes[1])], 'the Strength it would lose');
  assert.deepEqual(cmp.rows[2].resist, { now: 20, then: 15 }, 'the fire the rolled gear counts, now and after');
  // a resistance past the cap counts as the cap
  const shield = known(LR.applyRarity(mintCondition({ group: 'Armor', templateIndex: 109, material: 0x0201, name: 'Shield', flags: 0 }), 'rare', lcg(13)));
  shield.affixes = [{ id: 'resist', param: 'fire', value: 35 }];
  e.items.push(shield); equipItem(e, shield);
  assert.deepEqual(LR.lineComparison(e, cand, [worn]).rows[2].resist, { now: LR.RESIST_CAP, then: LR.RESIST_CAP }, '55 then 50: both at the cap');
  // nothing to say
  assert.equal(LR.lineComparison(e, cand, []), null, 'a wear that replaces nothing');
  const unknown = LR.applyRarity(sword(), 'rare', lcg(14));
  assert.equal(LR.lineComparison(e, unknown, [worn]), null, 'its lines unknown');
  assert.equal(LR.lineComparison(e, cand, [LR.applyRarity(sword(), 'rare', lcg(15))]), null, 'theirs unknown');
  setPref('lootRarity', false);
  assert.equal(LR.lineComparison(e, cand, [worn]), null, 'off: nothing compared');
  setPref('lootRarity', true);
  // the block - two cuirasses: one slot, so a wear replaces (a second sword would go to the free off-hand, DFU's own)
  withDom(() => {
    const on2 = known(LR.applyRarity(cuirass(), 'rare', lcg(21)));
    const off2 = known(LR.applyRarity(cuirass(), 'rare', lcg(22)));
    on2.affixes = [{ id: 'armor', value: 12 }, { id: 'stat', param: 'strength', value: 5 }, { id: 'resist', param: 'fire', value: 20 }];
    off2.affixes = [{ id: 'armor', value: 18 }, { id: 'stat', param: 'agility', value: 6 }, { id: 'resist', param: 'fire', value: 15 }];
    const e2 = player([on2, off2]);
    equipItem(e2, on2);
    const box = lineCompareBlock(e2, off2);
    assert.ok(box, 'the card\'s block');
    assert.equal(one(box, 'cmp-head').textContent, LINES_HEAD);
    const rows = kids(box, 'cmp-line');
    assert.deepEqual(rows.map((li) => one(li, 'cmp-d').textContent), ['▲6', 'new', '▼5', 'lost']);
    assert.ok(rows[0].children.some((c) => c.classList.contains('up')));
    assert.equal(one(rows[2], 'cmp-note').textContent, '20% → 15% counts');
    assert.ok(rows[3].classList.contains('lost'));
    assert.equal(lineCompareBlock(e2, on2), null, 'a worn piece compares with nothing');
  });
  assert.match(read('src/ui/enhancedInventory.js'), /\{ const lc = lineCompareBlock\(deps\.entity, picked\); if \(lc\) into\.append\(lc\); \}/, 'the card draws it under AC-COMPARE\'s numbers');
});
