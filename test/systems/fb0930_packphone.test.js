// FIELD BUGS 2026-09-30 (PACK-PHONE) - "Still can't use my bag/Inventory on mobile" - "Mobile trully is a mess to work
// with huh?", the screenshots the Enhanced Plus pack on a phone, the paperdoll filling the view and the item list out of
// reach; "I would also love to see this fixed"; "we dont really need paperdoll on phone or at least if it could be
// hidden".
//
// The stacked pack (under the 1000px column layout) held its character region at its content's height in a window
// capped at 660px, and the dock took what was left. With the doll's art there was nothing left: the doll's cell is
// height-driven in a map whose rows are auto, a height that resolves to nothing, so the sprite stood at its 4x bitmap
// size. Measured in Chromium on the real pack with a 440x736 figure standing in for the art: a phone on its side
// (915x412) had a 0px list and none of its five tiles could be tapped; upright (412x915) the worn panels' columns came
// to 0px and the list to 8px; a tablet upright and a 900px mouse window read 0px too. The layout is a MEDIA QUERY and
// node cannot see one, so this pins the rules and their conditions on the real sheet and the Body switch's wiring on
// the pack's own fake document; tools/enhancedPackLayoutProbe.mjs measures them in a browser.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withDom } from '../invdrag.mjs';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { getPref, setPref, PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { ONLINE_PLAYERS_OWN_PREFS, ONLINE_FORCED_PREFS } from '../../src/systems/online/onlineLane.js';
import { equipItem, isEquipped } from '../../src/systems/equip.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';

const css = readFileSync(new URL('../../src/ui/enhanced/enhancedStyle.js', import.meta.url), 'utf8');
const STACKED = '@media (max-width: 999px) {';
const PHONE = '@media (pointer: coarse) and (hover: none) and (max-width: 640px), (pointer: coarse) and (hover: none) and (max-height: 540px) {';
const SIDE = '@media (pointer: coarse) and (hover: none) and (orientation: landscape) and (max-height: 540px) {';
/** A media block of the sheet, whole: its head to the brace that closes it at the line's start. */
const block = (head) => {
  const at = css.indexOf(head);
  assert.ok(at > 0, `the block is gone: ${head}`);
  assert.equal(css.indexOf(head, at + 1), -1, `one block: ${head}`);
  return { at, text: css.slice(at, css.indexOf('\n}\n', at)) };
};
const WIDE = css.indexOf('@media (min-width: 1000px) {\n  .pack-shell .pack { display: grid;');

