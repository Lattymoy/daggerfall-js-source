// WAGON-FILTER + SHIFT-STOW (2026-10-04, Mac: "The wagon needs a filter option and shift click to deposit items (like
// materials) needs to be a thing"). Pinned by DRIVING both skins: the enhanced pack mounted on the fake document
// (test/invdrag.mjs) and clicked with the browser's own event, the classic window through its own click and key arms.
//   - the filter (ui/storeFilter.js): the pack's nine pages and Materials over the wagon, the storage and the bag; the
//     search reads the row's name; a take from a filtered list takes that piece; other remotes carry no filter;
//   - Shift on a pack row puts the whole stack into the player's own store beside it, through the same ladder (the
//     750 kg, the bag's materials-only), never the ground or a corpse, and never a double click's wear;
//   - the classic window holds Shift as it holds Control, and Shift with the left button is Remove, whole, no popup.
// Mutants: tools/mutants/shiftstow.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withDom } from '../invdrag.mjs';
import { mountEnhancedInventory, SHIFT_STOW_HINT } from '../../src/ui/enhanced/enhancedInventory.js';
import { NativeInventoryWindow, WAGON_KG_LIMIT, noteFocusLost } from '../../src/ui/native/nativeInventory.js';
import { CELL_X } from '../../src/ui/item/itemScroller.js';
import { STORE_FILTERS, STORE_FILTER_KINDS, filterStore, storeFilterOptions, storeFilterAccepts, storeQuery } from '../../src/ui/storeFilter.js';
import { lootRarityOn } from '../../src/systems/loot/lootRarity.js';
import { SMALL_CART_TEMPLATE } from '../../src/systems/inventorySession.js';
import { mintMaterialItem } from '../../src/systems/professions/profItems.js';
import { ITEM_TEMPLATES } from '../../src/characters/paperdoll/paperdoll.js';
import { isEquipped } from '../../src/systems/equip.js';
import { _resetForTests } from '../../src/systems/uiPrefs.js';
import { PACK_PAGES } from '../../src/ui/packPages.js';
import { effectiveUnitWeightInKg, totalWeight } from '../../src/systems/inventory.js';

const tmpl = (name) => ITEM_TEMPLATES.find((t) => t.name === name);
const mk = (name, group = 'Weapons', extra = {}) => {
  const t = tmpl(name);
  assert.ok(t, `${name} is not a template in this build`);
  return { name: t.name, templateIndex: t.index, group, stackCount: 1, currentCondition: t.hitPoints ?? 50, maxCondition: t.hitPoints ?? 50, ...extra };
};
const arrows = (n) => mk('Arrow', 'Weapons', { stackCount: n });
const ingots = (n) => { const it = mintMaterialItem('ingot:iron'); it.stackCount = n; return it; };
const cart = () => ({ name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 });
const hero = (items) => ({ name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items, goldPieces: 10 });
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
let clock = 0;
const epoch = () => (clock += 100_000);

/** The pack mounted with the wagon open (the cart's door pressed), or over `loot` when one is handed. */
function withWagon(items, wagon, fn, { loot = null, open = true, chooseOne = null } = {}) {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = hero(items);
    e.wagonItems = wagon;
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, wagonItems: () => e.wagonItems, onExit: () => {}, ...(loot ? { loot } : {}), ...(chooseOne ? { chooseOne } : {}) });
    const rows = () => host.querySelectorAll('.itemrow');
    const rowOf = (name) => rows().find((r) => !r.closest('.loot-win') && textOf(r).includes(name)) ?? null;
    const lootRows = () => rows().filter((r) => !!r.closest('.loot-win')).map((r) => textOf(r));
    const lootRowOf = (name) => rows().find((r) => !!r.closest('.loot-win') && textOf(r).includes(name)) ?? null;
    const pack = () => JSON.parse(globalThis.__pack());
    const door = () => host.querySelectorAll('button').find((b) => b.onclick && /cart|wagon/i.test(textOf(b)) && !b.closest('.loot-win .remotelist'));
    const menu = () => host.querySelectorAll('select').find((m) => m.className === 'storecat') ?? null;
    const options = () => (menu()?.children ?? []).map((o) => o.textContent);
    const choose = (id) => { const m = menu(); m.value = id; m.onchange(); };
    const search = () => host.querySelectorAll('input').find((i) => i.className === 'storesearch') ?? null;
    const click = (node, at, extra = {}) => node.onclick({ timeStamp: at, detail: 1, ...extra });
    const tabTo = (label) => host.querySelectorAll('.packtab').find((b) => b.textContent.startsWith(label)).onclick();
    try {
      if (open && !loot && !chooseOne) { door().onclick(); assert.equal(pack().remoteKind, 'wagon'); }
      return fn({ dom, host, e, view, rowOf, lootRows, lootRowOf, pack, menu, options, choose, search, click, tabTo, door });
    } finally { view.unmount(); }
  });
}

