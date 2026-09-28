// AUDIT MERGE-PLUS, LENS C (2026-09-26, the pre-merge audit of the Enhanced Plus patch - the pack's wear bars,
// DBLEQUIP's double-click, LOCK1's lock and the hotbar's frames - walked in Chromium with a mouse and on a 430x860
// phone). Eight findings, each fixed in the merge and each pinned here by DRIVING it: the pack is MOUNTED on the fake
// document (test/invdrag.mjs) and clicked with the browser's own `timeStamp` and `detail`, dragged by pointer, its
// clock run by node's mock timers; the classic pack and counter are clicked through their own pick arms; the hotbar
// is mounted on its dock and drawn frame by frame.
//
//   C1  the second tap of a phone's double-tap landed on the card the first tap opened - on Drop, five times in the
//       audit's run. A card's button struck by a pair's second click never presses: when the pair began on the
//       card's own piece it is the double-click's (the piece goes on or comes off), and any other is nothing.
//   C2  a drag released off every row (the ground, a key's cancel) left its click latch set, and the latch ate the
//       next double-click's first half. It lives one tick now - the click a release makes comes before any timer.
//   C3  the classic skin took the lock off: its Remove dropped a locked piece on the ground and its counter staged
//       one for sale. Both refuse now, by the piece's long name; the wagon, a chest, a repair and an identify still
//       take it.
//   C4  thirty locked arrows stowed in a wagon holding five came out thirty-five unlocked, and dropped; a split lost
//       the lock too. Locked and unlocked pieces never stack; the part split off a locked stack is locked.
//   C5  two quick taps on a two-piece worn panel (a lit torch over a shield) paired and put the torch out in a
//       dungeon, where the second tap was the cycle's. The panel's pair is a family of one's only.
//   C6  an enchanted ring or robe - whose powers spend its condition until it is gone - wore no bar.
//   C7  three clicks the browser counted apart (the Mace, a take off the pile, the Mace) paired on this pane's own
//       clock alone. A pair needs the browser's second click too (`detail` 2).
//   C8  the hotbar kept a slot's old frame when Loot Rarity was switched or a sigil came to the piece it shows.
//
// tools/mutants/auditmergeplus_pack.json puts each fix back the way it was, one site at a time - and the parts of the
// larger ones (C1's pair, its clock and its piece; Sell Magic's half of C3; the tier's and the rune's halves of C8)
// and the two refusals C3 must NOT make (the wagon, the smith) - and every one dies here.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { withDom } from './invdrag.mjs';
import { mountEnhancedInventory, wearPct, DOUBLE_CLICK_MS } from '../src/ui/enhancedInventory.js';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { mountHotbarDock, drawEnhancedHotbar } from '../src/ui/enhancedHotbar.js';
import { setHotbarSlot, hotbarEntryForItem, clearHotbar } from '../src/systems/quickslots.js';
import { stacksWith, addItem, splitStack, isEnchanted } from '../src/systems/inventory.js';
import { SMALL_CART_TEMPLATE } from '../src/systems/inventorySession.js';
import { createSurvivalItem, SURVIVAL_TEMPLATES, isSurvivalItem } from '../src/systems/survival/items.js';
import { ITEM_TEMPLATES } from '../src/characters/paperdoll.js';
import { equipItem, isEquipped } from '../src/systems/equip.js';
import { isLocked, setLocked, lockedText } from '../src/systems/itemLock.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';

const tmpl = (name) => ITEM_TEMPLATES.find((t) => t.name === name);
/** A piece at `pct` of its condition (test/wearlock1.test.js's own). */
const mk = (name, group = 'Weapons', pct = 100, extra = {}) => {
  const t = tmpl(name);
  assert.ok(t, `${name} is not a template in this build`);
  const max = t.hitPoints ?? 50;
  return { name: t.name, templateIndex: t.index, group, stackCount: 1, currentCondition: Math.round(max * pct / 100), maxCondition: max, ...extra };
};
const arrows = (n, locked = false) => { const a = mk('Arrow', 'Weapons', 100, { stackCount: n }); if (locked) setLocked(a, true); return a; };
const locked = (it) => { setLocked(it, true); return it; };
const ENCHANTED = Object.freeze([{ type: 1, param: 5 }]);   // Cast When Held: a power that runs, and spends the piece
const hero = (items) => ({ name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items, goldPieces: 10 });
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
/** What a stack list holds, `L` for a locked stack - `['5', '30L']`. */
const stacks = (list) => list.filter((i) => i.name === 'Arrow').map((i) => `${i.stackCount}${isLocked(i) ? 'L' : ''}`);
/** The pane's click memory is the module's and outlives a mount, and a worn panel's pair is keyed by a WORD
 *  (`worn:L·Hand`): every test takes a clock of its own, later than every click before it. */
