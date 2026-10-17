// TUT1 (2026-10-11, Mac: "replace the current DFU tutorial with our own custom tutorial that not only explains how to
// play, but has popups for whenever you are interacting with a new system ... dont mention daggerfall ... a menu
// section where tutorials can be revisited. This needs to be comprehensive").
//
// The catalogue's rules (systems/tutorialCatalogue.js), the read list on the prefs shelf (systems/tutorials.js), the
// trigger and its popup line (ui/tutorialPopup.js) driven through fake seams, the seams themselves swept both ways
// (every popping page has a seam; every seam names a page), the menu's Tutorials tab and section, the four hosts'
// registration, and the DFU tutorial's retirement (scenes/quest/questBridge.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TUTORIALS, TUTORIAL_GROUPS, TUTORIAL_TOUR, tutorialById, tutorialsIn, tutorialRows, tutorialText, fillKeys, wrapTutorialText,
  seenTutorials, markTutorialsSeen, markTutorialSeen, forgetTutorialsSeen, isTutorialSeen, tutorialDue, tutorialPopupsOn,
  setTutorialPopups, noteFirstUse, setTutorialHandler, _resetTutorialTriggerForTests, TUTORIAL_WRAP,
} from '../../src/systems/tutorials.js';
import { MENU_ONLY } from '../../src/systems/tutorialCatalogue.js';
import { ACTIONS, DEFAULT_BINDINGS, DEFAULT_SHARES } from '../../src/systems/inputActions.js';
import { _resetForTests as resetPrefs, getPref, PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import {
  tutorialFirstUse, startTutorialTour, showTutorialNow, tutorialLine, clearTutorialLine, _setTutorialDepsForTests,
  TutorialBox, SHOW_DELAY_MS, RETRY_MS, SCENE_CHANGE_TUTORIAL_MS, INPUT_GRACE_MS, WATCH_MS, boundKeyName, keyWord,
} from '../../src/ui/tutorialPopup.js';
import { tutorialsMatching } from '../../src/ui/tutorialsPane.js';
import { GAME_START_QUESTS, retireDfuTutorial } from '../../src/scenes/quest/questBridge.js';
import { registerPresenter, windowHeld, _resetNotifyForTests } from '../../src/systems/notify.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const textOf = (t) => [t.title, t.trigger, ...t.body, ...(t.points ?? [])].join('\n');

function fresh() {
  resetPrefs();
  forgetTutorialsSeen();
  setTutorialPopups(true);
}

// ── THE CATALOGUE ──────────────────────────────────────────────

test('TUT1: the catalogue - unique ids, real groups (each one used), the tour\'s pages real and in order, every page with words and a trigger', () => {
  const ids = TUTORIALS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'one page, one id');
  const groups = TUTORIAL_GROUPS.map((g) => g.id);
  for (const t of TUTORIALS) {
    assert.ok(groups.includes(t.group), `${t.id}: its group ${t.group} is a menu section`);
    assert.ok(t.title && t.trigger && t.body.length, `${t.id}: a title, a trigger and words`);
    assert.ok(Object.isFrozen(t) && Object.isFrozen(t.body), `${t.id}: frozen`);
  }
  for (const g of groups) assert.ok(tutorialsIn(g).length, `${g}: a section with no page is a hole in the menu`);
  assert.deepEqual([...TUTORIAL_TOUR], ['welcome', 'movement', 'interacting', 'hud', 'menu']);
  for (const id of TUTORIAL_TOUR) assert.ok(tutorialById(id), `${id}: a tour page is a page`);
  assert.equal(tutorialById('nope'), null);
  assert.ok(TUTORIALS.length >= 60, `comprehensive: ${TUTORIALS.length} pages`);
});

test('TUT1: the game is DFO - no page names the old game, its capital or DFU, and the welcome says DFO', () => {
  for (const t of TUTORIALS) {
    assert.doesNotMatch(textOf(t), /daggerfall|\bDFU\b|unity/i, `${t.id} names the old game`);
  }
  for (const g of TUTORIAL_GROUPS) assert.doesNotMatch(g.title, /daggerfall/i);
  assert.match(tutorialById('welcome').title, /\bDFO\b/);
  // and the rows a popup shows carry no more than the page does
  for (const t of TUTORIALS) {
    const rows = tutorialRows(t, { keyName: () => 'K' }).map((r) => (typeof r === 'string' ? r : r.text)).join('\n');
    assert.doesNotMatch(rows, /daggerfall/i);
  }
});

