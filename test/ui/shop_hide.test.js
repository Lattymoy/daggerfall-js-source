// SHOP-HIDE (2026-10-30, the owner: "I also want to implement a settings toggle that disables the shop interface ingame. Off
// by default"): the Interface tab's Hide the shop, off as the game ships. On, the pause screen draws no shop gem, so the
// shop's window has no door; off again, the gem is back. What the account holds is never touched - the pref is the
// device's (systems/uiPrefs.js). tools/mutants/shop_hide.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../chargenDom.mjs';
import { PREF_DEFAULTS, getPref, setPref } from '../../src/systems/uiPrefs.js';
import { mountEnhancedMenu } from '../../src/ui/enhanced/enhancedMenu.js';

console.warn = () => {};
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The pause face, mounted - and whether its home wears the shop's gem. */
const gemShown = () => {
  const host = globalThis.document.createElement('div');
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: () => {} });
  const n = host.querySelectorAll?.('.px-shopmark')?.length ?? 0;
  menu?.unmount?.();
  return n;
};

test('SHOP-HIDE: off as the game ships - the gem on the pause screen; on, no gem and so no shop; off again, the gem back (mutants: on by default, the pref unread)', () => {
  assert.equal(PREF_DEFAULTS.shopHidden, false, 'off by default');
  setPref('shopHidden', false);
  assert.equal(gemShown(), 1, 'the shop\'s gem');
  setPref('shopHidden', true);
  assert.equal(getPref('shopHidden'), true);
  assert.equal(gemShown(), 0, 'hidden: no gem, no door to the shop');
  setPref('shopHidden', false);
  assert.equal(gemShown(), 1, 'and back');
});

test('SHOP-HIDE: its row on the Interface tab under Shop, its words through the text core (mutants: the row unplaced)', async () => {
  const { whereIs } = await import('../../src/ui/settings/settingsMap.js');
  const at = whereIs('port:shopHidden');
  assert.deepEqual([at?.tab.id, at?.section.id], ['interface', 'shop']);
  const m = rd('src/ui/enhanced/enhancedMenu.js');
  assert.ok(m.includes("out.push(prefRow('shopHidden', t('menu.shop.hide', 'Hide the shop'),"), 'its row, its words through t()');
});