let clock = 0;
const epoch = () => (clock += 100_000);

/** The pack, mounted over the ground (the pane's own default remote) under the enhanced skin, and the levers these
 *  findings need: rows on each side, the worn panels, the card's acts, a mouse drag. */
function withPack(items, fn, { before = null, deps = null } = {}) {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = hero(items);
    before?.(e);
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, ...(deps?.(e) ?? {}) });
    const rows = () => host.querySelectorAll('.itemrow');
    const rowOf = (name) => rows().find((r) => !r.closest('.loot-win') && textOf(r).includes(name)) ?? null;
    const lootRowOf = (name) => rows().find((r) => !!r.closest('.loot-win') && textOf(r).includes(name)) ?? null;
    const panelOf = (label) => host.querySelectorAll('.wornrow').find((r) => r.onclick && textOf(r).includes(label)) ?? null;
    const acts = () => host.querySelectorAll('.act').filter((b) => b.closest('.acts'));
    const actOf = (label) => acts().find((b) => b.textContent === label) ?? null;
    /** A click as the browser hands it over: when, and which click of a run it counts this one. */
    const click = (node, at, detail = 1) => node.onclick({ timeStamp: at, detail });
    const pack = () => JSON.parse(globalThis.__pack());
    const at = (node) => { dom.doc.elementFromPoint = () => node; };
    const down = (row) => row.onpointerdown({ pointerId: 7, button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 });
    const move = () => dom.win.fire('pointermove', { pointerId: 7, clientX: 60, clientY: 60 });
    const up = () => dom.win.fire('pointerup', { pointerId: 7, clientX: 60, clientY: 60 });
    const escape = () => dom.win.fire('keydown', { key: 'Escape', code: 'Escape', repeat: false, preventDefault() {}, stopPropagation() {} });
    try {
      return fn({ dom, host, e, view, rows, rowOf, lootRowOf, panelOf, acts, actOf, click, pack, at, down, move, up, escape });
    } finally { view.unmount(); }
  });
}

// ── C1 ─────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS C1 the card under the second tap: a double-tap that opened a piece\'s card and landed on its Drop wears the piece and drops nothing; a second click the pair does not own presses none of the card\'s buttons; a plain press still presses (mutants: the card unguarded, the pair swallowed unworn, the guard blind to the clock)', () => {
  const mace = mk('Mace'), dagger = mk('Dagger');
  withPack([mace, dagger], ({ dom, e, view, rowOf, acts, actOf, click, pack }) => {
    const T = epoch();
    click(rowOf('Mace'), T);
    assert.ok(actOf('Drop'), 'the first tap opened the Mace\'s card, over the tiles');
    click(actOf('Drop'), T + 180, 2);   // the thumb's second tap, where the card now is
    assert.equal(isEquipped(mace), true, 'the pair is the double-click\'s: the Mace goes on');
    assert.ok(e.items.includes(mace) && !view.dropped().includes(mace), 'and nothing was dropped');

    // A SECOND CLICK THE PAIR DOES NOT OWN: the browser counts it 2 (a system double-click time longer than this
    // pane's), but it came after DOUBLE_CLICK_MS - so it is nothing, on every button the card carries.
    const U = T + 5000;
    click(rowOf('Dagger'), U);
    const card = acts();
    for (const label of ['Wear', 'Drop', 'Lock', 'Info']) assert.ok(card.some((b) => b.textContent === label), `the dagger's card has ${label}`);
    const was = pack().repaints;
    card.forEach((b, i) => click(b, U + DOUBLE_CLICK_MS + 100 + i, 2));
    assert.equal(isEquipped(dagger), false, 'not worn');
    assert.ok(e.items.includes(dagger) && !view.dropped().includes(dagger), 'not dropped');
    assert.equal(isLocked(dagger), false, 'not locked');
    assert.equal(dom.doc.querySelectorAll('.inv-info').length, 0, 'no Info box');
    assert.equal(pack().repaints, was, 'no act ran at all - every act ends in a repaint');

    // ...and a plain press (detail 1) is a press
    click(actOf('Drop'), U + 3000, 1);
    assert.ok(!e.items.includes(dagger) && view.dropped().includes(dagger), 'a single press drops, as it always did');
  });
});

