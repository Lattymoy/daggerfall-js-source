// MC1 - THE SPELL ICON PICKER (SpellIconPickerWindow.cs, whole) and
// its two consumers: the spellbook's icon panel and the spell maker's
// icon row. The picker is HOVER-DRIVEN - the selection IS the icon
// under the pointer - and a cancel NULLS it, so the consumer's
// `SelectedIcon != null` arm keeps the old icon.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SpellIconPickerWindow, buildIconPickerLayout, visibleIconPickerItems,
  ICON_PICKER_PANEL_SIZE, ICON_PICKER_SCROLL_PANEL, ICON_PICKER_SCROLLER,
  ICONS_PER_ROW, ICON_PICKER_ICON_SIZE, ICON_SPACING, CLASSIC_ICONS_HEADER,
} from '../src/ui/spellIconPickerWindow.js';
import { SPELL_ICON_COUNT } from '../src/ui/spellIcons.js';
import { SpellbookWindow } from '../src/ui/spellbookWindow.js';
import { SpellMakerWindow, SPELL_MAKER_RECTS } from '../src/ui/spellMakerWindow.js';
import { DEFAULT_SPELL_ICON } from '../src/systems/spellMaker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

// the main panel is centred on the 320x200 virtual screen
const [PX, PY] = [(320 - ICON_PICKER_PANEL_SIZE[0]) / 2, (200 - ICON_PICKER_PANEL_SIZE[1]) / 2];
const [SX, SY] = [ICON_PICKER_SCROLL_PANEL[0], ICON_PICKER_SCROLL_PANEL[1]];
/** native point at the CENTRE of classic icon `i` (unscrolled). */
const iconCenter = (i) => {
  const row = Math.trunc(i / ICONS_PER_ROW), col = i % ICONS_PER_ROW;
  return [PX + SX + 2 + col * ICON_SPACING + 8, PY + SY + 24 + row * ICON_SPACING + 8];
};

// ---------------------------------------------------------------
// 1. THE LAYOUT (AddIconPacks with no packs - the classic section)
// ---------------------------------------------------------------

test('MC1 layout: one header then 69 classic icons, 12 per row at 22 spacing', () => {
  assert.equal(ICONS_PER_ROW, 12);
  assert.equal(ICON_PICKER_ICON_SIZE, 16);
  assert.equal(ICON_SPACING, 22);
  assert.deepEqual([...ICON_PICKER_PANEL_SIZE], [274, 180]);
  assert.deepEqual([...ICON_PICKER_SCROLL_PANEL], [2, 2, 262, 176]);
  assert.deepEqual([...ICON_PICKER_SCROLLER], [265, 2, 8, 176]);
  const { items, scrollSteps } = buildIconPickerLayout();
  assert.equal(items[0].type, 'header');
  // AddHeaderLabel: the label sits at (xpos, ypos + 4) and the F116
  // convention reads `classicIcons` = "Classic" from the pinned CSV
  assert.equal(items[0].text, 'Classic');
  assert.equal(CLASSIC_ICONS_HEADER, 'Classic');
  assert.deepEqual([items[0].x, items[0].y], [2, 6]);
  const icons = items.filter((it) => it.type === 'icon');
  assert.equal(icons.length, SPELL_ICON_COUNT);
  assert.equal(SPELL_ICON_COUNT, 69);
  // the first icon row starts one spacing below the header
  assert.deepEqual([icons[0].x, icons[0].y], [2, 24]);
  assert.deepEqual([icons[11].x, icons[11].y], [2 + 11 * 22, 24], 'twelfth icon ends the row');
  assert.deepEqual([icons[12].x, icons[12].y], [2, 46], 'the thirteenth wraps');
  assert.deepEqual([icons[68].x, icons[68].y], [2 + 8 * 22, 24 + 5 * 22], 'the 69th sits ninth on row six');
  // ScrollSteps = final ypos / spacing + 1 (integer division): 134/22+1
  assert.equal(scrollSteps, 7);
});

test('MC1 layout: ScrollSteps <= DisplayUnits for classic-only content, so the scroll clamp is zero', () => {
  const w = new SpellIconPickerWindow();
  assert.equal(w.displayUnits, Math.trunc(176 / 22));   // scroller.DisplayUnits = InteriorHeight / iconSpacing = 8
  w.wheel(1); w.wheel(1);
  assert.equal(w.scrollIndex, 0, 'VerticalScrollBar clamps to max(0, total - display) = 0 (:187-199)');
  w.wheel(-1);
  assert.equal(w.scrollIndex, 0);
});

