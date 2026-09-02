// U51 - THE PAUSE DOOR, pinned.
//
// Escape's screen is now a decision, and this file holds the decision
// and its edges. Two kinds of assertion, kept apart on purpose:
//
//   BEHAVIOUR - the fork itself runs in node. `?skin=` is a URL and
//   uiSkin reads one from an injected string, so both branches can be
//   taken here for real rather than read off the page.
//
//   SOURCE SWEEPS, and they say so. The enhanced screen is DOM and
//   the hosts are canvases; node can drive neither. What a sweep CAN
//   hold is the structure a browser check would not notice going
//   wrong - a second copy of the design, a host that slipped back to
//   importing the classic window directly, an eager import that makes
//   the classic skin pay for a module it never shows, or a listener
//   with no owner. The screen itself is proven in a real browser by
//   tools/enhancedPauseProbe.mjs.
//
// A PIN MUST FAIL: every assertion below dies under a one-character
// change to the law it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { openPauseFlow, pauseDoorReady, pauseArtLoaded } from '../src/ui/pauseDoor.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const root = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// uiSkin reads globalThis.location.search when it is given no string,
// and node has no location. Set one, and reset the stored pref so one
// test's choice never answers for the next.
const skin = (value) => { _resetForTests(); globalThis.location = { search: `?skin=${value}` }; };

// A DOCUMENT, JUST ENOUGH OF ONE. The fork's second clause is
// `typeof document !== 'undefined'`, and node has none - so a test that
// only sets the skin takes the CLASSIC branch on both skins and passes
// for the wrong reason. Mutation M4 (drop `isEnhanced()` from the
// condition) survived the first draft of this file for exactly that
// reason, which is the vacuous-pin shape AUDIT 17e Wave 3 went hunting.
//
// The enhanced branch touches four things before it goes async, and
// this is those four. The pending dynamic import lands after the test
// body; disposing the overlay synchronously makes its `if (fired)`
// guard take the early return, which is that guard's own pin.
function withDocument(fn) {
  const node = { id: '', style: {}, removed: false, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => node, body: { append() {} } };
  try { return fn(node); } finally { delete globalThis.document; }
}

/** The same, held open across the lazy import. */
async function withDocumentAsync(fn) {
  const node = { id: '', style: {}, removed: false, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => node, body: { append() {} } };
  try { return await fn(node); } finally { delete globalThis.document; }
}

/** Let the dynamic import in pauseDoor.js land. The module is warmed
 *  first so the import resolves from the registry rather than off the
 *  disk, then a few turns of the loop for the .then to run. */
