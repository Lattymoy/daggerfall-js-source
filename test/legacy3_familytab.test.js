// LEGACY3 (2026-10-05, Mac: "I say implement it into the pause menu as a new tab"): THE FAMILY TAB - drawn in the
// pause window between Holdings and System while Project Legacy is on, and never while it is off: a landing on it
// then lands on System (bible/06-Systems/Legacy-Arc.md section 11). Driven through the mounted screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass, text } from './chargenDom.mjs';
import { mountEnhancedMenu } from '../src/ui/enhancedMenu.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { LEGACY_MOD } from '../src/systems/legacy/family.js';

console.warn = () => {};

/** The pause window's tabs, as drawn: each label and whether it is the one open. */
function tabsOf(at) {
  const host = globalThis.document.createElement('div');
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: () => {}, at });
  const strip = byClass(host, 'px-tabs')[0];
  const tabs = strip ? strip.children.map((b) => ({ label: text(b).replace(/◆/g, ''), on: /\bon\b/.test(b.className ?? '') })) : [];
  menu.unmount();
  return tabs;
}

test('LEGACY3 the Family tab: between Holdings and System while the mod is on, a landing opens it; gone while it is off, the landing on System (mutant: the tab drawn whatever the switch)', () => {
  _resetModSettings();
  setModSetting(LEGACY_MOD, 'Enabled', true);
  const on = tabsOf('family');
  assert.deepEqual(on.map((t) => t.label), ['Quests', 'Stats', 'Holdings', 'Family', 'System']);
  assert.deepEqual(on.filter((t) => t.on).map((t) => t.label), ['Family'], 'the landing names the tab');
  setModSetting(LEGACY_MOD, 'Enabled', false);
  const off = tabsOf('family');
  assert.deepEqual(off.map((t) => t.label), ['Quests', 'Stats', 'Holdings', 'System']);
  assert.deepEqual(off.filter((t) => t.on).map((t) => t.label), ['System'], 'a landing on a tab not drawn lands on System');
  _resetModSettings();
});