test('AUDIT MERGE-PLUS C1 a pair that began on ANOTHER piece presses nothing on this card: the Mace tapped, then the two-piece L-Hand panel, then its torch card\'s Douse struck as the browser\'s second click - the torch stays lit and the Mace is not worn (mutants: the card unguarded, the guard blind to the piece)', () => {
  const mace = mk('Mace'), torch = mk('Torch', 'UselessItems2'), shield = mk('Buckler', 'Armor');
  const before = (e) => { equipItem(e, shield); e.lightSource = torch; };
  withPack([mace, torch, shield], ({ e, rowOf, panelOf, actOf, click, pack }) => {
    const T = epoch();
    click(rowOf('Mace'), T);              // the pair's memory: the Mace
    click(panelOf('L·Hand'), T + 100);    // a two-piece family: no pair of its own (C5) - the torch's card, over the tiles
    assert.equal(pack().picked, 'Torch');
    assert.ok(actOf('Douse'), 'the lit torch\'s card offers Douse');
    click(actOf('Douse'), T + 200, 2);
    assert.equal(e.lightSource, torch, 'the torch stays lit');
    assert.equal(isEquipped(mace), false, 'and the Mace the pair began on is not worn by a button on the torch\'s card');
    assert.equal(isEquipped(shield), true);
  }, { before });
});

test('AUDIT MERGE-PLUS C1 a press of the card\'s own ends the row\'s pair: the Mace\'s row clicked, its card\'s Lock pressed, and the button (Unlock now, where Lock stood) struck again as the browser\'s second click - the Mace is locked once and never worn, the second click nothing (mutants: the card\'s press leaving the row\'s pair open)', () => {
  const mace = mk('Mace');
  withPack([mace], ({ rowOf, actOf, click }) => {
    const T = epoch();
    click(rowOf('Mace'), T);
    click(actOf('Lock'), T + 250, 1);
    assert.equal(isLocked(mace), true, 'the press locks');
    click(actOf('Unlock'), T + 400, 2);   // the browser's pair is the two BUTTON clicks, inside the row click's 500ms
    assert.equal(isEquipped(mace), false, 'the row\'s pair was ended by the press: nothing wears the Mace');
    assert.equal(isLocked(mace), true, 'and the pair\'s second click is nothing - a double-click on Lock locks once');
  });
});

// ── C2 ─────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS C2 the drag\'s click latch lives one tick: the click a release makes is still no pick, but a release off every row (a drop on the world, an Escape) no longer eats the next double-click\'s first half (mutant: the latch outliving its click)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const mace = mk('Mace'), dagger = mk('Dagger'), katana = mk('Katana'), longsword = mk('Longsword');
    withPack([mace, dagger, katana, longsword], ({ dom, e, host, view, rowOf, click, pack, at, down, move, up, escape }) => {
      const T = epoch();
      const tick = () => mock.timers.tick(1);
      const pair = (name, t) => { click(rowOf(name), t, 1); click(rowOf(name), t + 150, 2); };
      // INV2 A-F6's law stands: the click a release makes on the row it left is not a pick (the pack's own chrome
      // is "never mind", and the row survives the release unrepainted)
      const win = host.querySelectorAll('.pack-win')[0];
      at(win); down(rowOf('Mace')); move(); up();
      click(rowOf('Mace'), T, 1);
      assert.equal(pack().picked, null, 'the release\'s own click is swallowed');
      tick();

      // A RELEASE OFF EVERY ROW: the dagger carried out over the world and let go. No click follows it anywhere.
      at(dom.body); down(rowOf('Dagger')); move(); up();
      assert.ok(!e.items.includes(dagger) && view.dropped().includes(dagger), 'the drag dropped it');
      tick();
      pair('Katana', T + 1000);
      assert.equal(isEquipped(katana), true, 'the next double-click is whole: the Katana goes on');

      // A KEY'S CANCEL: Escape aborts the drag (nothing moves), and leaves no latch behind it either
      at(dom.body); down(rowOf('Longsword')); move(); escape();
      assert.equal(dom.doc.querySelectorAll('.dragghost').length, 0, 'the drag is over');
      assert.ok(e.items.includes(longsword), 'an abort moves nothing');
      tick();
      pair('Longsword', T + 3000);
      assert.equal(isEquipped(longsword), true, 'the double-click after an Escape wears it');
    });
  } finally { mock.timers.reset(); }
});

