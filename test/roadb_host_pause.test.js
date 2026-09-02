// ROAD TO 1:1, THE TAIL - THE HOSTS ADOPT THE STACK'S *PAUSE*.
//
// B1 ported UserInterfaceManager whole and the hosts took its DEPTH.
// They did not take its PAUSE: `windowStack.paused()` had exactly ONE
// reference in src/ - its own definition - while every host still
// answered "is a window holding the world?" out of its own slot-and-
// depth arithmetic, which is the per-host class Road-To-1-1.md's
// standing watch names ("the pause architecture stays per-host; every
// new host takes the gate by hand").
//
// THE C# THIS RESTS ON. DFU stops the world in one place:
//   - UserInterfaceManager.AddWindow (:179-186) calls
//     `GameManager.Instance.PauseGame(true)` for any window whose
//     `PauseWhileOpen` is set;
//   - UserInterfaceManager.RemoveWindow (:190-216) calls
//     `PauseGame(false)` ONLY once the stack is back to the HUD;
//   - GameManager.PauseGame (:600-635) is what sets `Time.timeScale =
//     0` and `InputManager.Instance.IsPaused = true` - the timeScale
//     every motor, mover, ticker and look gate in the port reads;
//   - UserInterfaceWindow.cs:141 - `pauseWhileOpened` defaults TRUE,
//     and DaggerfallHUD is the override that opts out.
// So the pause is a LATCH over the whole stack, not a fold over its
// top: a non-pausing window laid over a pausing one leaves the game
// paused, and a box closing over a suspended rest does not resume it.
//
// This file pins that adoption, host by host, by RUNNING THE SHIPPED
// LINE: each host's one pause reader is lifted out of its source and
// driven against a real makeWindowStack. Both of its terms are load
// bearing and both are killed here - see the two mutations named on
// the assertions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

import { makeWindowStack, pauseWhileOpen } from '../src/ui/windowStack.js';
import { createTownTalk } from '../src/scenes/townTalk.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The four hosts that own a stack, and the ONE reader each answers
 *  its pause with. `slot` is the host's own overlay variable - the
 *  mirror of the top that ~55 hand-written close paths across these
 *  files write directly, which is the port seam the second term of
 *  every one of these readers exists for. */
const HOSTS = [
  { file: 'src/scenes/worldModes.js', name: 'interiorPaused', stack: 'interiorWindows', slot: 'interiorOverlay' },
  { file: 'src/scenes/dungeonContext.js', name: 'dungeonPaused', stack: 'dungeonWindows', slot: 'activeOverlay' },
  { file: 'src/scenes/townTalk.js', name: 'talkPaused', stack: 'windows', slot: 'overlay' },
  { file: 'src/scenes/interior.js', name: 'gamePaused', stack: 'windows', slot: 'overlay' },
];

/** Lift a host's shipped pause reader and mount it on a real stack.
 *  Nothing is retyped here: the expression that runs is the one in
 *  src/, so a revert to the old arithmetic runs in these assertions. */
function mount({ file, name, stack, slot }) {
  const text = src(file);
  const m = new RegExp(`const ${name} = \\(\\) => ([^\\n;]+);`).exec(text);
  assert.ok(m, `${file}: ${name} is the host's one pause reader`);
  const live = { win: null };
  const windows = makeWindowStack({ onTop: (w) => { live.win = w; } });
  const paused = new Function('stack_', 'pauseWhileOpen', 'live',
    `const ${stack} = stack_; return () => { const ${slot} = live.win; return (${m[1]}); };`,
  )(windows, pauseWhileOpen, live);
  return { paused, windows, live, expr: m[1] };
}