test('TUT1: a key is written {Action} - every one a real action with a default key, and no page names a raw key', () => {
  const bound = new Set([...DEFAULT_BINDINGS.map(([, a]) => a), ...DEFAULT_SHARES.map(([, a]) => a)]);
  const all = new Set(ACTIONS);
  for (const t of TUTORIALS) {
    for (const [, action] of textOf(t).matchAll(/\{([A-Za-z0-9]+)\}/g)) {
      assert.ok(all.has(action), `${t.id}: {${action}} is no action`);
      assert.ok(bound.has(action), `${t.id}: {${action}} has no default key - the page would read [unbound]`);
    }
    // a key named in words would lie the moment it is rebound
    assert.doesNotMatch(textOf(t), /\b(press|hold) (F\d+|[A-Z])\b/, `${t.id} names a key instead of an action`);
  }
});

test('TUT1: a page fits a popup - every wrapped line within the measure, no page taller than the panel holds', () => {
  for (const t of TUTORIALS) {
    const rows = tutorialRows(t, { keyName: () => 'NUMPAD ENTER' });
    for (const r of rows) {
      const text = typeof r === 'string' ? r : r.text;
      if (typeof r === 'string') assert.ok(text.length <= TUTORIAL_WRAP + 8, `${t.id}: "${text}" overruns the measure`);
    }
    assert.ok(rows.length <= 16, `${t.id}: ${rows.length} rows - too tall for a popup`);
    // TUT1 audit (Mac: "Ensure explanations dont sound AI and arent overloaded"): two paragraphs at most, three points
    // at most, and no page over sixty words
    assert.ok(t.body.length <= 2 && (t.points ?? []).length <= 3, `${t.id}: too many parts`);
    const words = [...t.body, ...(t.points ?? [])].join(' ').split(/\s+/).length;
    assert.ok(words <= 60, `${t.id}: ${words} words`);
  }
});

test('TUT1: fillKeys names the bound key or says it is unbound; wrapTutorialText wraps greedily and keeps every word', () => {
  assert.equal(fillKeys('Press {Inventory} or {Nope}.', (a) => (a === 'Inventory' ? 'F6' : null)), 'Press [F6] or [unbound].');
  assert.equal(fillKeys('no keys'), 'no keys');
  assert.deepEqual(wrapTutorialText('aaa bbb cccc', 7), ['aaa bbb', 'cccc'], 'cccc alone stays: bbb cccc would not fit');
  assert.deepEqual(wrapTutorialText('aaa bbb ccc', 7), ['aaa', 'bbb ccc'], 'ccc takes bbb down with it');
  assert.deepEqual(wrapTutorialText('aa bb cc dd', 8), ['aa bb', 'cc dd'], 'a word alone on the last line takes one from above');
  assert.deepEqual(wrapTutorialText('averyveryverylongword x', 5), ['averyveryverylongword', 'x']);
  assert.deepEqual(wrapTutorialText('  ', 10), []);
  const words = 'the quick brown fox jumps over the lazy dog '.repeat(9).trim();
  assert.equal(wrapTutorialText(words, 20).join(' '), words);
  const { body, points } = tutorialText(tutorialById('combat'), (a) => a.toUpperCase());
  assert.match(body[0], /\[READYWEAPON\] draws/);
  assert.ok(points.length);
});