// ── C3 ─────────────────────────────────────────────────────────────

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

test('AUDIT MERGE-PLUS C3 the classic pack honours the lock: Remove over the ground refuses a locked piece in its own words and keeps it, drops an unlocked one, and still stows a locked one in the wagon or a chest (mutants: the classic Remove unguarded, the lock closing the wagon)', () => {
  const dagger = locked(mk('Dagger')), tanto = mk('Tanto');
  const bag = [dagger, tanto];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: { items: bag, activeEffects: [] } });
  w.mode = 'remove';
  w._pick(w._filtered().indexOf(dagger));
  assert.ok(bag.includes(dagger) && !w.dropped.includes(dagger), 'a locked piece is not dropped on this skin either');
  assert.deepEqual(w.boxes, [{ rows: [{ text: lockedText(itemLongName(dagger)), center: true }] }]);
  assert.equal(w.boxes[0].rows[0].text, 'Iron Dagger is locked. Unlock it first.', 'the piece\'s long name, as the enhanced pack says it');
  assert.equal(isLocked(dagger), true);
  w.boxes = [];
  w._pick(w._filtered().indexOf(tanto));
  assert.ok(!bag.includes(tanto) && w.dropped.includes(tanto), 'an unlocked piece goes on the ground as it always did');

  // the ground alone is refused: a wagon and a chest are places of the piece's own
  const knife = locked(mk('Dagger'));
  const cart = { name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 };
  const bag2 = [knife, cart];
  const wagon = [];
  const ww = new NativeInventoryWindow({ items: () => bag2, wagonItems: () => wagon, icons: ICONS, entity: { items: bag2, wagonItems: wagon, activeEffects: [] } });
  ww.mode = 'remove';
  ww.usingWagon = true;
  ww._pick(ww._filtered().indexOf(knife));
  assert.ok(wagon.includes(knife) && !bag2.includes(knife) && isLocked(knife), 'stowed in the wagon, still locked');
  const blade = locked(mk('Dagger'));
  const bag3 = [blade];
  const chest = [];
  const wc = new NativeInventoryWindow({ items: () => bag3, icons: ICONS, entity: { items: bag3, activeEffects: [] },
    loot: { items: () => chest, playerOwned: false, textureArchive: 380, textureRecord: 1 } });
  wc.mode = 'remove';
  wc._pick(wc._filtered().indexOf(blade));
  assert.ok(chest.includes(blade) && !bag3.includes(blade), 'put in a chest');
});

test('AUDIT MERGE-PLUS C3 the classic counter honours the lock: Sell and Sell Magic refuse to stage a locked piece, in its own words; an unlocked one is staged; a repair and an identify still take a locked one, because it comes back (mutants: the classic sale unguarded, Sell Magic unguarded, the lock refusing the smith)', () => {
  const hooks = (mode, bag) => ({
    mode, shelfItems: () => [], packItems: () => bag, entity: { items: bag }, accepts: () => true, enchanted: () => true,
    priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }), gold: () => 1000,
    rows: (id) => [{ text: `#${id}`, center: true }], weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
    commit: () => {}, icons: ICONS,
  });
  /** A locked and an unlocked piece at the counter in `mode`, each clicked from the pack's list. */
  const counter = (mode, magic) => {
    const extra = { currentCondition: 40, value: 40, ...(magic ? { enchantments: ENCHANTED, magic: true } : {}) };
    const lockedOne = locked(mk('Dagger', 'Weapons', 100, extra));
    const plainOne = mk('Tanto', 'Weapons', 100, extra);
    const bag = [lockedOne, plainOne];
    const w = new NativeTradeWindow(hooks(mode, bag));
    if (magic) w.tab = 'magic';   // an enchanted piece is on the classic Magic tab
    w._pickLocal(w.localList().indexOf(lockedOne));
    const lockedBox = w.box?.rows?.[0]?.text ?? null;
    const lockedStaged = w.staged.includes(lockedOne);
    w.box = null;
    w._pickLocal(w.localList().indexOf(plainOne));
    return { lockedOne, lockedBox, lockedStaged, plainStaged: w.staged.includes(plainOne), bag };
  };
  for (const [mode, magic] of [['Sell', false], ['SellMagic', true]]) {
    const r = counter(mode, magic);
    assert.equal(r.lockedStaged, false, `${mode}: a locked piece is not put up for sale`);
    assert.ok(r.bag.includes(r.lockedOne), `${mode}: it stays in the pack`);
    assert.equal(r.lockedBox, lockedText(itemLongName(r.lockedOne)), `${mode}: and the box names it`);
    assert.equal(r.plainStaged, true, `${mode}: an unlocked one sells`);
  }
  assert.equal(counter('SellMagic', true).lockedBox, 'Dagger is locked. Unlock it first.', 'an unidentified piece is named as the player knows it');
  for (const [mode, magic] of [['Repair', false], ['Identify', true]]) {
    const r = counter(mode, magic);
    assert.equal(r.lockedStaged, true, `${mode}: the lock closes the ground, the sale and a trade - not the smith`);
    assert.equal(r.lockedBox, null);
  }
});

