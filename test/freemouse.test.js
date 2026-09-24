// FREEMOUSE (2026-09-22, Mac: "Lets also add an entirely new keybind. A
// mouse free that allows you to toggle the use of your mouse").
//
// THE TOGGLE ITSELF IS NOT NEW, AND SAYING SO IS THE POINT. DFU has
// `Actions.ActivateCursor` and PlayerMouseLook.cs:190-198 reads it; the
// port has read it since U45, and `toggleCursorActive` is that law. What
// Mac asked for and what did not exist is a key that is ONLY the mouse.
//
// WHY THAT MATTERS RATHER THAN BEING A SECOND NAME FOR ONE THING:
// ActivateCursor's default is ENTER, and online Enter is also the chat's
// open (ui/chatPanel.js CHAT_OPEN_ACTION). So the one press a player
// reaches for to free the mouse is the same press that opens a text box,
// and PL3 had to WORK AROUND that rather than resolve it, because DFU's
// binding is DFU's and the port does not get to re-key it. A second
// ACTION resolves it instead of arguing with it: Enter keeps DFU's
// meaning, FreeMouse is the player's own, and the two are ORed at the
// ONE reader so there is no second toggle to keep in step - a second
// binding over `_cursorActive` is precisely the bug PL3 spent a slice on.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIONS, DEFAULT_BINDINGS, PORT_ACTIONS, parseActionName, ACTION_GROUPS } from '../src/systems/inputActions.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { gridButtons } from '../src/ui/controlsWindow.js';   // KB1: the classic grid's own face (the enhanced pane no longer restates it)
import { KEYBIND_ROWS } from '../src/ui/mouseControlsWindow.js';
import { FREE_MOUSE_ACTION, toggleCursorActive, cursorActive, setCursorActive, requestLook } from '../src/player/pointerLock.js';

const stubCanvas = () => { const c = { calls: 0, requestPointerLock() { c.calls++; return Promise.resolve(); } }; return c; };

test('FREEMOUSE: the action is APPENDED, parses, and displaces no index the classic grid draws by number', () => {
  assert.equal(FREE_MOUSE_ACTION, 'FreeMouse');
  assert.equal(ACTIONS.indexOf('FreeMouse'), 52, 'appended when it landed, and it keeps that index - KB1 appended its rows AFTER it');
  assert.equal(ACTIONS.filter((a) => a === 'FreeMouse').length, 1, 'once');
  assert.equal(parseActionName('FreeMouse'), 'FreeMouse');
  // The law an appended action exists to keep: a saved bindings file
  // resolves by POSITION, and the classic grid draws Actions[2..40) on
  // fixed art, so a name spliced mid-list silently re-labels buttons.
  assert.equal(ACTIONS[43], 'AutoRun', 'DFU\'s last row keeps index 43');
  assert.equal(ACTIONS[44], 'SocialInteract');
  assert.deepEqual(gridButtons().map((b) => b.action), ACTIONS.slice(2, 40));
});

test('FREEMOUSE: the default key is the one letter DFU, the port and every vendored mod all leave alone', () => {
  const row = DEFAULT_BINDINGS.find(([, a]) => a === 'FreeMouse');
  assert.deepEqual(row, ['KeyY', 'FreeMouse']);

  // THE ELIMINATION, RUN RATHER THAN QUOTED. If a later mod or a later
  // port action takes Y, this reddens before a player finds one press
  // doing two things - which is exactly what HT4 was.
  const spent = new Set(DEFAULT_BINDINGS.filter(([, a]) => a !== 'FreeMouse').map(([c]) => c));
  assert.ok(!spent.has('KeyY'), 'nothing else defaults to Y');
  const modKeys = new Set();
  for (const def of Object.values(MOD_SETTINGS)) {
    for (const k of Object.values(def.keys)) {
      for (const v of [k.default, ...(k.options ?? [])]) {
        if (typeof v === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(v)) modKeys.add(`Key${v}`.replace(/^KeyKey/, 'Key'));
      }
    }
  }
  assert.ok(!modKeys.has('KeyY'), 'and no vendored mod ships or OFFERS Y - the choices count, not just the defaults');

  // ...and Y really was the LAST one: every other letter is spoken for,
  // which is why the key is what is left rather than what is apt.
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `Key${l}`);
  const free = letters.filter((c) => !spent.has(c) && !modKeys.has(c));
  assert.deepEqual(free, ['KeyY'], 'one letter was left in the whole keymap');

  // No key is spent twice, which is the check that catches a default
  // added without the sweep above being run.
  const codes = DEFAULT_BINDINGS.map(([c]) => c);
  assert.equal(new Set(codes).size, codes.length);
});

