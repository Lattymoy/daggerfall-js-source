// UXB1-S (2026-09-25, the UX backlog: "Is there a reason you cannot have multiple keys bound to the same action such
// as jump+swim-up? If so, highlight conflicting keybinds." - and then: "So you wont add multiple key bindings even when
// asked? I dont care if it goes against daggerfall"): ONE KEY, SEVERAL ACTIONS.
//
// DFU's law was one key per action per dict: its window refused to close on a duplicate. That is a departure the port
// now makes on purpose (Ledger A's UXB1 row): a key already in use asks, and a third answer - "use it for both" - puts
// it on the new action BESIDE its holder. The key then does all of them: every per-frame poll (held, pressed,
// released) sees each, and every dispatch (routeKey, the two self-routing hosts' ladders, a window's own-key close)
// runs each. What DFU's law still refuses is the clash no press resolves - a combo against its own modifier bound bare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createBindings, resetDefaults, setBinding, shareBinding, dropBinding, clearBinding, clearBindingByCode, getBinding,
  actionForCode, actionsForCode, actionsAt, codeMeans, codesForAction, dictEntries, serializeKeyBinds, loadKeyBinds,
  DEFAULT_BINDINGS,
} from '../src/systems/inputActions.js';
import {
  held, pressed, keyEdges, noteKeyDown, beginInputFrame, actionOf, actionsOf, eventAction, eventActions, eventMeans,
  routeKey, setBindings,
} from '../src/ui/input.js';
import {
  createUnsavedKeybinds, setUnsavedBinding, currentDict, checkDuplicates, applyUnsavedKeybinds, bindingHolders,
  canShareKey, stageShare, keySharers, replacePromptRows, SHARE_KEY_ROW, SHARE_KEY_LABEL, SHARED_KEY_COLOR,
} from '../src/systems/controlsConfig.js';
import { paneControls, discardControlsStaging, controlsStaging, SHARED_KEY_PREFIX, CONFIRM_LABEL } from '../src/ui/enhancedControls.js';
import { ControlsWindow } from '../src/ui/controlsWindow.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const defaults = () => { const b = createBindings(); resetDefaults(b); return b; };
const JUMP = () => getBinding(defaults(), 'Jump');

// ── THE STORE ────────────────────────────────────────────────────

test('UXB1-S: a share puts a second action on a key BESIDE its holder - the owner still answers the one-answer read, both answer every other, and neither steals', () => {
  const b = defaults();
  const space = getBinding(b, 'Jump');
  const floatUp = getBinding(b, 'FloatUp');
  shareBinding(b, space, 'FloatUp');
  assert.equal(actionForCode(b, space), 'Jump', 'the one-answer read is the owner, as ever');
  assert.deepEqual(actionsForCode(b, space), ['Jump', 'FloatUp']);
  assert.deepEqual(actionsAt(b, space, true), ['Jump', 'FloatUp']);
  assert.equal(codeMeans(b, space, 'FloatUp'), true);
  assert.equal(getBinding(b, 'Jump'), space);
  assert.equal(getBinding(b, 'FloatUp'), space, 'the shared key IS the action\'s key');
  assert.equal(actionForCode(b, floatUp), null, 'one key per action per dict: its old key let go');
  assert.deepEqual(codesForAction(b, 'FloatUp').filter((c) => !c.startsWith('Joystick')), [space]);
  assert.deepEqual([...dictEntries(b, true)].filter(([c]) => c === space), [[space, 'Jump'], [space, 'FloatUp']]);
  // sharing it again changes nothing, and the owner stays the owner
  shareBinding(b, space, 'Jump');
  assert.deepEqual(actionsForCode(b, space), ['Jump', 'FloatUp']);
  shareBinding(b, space, 'FloatUp');
  assert.deepEqual(actionsForCode(b, space), ['Jump', 'FloatUp']);
});