test('TUT1: the popup\'s rows - the title first (centred, its own face), the words, nothing after them; a tour page numbered', () => {
  const rows = tutorialRows(tutorialById('inventory'), { keyName: () => 'X' });
  assert.deepEqual(rows[0], { text: 'Inventory', center: true, cls: 'tut-title' });
  assert.equal(rows.at(-1), 'don\'t need.', 'the last row is the page\'s own last words - no foot (TUT1 audit), and no word alone on it');
  assert.ok(rows.every((r, i) => i === 0 || typeof r === 'string'), 'only the title is a record');
  assert.match(tutorialById('welcome').body.join(' '), /Menu > Tutorials/, 'the welcome page says where every page is read again');
  assert.equal(tutorialRows(tutorialById('welcome'), { page: 2, pages: 5 })[0].text, 'Welcome to DFO  (2 of 5)');
  // points are dashed, their second lines indented
  const pts = tutorialRows(tutorialById('combat'), { keyName: () => 'K' }).filter((r) => typeof r === 'string' && /^(- | {2})/.test(r));
  assert.ok(pts[0].startsWith('- ') && pts.some((r) => r.startsWith('  ')));
});

// ── THE SHELF ──────────────────────────────────────────────────

test('TUT1: the read list - on the prefs shelf, catalogue ids only, in catalogue order; Show all again forgets it; the popups\' switch', () => {
  assert.equal(PREF_DEFAULTS.tutorialPopups, true);
  assert.equal(PREF_DEFAULTS.tutorialsSeen, null);
  fresh();
  assert.equal(seenTutorials().size, 0);
  assert.equal(tutorialDue('inventory'), true);
  assert.equal(markTutorialsSeen(['rest', 'bogus', 'inventory']), true);
  assert.deepEqual(getPref('tutorialsSeen'), ['inventory', 'rest'], 'catalogue order, the unknown id dropped');
  assert.equal(markTutorialSeen('rest'), false, 'nothing new, nothing written');
  assert.equal(isTutorialSeen('inventory'), true);
  assert.equal(tutorialDue('inventory'), false);
  assert.equal(tutorialDue('nope'), false, 'no such page is never due');
  setTutorialPopups(false);
  assert.equal(tutorialPopupsOn(), false);
  assert.equal(tutorialDue('talk'), false, 'popups off: nothing pops');
  setTutorialPopups(true);
  forgetTutorialsSeen();
  assert.equal(seenTutorials().size, 0);
  assert.equal(tutorialDue('inventory'), true);
});

test('TUT1: noteFirstUse - a page read or popups off answers at once; before the popup module registers, a few triggers wait for it', () => {
  fresh();
  _resetTutorialTriggerForTests();
  assert.equal(noteFirstUse('inventory'), false, 'no handler yet: it waits');
  noteFirstUse('inventory');   // never twice
  noteFirstUse('talk');
  const got = [];
  const off = setTutorialHandler((id, o) => { got.push([id, o?.after ?? 0]); return true; });
  assert.deepEqual(got, [['inventory', 0], ['talk', 0]], 'the early triggers handed over, once each');
  assert.equal(noteFirstUse('rest', { after: 4000 }), true);
  assert.deepEqual(got.at(-1), ['rest', 4000]);
  markTutorialSeen('bank');
  assert.equal(noteFirstUse('bank'), false, 'a page read never pops');
  off();
  _resetTutorialTriggerForTests();
});

// ── THE POPUP LINE ─────────────────────────────────────────────

function rig({ take = true } = {}) {
  let now = 0;
  let held = false;
  const timers = [];
  const mounted = [];
  _setTutorialDepsForTests({
    mount: (w) => { if (typeof take === 'function' ? !take(w) : !take) return false; mounted.push(w); return true; },
    setTimeout: (fn, ms) => { const t = { fn, at: now + ms }; timers.push(t); return t; },
    clearTimeout: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); },
    now: () => now,
    keyName: (a) => `<${a}>`,
    doc: () => null,
    held: () => held,
    win: () => null,   // no presses watched unless a test hands a window
    isHeld: () => null,   // no host can say, unless a test answers
  });
  const advance = (ms) => {
    now += ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > now) break;
      timers.shift();
      t.fn();
    }
  };
  // a page is read the way a player reads it: drawn, stood on screen past the grace, then a press
  const read = (box) => { box.markShown(); advance(INPUT_GRACE_MS); box.input(); };
  return { mounted, advance, timers, read, setTake: (v) => { take = v; }, setHeld: (v) => { held = v; } };
}
const flush = () => new Promise((r) => setTimeout(r, 0));   // the box's onClose is deferred past its dismissal