test('MC1 scroll: the clamp law holds when content CAN scroll', () => {
  const w = new SpellIconPickerWindow();
  w.scrollSteps = 20;   // a synthetic taller layout
  w.wheel(1);
  assert.equal(w.scrollIndex, 1);
  for (let i = 0; i < 30; i++) w.wheel(1);
  assert.equal(w.scrollIndex, 20 - w.displayUnits, 'clamped to totalUnits - displayUnits');
  for (let i = 0; i < 40; i++) w.wheel(-1);
  assert.equal(w.scrollIndex, 0, 'and to zero below');
  w.scrollIndex = 5;
  w.resetScrollPosition();
  assert.equal(w.scrollIndex, 0, 'ResetScrollPosition (:116-119)');
});

// ---------------------------------------------------------------
// 2. THE SELECTION (UpdateSelectedIcon :218-244)
// ---------------------------------------------------------------

test('MC1 selection: the selection follows the pointer, and resting on none nulls it', () => {
  const w = new SpellIconPickerWindow();
  w.hover(...iconCenter(0));
  assert.deepEqual(w.selectedIcon, { key: null, index: 0 }, 'a null key is DFU\'s classic-fallback tag');
  w.hover(...iconCenter(13));
  assert.deepEqual(w.selectedIcon, { key: null, index: 13 });
  w.hover(...iconCenter(68));
  assert.deepEqual(w.selectedIcon, { key: null, index: 68 });
  // the 22px grid leaves a 6px gutter between 16px icons
  w.hover(PX + SX + 2 + 16 + 3, PY + SY + 24 + 8);
  assert.equal(w.selectedIcon, null, 'the gutter selects nothing');
  w.hover(PX + SX + 2 + 8, PY + SY + 10);
  assert.equal(w.selectedIcon, null, 'the header row is not an icon');
});

test('MC1 selection: the hit test is scroll-adjusted', () => {
  const w = new SpellIconPickerWindow();
  w.scrollSteps = 20;   // let it scroll
  w.wheel(1);           // everything rises one spacing
  const [cx, cy] = iconCenter(13);
  w.hover(cx, cy - ICON_SPACING);
  assert.deepEqual(w.selectedIcon, { key: null, index: 13 }, 'icon 13 now sits one row higher');
  w.hover(...iconCenter(51));
  assert.deepEqual(w.selectedIcon, { key: null, index: 51 + 12 }, 'the unscrolled point now hits the next row down');
});

// ---------------------------------------------------------------
// 3. CLOSE AND CANCEL (:106-110, :269-274)
// ---------------------------------------------------------------

test('MC1 close: a click on an icon closes WITH it; a miss keeps the window up; Escape nulls', () => {
  let got = 'unset';
  let w = new SpellIconPickerWindow({ onClose: (icon) => { got = icon; } });
  assert.equal(w.click(PX + 1, PY + 1), true, 'the picker is modal - every click is consumed');
  assert.equal(got, 'unset', 'a miss does not close (:272-273)');
  assert.equal(w.closed, false);
  w.click(...iconCenter(42));
  assert.deepEqual(got, { key: null, index: 42 });
  assert.equal(w.closed, true);
  // CancelWindow: selection nulled FIRST, so the consumer keeps the old icon
  got = 'unset';
  w = new SpellIconPickerWindow({ onClose: (icon) => { got = icon; } });
  w.hover(...iconCenter(3));   // a live selection to prove the null overrides it
  w.input('Escape');
  assert.equal(got, null);
  assert.equal(w.closed, true);
});

// ---------------------------------------------------------------
// 4. THE CLIP QUIRK (ScrollingPanel.Draw :326-348)
// ---------------------------------------------------------------

test('MC1 clip: an item draws only when its adjusted top-left point is inside the panel', () => {
  const { items } = buildIconPickerLayout();
  assert.equal(visibleIconPickerItems(items, 0).length, items.length, 'everything fits unscrolled');
  const up1 = visibleIconPickerItems(items, 1);
  assert.equal(up1.some((it) => it.type === 'header'), false, 'the header scrolls off first (y 6 - 22 < 2)');
  assert.equal(up1.filter((it) => it.type === 'icon').length, 69,
    'the first icon row lands exactly on the panel origin (24 - 22 = 2, inclusive)');
  const up2 = visibleIconPickerItems(items, 2);
  assert.equal(up2.filter((it) => it.type === 'icon').length, 69 - 12, 'row one is gone at two steps');
  // the point law, not an intersection law: an icon whose top-left is
  // one short of the bottom edge still "draws" though its body hangs out
  assert.equal(visibleIconPickerItems([{ type: 'icon', index: 0, x: 2, y: 177 }], 0).length, 1);
  assert.equal(visibleIconPickerItems([{ type: 'icon', index: 0, x: 2, y: 178 }], 0).length, 0, 'the edge is exclusive');
});

// ---------------------------------------------------------------
// 5. THE SPELLBOOK CONSUMER (:954-974)
// ---------------------------------------------------------------

function bookRig() {
  const entity = { spells: [{ name: 'Frostbite', icon: 2, cost: 5 }], items: [] };
  const w = new SpellbookWindow({
    spells: () => entity.spells,
    entity,
    castCost: (sp) => sp.cost,
    rows: () => [],
  });
  w.refreshSpellsList?.();
  w.selectedIndex = 0;
  return { entity, w };
}

