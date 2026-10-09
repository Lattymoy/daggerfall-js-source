// CLASSIC-PAGES (2026-09-30, Mac: "Enhanced pages + key"; found tracing GATHER-SAID, `06-Systems/Online-Arc.md`). The
// Professions and Stores pages stood on the Enhanced pause menu's Stats rail alone - the classic pause has no pages
// (AUDIT 29 B2's FLAGGED) - so an online classic player could neither read a rank nor withdraw a gathered good, and a
// home's Forge, Workbench or Loom was not offered them. A door pressed for a professions page - THE PROFESSIONS KEY (the
// down arrow, appended), a shop's or a home's station - now opens the enhanced pause on that page on either skin, as DISC22-B's
// Controls button opens its Settings; with no pages to show it says why and opens nothing. bible/06-Systems/
// Professions-Arc.md 22.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPauseFlow, PROF_PAGES_CLOSED_LINE, profPageAt } from '../src/ui/pauseDoor.js';
import { setProfessionsPages, forgeOffered, stationColdLine, PROF_PAGE_SECTIONS } from '../src/ui/profPages.js';
import { storesWhereLine } from '../src/scenes/gatherHost.js';
import { routeAction } from '../src/ui/input.js';
import { ACTIONS, DEFAULT_BINDINGS, DEFAULT_SHARES, ACTION_GROUPS, PORT_ACTIONS } from '../src/systems/inputActions.js';
import { setUiSkin } from '../src/systems/uiSkin.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';
import { registerPresenter, _resetNotifyForTests } from '../src/systems/notify.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

function withDocument(fn) {
  const node = { id: '', style: {}, removed: false, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => node, body: { append() {} } };
  try { return fn(node); } finally { delete globalThis.document; }
}
/** The HUD's lines, heard. */
function heard() {
  _resetNotifyForTests();
  const lines = [];
  registerPresenter({ hudText: (t) => { lines.push(t); return true; }, priority: 99 });
  return lines;
}
const online = () => setProfessionsPages({ book: { state: { open: true } } });

test('CLASSIC-PAGES: on the classic skin a door pressed for the Professions or the Stores page opens the enhanced pause on it - the classic pause has none', () => {
  _resetForTests();
  setUiSkin('classic');
  online();
  try {
    for (const at of ['professions', 'stores']) {
      withDocument((node) => {
        const shown = [];
        const win = openPauseFlow((w) => shown.push(w), { at, exitToMenu() {} });
        assert.equal(node.id, 'enhanced-pause', `${at}: the port's own pause screen`);
        assert.notEqual(win?.constructor?.name, 'PauseOptionsWindow', `${at}: not DFU's pause window`);
        assert.equal(shown.at(-1), win, 'in the host\'s slot');
        win.dispose();
      });
    }
    // every other door on the classic skin keeps DFU's own window
    withDocument(() => {
      const win = openPauseFlow(() => {}, { exitToMenu() {} });
      assert.equal(win.constructor.name, 'PauseOptionsWindow', 'Escape: the classic pause, as before');
    });
    withDocument(() => {
      const win = openPauseFlow(() => {}, { at: 'stats', exitToMenu() {} });
      assert.equal(win.constructor.name, 'PauseOptionsWindow', 'a page not the professions\' keeps the classic window');
    });
  } finally { setProfessionsPages(null); _resetForTests(); }
});

test('CLASSIC-PAGES: with no pages to show (offline, the switch shut) the door says why and opens nothing, on either skin', () => {
  for (const skin of ['classic', 'enhanced']) {
    _resetForTests();
    setUiSkin(skin);
    setProfessionsPages(null);
    const lines = heard();
    withDocument((node) => {
      const shown = [];
      const win = openPauseFlow((w) => shown.push(w), { at: 'professions', exitToMenu() {} });
      assert.equal(win, null, `${skin}: nothing opened`);
      assert.deepEqual(shown, []);
      assert.equal(node.id, '');
    });
    assert.deepEqual(lines, [PROF_PAGES_CLOSED_LINE], `${skin}: said why`);
    setProfessionsPages({ book: { state: { open: false } } });
    lines.length = 0;
    withDocument(() => assert.equal(openPauseFlow(() => {}, { at: 'stores' }), null));
    assert.deepEqual(lines, [PROF_PAGES_CLOSED_LINE], 'a book the switch keeps shut: the same');
    setProfessionsPages(null);
  }
  _resetNotifyForTests();
  _resetForTests();
  assert.deepEqual(PROF_PAGE_SECTIONS.map(([id]) => profPageAt(id)), [true, true]);
  assert.deepEqual(['quests', 'stats', 'system', 'settings', undefined].map(profPageAt), [false, false, false, false, false]);
});

