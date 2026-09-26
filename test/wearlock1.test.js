// WEAR-UI + DBLEQUIP + LOCK1 (2026-09-26, the players: "can you give us durability bars inside the inventory also?
// same way they are visible on hotbar, so we dont need to mouse-over that much, especially us loot goblins";
// "Double click to equip/unequip"; "A way to lock/favorite items"). The pack is MOUNTED on the fake document
// (test/invdrag.mjs) and clicked - the bar counted, the pair timed, the lock refused - and the two trade windows'
// halves are source pins, and say so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withDom } from './invdrag.mjs';
import {
  mountEnhancedInventory, wearPct, wearBar, WEAR_WORN_PCT, DOUBLE_CLICK_MS, markItemFrame,
} from '../src/ui/enhancedInventory.js';
import { ITEM_TEMPLATES } from '../src/characters/paperdoll.js';
import { equipItem, isEquipped } from '../src/systems/equip.js';
import { isLocked, setLocked, toggleLocked, lockRefuses, lockedText, LOCK_CLOSES, LOCKED_LINE } from '../src/systems/itemLock.js';
import { ITEM_FIELDS, validItemField } from '../src/systems/itemFields.js';
import { ITEM_FRAME_CSS, LOCK_GLYPH_SVG } from '../src/ui/enhancedPlusStyle.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const tmpl = (name) => ITEM_TEMPLATES.find((t) => t.name === name);
/** A piece at `pct` of its condition. */
const mk = (name, group = 'Weapons', pct = 100, extra = {}) => {
  const t = tmpl(name);
  assert.ok(t, `${name} is not a template in this build`);
  const max = t.hitPoints ?? 50;
  return { name: t.name, templateIndex: t.index, group, stackCount: 1, currentCondition: Math.round(max * pct / 100), maxCondition: max, ...extra };
};
const hero = (items) => ({ name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items, goldPieces: 10 });
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
const byClass = (n, cls) => (n.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...byClass(c, cls)]);

/** The pack, mounted over the ground (the pane's own default remote), under the enhanced skin. */
function withPack(items, fn) {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = hero(items);
    const dropped = [];
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: (it) => dropped.push(it) });
    const rowOf = (name) => host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(name)) ?? null;
    const wornOf = (name) => host.querySelectorAll('.wornrow').find((r) => textOf(r).includes(name)) ?? null;
    const actOf = (label) => host.querySelectorAll('.act').find((b) => b.textContent === label) ?? null;
    /** Turn the pack to a page (PX31: it opens on Weapons; a gem is a Valuable). */
    const page = (word) => host.querySelectorAll('.packtab').find((t) => textOf(t).toLowerCase().includes(word))?.onclick();
    try { return fn({ dom, host, e, view, dropped, rowOf, wornOf, actOf, page }); } finally { view.unmount(); }
  });
}

// ── WEAR-UI ────────────────────────────────────────────────────────

test('WEAR-UI which pieces wear a bar: a weapon, armour and a light, by the share of their condition left (clamped, a broken one 0); never a gem, a book, ammunition or a piece with no condition; red under the hotbar\'s own 40 (mutants: every piece barred, the arrow barred, the line moved off the HUD\'s)', () => {
  assert.equal(wearPct(mk('Longsword', 'Weapons', 72)), 72);
  assert.equal(wearPct(mk('Cuirass', 'Armor', 55)), 55);
  assert.equal(wearPct(mk('Buckler', 'Armor', 100)), 100, 'a shield is armour');
  assert.equal(wearPct(mk('Torch', 'UselessItems2', 40)), 40, 'a light: what is left to burn');
  assert.equal(wearPct(mk('Katana', 'Weapons', 0)), 0, 'broken');
  assert.equal(wearPct({ ...mk('Mace'), currentCondition: 999 }), 100, 'clamped');
  assert.equal(wearPct(mk('Ruby', 'Gems')), null, 'every template carries hit points - a gem shows none');
  assert.equal(wearPct(mk('Arrow', 'Weapons')), null, 'an arrow is spent, not worn');
  assert.equal(wearPct({ ...mk('Dagger'), maxCondition: 0 }), null);
  assert.equal(wearPct(null), null);
  assert.equal(WEAR_WORN_PCT, 40);
  assert.equal(Number(/export const QUICK_WORN_PCT = (\d+);/.exec(read('src/ui/enhancedHud.js'))[1]), WEAR_WORN_PCT, 'the diamond\'s line and the pack\'s are one');
  assert.match(read('src/ui/enhancedHotbar.js'), /n\.classList\.toggle\('hb-worn', pct < 40\);/, 'and the hotbar\'s');
});

