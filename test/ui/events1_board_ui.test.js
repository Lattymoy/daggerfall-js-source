// EVENTS1 (2026-10-23, the owner: "Instead of stuffing these in the chat menu, there must be a less obstructive and more
// detailed way to handle them"): THE EVENT BOARD ON THE HUD (ui/eventBoard.js) on a fake document, and THE SEAMS - the
// events' lines through the one door instead of the chat, the board drawn from drawHud, the status widget never making
// way for it. Design: bible/10-UI/Event-Board.md; AUDIT EVENTS1, bible/01-Overview/audits/Audit-Event-Board.md. The
// layout is photographed and measured by tools/eventBoardProbe.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  drawEventBoard, destroyEventBoard, eventRowsFor, newsRowOf, eventBoardPlace, buildEventBoardPreview, isEventBoardSelector, EVENT_READ_MS, EVENT_LAYOUT_MS,
  EVENT_BOARD_CSS, EVENT_GAP_PX, EVENT_CLASSIC_FOOT, EVENT_BOARD_LIVE_ID,
} from '../../src/ui/eventBoard.js';
import { seatEventBoard, eventNotice, _resetEventNotices, EVENT_BOARD_PREF } from '../../src/systems/eventNotices.js';
import { EVENT_TOAST_MS } from '../../src/systems/eventBoard.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { registerPresenter, _resetNotifyForTests } from '../../src/systems/notify.js';
import { HUD_PIECES } from '../../src/ui/hud/hudLayout.js';
import { FRAME_ROLES } from '../../src/ui/enhanced/enhancedFrame.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A page the board writes into: its nodes, their classes and text (a cleared text clears the children, as a browser's),
 *  and - where the test hands them - a plate that measures (`plate(rows, news)` its height on the screen) and a `.hud`
 *  whose scale the board reads. */
function boardDoc({ vh = 720, plate = null, hudScale = null } = {}) {
  const node = (tag) => {
    const n = { tag, children: [], attrs: {}, _cls: '', _text: '', parentNode: null, id: '', offsetWidth: 0, style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } } };
    Object.defineProperty(n, 'className', { get: () => n._cls, set: (v) => { n._cls = v; } });
    Object.defineProperty(n, 'textContent', {
      configurable: true,
      get: () => (n.children.length ? n.children.map((c) => c.textContent).join('') : n._text),
      set: (v) => { n._text = String(v); for (const c of n.children) c.parentNode = null; n.children = []; },
    });
    n.append = (...c) => { for (const x of c) { x.parentNode?.children && (x.parentNode.children = x.parentNode.children.filter((y) => y !== x)); x.parentNode = n; n.children.push(x); } };
    n.setAttribute = (k, v) => { n.attrs[k] = v; };
    n.hasAttribute = (k) => k in n.attrs;
    n.remove = () => { if (n.parentNode) n.parentNode.children = n.parentNode.children.filter((x) => x !== n); n.parentNode = null; };
    if (plate) n.getBoundingClientRect = () => (n._cls.split(' ')[0] === 'evboard' ? { top: 0, bottom: plate(all(n).filter((x) => x._cls.split(' ')[0] === 'evrow').length, all(n).filter((x) => x._cls.split(' ')[0] === 'evnews').length), left: 14, right: 314, width: 300, height: plate(all(n).filter((x) => x._cls.split(' ')[0] === 'evrow').length, all(n).filter((x) => x._cls.split(' ')[0] === 'evnews').length) } : { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
    return n;
  };
  const doc = { head: node('head'), body: node('body'), defaultView: { innerHeight: vh } };
  doc.createElement = (tag) => node(tag);
  doc.getElementById = (id) => doc.head.children.find((n) => n.id === id) ?? null;
  if (hudScale != null) {
    const hud = node('div'); hud.className = 'hud'; hud.style.getPropertyValue = (k) => (k === '--hud-scale' ? String(hudScale) : '');
    doc.querySelector = (sel) => (sel === '.hud' ? hud : null);
  }
  return doc;
}
const all = (n, out = []) => { out.push(n); for (const c of n.children) all(c, out); return out; };
const byCls = (root, cls) => all(root).filter((n) => String(n.className).split(' ').includes(cls));
const textOf = (root, cls) => byCls(root, cls).map((n) => n.textContent);
const plateOf = (doc) => doc.body.children.find((n) => n.className.startsWith('evhud'));