test('UXB1-S: letting go - the owner leaving hands the key to its first sharer, a sharer leaving leaves the owner, SetBinding\'s steal takes the key from all of them, and a clear by code clears every one', () => {
  const b = defaults();
  const space = getBinding(b, 'Jump');
  shareBinding(b, space, 'FloatUp');
  shareBinding(b, space, 'Rest');
  assert.deepEqual(actionsForCode(b, space), ['Jump', 'FloatUp', 'Rest']);
  clearBinding(b, 'Jump');
  assert.deepEqual(actionsForCode(b, space), ['FloatUp', 'Rest'], 'the first sharer owns it now');
  assert.equal(actionForCode(b, space), 'FloatUp');
  dropBinding(b, space, 'Rest');
  assert.deepEqual(actionsForCode(b, space), ['FloatUp']);
  shareBinding(b, space, 'Rest');
  setBinding(b, space, 'Jump');
  assert.deepEqual(actionsForCode(b, space), ['Jump'], 'SetBinding is DFU\'s: the key is taken from every holder');
  assert.equal(getBinding(b, 'FloatUp'), null);
  assert.equal(getBinding(b, 'Rest'), null);
  shareBinding(b, space, 'FloatUp');
  clearBindingByCode(b, space);
  assert.deepEqual(actionsForCode(b, space), [], 'a clear by code clears the sharers too');
  assert.equal(b.sharedPrimary.has(space), false, 'and leaves no list behind');
  // moving a sharer to a key of its own takes it off the shared one, owner untouched
  setBinding(b, space, 'Jump');
  shareBinding(b, space, 'FloatUp');
  setBinding(b, 'PageUp', 'FloatUp');
  assert.deepEqual(actionsForCode(b, space), ['Jump']);
  assert.equal(getBinding(b, 'FloatUp'), 'PageUp');
});

test('UXB1-S: a share across the two dicts - a key one action holds as its primary and another as its secondary - is kept, where SetBinding would steal it', () => {
  const b = defaults();
  const space = getBinding(b, 'Jump');
  shareBinding(b, space, 'FloatUp', false);
  assert.equal(getBinding(b, 'Jump', true), space, 'the primary holder keeps it');
  assert.equal(getBinding(b, 'FloatUp', false), space);
  assert.deepEqual(actionsForCode(b, space), ['Jump', 'FloatUp'], 'the primary first, as the dicts resolve');
  setBinding(b, space, 'Rest', false);
  assert.equal(getBinding(b, 'Jump', true), null, 'SetBinding still steals across the dicts - DFU\'s own');
});

test('UXB1-S: the file - shares only where there are any (a file without is what it was), round-tripped, an unknown name dropped; and the autofill does not put a shared action\'s default back', () => {
  const plain = defaults();
  assert.equal('sharedActionKeyBinds' in serializeKeyBinds(plain), false, 'no shares, no field');
  const b = defaults();
  const space = getBinding(b, 'Jump');
  const floatUpDefault = DEFAULT_BINDINGS.find(([, a]) => a === 'FloatUp')[0];
  shareBinding(b, space, 'FloatUp');
  const file = serializeKeyBinds(b);
  assert.deepEqual(file.sharedActionKeyBinds, { [space]: ['FloatUp'] });
  const back = createBindings();
  loadKeyBinds(back, JSON.parse(JSON.stringify(file)));
  resetDefaults(back, true);   // the startup's autofill, which fills a MISSING action on a free code
  assert.deepEqual(actionsForCode(back, space), ['Jump', 'FloatUp'], 'the share comes back');
  assert.equal(actionForCode(back, floatUpDefault), null, 'and FloatUp, bound by its share, is not missing - its default is not put back');
  const odd = createBindings();
  loadKeyBinds(odd, { actionKeyBinds: { Space: 'Jump' }, sharedActionKeyBinds: { Space: ['NotAnAction', 'FloatUp', 'Jump'] } });
  assert.deepEqual(actionsForCode(odd, 'Space'), ['Jump', 'FloatUp'], 'the unknown dropped, the owner not listed twice');
  // a build that predates shares reads the owners and nothing else
  const older = createBindings();
  const { sharedActionKeyBinds, ...rest } = file;
  assert.ok(sharedActionKeyBinds);
  loadKeyBinds(older, rest);
  assert.deepEqual(actionsForCode(older, space), ['Jump']);
});

