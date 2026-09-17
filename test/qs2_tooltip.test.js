// QS2 (2026-09-17, Mac: the consumables are assigned "in the enhanced menu
// through the tooltip to slot 1/2"): THE ASSIGNMENT SURFACE.
//
// The tooltip is where a quickslot is FILLED, and it is the only place - there
// is no drag onto the diamond and no second door. So this drives the pane
// rather than reading it: mount the enhanced pack over test/invdrag.mjs's
// document, click a row, read the buttons off `.acts`, press one, and ask the
// MODEL what happened. AUDIT INV1 F3 / AUDIT INV2's lesson is the reason -
// every assertion those pins made matched a declaration that still existed, and
// deleting the feature left the suite green.
//
// Four laws:
//   - THE KIND DECIDES. A potion and a drug get two slot buttons, an unequipped
//     weapon gets one swap button, and a torch, a book or a shield gets none -
//     because `isQuickConsumable` and `canSwapTo` say so, not because this
//     screen has an opinion.
//   - THE SLOT THAT HOLDS IT SAYS SO. 'Unslot 1' with the `on` class, and
//     pressing it clears.
//   - THE TOOLTIP STAYS UP. PX24 closes it on a USE; a slot changes nothing
//     about the item, so the card re-renders in place.
//   - THE REMOTE SIDE GETS NONE. A slot resolves against the PACK, so slotting
//     something still in a reward tray would name a kind the player does not
//     carry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withDom } from './invdrag.mjs';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import {
  clearQuickslots, quickslotOf, quickslotEntry, assignQuickslot,
} from '../src/systems/quickslots.js';
import { potionRecipeKeys } from '../src/systems/potions.js';
import { PAGE_IDS } from '../src/ui/packPages.js';
import { equipItem } from '../src/systems/equip.js';
import { itemLongName } from '../src/systems/itemInfo.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const [HEAL_KEY, FIRE_KEY] = potionRecipeKeys();
const potion = (key = HEAL_KEY, n = 1) => ({ group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: key, stackCount: n, currentCondition: 1, maxCondition: 1 });
const drug = () => ({ group: 'Drugs', templateIndex: 136, name: 'Indulcet', stackCount: 1, currentCondition: 1, maxCondition: 1 });
const sword = () => ({ group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword', stackCount: 1, currentCondition: 800, maxCondition: 1000 });
const dagger = () => ({ group: 'Weapons', templateIndex: 113, material: 3, name: 'Dagger', stackCount: 1, currentCondition: 50, maxCondition: 100 });
const torch = () => ({ group: 'UselessItems2', templateIndex: 247, name: 'Torch', stackCount: 1, currentCondition: 40, maxCondition: 100 });
const book = () => ({ group: 'Books', templateIndex: 87, name: 'Book', stackCount: 1, currentCondition: 50, maxCondition: 50 });

// The two recipes' own long names, read from the module that mints them -
// naming them here would be this file inventing a second answer.
const HEAL_NAME = itemLongName({ group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: HEAL_KEY });
const FIRE_NAME = itemLongName({ group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: FIRE_KEY });

const hero = (items) => ({
  name: 'Aelwyn', career: { name: 'Spellsword' }, level: 5,
  stats: { strength: 50, endurance: 48 }, activeEffects: [], spells: [],
  items, goldPieces: 100,
});

/** The pane, mounted over the fake document, with the levers this file needs.
 *
 *  test/invdrag.mjs's `matches` reads ONE compound selector (`.a`, `.a.b`,
 *  `tag`) and knows nothing of descendants, so everything here is scoped by
 *  finding the column first and querying inside it. That is a truer read
 *  anyway: "the buttons on the card" and "the chips in the pack list" are what
 *  the assertions are about. */
function withPack(items, fn, extraDeps = {}) {
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = hero(items);
    const view = mountEnhancedInventory(host, {
      entity: e, items: () => e.items, onExit: () => {}, ...extraDeps,
    });
    const one = (cls) => dom.doc.querySelectorAll('.' + cls)[0] ?? null;
    const detail = () => one('packdetail');
    const actsRow = () => detail()?.querySelectorAll('.acts')[0] ?? null;
    const buttons = () => actsRow()?.querySelectorAll('.act') ?? [];
    const acts = () => buttons().map((b) => b.textContent);
    const slotActs = () => acts().filter((l) => /Slot|Swap|Unslot|Unset/.test(l));
    const act = (label) => buttons().find((b) => b.textContent === label) ?? null;
    const press = (label) => {
      const b = act(label);
      assert.ok(b, `no button reads "${label}" (the card shows: ${acts().join(', ')})`);
      b.onclick({});
    };
    const packRows = () => one('packlists').querySelectorAll('.itemrow');
    const remoteRows = () => one('packremote')?.querySelectorAll('.itemrow') ?? [];
    const marks = () => one('packlists').querySelectorAll('.qs-mark').map((n) => n.textContent);
    const cardUp = () => (detail()?.querySelectorAll('.card').length ?? 0) > 0;
    // PX31: the pack is nine pages and only one is drawn - a potion is not on
    // the weapons page, so the test says which page it is looking at.
    const page = (id) => {
      const i = PAGE_IDS.indexOf(id);
      assert.ok(i >= 0, id);
      one('packtabs').querySelectorAll('.packtab')[i].onclick({});
    };
    const pick = (i) => { packRows()[i].onclick?.({}); };
    return fn({ dom, e, view, packRows, remoteRows, acts, slotActs, act, press, marks, pick, page, cardUp, detail, actsRow });
  });
}