const NOW = 1_800_000_000_000;
/** Star rows as starTimerRows mints them (systems/starfall/starfallClient.js): the id its lines come with. */
const star = (o = {}) => ({ id: 'star:9.1', kind: 'star', title: 'Fallen Star', where: 'Near Gothway Garden', detail: 'The coven takes it when this runs out', live: true, at: NOW + 600_000, until: NOW + 600_000, px: 190, py: 210, ...o });
/** A raid as raidTimerList mints it (systems/raidingParties.js): its key the id its lines come with. */
const raid = (o = {}) => ({ name: 'Ilessan Hills', region: 'Daggerfall', type: 'orcs', startMs: NOW - 60_000, endMs: NOW + 540_000, done: false, px: 201, py: 200, key: '17:7:400', n: 7, tg: 18, ...o });
/** The host's source at `now`, the gate kept out of it (its day's clock is the law's, tested beside it). */
function seat(over = {}, off = null, log = null) {
  const src = { now: NOW, pixel: { x: 200, y: 200 }, region: 'Daggerfall', gate: null, stars: [star()], raids: [raid()], ...over };
  seatEventBoard(() => src, off, log);
  return src;
}
let hud = [];
const fresh = () => { destroyEventBoard(); _resetEventNotices(); resetPrefs(); _resetNotifyForTests(); hud = []; registerPresenter({ hudText: (t) => { hud.push(t); return true; } }); };

test('EVENTS1 THE PLATE: made once there is something on it, on the page only while it has; its rows the board\'s, each its title, clock, way then place; a raid\'s count under it; live first; hidden whole, never torn down; its rows as many as a screen stands (four tall, three on a desk) (mutants: the way\'s order, the count\'s kind, the rows for the screen, the hide, the page)', () => {
  fresh();
  const doc = boardDoc();
  drawEventBoard({ doc, nowMs: NOW - EVENT_READ_MS });
  assert.equal(plateOf(doc), undefined, 'nothing seated, nothing made');
  const src = seat();
  drawEventBoard({ doc, nowMs: NOW, height: 1080 });
  const root = plateOf(doc);
  assert.equal(root.className, 'evhud');
  assert.equal(root.attrs['aria-hidden'], 'true', 'the plate never speaks (B7)');
  const board = root.children[0];
  assert.deepEqual(textOf(board, 'evrow-title'), ['Raid on Ilessan Hills', 'Fallen Star'], 'the raid ends sooner');
  assert.deepEqual(textOf(board, 'evrow-clock'), ['9:00 left', '10:00 left']);
  assert.deepEqual(textOf(board, 'evrow-where'), ['0.8 km E · Daggerfall', '12 km SW · Near Gothway Garden'], 'the way first');
  assert.deepEqual(textOf(board, 'evrow-detail'), ['Raiders down: 7 of 18', ''], 'a raid\'s count; the rest on its news');
  assert.equal(byCls(board, 'evrow')[0].className, 'evrow ev-raid live');
  src.now = NOW + 1000;
  drawEventBoard({ doc, nowMs: NOW + 1000, height: 1080 });
  assert.deepEqual(textOf(board, 'evrow-clock'), ['8:59 left', '9:59 left'], 'the relay\'s clock, read again');
  assert.deepEqual([eventRowsFor(1080), eventRowsFor(900), eventRowsFor(899), eventRowsFor(390)], [4, 4, 3, 3]);
  drawEventBoard({ doc, nowMs: NOW + 1000, height: 720, hidden: true });
  assert.equal(root.className, 'evhud hidden');
  assert.equal(plateOf(doc), root, 'hidden, never torn down');
  // nothing left on it: off the page (the HUD editor's preview stands in for it - AUDIT EVENTS1 B6), its memory kept
  src.stars = []; src.raids = []; src.now = NOW + 2000;
  drawEventBoard({ doc, nowMs: NOW + 2000, height: 720 });
  assert.equal(plateOf(doc), undefined, 'nothing to show: off the page');
  src.stars = [star()]; src.now = NOW + 3000;
  drawEventBoard({ doc, nowMs: NOW + 3000, height: 720 });
  assert.equal(plateOf(doc), root, 'back, the same plate');
  fresh();
});