test('TUT1: the first touch pops its page a beat late, over the window just opened; dismissed, it is read and the next waits its turn', async () => {
  fresh();
  const r = rig();
  assert.equal(tutorialFirstUse('inventory'), true);
  assert.equal(tutorialFirstUse('inventory'), false, 'queued once');
  assert.equal(tutorialFirstUse('talk'), true);
  r.advance(SHOW_DELAY_MS - 1);
  assert.equal(r.mounted.length, 0, 'not before the beat - the window holds the slot first');
  r.advance(1);
  assert.equal(r.mounted.length, 1);
  const box = r.mounted[0];
  assert.ok(box instanceof TutorialBox && box.tutorial);
  assert.equal(box.lines[0].text, 'Inventory');
  assert.ok(box.lines.some((l) => typeof l === 'string' && l.includes('[<Inventory>]')), 'the key filled from the live binding');
  assert.equal(box.pauseWhileOpen, true, 'modal, as a message box is');
  assert.deepEqual(tutorialLine(), { waiting: [['talk']], showing: ['inventory'] });
  r.advance(10_000);
  assert.equal(r.mounted.length, 1, 'one at a time');
  assert.equal(isTutorialSeen('inventory'), false, 'raised is not read');
  r.read(box);   // a key or a click
  assert.equal(box.done, true);
  await flush();
  assert.equal(isTutorialSeen('inventory'), true, 'read when dismissed');
  r.advance(SHOW_DELAY_MS);
  assert.equal(r.mounted.length, 2);
  assert.equal(r.mounted[1].lines[0].text, 'Talking');
  box.dispose();   // a host tidying a box already read is no replacement
  assert.deepEqual(tutorialLine().waiting, []);
  clearTutorialLine();
});

test('TUT1: a box REPLACED before it is read goes back to the front and is offered again; a box no host takes waits and retries', async () => {
  fresh();
  const r = rig();
  tutorialFirstUse('spellbook');
  r.advance(SHOW_DELAY_MS);
  const first = r.mounted[0];
  first.dispose();   // the host's showOverlay put another window in the slot
  assert.equal(isTutorialSeen('spellbook'), false);
  assert.deepEqual(tutorialLine(), { waiting: [['spellbook']], showing: null });
  r.advance(RETRY_MS);
  assert.equal(r.mounted.length, 2, 'offered again');
  r.read(r.mounted[1]);
  await flush();
  assert.equal(isTutorialSeen('spellbook'), true);

  r.setTake(false);
  tutorialFirstUse('rest');
  r.advance(SHOW_DELAY_MS);
  assert.equal(r.mounted.length, 2, 'no host took it');
  assert.deepEqual(tutorialLine().waiting, [['rest']]);
  r.setTake(true);
  r.advance(RETRY_MS);
  assert.equal(r.mounted.length, 3);
  assert.equal(r.mounted[2].lines[0].text, 'Resting');
  clearTutorialLine();
});

test('AUDIT TUT1: a page is read, not swatted - no input before it is drawn and has stood its grace, none from a held key or the click that was already down, the first fresh press after it puts it away', async () => {
  fresh();
  const listeners = {};
  const win = { addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); } };
  const r = rig();
  _setTutorialDepsForTests({ win: () => win });
  const press = (type, repeat = false) => { for (const fn of listeners[type] ?? []) fn({ repeat }); };
  tutorialFirstUse('combat');
  r.advance(SHOW_DELAY_MS);
  const box = r.mounted[0];
  press('mousedown');   // the attack click that drew the weapon, down before the page was seen
  box.input();
  assert.equal(box.done, false, 'not drawn yet: nothing reaches it');
  box.markShown();
  r.advance(INPUT_GRACE_MS - 1);
  press('keydown');   // W pressed as the page appears...
  box.input();
  assert.equal(box.done, false, 'inside the grace');
  r.advance(1);
  press('keydown', true);   // ...and held: the browser's repeats
  box.input();
  assert.equal(box.done, false, 'a key pressed in the grace and held through it is not a reading');
  box.input();
  assert.equal(box.click(), true, 'a click it is not ready for is still its own, never the world\'s');
  assert.equal(box.done, false, 'a repeat is no fresh press');
  press('keydown');
  box.input();
  assert.equal(box.done, true, 'a fresh press after it appeared puts it away');
  await flush();
  assert.equal(isTutorialSeen('combat'), true);
  clearTutorialLine();
});