// ── THE PRESS ────────────────────────────────────────────────────

test('UXB1-S: the frame\'s polls see every action on a shared key - held and pressed - and a key event means all of them, owner first', () => {
  const b = defaults();
  const space = getBinding(b, 'Jump');
  shareBinding(b, space, 'FloatUp');
  setBindings(b);
  try {
    const keys = new Set([space]);
    assert.equal(held(keys, 'Jump'), true);
    assert.equal(held(keys, 'FloatUp'), true, 'swim up and jump on one key');
    const edge = keyEdges();
    noteKeyDown(edge, space);
    beginInputFrame(edge);
    assert.equal(pressed(edge, keys, 'Jump'), true);
    assert.equal(pressed(edge, keys, 'FloatUp'), true);
    const e = { code: space };
    assert.deepEqual(actionsOf(e, keys), ['Jump', 'FloatUp']);
    assert.equal(actionOf(e, keys), 'Jump', 'the one-answer read: the first');
    assert.deepEqual(eventActions(e), ['Jump', 'FloatUp']);
    assert.equal(eventAction(e), 'Jump');
    assert.equal(eventMeans(e, 'FloatUp'), true);
    assert.deepEqual(actionsOf({ code: 'Semicolon' }, new Set(['Semicolon'])), [], 'an unbound key means nothing');
  } finally { setBindings(null); }
});

test('UXB1-S: routeKey DISPATCHES every action a shared key carries - one press, both windows\' doors', () => {
  const b = defaults();
  const sheet = getBinding(b, 'CharacterSheet');
  shareBinding(b, sheet, 'Inventory');
  setBindings(b);
  try {
    const calls = [];
    const ctx = { uiOverlayActive: false, toggleCharSheet: () => calls.push('sheet'), toggleInventory: () => calls.push('pack') };
    assert.equal(routeKey({ code: sheet, target: null }, ctx, null, new Set([sheet])), true);
    assert.deepEqual(calls, ['sheet', 'pack'], 'the owner first, then the sharer');
  } finally { setBindings(null); }
});

test('UXB1-S by source: the two self-routing hosts run their ladder once per action, the HUD\'s own keys on the first pass alone, every arm\'s `return` now "the press is used"', () => {
  for (const [f, fn] of [['src/scenes/world.js', 'worldKeyAction'], ['src/scenes/exterior.js', 'exteriorKeyAction']]) {
    const s = read(f);
    assert.match(s, /const acts = retroToggleKey\(e, keys\) \? \[\] : actionsOf\(e, keys\);/, `${f}: every action, none under the retro chord`);
    assert.match(s, new RegExp(`\\(acts\\.length \\? acts : \\[null\\]\\)\\.forEach\\(\\(act, i\\) => \\{ if \\(${fn}\\(act, i === 0\\)\\) spent = true; \\}\\);\\n\\s*if \\(spent\\) return;`), `${f}: the loop, and nothing after it once the press is used`);
    const body = s.slice(s.indexOf(`function ${fn}(act, first) {`), s.indexOf('\n    }\n', s.indexOf(`function ${fn}(act, first) {`)));
    assert.ok(body.length > 1000, `${f}: the ladder is the function`);
    assert.equal((body.replace(/^\s*\/\/.*$/gm, '').match(/\breturn;/g) ?? []).length, 0, `${f}: no arm returns nothing - each says whether the press was used`);
    assert.match(body, /if \(first && hudShortcutKey\(e, keys\)\) \{ e\.preventDefault\(\); return true; \}/, `${f}: a shared F10 cannot flip the HUD twice`);
    assert.match(body, /\n {6}return false;$/, `${f}: an action no arm takes leaves the press unused`);
  }
  // ...and the small readers ask for the action among a shared key's, never "is it the first"
  assert.match(read('src/scenes/interior.js'), /if \(actionsOf\(e, keys\)\.includes\('AutoMap'\)\)/);
  assert.match(read('src/scenes/townTalk.js'), /const m = actionsOf\(e, keys\)\.map\(\(a\) => MODE_ACTIONS\[a\]\)\.find\(Boolean\);/);
  assert.match(read('src/ui/spellbookWindow.js'), /codeMeans\(bindings\(\), code, 'CastSpell'\)/);
  assert.match(read('src/ui/travelMapWindow.js'), /codeMeans\(bindings\(\), code, 'TravelMap'\)/);
  assert.match(read('src/ui/enhancedChronicle.js'), /eventMeans\(e, 'LogBook'\)/);
});

