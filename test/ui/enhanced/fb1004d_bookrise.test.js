// FIELD BUGS 2026-10-04d BOOK-RISE (the Discord, 2026-10-04: "When using this item, the screen froze; no other key
// would close it. I had to restart the browser. It was while opening a bookshelf inside this house." - a book titled
// "The Hall of Records of Hearthton Manor", "Nothing is written here yet." on its left leaf, BLANK on its right).
//
// No loop hung the tab: the book was OPEN FOR GOOD. The enhanced face's exit() latches `closing` and asks Raum's
// closeBook to shut the cover - and closeBook refuses a book still riding up from below the screen (its 'slide-in',
// the first 260 ms it is seen). The ask was dropped, the latch refused every later one (Escape, E, Enter, a tap, Tab,
// the host's close), the frame only ever finished a close the book had TAKEN, so the book rose, opened and stood; the
// door never reported done, the host kept its pausing slot, every key went to the dead book (F5 among them, which the
// hosts swallow for DFU's character sheet). The shelf's own key is E, the book's exit is E, and the book arrives a
// read of the service later - a second press, or the held key's repeat, lands in the rise.
//
// The pins drive the field's book whole and headless: the seat derived as every client derives it (systems/town/townSeats.js),
// its Chronicle read through the client's own seat book, the window built by the world host's own expression
// (scenes/world.js hallOfRecords.read), mounted by the host's first draw through the reader's one door (ui/bookDoor.js),
// the real face (ui/enhanced/enhancedBook.js) and the real vendored book (vendor/raum-book/book.js) on a canvas that paints
// nothing, under a clock the test turns.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import '../../../src/ui/enhanced/enhancedBook.js';   // the chunk the door imports, warm: the door's dynamic import lands at once
import { BOOK } from '../../../vendor/raum-book/book.js';
import { hallOfRecordsWindow } from '../../../src/ui/hallOfRecords.js';
import { HALL_OF_RECORDS_EMPTY } from '../../../src/net/townSeatLaw.js';
import { createTownSeatBook } from '../../../src/net/townSeatBook.js';
import { seatOfLocation } from '../../../src/systems/town/townSeats.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { closeTopOverlay, clearOverlays, overlayOpen } from '../../../src/ui/enhanced/enhancedOverlays.js';
import { audio } from '../../../src/systems/audio.js';
import { SOUND } from '../../../src/systems/soundClips.js';

const FRAME_MS = 16;
/** A stand-in for its MAPS.BSA row (no ARENA2 in the tree; the numbers are not the game's), as townSeats.js reads one:
 *  a wealthy home whose building list holds a Palace - a palace seat, its palace's shelves its Hall of Records. */
const HEARTHTON = {
  name: 'Hearthton Manor', regionIndex: 16,
  mapTableData: { mapId: 0x0004c3a1, longitude: 120 * 128, latitude: (499 - 230) * 128 },
  exterior: { buildings: [{ buildingType: BUILDING_TYPES.House1 }, { buildingType: BUILDING_TYPES.Palace }] },
};
const SH = { name: 'The Silver Hand', tag: 'SH' }, EO = { name: 'Ebon Oath', tag: 'EO' };
/** A Chronicle long enough for several leaves, in the shape the service's read hands back (season1_records.test.js). */
const CHRONICLE = Array.from({ length: 24 }, (_, i) => (i % 2
  ? { kind: 'held', week: i + 1, data: { guild: i % 4 === 1 ? SH : EO, standing: 50 + i } }
  : { kind: 'claim', week: i + 1, data: { guild: i % 4 === 0 ? EO : SH, total: 6000 + i } }));