test('WEAR-UI the bar: green, red under the line, a blood track when broken, its fill the share - and the pack draws it on every picture of a worn piece (grid, worn panel) and none on a gem; the sheet paints it and lifts the tier\'s pips over it (mutants: no bar on the grid, no bar on the body, the broken track unmarked)', () => {
  withDom(() => {
    const ok = wearBar(mk('Mace', 'Weapons', 88));
    assert.equal(ok.className, 'wear');
    assert.equal(ok.children[0].style.width, '88%');
    assert.equal(wearBar(mk('Dagger', 'Weapons', 31)).className, 'wear worn');
    assert.equal(wearBar(mk('Katana', 'Weapons', 0)).className, 'wear worn broken');
    assert.equal(wearBar(mk('Ruby', 'Gems')), null);
  });
  const sword = mk('Longsword', 'Weapons', 72);
  withPack([sword, mk('Dagger', 'Weapons', 31), mk('Ruby', 'Gems'), mk('Helm', 'Armor', 18)], ({ e, rowOf, wornOf, view }) => {
    const dagger = rowOf('Dagger');
    assert.ok(dagger.classList.contains('hasbar'), 'the row is marked, so the sheet lifts what shares the foot');
    const bar = byClass(dagger, 'wear')[0];
    assert.ok(bar && bar.parent.classList.contains('tile'), 'inside the picture');
    assert.equal(bar.className, 'wear worn');
    equipItem(e, e.items[3]);
    view.repaint();
    const helm = wornOf('Helm');
    assert.ok(helm, 'the helm is on the body');
    assert.equal(byClass(helm, 'wear')[0]?.className, 'wear worn', 'the worn panel carries it too');
  });
  withPack([mk('Ruby', 'Gems')], ({ rowOf, page }) => {
    page('valuables');
    assert.ok(rowOf('Ruby'), 'the gem\'s page');
    assert.equal(byClass(rowOf('Ruby'), 'wear').length, 0);
    assert.equal(rowOf('Ruby').classList.contains('hasbar'), false);
  });
  assert.match(ITEM_FRAME_CSS, /\.pack-shell \.wear, \.trade-shell \.wear, \.ptrade-shell \.wear \{ position: absolute;[^}]*height: 3px;/);
  assert.match(ITEM_FRAME_CSS, /\.pack-shell \.wear\.worn > i[^{]*\{ background: linear-gradient\(180deg, #f5bdb4 0 1px, #d98074 1px\); \}/, 'the hotbar\'s red');
  assert.match(ITEM_FRAME_CSS, /\.pack-shell \.wear\.broken[^{]*\{ background: rgba\(122,29,22,0\.9\); \}/);
  assert.match(ITEM_FRAME_CSS, /\.pack-shell \.pack-dock \.itemrow\.hasbar\[data-rarity\]::before \{ bottom: 6px; \}/);
  // the shop and the player trade draw it through the pack's one helper (source pins)
  for (const f of ['src/ui/enhancedTrade.js', 'src/ui/enhancedPlayerTrade.js']) {
    assert.match(read(f), /const bar = wearBar\(item\);[^\n]*\n\s+if \(bar\) \{ tile\.append\(bar\); (row|b)\.classList\.add\('hasbar'\); \}/, f);
  }
});

// ── DBLEQUIP ───────────────────────────────────────────────────────

test('DBLEQUIP a second click on the same piece inside DOUBLE_CLICK_MS wears it, and on a worn panel takes it off; one click, two slow clicks, two key presses and a book\'s pair stay picks (mutants: the pair unguarded by the clock, a key press pairing, a single click undressing, a potion drunk by the pair)', () => {
  assert.equal(DOUBLE_CLICK_MS, 500);
  assert.match(read('src/ui/enhancedTrade.js'), /const DOUBLE_CLICK_MS = 500;/, 'the shop\'s own pair');
  const mace = mk('Mace'), dagger = mk('Dagger'), book = mk('Book', 'Books');
  withPack([mace, dagger, book], ({ rowOf, wornOf, e, page }) => {
    const click = (node, at, detail = 1) => node.onclick({ timeStamp: at, detail });
    click(rowOf('Mace'), 1000);
    assert.equal(isEquipped(mace), false, 'one click picks');
    click(rowOf('Mace'), 1000 + DOUBLE_CLICK_MS - 20, 2);
    assert.equal(isEquipped(mace), true, 'the pair wears it');
    click(rowOf('Dagger'), 5000); click(rowOf('Dagger'), 5000 + DOUBLE_CLICK_MS + 50);
    assert.equal(isEquipped(dagger), false, 'two slow clicks are two picks');
    click(rowOf('Dagger'), 9000, 0); click(rowOf('Dagger'), 9100, 0);
    assert.equal(isEquipped(dagger), false, 'a key press has no pointer behind it and never pairs');
    page('books');
    click(rowOf('Book'), 12000); click(rowOf('Book'), 12100, 2);
    assert.ok(e.items.includes(book) && !isEquipped(book), 'nothing wears a book, and a pair never READS one: two picks');
    // the body: one click selects, the pair takes off
    click(wornOf('Mace'), 20000);
    assert.equal(isEquipped(mace), true, 'the mis-click law: a single click never undresses');
    click(wornOf('Mace'), 20200, 2);
    assert.equal(isEquipped(mace), false, 'the worn panel\'s pair takes it off');
  });
  const src = read('src/ui/enhancedInventory.js');
  const body = src.slice(src.indexOf('function equipByDoubleClick('), src.indexOf('function equipByDoubleClick(') + 400);
  assert.match(body, /dropOnBody\(item\)/, 'the body\'s own act');
  assert.doesNotMatch(body, /\buse\(/, 'never a use');
});

// ── LOCK1 ──────────────────────────────────────────────────────────

test('LOCK1 the law: one flag, absent when unlocked; it closes the ground, the counter and a trade and nothing else; a declared bool field (mutants: unlocked written as false, the wagon closed, a lock that sells)', () => {
  const it = mk('Dagger');
  assert.equal(isLocked(it), false);
  assert.equal(setLocked(it, true), true);
  assert.equal(it.locked, true);
  assert.equal(toggleLocked(it), false);
  assert.equal('locked' in it, false, 'unlocked is the field absent - a save with nothing locked carries not a byte more');
  assert.equal(setLocked(null, true), false);
  assert.deepEqual([...LOCK_CLOSES], ['drop', 'sell', 'trade']);
  setLocked(it, true);
  for (const way of ['drop', 'sell', 'trade']) assert.equal(lockRefuses(it, way), true, way);
  for (const way of ['stow', 'wear', 'use', 'repair']) assert.equal(lockRefuses(it, way), false, way);
  assert.equal(lockRefuses(mk('Mace'), 'sell'), false);
  assert.equal(lockedText('Iron Dagger'), 'Iron Dagger is locked. Unlock it first.');
  assert.equal(ITEM_FIELDS.locked.kind, 'bool');
  assert.equal(validItemField('locked', true), true);
  assert.equal(validItemField('locked', 'yes'), undefined, 'a forged lock is no item');
});

test('LOCK1 the pack: Lock on the card locks it (the padlock on the tile, the line on the card, Unlock offered); a locked piece is not dropped - it says why - and dropped again once unlocked; the shop will not stage it for sale and the trade will not hold it out (source pins) (mutants: the drop unguarded, the padlock never marked, the sale unguarded)', () => {
  const dagger = mk('Dagger', 'Weapons', 50);
  withPack([dagger, mk('Mace')], ({ rowOf, actOf, host, e, dropped }) => {
    rowOf('Dagger').onclick({ timeStamp: 100, detail: 1 });   // picked: the card and its acts
    assert.ok(actOf('Lock'), 'the card offers the lock');
    actOf('Lock').onclick();
    assert.equal(isLocked(dagger), true);
    assert.equal(rowOf('Dagger').dataset.locked, '', 'the tile wears the padlock');
    assert.equal(rowOf('Mace').dataset.locked, undefined);
    assert.ok(host.querySelectorAll('.lockline').some((n) => n.textContent === LOCKED_LINE), 'the card says it in words');
    assert.ok(actOf('Unlock'));
    actOf('Drop').onclick();
    assert.ok(e.items.includes(dagger) && !dropped.includes(dagger), 'a locked piece stays in the pack');
    actOf('Unlock').onclick();
    assert.equal(isLocked(dagger), false);
    rowOf('Dagger').onclick({ timeStamp: 5000, detail: 1 });
    if (!actOf('Drop')) rowOf('Dagger').onclick({ timeStamp: 9000, detail: 1 });
    actOf('Drop').onclick();
    assert.equal(e.items.includes(dagger), false, 'unlocked, it goes');
  });
  withDom(() => {
    const it = mk('Dagger');
    assert.equal(markItemFrame({ dataset: {} }, it).dataset.locked, undefined);
    setLocked(it, true);
    assert.equal(markItemFrame({ dataset: {} }, it).dataset.locked, '');
  });
  const trade = read('src/ui/enhancedTrade.js');
  assert.match(trade, /function refuseTransfer\(item\) \{\n[^\n]*\n\s+if \(selling\(\) && lockRefuses\(item, 'sell'\)\) \{/, 'the counter refuses a sale, and only a sale');
  assert.match(read('src/ui/enhancedPlayerTrade.js'), /if \(lockRefuses\(item, 'trade'\)\) \{ say\(lockedText\(itemLine\(item, deps\.entity\)\.name\)\); render\(\); return; \}/);
  assert.match(ITEM_FRAME_CSS, /\.pack-shell \[data-locked\] \.tile::before, \.trade-shell \[data-locked\] \.tile::before, \.ptrade-shell \[data-locked\] \.tile::before \{/);
  assert.match(ITEM_FRAME_CSS, /\.pack-shell \.hasbar\[data-locked\] \.tile::before \{ bottom: 6px; \}/, 'above the bar\'s end');
  assert.match(LOCK_GLYPH_SVG, /shape-rendering='crispEdges'/);
  assert.match(LOCK_GLYPH_SVG, /stroke='#050608' stroke-width='2' paint-order='stroke'/, 'the outline drawn in');
});
