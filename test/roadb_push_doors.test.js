// ROAD TO 1:1, WAVE B / B5 - THE REFUSAL-GUARD WALK B1 RECORDED.
//
// B1's report: "What is left is a scatter of older `if (slot) return` /
// `if (!slot) slot = ...` REFUSALS written when a single slot had no
// other safe answer... Each is a place DFU would PushWindow and the
// port still drops the message on the floor. Converting them is a
// per-site judgement."
//
// THE JUDGEMENT, site by site. DaggerfallUI.MessageBox is
// `new DaggerfallMessageBox(uiManager, uiManager.TopWindow); mb.Show()`
// (DaggerfallUI.cs:1330-1360), and Show() is uiManager.PushWindow - it
// has NEVER asked whether something else is open. So every site whose
// C# is a MessageBox is a push, and the ones that are not are the ones
// that stay:
//
//   CONVERTED (9):
//     the exhaustion box, in all THREE hosts that can collapse
//     the infection popup, in all FOUR hosts that wire it (the two
//       streaming hosts joined at ROAD review-p: they had no refusal
//       guard, so the walk passed them by, but a bare showOverlay is a
//       replace-and-dispose and MessageBox is not)
//     DaggerfallAction's ShowText and ShowTextWithInput (dungeon)
//     the rest mastery box (dungeon - the interior twin was already one)
//   LEFT, with the reason on each: the key-dispatch gates (DFU's own
//   `if (!IsPlayingGame)`), the async book-reader race the port has and
//   DFU does not, the level-up screen's PopToHUD pairing, and
//   mountSpellWindow's boolean contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createTownTalk } from '../src/scenes/townTalk.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const talkHost = () => createTownTalk({
  renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
  fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
  playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
  regionIndex: 0,
});

// ---------------------------------------------------------------------
// The behaviour, on the door itself: a push over an open window keeps
// BOTH, where the old refusal kept only the first and lost the message.
// ---------------------------------------------------------------------

test('B5: pushOverlay over an open window keeps both - the shape every converted site now has', () => {
  const host = talkHost();
  const open = { name: 'the map the player had up' };
  host.showOverlay(open);
  const box = { name: 'You collapse from exhaustion.' };
  host.pushOverlay(box);
  assert.equal(host.overlay, box, 'the message is what the player reads');
  host.closeOverlay();
  assert.equal(host.overlay, open, 'and the window it was laid over comes back');
  // The refusal it replaces: `if (!townTalk.overlay) showOverlay(box)`
  // would have left `open` up and dropped `box` entirely.
});

// ---------------------------------------------------------------------
// The seven converted sites, one pin each.
// ---------------------------------------------------------------------

test('B5: the EXHAUSTION box pushes in all three hosts that can collapse', () => {
  // PlayerEntity's OnExhausted presenter. The fatigue drain runs while
  // the inventory, the map or the spellbook is open, so this is the
  // refusal most likely to have eaten a real message.
  assert.match(src('src/scenes/worldModes.js'),
    /mountInterior\(new ActionTextBox\(out\.inWater \? \[EXHAUSTED_IN_WATER\] : \['You collapse from exhaustion\.'\]\)\);/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /townTalk\.pushOverlay\(new ActionTextBox\(lines\)\);/, `${f}: the outdoor collapse`);
    assert.equal(/if \(!townTalk\.overlay\) townTalk\.showOverlay\(new ActionTextBox\(lines\)\);/.test(src(f)), false,
      `${f}: the refusal is GONE, not merely bypassed`);
  }
  assert.equal(/if \(!interiorOverlay\) interiorOverlay = new ActionTextBox\(out\.inWater/.test(src('src/scenes/worldModes.js')), false);

  // ...and the RE-ENTRANCY latch beside it stays, because that one is
  // real: the hour the safe collapse passes drains fatigue again.
  // ROAD review-p: in ALL THREE hosts, not just the one whose door was
  // already a push. The other two are the hosts this batch took the
  // `if (!townTalk.overlay)` refusal off, and while that refusal only
  // ever suppressed the duplicate BOX, the latch is now the whole of
  // what stands between a collapse whose own advance(60) re-raises
  // OnExhausted and an unbounded stack of pushed message boxes -
  // unpinned in both until here.
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /if \(_inExhaustion\) return;/, `${f}: the re-entrancy latch`);
  }
});