// ── a page that paints nothing, and a clock the test turns ─────────────────────────────────────────────────────────
const clock = { t: 0 };
let body = [], turns = 0;
const perf = Object.getOwnPropertyDescriptor(globalThis, 'performance');
const playOneShot = audio.playOneShot;
const ctx2d = () => ({
  font: '', fillStyle: '', textBaseline: '', textAlign: '', imageSmoothingEnabled: true,
  measureText: (s) => ({ width: String(s).length * 9 }),
  clearRect() {}, fillRect() {}, drawImage() {}, fillText() {}, save() {}, restore() {}, beginPath() {}, ellipse() {}, fill() {},
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4) }), putImageData() {},
});
function element(tag) {
  const on = {};
  const node = {
    tagName: tag.toUpperCase(), id: '', style: {}, width: 300, height: 150, removed: 0,
    getContext: () => ctx2d(),
    addEventListener(t, fn) { (on[t] ??= []).push(fn); },
    removeEventListener(t, fn) { on[t] = (on[t] ?? []).filter((f) => f !== fn); },
    fire(t, e) { for (const fn of [...(on[t] ?? [])]) fn(e); },
    listening: (t) => (on[t] ?? []).length > 0,
    remove() { node.removed++; body = body.filter((n) => n !== node); },
  };
  return node;
}
beforeEach(() => {
  clock.t = 10_000; body = [];
  globalThis.document = {
    createElement: element, getElementById: () => null, head: { append() {} },
    body: { append: (...n) => { body.push(...n); } },
    addEventListener() {}, removeEventListener() {}, pointerLockElement: null,
  };
  Object.assign(globalThis, { innerWidth: 640, innerHeight: 400, devicePixelRatio: 1 });
  Object.defineProperty(globalThis, 'performance', { value: { now: () => clock.t }, configurable: true, writable: true });
  audio.playOneShot = (clip, ...a) => { if (clip === SOUND.PageTurn) turns++; return playOneShot.call(audio, clip, ...a); };   // a leaf turned: the face's ScrollBook sound
  clearOverlays();
});
afterEach(() => {
  delete globalThis.document; delete globalThis.innerWidth; delete globalThis.innerHeight; delete globalThis.devicePixelRatio;
  Object.defineProperty(globalThis, 'performance', perf);
  audio.playOneShot = playOneShot;
  clearOverlays();
});
const turnOver = () => new Promise((r) => setImmediate(r));

/** THE FIELD'S BOOK, as the world host opens it: the seat derived from its row, its Chronicle read through the client's
 *  seat book, the window built by world.js's own `hallOfRecords.read` expression, handed the host's first draw. */
async function openHall(rows, { faceLanded = true } = {}) {
  const seat = seatOfLocation(HEARTHTON);
  const seats = createTownSeatBook({
    door: { list: async () => ({ ok: true, data: { seats: [], red: [] } }), records: async () => ({ ok: true, data: { rows, zero: null } }) },
    nowMs: () => clock.t,
  });
  await seats.read();
  const r = await seats.records(seat.key);
  const w = r.data ? hallOfRecordsWindow(seat, r.data.rows, r.data.zero, null) : null;
  const hostCanvas = { requestPointerLock: () => Promise.resolve() };
  w.draw(null, hostCanvas);   // the host's first draw: the door's acceptance mounts the canvas, the chunk lands after
  const el = body.find((n) => n.id === 'enhanced-book');
  for (let i = 0; faceLanded && i < 50 && !el?.listening('pointerdown'); i++) await turnOver();
  assert.equal(!!el?.listening('pointerdown'), faceLanded, 'the face mounted on the door\'s canvas - or not yet');
  return {
    seat, w, el,
    /** One host frame: the door's draw, then the clock a frame on. */
    frame() { if (!w.done) w.draw(null, hostCanvas); clock.t += FRAME_MS; },
  };
}

/** Every way out a player has, as each reaches the book: a key through the host's overlay route (raw codes - the door
 *  is a choice window), a tap beside the book on its own canvas, Tab through the overlay registry, and the host's own
 *  close arm. */
const WAYS = {
  Escape: ({ w }) => w.input('Escape'),
  'E (the shelf\'s own key)': ({ w }) => w.input('KeyE'),
  Enter: ({ w }) => w.input('Enter'),
  'a tap beside the book': ({ el }) => el.fire('pointerdown', { clientX: 2, clientY: 2, preventDefault() {} }),
  Tab: () => closeTopOverlay(),
  'the host\'s close': ({ w }) => w.close(),
};
/** The longest a close may take from the press: what is left of the rise, the cover shutting, the sink - and a few
 *  frames of the host's. */
const SHUT_MS = BOOK.slideInMs + BOOK.coverMs + BOOK.slideOutMs + 4 * FRAME_MS;

/** Open the hall, run its frames to `at` ms after its first frame (null: press before the first frame; 'unlanded':
 *  before the face's chunk has even landed - the door's own arm), press, and report how long the book took to leave -
 *  Infinity when it never did. */
async function pressAt(rows, at, way, { turnFirst = false } = {}) {
  const h = await openHall(rows, { faceLanded: at !== 'unlanded' });
  const t0 = clock.t;
  if (typeof at === 'number') {
    if (turnFirst) {
      while (clock.t - t0 < at - 120) h.frame();
      const before = turns;
      h.w.input('ArrowRight');
      assert.equal(turns, before + 1, 'a leaf is turning when the exit comes');
    }
    while (clock.t - t0 < at) h.frame();
  }
  const pressed = clock.t;
  WAYS[way](h);
  for (let i = 0; i < 5; i++) await turnOver();   // a chunk in flight lands (and finds its door gone)
  for (let i = 0; i < 400 && !h.w.done; i++) h.frame();
  const took = h.w.done ? clock.t - pressed : Infinity, removed = h.el.removed;
  if (!h.w.done) h.w.dispose();   // a book the pin failed on is let go, so the next one stands alone
  return { took, removed, h };
}