async function settleImport() {
  await import('../src/ui/enhancedMenu.js');
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

// ── THE FORK ─────────────────────────────────────────────────────

test('U51: the classic skin still gets the classic window', () => {
  skin('classic');
  withDocument(() => {
    let shown = null;
    const win = openPauseFlow((w) => { shown = w; }, { exitToMenu() {} });
    assert.equal(win?.constructor?.name, 'PauseOptionsWindow',
      'a player who chose classic must get OPTN00I0, not the DOM screen');
    assert.equal(shown, win, 'and the host gets the same object the factory returns');
  });
});

test('U51: the enhanced skin gets the DOM screen, and the host holds it', () => {
  skin('enhanced');
  withDocument((node) => {
    let shown = null;
    const win = openPauseFlow((w) => { shown = w; }, {});
    assert.notEqual(win?.constructor?.name, 'PauseOptionsWindow',
      'the enhanced skin must not get the canvas window');
    assert.equal(shown, win, 'the host slot holds it - which is what stops the motor and the clock');
    assert.equal(win.done, false, 'a screen that reports done on arrival is torn down on arrival');
    assert.equal(node.id, 'enhanced-pause');
    assert.match(node.style.cssText, /position:fixed;inset:0/,
      'over the canvas, and opaque - the renderer clears to the Iliac Bay sky');
    // dispose BEFORE the lazy import lands: the mount must take its
    // early return rather than mounting into a div already removed.
    win.dispose();
    assert.equal(win.done, true, 'dispose closes the door');
    assert.equal(node.removed, true, 'and takes the div with it');
  });
});

test('U51: a host with no document keeps the canvas window, on either skin', () => {
  // The same guard chargenSession's fork carries, for the same reason:
  // node drives these hosts headless and must not have a special case
  // written for it. `document` is undefined here, so the enhanced
  // branch cannot be taken however the skin reads.
  skin('enhanced');
  assert.equal(typeof document, 'undefined', 'this test is only meaningful headless');
  const win = openPauseFlow(() => {}, {});
  assert.equal(win?.constructor?.name, 'PauseOptionsWindow');
});

// ── THE ART GATE MOVED WITH THE DOOR ─────────────────────────────
// The four hosts gate Escape on this predicate. Classic cannot draw
// one pixel of its panel without OPTN00I0.IMG; the enhanced screen
// needs no ARENA2 at all, which is the whole premise of U49's front
// door. Gating the enhanced screen on classic art would strand a
// player whose art load failed with no pause menu, no settings and no
// way out of a game that would have rendered perfectly.
test('U51: the door needs classic art only where the classic window draws it', () => {
  assert.equal(pauseArtLoaded(), false, 'no ARENA2 in this container - that is the point');
  skin('classic');
  assert.equal(pauseDoorReady(), false, 'classic with no OPTN00I0 has nothing to draw');
  skin('enhanced');
  assert.equal(pauseDoorReady(), true, 'the enhanced screen reads no game data at all');
});

test('U51: every host gates on the door, and not on the classic art', () => {
  for (const rel of ['scenes/world.js', 'scenes/exterior.js',
    'scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    const src = read(`src/${rel}`);
    assert.match(src, /pauseDoorReady\(\)/, `${rel} must gate on the door`);
    assert.doesNotMatch(src, /pauseArtLoaded\(\)/,
      `${rel} must not gate the enhanced screen on classic art`);
    assert.match(src, /from '\.\.\/ui\/pauseDoor\.js'/,
      `${rel} reaches the pause screen through the ONE seam`);
    assert.doesNotMatch(src, /from '\.\.\/ui\/pauseWindow\.js'/,
      `${rel} must not import the classic window past the fork`);
  }
});

// ── ONE SCREEN, TWO MODES ────────────────────────────────────────
// The obvious build was a second enhanced screen for the pause menu,
// and it is the wrong one: the front door and the pause door would
// then own two copies of a settings view, which is the exact
// divergence U49 collapsed four boot screens to avoid.
test('U51: the fork asks the SKIN, not only the document', () => {
  // The behaviour pins above take both branches, and this holds the
  // condition itself: `typeof document` alone would send a classic
  // player to the DOM screen in every real browser there is.
  const src = read('src/ui/pauseDoor.js');
  assert.match(src, /if \(isEnhanced\(\) && typeof document !== 'undefined'\) return enhancedPauseOverlay\(/,
    'both clauses, in that order');
});

test('PX2: both doors open on the pixel home', () => {
  // U51's pause law was 'open on Save Game - what Escape was pressed
  // for'. PX2 replaced it deliberately (Mac's adopted face): pause
  // opens on the SAME pixel home as boot, Save Game one visible press
  // away, and Escape on the face resumes. The MEASURED half below
  // holds the resume arm - a home that cannot resume is a trap.
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /^  section = 'home';$/m);
  assert.match(src, /mode === 'pause' \? \(\) => onAction\('resume'\)/,
    'Escape on the pause face must resume');
});

test('U51: the pause door mounts the FRONT DOOR, not a second design', () => {
  const src = read('src/ui/pauseDoor.js');
  assert.match(src, /import\('\.\/enhancedMenu\.js'\)/,
    'the pause screen IS ui/enhancedMenu.js');
  // PX26 added the LANDING to this call; the law U51 guards is
  // unchanged - pause mode, the host's own hooks, one front door.
  assert.match(src, /mountEnhancedMenu\(host, \{ mode: 'pause', hooks, onAction: act, at: hooks\.at \?\? null \}\)/,
    'mounted in pause mode with the host’s own hooks');
  // and it carries no design of its own, exactly as menu.html carries
  // none - the tokens and the layout live in ui/enhancedStyle.js
  assert.ok(!/--brass|--verdigris|\.railbtn|grid-template-columns/.test(src),
    'ui/pauseDoor.js must hold no layout - one design language, one home');
});

// THE RACE THE GUARD IS FOR. The screen mounts asynchronously and a
// host can tear its overlay out before the module lands - the death
// sequence and a scene change both do exactly that. Without the guard
// the mount runs into a div that is already off the document, and the
// menu it builds has no owner: `close()` has already fired, so the
// unmount that would remove its capture keydown never runs, and Escape
// is swallowed for the rest of the session by a screen nobody can see.
test('U51: a dispose before the module lands mounts nothing at all', async () => {
  skin('enhanced');
  const warns = [];
  const real = console.warn;
  console.warn = (...a) => warns.push(a.map(String).join(' '));
  try {
    await withDocumentAsync(async (node) => {
      const win = openPauseFlow(() => {}, {});
      win.dispose();
      assert.equal(node.removed, true, 'the div goes with the dispose');
      await settleImport();
      assert.deepEqual(warns, [],
        'the mount must take its early return - a mount attempt into a removed div '
        + 'is the leaked-listener path, and it announces itself through the catch');
      assert.equal(globalThis.__menu, undefined, 'and it built no screen');
    });
  } finally { console.warn = real; }
});

test('U51: the enhanced screen is a DYNAMIC import - classic pays nothing', () => {
  const src = read('src/ui/pauseDoor.js');
  assert.doesNotMatch(src, /^import .*enhancedMenu\.js/m,
    'a static import would load the whole enhanced design for a player who chose classic');
  assert.match(src, /\.catch\(\(e\) => \{[^]*?host\.remove\(\)/,
    'a failed load must take its empty div with it, or the host holds an overlay '
    + 'that never reports done - a frozen game');
});

// ── THE OVERLAY CONTRACT ─────────────────────────────────────────
test('U51: done goes true only after the view is down', () => {
  const src = read('src/ui/pauseDoor.js');
  const close = src.slice(src.indexOf('const close = ()'), src.indexOf('const overlay = {'));
  const unmountAt = close.indexOf('view?.unmount()');
  const removeAt = close.indexOf('host.remove()');
  const firedAt = close.indexOf('fired = true');
  assert.ok(unmountAt > 0 && removeAt > unmountAt && firedAt > removeAt,
    'the hosts tear an overlay out the moment it reports done, and a DOM node '
    + 'outlives the object reporting it: unmount, remove, THEN fire');
});

test('U51: every exit takes the screen down before it acts', () => {
  // Classic's own order (pauseWindow.js - `_closeWith()` then the
  // hook), and it matters more here: the port answers a save or a load
  // with a HUD line, and this screen is an opaque div over the whole
  // canvas, so a hook fired under a live door hides its own answer.
  const src = read('src/ui/pauseDoor.js');
  const act = src.slice(src.indexOf('const act = (action)'), src.indexOf('show(overlay);'));
  const closeAt = act.indexOf('close();');
  const saveAt = act.indexOf('quickSave');
  assert.ok(closeAt > 0, 'the exits must close the screen at all');
  assert.ok(saveAt > closeAt, 'close first, then save');
  for (const hook of ['quickSave', 'quickLoad', 'exitToMenu']) {
    assert.ok(act.includes(`hooks.${hook}?.()`), `${hook} is optional - two hosts hand none`);
  }
});

// ── THE SCREEN'S OWN INPUT ───────────────────────────────────────
test('U51: the host arms are no-ops BY DESIGN, and say so', () => {
  const src = read('src/ui/pauseDoor.js');
  // A silently empty input() here is indistinguishable from a broken
  // one, which is why the wizard's arms carry the same sentences.
  for (const arm of ['input', 'click', 'wheel', 'tick', 'draw']) {
    assert.match(src, new RegExp(`${arm}\\(\\) \\{ /\\*`),
      `${arm}() must say why it does nothing`);
  }
});

test('U51: Escape closes the pause door, through the shared table', () => {
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /import \{ overlayAction \} from '\.\/input\.js'/,
    'not a second key map - the same table every other window answers through');
  const onKey = src.slice(src.indexOf('function onKey(e)'), src.indexOf('function releaseLock()'));
  assert.match(onKey, /overlayAction\(e\) !== 'back'/, 'Escape and nothing else');
  assert.match(onKey, /e\.stopPropagation\(\)/,
    'a modal overlay owns its input - the host walks the player on the keys underneath it');
  // THE BACK STACK, innermost first: a confirm card and a phone's help
  // sheet are both things Escape closes before it closes the screen,
  // or the one press meaning "not that" quits the game.
  const confirmAt = onKey.indexOf('confirming ?');
  const sheetAt = onKey.indexOf('sheetOpen ?');
  const resumeAt = onKey.indexOf("onAction('resume')");
  assert.ok(confirmAt > 0 && sheetAt > confirmAt && resumeAt > sheetAt,
    'confirm, then sheet, then the screen itself');
  assert.match(onKey, /mode === 'pause'/,
    'at boot there is nothing behind the front door to go back to');
  // ...and a key this screen did NOT use stays the page's: at boot
  // with nothing open, Escape is not claimed at all. The wizard's own
  // rule - preventDefault on an unused key stops Tab moving focus.
  const bailAt = onKey.indexOf('if (!back) return;');
  const claimAt = onKey.indexOf('e.preventDefault()');
  // -1 < anything, so the needle has to be PROVEN present before its
  // position means a thing. Mutation M13 (delete the bail) survived
  // the first draft of this assertion on exactly that.
  assert.ok(bailAt > 0, 'the unused-key bail is gone');
  assert.ok(claimAt > bailAt, 'the screen decides it used the key BEFORE it claims it');
});

test('U51: every listener has an owner', () => {
  // A window-level keydown outlives the DOM it was mounted for. On the
  // pause door that is not a leak, it is a game that can never be
  // paused again: the dead listener keeps swallowing Escape.
  const src = read('src/ui/enhancedMenu.js');
  const unmount = src.slice(src.indexOf('    unmount() {'));
  assert.match(unmount, /removeEventListener\('keydown', keyHandler, \{ capture: true \}\)/);
  assert.match(unmount, /removeEventListener\('pointerlockchange', lockHandler\)/);
  assert.match(unmount, /keyHandler = null/);
});

test('U51: the pointer lock is dropped, and kept dropped', () => {
  // Mouselook is the port's resting state, so the pause screen always
  // mounts over a LOCKED pointer - and a locked pointer does not
  // travel through the DOM at all: every mouse event goes to the
  // locked element as a movement delta, so a fixed div is invisible to
  // it however high its z-index.
  const src = read('src/ui/enhancedMenu.js');
  assert.match(src, /document\.exitPointerLock\(\)/);
  assert.match(src, /addEventListener\('pointerlockchange', lockHandler\)/,
    'a host that re-takes the lock must have it taken back');
});

// ── THE PANES TELL THE TRUTH ABOUT WHAT THE HOST WILL DO ─────────
// The probe host (exterior.js) hands `savingPrevented: () => true` and
// no save or load hook at all (IS1 wired the interior mode's doors). A
// Save button drawn there would be the lie the anti-lie law forbids,
// and a rail with the row removed would teach the player the door was
// never there.
test('U51: save and load answer the host, not the rail', () => {
  const src = read('src/ui/enhancedMenu.js');
  const save = src.slice(src.indexOf('function paneSave(body)'), src.indexOf('function paneExit(body)'));
  assert.match(save, /hooks\.savingPrevented\?\.\(\) \|\| typeof hooks\.quickSave !== 'function'/,
    'the classic gate, plus a host that hands no hook at all');
  assert.match(save, /You cannot save now\./,
    'the game’s own recovered string, not a rewording of it');
  const load = src.slice(src.indexOf('function paneLoad(body)'), src.indexOf('function paneSave(body)'));
  assert.match(load, /typeof hooks\.quickLoad === 'function'/, 'no hook, no button');
  // ...and the mount has to KEEP what the door handed it. Dropping the
  // trio here is silent: every pane falls back to its refusal text, so
  // all four hosts lose save, load and exit at once and each one says
  // politely that this part of the game has no door.
  assert.match(src, /^  hooks = h \?\? \{\};$/m,
    "the host's own hooks, stored - not the empty object the panes read as a refusal");
  // and both rows stay on the rail wherever they are refused
  assert.match(src, /const SECTIONS_PAUSE = \['Resume', 'Save Game', 'Load Game'/);
});

// ── PX22: THE JOURNAL'S THREE SECTIONS ────────────────────────────
// Mac: "quests aren't supposed to be titled as main quest, etc. What we
// developed had 3 sections for main, side and archived."
//
// WHAT THE RECORD SAID, stated plainly because it did not match: PX5
// shipped the two active headings CONDITIONALLY ("headings only when
// BOTH kinds are on the log; one group under a header is a header
// explaining nothing"), named the side group "Quests", and put a
// "Main Quest" / "Side Quest" TAG in the detail beside the timer. The
// code did exactly that. Mac's call reshapes it: three named sections,
// always, and no tag.
test('PX22: the rail is three named sections, always - Main, Side, Archived', () => {
  const src = read('src/ui/enhancedMenu.js');
  const at = src.indexOf('const mains = active.filter');
  const fn = src.slice(at, src.indexOf('wrap.append(rail);', at));
  // One helper, three calls, in order - not a conditional pair.
  assert.match(fn, /section\('Main Quests', mains, '', true\);/);
  assert.match(fn, /section\('Side Quests', sides, ''\);/);
  assert.match(fn, /section\('Archived', finished, ' done'\);/);
  assert.ok(fn.indexOf("'Main Quests'") < fn.indexOf("'Side Quests'"), 'main above side');
  assert.ok(fn.indexOf("'Side Quests'") < fn.indexOf("'Archived'"), 'archived last');
  // PX5's conditional is gone, and so is the bare word "Quests" for
  // the side group - the thing that read as a title rather than a file.
  assert.doesNotMatch(fn, /if \(mains\.length && sides\.length\)/, 'no conditional headings');
  assert.doesNotMatch(fn, /el\('div', 'px-qarch', 'Quests'\)/);
  assert.doesNotMatch(fn, /el\('div', 'px-qarch', 'Archive'\)/, "'Archive' is 'Archived' now");
  // An empty section still STANDS and says so - the worn map's empty
  // families, one window over. A player meeting their first side quest
  // learns the main section exists rather than meeting a different
  // window later.
  assert.match(fn, /if \(items\.length\) railList\(items, cls\);\s*\n\s*else rail\.append\(el\('div', 'px-qnone', '\\u2014'\)\);/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.px-qnone \{/);
});

test('PX22: a quest is filed under its kind, never TITLED by it', () => {
  const src = read('src/ui/enhancedMenu.js');
  const jat = src.indexOf('const mains = active.filter');
  const detail = src.slice(src.indexOf("const head2 = el('div', 'px-qname');", jat), src.indexOf('// Active: the LATEST', jat));
  // The detail's meta line carried "Main Quest"/"Side Quest" beside the
  // timer. With three named sections that is the same fact twice, and a
  // quest is not titled by its kind.
  assert.doesNotMatch(detail, /px-qkind/, 'no kind tag in the journal detail');
  assert.doesNotMatch(src, /sel\.main \? 'Main Quest' : 'Side Quest'/);
  // ...and the meta line only exists when it holds something, or an
  // empty div leaves a gap the eye reads as a mistake.
  assert.match(detail, /if \(meta\.childNodes\.length\) detail\.append\(meta\);/);
  // The GROUPING still uses the same law it always did - the pack's own
  // naming, S0000*.txt - so nothing about which quest is which changed.
  assert.match(src, /main: isMainQuest\(q\.questName\)/);
  // The archive is NOT split by kind, and that is the data's shape: the
  // notebook's filed header keeps only the display name, so the
  // questName is gone by the time a quest is filed.
  assert.match(src, /section\('Archived', finished, ' done'\);/);
  assert.doesNotMatch(src, /finished\.filter\(\(q\) => q\.main\)/);
});

test('PX22: the timer PX5 designed is still there, and only when there is one', () => {
  // Mac, checking: "the timer we also designed is integrated when
  // needed, correct?" It was never pinned - PX5 shipped it live-probed
  // - so it is pinned now, on the way past.
  const src = read('src/ui/enhancedMenu.js');
  // THE WORDS. Days show days and hours; under a day, hours and
  // minutes; under an hour, minutes alone, never zero.
  assert.match(src, /function remainWords\(s\) \{/);
  const words = src.slice(src.indexOf('function remainWords(s) {'), src.indexOf('function remainWords(s) {') + 420);
  assert.match(words, /if \(d > 0\) return `\$\{d\} day\$\{d === 1 \? '' : 's'\}/);
  assert.match(words, /if \(h > 0\) return `\$\{h\} hour/);
  assert.match(words, /return `\$\{Math\.max\(1, m2\)\} min`;/, 'never "0 min" - a live clock always has a minute left');
  // TWO PLACES, both conditional: a gem on the rail row, the words in
  // the detail. A quest with no clock gets neither.
  assert.match(src, /if \(q\.clockSeconds != null\) b\.append\(el\('span', 'px-qtimed', '\\u25c6'\)\);/);
  assert.match(src, /if \(sel\.clockSeconds != null\) \{/);
  assert.match(src, /Time remains: \$\{remainWords\(sel\.clockSeconds\)\}/);
  // URGENT below one GAME DAY - the threshold in seconds, not a guess.
  assert.match(src, /const urgent = sel\.clockSeconds < 86400;/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.px-qtimer\.urgent/);
  // THE CLOCK ITSELF is the quest machine's: the TIGHTEST running
  // Clock resource on the quest, by clockEnabled && !clockFinished.
  // All three hosts that build a log walk it the same way - the four
  // hosts rule, on a law rather than a frame.
  for (const host of ['src/scenes/world.js', 'src/scenes/dungeonContext.js']) {
    const h = read(host);
    assert.match(h, /if \(r\.clockEnabled && !r\.clockFinished && Number\.isFinite\(r\.remainingTimeInSeconds\)\)/, host);
    assert.match(h, /Math\.min\(clockSeconds, r\.remainingTimeInSeconds\)/, `${host}: the TIGHTEST clock`);
  }
  // world.js carries it twice on purpose - its own questLog and the
  // pauseQuestLog worldModes borrows - so the modal host's journal
  // shows the same timers the world's does.
  assert.equal((read('src/scenes/world.js').match(/clockSeconds = clockSeconds == null/g) ?? []).length, 2);
  assert.match(read('src/scenes/worldModes.js'), /questLog: \(\) => host\.pauseQuestLog\?\.\(\) \?\? \{ active: \[\], finished: \[\] \}/);
});

// ── PX25: THE SHEET'S DOORS, ON THE PAGE THAT IS THE SHEET ────────
// The F5 overlay and the pause window's Stats page are the same
// character sheet - same sheetModel, same four sections - and only one
// of them had a way out. Before the overlay can retire, its four
// buttons need somewhere to be, or retiring it ships a window that can
// do less.
test('PX25: the Stats page carries the doors, and only the ones a host handed over', () => {
  const src = read('src/ui/enhancedMenu.js');
  const at = src.indexOf('function pauseStats(body)');
  const fn = src.slice(at, src.indexOf('\nfunction ', at + 10));
  assert.match(fn, /\['Pack', hooks\.openPack\], \['Spellbook', hooks\.openSpellbook\], \['Chronicle', hooks\.openChronicle\],/);
  // A button that opens nothing is PX14's drawn door, so each appears
  // only when its hook is a function - the exterior host has no
  // journal maker and its Chronicle button never draws, which is the
  // point of the filter rather than a gap in it.
  assert.match(fn, /\.filter\(\(\[, fn\]\) => typeof fn === 'function'\)/);
  assert.match(fn, /if \(doors\.length\) \{/);
  // The window RESUMES before it opens: two overlays at once is the
  // stacking bug U55 found the other way round on this seam.
  assert.match(fn, /b\.onclick = \(\) => \{ onAction\('resume'\); fn\(\); \};/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.px-sheetdoors \.act \{ min-height: 44px; \}/);
});

test('PX25: every host hands the pause window the arms it already had', () => {
  // Each host already exposed toggleInventory / toggleSpellbook /
  // toggleLogbook; nothing new is built here, the pause window is
  // simply given the same reach. A host WITHOUT one passes nothing.
  for (const [host, want] of [
    ['src/scenes/dungeonContext.js', ['openPack', 'openSpellbook', 'openChronicle']],
    ['src/scenes/worldModes.js', ['openPack', 'openSpellbook', 'openChronicle']],
    ['src/scenes/world.js', ['openPack', 'openSpellbook', 'openChronicle']],
    ['src/scenes/exterior.js', ['openPack', 'openSpellbook']],
  ]) {
    const s = read(host);
    const call = s.slice(s.indexOf('openPauseFlow('), s.indexOf('openPauseFlow(') + 900);
    for (const hook of want) assert.ok(call.includes(`${hook}:`), `${host} hands over ${hook}`);
    if (!want.includes('openChronicle')) {
      assert.ok(!call.includes('openChronicle:'), `${host} has no journal maker and honestly passes none`);
    }
  }
});

// ── PX26: THE DIAL'S NORTH, AND THE SHEET THAT SAT LEFT ───────────
// Mac, two reports that are one window: "the north option should be
// the new journal we developed" and "the skill ui opens on the
// lefthand side of the screen when it should be center". North was
// the F5 overlay - the last pre-PX surface, and the one whose
// three-column grid fills the viewport from the left edge.
test('PX26: the pause window lands on the page the door was pressed for', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /^  at = null,$/m);
  // The landing is applied AFTER the reset, which is what keeps the
  // reset the default rather than something this works around.
  const mount = menu.slice(menu.indexOf('export function mountEnhancedMenu'));
  assert.ok(mount.indexOf("pauseTab = 'system';") < mount.indexOf("includes(at)) pauseTab = at;"),
    'the reset runs first, then the landing');
  // The tabbed window IS the pause home face, so a landing sets the
  // TAB and leaves the section alone.
  assert.match(menu, /if \(\['quests', 'stats', 'system'\]\.includes\(at\)\) pauseTab = at;/);
  assert.doesNotMatch(mount.slice(0, mount.indexOf('render()')), /section = 'journal'/);
  const door = read('src/ui/pauseDoor.js');
  assert.match(door, /at: hooks\.at \?\? null/);
  assert.match(door, /The CLASSIC flow takes the same hooks\n \* and ignores it/, 'the classic pause has no tabs to land on');
});

test('PX26 / THE FOUR HOSTS: north opens a REAL arm on every host', () => {
  // The pin that would have caught the first attempt. A scripted edit
  // landed openSheetPage on one host and silently skipped three,
  // leaving `openSheetPage?.()` optional-chaining into undefined - a
  // dial whose north did NOTHING in three of four hosts, which is
  // worse than one pointing at the wrong window. That branch was
  // thrown away; this pin is why it cannot happen quietly again.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js',
    'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    const s = read(host);
    assert.match(s, /\{ id: 'skills', label: 'Skills', dir: 'n', open: \(\) => [\w.]*openSheetPage\(\) \}/,
      `${host}: north asks for the sheet page`);
    assert.doesNotMatch(s, /dir: 'n', open: \(\) => [\w.]*openSheetPage\?\.\(\)/,
      `${host}: NOT optional-chained - a dead north must fail loudly`);
    // The arm must be DEFINED here, not merely mentioned: north itself
    // mentions it, so a loose match passes on a host that only calls
    // it. That is exactly how the first attempt slipped through - the
    // arm landed on one host and north on four.
    assert.match(s, /^ {4}openSheetPage(\(\) \{|: \(\) =>)/m, `${host} DEFINES the arm north asks for`);
    assert.match(s, /at: opts\.at \?\? null,/, `${host}'s pause flow carries the landing`);
    assert.match(s, /togglePause\(([\w ]*=[^)]*)?\)/, `${host}'s togglePause takes its own options`);
  }
  // Each host calls its OWN pause flow - no host reaches into another's.
  assert.match(read('src/scenes/world.js'), /openSheetPage: \(\) => hudCtx\.togglePause\(\{ at: 'stats' \}\),/);
  assert.match(read('src/scenes/dungeonContext.js'), /openSheetPage\(\) \{ this\.togglePause\(null, \{ at: 'stats' \}\); \},/);
});

test('PX28b: TAB ITSELF closes an open window - the registry answers the key', () => {
  // Mac: "Tab should also minimize any open UI menus, currently it only
  // applies to the radial." PX28 taught the DIAL to put a window away,
  // and that was the wrong half: openPixelDial is only reached through
  // the HOST's key routing, and while an enhanced window is up the
  // WINDOW owns the keyboard - so Tab never got there.
  const reg = read('src/ui/enhancedOverlays.js');
  // ONE listener, where the registry already knows what is open, so a
  // window added later is covered by having registered at all.
  assert.match(reg, /window\.addEventListener\('keydown', onTab, true\);/, 'capture phase');
  assert.match(reg, /if \(e\.code !== 'Tab'/);
  assert.match(reg, /closeTopOverlay\(\);/);
  assert.equal((reg.match(/addEventListener/g) ?? []).length, 1, 'ONE listener, not one per window');
  // ALIVE ONLY WHILE THE STACK IS: registering starts it, the last
  // unregister stops it, and closing the last one stops it too - or
  // Tab would be eaten in a world with nothing open.
  assert.match(reg, /stack\.push\(entry\);\n\s*listen\(\);/);
  assert.match(reg, /if \(!stack\.length\) unlisten\(\);/);
  assert.equal((reg.match(/if \(!stack\.length\) unlisten\(\);/g) ?? []).length, 2,
    'both ways the stack can empty');
  assert.match(reg, /export function clearOverlays\(\) \{ stack\.length = 0; unlisten\(\); \}/);
  // A TEXT FIELD OWNS TAB - the chronicle's composer and the
  // spellbook's rename are both fields.
  assert.match(reg, /t\.tagName === 'INPUT' \|\| t\.tagName === 'TEXTAREA' \|\| t\.isContentEditable/);
  // NOT through overlayAction's 'back': Escape means back a LEVEL in a
  // window that has them, and Tab means put this away. Two words.
  assert.doesNotMatch(read('src/ui/input.js'), /Tab: 'back'/);
  assert.match(read('src/ui/input.js'), /Escape: 'back'/);
});

test('PX28: Tab puts away what it opened, then raises the dial', () => {
  // Mac: "when hitting tab a second time, it should minimize any UI."
  // The dial already closed ITSELF on a second press; what it could not
  // do was close what it had OPENED, because each enhanced window owns
  // its own keyboard and knows nothing of the others.
  const dial = read('src/ui/pixelDial.js');
  assert.match(dial, /if \(_open\) \{ _open\.unmount\(\); _open = null; return true; \}/, 'the dial still toggles itself');
  assert.match(dial, /if \(closeTopOverlay\(\)\) return true;/, '...and puts away an open window first');
  const order = dial.indexOf('if (_open)') < dial.indexOf('closeTopOverlay()');
  assert.ok(order, 'the dial closes ITSELF before it closes anything else - it is the top thing');
  // A STACK of close-arms, holding FUNCTIONS and never DOM: a registry
  // that reached into windows would be a second owner of them, and
  // every one already owns its own teardown.
  const reg = read('src/ui/enhancedOverlays.js');
  assert.match(reg, /export function registerOverlay\(close\)/);
  assert.match(reg, /export function closeTopOverlay\(\)/);
  assert.doesNotMatch(reg, /document\.|querySelector|innerHTML/, 'it holds functions, never DOM');
  assert.match(reg, /const stack = \[\];/);
  // EVERY enhanced overlay registers, and every one unregisters on
  // teardown - a stack that grows a dead arm would swallow a Tab.
  for (const door of ['inventoryDoor', 'spellbookDoor', 'chronicleDoor', 'charSheetDoor']) {
    const s = read(`src/ui/${door}.js`);
    assert.match(s, /unregister = registerOverlay\(close\);/, `${door} registers`);
    assert.match(s, /unregister\(\);/, `${door} unregisters on teardown`);
  }
});

test('PX29: the framed windows are CENTRED, and it is the family that is fixed', () => {
  // Mac reported the chronicle; the spellbook was 260px and 140px off
  // too, and had been since PX23 - invisible because every shot of it
  // was of the ELEMENT rather than the viewport. `.px-home` is
  // position:fixed inset:0 with no flex; the pause face centres its
  // window by putting it in a .px-stage, and neither of these two got
  // one.
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.sb-shell, \.cr-shell \{ display: flex; align-items: center; justify-content: center; \}/,
    'the FOURTH shared-part fault of this arc, fixed for the family');
  // ...and the shells really are the ones the two windows mount.
  assert.match(read('src/ui/enhancedSpellbook.js'), /'px-home px-over sb-shell'/);
  assert.match(read('src/ui/enhancedChronicle.js'), /'px-home px-over cr-shell'/);
});

// ── AUDIT UI 2 (2026-08-27): THE TWO FAULTS THAT KEPT RECURRING ───
// Mac asked for a comprehensive audit before continuing. The live
// sweep across three viewports and every enhanced surface came back
// clean, so the value is in the two STATIC sweeps - because the two
// faults this arc actually shipped were both invisible to a window's
// own pins.
test('AUDIT UI 2: no part is styled for one shell and left bare in another', () => {
  // The recurring fault: PX23's divider, PX24's head, PX24c's chips
  // and PX29's stage were each scoped to ONE shell while another
  // window drew the same class - so each rendered as bare text until
  // someone looked. Four times.
  const css = read('src/ui/enhancedStyle.js');
  const body = css.slice(css.indexOf('export const ENHANCED_CSS = `'));
  const produces = (f) => new Set([...read(f).matchAll(/'([a-z][\w-]*(?: [a-z][\w-]*)*)'/g)]
    .flatMap((m) => m[1].split(/\s+/)));
  const shells = {
    'sb-shell': produces('src/ui/enhancedSpellbook.js'),
    'cr-shell': produces('src/ui/enhancedChronicle.js'),
    'pack-shell': produces('src/ui/enhancedInventory.js'),
    'px-home': produces('src/ui/enhancedMenu.js'),
  };
  const bare = [];
  for (const m of body.matchAll(/^([^{@\n][^{]*)\{/gm)) {
    const parts = m[1].trim().split(',').map((s) => s.trim());
    for (const one of parts) {
      const hit = /^\.([\w-]+-shell|px-home) \.([\w-]+)$/.exec(one);
      if (!hit) continue;
      const [, shell, part] = hit;
      if (new RegExp(`^\\.${part}[\\s,{:]`, 'm').test(body)) continue;   // a base rule covers everyone
      for (const [other, set] of Object.entries(shells)) {
        if (other === shell || !set.has(part)) continue;
        if (parts.some((q) => q.startsWith(`.${other} `))) continue;
        if (new RegExp(`\\.${other} \\.${part}\\b`).test(body)) continue;
        bare.push(`.${other} draws .${part}, styled only for .${shell}`);
      }
    }
  }
  assert.deepEqual([...new Set(bare)], [],
    'a part one window styles and another draws unstyled renders as bare text');
});

// AUDIT 39 widened the sweep above by the one case it is blind to. It
// compares one shell against another, so a part styled in NO shell has
// nothing to compare and reports clean - which is why it found the
// three ANNOTATION classes acceptable while they drew at body's 15px
// full-bone, LARGER and brighter than the 14px .row-name each of them
// hangs beneath. That is the very "bare running text" fault the pin
// was written for, arriving by the door it does not watch.
test('AUDIT 39: an annotation drawn by an enhanced view has a rule of its own', () => {
  const css = read('src/ui/enhancedStyle.js');
  const body = css.slice(css.indexOf('export const ENHANCED_CSS = `'));
  // The classes that ANNOTATE a label rather than being one. Each must
  // read as a note; without a rule each inherits the body font and
  // outweighs the thing it explains.
  const annotations = ['row-note', 'row-sub', 'note'];
  const drawnBy = ['src/ui/enhancedMenu.js', 'src/ui/enhancedChargen.js']
    .map((f) => read(f)).join('\n');
  for (const cls of annotations) {
    assert.ok(new RegExp(`el\\('\\w+', '${cls}'`).test(drawnBy), `nothing draws .${cls} any more`);
    assert.ok(new RegExp(`(^|[\\s,])\\.${cls}[\\s,{:]`, 'm').test(body),
      `.${cls} is drawn and styled nowhere - it renders as bare running text`);
  }
  // ...and each is DIMMER and SMALLER than the label above it, which
  // is the whole point of the rule rather than merely having one.
  assert.match(body, /\.row-note, \.row-sub \{ color: var\(--dim\); font-size: 12\.5px;/);
  assert.match(body, /^\.note \{ color: var\(--dim\); font-size: 13px;/m);
  assert.match(body, /\.row-name \{ font-size: 14px; \}/, 'the label they must not outweigh');
});

test('AUDIT UI 2: every enhanced window is REACHABLE from a host', () => {
  // PX24's fault, as a law: the chronicle's door and window were built,
  // pinned and browser-verified, and NOTHING called the door. Every pin
  // it wrote was about the door's own behaviour and all of them passed.
  // Reachability has to follow DYNAMIC imports - the doors load their
  // windows with import() - which is what made the first version of
  // this sweep report every window as unreachable.
  const files = execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.js'));
  const text = Object.fromEntries(files.map((f) => [f, readFileSync(join(root, f), 'utf8')]));
  const edges = {};
  for (const f of files) {
    edges[f] = [...new Set([...text[f].matchAll(/(?:from|import\()\s*['"](\.[^'"]+)['"]/g)]
      .map((m) => relative(root, resolve(join(root, dirname(f)), m[1])))
      .filter((p) => text[p] !== undefined))];
  }
  // The roots are the hosts AND main.js: the cursor and the crash line
  // hang off boot, not off a scene, and the first version of this
  // sweep called them orphans for it.
  const seen = new Set(['src/main.js', ...files.filter((f) => f.startsWith('src/scenes/'))]);
  const q = [...seen];
  while (q.length) for (const n of edges[q.pop()] ?? []) if (!seen.has(n)) { seen.add(n); q.push(n); }
  const windows = files.filter((f) => /^src\/ui\/(enhanced|pixel|loot)/.test(f)
    && !/enhancedStyle|enhancedOverlays/.test(f));
  assert.ok(windows.length >= 8, `${windows.length} enhanced windows found`);
  assert.deepEqual(windows.filter((w) => !seen.has(w)), [],
    'a window nothing reaches is a window nobody can open');
  // ...and no src/ui module at all is orphaned. THE STAGING EXEMPTION
  // IS GONE, as its own counter-pin instructed: flight 2 mounted
  // ui/automapChrome.js from BOTH ends - c2/S5's native dungeon window
  // and c2/S10's exterior town map - so the chrome is reached from the
  // hosts like everything else, the list is empty and the sweep is
  // unconditional again, which is the state it has to be in for PX24's
  // fault (a window nothing reaches) to stay caught.
  assert.deepEqual(files.filter((f) => f.startsWith('src/ui/') && !seen.has(f)), [],
    'a src/ui module nothing reaches is a module nobody can open');
  assert.ok(seen.has('src/ui/automapChrome.js'),
    'the automap chrome is reachable - flight 2 mounted it in both automap windows');
});