test('FREEMOUSE: the row is drawn under its OWN heading, is rebindable, and yields in the classic windows', () => {
  // A row the classic windows cannot draw MUST yield there, or a
  // classic player is told of a clash against a row they can neither
  // see nor clear - and cannot close the window past it.
  assert.ok(PORT_ACTIONS.includes('FreeMouse'));
  const classicFace = new Set([...gridButtons().map((b) => b.action), ...KEYBIND_ROWS.map((r) => r.action)]);
  assert.ok(!classicFace.has('FreeMouse'), 'it is on neither classic face, which is what makes the yield honest');

  // The enhanced pane CAN draw it, so it is rebindable there - a
  // bindable action with no row is a key nobody can move. KB1: the
  // groups are the registry's ACTION_GROUPS; 'Mouse' holds the two
  // cursor keys (DFU's ActivateCursor beside it now).
  const mouse = ACTION_GROUPS.find((g) => g.title === 'Mouse');
  assert.deepEqual(mouse.rows.map((r) => r.action), ['ActivateCursor', 'FreeMouse']);
  assert.match(mouse.rows[1].label, /mouse/i, 'the label is the thing the player came looking for');
  assert.equal(ACTION_GROUPS.flatMap((g) => g.rows).filter((r) => r.action === 'FreeMouse').length, 1, 'once, across every group');
  // Not filed under Online, although the Enter collision that motivates
  // it is an online one: freeing the mouse is something you do to read
  // the screen. QS2 already paid for that lesson.
  assert.ok(!ACTION_GROUPS.find((g) => g.title === 'Online').rows.some((r) => r.action === 'FreeMouse'));
});

test('FREEMOUSE: it toggles the one flag, and taking the mouse back asks for the lock', () => {
  setCursorActive(false);
  const canvas = stubCanvas();
  assert.equal(toggleCursorActive(canvas), true, 'the first press frees the mouse');
  assert.equal(cursorActive(), true);
  assert.equal(canvas.calls, 0, 'freeing asks for no lock');
  // ...and while it is free, the relock arms are refused - U45's
  // precedence, which is what makes this a TOGGLE rather than a nudge
  // the next gesture undoes.
  requestLook(canvas);
  assert.equal(canvas.calls, 0, 'a deliberately freed cursor is not taken back by a passing gesture');

  assert.equal(toggleCursorActive(canvas), false, 'the second press takes it back');
  assert.equal(cursorActive(), false);
  assert.equal(canvas.calls, 1, 'and asks for the lock inside that press');
  setCursorActive(false);
});

test('FREEMOUSE by source: ONE reader ORs the two actions - there is no second toggle to keep in step', () => {
  const pl = readFileSync('src/player/pointerLock.js', 'utf8');
  // The shape matters more than the strings: two actions read at one
  // place, in one listener, over one flag. A second bindCursorToggle
  // over the same module global is the bug PL3 spent a slice on, and a
  // host-side `e.code === 'KeyY'` is AUDIT 58's (a key-literal in a host
  // makes a rebindable row inert in both directions).
  // KB1: ...and ActivateCursor answers only while no chat claims its key (online, Enter opens the chat; Y frees the mouse)
  assert.match(pl, /const act = actionOf\(e\);\s*\n\s*if \(act !== FREE_MOUSE_ACTION && !\(act === 'ActivateCursor' && !cursorKeyClaimed\(\)\)\) return;/);
  assert.equal((pl.match(/addEventListener\('keydown', onKey, true\)/g) ?? []).length, 1, 'one listener');
  // No host COMPARES an event's code to the default key. The first
  // draft of this line swept for the string and caught
  // `telePopUp.input(yes ? 'KeyY' : 'KeyN')` in world.js - a Yes/No
  // window being handed a key NAME, which is the opposite of the thing
  // this forbids. What is banned is a host deciding the binding.
  const compares = /(?:e|ev|event)\.code\s*===?\s*['"]KeyY['"]|['"]KeyY['"]\s*===?\s*(?:e|ev|event)\.code/;
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/worldModes.js', 'src/player/pointerLock.js']) {
    assert.ok(!compares.test(readFileSync(f, 'utf8')), `${f} compares no event to the default key - the binding is the registry's`);
  }
});
