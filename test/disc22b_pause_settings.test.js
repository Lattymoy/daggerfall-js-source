// DISC22-B (2026-09-24, kurkku on Discord, over a screenshot of the classic pause window: "could replace the controls
// button here with the full settings menu").
//
// DFU's CONTROLS button opens its controls grid alone, and on the classic skin that grid was the only settings a player
// could reach from a game in progress. It now opens the port's whole settings screen on its Settings page (Controls is
// one of its categories - FT16), and that screen's Resume comes back to the classic pause window, as DFU's controls
// window pops back to the window it was opened from. With no document (a node host) the classic grid stands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPauseFlow } from '../src/ui/pauseDoor.js';
import { setUiSkin } from '../src/systems/uiSkin.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

function withDocument(fn) {
  const node = { id: '', style: {}, removed: false, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => node, body: { append() {} } };
  try { return fn(node); } finally { delete globalThis.document; }
}

test('DISC22-B: the classic pause window\'s Controls button opens the port\'s whole settings screen', () => {
  _resetForTests();
  setUiSkin('classic');
  withDocument((node) => {
    const shown = [];
    const win = openPauseFlow((w) => shown.push(w), { exitToMenu() {} });
    assert.equal(win.constructor.name, 'PauseOptionsWindow', 'the classic skin keeps DFU\'s pause window');
    assert.equal(typeof win.hooks.openControls, 'function', 'its Controls button is live');
    const overlay = win.hooks.openControls();
    assert.equal(shown.at(-1), overlay, 'the host slot holds the settings screen');
    assert.notEqual(overlay.constructor?.name, 'ControlsWindow', 'not DFU\'s grid alone');
    assert.equal(node.id, 'enhanced-pause', 'the port\'s own screen');
    overlay.dispose();
  });
  _resetForTests();
});

test('DISC22-B: with no document the classic grid stands (a node host draws the canvas window)', () => {
  _resetForTests();
  setUiSkin('classic');
  assert.equal(typeof document, 'undefined');
  const win = openPauseFlow(() => {}, {});
  const src = rd('src/ui/pauseWindow.js');
  assert.match(src, /openControls: hooks\.openSettings \?\? \(controlsArtLoaded\(\)/, 'the grid is the fallback, not the choice');
  assert.equal(win.hooks.openSettings, null, 'no document, no settings screen to open');
  _resetForTests();
});

test('DISC22-B: the screen lands on Settings, and its Resume returns to the classic pause window', () => {
  const door = rd('src/ui/pauseDoor.js');
  assert.match(door, /enhancedPauseOverlay\(show, \{ \.\.\.hooks, at: 'settings', onResume: again \}\)/, 'opened on the Settings page, Resume wired back');
  assert.match(door, /const again = \(\) => classicPauseWithSettings\(show, hooks\);/, 'back to the same classic window, its Controls button live again');
  assert.match(door, /if \(action === 'resume' && typeof hooks\.onResume === 'function'\) \{ hooks\.onResume\(\); return; \}/, 'Resume returns rather than relocking into the world');
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /else if \(at && sections\.some\(\(l\) => idOf\(l\) === at\)\) section = at;/, 'a landing may name a rail section');
  assert.match(menu, /const SECTIONS_PAUSE = \[[^\]]*'Settings'/, 'and the pause rail carries Settings');
});