// ── THE LAW, STAGED ──────────────────────────────────────────────

test('UXB1-S: "use it for both" is offered where every holder holds this very key - not for a combo against its modifier, not for the action\'s own other slot - and the apply writes what it staged', () => {
  const store = defaults();
  const u = createUnsavedKeybinds(store);
  const space = currentDict(u).get('Jump');
  const holders = bindingHolders(u, 'FloatUp', space);
  assert.deepEqual(holders.map((h) => h.action), ['Jump']);
  assert.equal(canShareKey(u, 'FloatUp', space, holders), true);
  const combo = bindingHolders(u, 'Rest', 'ShiftLeft+KeyT');
  assert.ok(combo.length, 'Run\'s bare Shift clashes with a Shift combo');
  assert.equal(canShareKey(u, 'Rest', 'ShiftLeft+KeyT', combo), false, 'a clash no press resolves is not offered as a share');
  u.usingPrimary = false;
  const own = bindingHolders(u, 'Jump', space);
  assert.equal(canShareKey(u, 'Jump', space, own), false, 'its own other slot is the key moving, not a share');
  u.usingPrimary = true;
  assert.deepEqual(replacePromptRows(u, { action: 'FloatUp', code: space, holders }).at(-1), SHARE_KEY_ROW, 'the classic box says so');
  assert.equal(replacePromptRows(u, { action: 'Rest', code: 'ShiftLeft+KeyT', holders: combo }).includes(SHARE_KEY_ROW), false);
  stageShare(u, 'FloatUp', space);
  assert.deepEqual(keySharers(u, 'Jump', space), ['FloatUp']);
  assert.deepEqual(keySharers(u, 'FloatUp', space), ['Jump']);
  const d = checkDuplicates(u);
  assert.equal(d.ok, true);
  assert.equal(d.shared.has(space), true);
  applyUnsavedKeybinds(store, u);
  assert.deepEqual(actionsForCode(store, space), ['Jump', 'FloatUp']);
});

// ── THE PAGES ────────────────────────────────────────────────────

function fakeEl(tag) {
  const n = {
    tag, tagName: tag.toUpperCase(), children: [], className: '', textContent: '', title: '', style: {}, dataset: {}, attrs: {},
    onclick: null, oncontextmenu: null,
    append(...cs) { for (const c of cs) { n.children.push(c); c.parent = n; } },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener() {}, removeEventListener() {},
  };
  return n;
}
const find = (n, cls, out = []) => {
  if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n);
  for (const c of n.children ?? []) find(c, cls, out);
  return out;
};
const textOf = (n, out = []) => { if (n.textContent) out.push(n.textContent); for (const c of n.children ?? []) textOf(c, out); return out; };