test('WAGON-FILTER storeFilter: All, Materials and the pack\'s nine pages; Materials is the bag\'s own test and crosses the pages; the search is the row\'s name, trimmed and lower-cased; the menu names what the store holds and keeps the chosen one (mutants: Materials read as a page, the query unlowered)', () => {
  assert.deepEqual(STORE_FILTERS.map(([id]) => id), ['all', 'materials', ...PACK_PAGES.map(([id]) => id)]);
  assert.deepEqual([...STORE_FILTER_KINDS].sort(), ['bag', 'container', 'storage', 'wagon']);
  const a = arrows(3), i = ingots(4), herb = mintMaterialItem('p1:8');   // AUDIT D: an herb's key is p1:/p2: and its template (the bag's law)
  assert.ok(herb, 'the herb is minted');
  assert.equal(storeFilterAccepts(i, 'materials'), true, 'an ingot is a material');
  assert.equal(storeFilterAccepts(i, 'misc'), true, '... and lives on Misc');
  assert.equal(storeFilterAccepts(a, 'materials'), false, 'an arrow is not');
  assert.equal(storeFilterAccepts(a, 'weapons'), true);
  assert.equal(storeFilterAccepts(a, 'nonsense'), true, 'an id the list does not have shows everything');
  assert.equal(storeFilterAccepts(herb, 'materials'), true, 'a herb too...');
  assert.equal(storeFilterAccepts(herb, 'ingredients'), true, '... from the Ingredients page');
  assert.equal(storeQuery('  IRON  '), 'iron');
  const items = [a, i];
  assert.deepEqual(filterStore(items, { cat: 'all', query: ' IrOn ' }, (it) => it.name), [i]);
  assert.deepEqual(filterStore(items, { cat: 'materials' }, (it) => it.name), [i]);
  assert.deepEqual(filterStore(items, { cat: 'weapons', query: 'iron' }, (it) => it.name), []);
  assert.deepEqual(storeFilterOptions(items, 'all').map((c) => `${c.id}:${c.count}`), ['all:2', 'materials:1', 'weapons:1', 'misc:1']);
  assert.deepEqual(storeFilterOptions([a], 'materials').map((c) => `${c.id}:${c.count}`), ['all:1', 'materials:0', 'weapons:1'], 'the chosen one stays at nought');
  assert.equal(storeQuery('x'.repeat(60)).length, 40, 'the search reads 40 characters at most');
});

