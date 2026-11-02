// FIELD BUGS 2026-10-19f (SIDE-ONCE) - a player's private report: the item maker let the same side effect's setting be
// picked again and again up to the ten-row guard, each copy adding its negative cost to the budget. DFU's own rule,
// ported faithfully: UserTakesDamage and ItemDeteriorates set AllowMultipleSecondaryInstances (UserTakesDamage.cs:35,
// ItemDeteriorates.cs:37), and the secondary picker leaves a taken setting out only without it
// (DaggerfallItemMakerWindow.cs:849-855). The owner (2026-10-19): "One copy per setting" - a side effect's setting is
// picked once, two settings of one effect stay allowed; and an effect with no setting left is not listed (DFU lists it
// and opens an empty chooser: :644/:689, HealthLeech.cs:37). A piece made before keeps its copies - the item law counts
// by kind (itemLaw.js makerFindings, `many`), so no honest piece is judged forged (MAKER-KEPT's lesson).
// Driven on the real ItemMakerWindow, through the classic picker and the Enhanced skin's own 'Add side effect' and its
// list (ui/enhanced/enhancedPicker.js, drawn from the classic picker's rows); the old piece is the item maker's own write
// (enchanting.js applyEnchantments) of the catalogue's own rows (enchantmentSettings).
import '../modsOff.js';
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ItemMakerWindow } from '../../src/ui/item/itemMakerWindow.js';
import { PORT_SPECS } from '../../src/ui/enhanced/enhancedPorts.js';
import { drawEnhancedPicker, closeEnhancedPicker } from '../../src/ui/enhanced/enhancedPicker.js';
import { createWeapon, WEAPONS_ENUM } from '../../src/combat/enemyEquipment.js';
import { WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { applyEnchantments, enchantDecision, itemEnchantmentPower } from '../../src/systems/enchanting.js';
import { enchantmentSettings } from '../../src/systems/enchantmentCatalogue.js';
import { itemFindings, lawfulItem } from '../../src/systems/item/itemLaw.js';

globalThis.requestAnimationFrame = () => null;   // the list's draw watchdog (drawWatchdog.js) ticks on frames this suite never turns

/** A Daedric longsword, as the item maker sees one: its power 1800 (the report's own budget). */
const blade = () => createWeapon(WEAPONS_ENUM.Longsword, WEAPON_MATERIALS.Daedric, () => 0.5);
/** The real window, the blade selected. */
const maker = () => {
  const item = blade();
  const player = { goldPieces: 10_000_000, items: [item] };
  const w = new ItemMakerWindow({ player, entity: player, packItems: () => player.items });
  w._selectItem(item);
  return { w, item, player };
};
/** Every action of the Enhanced skin's view, by label. */
const actOf = (w, label) => {
  const view = PORT_SPECS.itemMaker.view(w);
  const out = [];
  const walk = (b) => { if (!b) return; if (b.items) out.push(...b.items); if (b.blocks) b.blocks.forEach(walk); if (b.cols) b.cols.flat().forEach(walk); };
  (view.blocks ?? []).forEach(walk);
  return [...out, ...(view.foot ?? [])].find((a) => a.label === label);
};
/** The rows the Enhanced skin's list draws for the window's open picker. */
const enhancedRows = (picker) => {
  closeEnhancedPicker();
  const canvas = { width: 640, height: 400, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }) };
  assert.equal(drawEnhancedPicker(picker, null, canvas, { x: 0, y: 0, list: [0, 0] }, globalThis.document), true, 'the enhanced list draws');
  const rows = [];
  const find = (n) => { if (n.className === 'pick-label') rows.push(n.textContent); n.children?.forEach(find); };
  find(globalThis.document.body);
  closeEnhancedPicker();
  return rows;
};
/** The side-effect list as both skins show it: the Enhanced skin's 'Add side effect' presses the classic button, and its
 *  list draws the classic picker's rows - the one list both read. Closed again after. */
const sideList = (w) => {
  actOf(w, 'Add side effect').act();
  const shown = w.picker.items.slice();
  assert.deepEqual(enhancedRows(w.picker), shown, 'the Enhanced skin lists what the classic picker lists');
  w.picker = null;
  return shown;
};
/** Pick `effect` from the side-effect list and answer the settings its chooser offers, both skins, chooser left open. */
const chooser = (w, effect) => {
  w._openPicker(false);
  const i = w.picker.items.indexOf(effect);
  assert.ok(i >= 0, `${effect} listed`);
  w.picker.onPick(i);
  const shown = w.picker.items.slice();
  assert.deepEqual(enhancedRows(w.picker), shown, `${effect}: the Enhanced skin's chooser lists what the classic one lists`);
  return shown;
};
const take = (w, label) => { const j = w.picker.items.indexOf(label); assert.ok(j >= 0, `${label} offered`); w.picker.onPick(j); };
const rowsOf = (w) => w.sideEffects.map((e) => `${e.type}:${e.param}`);

