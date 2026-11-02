// FIELD BUGS 2026-10-01 part four (CLOAK-DRAPE) - SlipperyPeasant in #bug-reports, "Cannot change how the cloak is
// worn": "With the last patch it removed the 'Use' button for cloaks and replaced it with 'Raise Hood' and I can no
// longer change how the cloak is worn, eg; Over shoulder, behind, etc".
//
// HOOD-SAID (FIELD BUGS 2026-09-30, PR #468) put Raise hood / Lower hood on a worn cloak's card in Use's place, and
// the hood moves to the same drape's other drawing (`variant ^ 1`) - so on the Enhanced Plus pack a worn Casual Cloak,
// three drapes in six drawings (0/1, 2/3, 4/5, each pair one hood down and one hood up), could no longer reach its
// other two drapes. Now its card carries Change drape beside the hood: the next drape, the hood as it was, said, the
// card kept up and the doll redrawn. A formal cloak and plain robes have one drape and get no such button; the
// classic window keeps DFU's NextVariant on its Use. Fixtures are the producers': the cloaks minted by setItemFields +
// mintCondition and worn through equipItem, the pack mounted on the fake document the pack's suites drive
// (test/invdrag.mjs).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDom } from '../invdrag.mjs';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { enhancedNoticeKeys, destroyEnhancedNotice, ENHANCED_NOTICE_ID } from '../../src/ui/enhanced/enhancedNotice.js';
import { nextDrape, drapeCount, DRAPE_TEXT, toggleHood } from '../../src/systems/useItem.js';
import { hoodUp, cloakState, HOODED_CLOAK_VARIANTS } from '../../src/systems/survival/temperature.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition, setItemFields, templateByIndex } from '../../src/systems/item/itemTemplates.js';

const garment = (templateIndex, variant = 0) => {
  const it = mintCondition(setItemFields({ group: templateIndex >= 180 ? 'WomensClothing' : 'MensClothing', templateIndex, flags: 0 }));
  it.variant = variant;
  return it;
};
const hero = () => ({
  isPlayer: true, name: 'Peasant', career: { name: 'Bard' }, level: 5, gender: 'male', race: 'Breton',
  stats: { strength: 50, endurance: 48, agility: 50, speed: 50, luck: 50, willpower: 50, intelligence: 50, personality: 50 },
  skills: new Array(35).fill(30), activeEffects: [], spells: [], items: [], goldPieces: 0, health: 100, maxHealth: 100,
});
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
async function withDomAsync(fn) {
  const dom = fakeDom();
  const keys = ['document', 'addEventListener', 'removeEventListener', 'requestAnimationFrame', 'innerWidth', 'innerHeight', 'window'];
  const saved = Object.fromEntries(keys.map((k) => [k, [Object.hasOwn(globalThis, k), globalThis[k]]]));
  Object.assign(globalThis, {
    document: dom.doc, addEventListener: dom.win.addEventListener, removeEventListener: dom.win.removeEventListener,
    requestAnimationFrame: () => 0, innerWidth: dom.w, innerHeight: dom.h,
    window: { innerWidth: dom.w, innerHeight: dom.h, getComputedStyle: () => ({ position: 'absolute' }) },
  });
  try { return await fn(dom); } finally {
    for (const [k, [had, v]] of Object.entries(saved)) { if (had) globalThis[k] = v; else delete globalThis[k]; }
    destroyEnhancedNotice();
  }
}
const noticeTexts = (dom) => {
  const live = new Set(enhancedNoticeKeys());
  const stack = (dom.body.children ?? []).find((c) => c.id === ENHANCED_NOTICE_ID);
  return (stack?.children ?? [])
    .filter((c) => String(c.className).split(/\s+/).includes('notice') && live.has(c.dataset.owner))
    .flatMap((panel) => (panel.children.find((c) => c.className === 'notice-body')?.children ?? [])
      .filter((r) => r.style.display !== 'none').map((r) => r.textContent));
};