for (const host of HOSTS) {
  test(`ROAD-tail: ${host.file} pauses on PUSH and resumes on the DRAIN, through the one primitive`, () => {
    const { paused, windows, live } = mount(host);
    const rest = { name: 'rest' };
    const box = { name: 'box' };

    assert.equal(paused(), false, 'an empty stack is gameplay');

    // AddWindow (:179-186) -> PauseGame(true).
    windows.pushWindow(rest);
    assert.equal(live.win, rest, 'the slot mirrors the top');
    assert.equal(paused(), true, 'a pushed window stops the world');

    // ...and a second window over it does not un-stop it.
    windows.pushWindow(box);
    assert.equal(paused(), true);

    // THE LATCH, not a fold. The host's close paths null the slot by
    // hand; `reconcile` is what turns that into PopWindow. In the gap
    // between the two the world is still stopped, because the window
    // underneath is still open.
    live.win = null;
    assert.equal(paused(), true, 'the latch holds across the hand-written null');
    windows.reconcile(live.win);
    assert.equal(live.win, rest, 'the covered window has the screen back');
    assert.equal(paused(), true,
      'RemoveWindow lowers the pause only on the DRAIN (:201-215) - not when a box pops off a rest');

    // ...and only the drain resumes it.
    live.win = null;
    windows.reconcile(live.win);
    assert.equal(paused(), false, 'the stack is back to the HUD: PauseGame(false)');
  });

  test(`ROAD-tail: ${host.file} answers PauseWhileOpen, not truthiness - and answers before reconcile`, () => {
    const { paused, windows, live } = mount(host);

    // MUTATION 1, the one this whole item is about: revert the reader
    // to the arithmetic it replaced - `!!slot || stack.depth() > 0` -
    // and this dies. DaggerfallHUD's `pauseWhileOpened = false`
    // (UserInterfaceWindow.cs:141, DaggerfallHUD.cs's override) is a
    // window that is UP and does not pause; a depth count cannot tell
    // the two apart, and the latch never rose for it.
    windows.pushWindow({ name: 'hud', pauseWhileOpen: false });
    assert.equal(live.win?.name, 'hud', 'the window really is on top');
    assert.equal(paused(), false, 'a non-pausing window is open and the game still runs');

    // ...and it still does not un-pause what is under it.
    windows.pushWindow({ name: 'box' });
    assert.equal(paused(), true);

    // MUTATION 2, the other direction: drop the second term and leave
    // the bare `stack.paused()`. The hosts write their slot directly
    // in ~55 places (DFU windows can only arrive through PushWindow),
    // and every reader here runs between such a write and the next
    // reconcile - a getter read from the outer hosts' EVENT handlers.
    // Answering "no window" for those milliseconds frees the cursor
    // and re-grabs pointer lock under the window about to be painted.
    const { paused: p2, live: l2 } = mount(host);
    l2.win = { name: 'opened by hand' };
    assert.equal(p2(), true, 'a window in the slot pauses before the stack has heard about it');
  });
}

// ---------------------------------------------------------------------
// The same law on a LIVE host, driven through its public gate rather
// than a lifted expression. townTalk is the one of the four that
// builds without ARENA2 or a GL context.
// ---------------------------------------------------------------------

test('ROAD-tail: townTalk.overlayActive IS the stack pause - a push stops the street, the drain restarts it', () => {
  const host = createTownTalk({
    renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
    fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
    regionIndex: 0,
  });
  assert.equal(host.overlayActive, false);

  host.showOverlay({ name: 'rest' });
  assert.equal(host.overlayActive, true, 'AddWindow -> PauseGame(true)');

  host.pushOverlay({ name: 'quest box' });
  assert.equal(host.overlayActive, true);

  host.closeOverlay();
  assert.equal(host.overlay?.name, 'rest', 'the rest is back');
  assert.equal(host.overlayActive, true,
    'and the world is still stopped for it - the pause is a latch over the STACK');

  host.closeOverlay();
  assert.equal(host.overlay, null);
  assert.equal(host.overlayActive, false, 'only the drained stack is gameplay again');
});

// ---------------------------------------------------------------------
// THE SWEEP. The primitive is only a narrowing if nobody re-derives it.
// ---------------------------------------------------------------------