test('AUDIT TUT1: the watchdog - a page no host holds any more (dropped from a slot by hand, told nothing) is offered again; a page merely covered is held and waits', () => {
  fresh();
  let holds = true;
  const r = rig();
  _setTutorialDepsForTests({ isHeld: () => holds });
  tutorialFirstUse('inventory');
  r.advance(SHOW_DELAY_MS);
  const first = r.mounted[0];
  r.advance(WATCH_MS * 5);
  assert.equal(r.mounted.length, 1, 'covered or on top, it is held: it waits');
  assert.deepEqual(tutorialLine().showing, ['inventory']);
  holds = false;   // the dungeon's pack crossed to the sheet by writing its slot
  r.advance(WATCH_MS);
  assert.deepEqual(tutorialLine().showing, ['inventory'], 'one miss is not enough');
  r.advance(WATCH_MS);
  assert.equal(tutorialLine().showing, null, 'twice no: it is let go');
  holds = true;
  r.advance(RETRY_MS);
  assert.equal(r.mounted.length, 2, 'and offered again');
  assert.notEqual(r.mounted[1], first);
  clearTutorialLine();
});
test('AUDIT TUT1: windowHeld asks every live host - true when one holds the window, false when none does, null when no host can say; the three presenters answer from their stacks', () => {
  _resetNotifyForTests();
  const box = {};
  assert.equal(windowHeld(box), null, 'no presenter');
  const off1 = registerPresenter({ mount: () => true });
  assert.equal(windowHeld(box), null, 'a presenter that cannot say');
  let mine = false;
  const off2 = registerPresenter({ mount: () => true, holds: (w) => mine && w === box });
  assert.equal(windowHeld(box), false);
  mine = true;
  assert.equal(windowHeld(box), true);
  const off3 = registerPresenter({ mount: () => true, holds: () => { throw new Error('never asked'); }, active: () => false });
  assert.equal(windowHeld(box), true, 'a dormant host is not asked');
  off1(); off2(); off3();
  _resetNotifyForTests();
  assert.match(read('src/scenes/townTalk.js'), /\n  registerPresenter\(\{ holds: \(win\) => windows\.containsWindow\(win\) \}\);/);
  assert.match(read('src/scenes/worldModes.js'), /\n  registerPresenter\(\{ holds: \(win\) => interiorWindows\.containsWindow\(win\) \}\);/);
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /const _unregisterHolds = registerPresenter\(\{ holds: \(win\) => dungeonWindows\.containsWindow\(win\), active: \(\) => _live && !_ctxDead \}\);/);
  assert.match(dc, /destroy\(\) \{\n      _ctxDead = true;[\s\S]{0,2000}\n      _unregisterHolds\(\);/, 'and it leaves with the context');
});

test('AUDIT TUT1: a page waits out the loading screen; a scene\'s page is asked for once, by the build that stands it (an Ocean Hole\'s door pops none of its own)', () => {
  const pop = read('src/ui/tutorialPopup.js');
  assert.match(pop, /held: \(\) => pauseFlowShowing\(\) \|\| loadingHeld\(\),/);
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /\(Number\(dfLocation\?\.mapTableData\?\.mapId\) >>> 0\) >= 0x60000000 \? 'ocean-holes'/, 'the Ocean Hole\'s page is the build\'s');
  assert.doesNotMatch(read('src/scenes/worldModes.js'), /noteFirstUse\('ocean-holes'/, 'and its door asks for none');
  // another player's team is theirs: only my own horse and wagon keys pop a page
  assert.match(read('src/scenes/horseCartPool.js'), /if \(key === KEY_WAGON \|\| key === KEY_FOLLOWING_WAGON\) noteFirstUse\('wagon'\); else if \(key === KEY_HORSE\) noteFirstUse\('horse'\);/);
  // a refusal opens nothing, and pops nothing
  assert.match(read('src/ui/tradeDoor.js'), /if \(sup\) \{ messageBox\(sup\.text\); return null; \}\n {2}noteFirstUse\('shops'\);/);
  assert.match(read('src/systems/daedraSummoning.js'), /if \(gold < cost\) return \{ kind: 'poor', cost \};\n {2}noteFirstUse\('daedra-summoning'\);/);
});

