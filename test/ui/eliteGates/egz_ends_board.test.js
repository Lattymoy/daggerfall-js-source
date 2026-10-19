// EG-ZM (2026-10-12, bible/11-Multiplayer/Elite-Gates.md section 20, THE BOARD WINDOW - "reached from the Timers row and from
// the start window"; EG14): THE BOARD'S DOORS. The boards open through ONE door (ui/eliteGates/egBoardWindow.js createEgBoardDoor, the
// world host's egBoardDoor) from `/breach board`, from the Timers window's Elite rows (systems/eventTimers.js `door`,
// ui/enhanced/enhancedTimers.js's button, the pause face's handoff in ui/enhanced/enhancedMenu.js) - the boards' own season standing as an
// Elite row so the door is there with no breach - and from the start window (ui/eliteGates/egStartWindow.js, its last row, back to the
// window once the boards close). Both skins: the classic skin's DFU pickers on the mode's slot, which a pause face on its
// way out gives up; the enhanced skin's panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventTimerRows } from '../../../src/systems/eventTimers.js';
import { timersWindow, TIMER_DOOR_TEXT } from '../../../src/ui/enhanced/enhancedTimers.js';
import { egStartRows, openEgStartWindow } from '../../../src/ui/eliteGates/egStartWindow.js';
import { openEgBoard, createEgBoardDoor, EG_BOARD_TEXT, EG_BOARD_TABS, EG_BOARD_TAB_TEXT } from '../../../src/ui/eliteGates/egBoardWindow.js';
import { arenaSeasonOf, arenaSeasonEndsS, ARENA_SEASON_EPOCH_S, ARENA_SEASON_S } from '../../../src/net/arena/arenaLaw.js';
import { EG_TEXT, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ME = 'acct-mac';

// ── a document just real enough (test/ui/enhanced/timers1.test.js's) ──
function fakeDoc() {
  const node = (tag) => {
    const n = { tag, children: [], className: '', textContent: '', attrs: {}, style: {}, listeners: {}, title: '', type: '',
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(t, f) { (n.listeners[t] ??= []).push(f); } };
    Object.defineProperty(n, 'textContent', { get() { return n._t ?? ''; }, set(v) { n._t = v; if (v === '') n.children = []; } });
    return n;
  };
  return { createElement: node };
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };

test('EG-ZM THE TIMERS ROW\'S DOOR (section 20): where the host hands the boards\' door, every Elite row carries it - my breach\'s, and the boards\' own season, an Elite row of its own counting to the arena season\'s end, so the door stands with no breach of mine; no other row carries one, and with no door handed nothing changes; the window draws the door as a button beside the row\'s clock, and a press hands the source\'s door - read at the press - to the window\'s caller; the pause face hands its place on first (mutants: the season row unstood; its end the next season\'s; the door on every row; the door kept from the draw; the button never drawn; the press resuming under the boards)', () => {
  const board = () => 'boards';
  const nowS = ARENA_SEASON_EPOCH_S + ARENA_SEASON_S + 3600;   // an hour into season 2
  const now = nowS * 1000, op = now - 60_000;
  const rows = eventTimerRows({ now, elite: { op }, doors: { board } });
  const elite = rows.filter((r) => r.kind === 'elite');
  assert.equal(arenaSeasonOf(nowS), 2);
  assert.deepEqual(elite.map((r) => [r.id, r.title, r.live, r.at, r.door]), [
    [`elite:${op}`, 'Elite Breach opens', false, op + EG_SEALED_MS, 'board'],
    ['elite:season:2', 'The Spire\'s season 2 ends', false, arenaSeasonEndsS(2) * 1000, 'board'],
  ], 'my breach\'s row and the season\'s, each with the door');
  assert.deepEqual(elite[1], { id: 'elite:season:2', kind: 'elite', title: 'The Spire\'s season 2 ends', where: null, detail: 'Each Descent bracket\'s top ten hold the title Spire Champion through the next season', live: false, at: arenaSeasonEndsS(2) * 1000, until: null, door: 'board' });
  assert.ok(rows.filter((r) => r.kind !== 'elite').length > 3 && rows.filter((r) => r.kind !== 'elite').every((r) => !('door' in r)), 'no other row carries a door');
  // the season's last second and the next's first
  const end = arenaSeasonEndsS(2) * 1000;
  assert.equal(eventTimerRows({ now: end - 1, doors: { board } }).find((r) => r.id.startsWith('elite:season')).at, end);
  assert.equal(eventTimerRows({ now: end, doors: { board } }).find((r) => r.id.startsWith('elite:season')).id, 'elite:season:3');
  // no door handed: no season row, no door
  const none = eventTimerRows({ now, elite: { op } });
  assert.deepEqual(none.filter((r) => r.kind === 'elite').map((r) => r.id), [`elite:${op}`]);
  assert.ok(none.every((r) => !('door' in r)));
  assert.deepEqual(eventTimerRows({ now, elite: { op }, doors: { board: 'boards' } }).filter((r) => r.kind === 'elite').length, 1, 'a door that is no function is none');
  // THE WINDOW: the button, the press
  assert.deepEqual(TIMER_DOOR_TEXT, { board: 'Boards' });
  let src = { now, elite: { op }, doors: { board } };
  const pressed = [];
  const view = timersWindow(fakeDoc(), { read: () => src, onClose() {}, every: 1e9, door: (fn) => pressed.push(fn) });
  view.stop();
  const doors = all(view.root, 'tm-door');
  assert.equal(doors.length, 2, 'a button on each Elite row');
  assert.ok(doors.every((b) => b.textContent === 'Boards' && b.className === 'act tm-door' && b.type === 'button'));
  assert.ok(all(view.root, 'tm-elite').every((row) => row.children.includes(doors[0]) || row.children.includes(doors[1])), 'each in its row');
  const later = () => 'later';
  src = { ...src, doors: { board: later } };
  doors[1].listeners.click[0]();
  assert.deepEqual(pressed, [later], 'the source\'s door as it stands at the press');
  src = { ...src, doors: null };
  doors[0].listeners.click[0]();
  assert.equal(pressed.length, 1, 'no door at the press: nothing');
  view.draw();
  assert.equal(all(view.root, 'tm-door').length, 0, 'the door gone from the source: the list drawn again without it');
  // no door option: the door itself
  let opened = 0;
  const v2 = timersWindow(fakeDoc(), { read: () => ({ now, elite: { op }, doors: { board: () => { opened++; return {}; } } }), onClose() {}, every: 1e9 });
  v2.stop();
  all(v2.root, 'tm-door')[0].listeners.click[0]();
  assert.equal(opened, 1);
  // a draw with no door rebuilds without the button
  const v3 = timersWindow(fakeDoc(), { read: () => ({ now, elite: { op } }), onClose() {}, every: 1e9 });
  v3.stop();
  assert.equal(all(v3.root, 'tm-door').length, 0);
  // THE PAUSE FACE: a handoff, as the sheet's doors - and a door that opened nothing resumes
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  // PIN MOVED (AUDIT GROWTH LANE2-3): a Growth face under the window is asked first, then the hand-off as before
  assert.match(menu, /\nconst timersDoor = \(fn\) => \{\n\s*if \(pauseTab === 'growth' && growthAsks\(\)\) \{ [^\n]*return; \}\n\s*onAction\('handoff'\); if \(!fn\(\)\) onAction\('resume'\);\n\};\n/);
  assert.match(menu, /timersWindow\(document, \{ read: \(\) => hooks\.timers\?\.\(\{ ask: true \}\) \?\? null, onClose: [^\n]*, door: timersDoor \}\);/);
});

test('EG-ZM THE START WINDOW\'S DOOR (section 20): where the host hands the boards\' door, the start window\'s last row is the boards - with keys or with the Rehearsal alone; picked, the list leaves the slot before the boards are opened, and comes back once they close (once, however often their close is told), or at once where none opened; a window ended meanwhile is not opened again (mutants: the row unoffered; the list left in the slot; the window never back; back twice; back after its end)', () => {
  const members = [{ sub: ME, name: 'Mac' }];
  const starts = { [ME]: [0] };
  assert.deepEqual(egStartRows({ keys: 1, me: ME, members, starts, rehearsal: true, board: true }).map((r) => [r.kind, r.label]), [
    ['info', EG_TEXT.stake(1)], ['start', 'Hall 1'], ['wager', EG_TEXT.wager('')], ['rehearse', EG_TEXT.rehearsal], ['board', EG_BOARD_TEXT.title],
  ]);
  assert.equal(EG_BOARD_TEXT.title, 'The Boards of the Spire');
  assert.deepEqual(egStartRows({ keys: 0, me: ME, members, starts, rehearsal: true, board: true }).map((r) => r.kind), ['info', 'rehearse', 'board'], 'no key: the Rehearsal and the boards');
  assert.ok(!egStartRows({ keys: 1, me: ME, members, starts, rehearsal: true }).some((r) => r.kind === 'board'), 'no door handed: no row');
  const run = (board) => {
    const log = [], lists = [];
    const w = openEgStartWindow({ keys: 1, me: ME, members, starts, rehearsal: true,
      openList: (labels, onPick, onCancel) => { const h = { labels, onPick, onCancel, open: true }; lists.push(h); log.push('open'); return h; },
      closeList: (h) => { h.open = false; log.push('close'); },
      ask: () => {}, onChoose: (c) => log.push(['choose', c]), onCancel: () => log.push('cancel'),
      ...(board ? { board: (onClosed) => { log.push('boards'); return board(onClosed); } } : {}) });
    const pick = (label) => lists.at(-1).onPick(lists.at(-1).labels.indexOf(label));
    return { w, log, lists, pick };
  };
  let told = null;
  let R = run((onClosed) => { told = onClosed; return { close() {} }; });
  assert.equal(R.lists[0].labels.at(-1), 'The Boards of the Spire', 'the last row');
  R.pick('The Boards of the Spire');
  assert.deepEqual(R.log, ['open', 'close', 'boards'], 'the list out of the slot before the boards');
  assert.equal(R.lists.length, 1, 'nothing over the boards');
  told(); told();
  assert.deepEqual(R.log, ['open', 'close', 'boards', 'open'], 'back once the boards close - once');
  R.pick('Hall 1');
  assert.deepEqual(R.log.at(-1), ['choose', { ew: 0, wg: [], rh: false }], 'and the window chooses as ever');
  // none opened: back at once
  R = run(() => null);
  R.pick('The Boards of the Spire');
  assert.deepEqual(R.log, ['open', 'close', 'boards', 'open']);
  // the boards' close told before they answer (a slot that refused them), then their null: back once
  R = run((onClosed) => { onClosed(); return null; });
  R.pick('The Boards of the Spire');
  assert.deepEqual(R.log, ['open', 'close', 'boards', 'open']);
  // the window ended while the boards stood: never back
  R = run((onClosed) => { told = onClosed; return { close() {} }; });
  R.pick('The Boards of the Spire');
  R.w.close();
  told();
  assert.deepEqual(R.log, ['open', 'close', 'boards']);
});

test('EG-ZM THE BOARDS\' ONE DOOR (ui/eliteGates/egBoardWindow.js createEgBoardDoor; scenes/world.js egBoardDoor): every way in opens the boards through it - `/breach board`, the Timers rows\' door, the start window\'s; one at a time, the boards standing closed and out of the slot before the next go in; the classic skin\'s pickers given a slot a pause face is leaving (a window done, not yet drained), never one a live window holds; the enhanced panel needs no slot; `onClosed` told once (mutants: two boards standing; a done window holding the slot; a live window thrown out; the close untold)', async () => {
  // CLASSIC, over a one-window slot
  let slot = null;
  const thrown = [];
  class Picker { constructor(o) { Object.assign(this, o); } }
  const door = createEgBoardDoor({
    open: (o) => openEgBoard({ classic: true, fetchBoard: async () => ({ ok: true, data: null }), ListPicker: Picker, ...o }),
    slot: { top: () => slot, mount: (w) => { if (slot) return false; slot = w; return true; }, close: (w) => { if (slot === w) { slot = null; thrown.push(w); } } },
  });
  let closed = 0;
  const a = door(() => { closed++; });
  assert.ok(a && slot instanceof Picker, 'the tabs in the slot');
  assert.deepEqual(slot.items, EG_BOARD_TABS.map((k) => EG_BOARD_TAB_TEXT[k]));
  const first = slot;
  const b = door();
  assert.ok(b && b !== a, 'opened again');
  assert.equal(closed, 1, 'the first closed - told once');
  assert.ok(thrown.includes(first) && slot !== first && slot instanceof Picker, 'out of the slot before the next went in');
  b.close();
  assert.equal(slot, null);
  // a pause face on its way out (done) gives the slot up; a live window keeps it
  const leaving = { done: true };
  slot = leaving;
  const c = door();
  assert.ok(c && slot instanceof Picker && thrown.includes(leaving), 'the done window out, the boards in');
  c.close();
  const live = { done: false };
  slot = live;
  assert.equal(door(), null, 'a live window keeps its slot: no boards');
  assert.equal(slot, live, 'and is never thrown out');
  // ENHANCED: the panel, no slot asked
  slot = null;
  const body = { children: [], append(...cs) { this.children.push(...cs); } };
  const doc = { ...fakeDoc(), body, head: body, getElementById: () => null };
  const node = doc.createElement;
  doc.createElement = (tag) => { const n = node(tag); n.remove = () => { n.removed = true; }; n.focus = () => {}; n.replaceChildren = (...cs) => { n.children = cs; }; return n; };
  let eClosed = 0;
  const panelDoor = createEgBoardDoor({ open: (o) => openEgBoard({ doc, fetchBoard: async () => ({ ok: true, data: null }), ...o }), slot: { top: () => slot, mount: () => false, close: () => {} } });
  const e1 = panelDoor(() => { eClosed++; });
  assert.ok(e1 && body.children.length >= 1 && slot === null, 'the panel, in no slot');
  panelDoor();
  assert.equal(eClosed, 1, 'the panel standing closed first');
  // THE HOST: the one door, and its three ways in
  const w = rd('src/scenes/world.js');
  assert.match(w, /const egWindowSlot = \{ top: \(\) => modes\?\.topWindow\?\.\(\) \?\? null, mount: \(w\) => modes\?\.mountWindow\?\.\(w\), close: \(w\) => modes\?\.closeWindow\?\.\(w\) \};[^\n]*\n\s*const egBoardDoor = createEgBoardDoor\(\{\n\s*open: \(o\) => openEgBoard\(\{ doc: document, classic: !isEnhancedPlus\(\), fetchBoard: \(\) => _accountEg\.board\(\), listPickerReady: listPickerArtLoaded, runs: \(\) => egRecapsKept\(appStorage\(\)\), \.\.\.o \}\),[^\n]*\n\s*slot: egWindowSlot,/);   // PIN MOVED (AUDIT EG V, c: L7-19 - the boards' door carries this device's last runs, their sixth tab; AUDIT STAKE-ROW - the slot the boards share with the start window's list, egWindowSlot)
  assert.match(w, /board: \(\) => egBoardDoor\(\),   \/\/ EG-E2: `\/breach board`/);
  assert.match(w, /doors: egClient \? \{ board: \(\) => egBoardDoor\(\) \} : null,/);
  assert.match(w, /const egStartWindow = \(o\) => openEgStartWindow\(\{\n\s*\.\.\.o,\n\s*board: \(onClosed\) => egBoardDoor\(onClosed\),/);
  assert.equal((w.match(/openEgBoard\(/g) ?? []).length, 1, 'the boards opened in one place');
});