test('EVENTS1 THE PLATE\'S PLACE, MEASURED (AUDIT EVENTS1 B1-B3, B5): under whatever stands above its edge - however wide or open the chat - and no higher than its home; its room down to whatever stands below that crosses its span; on the classic skin over the canvas vitals\' foot (mutants: the chat\'s bottom, the home, the floor, the span, the classic foot)', () => {
  const span = { left: 14, right: 314 };
  const box = (top, bottom, left = 14, right = 454) => ({ top, bottom, left, right });
  assert.deepEqual(eventBoardPlace({ vh: 720, ...span }), { top: 288, room: 720 - EVENT_GAP_PX - 288 }, 'home: 40vh');
  assert.equal(eventBoardPlace({ vh: 400, ...span }).top, 244, 'home at least 244');
  assert.equal(eventBoardPlace({ vh: 1400, ...span }).top, 460, 'home at most 460');
  const peek = eventBoardPlace({ vh: 720, ...span, above: [box(44, 233)] });
  assert.equal(peek.top, 288, 'a full peek stands above the home');
  const wide = eventBoardPlace({ vh: 720, ...span, above: [box(44, 372)] });
  assert.equal(wide.top, 372 + EVENT_GAP_PX, 'a chat widened past it: the plate stands under it');
  const desk = eventBoardPlace({ vh: 720, ...span, above: [box(44, 233)], below: [box(560, 600, 24, 128), box(500, 668, 368, 913)] });
  assert.equal(desk.room, 560 - EVENT_GAP_PX - 288, 'down to the status widget; a bar off its span does not count, however high');
  assert.equal(eventBoardPlace({ vh: 560, ...span, below: [box(458, 508, 239, 784)] }).room, 458 - EVENT_GAP_PX - 244, 'a hotbar that crosses its span does');
  assert.equal(eventBoardPlace({ vh: 390, ...span, above: [box(72, 261)], below: [box(272, 314, 14, 106)] }).room, 0, 'a phone on its side: no room');
  assert.equal(eventBoardPlace({ vh: 390, ...span, above: [box(44, 293)], below: [box(300, 350, 149, 694), box(66, 314, 14, 106)] }).room, 0, 'a bar a pixel above its top, reaching past it: no room');
  assert.equal(eventBoardPlace({ vh: 720, ...span, classic: true }).room, 720 * (1 - EVENT_CLASSIC_FOOT) - 288, 'the classic skin: over its canvas vitals');
});

test('EVENTS1 THE PLATE FITS ITS ROOM: a row fewer until it does; a news takes a row\'s place; where not even its news fits, the news is said on the HUD\'s line and the plate stands down (AUDIT EVENTS1 B1/B3/B5), the journal holding its line once (mutants: the fit, the HUD\'s line, the stand-down, filed twice)', () => {
  fresh();
  // a plate 40 px a row, 30 its frame, 100 a news; a screen whose room is 288 -> 561 (classic foot) less the gap
  const doc = boardDoc({ vh: 720, plate: (rows, news) => 30 + 40 * rows + 100 * news });
  const many = [1, 2, 3, 4].map((k) => star({ id: `star:9.${k}`, at: NOW + k * 60_000, until: NOW + k * 60_000 }));
  seat({ stars: many, raids: [] });
  drawEventBoard({ doc, nowMs: NOW, height: 1080 });
  assert.equal(byCls(plateOf(doc), 'evrow').length, 4, 'room for four: 190 px');
  destroyEventBoard();
  const tight = boardDoc({ vh: 520, plate: (rows, news) => 30 + 40 * rows + 100 * news });   // home 244, foot 405.6: room 161
  seat({ stars: many, raids: [] });
  drawEventBoard({ doc: tight, nowMs: NOW, height: 1080 });
  assert.equal(byCls(plateOf(tight), 'evrow').length, 3, '161 px: three rows');
  eventNotice('star', 'A star is falling toward Copperham.', 'star:9.1');
  drawEventBoard({ doc: tight, nowMs: NOW + 10, height: 1080 });
  assert.deepEqual([byCls(plateOf(tight), 'evnews').length, byCls(plateOf(tight), 'evrow').length], [1, 0], 'the news and no row: 130 px');
  destroyEventBoard();
  // room for its frame and title and not a row: nothing on it - a title over "more in Timers" is no board - so off the page
  const bare = boardDoc({ vh: 377, plate: (rows, news) => 30 + 40 * rows + 100 * news });   // home 244, foot 294.06: room 50
  seat({ stars: [star()], raids: [] });
  drawEventBoard({ doc: bare, nowMs: NOW, height: 377 });
  assert.equal(plateOf(bare), undefined, 'nothing left on it: off the page');
  destroyEventBoard();
  // no room at all: the news on the HUD's line, the plate off the page
  const none = boardDoc({ vh: 390, plate: (rows, news) => 30 + 40 * rows + 100 * news });
  const town = { hudMessageSink: null }, filed = [];
  _resetNotifyForTests();
  registerPresenter({ hudText: (t) => { hud.push(t); town.hudMessageSink?.(t); return true; } });   // townTalk's: the HUD's line files each line
  seat({ stars: [star()], raids: [] }, null, town);
  town.hudMessageSink = (t) => filed.push(t);
  drawEventBoard({ doc: none, nowMs: NOW, height: 390 });
  hud.length = 0;
  eventNotice('star', 'The star near Gothway Garden is held by Ann.', 'star:9.1');
  drawEventBoard({ doc: none, nowMs: NOW + 10, height: 390 });
  assert.deepEqual(hud, ['Starfall: Fallen Star, 12 km SW · Near Gothway Garden, 10:00 left', 'The star near Gothway Garden is held by Ann.'], 'said on the HUD\'s line, its row and its line');
  assert.deepEqual(filed, ['The star near Gothway Garden is held by Ann.'], 'the journal holds its line once, and never the board\'s own');
  assert.equal(plateOf(none), undefined, 'the plate stands down');
  fresh();
});