test('TUT1: while the menu stands a page waits - never pushed over the pause window - and shows once it is down', () => {
  fresh();
  const r = rig();
  r.setHeld(true);
  tutorialFirstUse('bank');
  r.advance(SHOW_DELAY_MS + RETRY_MS * 3);
  assert.equal(r.mounted.length, 0, 'not over the menu');
  assert.deepEqual(tutorialLine().waiting, [['bank']]);
  r.setHeld(false);
  r.advance(RETRY_MS);
  assert.equal(r.mounted.length, 1);
  const pd = read('src/ui/pauseDoor.js');
  assert.match(pd, /export function openPauseFlow\(show, hooks = \{\}\) \{\n  return shown\(openPauseFlowNow\(show, hooks\)\);/, 'the door keeps the window it opened');
  assert.match(pd, /\? \(\) => shown\(enhancedPauseOverlay\(show, \{ \.\.\.hooks, at: 'settings', onResume: again \}\)\)/, 'AUDIT TUT1: the classic window\'s Settings detour is kept too');
  assert.match(pd, /const openClassicPauseFlow = \(show, hooks\) => shown\(openClassicPauseWindow\(show, hooks\)\);/, '...and every classic window, the one its Resume opens again among them');
  clearTutorialLine();
});

test('TUT1: a scene change holds its page back; a page read meanwhile, or the popups turned off, does not show', async () => {
  fresh();
  const r = rig();
  tutorialFirstUse('oblivion-gate', { after: SCENE_CHANGE_TUTORIAL_MS });
  tutorialFirstUse('bank');
  r.advance(SHOW_DELAY_MS);
  assert.equal(r.mounted[0].lines[0].text, 'Banks', 'the page that is due goes before the one held back');
  r.read(r.mounted[0]);
  await flush();
  r.advance(SHOW_DELAY_MS);
  assert.equal(r.mounted.length, 1, 'the gate\'s page still held');
  r.advance(SCENE_CHANGE_TUTORIAL_MS);
  assert.equal(r.mounted.length, 2);
  assert.match(r.mounted[1].lines[0].text, /Dagon's Breach/);
  r.read(r.mounted[1]);
  await flush();

  tutorialFirstUse('talk');
  markTutorialSeen('talk');   // read in the menu before it popped
  tutorialFirstUse('tavern');
  setTutorialPopups(false);
  r.advance(SHOW_DELAY_MS * 4);
  assert.equal(r.mounted.length, 2, 'neither shows');
  assert.deepEqual(tutorialLine(), { waiting: [], showing: null });
  clearTutorialLine();
});

test('TUT1: the welcome tour is ONE box of its unread pages, numbered, first in line; its last dismissal reads them all', async () => {
  fresh();
  markTutorialSeen('hud');
  const r = rig();
  tutorialFirstUse('combat');
  assert.equal(startTutorialTour(), true);
  assert.equal(startTutorialTour(), false, 'once');
  r.advance(SHOW_DELAY_MS);
  const box = r.mounted[0];
  assert.equal(box.lines[0].text, 'Welcome to DFO  (1 of 4)', 'the tour goes before the combat page, without the page already read');
  for (let i = 0; i < 3; i++) { r.read(box); assert.equal(box.done, false); }
  assert.match(box.lines[0].text, /\(4 of 4\)$/);
  assert.equal(isTutorialSeen('welcome'), false);
  r.read(box);
  await flush();
  for (const id of TUTORIAL_TOUR) assert.equal(isTutorialSeen(id), true, `${id} read`);
  r.advance(SHOW_DELAY_MS);
  assert.equal(r.mounted[1].lines[0].text, 'Fighting');
  clearTutorialLine();
  // a tour whose every page is read does not stand at all
  assert.equal(startTutorialTour(), false);
});

test('TUT1: showTutorialNow shows a page already read; boundKeyName names a bound key and nothing for an unbound one', async () => {
  fresh();
  markTutorialSeen('bank');
  const r = rig();
  assert.equal(showTutorialNow('bank'), true);
  assert.equal(showTutorialNow('nope'), false);
  r.advance(SHOW_DELAY_MS);
  assert.equal(r.mounted[0].lines[0].text, 'Banks');
  clearTutorialLine();
  const store = { getAction: () => null };
  assert.equal(boundKeyName('Inventory', store), null, 'a store that binds nothing names nothing');
  // TUT1 audit: a key as the keyboard prints it, never DFU's own spelling ("A1", "BCKSPC", "KPADDIVIDE")
  assert.deepEqual(['Digit1', 'Backspace', 'NumpadDivide', 'KeyW', 'ShiftLeft', 'F6', 'Numpad7', 'Mouse1'].map(keyWord),
    ['1', 'BACKSPACE', 'NUMPAD /', 'W', 'SHIFT', 'F6', 'NUMPAD 7', 'RIGHT CLICK']);
});

// ── THE SEAMS ──────────────────────────────────────────────────

function srcFiles(dir) {
  const out = [];
  for (const f of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${f}`;
    if (statSync(join(ROOT, p)).isDirectory()) out.push(...srcFiles(p));
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}

test('TUT1: the seams, swept both ways - every page that pops has a seam in src/, and every seam names a page', () => {
  const named = new Map();
  for (const f of srcFiles('src')) {
    const s = read(f);
    for (const m of s.matchAll(/noteFirstUse\(([^;]*?)\)(?:;|\s*[}|&])/g)) {
      for (const [, id] of m[1].matchAll(/(?<!=== )'([a-z][a-z-]*)'/g)) {   // a ternary's test ('notes') is no page
        if (!named.has(id)) named.set(id, new Set());
        named.get(id).add(f);
      }
    }
  }
  for (const id of named.keys()) assert.ok(tutorialById(id), `${[...named.get(id)].join(', ')}: noteFirstUse('${id}') names no page`);
  const silent = TUTORIALS.filter((t) => !TUTORIAL_TOUR.includes(t.id) && t.trigger !== MENU_ONLY && !named.has(t.id)).map((t) => t.id);
  assert.deepEqual(silent, [], 'a page that says it pops has a seam that pops it');
  const menuOnly = TUTORIALS.filter((t) => t.trigger === MENU_ONLY).map((t) => t.id);
  for (const id of menuOnly) assert.ok(!named.has(id), `${id} says it is read in the menu, and a seam pops it`);
  assert.ok(named.size >= 50, `${named.size} systems wired`);
  // the shared doors carry their pages (one door, every host)
  for (const [file, id] of [['src/ui/inventoryDoor.js', 'inventory'], ['src/ui/spellbookDoor.js', 'spellbook'], ['src/ui/restDoor.js', 'rest'],
    ['src/ui/talkDoor.js', 'talk'], ['src/ui/tradeDoor.js', 'shops'], ['src/ui/travel/travelMapDoor.js', 'travel-map'], ['src/ui/automap/automapDoor.js', 'automap'],
    ['src/ui/charSheetDoor.js', 'character-sheet'], ['src/ui/tavernDoor.js', 'tavern'], ['src/ui/chronicleDoor.js', 'quests']]) {
    assert.ok(named.get(id)?.has(file), `${file} pops ${id}`);
  }
});

test('TUT1: the four hosts register the popups\' handler (THE FOUR HOSTS RULE); the two new-game seams start the tour after the game-start quests', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(read(host), /^import (?:[^;]*from )?'\.\.\/ui\/tutorialPopup\.js';/m, `${host} loads ui/tutorialPopup.js`);
  }
  assert.match(read('src/ui/tutorialPopup.js'), /^setTutorialHandler\(tutorialFirstUse\);$/m, 'the module registers itself');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(host), /questBridge\.initAtGameStart\(\);\n\s+startTutorialTour\(\);/, `${host}: the tour where _TUTOR__ spoke`);
  }
});

// ── THE MENU ───────────────────────────────────────────────────

test('TUT1: the menu - a Tutorials tab in the pause window, a Tutorials section on every rail, one pane for both, let go at unmount', () => {
  const s = read('src/ui/enhanced/enhancedMenu.js');
  assert.match(s, /const PAUSE_TABS = Object\.freeze\(\[[^\n]*\['tutorials', 'Tutorials'\], \['system', 'System'\]\]\);/);
  assert.match(s, /tutorials: drawTutorialsPane, system: pauseSystem \}\)\[pauseTab\]\(body\);/);
  for (const rail of ['SECTIONS_BOOT', 'SECTIONS_CLASSIC', 'SECTIONS_PAUSE']) {
    assert.match(s, new RegExp(`const ${rail} = \\[[^\\]]*'Tutorials'`), `${rail} carries Tutorials`);
  }
  assert.match(s, /\n {8}tutorials: drawTutorialsPane, {3}\/\/ TUT1\n/, 'the shell draws the same pane');
  assert.match(s, /stopPost\(\);   \/\/ SERVER-POST[^\n]*\n\s+releaseTutorialsPane\(\);/);
});

test('TUT1: the pane\'s search keeps the pages whose title or words hold every word asked; nothing asked keeps them all', () => {
  assert.equal(tutorialsMatching('').length, TUTORIALS.length);
  const ships = tutorialsMatching('sail helm').map((t) => t.id);
  assert.ok(ships.includes('ships'));
  assert.ok(!ships.includes('inventory'));
  assert.deepEqual(tutorialsMatching('zzzz qqqq'), []);
  assert.ok(tutorialsMatching('DAGON').some((t) => t.id === 'oblivion-gate'), 'case does not matter');
});

// ── THE DFU TUTORIAL, RETIRED ──────────────────────────────────

test('TUT1: a new character starts the curse _TUTOR__\'s close started, and the main quest - not DFU\'s tutorial', () => {
  assert.deepEqual([...GAME_START_QUESTS], ['S0000977', '_BRISIEN']);
  assert.match(read('vendor/dfu-quests/Quests/_TUTOR__.txt'), /_no_ task:\n\tstart quest 977 977/, 'what the tutorial did besides its pages');
});

test('TUT1: a save still in DFU\'s tutorial leaves it at the load, and starts the curse unless it holds it; a finished one is left alone', () => {
  const mk = (names) => {
    const quests = new Map(names.map((n, i) => [i + 1, { uid: i + 1, questName: n[0], questComplete: !!n[1], questTombstoned: false }]));
    const removed = [];
    const started = [];
    return {
      quests, removed, started,
      removeQuest(q) { removed.push(q.questName); quests.delete(q.uid); return true; },
      startQuestByName(n) { started.push(n); quests.set(99, { uid: 99, questName: n }); return quests.get(99); },
    };
  };
  const live = mk([['_TUTOR__'], ['_BRISIEN']]);
  assert.deepEqual(retireDfuTutorial(live), { retired: 1, started: true });
  assert.deepEqual(live.removed, ['_TUTOR__']);
  assert.deepEqual(live.started, ['S0000977']);
  const held = mk([['_TUTOR__'], ['s0000977']]);
  assert.deepEqual(retireDfuTutorial(held), { retired: 1, started: false }, 'the curse already held is not started twice');
  const done = mk([['_TUTOR__', true], ['S0000977']]);
  assert.deepEqual(retireDfuTutorial(done), { retired: 0, started: false });
  assert.deepEqual(done.removed, []);
  assert.deepEqual(retireDfuTutorial(null), { retired: 0, started: false });
  assert.match(read('src/scenes/quest/questBridge.js'), /relayMovedLayouts\(machine, [^\n]*\n\s+retireDfuTutorial\(machine\);/, 'at the load, once the machine is restored and its dungeons laid');
});