test('PACK-PHONE: under the column layout the character region gives way and scrolls on its own, the dock keeps at least 45% of the pack whatever it holds, and the doll is capped - whatever the pointer; the title gives way before Close does (mutants: the region fixed at its content; the region clipped, not scrolled; the dock sized by its items; no floor under the dock; the column clipping the region; the column widening the region; the map shrunk to fit; the doll at its bitmap size; Close pushed off the screen)', () => {
  const { at, text } = block(STACKED);
  assert.ok(WIDE > 0 && at > WIDE, 'the stacked departure stands after the wide one (PX31), whose complement it is');
  assert.match(text, /\n {2}\.pack-shell \.pack-id > div \{ min-width: 0; overflow: hidden; \}/, 'the title gives way');
  assert.match(text, /\n {2}\.pack-shell \.pack-main \{ flex: 0 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; \}/,
    'the region shrinks (PX22 held it at 0 0 auto) and is a scroll box of its own');
  assert.match(text, /\n {2}\.pack-shell \.pack-dock \{ flex: 1 1 0; min-height: 45%; \}/,
    'the dock grows from nothing, so the ITEM COUNT never sizes it, and never takes less than 45%');
  assert.match(text, /\n {2}\.pack-shell \.charcol \{ overflow: visible; min-width: 0; \}/,
    'the column holds its content inside the region\'s scroll, and never widens the region past the screen');
  assert.match(text, /\n {2}\.pack-shell \.charcol \.equipped \{ flex: 0 0 auto; \}/, 'and the map does not shrink to fit it');
  assert.match(text, /\n {2}\.pack-shell \.charcol \.wornmap-doll\.hasart \{ height: min\(34dvh, 240px\); \}/,
    'a third of the screen and never past the 660px window\'s region - the side columns keep their width');
  // the cap outranks the base doll rule (height 100% of an auto row: nothing, so the bitmap's own 736px)
  assert.match(css, /\n\.pack-shell \.wornmap-doll\.hasart \{ aspect-ratio: 110 \/ 184; height: 100%; width: auto;/);
  // PX22's desk layout is untouched: the region its content's height, the dock the remainder
  assert.match(css, /\n\.pack-shell \.pack-main \{ flex: 0 0 auto;/);
  assert.match(css, /\n\.pack-shell \.pack-dock \{ flex: 1 1 auto; min-height: 100px;/);
});

test('PACK-PHONE: on a touch phone - TI3\'s pair, upright under 641px or on its side under 541px tall - the body hides until the header\'s Body shows it, the worn panels take the width and keep every act, the overall figure goes with the body it heads, and the tab strip is one row that scrolls sideways (mutants: the phone on its side missed; a tablet taken for a phone; the body always hidden; the panels keeping the doll\'s column; no Body button; the Body button on the desk; the header\'s buttons at LAYOUT1\'s width; the name uncut; the three-by-three strip)', () => {
  const { at, text } = block(PHONE);
  assert.ok(at > block(STACKED).at, 'after the stacked rules it builds on');
  assert.match(text, /\n {2}\.pack-shell:not\(\.showdoll\) \.wornmap-doll, \.pack-shell:not\(\.showdoll\) \.wornmap \.wornac-total, \.pack-shell:not\(\.showdoll\) \.wornmap \.worntemp-total \{ display: none; \}/,
    'the doll (art or the Avatar plaque) and the overall figure at its head - and TEMP-UI\'s felt temperature beside it - until Body');   // PIN MOVED (TEMP-UI)
  assert.match(text, /\n {2}\.pack-shell:not\(\.showdoll\) \.charcol \.wornmap \{ grid-template-columns: minmax\(0, 1fr\) 0 minmax\(0, 1fr\); column-gap: 6px; \}/,
    'the doll\'s column closes up');
  // NOTHING WORN GOES OUT OF REACH: the rule names the doll and the plaque, never a panel, a socket or the shelf
  for (const line of text.split('\n').filter((l) => /display: none/.test(l))) {
    assert.doesNotMatch(line, /wornrow|wornpair|wornsock|wornshelf|\.wornac[^-]/, `a worn control hidden: ${line.trim()}`);
  }
  assert.match(text, /\n {2}\.pack-shell \.pack-id \.dolltoggle \{ display: inline-block; \}/, 'the Body button, on a phone');
  assert.match(text, /\n {2}\.pack-shell \.pack-id h2::before \{ display: none; \}/, 'the title\'s ornament gives its 62px to the name');
  assert.match(text, /\n {2}\.pack-shell \.pack-id \.pack-who \{ min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; \}/,
    'and the name cuts to an ellipsis');
  assert.match(text, /\n {2}\.pack-shell \.pack-id \.act \{ min-width: 64px; padding: 8px 10px; letter-spacing: 0\.06em; \}/,
    'Body and Close a card\'s 64px, not LAYOUT1\'s 104');
  assert.match(text, /\n {2}\.pack-shell \.pack-dock \.packcats \.packtabs \{ display: flex; flex-wrap: nowrap; overflow-x: auto; \}/,
    'one row of tabs (the nine pages\' three-by-three is 110px of a phone\'s dock)');
  assert.match(text, /\n {2}\.pack-shell \.pack-dock \.packtab \{ flex: 0 0 auto; \}/);
  // everywhere else the button is not drawn - the desk and a tablet keep the figure
  const base = css.indexOf('\n.pack-shell .pack-id .dolltoggle { display: none;');
  assert.ok(base > 0 && base < at, 'the Body button is hidden outside the phone rule, before it');
  assert.equal(css.lastIndexOf('@media', base) < css.lastIndexOf('}\n', base), true, 'and that rule stands in no media block');
});

test('PACK-PHONE: a touch phone on its side is two columns, the region beside the dock, each the pack\'s whole height (mutants: the side stacked; its row the content\'s)', () => {
  const { at, text } = block(SIDE);
  assert.ok(at > block(PHONE).at, 'after the rules it overrides');
  assert.match(text, /\n {2}\.pack-shell \.pack \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\); grid-template-rows: minmax\(0, 1fr\); \}/,
    'one row, the height\'s - the old phone rule\'s grid-auto-rows min-content reaches this grid under 861px');
  assert.match(text, /\n {2}\.pack-shell \.pack-main \{ min-width: 0; \}/);
  assert.match(text, /\n {2}\.pack-shell \.pack-dock \{ min-height: 0; border-top: 0; border-left: 2px solid rgba\(125,116,96,0\.35\); \}/,
    'the floor is the stacked dock\'s; a column has the whole height');
});

test('PACK-PHONE: U53\'s phone order rule is gone - since PX19f the region and the list are no children of .pack, so it ordered nothing (mutant: the dead rule back)', () => {
  assert.doesNotMatch(css, /\.pack \.charcol \{ order: 2; \}/);
  assert.doesNotMatch(css, /\.pack \.packlists \{ order: 1; \}/);
});

test('PACK-PHONE: the Body switch - hidden by default, the header\'s button beside Close says which, a press shows the body and the choice is remembered on the player\'s own shelf, never the room\'s; with the body hidden a worn piece is still a tap from its card and its Take off (mutants: the choice never drawn; the choice forgotten; the body shown by default; the lane never told)', () => {
  assert.equal(PREF_DEFAULTS.packPhoneDoll, false, 'a phone opens on the panels and the list');
  assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes('packPhoneDoll') && !Object.hasOwn(ONLINE_FORCED_PREFS, 'packPhoneDoll'),
    'what THIS screen draws - the player\'s online too');
  setPref('packPhoneDoll', false);
  withDom((dom) => {
    const e = { isPlayer: true, name: 'Vaelkistae', career: { name: 'Spellsword' }, level: 3,
      stats: { strength: 50, endurance: 48, agility: 50, speed: 50, luck: 50, willpower: 50, intelligence: 50, personality: 50 },
      skills: new Array(35).fill(30), activeEffects: [], spells: [], items: [], goldPieces: 0 };
    const cloak = mintCondition(setItemFields({ group: 'MensClothing', templateIndex: 154 }));
    e.items.push(cloak); equipItem(e, cloak);
    const host = dom.mk('div');
    dom.body.append(host);
    const was = globalThis.window;
    globalThis.window = { innerWidth: dom.w, innerHeight: dom.h, getComputedStyle: () => ({ position: 'absolute' }) };
    let view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    try {
      const shell = () => host.querySelector('.pack-shell');
      const btn = () => host.querySelector('.pack-id').querySelector('.dolltoggle');
      const acts = () => host.querySelector('.pack-id').children.filter((n) => n.tagName === 'BUTTON').map((n) => n.textContent);
      assert.deepEqual(acts(), ['Codex', 'Body', 'Close'], 'Body stands before Close in the header (PIN MOVED, LOOT10: the Codex before it, while the loot rarity row is on)');
      assert.equal(shell().classList.contains('showdoll'), false, 'hidden by default');
      assert.equal(btn().getAttribute('aria-pressed'), 'false');
      assert.equal(btn().type, 'button');
      btn().onclick();
      assert.equal(getPref('packPhoneDoll'), true, 'the choice is on the shelf');
      assert.equal(shell().classList.contains('showdoll'), true, 'and drawn at once');
      assert.deepEqual(acts(), ['Codex', 'Hide body', 'Close']);
      assert.equal(btn().getAttribute('aria-pressed'), 'true');
      // a pack opened later opens as it was left
      view.unmount();
      view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
      assert.equal(shell().classList.contains('showdoll'), true, 'remembered');
      btn().onclick();
      assert.equal(getPref('packPhoneDoll'), false);
      assert.equal(shell().classList.contains('showdoll'), false);
      // the body hidden: the cloak's panel is a button still, its tap the card, the card's first act Take off
      const panel = host.querySelectorAll('.wornrow').find((n) => n.querySelector('.wornslot')?.textContent === 'Cloaks');
      assert.equal(panel?.tagName, 'BUTTON', 'the worn panel is a control with the body hidden');
      panel.onclick({});
      const off = host.querySelector('.packtip').querySelectorAll('button').find((b) => b.textContent === 'Take off');
      assert.ok(off, 'the card offers Take off');
      off.onclick();
      assert.equal(isEquipped(cloak), false, 'and takes it off');
    } finally {
      view.unmount();
      globalThis.window = was;
      setPref('packPhoneDoll', false);
    }
  });
});
