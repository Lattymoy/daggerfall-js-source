// CART-FIT (2026-09-27, Discord, "Can't see all items in cart": "My resolution is 1366 x 768. I tried setting the HUD
// to %50, but I still can't see all the items"). The pack and a side window beside it - the wagon, the player's own
// storage - were each clamped to the viewport ALONE (min(1040px, 95vw), min(680px, 94vw)), so side by side they wanted
// 1738 px and at 1366 the wagon's list stood off the right edge of a host that clips. Paired, they share the width.
// The geometry was measured in Chromium (every row of a twelve-item wagon within the viewport at 1366x657, 1366x768,
// 1280x720 and 1024x600; 1920 unchanged; the loot-only window and the phone unchanged); these pins hold the seam.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { withDom } from './invdrag.mjs';
import { ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAGGER = () => { const t = ITEM_TEMPLATES.find((x) => x.name === 'Dagger'); return { name: t.name, templateIndex: t.index, group: 'Weapons', stackCount: 1, currentCondition: 50, maxCondition: 50 }; };
const shellOf = (host) => host.querySelector('.pack-shell');
const paired = (host) => /(^| )paired( |$)/.test(shellOf(host)?.className ?? '');

test('CART-FIT: the pack beside a side window is PAIRED - the wagon and the player\'s storage; a body, and the pack alone, are not', () => {
  const open = (deps) => withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Malarkey', stats: { strength: 50 }, items: [DAGGER()], goldPieces: 0 };
    let view = null;
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => view.unmount(), ...deps });
    const out = { pack: !!host.querySelector('.pack-id'), side: !!host.querySelector('.loot-win'), paired: paired(host) };
    view.unmount();
    return out;
  });
  const wagon = Array.from({ length: 12 }, DAGGER);
  assert.deepEqual(open({ wagonItems: () => wagon, dungeon: { wagonPrompt: true, inside: false } }), { pack: true, side: true, paired: true }, 'the wagon beside the pack');
  assert.deepEqual(open({ loot: { items: () => wagon, storage: true } }), { pack: true, side: true, paired: true }, 'the ship\'s chest beside the pack');
  assert.deepEqual(open({ loot: { items: () => wagon } }), { pack: false, side: true, paired: false }, 'a body: its frame alone, centred as PX20b has it');
  assert.deepEqual(open({}), { pack: true, side: false, paired: false }, 'the pack alone');
});

test('CART-FIT: paired, the two frames share one viewport - the side window one column, the pack what is left; the full pair from 1770 px; the phone keeps its stack', () => {
  const css = rd('src/ui/enhancedStyle.js');
  const narrow = /@media \(min-width: 641px\) \{\n {2}\.pack-shell\.paired \.loot-win, \.pack-shell\.paired \.loot-win\.wide \{ width: 340px; \}\n {2}\.pack-shell\.paired \.loot-win\.wide \.remotelist \{ display: block; \}\n {2}\.pack-shell\.paired \.pack-win \{ width: min\(1040px, calc\(100vw - 32px - 18px - 340px\)\); \}\n\}/;
  assert.match(css, narrow, 'below the full pair: 340 + the 18 px gap + the page\'s margin come off the pack');
  assert.match(css, /@media \(min-width: 1770px\) \{\n {2}\.pack-shell\.paired \.loot-win\.wide \{ width: 680px; \}\n {2}\.pack-shell\.paired \.loot-win\.wide \.remotelist \{ display: grid; \}\n\}/,
    '1040 + 18 + 680 + 32: from there both stand at full size');
  // the unpaired rules stand as they were - the loot window alone is PX21e's
  assert.match(css, /\.loot-win\.wide \{ width: min\(680px, 94vw\); \}/);
  assert.match(css, /\.pack-win \{[^}]*width: min\(1040px, 95vw\)/);
  // the gap the arithmetic subtracts is the shell's own
  assert.match(css, /grid-auto-flow: column; gap: 18px/);
  const src = rd('src/ui/enhancedInventory.js');
  assert.match(src, /if \(packOpen && loot\) shell\.classList\.add\('paired'\);\n {4}if \(packOpen\) shell\.append\(win\);/);
});