test('WAGON-FILTER on the enhanced pack: the wagon carries the search and the menu in ONE row; the menu and the search narrow the rows in place (the field kept, a pack card kept open); a take from the narrowed list takes that piece; nothing matching says so (mutants: the rows unfiltered, the bar on every remote)', () => {
  withWagon([cart(), mk('Dagger')], [arrows(20), ingots(6), mk('Mace')], ({ e, host, lootRows, lootRowOf, menu, options, choose, search, click, pack, rowOf }) => {
    assert.ok(search(), 'the wagon has its search');
    assert.equal(host.querySelectorAll('.storefilter').length, 1);
    const bar = host.querySelectorAll('.storefilter')[0];
    const kids = ['storecat'];
    if (lootRarityOn()) kids.push('storerarity');
    kids.push('storemat');   // MAT-FILTER: the metal menu stands beside the tiers
    assert.deepEqual(bar.children.map((c) => c.className), ['storesearch', 'storemenus'], 'one bar: the search, then the menus as one group (FILTER-FIT: a narrow window moves the group under the search)');
    assert.deepEqual(bar.children[1].children.map((c) => c.className), kids, 'the menus, in their order');
    assert.deepEqual(options(), ['All (3)', 'Materials (1)', 'Weapons (2)', 'Misc (1)']);
    click(rowOf('Dagger'), epoch());
    assert.equal(pack().picked, 'Dagger', 'a pack card open');
    const before = search();
    choose('materials');
    assert.equal(search(), before, 'the menu refills the rows in place - nothing rebuilt');
    assert.equal(pack().picked, 'Dagger', 'and the card stays open');
    assert.equal(lootRows().length, 1);
    assert.match(lootRows()[0], /Iron Ingot/);
    click(lootRowOf('Iron Ingot'), epoch());
    assert.equal(e.items.filter((it) => /Ingot/.test(it.name)).length, 1, 'the ingots taken - the right piece out of the whole wagon');
    assert.equal(e.wagonItems.length, 2);
    assert.equal(menu().value, 'materials', 'the choice stays at nought');
    assert.ok(options().includes('Materials (0)'));
    choose('all');
    const s = search();
    s.value = 'mac'; s.oninput();
    assert.equal(search(), s, 'typing refills in place - the field is never rebuilt under the caret');
    assert.deepEqual(lootRows().map((r) => /Mace/.test(r)), [true]);
    s.value = 'zzz'; s.oninput();
    assert.equal(lootRows().length, 0, 'no rows');
    assert.ok(host.querySelectorAll('.packempty').some((p) => p.textContent === 'Nothing here matches.'));
    // Back in the field clears it, the pack stays
    let stopped = false;
    s.onkeydown({ key: 'Escape', code: 'Escape', preventDefault() {}, stopPropagation() { stopped = true; } });
    assert.equal(s.value, '');
    assert.ok(stopped, 'the pack never sees that Back');
    assert.equal(lootRows().length, 2);
  });
  // LOOT-BULK: a corpse carries the bar. A reward tray does not - the mutant that forces the bar onto every remote dies there.
  const body = [arrows(2), mk('Mace')];
  withWagon([], [], ({ host, search, lootRows }) => {
    assert.equal(lootRows().length, 2, 'the body\'s rows are drawn');
    assert.ok(search(), 'a container has the search');
    assert.equal(host.querySelectorAll('.storefilter').length, 1);
  }, { loot: { items: () => body } });
  withWagon([mk('Dagger')], [], ({ host, search }) => {
    assert.equal(search(), null, 'a reward tray has no search');
    assert.equal(host.querySelectorAll('.storefilter').length, 0);
  }, { open: false, chooseOne: { items: [mk('Mace')], title: 'A gift' } });
});

test('WAGON-FILTER is fresh for every store shown: the wagon shut and opened again, a store emptied, a new open - never a filter carried in (AUDIT C2; mutants: the toggle keeps it, the emptied store keeps it, the mount keeps it)', () => {
  withWagon([cart(), mk('Dagger')], [ingots(2), mk('Mace')], ({ door, menu, choose, search, lootRows }) => {
    choose('weapons');
    const s = search(); s.value = 'mac'; s.oninput();
    assert.equal(lootRows().length, 1);
    door().onclick(); door().onclick();   // the wagon shut and shown again
    assert.equal(menu().value, 'all');
    assert.equal(search().value, '');
    assert.equal(lootRows().length, 2);
  });
  // emptied on Materials: the next piece in is shown
  withWagon([cart(), mk('Dagger')], [ingots(2)], ({ e, choose, lootRows, lootRowOf, rowOf, click, tabTo }) => {
    choose('materials');
    click(lootRowOf('Iron Ingot'), epoch());
    assert.equal(e.wagonItems.length, 0);
    tabTo('Weapons');   // a take turns the pack to the taken piece's page
    click(rowOf('Dagger'), epoch(), { shiftKey: true });
    assert.deepEqual(lootRows().map((r) => /Dagger/.test(r)), [true], 'the dagger just stowed is shown, not hidden by the old Materials');
  });
  // the player's chest, opened straight onto (no door pressed): left on Weapons, the next open starts on All
  const chest = [ingots(2), mk('Mace')];
  withWagon([], [], ({ choose, menu }) => { choose('weapons'); assert.equal(menu().value, 'weapons'); }, { loot: { items: () => chest, storage: true } });
  withWagon([], [], ({ menu, lootRows }) => {
    assert.equal(menu().value, 'all', '... a new open starts on All');
    assert.equal(lootRows().length, 2);
  }, { loot: { items: () => chest, storage: true } });
});