test.beforeEach(() => clearQuickslots());

// ── THE KIND DECIDES ─────────────────────────────────────────────────

test('QS2 tooltip: a potion offers Slot 1 and Slot 2, a weapon offers Swap to, and a torch, a book and a WORN weapon offer neither (mutants: the kind test inverted; the buttons drawn for everything; the buttons drawn for nothing)', () => {
  const items = [potion(), dagger(), sword(), torch(), book()];
  withPack(items, ({ e, acts, slotActs, page, pick, packRows, view }) => {
    equipItem(e, e.items[2]);   // the longsword is in the HAND: it is not a swap target
    view.repaint();

    page('potions');
    pick(0);
    assert.deepEqual(slotActs(), ['Slot 1', 'Slot 2'], 'a potion is a consumable - two slots, and no swap');
    assert.ok(acts().includes('Use'), 'and the buttons the card always had are untouched');

    page('weapons');
    assert.equal(packRows().length, 1, 'the worn longsword left the list (FilterLocalItems), so this is the dagger');
    pick(0);
    assert.deepEqual(slotActs(), ['Swap to'], 'an unequipped weapon is a swap target - one button, and no consumable slot');

    page('misc');
    pick(0);
    assert.deepEqual(slotActs(), [], 'a torch is the off-hand cell\'s, through entity.lightSource - never a quickslot');

    page('books');
    pick(0);
    assert.deepEqual(slotActs(), [], 'nor a book');
  });
});

test('QS2 tooltip: a WORN weapon offers no swap either - swapping to what is already in your hand is a no-op the card must not offer (mutant: canSwapTo losing its isEquipped arm)', () => {
  withPack([sword(), dagger()], ({ e, slotActs, page, pick, packRows, view }) => {
    equipItem(e, e.items[0]);
    view.repaint();
    page('weapons');
    assert.equal(packRows().length, 1);
    pick(0);
    assert.deepEqual(slotActs(), ['Swap to'], 'the one still in the pack');
    // ...and now wear THAT one: the list empties and there is nothing to offer.
    equipItem(e, e.items[1]);
    view.repaint();
    assert.equal(packRows().length, 0, 'both are worn, so neither row is in the list a swap could be set from');
  });
});

test('QS2 tooltip: a DRUG is a consumable too - the model\'s own two arms, not a potion test written twice (mutant: isQuickConsumable narrowed to potions)', () => {
  withPack([drug()], ({ slotActs, page, pick }) => {
    page('misc');
    pick(0);
    assert.deepEqual(slotActs(), ['Slot 1', 'Slot 2']);
  });
});

// ── THE PRESS ────────────────────────────────────────────────────────