test('CLASSIC-PAGES: THE PROFESSIONS KEY - appended, a default share on the down arrow beside less sail (as more sail shares the act choice\'s up arrow), in the Professions group, a port row; the router opens the pause on the Professions page, and nothing while sailing', () => {
  assert.deepEqual(ACTIONS.slice(-3), ['Professions', 'LegacyFamily', 'ModeWheel'], 'appended after HELM-KEYS\' two: the classic grid and a saved file resolve by position (LEGACY1\'s family tree after it, MODE-WHEEL\'s wheel last)');
  assert.ok(DEFAULT_SHARES.some(([c, a, partner]) => c === 'ArrowDown' && a === 'Professions' && partner === 'BoatSailDown'), 'shared onto less sail\'s own key');
  assert.ok(!DEFAULT_BINDINGS.some(([, a]) => a === 'Professions'), 'it owns no key - KB1 law 3 keeps every owner once');
  assert.ok(DEFAULT_BINDINGS.some(([c, a]) => c === 'ArrowUp' && a === 'ActChoice'), 'the professions\' two keys on the arrows');
  assert.ok(PORT_ACTIONS.includes('Professions'), 'the classic windows yield it');
  assert.ok(ACTION_GROUPS.find((g) => g.title === 'Professions').rows.some((r) => r.action === 'Professions'));
  const asked = [];
  const ctx = { togglePause: (o) => asked.push(o) };
  const pos = () => {};
  assert.equal(routeAction('Professions', ctx, pos), true);
  assert.deepEqual(asked, [{ at: 'professions', setPlayerPos: pos }]);
  assert.equal(routeAction('Professions', {}), false, 'a host with no pause door leaves the key');
  const atHelm = [];
  assert.equal(routeAction('Professions', { togglePause: (o) => atHelm.push(o), sailing: () => true }), false, 'at a helm the down arrow is less sail\'s');
  assert.deepEqual(atHelm, [], 'nothing opened while sailing');
  assert.equal(routeAction('Professions', { togglePause: () => {}, sailing: () => false }), true);
  assert.match(rd('src/scenes/world.js'), /sailing: \(\) => !!csaRuntime\?\.isSailing\(\),/, 'the streaming world says when it sails');
});

test('CLASSIC-PAGES: a Forge, Workbench or Loom works on either skin while the pages stand; the stations and the first harvest\'s line name no skin', () => {
  _resetForTests();
  setUiSkin('classic');
  setProfessionsPages(null);
  assert.equal(forgeOffered(), false, 'offline: none');
  online();
  assert.equal(forgeOffered(), true, 'the classic skin: offered');
  setUiSkin('enhanced');
  assert.equal(forgeOffered(), true);
  setProfessionsPages(null);
  _resetForTests();
  for (const st of ['forge', 'workbench', 'loom']) assert.doesNotMatch(stationColdLine(st), /Enhanced/, `${st}: no skin named`);
  // PIN MOVED (AUDIT HOLDINGS C7): the Stores page is on the Holdings tab; the key opens the Professions
  assert.equal(storesWhereLine('DOWN'), 'Gathered goods go to your Stores, not your pack: the pause menu\'s Holdings > Stores (DOWN opens your Professions).');
  assert.equal(storesWhereLine(''), 'Gathered goods go to your Stores, not your pack: the pause menu\'s Holdings > Stores.', 'the key unbound');
  // the station's press is the pause door's, at the Stores page - which opens on the classic skin now
  assert.match(rd('src/scenes/worldModes.js'), /if \(forgeOffered\(\)\) interiorKeyCtx\.togglePause\(\{ at: 'stores' \}\)/);
  assert.match(rd('src/scenes/gatherHost.js'), /hud\.toast\(storesWhereLine\(deps\.keyLabel\?\.\('Professions'\) \?\? '', d\.carry === true\)\)/, 'the host names the key the player has it on (BAG1, PIN MOVED: and says the bag when the goods were carried)');
});