test('WAGON-FILTER: the search reads the row\'s name - an unidentified enchanted piece is found by what it shows, never by the name it hides (mutant: the search on item.name)', () => {
  const hidden = mk('Mace', 'Weapons', { name: 'Mace of the Sorrowful', enchantments: [{ type: 1, param: 5 }] });
  withWagon([cart()], [hidden, mk('Dagger')], ({ search, lootRows }) => {
    const s = search();
    s.value = 'sorrow'; s.oninput();
    assert.equal(lootRows().length, 0, 'the hidden name is not searchable');
    s.value = 'mace'; s.oninput();
    assert.equal(lootRows().length, 1);
  });
});

test('SHIFT-STOW on the enhanced pack: Shift on a pack row stows the whole stack in the wagon in one press - no card - and a quick second one on a refused piece never wears it; a plain click still only picks; the hint says the gesture (mutants: the shift arm gone, the arm after the double click, the arm on the ground)', () => {
  withWagon([cart(), arrows(30), mk('Mace'), mk('Dagger')], [], ({ e, rowOf, click, pack, host }) => {
    assert.ok(host.querySelectorAll('.storehint').some((p) => p.textContent === SHIFT_STOW_HINT.wagon), 'the hint under the wagon\'s head');
    const T = epoch();
    click(rowOf('Arrow'), T);
    assert.equal(e.wagonItems.length, 0, 'a plain click picks');
    assert.equal(pack().picked, 'Arrow');
    click(rowOf('Arrow'), T + 5000, { shiftKey: true });
    assert.deepEqual(e.wagonItems.map((it) => `${it.name}:${it.stackCount}`), ['Arrow:30'], 'the whole stack, in one press');
    assert.equal(e.items.some((it) => it.name === 'Arrow'), false);
  });
  // a full wagon refuses the Mace, and the Mace stays on its row: two quick shift-clicks on it are two refusals, never
  // the double click that wears it
  const brim = () => Array.from({ length: Math.floor(WAGON_KG_LIMIT / effectiveUnitWeightInKg(mk('Mace'))) }, () => mk('Mace'));
  withWagon([cart(), mk('Mace')], brim(), ({ e, rowOf, click, pack }) => {
    const T = epoch();
    click(rowOf('Mace'), T, { shiftKey: true });
    click(rowOf('Mace'), T + 100, { shiftKey: true, detail: 2 });
    assert.equal(e.items.some(isEquipped), false, 'not worn');
    assert.ok(e.items.some((it) => it.name === 'Mace'), 'still in the pack');
    assert.ok(pack().notice, 'the wagon\'s refusal is said');
  });
  // the ground: Shift is a plain click there - nothing dropped
  withWagon([arrows(5)], [], ({ e, rowOf, click, pack }) => {
    click(rowOf('Arrow'), epoch(), { shiftKey: true });
    assert.equal(e.items.length, 1, 'nothing dropped on the ground');
    assert.equal(pack().picked, 'Arrow');
  }, { open: false });
});

test('SHIFT-STOW goes through the ladder: the wagon\'s 750 kg takes what fits; the player\'s own storage takes it as the wagon does', () => {
  const unit = effectiveUnitWeightInKg(ingots(1));
  const room = 2.5 * unit;   // the wagon loaded to two and a half ingots short of its limit
  const load = () => { const it = mk('Mace'); return Array.from({ length: Math.floor((WAGON_KG_LIMIT - room) / effectiveUnitWeightInKg(it)) }, () => mk('Mace')); };
  withWagon([cart(), ingots(40)], load(), ({ e, rowOf, click, tabTo }) => {
    const before = totalWeight(e.wagonItems);
    tabTo('Misc');
    click(rowOf('Iron Ingot'), epoch(), { shiftKey: true });
    const moved = e.wagonItems.filter((it) => /Ingot/.test(it.name)).reduce((n, it) => n + it.stackCount, 0);
    assert.equal(moved, Math.floor((WAGON_KG_LIMIT - before) / unit), `what fits went in, and no more: ${moved}`);
    assert.equal(e.items.find((it) => /Ingot/.test(it.name))?.stackCount, 40 - moved, 'the rest stays in the pack');
  });
  const chest = [];
  withWagon([arrows(12)], [], ({ e, rowOf, click }) => {
    click(rowOf('Arrow'), epoch(), { shiftKey: true });
    assert.deepEqual([chest.length, e.items.length], [1, 0], 'into the chest');
  }, { loot: { items: () => chest, storage: true } });
});