test('CLOAK-DRAPE: the law - a casual cloak\'s three drapes in turn, the hood as it was; one drape is no drape to change (mutants: the hood flipped with the drape; NextVariant\'s plain step; the last drape never left; a one-drape garment moved; the count off by the pairs)', () => {
  for (const t of [154, 191]) {
    assert.equal(templateByIndex(t).variants, 6);
    assert.equal(drapeCount(garment(t)), 3, 'six drawings, three drapes');
    for (const start of [0, 1, 2, 3, 4, 5]) {
      const c = garment(t, start);
      const up = hoodUp(c);
      const seen = [start];
      for (let i = 0; i < 3; i++) {
        assert.equal(nextDrape(c), true);
        assert.equal(hoodUp(c), up, `from ${start}: the hood stays ${up ? 'up' : 'down'}`);
        seen.push(c.variant);
      }
      assert.equal(c.variant, start, 'three steps go round');
      assert.deepEqual(seen.slice(0, 3).map((v) => v >> 1).sort(), [0, 1, 2], `from ${start}: every drape once (${seen})`);
    }
  }
  // the hood-down round and the hood-up round, drawing by drawing (HOODED_CLOAK_VARIANTS: 1, 2 and 5 are up)
  assert.deepEqual([...HOODED_CLOAK_VARIANTS].sort(), [1, 2, 5]);
  const down = garment(154, 0);
  assert.deepEqual([nextDrape(down), down.variant, nextDrape(down), down.variant, nextDrape(down), down.variant], [true, 3, true, 4, true, 0]);
  const upc = garment(154, 1);
  assert.deepEqual([nextDrape(upc), upc.variant, nextDrape(upc), upc.variant, nextDrape(upc), upc.variant], [true, 2, true, 5, true, 1]);
  // the hood and the drape are two moves: the hood keeps the drape, the drape keeps the hood
  const both = garment(154, 3);
  toggleHood(both);
  assert.equal(both.variant, 2);
  nextDrape(both);
  assert.equal(both.variant, 5);
  for (const t of [155, 192, 163, 200]) {
    const g = garment(t, 1);
    assert.equal(drapeCount(g), 1, `${templateByIndex(t).name}: one drape`);
    assert.equal(nextDrape(g), false);
    assert.equal(g.variant, 1, 'left as it was');
    const minted = mintCondition(setItemFields({ group: t >= 180 ? 'WomensClothing' : 'MensClothing', templateIndex: t, flags: 0 }));
    assert.equal(Object.hasOwn(minted, 'variant'), false, 'the mint writes no drawing');
    assert.equal(nextDrape(minted), false);
    assert.equal(Object.hasOwn(minted, 'variant'), false, 'and nothing is written on it');
  }
  assert.equal(drapeCount(garment(165)), 0, 'a shirt carries no hood: its Use steps its drawings');
  assert.equal(nextDrape(garment(165)), false);
});

test('CLOAK-DRAPE: the pack says it - a worn casual cloak\'s card offers Change drape beside Raise hood; a press moves the drape, keeps the hood, says "You rearrange your cloak.", keeps the card up and redraws the doll; a formal cloak and robes offer none; an enchanted casual cloak keeps it beside its Use (mutants: no drape button; the button on a one-drape garment; nothing said; the doll not redrawn; the card closed; the enchanted cloak without it)', async () => {
  const e = hero();
  const cloak = garment(154, 0);
  const robes = garment(163, 0);
  e.items.push(cloak, robes); equipItem(e, cloak); equipItem(e, robes);
  await withDomAsync(async (dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    let view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    try {
      const panel = (name) => host.querySelectorAll('.wornrow').find((n) => n.querySelector('.wornname')?.textContent?.includes(name));
      const card = () => host.querySelector('.packtip');
      const acts = () => card().querySelectorAll('button').filter((b) => String(b.className).split(/\s+/).includes('act')).map((b) => b.textContent);
      const rows = () => card().querySelectorAll('.pair').map((p) => [p.querySelector('dt').textContent, p.querySelector('dd').textContent]);
      const press = (label) => card().querySelectorAll('button').find((b) => b.textContent === label).onclick();
      panel('Casual Cloak').onclick({});
      assert.ok(acts().includes('Raise hood') && acts().includes('Change drape'), `the hood's button and the drape's: ${acts()}`);
      assert.ok(acts().indexOf('Change drape') === acts().indexOf('Raise hood') + 1, 'the drape beside the hood');
      await flush();
      const before = host.querySelector('.pack-shell');
      press('Change drape');
      assert.equal(cloak.variant, 3, 'the second drape, hood down');
      assert.equal(cloakState(e.equip.slots).hood, false, 'the hood still down');
      assert.deepEqual(noticeTexts(dom), [DRAPE_TEXT]);
      assert.equal(DRAPE_TEXT, 'You rearrange your cloak.');
      assert.ok(card(), 'the card stays up');
      assert.deepEqual(rows().find(([k]) => k === 'Hood'), ['Hood', 'down']);
      const drawn = host.querySelector('.pack-shell');
      await flush();
      assert.notEqual(host.querySelector('.pack-shell'), drawn, 'the doll recomposed and the pack repainted with it');
      assert.notEqual(drawn, before);
      press('Raise hood');
      assert.equal(cloak.variant, 2, 'the second drape\'s hood up');
      press('Change drape');
      assert.equal(cloak.variant, 5, 'the third drape, the hood still up');
      assert.equal(cloakState(e.equip.slots).hood, true);
      press('Change drape');
      assert.equal(cloak.variant, 1, 'round to the first, hood up');
      // the robes: one drape - the hood alone
      panel('Plain Robes').onclick({});
      assert.ok(acts().includes('Raise hood') && !acts().includes('Change drape'), `the robes: ${acts()}`);
      // a formal cloak worn: the same
      view.unmount();
      const formal = garment(155, 0);
      e.items.push(formal); equipItem(e, formal);
      view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
      panel('Formal Cloak').onclick({});
      assert.ok(acts().includes('Raise hood') && !acts().includes('Change drape'), `the formal cloak: ${acts()}`);
      // an enchanted casual cloak worn (a wearer of its own): the drape beside the hood and its Used payload's Use
      view.unmount();
      const mage = hero();
      const magic = garment(191, 0);
      magic.enchantments = [{ type: 1, param: 0 }];
      mage.items.push(magic); equipItem(mage, magic);
      view = mountEnhancedInventory(host, { entity: mage, items: () => mage.items, onExit: () => {} });
      panel('Casual Cloak').onclick({});
      assert.ok(acts().includes('Change drape') && acts().includes('Use'), `the enchanted cloak: ${acts()}`);
    } finally {
      view.unmount();
    }
  });
});
