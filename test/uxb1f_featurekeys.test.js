// UXB1-F (2026-09-25, the UX backlog: "Show keybinds for game features, even if they cannot be changed there (Drop
// torch/summon horse/summon cart)").
//
// THE GAP, two of it. KB1 moved every vendored mod's keys off its Features tile and into Controls - where they are
// BOUND, one registry where a clash can be seen - and left the tile naming none of them ("keys to ignite, drop or
// throw"). And some keys a player meets in play stood on no screen at all: the HUD's three (F10, Shift-F10,
// Shift-F11, DaggerfallShortcut's table, which DFU gives no rebinding screen either) and the Transport window's
// letters, which are how the game itself (no mod) summons a horse or a cart - Transport, then H or C.
//
// So a mod's tile names its keys, read-only, in the live bindings, with one press through to Controls; and the
// Controls page names the fixed keys after the ones it can move. Every key is READ - off the registry or the
// shortcut table - never written down a second time, and the pins below hold both halves to their source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { featureTile, FEATURE_KEYS_NOTE } from '../src/ui/enhancedMenu.js';
import { paneControls, discardControlsStaging, controlsStaging, FIXED_KEYS_HEAD } from '../src/ui/enhancedControls.js';
import { FEATURES } from '../src/systems/features.js';
import { fixedKeyRows, modKeyRows, shortcutKeyText, buttonText, setUnsavedBinding, FIXED_KEY_ROWS, TRANSPORT_KEY_ROWS } from '../src/systems/controlsConfig.js';
import { MOD_ACTIONS, ACTION_GROUPS, createBindings, resetDefaults, setBinding, codeForAction } from '../src/systems/inputActions.js';
import { SHORTCUT_TEXT } from '../src/systems/dialogShortcuts.js';
import { setBindings } from '../src/ui/input.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function fakeEl(tag) {
  const n = {
    tag, tagName: tag.toUpperCase(), children: [], className: '', textContent: '', title: '', style: {}, dataset: {}, attrs: {},
    onclick: null, oncontextmenu: null,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    append(...cs) { for (const c of cs) { n.children.push(c); c.parent = n; } },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener() {}, removeEventListener() {},
  };
  return n;
}
function find(n, cls, out = []) {
  if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n);
  for (const c of n.children ?? []) find(c, cls, out);
  return out;
}
const textOf = (n, out = []) => { if (n.textContent) out.push(n.textContent); for (const c of n.children ?? []) textOf(c, out); return out; };
const withDoc = (fn) => {
  globalThis.document = {
    createElement: fakeEl, createTextNode: (t) => ({ textContent: t, children: [] }), querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  };
  try { return fn(); } finally { delete globalThis.document; }
};
const defaults = () => { const s = createBindings(); resetDefaults(s); return s; };

test('UXB1-F: the fixed keys are READ off the shortcut table - the HUD\'s three as they are, each Transport letter behind the key that opens that window', () => {
  const store = defaults();
  const rows = fixedKeyRows(codeForAction(store, 'Transport'));
  assert.deepEqual(rows.slice(0, 3), [
    { label: 'Large HUD on or off', key: 'F10' },
    { label: 'Hide or show the HUD', key: 'SHIFT + F10' },
    { label: 'Retro Mode’s post-processing on or off', key: 'SHIFT + F11' },
  ]);
  const t = buttonText(codeForAction(store, 'Transport'), true);
  assert.deepEqual(rows.slice(3).map((r) => r.key), ['F', 'H', 'C', 'S'].map((k) => `${t}, then ${k}`),
    'the whole gesture - the letter alone does nothing outside the window');
  assert.ok(rows.some((r) => /horse/.test(r.label)) && rows.some((r) => /cart/.test(r.label)), 'summon horse, summon cart');
  // the keys follow the table, not a copy of it: every row's key is its button's DialogShortcuts.txt entry
  for (const r of [...FIXED_KEY_ROWS, ...TRANSPORT_KEY_ROWS]) {
    const want = SHORTCUT_TEXT[r.button].split('-').map((p) => (p.length === 1 ? p : p.toUpperCase())).join(' + ');
    assert.equal(shortcutKeyText(r.button), want, r.button);
  }
  // ...and follow the Transport binding, staged or live, with an unbound one said so
  setBinding(store, 'KeyJ', 'Transport');
  assert.equal(fixedKeyRows(codeForAction(store, 'Transport'))[4].key, 'J, then H');
  assert.equal(fixedKeyRows(null)[4].key, 'Transport (unbound), then H');
  // the buttons are the ones the game answers: the HUD's arms and the Transport window read these very names
  const hud = read('src/ui/hudShortcuts.js');
  for (const b of ['LargeHUDToggle', 'HUDToggle', 'ToggleRetroPP']) assert.match(hud, new RegExp(`hotkeyHit\\('${b}', e\\.code, e, keys\\)`), b);
  const tw = read('src/ui/transportWindow.js');
  for (const b of ['TransportHorse', 'TransportCart']) assert.match(tw, new RegExp(`'${b}'`), b);
});