test('EVENTS1 THE NEWS (AUDIT EVENTS1 A1): an event\'s line stands at the plate\'s head with ITS event\'s row - by the id it came with - and that row leaves the list; a line whose event has gone stands alone, never under another\'s; a single kind\'s id-less line its kind\'s one row; once a news, the board\'s voice says it - never its clock; one at a time, its time only while shown; what came on after the board first read the world is announced, what stood before is not (mutants: the id, the alone, the voice, the shown-time clock, the since)', () => {
  fresh();
  const doc = boardDoc();
  const src = seat({ stars: [star(), star({ id: 'star:9.2', where: 'Near Copperham', px: 210, py: 200, at: NOW + 800_000, until: NOW + 800_000 })] });
  drawEventBoard({ doc, nowMs: NOW, height: 1080 });
  const board = plateOf(doc).children[0];
  assert.deepEqual(byCls(board, 'evnews'), [], 'the first read: what stands is no news');
  eventNotice('star', 'The star near Copperham is going dark!', 'star:9.2');
  drawEventBoard({ doc, nowMs: NOW + 10, dt: 0.01, height: 1080 });
  const news = byCls(board, 'evnews');
  assert.deepEqual([textOf(news[0], 'evnews-kind')[0], textOf(news[0], 'evnews-title')[0], textOf(news[0], 'evnews-where')[0], textOf(news[0], 'evnews-note')[0]],
    ['Starfall', 'Fallen Star', '8.2 km E · Near Copperham', 'The star near Copperham is going dark!'], 'the star it names, by its id');
  assert.deepEqual(textOf(board, 'evrow-where').filter((w) => w.includes('Copperham')), [], 'its row is the news, opened - never twice');
  const voice = doc.body.children.find((n) => n.id === EVENT_BOARD_LIVE_ID);
  assert.deepEqual([voice.attrs['aria-live'], voice.attrs['aria-atomic']], ['polite', 'true']);
  assert.equal(voice.textContent, 'Starfall. Fallen Star. 8.2 km E · Near Copperham. The star near Copperham is going dark!');
  let writes = 0;
  Object.defineProperty(voice, 'textContent', { get: () => voice._text, set: (v) => { writes++; voice._text = v; } });
  for (let i = 1; i <= 3; i++) { src.now = NOW + 10 + i * 1000; drawEventBoard({ doc, nowMs: NOW + 10 + i * 1000, dt: 0.01, height: 1080 }); }
  assert.equal(writes, 0, 'its clock runs; the voice says nothing more');
  // the star held: its row gone the next read - its line stands alone, never under the other star (A1)
  src.stars = [star()]; src.now = NOW + 5000;
  eventNotice('star', 'The star near Copperham is held by Ann.', 'star:9.2');
  drawEventBoard({ doc, nowMs: NOW + 5000, dt: 0.01, height: 1080 });
  const held = byCls(board, 'evnews')[0];
  assert.deepEqual([textOf(held, 'evnews-title')[0], textOf(held, 'evnews-where')[0], textOf(held, 'evnews-note')], ['', '', ['The star near Copperham is going dark!', 'The star near Copperham is held by Ann.']], 'alone - no other star\'s title, clock or place');
  assert.deepEqual(textOf(board, 'evrow-title'), ['Raid on Ilessan Hills', 'Fallen Star'], 'and the other star\'s row stays on the list');
  // its time: only while shown
  drawEventBoard({ doc, nowMs: NOW + 5010, dt: (EVENT_TOAST_MS * 2) / 1000, height: 1080, hidden: true });
  drawEventBoard({ doc, nowMs: NOW + 5020, dt: 0.01, height: 1080 });
  assert.equal(byCls(board, 'evnews').length, 1, 'behind a window, its time kept');
  drawEventBoard({ doc, nowMs: NOW + 5030, dt: EVENT_TOAST_MS / 1000, height: 1080 });
  assert.equal(byCls(board, 'evnews').length, 0, 'shown its time, gone');
  // a raid comes onto the board after the first read - its start fifteen minutes off: announced, its row's news
  src.raids = [raid(), raid({ name: 'Anticlere', key: '17:8:400', startMs: NOW + 906_000, endMs: NOW + 1_506_000, px: 199, py: 201 })];
  src.now = NOW + 6000;
  drawEventBoard({ doc, nowMs: NOW + 6000 + EVENT_READ_MS, dt: 0.01, height: 1080 });
  const ann = byCls(board, 'evnews');
  assert.deepEqual([textOf(ann[0], 'evnews-kind')[0], textOf(ann[0], 'evnews-title')[0], textOf(ann[0], 'evnews-clock')[0]], ['Town Raid · Starting soon', 'Raid on Anticlere', 'in 15:00']);
  // a single kind's id-less line: its kind's one row; a star's id-less line: none
  assert.equal(newsRowOf({ id: null, kind: 'gate', notes: ['The sky burns.'] }, [{ id: 'gate:1', kind: 'gate' }]).id, 'gate:1');
  assert.equal(newsRowOf({ id: null, kind: 'star', notes: ['A star.'] }, [{ id: 'star:9.1', kind: 'star' }]), null);
  assert.equal(newsRowOf({ id: 'raid:x', kind: 'raid', notes: [] }, [{ id: 'raid:y', kind: 'raid' }]), null, 'its event gone: none');
  fresh();
});