// ── the classic window
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const firstSlot = (w, right = false) => w.click(163 + CELL_X + 5, 48 + 5, right);
const classic = (bag, wagon, extra = {}) => {
  const w = new NativeInventoryWindow({ items: () => bag, wagonItems: () => wagon, icons: ICONS, ...extra });
  return w;
};

test('SHIFT-STOW on the classic window: Shift is held as Control is (down edge, up edge, and the pointer\'s own word); Shift and the left button on a pack slot are Remove into the wagon, the whole stack, whatever the mode - no popup on a partial fit; the ground, a right click and no Shift keep DFU\'s click (mutants: the latch never raised, the popup kept, the shift arm on the ground)', () => {
  const bag = [cart(), arrows(10)];
  const wagon = [];
  const w = classic(bag, wagon);
  w.click(226 + 5, 14 + 5);   // the wagon button
  assert.equal(w.usingWagon, true);
  w.mode = 'info';
  w.input('ShiftLeft', { code: 'ShiftLeft', key: 'Shift' });
  assert.equal(w._shiftDown, true, 'the down edge');
  w.keyup('ShiftLeft', { code: 'ShiftLeft', key: 'Shift' });
  assert.equal(w._shiftDown, false, 'the up edge');
  w.hover(10, 10, { shiftKey: true, buttons: 0 });
  assert.equal(w._shiftDown, true, 'the pointer says Shift is down');
  firstSlot(w, true);
  assert.equal(wagon.length, 0, 'a right click is not the gesture');
  assert.ok(w.topBox, '... it is the mode\'s own (Info\'s box)');
  w.click(10, 10);   // the click-anywhere box answers the press
  assert.equal(w.topBox, null);
  firstSlot(w);
  assert.deepEqual(wagon.map((it) => `${it.name}:${it.stackCount}`), ['Arrow:10'], 'Remove, whole, in Info mode');
  assert.equal(w.inputBox, null);
  // a partial fit: the wagon nearly full takes what fits, with no how-many popup
  const iUnit = effectiveUnitWeightInKg(ingots(1));
  const full = Array.from({ length: Math.floor((WAGON_KG_LIMIT - 20.5 * iUnit) / effectiveUnitWeightInKg(mk('Mace'))) }, () => mk('Mace'));
  const bag2 = [ingots(200), cart()];   // the ingots first on the tab (the cart is a misc piece too)
  const w2 = classic(bag2, full);
  w2.click(226 + 5, 14 + 5);
  w2.tab = 'clothing';   // DFU's fourth tab holds the misc pieces (tabAccepts)
  w2.hover(10, 10, { shiftKey: true });
  firstSlot(w2);
  assert.equal(w2.inputBox, null, 'no popup');
  const moved = full.filter((it) => /Ingot/.test(it.name)).reduce((n, it) => n + it.stackCount, 0);
  assert.equal(moved, Math.floor((WAGON_KG_LIMIT - totalWeight(full.filter((it) => !/Ingot/.test(it.name)))) / iUnit), `what fits went, with no popup: ${moved}`);
  assert.equal(bag2.find((it) => /Ingot/.test(it.name))?.stackCount, 200 - moved);
  // the ground: Shift changes nothing - Info mode answers with its info, nothing leaves
  const bag3 = [arrows(4)];
  const w3 = classic(bag3, []);
  w3.mode = 'info';
  w3.hover(10, 10, { shiftKey: true });
  firstSlot(w3);
  assert.equal(bag3.length, 1, 'nothing dropped on the ground');
});