// ── C4 ─────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS C4 locked and unlocked pieces never stack and a split keeps the lock: thirty locked arrows stowed on the wagon\'s five stay thirty and locked, come back locked and are refused the ground; ten of them split off into the wagon are locked (mutants: a lock-blind stack, the split unlocked)', () => {
  // THE AUDIT'S WAY THERE, on the mounted pack: the cart's plaque opens the wagon, the card's Stow puts them in
  const quiver = arrows(30, true);
  const cart = { name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 };
  withPack([quiver, cart], ({ e, host, rowOf, lootRowOf, actOf, click, pack }) => {
    const T = epoch();
    const door = () => host.querySelectorAll('button').find((b) => b.onclick && /cart/i.test(textOf(b)));
    door().onclick();
    assert.equal(pack().remoteKind, 'wagon');
    click(rowOf('Arrow'), T);
    click(actOf('Stow in wagon'), T + 1000);
    assert.deepEqual(stacks(e.wagonItems), ['5', '30L'], 'the wagon holds two stacks: the lock did not melt into the five');
    click(lootRowOf('×30'), T + 2000);   // a loot-side click takes (IG7)
    assert.deepEqual(stacks(e.items), ['30L'], 'taken back, still locked');
    door().onclick();
    assert.equal(pack().remoteKind, 'ground');
    click(rowOf('Arrow'), T + 3000);
    click(actOf('Drop'), T + 4000);
    assert.deepEqual(stacks(e.items), ['30L'], 'and so the ground refuses them');
    assert.match(pack().notice, /is locked\. Unlock it first\.$/);

    // ten of the thirty, through the card's how-many field (the refusal kept the card up; the wagon's door keeps it)
    door().onclick();
    assert.equal(pack().picked, 'Arrow');
    const field = host.querySelectorAll('input').find((i) => i.closest('.qtyfield'));
    assert.ok(field, 'the card asks how many');
    field.value = '10'; field.oninput();
    click(actOf('Stow in wagon'), T + 6000);
    assert.deepEqual(stacks(e.wagonItems), ['5', '10L'], 'the ten are locked, beside the five');
    assert.deepEqual(stacks(e.items), ['20L']);
  }, { before: (e) => { e.wagonItems = [arrows(5)]; }, deps: (e) => ({ wagonItems: () => e.wagonItems }) });

  // ...and the two members underneath, which every transfer on both skins goes through
  assert.equal(stacksWith(arrows(5), arrows(3)), true, 'two plain stacks merge');
  assert.equal(stacksWith(arrows(5, true), arrows(3, true)), true, 'two locked stacks merge');
  assert.equal(stacksWith(arrows(5), arrows(30, true)), false, 'a plain stack takes no locked one');
  assert.equal(stacksWith(arrows(30, true), arrows(5)), false, 'nor the other way round');
  const pile = [arrows(5)];
  addItem(pile, arrows(30, true));
  assert.deepEqual(stacks(pile), ['5', '30L'], 'AddItem keeps them apart');
  const src = [arrows(30, true)];
  const part = splitStack(src, src[0], 10);
  assert.deepEqual(stacks(src), ['20L', '10L'], 'SplitStack: the part split off wears the stack\'s lock');
  assert.equal(part.locked, true);
  const plain = [arrows(30)];
  assert.equal('locked' in splitStack(plain, plain[0], 10), false, 'and an unlocked split carries no field at all');
});