const walk = (rel) => {
  const out = [];
  const rec = (r) => {
    for (const e of readdirSync(new URL(`../${r}`, import.meta.url))) {
      const p = `${r}/${e}`;
      if (statSync(new URL(`../${p}`, import.meta.url)).isDirectory()) rec(p);
      else if (e.endsWith('.js')) out.push(p);
    }
  };
  rec(rel);
  return out;
};

test('ROAD-tail SWEEP: no host re-derives the pause - windowStack.paused() is the only source', () => {
  // 1. The depth count is gone from every gate. `depth()` survives as
  //    the stack's WindowCount question (:70-73); asking it about the
  //    PAUSE is the thing that was per-host, and no file does it now.
  const offenders = walk('src')
    .filter((f) => f !== 'src/ui/windowStack.js')
    .filter((f) => /\.depth\(\)\s*[<>=!]/.test(src(f)));
  assert.deepEqual(offenders, [],
    'a host is deciding its pause by counting the stack instead of asking paused()');

  // 2. Each stack-owning host asks the primitive exactly ONCE, in the
  //    one reader named here, and every gate in the file reads that.
  for (const { file, name, stack } of HOSTS) {
    const text = src(file);
    assert.equal((text.match(new RegExp(`\\b${stack}\\.paused\\(\\)`, 'g')) ?? []).length, 1,
      `${file}: one call to the primitive`);
    assert.equal((text.match(new RegExp(`const ${name} = \\(\\) =>`, 'g')) ?? []).length, 1,
      `${file}: one pause reader`);
    assert.ok((text.match(new RegExp(`\\b${name}\\(\\)`, 'g')) ?? []).length >= 1,
      `${file}: and the file answers its pause with it - at minimum the getter its hosts read`);
  }

  // 3. The two outdoor hosts own no stack; their pause is the UNION of
  //    the hosts' stacks that are live over their frame - the port's
  //    one departure from DFU's single UserInterfaceManager. That union
  //    is composed once per host, not at each of its ~9 call sites.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const text = src(f);
    assert.equal((text.match(/townTalk\.overlayActive \|\| \(modes\?\.overlayHeld \?\? false\)/g) ?? []).length, 1,
      `${f}: the composition is written once`);
    assert.match(text, /const gamePaused = \(\) => townTalk\.overlayActive \|\| \(modes\?\.overlayHeld \?\? false\);/,
      `${f}: ...and that one place is the host's pause reader`);
    assert.ok((text.match(/\bgamePaused\(\)/g) ?? []).length >= 6, `${f}: which its gates read`);
  }

  // 4. ...and the whole point: `paused()` is no longer a primitive with
  //    one reference (its own definition). Every host that owns a stack
  //    now reaches it.
  const callers = walk('src').filter((f) => f !== 'src/ui/windowStack.js' && /\.paused\(\)/.test(src(f)));
  assert.deepEqual(callers.sort(), HOSTS.map((h) => h.file).sort(),
    'exactly the stack-owning hosts call the primitive, and all of them do');
});

test('ROAD-tail SWEEP: the two hosts that read another host\'s pause read its GETTER, never its slot', () => {
  // dungeon.js and the two outdoor hosts do not own a stack. They ask
  // the host that does - `ctx.uiOverlayActive` (dungeonContext's
  // `dungeonPaused`), `townTalk.overlayActive` (`talkPaused`),
  // `modes.overlayHeld` (`interiorPaused`) - which is DFU asking one
  // UIManager. What they must never do is reach past that for the
  // other host's overlay variable and re-derive the answer.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const text = src(f).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/overlayWindow\(\)\s*(\?|&&|\|\||\))/.test(text),
      `${f}: a probe surface is not a pause gate`);
    assert.ok(!/\.depth\(\)/.test(text), `${f}: and the depth is not this host's to count`);
  }
  // The standalone dungeon host reads exactly one thing for its pause.
  const dj = src('src/scenes/dungeon.js');
  assert.match(dj, /const overlayHeld = ctx\.uiOverlayActive;/,
    'dungeon.js takes the context\'s pause once and gates the whole frame on it');
});
