// LEGACY3 (2026-10-05, Mac: "I say implement it into the pause menu as a new tab"): THE FAMILY TAB - drawn in the
// pause window between Holdings and System while the game is played with Project Legacy, and never otherwise: a landing
// on it then lands on System (bible/06-Systems/Legacy-Arc.md section 11). Driven through the mounted screen.
// FAMILY-TAB (2026-10-06, asked: "When a player is playing without project legacy, the family tab shouldn't show (pause
// menu)"): "with Project Legacy" is the mod on AND a house for the game played (ui/familyPages.js familyTabShown) - a
// character who answered no lineage, one made online before the question or copied in, and a scene that keeps no family
// play without one, and have no tab; the tab's key says why on the HUD and opens nothing (ui/pauseDoor.js).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { byClass, text } from './chargenDom.mjs';
import { mountEnhancedMenu } from '../src/ui/enhancedMenu.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { LEGACY_MOD, MODELS, NO_LINEAGE, foundFamily, familyRng } from '../src/systems/legacy/family.js';
import { setFamilyProvider, familyTabShown, noFamilyLine, resetFamilyPages } from '../src/ui/familyPages.js';
import { openPauseFlow } from '../src/ui/pauseDoor.js';
import { legacyOn } from '../src/systems/legacy/settings.js';
import { setUiSkin } from '../src/systems/uiSkin.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';
import { registerPresenter, _resetNotifyForTests } from '../src/systems/notify.js';

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
/** A house as chargen founds one (systems/legacy/family.js foundFamily - the producer's own shape). */
const house = () => foundFamily({
  name: 'Ysolde Hlaalu', gender: 'female', race: 'Breton', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 9, characterId: 'c-ysolde', chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)),
}, { model: MODELS.bloodline, at: 0, rng: familyRng(3), id: 'fam-tab' });
/** The world host's provider (scenes/world.js setFamilyProvider), as far as the tab reads it - `on` the mod's own switch. */
const provider = ({ family = null, past = null, choice = null, online = false } = {}) => ({
  on: () => legacyOn(), family: () => family, past: () => past, lived: () => 0, switchRefusal: () => null, switchTo: () => ({ ok: false }),
  hall: () => (family ? [family] : []), choice: () => choice, online: () => online,
});
const FULL = ['Quests', 'Stats', 'Holdings', 'Family', 'System'];
const WITHOUT = ['Quests', 'Stats', 'Holdings', 'System'];

test('LEGACY3 + FAMILY-TAB the Family tab: between Holdings and System while the game is played with Project Legacy, a landing opens it; gone while it is off, and gone for a game played without a house - the landing on System (mutants: the tab drawn whatever the switch, drawn with no house)', () => {
  _resetModSettings();
  resetFamilyPages();
  try {
    setModSetting(LEGACY_MOD, 'Enabled', true);
    setFamilyProvider(provider({ family: house() }));
    const on = tabsOf('family');
    assert.deepEqual(on.map((t) => t.label), FULL);
    assert.deepEqual(on.filter((t) => t.on).map((t) => t.label), ['Family'], 'the landing names the tab');
    // FAMILY-TAB: the mod on, but the game played has no house - every way a character plays without one
    for (const [why, prov] of [
      ['a character who answered no lineage', provider({ choice: NO_LINEAGE, online: true })],
      ['online, one made before the question or copied in', provider({ online: true })],
      ['offline, no house founded', provider()],
      ['a scene that keeps no family (no provider)', null],
    ]) {
      setFamilyProvider(prov);
      const none = tabsOf('family');
      assert.deepEqual(none.map((t) => t.label), WITHOUT, `${why}: no Family tab`);
      assert.deepEqual(none.filter((t) => t.on).map((t) => t.label), ['System'], `${why}: the landing lands on System`);
    }
    // the past played back is the house's still (a dead or retired member's save)
    setFamilyProvider(provider({ past: { id: 0 } }));
    assert.equal(familyTabShown(), true, 'the past played back keeps its tab');
    // the mod off: no tab, a house or none
    setModSetting(LEGACY_MOD, 'Enabled', false);
    setFamilyProvider(provider({ family: house() }));
    const off = tabsOf('family');
    assert.deepEqual(off.map((t) => t.label), WITHOUT);
    assert.deepEqual(off.filter((t) => t.on).map((t) => t.label), ['System'], 'a landing on a tab not drawn lands on System');
  } finally {
    setFamilyProvider(null);
    resetFamilyPages();
    _resetModSettings();
  }
});

test('FAMILY-TAB familyTabShown: the mod on and a house for the game played - pure over the provider', () => {
  _resetModSettings();
  setModSetting(LEGACY_MOD, 'Enabled', true);
  const f = house();
  const off = { ...provider({ family: f }), on: () => false };
  after(() => _resetModSettings());
  assert.deepEqual([
    familyTabShown(null),
    familyTabShown(provider()),
    familyTabShown(provider({ choice: NO_LINEAGE, online: true })),
    familyTabShown(provider({ family: f })),
    familyTabShown(provider({ past: { id: 0 } })),
    familyTabShown(off),
  ], [false, false, false, true, true, false]);
});

function withDocument(fn) {
  const node = { id: '', style: {}, removed: false, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => node, body: { append() {} } };
  try { return fn(node); } finally { delete globalThis.document; }
}

test('FAMILY-TAB the Family key without a house says why on the HUD - the pages\' own words - and opens nothing, on either skin; with one it opens the enhanced pause on the tab (mutant: the key opening the pause with no tab)', () => {
  const docBefore = globalThis.document;
  _resetModSettings();
  try {
    setModSetting(LEGACY_MOD, 'Enabled', true);
    for (const skin of ['classic', 'enhanced']) {
      _resetForTests();
      setUiSkin(skin);
      _resetNotifyForTests();
      const lines = [];
      registerPresenter({ hudText: (t) => { lines.push(t); return true; }, priority: 99 });
      const chose = provider({ choice: NO_LINEAGE, online: true });
      setFamilyProvider(chose);
      delete globalThis.document;
      withDocument((node) => {
        const shown = [];
        const win = openPauseFlow((w) => shown.push(w), { at: 'family', exitToMenu() {} });
        assert.equal(win, null, `${skin}: nothing opened`);
        assert.deepEqual(shown, []);
        assert.equal(node.id, '', `${skin}: no pause screen stood up`);
      });
      assert.deepEqual(lines, [noFamilyLine(chose)], `${skin}: said why, in the pages' words`);
      assert.match(lines[0], /chose to live without a house/);
      // with a house, the key's door opens the port's own pause screen on the tab (either skin - the classic has no tabs)
      setFamilyProvider(provider({ family: house() }));
      lines.length = 0;
      withDocument((node) => {
        const shown = [];
        const win = openPauseFlow((w) => shown.push(w), { at: 'family', exitToMenu() {} });
        assert.equal(node.id, 'enhanced-pause', `${skin}: the enhanced pause, on the Family tab`);
        assert.equal(shown.at(-1), win, 'in the host\'s slot');
        win.dispose();
      });
      assert.deepEqual(lines, [], `${skin}: nothing said`);
    }
  } finally {
    if (docBefore !== undefined) globalThis.document = docBefore;
    setFamilyProvider(null);
    _resetNotifyForTests();
    _resetForTests();
    _resetModSettings();
  }
});