test('UXB1-F: the Controls page names the fixed keys AFTER the ones it moves - words and keys, no buttons, no editable rows, in the STAGED set', () => {
  const store = defaults();
  setBindings(store);
  discardControlsStaging();
  const paint = () => { const body = fakeEl('div'); paneControls(body, { render: () => {} }); return body; };
  withDoc(() => {
    let body = paint();
    let card = find(body, 'ctl-fixed')[0];
    assert.ok(card, 'the card is drawn');
    assert.equal(body.children.indexOf(card), body.children.length - 2, 'after the last group, before the foot Confirm');
    assert.ok(textOf(card).includes(FIXED_KEYS_HEAD));
    assert.deepEqual(find(card, 'ctl-fixedkey').map((k) => k.textContent), fixedKeyRows(codeForAction(store, 'Transport')).map((r) => r.key));
    assert.equal(find(card, 'act').length, 0, 'nothing in it is a control');
    assert.equal(find(card, 'ctl-row').length, 0, 'and nothing in it is a row a press edits');
    assert.ok(find(card, 'ctl-fixedkey').every((k) => k.tag === 'span'));
    // a Transport key rebound on this page, not yet confirmed, is the one the rows name
    setUnsavedBinding(controlsStaging(), 'Transport', 'KeyJ');
    body = paint();
    card = find(body, 'ctl-fixed')[0];
    assert.equal(find(card, 'ctl-fixedkey')[4].textContent, 'J, then H');
    assert.equal(codeForAction(store, 'Transport'), 'KeyT', 'the registry still holds the old key');
  });
  discardControlsStaging();
});

test('UXB1-F: a mod\'s keys, as its tile names them - the Controls page\'s own labels, the live keys, NONE when unbound', () => {
  const store = defaults();
  const labels = new Map(ACTION_GROUPS.flatMap((g) => g.rows.map((r) => [r.action, r.label])));
  for (const [vendor, rows] of Object.entries(MOD_ACTIONS)) {
    assert.deepEqual(modKeyRows(vendor, store), rows.map(({ action }) => ({
      action, label: labels.get(action), key: buttonText(codeForAction(store, action), true),
    })), vendor);
  }
  assert.deepEqual(modKeyRows('handheld-torches', store).map((r) => [r.label, r.key]),
    [['Light or douse', 'O'], ['Drop the light', 'G'], ['Throw a torch (hold to charge)', 'X']], 'drop torch');
  assert.deepEqual(modKeyRows('horse-cart-and-cargo', store).map((r) => [r.label, r.key]),
    [['Mount or dismount', ','], ['Summon horse and wagon', '.']], 'summon horse, summon cart');
  store.primary.delete(codeForAction(store, 'TorchDrop'));
  assert.equal(modKeyRows('handheld-torches', store)[1].key, 'NONE');
  assert.deepEqual(modKeyRows('seasons-iliac-bay', store), [], 'a mod with no keys names none');
});

test('UXB1-F: the tile\'s door counts its keys, and its drawer names them read-only with one press through to Controls', () => {
  const store = defaults();
  setBindings(store);
  const f = FEATURES.find((x) => x.id === 'mod-handheld-torches');
  assert.ok(f, 'the Handheld Torches tile');
  withDoc(() => {
    let t = featureTile(f);
    const door = find(t, 'ft-tile-more')[0];
    assert.match(textOf(door).join(''), /3 keys/, 'the door says the keys are there');
    door.onclick({ stopPropagation() {} });   // opens it (render() has no screen here, so the tile is built again)
    t = featureTile(f);
    const drawer = find(t, 'ft-tile-drawer')[0];
    assert.deepEqual(find(drawer, 'ft-key').map((k) => k.textContent), ['O', 'G', 'X']);
    assert.ok(find(drawer, 'ft-key').every((k) => k.tag === 'span'), 'a key is shown, not pressed');
    const to = find(drawer, 'ft-keys-to')[0];
    assert.equal(to.textContent, 'Change in Controls');
    assert.equal(to.title, FEATURE_KEYS_NOTE);
    find(t, 'ft-tile-more')[0].onclick({ stopPropagation() {} });   // and shut again, for the next test
  });
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /function openControls\(\) \{\n\s+category = 'controls';\n\s+go\('settings'\);\n\}/, 'the press lands on Settings, Controls');
  assert.match(menu, /if \(keys\.length\) pair\('Keys', /, 'and the reading rail names them for the tile pointed at');
  // KB1's law stands: the keys are not dials - nothing in the curated table reaches for a key
  assert.doesNotMatch(read('src/systems/features.js'), /'Handling\.(ManualDropInput|ToggleLightInput)'|'Hotkeys\.(SummonTransport|QuickMountDismount)'/);
});