test('QS2 tooltip: Slot 1 fills the slot and the button flips to Unslot 1 with the ON class, and pressing it again clears - the card staying up throughout (mutants: the press closing the tooltip; the label not flipping so the player presses to find out; the clear arm assigning again)', () => {
  withPack([potion()], ({ slotActs, press, pick, page, actsRow, cardUp }) => {
    page('potions');
    pick(0);
    assert.equal(quickslotEntry('c1'), null, 'nothing is slotted yet');
    const on = () => actsRow().querySelectorAll('.on').map((b) => b.textContent);

    press('Slot 1');
    assert.equal(quickslotEntry('c1')?.name, HEAL_NAME, 'the KIND is in slot 1');
    assert.ok(cardUp(), 'the card is STILL UP - a slot is not a use (PX24)');
    assert.deepEqual(slotActs(), ['Unslot 1', 'Slot 2'], 'the label flipped, in place');
    assert.deepEqual(on(), ['Unslot 1'], 'exactly one act wears the ON state');

    press('Unslot 1');
    assert.equal(quickslotEntry('c1'), null, 'and pressing it clears');
    assert.deepEqual(slotActs(), ['Slot 1', 'Slot 2']);
    assert.deepEqual(on(), []);
    assert.ok(cardUp(), 'still up');
  });
});

test('QS2 tooltip: pressing the OTHER slot MOVES the kind rather than copying it - the model\'s one-kind-one-slot law, reached through the buttons (mutant: the move dropped, so one potion reads as both slots)', () => {
  withPack([potion()], ({ press, slotActs, pick, page }) => {
    page('potions');
    pick(0);
    press('Slot 1');
    press('Slot 2');
    assert.equal(quickslotEntry('c1'), null, 'slot 1 let go');
    assert.equal(quickslotEntry('c2')?.name, HEAL_NAME);
    assert.deepEqual(slotActs(), ['Slot 1', 'Unslot 2']);
  });
});

test('QS2 tooltip: Swap to fills the swap slot and reads Unset swap after (mutant: the swap button wired to a consumable slot)', () => {
  withPack([dagger()], ({ press, slotActs, pick, page, actsRow }) => {
    page('weapons');
    pick(0);
    press('Swap to');
    assert.equal(quickslotEntry('swap')?.name, 'Elven Dagger');
    assert.equal(quickslotEntry('c1'), null, 'and no consumable slot was touched');
    assert.deepEqual(slotActs(), ['Unset swap']);
    assert.deepEqual(actsRow().querySelectorAll('.on').map((b) => b.textContent), ['Unset swap']);
    press('Unset swap');
    assert.equal(quickslotEntry('swap'), null);
  });
});

// ── THE ROW CHIP ─────────────────────────────────────────────────────

test('QS2 tooltip: the row of a slotted KIND grows a chip - 1, 2 or SWAP - and it appears the moment the button is pressed (mutants: the chip dropped, so the only way to read slot 1 is to open every tooltip; the chip on the wrong row)', () => {
  withPack([potion(HEAL_KEY), potion(FIRE_KEY), dagger()], ({ press, marks, pick, page, packRows }) => {
    page('potions');
    assert.equal(packRows().length, 2, 'two potions on the page');
    assert.deepEqual(marks(), [], 'no chips before anything is slotted');

    pick(0);
    press('Slot 1');
    assert.deepEqual(marks(), ['1'], 'the chip appeared on the rebuild the press asked for');

    pick(1);
    press('Slot 2');
    assert.deepEqual(marks(), ['1', '2'], 'one per slotted kind, in the list\'s own order');
    // ...and each is on the row of the kind it names, not merely present.
    assert.equal(packRows()[0].querySelectorAll('.qs-mark')[0]?.textContent, '1');
    assert.equal(packRows()[1].querySelectorAll('.qs-mark')[0]?.textContent, '2');
    // TWO RECIPES, TWO KINDS: the second took slot 2 and left slot 1 alone.
    assert.equal(quickslotEntry('c1')?.name, HEAL_NAME);
    assert.equal(quickslotEntry('c2')?.name, FIRE_NAME);
    assert.notEqual(HEAL_NAME, FIRE_NAME, 'two recipes really are two kinds');

    page('weapons');
    assert.deepEqual(marks(), [], 'a page with nothing slotted on it shows no chip');
    pick(0);
    press('Swap to');
    assert.deepEqual(marks(), ['SWAP']);

    // ...and it goes when the slot does.
    press('Unset swap');
    assert.deepEqual(marks(), []);
    page('potions');
    assert.deepEqual(marks(), ['1', '2'], 'the consumables kept theirs');
  });
});

