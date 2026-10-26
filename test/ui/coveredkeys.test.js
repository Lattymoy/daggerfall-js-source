// COVERED-KEYS (2026-10-25, found fixing BOX-ON-TOP, PR #1286): a message box pushed over an enhanced window - a tutorial
// page, a refusal - is the top of its host's stack, but the window's own capture keydown on the window hears every key
// before any host routes it to the top window. So under the box Escape closed the window and Enter pressed its action.
// Daggerfall Unity gives input to the top window alone (UserInterfaceManager.cs:54-57).
//
// Each door is opened here on the enhanced skin over the suite's minimal DOM, its window held in a real stack with a real
// box pushed over it, and the browser's keys are dispatched the way a browser does (window capture listeners first). The
// box gone, the same key reaches the window again - the guard is a question asked at the press, not a key thrown away.
import { keydown as dispatchKeydown, keyup } from '../chargenDom.mjs';   // the suite's minimal DOM (its side effect: the globals)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindowStack } from '../../src/ui/windowStack.js';
import { ActionTextBox } from '../../src/ui/actionText.js';
import { createSpellbookWindow } from '../../src/ui/spellbookDoor.js';
import { createChronicleWindow } from '../../src/ui/chronicleDoor.js';
import { createInventoryWindow } from '../../src/ui/inventoryDoor.js';
import { createTavernWindow } from '../../src/ui/tavernDoor.js';
import { createPlayerTradeWindow } from '../../src/ui/playerTradeDoor.js';
import { createMerchantServiceWindow } from '../../src/ui/merchant/merchantServiceDoor.js';
import { createMerchantRepairWindow } from '../../src/ui/merchant/merchantRepairDoor.js';
import { openPauseFlow } from '../../src/ui/pauseDoor.js';
import { createCharSheetWindow } from '../../src/ui/charSheetDoor.js';
import { TradeSession } from '../../src/net/tradeSession.js';
import { createTradePack } from '../../src/systems/tradePack.js';

globalThis.location = { search: '?skin=enhanced' };

/** The book and the chronicle listen on `window`. It stands only while they do: a module that sees one at load
 *  believes it is in a browser and asks Vite's import.meta.glob (player/eyeOfTheBeholder/eotbSprite.js). */
async function withWindow(fn) {
  globalThis.window = globalThis;
  try { await fn(); } finally { delete globalThis.window; }
}

/** A browser's keydown, with the stop the player trade's handler calls (the minimal DOM's event has the other two). */
const keydown = (key) => dispatchKeydown(key, undefined, { stopImmediatePropagation() { this.stopped = true; } });

/** The window's lazy chunk has landed (ui/enhanced/enhancedChunk.js): the view drew into the host its door laid in the
 *  body. The Ascension's wait (charSheetDoor.js paintLevelUpWait) is not the view. */
async function mounted(host) {
  const drawn = () => host.children.some((c) => c.id !== 'levelup-wait');
  for (let waited = 0; !drawn() && waited < 5000; waited += 5) await new Promise((r) => setTimeout(r, 5));
  assert.ok(drawn(), `${host.id}: the view never mounted`);
}

/** The window `open()` builds, held in a stack with a box pushed over it: `under(win, stack)` runs with the box up,
 *  `uncovered(win)` once it is gone. */
async function withBoxOver(open, { under, uncovered }) {
  const win = open();
  assert.ok(win, 'the door built the enhanced window');
  const stack = makeWindowStack();
  try {
    await mounted(globalThis.document.body.children.at(-1));
    stack.pushWindow(win);
    stack.pushWindow(new ActionTextBox(['You do not have enough spell points left.']));
    under(win, stack);
    stack.popWindow();
    uncovered(win);
  } finally {
    win.dispose?.();
  }
}

/** Under the box: Escape and Enter are left alone - nothing prevented, nothing closed. */
function keysLeftToTheBox(win, label) {
  for (const key of ['Escape', 'Enter']) {
    const ev = keydown(key);
    assert.equal(ev.defaultPrevented, false, `${label}: ${key} was taken by the window under the box`);
    assert.equal(win.done, false, `${label}: ${key} closed the window under the box`);
  }
}

test('COVERED-KEYS: the spellbook leaves Escape and Enter to a box over it, and takes Escape back once it is gone', async () => {
  await withWindow(() => withBoxOver(() => createSpellbookWindow({ entity: { spells: [], magicka: 10 } }), {
    under: (win) => keysLeftToTheBox(win, 'spellbook'),
    uncovered: (win) => { keydown('Escape'); assert.equal(win.done, true, 'the book no longer answers its own Escape'); },
  }));
});

test('COVERED-KEYS: the chronicle leaves Escape and Enter to a box over it', async () => {
  await withWindow(() => withBoxOver(() => createChronicleWindow({ section: 'notes' }), {
    under: (win) => keysLeftToTheBox(win, 'chronicle'),
    uncovered: (win) => { keydown('Escape'); assert.equal(win.done, true, 'the chronicle no longer answers its own Escape'); },
  }));
});