test('B5/ENH-NOTICE3: the INFECTION popup pushes, and the four hosts no longer each build it', () => {
  // VampirismInfection / LycanthropyInfection speak through
  // DaggerfallUI.MessageBox; a player who turns with a trade window or
  // an automap open was simply never told. B5 converted the four
  // hosts' own `showText` wirings to pushes ONE AT A TIME, which is
  // the drift ENH-NOTICE3 closed: the shared factory names the KIND
  // once and systems/notify.js finds the live host's slot. This pin
  // moves with the law - the push is still pinned, it is just pinned
  // where the push now lives.
  const sh = src('src/scenes/shared.js');
  assert.match(sh, /export function wireInfectionVideos\(renderer, \{ textAt = null, factionDict = null, transferToCemetery = null \} = \{\}\)/,
    'the per-host showText dependency is gone from the factory');
  assert.match(sh, /const lines = plainLines\(textAt\?\.\(id\)\);\n\s*if \(lines\?\.length\) messageBox\(lines\);/,
    'the box is raised through the one door, on the rows the factory already flattened (V5)');
  assert.match(sh, /import \{ messageBox \} from '\.\.\/systems\/notify\.js';/);
  // A PUSH, still: the seam's `push` defaults true (notify.js) and
  // this call passes no option, so DaggerfallUI.MessageBox's
  // PushWindow is what every host performs.
  assert.match(src('src/systems/notify.js'), /export function messageBox\(text, \{ highlightColor = undefined, previousWindow = true, push = true, onClose = null \} = \{\}\)/);
  assert.equal(/if \(lines\?\.length\) messageBox\(lines, \{ push: false/.test(sh), false, 'never a replace');
  // and NO host wires a window for it any more - not the two modal
  // hosts B5 converted, not the two streaming hosts ROAD review-p did.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    const s = src(f);
    const seam = s.slice(s.indexOf('wireInfectionVideos(renderer, {'));
    assert.ok(s.includes('wireInfectionVideos(renderer, {'), `${f}: still wires the seam (THE FOUR HOSTS RULE)`);
    assert.equal(/showText:/.test(seam.slice(0, seam.indexOf('});'))), false,
      `${f}: no per-host window for one C# line`);
  }
});

test('B5: DaggerfallAction ShowText and ShowTextWithInput push', () => {
  const dc = src('src/scenes/dungeonContext.js');
  // ENH-NOTICE3: ShowText goes through the one door now, and this pin
  // moved with it. It used to read `pushDungeonWindow(new
  // ActionTextBox(lines));` - which, after AUDIT 64 F35 gave the
  // plaque its null previousWindow, only ever matched the AZURA box
  // further down the file and pinned nothing of ShowText at all.
  // Pinned on the action seam's own body this time, with DFU's null
  // previousWindow (Internal/DaggerfallAction.cs:536) carried through
  // the seam as the port's `false` (ui/windowStack.js:65 reads it
  // `=== true`).
  const showText = dc.slice(dc.indexOf('actions.onShowText = (id) => {'), dc.indexOf('actions.onShowTextInput = (id, submit) => {'));
  assert.match(showText, /messageBox\(lines, \{ previousWindow: false \}\);/, 'ShowText');
  assert.equal(/new ActionTextBox\(/.test(showText), false, 'and mints no window of its own');
  assert.match(dc, /pushDungeonWindow\(new ActionInputBox\(lines, submit\)\);/, 'ShowTextWithInput');
  assert.equal(/if \(!activeOverlay\) activeOverlay = new ActionInputBox\(/.test(dc), false,
    'the input box especially - it is the only way to answer the riddle it asks');
});

test('B5: the dungeon\'s rest MASTERY box pushes, like the interior twin already did', () => {
  // RaiseSkills (:1390-1401) runs from the rest window's own close, so
  // the slot it used to test is the one the rest window had just left -
  // and on the level-up path it is not free at all.
  assert.match(src('src/scenes/dungeonContext.js'), /box: \(rows\) => pushDungeonWindow\(new ActionTextBox\(rows\)\),/);
  assert.match(src('src/scenes/worldModes.js'), /box: \(rows\) => mountInterior\(new ActionTextBox\(rows\)\),/);
});

test('B5: the dungeon has ONE push door and its ctx member delegates to it', () => {
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /function pushDungeonWindow\(win\) \{\n\s*if \(!win\) return false;\n\s*dungeonWindows\.reconcile\(activeOverlay\);[^\n]*\n\s*if \(dungeonWindows\.containsWindow\(win\)\) return true;\n\s*dungeonWindows\.pushWindow\(win\);\n\s*return true;\n\s*\}/,
    'PushWindow (UserInterfaceManager.cs:79-91) with ContainsWindow as the re-entrancy guard');
  assert.match(dc, /showOverlay\(win\) \{ return pushDungeonWindow\(win\); \},/,
    'the ctx member is the same door, not a second copy');
});

// ---------------------------------------------------------------------
// The sites deliberately LEFT, and why. A pin on a decision not taken
// is what stops the next sweep from taking it by accident.
// ---------------------------------------------------------------------

test('B5: the KEY-DISPATCH gates stay refusals - they are DFU\'s own', () => {
  // `if (overlay) return;` at the head of a key handler is not a lost
  // MessageBox: it is GameManager's dispatch chain, which runs only
  // while the game is being played (IsPlayingGame is false the moment
  // a pausing window is on the stack, GameManager.cs:926-942). Pressing
  // R inside the inventory must not open a rest window BEHIND it.
  assert.match(src('src/scenes/worldModes.js'), /toggleRest\(\) \{\n\s*if \(interiorOverlay\) return;/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /if \(townTalk\.overlayActive\) return;/, `${f}: the outdoor dispatch gate`);
  }
});

test('B5: the async BOOK READER keeps its race guard - the port has the race, DFU does not', () => {
  // PlayerActivate pushes DaggerfallBookReaderWindow on the activation
  // frame; the port's reader waits on a fetch, so by the time it
  // resolves the player may have opened something else. Pushing then
  // would drop a book on top of an unrelated window seconds later,
  // which is not what DFU does either. The guard stays and the reason
  // is the async, not the stack.
  // EB4 (Mac: "tapping use doesn't do anything and then locks me out
  // of pointerclick in inventory"): the guard yields to a DONE
  // occupant - the pack that handed the book over and closed itself in
  // the same press, waiting on the frame that drops it - and to
  // nothing else. A live unrelated window still refuses the reader.
  assert.match(src('src/scenes/dungeonContext.js'),
    /showReader: \(w\) => \{ if \(!activeOverlay \|\| activeOverlay\.done\) activeOverlay = w; \}/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /showReader: \(w\) => \{ if \(!townTalk\.overlayActive \|\| townTalk\.overlayDone\) townTalk\.showOverlay\(w\); \}/, `${f}: the guard, yielding only to a done occupant`);
  }
});

test('B5: the LEVEL-UP screen keeps its slot test - it is the other half of PopToHUD', () => {
  // RestFinishedPopup_OnClose is `PopToHUD(); RaiseSkills();` in that
  // order (DaggerfallRestWindow.cs:728-732), and ui/restWindow.js's
  // `_close` carries the whole reasoning: the window vacates the host's
  // slot precisely so the level-up screen RaiseSkills can raise finds
  // it free. Converting this guard to a push would make that ordering
  // law unobservable - the screen would open either way - so the pair
  // moves together or not at all.
  // ORL1 re-shaped the arm's TAIL (the last-resort screen is now the
  // mod's window for a character who levels by the mod's law), so the
  // pin holds what it was written to hold and nothing else: THE GUARD,
  // and the builder being asked FIRST. Both of this host's two arms
  // carry it - the count is here because a guard restored on one arm
  // and lost on the other is exactly the half-fix the FOUR HOSTS rule
  // keeps finding.
  // LV1 re-shaped the TAIL again - the last resort is now
  // ui/charSheetDoor.js itself, which answers lane AND skin - so the
  // pin holds the same two things it was written to hold, over the
  // arm's current spelling.
  const wm = src('src/scenes/worldModes.js');
  const guarded = wm.match(/if \(!interiorOverlay\) \{\n\s*interiorOverlay = host\.makeCharSheet\?\.\(\)/g) ?? [];
  assert.equal(guarded.length, 2, 'both interior level-up arms fill only an EMPTY slot, and ask the host\'s builder first');
  assert.match(wm, /host\.makeCharSheet\?\.\(\) \?\? createCharSheetWindow\(\{ entity: playerEntity \}\)/,
    'and the last resort is the ONE seam, which knows whose law levels this character (ORL1) and which skin draws it (LV1)');
  assert.match(src('src/ui/restWindow.js'), /PopToHUD\(\); RaiseSkills\(\);/);
});