test('EVENTS1 WHAT STANDS BEFORE THE BOARD FIRST READ THE WORLD IS NO NEWS, HOWEVER LATE IT FILLS IN (AUDIT EVENTS1 A5): the raids\' list in a few reads after the first, a raid begun an hour before it - no news; one that came on after it - news; the "more" count every event the plate shows nowhere (A9) (mutants: the watch\'s start, the since, the count)', () => {
  fresh();
  const doc = boardDoc();
  const src = seat({ stars: [], raids: null });
  drawEventBoard({ doc, nowMs: NOW, height: 1080 });
  src.raids = [raid({ name: 'Near1', key: 'a', px: 200, startMs: NOW - 3_600_000 }), raid({ name: 'Near2', key: 'b', px: 201, startMs: NOW - 3_600_000 })];
  src.now = NOW + 1000;
  drawEventBoard({ doc, nowMs: NOW + 1000, height: 1080 });
  const board = plateOf(doc).children[0];
  assert.deepEqual(byCls(board, 'evnews'), [], 'begun before the first read, however late the list came: no news');
  // a region raid past the nearest two, on the board since ten seconds after the first read and in the source ten
  // seconds late: announced - the watch is the first read's, never the last's; the plate shows it as news, so nothing
  // more stands (A9)
  src.raids = [...src.raids, raid({ name: 'Far3', key: 'c', px: 260, startMs: NOW + 10_000 + 900_000, endMs: NOW + 10_000 + 1_500_000 })];
  src.now = NOW + 20_000;
  drawEventBoard({ doc, nowMs: NOW + 20_000, height: 1080 });
  assert.deepEqual([textOf(board, 'evnews-title'), textOf(board, 'evrow-title'), textOf(board, 'evboard-more')], [['Raid on Far3'], ['Raid on Near1', 'Raid on Near2'], ['']], 'every event on the plate: no "more"');
  fresh();
});