// ── C5 ─────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS C5 the worn panel\'s pair is a family of ONE\'s: two quick taps on a lit torch over a shield cycle to the shield and the torch burns on; two cloaks stay on; a one-piece family still comes off on the pair (mutant: the pair on any family)', () => {
  const torch = mk('Torch', 'UselessItems2'), shield = mk('Buckler', 'Armor');
  const c1 = mk('Casual Cloak', 'MensClothing'), c2 = mk('Formal Cloak', 'MensClothing'), mace = mk('Mace');
  const before = (e) => { equipItem(e, shield); e.lightSource = torch; equipItem(e, c1); equipItem(e, c2); equipItem(e, mace); };
  withPack([torch, shield, c1, c2, mace], ({ e, panelOf, click, pack }) => {
    const T = epoch();
    const hand = () => panelOf('L·Hand');
    assert.equal(textOf(hand()).includes('Torch'), true, 'HT5: the held light is on top');
    click(hand(), T, 1);
    assert.equal(pack().picked, 'Torch');
    click(hand(), T + 400, 2);   // the browser's own second click, on the same panel
    assert.equal(e.lightSource, torch, 'the torch is still lit - in a dungeon, the only light');
    assert.equal(isEquipped(shield), true);
    assert.equal(pack().picked, 'Buckler', 'the second tap was the cycle\'s: the shield\'s card');
    assert.ok(textOf(hand()).includes('Buckler'));

    click(panelOf('Cloaks'), T + 2000, 1);
    click(panelOf('Cloaks'), T + 2250, 2);
    assert.ok(isEquipped(c1) && isEquipped(c2), 'two cloaks: the pair takes neither off');

    click(panelOf('R·Weapon'), T + 5000, 1);
    click(panelOf('R·Weapon'), T + 5200, 2);
    assert.equal(isEquipped(mace), false, 'a family of one: the pair still takes it off (DBLEQUIP)');
  }, { before });
});

// ── C6 ─────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS C6 an ENCHANTED piece wears the bar - a ring, a robe - by the share of its condition left, and the pack draws it on the Magic page; a plain ring still wears none, and ammunition, a survival item or a piece with no condition none even enchanted (mutant: the enchanted piece unbarred)', () => {
  const ring = mk('Ring', 'Jewellery', 30, { enchantments: ENCHANTED });
  assert.equal(isEnchanted(ring), true);
  withPack([ring, mk('Ring', 'Jewellery', 30)], ({ rows, host }) => {
    const page = (word) => host.querySelectorAll('.packtab').find((t) => textOf(t).toLowerCase().includes(word)).onclick();
    page('magic');
    const row = rows().find((r) => textOf(r).includes('Ring'));
    assert.ok(row, 'the enchanted ring is on the Magic page');
    assert.ok(row.classList.contains('hasbar'), 'the row is marked, so the sheet lifts what shares the foot');
    const bar = row.querySelector('.wear');
    assert.ok(bar && bar.parent.classList.contains('tile'), 'the bar is in the picture');
    assert.equal(bar.className, 'wear worn', 'red, under the hotbar\'s line');
    assert.equal(bar.children[0].style.width, '30%', 'the ring\'s powers spend its condition: the bar is the share left');
    page('valuables');
    const plainRow = rows().find((r) => textOf(r).includes('Ring'));
    assert.ok(plainRow && !plainRow.classList.contains('hasbar') && !plainRow.querySelector('.wear'), 'the plain ring, on Valuables, has none');
  });
  assert.equal(wearPct(ring), 30);
  assert.equal(wearPct(mk('Casual Cloak', 'MensClothing', 20, { enchantments: ENCHANTED })), 20, 'a robe the same');
  assert.equal(wearPct({ ...ring, customEnchantments: ENCHANTED, enchantments: [] }), 30, 'a made enchantment is one too');
  assert.equal(wearPct(mk('Ring', 'Jewellery', 30)), null, 'a plain ring wears nothing out: no bar');
  const arrow = mk('Arrow', 'Weapons', 100, { enchantments: ENCHANTED });
  assert.ok(arrow.maxCondition > 0);
  assert.equal(wearPct(arrow), null, 'an arrow is spent, not worn, whatever it carries');
  const skin = createSurvivalItem(SURVIVAL_TEMPLATES.find((t) => t.name === 'Waterskin').index);
  assert.ok(isSurvivalItem(skin) && skin.maxCondition > 0);
  assert.equal(wearPct({ ...skin, enchantments: ENCHANTED }), null, 'a survival item\'s condition is its uses');
  assert.equal(wearPct({ ...ring, maxCondition: 0 }), null, 'no condition, no bar');
});

