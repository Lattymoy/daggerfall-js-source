// DISC28-A (2026-09-28, EvoAva, Discord: "If you change the default pause key binding from escape to anything else,
// it allows you to open pause menu with that key binding, but not close it").
//
// The host opens the enhanced pause screen on the PAUSE ACTION (inputActions 'Escape'), but the screen's own key
// handler knew back only as overlayAction's literal Escape - so a pause rebound to P opened the screen and P then did
// nothing there. DFU's pause window closes on the action's own binding (DaggerfallPauseOptionsWindow.cs:159
// toggleClosedBinding = GetBinding(Actions.Escape), :186 GetKeyUp), and the classic window already does
// (ui/pauseWindow.js). Driven through the real registry, the real input table and the mounted screen.
//
// AUDIT DISC28 UI-5: OVER THE TABLE THE GAME MINTS. These pins mounted an EMPTY store (createBindings alone), so "the
// default binding" held no binding at all and no key here was ever anybody else's - while in the shipped table every
// letter is spent (P is QuickLootAll's), and the Controls pane's answer to a pause moved onto a key in use can be USE
// FOR BOTH (UXB1-S shareBinding). The store is resetDefaults' now, the player's move on top of it; the shared key and
// the default Escape's auto-repeat are pinned; and a PRESS is both of its edges - the pause face answers on the
// release (AUDIT DISC28 UI-2, test/ui/auditdisc28_ui.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keydown, keyup } from '../../chargenDom.mjs';
import { createBindings, resetDefaults, setBinding, shareBinding, actionsForCode } from '../../../src/systems/inputActions.js';
import { setBindings } from '../../../src/ui/input.js';
import { mountEnhancedMenu } from '../../../src/ui/enhanced/enhancedMenu.js';

console.warn = () => {};

/** The shipped table (resetDefaults), then the player's own move on it - `setBinding` (the Controls pane's replace) by
 *  default, or any edit handed in (shareBinding: its "use for both"). */
function mount(mode, edit = (s) => setBinding(s, 'KeyP', 'Escape')) {
  const store = createBindings();
  resetDefaults(store);
  edit?.(store);
  setBindings(store);
  const acts = [];
  const host = globalThis.document.createElement('div');
  const menu = mountEnhancedMenu(host, { mode, hooks: {}, onAction: (a) => acts.push(a) });
  return { acts, menu, store };
}
/** One press: its keydown and its keyup. */
const press = (code, extra = {}) => ({ down: keydown(code, undefined, extra), up: keyup(code, undefined, extra) });

test('DISC28-A: a pause rebound to P closes the pause screen it opened', () => {
  const { acts, menu } = mount('pause');
  const { down, up } = press('KeyP', { key: 'p' });
  assert.deepEqual(acts, ['resume'], 'the pause action\'s own key is back on the pause face');
  assert.equal(down.stopped && up.stopped, true, 'and the key is the screen\'s, both edges - it does not fall through to the world');
  menu.unmount();
});

test('DISC28-A: the held key that opened the screen does not close it on its first auto-repeat', () => {
  const { acts, menu } = mount('pause');
  const rep = keydown('KeyP', undefined, { key: 'p', repeat: true });
  assert.deepEqual(acts, []);
  assert.equal(rep.stopped, true, 'AUDIT DISC28 UI-2: swallowed');
  const up = keyup('KeyP', undefined, { key: 'p' });
  assert.deepEqual(acts, [], 'and its release is the opening press\'s - nothing was armed');
  assert.equal(up.stopped, false, 'the host\'s, which saw that press');
  menu.unmount();
});

test('DISC28-A: only the pause action\'s key - a letter bound elsewhere is not back', () => {
  const { acts, menu, store } = mount('pause');
  assert.deepEqual(actionsForCode(store, 'KeyQ'), ['RecastSpell'], 'every letter is spent in the shipped table');
  press('KeyQ', { key: 'q' });
  assert.deepEqual(acts, []);
  menu.unmount();
});

test('DISC28-A: the literal Escape still resumes after the rebind (the back button, U51)', () => {
  const { acts, menu, store } = mount('pause');
  assert.deepEqual(actionsForCode(store, 'Escape'), [], 'the rebind took the pause off Escape');
  press('Escape', { key: 'Escape' });
  assert.deepEqual(acts, ['resume']);
  menu.unmount();
});

test('DISC28-A: the default binding resumes exactly once per press', () => {
  const { acts, menu, store } = mount('pause', null);
  assert.deepEqual(actionsForCode(store, 'Escape'), ['Escape'], 'the shipped pause key, the back button and the action at once');
  keydown('Escape', undefined, { key: 'Escape' });
  keydown('Escape', undefined, { key: 'Escape', repeat: true });
  keyup('Escape', undefined, { key: 'Escape' });
  assert.deepEqual(acts, ['resume']);
  menu.unmount();
});

test('DISC28-A: the boot menu is no pause screen - the pause key means nothing there', () => {
  const { acts, menu } = mount('boot');
  press('KeyP', { key: 'p' });
  assert.deepEqual(acts, []);
  menu.unmount();
});

test('DISC28-A: a mod TextKey capture waiting for its key owns it - the back stack stands down, the capture has one owner', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../../src/ui/enhanced/enhancedMenu.js', import.meta.url), 'utf8');
  const onKey = src.slice(src.indexOf('function onKey(e)'), src.indexOf('function releaseLock()'));
  assert.ok(onKey.indexOf('if (textKeyCapture) return;') > 0 && onKey.indexOf('if (textKeyCapture) return;') < onKey.indexOf('const pauseKey'),
    'standing down before the pause key is read');
  assert.match(src, /textKeyCapture = onKey;\s*\n\s*addEventListener\('keydown', onKey, true\);/);
  assert.match(src, /removeEventListener\('keydown', onKey, true\);\s*\n\s*textKeyCapture = null;/, 'the capture clears itself');
  assert.match(src, /unmount\(\) \{[\s\S]*?if \(textKeyCapture\) \{ globalThis\.removeEventListener\('keydown', textKeyCapture, true\); textKeyCapture = null; \}/, 'and unmount clears it');
});

test('AUDIT DISC28 UI-5: a pause SHARED with P\'s owner (QuickLootAll - the Controls prompt\'s "use for both") closes the face on P', () => {
  const { acts, menu, store } = mount('pause', (s) => shareBinding(s, 'KeyP', 'Escape'));
  assert.deepEqual(actionsForCode(store, 'KeyP'), ['QuickLootAll', 'Escape'], 'the owner first, the pause beside it');
  press('KeyP', { key: 'p' });
  assert.deepEqual(acts, ['resume'], 'the pause is one of the actions the key means - not only its first');
  menu.unmount();
});

test('AUDIT DISC28 UI-5: the default Escape\'s auto-repeat - the press that opened the face, held - does nothing', () => {
  const { acts, menu } = mount('pause', null);
  const reps = [1, 2, 3].map(() => keydown('Escape', undefined, { key: 'Escape', repeat: true }));
  assert.deepEqual(acts, [], 'the held key that opened the screen never closes it');
  assert.ok(reps.every((r) => r.stopped), 'and the repeats are the screen\'s - swallowed');
  keyup('Escape', undefined, { key: 'Escape' });
  assert.deepEqual(acts, [], 'nor does its release: the press was the host\'s');
  menu.unmount();
});