// ── THE REMOTE SIDE ──────────────────────────────────────────────────

test('QS2 tooltip: a REMOTE row gets no slot buttons - a slot resolves against the pack, and that potion is still in the tray (mutants: the side gate dropped; the gate inverted)', () => {
  // The reward tray is the one remote list whose row opens a card rather than
  // taking on the click (G6), so it is the one that can be asked this.
  const tray = [potion(FIRE_KEY)];
  withPack([potion(HEAL_KEY)], ({ acts, slotActs, cardUp, remoteRows }) => {
    assert.equal(remoteRows().length, 1, 'the tray has its row');
    remoteRows()[0].onclick?.({});
    assert.ok(cardUp(), 'and it opens a card');
    assert.deepEqual(slotActs(), [], 'but no slot buttons - take it first, then slot it');
    assert.ok(acts().includes('Use'), 'the remote card still offers Use, as DFU does');
    // ...and the tray's row carries no chip either.
    assert.deepEqual(remoteRows()[0].querySelectorAll('.qs-mark'), []);
  }, { chooseOne: { items: tray } });
});

test('QS2 tooltip: a slotted kind in the PACK still chips while a tray holds the SAME kind and that one does not - the gate is the side, not the item (mutant: the chip gate reading the wrong side)', () => {
  const heal = potion(HEAL_KEY);
  assignQuickslot('c1', heal);
  assert.ok(quickslotOf(potion(HEAL_KEY)), 'the KIND is slotted, whichever record it is');
  withPack([heal], ({ marks, page, remoteRows }) => {
    page('potions');
    assert.deepEqual(marks(), ['1'], 'the pack row chips');
    assert.equal(remoteRows().length, 1);
    assert.deepEqual(remoteRows()[0].querySelectorAll('.qs-mark'), []);
  }, { chooseOne: { items: [potion(HEAL_KEY)] } });
});

// ── THE FACE ─────────────────────────────────────────────────────────

test('QS2 tooltip: the stylesheet reaches both new classes, in both faces - the JS and the CSS are one rope (mutant: the class renamed in one of the two)', () => {
  assert.match(ENHANCED_CSS, /\.act\.on \{ border-color: var\(--brass\); color: var\(--brass\); \}/,
    'the ON act wears the readied plaque\'s brass');
  assert.match(ENHANCED_CSS, /\.qs-mark \{/, 'the chip has a rule at all');
  assert.match(ENHANCED_CSS, /\.pack-shell \.itemrow \.qs-mark \{/,
    'and one in the PIXEL face, where a row is a 56px tile rather than a line');
  // AUDIT SOC C8's touch rule survives five buttons: the phone rule narrows
  // them and never shortens them, so the 44px target is the one .act already
  // had. The RULE ITSELF is read, not the file after it.
  const phone = /\.packdetail \.acts \.act \{[^}]*\}/.exec(ENHANCED_CSS)?.[0];
  assert.ok(phone, 'the phone rule for the card\'s five buttons');
  assert.match(phone, /padding-left: 12px; padding-right: 12px/, 'narrower');
  assert.doesNotMatch(phone, /height/, 'and never shorter - the touch target is untouched');
  assert.match(ENHANCED_CSS, /\.act \{\n\s*padding: 12px 20px; border: 1px solid var\(--iron\); color: var\(--dim\);\n\s*letter-spacing: 0\.06em; min-height: 46px;/,
    'which is 46px, as it has been');
  assert.match(ENHANCED_CSS, /\.acts \{ display: flex; gap: 8px; flex-wrap: wrap; \}/,
    'and the row WRAPS, so a narrow screen never cuts a button off');
  // The source says which module owns the law, so the next reader finds it.
  assert.match(rd('src/ui/enhancedInventory.js'),
    /import \{ isQuickConsumable, canSwapTo, quickslotOf, assignQuickslot, clearQuickslot \} from '\.\.\/systems\/quickslots\.js';/);
});