// ── C7 ─────────────────────────────────────────────────────────────

test('AUDIT MERGE-PLUS C7 a pair needs the browser\'s second click: the Mace, a take off the pile, the Mace again - three clicks inside DOUBLE_CLICK_MS the browser counted apart - are picks, and the Mace is not worn; the browser\'s own pair still wears it (mutant: the pair counted on this pane\'s clock alone)', () => {
  const mace = mk('Mace'), longsword = mk('Longsword');
  withPack([mace, longsword], ({ e, view, rowOf, lootRowOf, actOf, click, pack }) => {
    const T = epoch();
    click(rowOf('Longsword'), T);
    click(actOf('Drop'), T + 1000);
    assert.ok(view.dropped().includes(longsword), 'something on the pile to take');
    const U = T + 5000;
    click(rowOf('Mace'), U, 1);
    click(lootRowOf('Longsword'), U + 150, 1);   // a loot-side click takes at once
    assert.ok(e.items.includes(longsword), 'the take');
    click(rowOf('Mace'), U + 400, 1);            // the browser: a FIRST click, the pointer has been elsewhere
    assert.equal(isEquipped(mace), false, 'three clicks, not a pair: the Mace is not worn');
    assert.equal(pack().picked, 'Mace', 'the last one picked it, as a single click does');
    click(rowOf('Mace'), U + 2000, 1);
    click(rowOf('Mace'), U + 2150, 2);
    assert.equal(isEquipped(mace), true, 'the browser\'s own pair (detail 2) inside DOUBLE_CLICK_MS wears it');
  });
});

// ── C8 ─────────────────────────────────────────────────────────────
// (last: the bar it mounts is the hotbar module's for the rest of the file, and the pack's mount would find it)

test('AUDIT MERGE-PLUS C8 the hotbar repaints a slot when its frame changes: Loot Rarity switched off takes the tier off at the next frame and on puts it back; a sigil come to the piece puts the rune on - name, count and condition all unchanged (mutants: the slot blind to its frame, the tier out of the signature, the rune out of it)', () => {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  setPref('quickbarStyle', 'hotbar');
  setPref('lootRarity', true);
  try {
    withDom((dom) => {
      // the bar's icon ladder takes a picture's `src` off again; the fake element has no removeAttribute of its own
      const make = dom.doc.createElement;
      dom.doc.createElement = (tag) => Object.assign(make(tag), { removeAttribute(k) { delete this.attrs[k]; } });
      const dock = dom.mk('div');
      dom.body.append(dock);
      mountHotbarDock(dock);
      clearHotbar();
      const sword = mk('Longsword', 'Weapons', 100, { rarity: 'rare' });
      const e = hero([sword]);
      assert.equal(setHotbarSlot(0, hotbarEntryForItem(sword)), true);
      const slot = () => dock.querySelectorAll('.hb-slot').find((n) => n.dataset.slot === '0');
      const frame = () => drawEnhancedHotbar(e, { paused: false });
      frame();
      assert.equal(slot().dataset.rarity, 'rare', 'the slot wears the tier');
      assert.equal(slot().title, 'Iron Longsword');
      setPref('lootRarity', false);
      frame();
      assert.equal(slot().dataset.rarity, undefined, 'Loot Rarity off: the frame comes off at the next frame, not when something else moves');
      setPref('lootRarity', true);
      frame();
      assert.equal(slot().dataset.rarity, 'rare', 'and on again');
      assert.equal(slot().dataset.sigil, undefined);
      sword.sigil = { power: 7, party: 1, xp: 0 };
      frame();
      assert.equal(slot().dataset.sigil, '', 'a sigil come to the piece: the rune');
      assert.equal(slot().title, 'Iron Longsword', 'nothing else the slot shows moved');
    });
  } finally { clearHotbar(); _resetForTests(); }
});