test('SHIFT-STOW on the classic window, the latch\'s edges (AUDIT C3/C4): a HELD Shift\'s repeated down edge never answers a refusal box; a Shift seen before the page lost the keyboard is not trusted after it until a key or the pointer says it again; one Shift let go while the other is held is still Shift; the middle button is not the gesture; the player\'s storage takes it as the wagon does (mutants: the repeat answers the box, the focus loss ignored, one key\'s up clears both, the storage refused)', () => {
  // a full wagon's refusal, and Shift held over it
  const brim = Array.from({ length: Math.ceil(WAGON_KG_LIMIT / effectiveUnitWeightInKg(mk('Mace'))) }, () => mk('Mace'));   // loaded past its limit: nothing more goes in
  const bag = [cart(), mk('Dagger')];
  const w = classic(bag, brim);
  w.click(226 + 5, 14 + 5);
  w.mode = 'info';
  w.input('ShiftLeft', { code: 'ShiftLeft', key: 'Shift' });
  firstSlot(w);
  assert.ok(w.topBox, 'the wagon refuses, and says so');
  w.input('ShiftLeft', { code: 'ShiftLeft', key: 'Shift', repeat: true });
  assert.ok(w.topBox, 'the held key\'s repeat does not take the refusal away');
  w.click(10, 10);
  assert.equal(w.topBox, null, 'a press answers it, as it always did');
  // two keys: one let go, the other held
  w.input('ShiftRight', { code: 'ShiftRight', key: 'Shift' });
  w.keyup('ShiftLeft', { code: 'ShiftLeft', key: 'Shift' });
  assert.equal(w._shiftDown, true, 'the right one is still down');
  w.keyup('ShiftRight', { code: 'ShiftRight', key: 'Shift' });
  assert.equal(w._shiftDown, false);
  // the page loses the keyboard with Shift down and gets it back with no key-up: a click is a plain click
  const bag2 = [cart(), arrows(25)];
  const wagon2 = [];
  const w2 = classic(bag2, wagon2);
  w2.click(226 + 5, 14 + 5);
  w2.mode = 'info';
  w2.input('ShiftLeft', { code: 'ShiftLeft', key: 'Shift' });
  noteFocusLost();
  assert.equal(w2._shiftDown, false, 'not trusted after the loss');
  firstSlot(w2);
  assert.equal(wagon2.length, 0, 'Info, not a deposit');
  if (w2.topBox) w2.click(10, 10);
  w2.hover(10, 10, { shiftKey: true });
  assert.equal(w2._shiftDown, true, 'the pointer says it again');
  // the middle button with Shift is the middle button's
  firstSlot(w2, false);
  assert.equal(wagon2.length, 1, 'the left button stows');
  const bag3 = [cart(), arrows(5)];
  const wagon3 = [];
  const w3 = classic(bag3, wagon3);
  w3.click(226 + 5, 14 + 5);
  w3.mode = 'info';
  w3.hover(10, 10, { shiftKey: true });
  w3.click(163 + CELL_X + 5, 48 + 5, false, true);
  assert.equal(wagon3.length, 0, 'the middle button is not the gesture');
  // the player's own storage
  const chest = [];
  const bag4 = [arrows(9)];
  const w4 = classic(bag4, [], { loot: { items: () => chest, storage: true } });
  w4.mode = 'info';
  w4.hover(10, 10, { shiftKey: true });
  firstSlot(w4);
  assert.deepEqual(chest.map((it) => `${it.name}:${it.stackCount}`), ['Arrow:9'], 'into the chest, whole');
});

test('SHIFT-STOW on the enhanced pack: the card\'s how-many field does not apply - Shift is the whole stack (AUDIT D M3; mutant: the field left standing)', () => {
  withWagon([cart(), arrows(30)], [], ({ e, host, rowOf, click }) => {
    const T = epoch();
    click(rowOf('Arrow'), T);
    const field = host.querySelectorAll('input').find((i) => i.closest('.qtyfield'));
    assert.ok(field, 'the card asks how many');
    field.value = '5'; field.oninput();
    click(rowOf('Arrow'), T + 5000, { shiftKey: true });
    assert.deepEqual(e.wagonItems.map((it) => `${it.name}:${it.stackCount}`), ['Arrow:30'], 'the whole stack, not the five');
  });
});