test('EVENTS1 THE SWITCH: off, the plate and its voice come down, a line taken in that frame goes where it went before (C4), and the board forgets everything whether or not it had built its plate (B9); on again, it reads afresh (mutants: the switch\'s door, the flush, the forgetting)', () => {
  fresh();
  const chat = [];
  const doc = boardDoc();
  seat({ raids: [raid()] }, (t) => chat.push(t));
  drawEventBoard({ doc, nowMs: NOW, height: 1080 });
  assert.ok(plateOf(doc));
  eventNotice('star', 'A star has fallen near Gothway Garden.', 'star:9.1');   // said while on, taken in the off frame
  setPref(EVENT_BOARD_PREF, false);
  drawEventBoard({ doc, nowMs: NOW + 10, height: 1080 });
  assert.equal(plateOf(doc), undefined, 'taken down');
  assert.equal(doc.body.children.find((n) => n.id === EVENT_BOARD_LIVE_ID), undefined, 'and its voice');
  assert.deepEqual(chat, ['A star has fallen near Gothway Garden.'], 'the line in flight to the chat');
  eventNotice('raid', 'Ilessan Hills in Daggerfall has been cleansed of the orc attack!');
  assert.deepEqual(hud, ['Ilessan Hills in Daggerfall has been cleansed of the orc attack!'], 'a raid\'s to the HUD\'s line');
  setPref(EVENT_BOARD_PREF, true);
  drawEventBoard({ doc, nowMs: NOW + 20, height: 1080 });
  assert.deepEqual(byCls(plateOf(doc), 'evnews'), [], 'read afresh: the first read is no news');
  // a board that read the world but never built its plate forgets it too (B9): a raid begun while it was off is no news
  fresh();
  const d2 = boardDoc();
  const s2 = seat({ stars: [], raids: [] });
  drawEventBoard({ doc: d2, nowMs: NOW, height: 1080 });
  assert.equal(plateOf(d2), undefined, 'read, nothing built');
  setPref(EVENT_BOARD_PREF, false);
  drawEventBoard({ doc: d2, nowMs: NOW + 1000, height: 1080 });
  s2.raids = [raid({ startMs: NOW + 60_000, endMs: NOW + 600_000 })]; s2.now = NOW + 120_000;
  setPref(EVENT_BOARD_PREF, true);
  drawEventBoard({ doc: d2, nowMs: NOW + 120_000, height: 1080 });
  assert.deepEqual([byCls(plateOf(d2), 'evnews').length, textOf(plateOf(d2), 'evrow-title')], [0, ['Raid on Ilessan Hills']], 'its row, and no news');
  fresh();
});

test('EVENTS1 THE HUD\'S SCALE (AUDIT EVENTS1 B2): read off `.hud` and worn by the plate, as the loot banners wear it (mutants: the copy)', () => {
  fresh();
  const doc = boardDoc({ hudScale: 1.5 });
  seat();
  drawEventBoard({ doc, nowMs: NOW, height: 1080 });
  assert.equal(plateOf(doc).style['--hud-scale'], '1.5');
  fresh();
});

