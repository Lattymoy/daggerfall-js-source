// AUDIT 24 (the full-codebase parity sweep), UI group.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NativeInventoryWindow, INV_RECTS } from '../src/ui/nativeInventory.js';
import { QuestJournalWindow } from '../src/ui/questJournal.js';
import { PlayerHistoryWindow } from '../src/ui/playerHistory.js';
import { LABEL_HIT_HEIGHT, TANDEM_SPACING, LABEL_SPACING } from '../src/systems/specialAdvantages.js';
import { SCREEN_DIM, DEFAULT_SHADOW_COLOR } from '../src/ui/nativePanel.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('audit24 ui: a horse or cart can never be Removed out of the pack', () => {
  // LocalItemListScroller_OnItemClick's Remove arm passes
  // blockTransport=true (DaggerfallInventoryWindow.cs:1999) and
  // TransferItem's FIRST statement returns silently for any
  // ItemGroups.Transportation item (:1460-1462).
  const cart = { group: 'Transportation', templateIndex: 93, name: 'Small cart' };
  const dagger = { group: 'Weapons', templateIndex: 113, name: 'Dagger' };
  const bag = [cart, dagger];
  const ground = [];
  const w = new NativeInventoryWindow({ items: () => bag, remoteItems: () => ground, icons: {} });
  w.mode = 'remove';
  w.tab = 'misc';
  const rows = w._filtered();
  const cartRow = rows.indexOf(cart);
  assert.ok(cartRow >= 0, 'the cart is visible in the ClothingAndMisc tab');
  w._pick(cartRow);
  assert.ok(bag.includes(cart), 'the cart stayed in the pack');
  assert.equal(ground.length, 0, 'and nothing reached the ground pile');
  // ...while an ordinary item still transfers through the same arm
  const daggerRow = w._filtered().indexOf(dagger);
  if (daggerRow >= 0) {
    w._pick(daggerRow);
    assert.equal(bag.includes(dagger), false, 'a dagger transfers as before');
  }
});

test('audit24 ui: the journal counts the formattings the notebook actually emits', () => {
  // SetTextWithListEntries counts Text/TextHighlight/TextAnswer/
  // TextQuestion/NewLine (DaggerfallQuestJournalWindow.cs:658-662).
  // The port spelled the last three with C#'s enum names, which the
  // notebook never produces - it files 'highlight'/'question'/'answer'.
  const entry = [
    { formatting: 'highlight', text: '13 Hearthfire in Daggerfall:' },
    { formatting: 'text', text: 'a note' },
    { formatting: 'question', text: 'Q?' },
    { formatting: 'answer', text: 'A.' },
    { formatting: 'nothing', text: '' },
  ];
  const w = new QuestJournalWindow({ questMessages: () => [], notebook: () => ({ getNotes: () => [entry] }) });
  w.mode = 'notebook';
  const lines = w.pageLines();
  assert.deepEqual(lines.slice(0, 4),
    ['13 Hearthfire in Daggerfall:', 'a note', 'Q?', 'A.']);
});

test('audit24 ui: the journal body shadow is the olive default, and rows advance by an INT', () => {
  // MultiFormatTextLabel never sets ShadowColor, so it keeps
  // DaggerfallDefaultShadowColor = Color32(93, 77, 12) (:37, :232).
  const t = rd('src/ui/questJournal.js');
  assert.match(t, /m\.s \* scale, DEFAULT_SHADOW_COLOR\)/, 'the body shadow is the default olive');
  assert.equal(/m\.s \* scale, \[0, 0, 0, 1\]\)/.test(t), false, 'and no opaque black is left');
  assert.deepEqual(DEFAULT_SHADOW_COLOR, [93 / 255, 77 / 255, 12 / 255, 1]);
  // TextLabel.TextHeight is `(int)(totalHeight * textScale)` (:146-148),
  // so 7 * 0.8 is 5, not 5.6 - the float drifted the 28th row 17px down.
  assert.match(t, /Math\.trunc\(font\.fnt\.fixedHeight \* scale\)/);
  assert.equal(Math.trunc(7 * 0.8), 5);
});

test('audit24 ui: the ScreenDimColor windows paint no letterbox, and the dim is Color.clear', () => {
  assert.deepEqual(SCREEN_DIM, [0, 0, 0, 0], 'DaggerfallPopupWindow.cs:27 - Color.clear');
  for (const f of ['src/ui/nativeInventory.js', 'src/ui/charsheet.js', 'src/ui/nativeTalk.js',
    'src/ui/questJournal.js', 'src/ui/nativeTrade.js']) {
    assert.match(rd(f), /drawScreenDimBackdrop\(renderer, canvas\)/, `${f}: the letterbox is not painted`);
  }
  // the three chargen popups draw the previous window and then assign
  // ScreenDimColor (DaggerfallPopupWindow.cs:80-83) - which paints nothing
  const cg = rd('src/ui/chargenArt.js');
  assert.equal((cg.match(/drawRect\(renderer, m, 0, 0, 320, 200, SCREEN_DIM\)/g) ?? []).length, 3,
    'the class list, class method and biography method screens - dimming with Color.clear');
});

test('audit24 ui: the wagon button clicks ONCE and lights while in use', () => {
  // WagonButton_OnMouseClick plays exactly one ButtonClick, at the end
  // (:1242); ShowWagon(true) sets wagonSelected (:1051).
  const inv = rd('src/ui/nativeInventory.js');
  const wagonFn = inv.slice(inv.indexOf('  _wagon() {'), inv.indexOf('  _dropGold('));
  assert.equal(/playOneShot\(SOUND\.ButtonClick/.test(wagonFn), false,
    '_wagon plays no sound of its own - the click loop already did');
  assert.match(inv, /if \(this\.usingWagon\) \{[\s\S]{0,120}INV_RECTS\.wagon/,
    'the wagon button draws its own selected highlight');
  assert.deepEqual([...INV_RECTS.wagon], [226, 14, 31, 14]);
});

test('audit24 ui: an advantage label is 5px tall, not the 6px row pitch', () => {
  // The handler hangs off the TextLabel (CreateCharSpecialAdvantage
  // Window.cs:264), so the band is font.GlyphHeight - FONT0002's 5.
  assert.equal(LABEL_HIT_HEIGHT, 5);
  assert.equal(TANDEM_SPACING, 6, 'the tandem PITCH is still 6');
  assert.equal(LABEL_SPACING, 8, 'and the single-row pitch 8');
  assert.match(rd('src/ui/chargenArt.js'), /ly < row\.y \+ LABEL_HIT_HEIGHT/);
});

test('audit24 ui: the history wheel pages in silence', () => {
  // NativePanel_OnMouseScrollDown/Up (:97-111) page and re-layout with
  // no PlayOneShot; only the two button handlers sound (:83, :92).
  const t = rd('src/ui/playerHistory.js');
  assert.match(t, /wheel\(dy\) \{ return dy > 0 \? this\.nextPage\(false\) : this\.prevPage\(false\); \}/);
  const lines = Array.from({ length: 60 }, (_, i) => `line ${i}`);
  const w = new PlayerHistoryWindow({ backStory: lines });
  const before = w.pageStartLine;
  assert.equal(w.wheel(1), true, 'the wheel still pages');
  assert.notEqual(w.pageStartLine, before);
});