test('COVERED-KEYS: the pack leaves Escape and Enter to a box over it', async () => {
  await withBoxOver(() => createInventoryWindow({ items: () => [], entity: { items: [], equipped: {} } }), {
    under: (win) => keysLeftToTheBox(win, 'pack'),
    uncovered: (win) => { keydown('Escape'); assert.equal(win.done, true, 'the pack no longer answers its own Escape'); },
  });
});

test('COVERED-KEYS: the tavern panel leaves Escape and Enter to a box over it', async () => {
  let closed = 0;
  await withBoxOver(() => createTavernWindow({
    onClose: () => { closed++; },
    entity: { goldPieces: 100, rentedRooms: [], items: [] },
    now: () => 0, mapId: () => 1, buildingKey: () => 2, buildingName: () => 'The Lamp', quality: () => 10,
  }), {
    under: (win) => { keysLeftToTheBox(win, 'tavern'); assert.equal(closed, 0); },
    uncovered: (win) => { keydown('Escape'); assert.equal(win.done, true, 'the panel no longer answers its own Escape'); },
  });
});

test('COVERED-KEYS: the merchant\'s two panels leave Escape and Enter to a box over them', async () => {
  for (const [name, open] of [['service', createMerchantServiceWindow], ['repair', createMerchantRepairWindow]]) {
    await withBoxOver(() => open({}), {
      under: (win) => keysLeftToTheBox(win, `merchant ${name}`),
      uncovered: (win) => { keydown('Escape'); assert.equal(win.done, true, `the ${name} panel no longer answers its own Escape`); },
    });
  }
});

test('COVERED-KEYS: a trade between players is not cancelled by an Escape meant for a box over it', async () => {
  const me = { items: [], goldPieces: 0 };
  const session = new TradeSession({ sid: 'covered1', me: 'peerAAAA', peer: 'peerBBBB', peerName: 'Brenna', pack: createTradePack(me), send: () => true, near: () => true });
  let cancelled = 0;
  const cancel = session.cancel.bind(session);
  session.cancel = () => { cancelled++; cancel(); };
  await withBoxOver(() => createPlayerTradeWindow(session, { items: () => me.items, entity: me, gold: () => me.goldPieces }), {
    under: (win) => { keysLeftToTheBox(win, 'player trade'); assert.equal(cancelled, 0, 'Escape cancelled the trade under the box'); },
    uncovered: () => { keydown('Escape'); assert.equal(cancelled, 1, 'the trade no longer answers its own Escape'); },
  });
});

test('COVERED-KEYS: the pause window resumes on neither the press nor the release of an Escape meant for a box over it', async () => {
  let resumed = 0;
  await withBoxOver(() => openPauseFlow(() => {}, { onResume: () => { resumed++; }, relock: () => {} }), {
    under: (win, stack) => {
      keysLeftToTheBox(win, 'pause');
      keyup('Escape');
      assert.equal(resumed, 0, 'the release resumed the game under the box');
      assert.equal(win.done, false);
      // a press the pause face armed (it answers on the release, AUDIT DISC28 UI-2), and a box up before the release
      stack.popWindow();
      assert.equal(keydown('Escape').defaultPrevented, true, 'the pause face arms on the press');
      stack.pushWindow(new ActionTextBox(['A line.']));
      keyup('Escape');
      assert.equal(resumed, 0, 'the release under the box resumed the game');
    },
    uncovered: (win) => {
      keyup('Escape');
      assert.equal(resumed, 0, 'a press armed before the box came up answered a release after it went');
      keydown('Escape');
      keyup('Escape');
      assert.equal(resumed, 1, 'the pause window no longer answers its own Escape');
      assert.equal(win.done, true);
    },
  });
});

test('COVERED-KEYS: the character sheet leaves Escape and its own sheet key to a box over it', async () => {
  await withBoxOver(() => createCharSheetWindow({ entity: { level: 1, stats: {}, skills: {} } }), {
    under: (win) => {
      keysLeftToTheBox(win, 'character sheet');
      const ev = keydown('F5');
      assert.equal(ev.defaultPrevented, false, 'the sheet key was taken by the sheet under the box');
      assert.equal(win.done, false, 'the sheet key closed the sheet under the box');
    },
    uncovered: (win) => { keydown('F5'); assert.equal(win.done, true, 'the sheet no longer answers its own key'); },
  });
});

test('COVERED-KEYS: the Ascension does not confirm on an Enter meant for a box over it', async () => {
  await withBoxOver(() => createCharSheetWindow({ entity: { level: 2, readyToLevelUp: true, stats: {}, skills: {} } }), {
    under: (win) => keysLeftToTheBox(win, 'level-up'),
    uncovered: () => { assert.equal(keydown('Enter').defaultPrevented, true, 'the Ascension no longer answers its own Enter'); },
  });
});