test('BOOK-RISE: the field\'s book - Hearthton Manor\'s empty Hall of Records, read and built as the world host builds it - leaves the screen on EVERY way out at EVERY moment of its life, the 260 ms it rides up included, inside the rise left, the shut and the sink (mutants: the close not kept; kept only once the book stands open; E not an exit, the face\'s or the door\'s before the face lands; the tap not an exit; Tab not registered; the host\'s close not the exit)', async () => {
  // the shape the Discord's screenshot shows: the seat's palace book, its one leaf saying the Hall is empty
  const probe = await openHall([]);
  assert.deepEqual([probe.seat.name, probe.seat.tier], ['Hearthton Manor', 'palace'], 'a wealthy home with a Palace record is a palace seat');
  probe.w.dispose();
  const { hallOfRecordsBook } = await import('../../../src/ui/hallOfRecords.js');
  const tokens = hallOfRecordsBook(seatOfLocation(HEARTHTON), [], null).getPageTokens(0).map((t) => t.text).filter(Boolean);
  assert.deepEqual(tokens, ['The Hall of Records of Hearthton Manor', HALL_OF_RECORDS_EMPTY]);
  assert.equal(BOOK.slideInMs, 260, 'the rise the close was dropped in');
  // before the face's chunk lands; before its first frame; a frame into the rise; mid-rise; its last frame; the cover
  // lifting; open and standing
  const moments = ['unlanded', null, FRAME_MS, 130, BOOK.slideInMs - 10, BOOK.slideInMs + 150, 2000];
  const stuck = [];
  for (const way of Object.keys(WAYS)) {
    for (const at of moments) {
      if (at === 'unlanded' && way === 'a tap beside the book') continue;   // the tap's door is the face's own canvas listener - a tap before it lands is the canvas's
      const { took, removed } = await pressAt([], at, way);
      if (!(took <= SHUT_MS) || removed !== 1 || overlayOpen()) stuck.push(`${way} at ${at ?? 'before the first frame'}: ${took === Infinity ? 'never closed' : `${took} ms`}, canvas removed ${removed}x, registry ${overlayOpen() ? 'still holds it' : 'empty'}`);
      clearOverlays();
    }
  }
  assert.deepEqual(stuck, [], 'every way out shuts the book, once, in time');
});

test('BOOK-RISE: a Hall with its Chronicle (several leaves) shuts the same way - in the rise, the cover lifting, open, and mid-turn - and an exit pressed over and over during the rise (the held key\'s repeat) is ONE close: the canvas removed once, nothing left in the registry, no book risen again after it (mutants: the close not kept; kept only once the book stands open)', async () => {
  const leaves = await openHall(CHRONICLE);
  for (let i = 0; i < 80; i++) leaves.frame();
  turns = 0;
  leaves.w.input('ArrowRight');
  assert.equal(turns, 1, 'the Chronicle runs past one spread: a leaf turns');
  for (let i = 0; i < 40; i++) leaves.frame();
  leaves.w.input('Escape');
  for (let i = 0; i < 400 && !leaves.w.done; i++) leaves.frame();
  assert.ok(leaves.w.done, 'the long book shuts from its second spread');
  for (const [at, turnFirst] of [[FRAME_MS, false], [200, false], [BOOK.slideInMs + 150, false], [2000, false], [2000, true]]) {
    for (const way of ['Escape', 'E (the shelf\'s own key)', 'a tap beside the book']) {
      const { took } = await pressAt(CHRONICLE, at, way, { turnFirst });
      assert.ok(took <= SHUT_MS, `${way} at ${at} ms${turnFirst ? ' mid-turn' : ''}: ${took === Infinity ? 'never closed' : `${took} ms`}`);
    }
  }
  // E held over the shelf: the press that opened it, and its repeat every 33 ms through the rise and after
  const h = await openHall(CHRONICLE);
  const t0 = clock.t;
  let next = t0;
  while (!h.w.done && clock.t - t0 < 3000) {
    if (clock.t >= next) { h.w.input('KeyE'); next += 33; }
    h.frame();
  }
  assert.ok(h.w.done, 'the held key\'s repeat shuts the book it lands on');
  assert.ok(clock.t - t0 <= SHUT_MS, `inside the rise, the shut and the sink (${clock.t - t0} ms)`);
  for (let i = 0; i < 30; i++) { h.w.input('KeyE'); h.frame(); }
  assert.equal(h.el.removed, 1, 'its canvas taken down once');
  assert.equal(body.length, 0, 'and nothing of it left on the page');
  assert.equal(overlayOpen(), false, 'nor in the overlay registry, so Tab has nothing dead to close');
});