test('SIDE-ONCE: a side effect\'s setting is picked once - gone from its chooser once taken, the effect\'s other settings still offered, in the classic window and the Enhanced skin (mutants: either flag given back DFU\'s 1 | 2)', () => {
  const { w } = maker();
  // User Takes Damage: in holy places, then in sunlight - each once, the two together allowed
  assert.deepEqual(chooser(w, 'User Takes Damage'), ['in sunlight', 'in holy places']);
  take(w, 'in holy places');
  assert.deepEqual(chooser(w, 'User Takes Damage'), ['in sunlight'], 'in holy places taken: only in sunlight left');
  take(w, 'in sunlight');
  // Item Deteriorates: all the time taken, the other two settings stay
  assert.deepEqual(chooser(w, 'Item Deteriorates'), ['all the time', 'in sunlight', 'in holy places']);
  take(w, 'all the time');
  assert.deepEqual(chooser(w, 'Item Deteriorates'), ['in sunlight', 'in holy places'], 'all the time taken: the other two left');
  take(w, 'in holy places');
  assert.deepEqual(chooser(w, 'Item Deteriorates'), ['in sunlight']);
  w.picker = null;
  assert.deepEqual(rowsOf(w), ['UserTakesDamage:1', 'UserTakesDamage:0', 'ItemDeteriorates:0', 'ItemDeteriorates:2'], 'one copy of each setting');
});

test('SIDE-ONCE: the report, answered - "in holy places" asked for ten times lands once, and the budget it buys is one copy\'s', () => {
  const { w, item } = maker();
  assert.equal(itemEnchantmentPower(item), 1800);
  const offered = [];
  for (let k = 0; k < 10; k++) {
    w._openPicker(false);
    const i = w.picker?.items.indexOf('User Takes Damage') ?? -1;
    if (i < 0) { offered.push('not listed'); w.picker = null; continue; }
    w.picker.onPick(i);
    const j = w.picker.items.indexOf('in holy places');
    offered.push(j >= 0 ? 'taken' : 'not offered');
    if (j >= 0) w.picker.onPick(j); else w.picker = null;
  }
  assert.deepEqual(offered, ['taken', ...Array(9).fill('not offered')]);
  assert.deepEqual(rowsOf(w), ['UserTakesDamage:1']);
  assert.equal(w.labels().enchantmentCost, '-1000/1800', 'one copy\'s -1000, never ten copies\' -10000');
});

test('SIDE-ONCE: an effect with no setting left is not listed - Health Leech, Bad Reactions From, User Takes Damage, Item Deteriorates, each with every setting taken; the list both skins show (mutant: the empty chooser listed again)', () => {
  const ALL = {
    'Health Leech': ['Whenever used', 'Unless used daily', 'Unless used weekly'],
    'Bad Reactions From': ['Humanoids', 'Animals', 'Daedra'],
    'User Takes Damage': ['in sunlight', 'in holy places'],
    'Item Deteriorates': ['all the time', 'in sunlight', 'in holy places'],
  };
  const fresh = ['Bad Reactions From', 'Bad Rep With', 'Health Leech', 'Item Deteriorates', 'Low Damage Vs', 'User Takes Damage', 'Extra Weight', 'Weakens Armor'];
  for (const [effect, settings] of Object.entries(ALL)) {
    const { w } = maker();
    assert.deepEqual(sideList(w), fresh, 'a fresh blade: every side effect listed');
    settings.forEach((label, n) => {
      assert.deepEqual(chooser(w, effect), settings.slice(n), `${effect}: the settings not yet taken`);
      take(w, label);
    });
    assert.deepEqual(sideList(w), fresh.filter((e) => e !== effect), `${effect}: every setting taken, gone from the list`);
  }
});

test('SIDE-ONCE: a piece made before keeps its copies - the item maker\'s own write of a setting taken nine times, its powers past the blade\'s budget, passes the law in the save and on the wire (mutants: the law counting by the secondary flag; the law tightened to one copy per setting)', () => {
  const item = blade();
  const powers = [enchantmentSettings('RegensHealth', 0), enchantmentSettings('VampiricEffect', 1)];
  const stacked = Array.from({ length: 9 }, () => enchantmentSettings('UserTakesDamage', 1));
  // the window as it stood: the old rule's ten rows, enchanted (DFU's own ladder - the drawbacks pay for 5000 of powers)
  assert.equal(enchantDecision(item, powers, stacked, { gold: 10_000_000 }).kind, 'enchant');
  applyEnchantments(item, [...powers, ...stacked]);
  assert.deepEqual(item.enchantments.map((e) => `${e.type}:${e.param}:${e.enchantCost}`),
    ['5:0:4000', '6:1:1000', ...Array(9).fill('17:1:-1000')], 'the item maker\'s rows, the classic types (RegensHealth 5, VampiricEffect 6, UserTakesDamage 17)');
  assert.deepEqual(itemFindings(item), [], 'the old stacked piece: no finding');
  assert.deepEqual(itemFindings(JSON.parse(JSON.stringify(item))), [], 'and on the wire');
  assert.equal(lawfulItem(JSON.parse(JSON.stringify(item))), true, 'a lawful piece: the market, the vault, the judge take it');
  // the law's own rule still bites where it did: a kind that allows one, taken twice
  const twice = blade();
  applyEnchantments(twice, [enchantmentSettings('StrengthensArmor', -1), enchantmentSettings('StrengthensArmor', -1)]);
  assert.deepEqual(itemFindings(twice), ['enchantments'], 'one of a kind where the kind allows one');
});