test('MC1 spellbook: a pick writes the icon onto a COPY marked custom; a cancel keeps the old', () => {
  const { entity, w } = bookRig();
  const original = entity.spells[0];
  w._openIconPicker();
  assert.equal(w.top, 'iconPicker');
  w.click(...iconCenter(7));   // routed through the book to the picker
  assert.equal(w.top, null, 'the picker closed and unmounted');
  assert.equal(w._iconPicker, null);
  assert.equal(entity.spells[0].icon, 7);
  assert.equal(entity.spells[0].custom, true, 'the copy persists whole in the save (the rename law)');
  assert.notEqual(entity.spells[0], original, 'SetSpell writes a copy - the shared record is untouched');
  assert.equal(original.icon, 2);
  // cancel: Escape through the book's input router
  w._openIconPicker();
  w.input('Escape');
  assert.equal(w.top, null);
  assert.equal(entity.spells[0].icon, 7, 'a null SelectedIcon changes nothing (:966-967)');
});

test('MC1 spellbook: the icon panel click opens the picker in cast mode (the buy-mode gate stands)', () => {
  const s = src('ui/spellbookWindow.js');
  assert.match(s, /if \(hitPanel\(SPELLBOOK_RECTS\.spellIcon, vx, vy\)\) \{\n\s+\/\/ MC1: SpellIconPanel_OnMouseClick pushes the picker \(:954-958\)\n\s+this\._click\(\);\n\s+this\._openIconPicker\(\);/,
    'the panel click pushes the picker');
  assert.equal(/The icon picker is not built yet/.test(s), false, 'the placeholder note is gone');
  // the modal routing reaches all four surfaces
  for (const re of [/if \(this\.top === 'iconPicker'\) return this\._iconPicker\?\.click\(vx, vy\) \?\? true;/,
    /if \(this\.top === 'iconPicker'\) \{ this\._iconPicker\?\.hover\(vx, vy\); return; \}/,
    /if \(this\.top === 'iconPicker'\) \{ this\._iconPicker\?\.wheel\(dir\); return; \}/,
    /if \(this\.top === 'iconPicker'\) \{ this\._iconPicker\?\.input\(code\); return; \}/]) {
    assert.match(s, re);
  }
});

// ---------------------------------------------------------------
// 6. THE SPELL MAKER CONSUMER (:894-898, :875-892, :1013-1017)
//
// ROAD-E E8: the maker is DFU's own art now, so its three icon
// controls are the rects DFU declares - selectIcon (288,94,16,16)
// pushes the picker, and nextIcon (275,80,9,16) / previousIcon
// (275,96,9,16) are the wrap cycle. The picker itself did not change.
// ---------------------------------------------------------------

const makerRig = () => new SpellMakerWindow({ entity: { items: [], spells: [] } });
const pressMaker = (w, key) => { const [x, y] = SPELL_MAKER_RECTS[key]; w.click(x + 1, y + 1); return w; };

test('MC1 maker: the icon well pushes the picker; the pick lands on this.icon', () => {
  const w = makerRig();
  pressMaker(w, 'selectIcon');
  assert.ok(w.picker instanceof SpellIconPickerWindow);
  w.click(...iconCenter(31));   // the host's pointer route, forwarded
  assert.equal(w.picker, null);
  assert.equal(w.icon, 31);
  // cancel keeps the icon
  pressMaker(w, 'selectIcon');
  w.input('Escape');
  assert.equal(w.picker, null);
  assert.equal(w.icon, 31, 'a null pick keeps the icon (:1015-1016)');
});

test('MC1 maker: the two arrows are the Next/PreviousIconButton wrap cycle over the classic 69', () => {
  const w = makerRig();
  assert.equal(w.icon, DEFAULT_SPELL_ICON);
  pressMaker(w, 'previousIcon');
  pressMaker(w, 'previousIcon');
  assert.equal(w.icon, (DEFAULT_SPELL_ICON - 2 + SPELL_ICON_COUNT) % SPELL_ICON_COUNT, 'previous wraps below zero (:900-908)');
  for (let i = 0; i < SPELL_ICON_COUNT; i++) pressMaker(w, 'nextIcon');
  assert.equal(w.icon, (DEFAULT_SPELL_ICON - 2 + SPELL_ICON_COUNT) % SPELL_ICON_COUNT, 'a full cycle returns home');
});

test('MC1 maker: the bought spell carries the picked icon', () => {
  const w = makerRig();
  pressMaker(w, 'selectIcon');
  w.click(...iconCenter(55));
  assert.equal(w.icon, 55);
  // buildCustomSpell reads this.icon (:232's shape) - pinned at the source
  assert.match(src('ui/spellMakerWindow.js'), /name: this\.name\.trim\(\), icon: this\.icon,/);
});
