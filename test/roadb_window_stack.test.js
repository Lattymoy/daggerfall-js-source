// ROAD TO 1:1, WAVE B / B1 - THE WINDOW STACK.
//
// UserInterfaceManager (Game/UserInterface/UserInterfaceManager.cs) is
// a stack, and the port has held ONE slot per host since U3. These pins
// are the ported class's own law, read straight off the C#: what
// TopWindow is, who gets OnPush/OnPop/OnReturn, when the game is
// paused, what WindowCount counts, and the message queue's overflow
// rule. The host adoption is pinned next door, in
// roadb_window_stack_hosts.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeWindowStack, buildParamDict, pauseWhileOpen } from '../src/ui/windowStack.js';

const win = (name, extra = {}) => ({ name, ...extra });

test('B1: TopWindow is the last pushed, and PopWindow returns the one beneath', () => {
  // TopWindow (:54-57), PushWindow (:79-91), PopWindow (:99-104).
  const s = makeWindowStack();
  assert.equal(s.topWindow(), null, 'an empty stack has no top');
  const a = win('a'), b = win('b');
  s.pushWindow(a);
  assert.equal(s.topWindow(), a);
  s.pushWindow(b);
  assert.equal(s.topWindow(), b, 'the pushed window is over the open one');
  assert.equal(s.containsWindow(a), true, 'and the open one is still on the stack');
  s.popWindow();
  assert.equal(s.topWindow(), a, 'popping RETURNS to it - it was not destroyed');
  s.popWindow();
  assert.equal(s.topWindow(), null);
});

test('B1: AddWindow calls OnPush, RemoveWindow calls OnPop then the uncovered OnReturn', () => {
  // AddWindow (:179-186) / RemoveWindow (:190-216).
  const order = [];
  const a = { name: 'a', onPush: () => order.push('a.push'), onPop: () => order.push('a.pop'), onReturn: () => order.push('a.return') };
  const b = { name: 'b', onPush: () => order.push('b.push'), onPop: () => order.push('b.pop'), onReturn: () => order.push('b.return') };
  const s = makeWindowStack();
  s.pushWindow(a);
  s.pushWindow(b);
  s.popWindow();
  assert.deepEqual(order, ['a.push', 'b.push', 'b.pop', 'a.return'],
    'the popped window is told first, then the one it uncovered');
  s.popWindow();
  assert.deepEqual(order.at(-1), 'a.pop', 'and the last window has nobody to return to');
});

test('B1: PauseWhileOpen defaults TRUE and the pause is a LATCH, not a fold', () => {
  // UserInterfaceWindow.cs:141 (`pauseWhileOpened = true`), AddWindow
  // :183-184, RemoveWindow :201-215, GameManager.IsPlayingGame :926-942.
  assert.equal(pauseWhileOpen({}), true, 'a window with no field pauses');
  assert.equal(pauseWhileOpen({ pauseWhileOpen: false }), false);

  const s = makeWindowStack();
  assert.equal(s.paused(), false);
  const rest = win('rest');
  const free = win('free', { pauseWhileOpen: false });
  s.pushWindow(rest);
  assert.equal(s.paused(), true);
  // THE LATCH. A non-pausing window laid over a pausing one leaves the
  // game paused, because PauseGame(false) only runs when the stack
  // drains - it is not recomputed from the top.
  s.pushWindow(free);
  assert.equal(s.paused(), true, 'the game does not resume under a non-pausing window');
  s.popWindow();
  assert.equal(s.paused(), true);
  s.popWindow();
  assert.equal(s.paused(), false, 'draining to nothing resumes it');

  // ...and AddWindow's own guard (:183-184), which is what this
  // assertion actually pins: a non-pausing window pushed onto a drained
  // stack does not re-raise the latch. (It is NOT IsPlayingGame's
  // :937-939 top-window test - the port folds that term into the latch,
  // which is UIManager-local and cannot be lowered from outside; see
  // windowStack.js's `paused` note.)
  s.pushWindow(free);
  assert.equal(s.paused(), false);
});

test('B1: the HUD is the base window - never popped, never counted, never pausing', () => {
  // RemoveWindow's `!(TopWindow is DaggerfallHUD)` (:193) and
  // WindowCount's `windows.Count-1` (:70-73).
  const hud = win('hud', { pauseWhileOpen: false });
  const s = makeWindowStack({ hud });
  assert.equal(s.topWindow(), hud);
  assert.equal(s.windowCount(), 0, 'the HUD is not a window for WindowCount');
  assert.equal(s.paused(), false, 'the HUD alone is gameplay');
  s.pushWindow(win('a'));
  assert.equal(s.windowCount(), 1);
  assert.equal(s.paused(), true);
  s.popWindow();
  assert.equal(s.topWindow(), hud);
  assert.equal(s.paused(), false, 'back to the HUD resumes');
  s.popWindow();
  assert.equal(s.topWindow(), hud, 'and the HUD cannot be popped off');
});

test('B1: ChangeWindow replaces the whole stack; clear() is its first half', () => {
  // ChangeWindow (:123-131).
  const s = makeWindowStack();
  const a = win('a'), b = win('b'), c = win('c');
  s.pushWindow(a); s.pushWindow(b);
  s.changeWindow(c);
  assert.equal(s.topWindow(), c);
  assert.equal(s.containsWindow(a), false);
  assert.equal(s.containsWindow(b), false);
  assert.equal(s.depth(), 1, 'nothing survives underneath');
  s.clear();
  assert.equal(s.topWindow(), null);
  assert.equal(s.paused(), false, 'and the pause drains with it');
});