test('UXB1-S: the enhanced page - a key in use offers "Use for both"; the answer stages the share, both rows turn green and name each other, and Confirm writes it', () => {
  const store = defaults();
  setBindings(store);
  discardControlsStaging();
  const listeners = [];
  globalThis.document = {
    createElement: (t) => fakeEl(t),
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    removeEventListener: (type, fn) => { const i = listeners.findIndex((l) => l.type === type && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
  };
  const view = { body: fakeEl('div') };
  const render = () => { view.body = fakeEl('div'); paneControls(view.body, { render }); };
  try {
    paneControls(view.body, { render });
    const space = getBinding(store, 'Jump');
    find(view.body, 'ctl-key').find((k) => k.dataset.action === 'FloatUp').onclick();
    listeners.find((l) => l.type === 'keydown').fn({ code: space, preventDefault() {}, stopPropagation() {} });
    const both = find(view.body, 'ctl-share')[0];
    assert.ok(both, 'the third answer is offered');
    assert.equal(both.textContent, SHARE_KEY_LABEL);
    both.onclick();
    assert.equal(controlsStaging().primary.get('FloatUp'), space);
    assert.equal(controlsStaging().primary.get('Jump'), space, 'the holder keeps it');
    const rows = find(view.body, 'ctl-row');
    const rowOf = (a) => rows.find((r) => find(r, 'ctl-key')[0].dataset.action === a);
    for (const [a, other] of [['Jump', 'Float up'], ['FloatUp', 'Jump']]) {
      assert.ok(find(rowOf(a), 'ctl-shared').length, `${a}'s key is marked shared`);
      assert.match(textOf(find(rowOf(a), 'ctl-alsos')[0]).join(''), new RegExp(`^${SHARED_KEY_PREFIX} .*${other}`), `${a}'s row names the other`);
    }
    find(view.body, 'act').find((x) => x.textContent === CONFIRM_LABEL).onclick();
    assert.deepEqual(actionsForCode(store, space), ['Jump', 'FloatUp'], 'Confirm wrote the share to the live registry');
  } finally {
    discardControlsStaging();
    delete globalThis.document;
    setBindings(null);
  }
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.ctl-key\.ctl-shared \{ color: #6fcf8a;/, 'its own colour, neither of DFU\'s two');
  // ...and it READS in both faces: the door's `.shell .act` outranked the bare two-class rule, so on the main menu's
  // Settings even DFU's red clash drew as a plain key (measured in a browser: the key's computed colour was the bone)
  for (const st of ['ctl-dupe', 'ctl-cross', 'ctl-shared']) {
    assert.match(css, new RegExp(`\\.shell \\.ctl-key\\.${st}, \\.px-sys \\.ctl-key\\.${st} \\{`), `${st} wins in both faces`);
  }
  // ...and the question the key raised stands in a head backed SOLID - the cards are a 35% wash, and a sticky one was
  // read with the rows scrolling under it printed through its words
  assert.match(css, /\.shell \.card\.ctl-head, \.px-sys \.card\.ctl-head \{ background: #0d1014; \}/);
});

test('UXB1-S: the classic grid - its replace box takes B for "both", draws the share in its own colour, and closes on it', () => {
  const store = defaults();
  setBindings(store);
  try {
    const grid = new ControlsWindow({});
    const space = getBinding(store, 'Jump');
    grid.capture = 'FloatUp';
    grid.input(space);
    assert.equal(grid.top, 'replace', 'a held key is asked for');
    grid.input('KeyB');
    assert.equal(grid.top, null, 'B answered it');
    assert.equal(grid.unsaved.primary.get('FloatUp'), space);
    assert.equal(grid.unsaved.primary.get('Jump'), space);
    assert.equal(grid.dupes.shared.has(space), true);
    assert.equal(grid.dupes.ok, true, 'a share does not hold the window');
    grid.input('Escape');
    assert.equal(grid.done, true, 'the back door closes it - and applies');
    assert.deepEqual(actionsForCode(store, space), ['Jump', 'FloatUp']);
  } finally { setBindings(null); }
  assert.match(read('src/ui/controlsWindow.js'), /this\.dupes\.shared\?\.has\(code\) \? SHARED_KEY_COLOR : TEXT_COLOR/);
  assert.match(read('src/ui/mouseControlsWindow.js'), /this\.dupes\.shared\?\.has\(code\) \? SHARED_KEY_COLOR : TEXT_COLOR/);
  assert.equal(SHARED_KEY_COLOR.length, 4);
  assert.equal(JUMP(), 'Space', '(the fixture\'s key)');
});