test('EVENTS1 DRESSED AND MOVABLE: the kit\'s panel on the plate; its classic copy cut to the plate alone; the ink and its shadow on the plate, the surface a dress inks (B11); a movable piece with its preview; no fixed short-screen rule - the room decides (mutants: the role, the piece, the selector, the shadow\'s surface)', () => {
  assert.ok(FRAME_ROLES.panel.includes('body .evboard'));
  assert.equal(isEventBoardSelector('body .evboard'), true);
  assert.equal(isEventBoardSelector('body .evboard-title'), false);
  assert.equal(isEventBoardSelector('body .star-hud'), false);
  const piece = HUD_PIECES.find((p) => p.id === 'events');
  assert.deepEqual([piece.sel, piece.ghost, piece.dummy, piece.name], ['.evhud', 'events', true, 'Event board']);
  const g = buildEventBoardPreview(boardDoc());
  assert.equal(g.className, 'evhud');
  assert.match(textOf(g, 'evrow-title')[0], /\(preview\)$/);
  assert.match(EVENT_BOARD_CSS, /\n\.evboard \{[^}]*color: #e9e4d9; text-shadow:/, 'the shadow on the plate');
  assert.doesNotMatch(EVENT_BOARD_CSS, /\n\.evhud \{[^}]*text-shadow/, 'not on its wrapper');
  assert.doesNotMatch(EVENT_BOARD_CSS, /max-height: 500px/, 'no fixed short-screen rule');
  assert.equal(EVENT_LAYOUT_MS, 250);
});

test('EVENTS1 THE SEAMS: the gate\'s (its rite too - C6), the serpent\'s, the Abyss Dungeon\'s, the stars\' and the raids\' (each with its id - A1) and the festival\'s lines through the one door; the Timers source seated where it is made, with the chat for the board off and townTalk for the journal (C4/C5), the player\'s pixel, the three sites, the raids\' own region (A8) and their look ahead (A4); the board on drawHud and its hide door; the status widget never makes way for it (B1) (mutants: each door, the seat, the draw)', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /const timersSource = seatEventBoard\(\(\{ ask = false \} = \{\}\) => \{/);
  assert.match(world, /\}, \(text\) => chatNotice\(text\), townTalk\);/, 'the chat for a line said with the board off; the journal');
  assert.match(world, /pixel: playerTravelPixel\(\),\n\s+gate: \{ place: gateOmen\?\.current\?\.\(\)\?\.site\?\.place \?\? null, site: gateOmen\?\.current\?\.\(\)\?\.site \?\? null,/);
  assert.match(world, /serpent: \{ place: serpentOmen\?\.current\?\.\(\)\?\.site\?\.near \?\? null, site: serpentOmen\?\.current\?\.\(\)\?\.site \?\? null,/);
  assert.match(world, /sd: sdHost \? \{ rec: sdHost\.record\(\), name: sdHost\.hollow\(\)\?\.loc\?\.name \?\? null, site: sdHost\.hollow\(\)\?\.site \?\? null \} : null,/);
  assert.match(world, /region: REGION_NAMES\[raidRegionNow\(\)\] \?\? null,/);
  assert.match(world, /raids: raidingPartiesOn\(\) \? raidTimerList\(relayOf, \(r\) => REGION_NAMES\[r\], EVENT_SOON_MS\) : null,/);
  assert.match(world, /say: \(text\) => eventNotice\('gate', text\),   \/\/ EVENTS1/);
  assert.match(world, /say: \(text\) => eventNotice\('gate', text\),   \/\/ AUDIT EVENTS1 C6/, 'the rite broken');
  assert.match(world, /say: \(text\) => eventNotice\('serpent', text\),/);
  assert.match(world, /say: \(text\) => eventNotice\('super', text\),/);
  assert.match(world, /eventNotice\('serpent', slainLine\(\{/);
  assert.doesNotMatch(world, /chatNotice\((fellLine|slainLine)\(/, 'no gate\'s or serpent\'s fall in the chat');
  const starHost = read('src/scenes/starfall/starfallHost.js');
  assert.match(starHost, /const say = \(text, id = null\) => \(host\.eventNotice \?\? eventNotice\)\('star', text, id\);/);
  assert.match(starHost, /else say\(text, `star:\$\{S\.site\.n\}\.\$\{S\.site\.k\}`\);/);
  assert.match(starHost, /say\(line, `star:\$\{w\.n\}\.\$\{w\.s\}`\);/);
  assert.match(read('src/systems/raidingParties.js'), /const say = \(line, raid = null\) => \{ const id = raid \? `raid:\$\{raidKey\(raid\)\}` : null; \(host\(\)\.say \?\? \(\(l, i\) => eventNotice\('raid', l, i\)\)\)\(line, id\); \};/);
  assert.match(read('src/scenes/witchesHost.js'), /const herald = \(\/\*\* @type \{string\} \*\/ l\) => \(deps\.eventNotice \?\? eventNotice\)\('festival', l\);/);
  const hudSrc = read('src/ui/hud/hud.js');
  assert.match(hudSrc, /drawEventBoard\(\{ hidden: true \}\);[^\n]*\n  drawQuestHerald\(\{ hidden: true \}\);/, 'the hide door');
  assert.match(hudSrc, /\n  drawEventBoard\(\{ hidden: cursorActive \|\| !hudRenderEnabled\(\), dt \}\);\n  drawQuestHerald\(/, 'the frame, beside the herald and outside the skin\'s gate - on every skin');
  assert.doesNotMatch(read('src/ui/enhanced/enhancedHud.js'), /const STAT_ABOVE = '[^']*evboard/, 'the status widget never makes way for it');
});
