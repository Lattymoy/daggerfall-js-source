// SHOP-PLUS: the guild's Buy Spells in its Enhanced Plus face - the view is the classic window's own numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpellbookWindow } from '../../src/ui/spellbookWindow.js';
import { PORT_SPECS } from '../../src/ui/enhanced/enhancedPorts.js';
import { SPELLBOOK_TEMPLATE_INDEX } from '../../src/systems/spell/spellMaker.js';

const fx = (type, subType, o = {}) => ({ type, subType, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, durationBase: 0, chanceBase: 0, ...o });
function shop(gold = 400) {
  const entity = { goldPieces: gold, items: [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }], spells: [] };
  const w = new SpellbookWindow({
    spells: () => entity.spells, entity, castCost: (sp) => sp.cost, buildingQuality: () => 12, shopName: () => 'Mages Guild',
    skills: () => ({ mercantile: 35, personality: 55 }), classicMinutes: () => 0, rows: () => ['ok'],
    offered: () => [
      { name: 'Shock', icon: 16, rangeType: 2, element: 3, cost: 22, effects: [fx(4, 0, { magnitudeBaseLow: 3, magnitudeBaseHigh: 12 })] },
      { name: 'Frostbite', icon: 14, rangeType: 1, element: 1, cost: 20, effects: [fx(4, 0, { magnitudeBaseLow: 4, magnitudeBaseHigh: 9 }), fx(1, 1, { magnitudeBaseLow: 1, magnitudeBaseHigh: 3, durationBase: 2 })] },
      { name: '!Hidden', icon: 0, rangeType: 0, element: 0, cost: 1, effects: [] },
      { name: 'Levitate', icon: 7, rangeType: 0, element: 4, cost: 400, effects: [fx(14, 255, { durationBase: 3 })] },
    ],
  }, { buyMode: true });
  return { w, entity };
}
const find = (blocks, pred) => {
  for (const b of blocks ?? []) {
    if (!b) continue;
    if (pred(b)) return b;
    const inner = b.type === 'cols' ? b.cols.flat() : b.type === 'group' ? b.blocks : [];
    const hit = find(inner, pred);
    if (hit) return hit;
  }
  return null;
};

test('SHOP-PLUS: the shelf is the offer, sorted, the internal spells gone, each at the window\'s own trade price', () => {
  const { w } = shop();
  const v = PORT_SPECS.spellShop.view(w);
  const shelf = find(v.blocks, (b) => b.type === 'rows' && b.key === 'offer');
  assert.deepEqual(shelf.items.map((r) => r.label), ['Frostbite', 'Levitate', 'Shock']);
  for (let i = 0; i < shelf.items.length; i++) {
    w.selectedIndex = i;
    assert.equal(shelf.items[i].value, `${w.tradePrice()} gp`);
  }
  w.selectedIndex = 0;
  assert.equal(shelf.items[0].on, true);
  assert.equal(shelf.items[1].muted, true, 'a spell the purse cannot pay for is dimmed');
});

test('SHOP-PLUS: choosing a row selects it; the chosen spell says its effects with their numbers; Buy is the window\'s own', () => {
  const { w, entity } = shop();
  let v = PORT_SPECS.spellShop.view(w);
  find(v.blocks, (b) => b.type === 'rows' && b.key === 'offer').items[0].act();
  v = PORT_SPECS.spellShop.view(w);
  assert.equal(w.selected.name, 'Frostbite');
  const fx = find(v.blocks, (b) => b.type === 'rows' && b.key === 'fx');
  assert.deepEqual(fx.items.map((r) => r.label), ['Damage Health', 'Continuous Damage Fatigue']);
  // SB-FX: MOVED with the book's reading (ui/enhanced/enhancedSpellbook.js effectWords) - the component's header row of DFU's
  // spellbook description, over ClassicEffectRecordToEffectSettings' settings, and Damage Health's magnitude alone
  assert.equal(fx.items[0].sub, 'Magnitude: 4 - 9 + 0 - 0 per 1 level(s)');
  assert.equal(fx.items[1].sub, 'Duration: 2 + 0 per 1 level(s) · Magnitude: 1 - 3 + 0 - 0 per 1 level(s)');
  const price = w.tradePrice();
  v.foot[0].act();
  assert.equal(w.top, 'trade', 'the haggle line and its Yes/No, as the classic Buy opens them');
  w.confirmTrade(true);
  assert.deepEqual(entity.spells.map((s) => s.name), ['Frostbite']);
  assert.equal(entity.goldPieces, 400 - price);
  assert.equal(w.done, true);
});