test('B1: the message queue - FIFO, and overflow CLEARS it', () => {
  // PostMessage (:139-150), GetMessage (:157-163), PeekMessage (:168-174).
  const s = makeWindowStack();
  assert.equal(s.getMessage(), '', 'an empty queue answers the empty string, not null');
  assert.equal(s.peekMessage(), '');
  s.postMessage('one'); s.postMessage('two');
  assert.equal(s.messageCount(), 2);
  assert.equal(s.peekMessage(), 'one', 'peek does not remove');
  assert.equal(s.messageCount(), 2);
  assert.equal(s.getMessage(), 'one');
  assert.equal(s.getMessage(), 'two');
  assert.equal(s.messageCount(), 0);
  // DFU's own TODO: on overflow the whole queue is thrown away and the
  // new message is the only one left.
  for (let i = 0; i < 10; i++) s.postMessage(`m${i}`);
  assert.equal(s.messageCount(), 10);
  s.postMessage('overflow');
  assert.equal(s.messageCount(), 1);
  assert.equal(s.peekMessage(), 'overflow');
});

test('B1: BuildParamDict', () => {
  // :222-240 - `?` splits pairs with RemoveEmptyEntries, `=` splits
  // each pair, anything that is not exactly one pair is skipped.
  assert.deepEqual(buildParamDict('?id=1?name= Bob '), { id: '1', name: 'Bob' });
  assert.deepEqual(buildParamDict('id=1?broken?x=2'), { id: '1', x: '2' });
  assert.deepEqual(buildParamDict(''), {});
});

test('B1: onTop mirrors the top into the host slot on every move', () => {
  // The adoption seam: a host keeps its `let overlay` and the stack
  // writes it, so nothing downstream of the slot has to change.
  let slot = null;
  const s = makeWindowStack({ onTop: (w) => { slot = w; } });
  const a = win('a'), b = win('b');
  s.pushWindow(a);
  assert.equal(slot, a);
  s.pushWindow(b);
  assert.equal(slot, b);
  s.popWindow();
  assert.equal(slot, a, 'the suspended window comes back into the slot');
  s.popWindow();
  assert.equal(slot, null);
});

test('B1: reconcile turns a host that nulled its slot by hand into a POP', () => {
  // THE PORT SEAM. ~40 close paths across the hosts do
  // `if (interiorOverlay === win) interiorOverlay = null`. Read back,
  // that is PopWindow - and the window underneath returns.
  let slot = null;
  const s = makeWindowStack({ onTop: (w) => { slot = w; } });
  const rest = win('rest'), box = win('box');
  s.pushWindow(rest);
  s.pushWindow(box);

  assert.equal(s.reconcile(slot), false, 'an unchanged slot moves nothing');

  slot = null;                       // the box's own onClose
  assert.equal(s.reconcile(slot), true);
  assert.equal(slot, rest, 'the rest window is back in the slot');
  assert.equal(s.depth(), 1);

  slot = null;                       // and the rest closes too
  s.reconcile(slot);
  assert.equal(s.depth(), 0);
  assert.equal(s.paused(), false);
  assert.equal(s.reconcile(null), false, 'an empty stack with an empty slot is quiet');
});

test('B1: reconcile treats a hand-assigned successor as a one-level replace', () => {
  // A window dispatching to another by raw assignment (the port's
  // dispatch idiom) must NOT grow the stack - DFU's own dispatch is
  // CloseWindow-then-Push, which nets to a replacement - and must not
  // throw away the depth beneath it either.
  let slot = null;
  const s = makeWindowStack({ onTop: (w) => { slot = w; } });
  const rest = win('rest'), talk = win('talk'), choice = win('choice');
  s.pushWindow(rest);
  s.pushWindow(talk);
  slot = choice;                     // `interiorOverlay = successor`
  assert.equal(s.reconcile(slot), true);
  assert.equal(s.topWindow(), choice);
  assert.equal(s.depth(), 2, 'one level replaced, not one level added');
  assert.equal(s.containsWindow(talk), false);
  slot = null;
  s.reconcile(slot);
  assert.equal(slot, rest, 'and the rest is still underneath');

  // The replace RAISES the latch itself - AddWindow's :183-184 in
  // ChangeWindow's clothing. A non-pausing window handing over to a
  // pausing successor is the one state where that raise decides, and
  // `paused()` is the latch alone, so nothing else can answer for it.
  const s2 = makeWindowStack();
  s2.pushWindow(win('free', { pauseWhileOpen: false }));
  assert.equal(s2.paused(), false);
  assert.equal(s2.reconcile(win('menu')), true);
  assert.equal(s2.paused(), true, 'the successor pauses even though the window it replaced did not');
});

test('B1: reconcile adopts a slot filled while the stack was empty', () => {
  let slot = null;
  const s = makeWindowStack({ onTop: (w) => { slot = w; } });
  const w = win('w');
  slot = w;
  assert.equal(s.reconcile(slot), true);
  assert.equal(s.topWindow(), w);
  assert.equal(s.depth(), 1);
  assert.equal(s.paused(), true, 'and it pauses like any pushed window');
});
