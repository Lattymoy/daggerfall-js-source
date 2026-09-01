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
//   CONVERTED (7):
//     the exhaustion box, in all THREE hosts that can collapse
//     the infection popup, in BOTH hosts that can turn
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
  assert.match(src('src/scenes/worldModes.js'), /if \(_inExhaustion\) return;/);
});

test('B5: the INFECTION popup pushes in both hosts that can turn', () => {
  // VampirismInfection / LycanthropyInfection speak through
  // DaggerfallUI.MessageBox; a player who turns with a trade window or
  // an automap open was simply never told.
  assert.match(src('src/scenes/worldModes.js'),
    /showText: \(lines\) => mountInterior\(new ChoiceWindow\(\{ lines \}\)\),/);
  assert.match(src('src/scenes/dungeonContext.js'),
    /showText: \(lines\) => pushDungeonWindow\(new ActionTextBox\(lines\)\),/);
  assert.equal(/showText: \(lines\) => \{ if \(!activeOverlay\)/.test(src('src/scenes/dungeonContext.js')), false);
  assert.equal(/showText: \(lines\) => \{ if \(!interiorOverlay\)/.test(src('src/scenes/worldModes.js')), false);
});

test('B5: DaggerfallAction ShowText and ShowTextWithInput push', () => {
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /pushDungeonWindow\(new ActionTextBox\(lines\)\);/, 'ShowText');
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
  assert.match(src('src/scenes/dungeonContext.js'),
    /showReader: \(w\) => \{ if \(!activeOverlay\) activeOverlay = w; \}/);
});

test('B5: the LEVEL-UP screen keeps its slot test - it is the other half of PopToHUD', () => {
  // RestFinishedPopup_OnClose is `PopToHUD(); RaiseSkills();` in that
  // order (DaggerfallRestWindow.cs:728-732), and ui/restWindow.js's
  // `_close` carries the whole reasoning: the window vacates the host's
  // slot precisely so the level-up screen RaiseSkills can raise finds
  // it free. Converting this guard to a push would make that ordering
  // law unobservable - the screen would open either way - so the pair
  // moves together or not at all.
  assert.match(src('src/scenes/worldModes.js'),
    /if \(!interiorOverlay\) interiorOverlay = host\.makeCharSheet\?\.\(\) \?\? new LevelUpScreen\(playerEntity\);/);
  assert.match(src('src/ui/restWindow.js'), /PopToHUD\(\); RaiseSkills\(\);/);
});
