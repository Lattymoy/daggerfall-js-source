// FIRM-SIGNPANEL (2026-10-25): A BIRTHSIGN ACCEPTED OUTSIDE THE WINDOW IS NAMED IN IT. The open Firmament window hears the
// book's word (src/ui/firmamentWindow.js, the book's onChange) and starts its pending sky again from the tree that moved
// under it. A sign-only change moves no star, so a reset that asked only for stars added or removed kept the old pending
// sky, and the side panel said "No birthsign chosen" over a sign already in force (seen in-game verifying #1253).
import '../modsOff.js';
import { byClass } from '../chargenDom.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { mountFirmamentWindow } from '../../src/ui/firmamentWindow.js';
import { signById } from '../../src/net/firmament/firmamentTree.js';
import { setFirmamentOnline, setFirmamentTree, _resetFirmamentLiveForTests } from '../../src/systems/firmamentLive.js';
import { _resetSigilForTests } from '../../src/systems/sigil/sigil.js';

// chargenDom runs a frame at once; the sky's frame asks for the next one first, so the loop would never end. The side
// panel is plain DOM that refresh() builds, so the canvas need not draw.
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

/** The page's book, as the window reads it: the tree in force, the purses, and its word when the tree moves. */
function fakeBook(tree) {
  const listeners = new Set();
  const book = {
    state: { open: true, tree, stars: 4, craft: 0, renown: 3 },
    current: () => book.state.tree,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    read: () => Promise.resolve(),
    canRespec: () => false,
    /** A change accepted somewhere else - another window, tab or device - as the book then tells the page. */
    accepted(next) {
      book.state.tree = next;
      for (const fn of listeners) fn(book.state);
    },
  };
  return book;
}

/** The world host's own listener (scenes/world.js: the book's tree is the tree in force). */
const hostHears = (book) => book.onChange((st) => setFirmamentTree(st.tree));

const panel = (host) => byClass(host, 'fmt-side')[0];
const signLine = (host) => panel(host).children[0].textContent;
const statusLine = (host) => byClass(panel(host), 'fmt-live')[0].textContent;
const acceptLabel = (host) => byClass(host, 'fmt-go')[0].textContent;

beforeEach(() => {
  _resetFirmamentLiveForTests();
  _resetSigilForTests();
  setFirmamentOnline(true);
});

test('FIRM-SIGNPANEL: a sign-only change accepted outside the window names the sign and says the stars act', () => {
  const book = fakeBook({ start: null, keys: [] });
  hostHears(book);
  const host = globalThis.document.createElement('div');
  mountFirmamentWindow(host, { book, embed: true });
  assert.equal(signLine(host), 'No birthsign chosen');

  book.accepted({ start: 'wr.start', keys: [] });

  assert.equal(signLine(host), signById('wr').name);
  assert.equal(statusLine(host), 'Your accepted stars are active.');
  assert.equal(acceptLabel(host), 'Accept', 'the accepted sign is not a change still to accept');
});

test('FIRM-SIGNPANEL: a sign changed outside the window, the stars unchanged, names the new sign', () => {
  const book = fakeBook({ start: 'wr.start', keys: [] });
  hostHears(book);
  setFirmamentTree(book.state.tree);
  const host = globalThis.document.createElement('div');
  mountFirmamentWindow(host, { book, embed: true });
  assert.equal(signLine(host), signById('wr').name);

  book.accepted({ start: 'mg.start', keys: [] });

  assert.equal(signLine(host), signById('mg').name);
  assert.equal(acceptLabel(host), 'Accept');
});
