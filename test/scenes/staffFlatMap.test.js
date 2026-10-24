// STAFF-FLATMAP (mob 2026-10-24: "did u get the flat map done?"): the in-game flat map - Shift+N, one region from above.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStaffFlatMapHost } from '../../src/scenes/staffFlatMapHost.js';
import { createStaffFlatMap, FLAT_DOT } from '../../src/ui/staffFlatMap.js';
import { CHAT_REGION_COUNT } from '../../src/net/wire.js';
import { REGION_NAMES } from '../../src/formats/mapsTables.js';

/** Region 3 stands on x 100-109, y 50-55; region 4 beside it at x 110-119; the rest is sea. */
const politicAt = (x, y) => (y >= 50 && y <= 55 ? (x >= 100 && x <= 109 ? 128 + 3 : x >= 110 && x <= 119 ? 128 + 4 : 64) : 64);
function rig({ answer = null, flags = {} } = {}) {
  const picks = [], shows = [], chosen = [];
  let hidden = false;
  const map = { pick: (r) => picks.push(r), answer: () => answer };
  const sheet = { shown: [], deps: null };
  const makeSheet = (deps) => { sheet.deps = deps; return { show: (v) => { shows.push(v); }, hide: () => { hidden = true; }, open: () => true, dispose() {} }; };
  const host = createStaffFlatMapHost({
    map, politicAt, pixel: () => ({ x: 104, y: 52 }), flagOf: (sub) => flags[sub] ?? null,
    words: (f) => (f ? [f.level ? f.why : '', f.watch ? 'WATCH' : ''].filter(Boolean).join(' · ') : ''),
    choose: (...a) => chosen.push(a), makeSheet,
  });
  return { host, picks, shows, chosen, sheet, hidden: () => hidden };
}

test('STAFF-FLATMAP Shift+N: opens on the region the staff member stands in and watches it on the map\'s link; closed, the link is let go (mutants: the region stood in unread, the link kept on close)', () => {
  const r = rig();
  assert.equal(r.host.toggle(), true);
  assert.deepEqual(r.picks, [3]);
  assert.equal(r.host.isOpen(), true);
  assert.equal(r.host.toggle(), false);
  assert.deepEqual(r.picks, [3, null]);
  assert.equal(r.hidden(), true);
});

test('STAFF-FLATMAP the sheet: the region\'s box off the politic map with a margin, its land own/neighbour/sea, the staff member\'s dot, the travellers most urgent first with their flag words; the hint says Hide me off, the count, or connecting (mutants: no urgency order, Hide me off unsaid, the box unmargined)', () => {
  const list = [
    { id: 'a', sub: 'acct-a', name: 'Ash', px: 101.5, py: 51 },
    { id: 'b', sub: 'acct-b', name: 'Bran', px: 105, py: 53 },
    { id: 'c', sub: null, name: 'Cole', px: 108, py: 54 },
    { id: 'd', sub: 'acct-d', name: 'Dee', px: 103, py: 52 },
  ];
  const r = rig({ answer: { region: 3, state: 'open', list }, flags: { 'acct-b': { level: 'high', why: '4 reports' }, 'acct-d': { level: null, why: '', watch: true }, 'acct-a': { level: 'medium', why: 'gold' } } });
  r.host.frame();
  assert.equal(r.shows.length, 0, 'closed: nothing drawn');
  r.host.toggle();
  r.host.frame();
  const v = r.shows.at(-1);
  assert.equal(v.region, 3);
  assert.equal(v.name, REGION_NAMES[3]);
  assert.deepEqual(v.box, { x0: 96, y0: 46, x1: 113, y1: 59 });
  assert.deepEqual([v.landAt(104, 52), v.landAt(112, 52), v.landAt(104, 40)], ['own', 'other', 'sea']);
  assert.deepEqual(v.me, { x: 104.5, y: 52.5 });
  assert.deepEqual(v.players.map((p) => [p.name, p.level, p.line]), [['Bran', 'high', '4 reports'], ['Ash', 'medium', 'gold'], ['Dee', 'low', 'WATCH'], ['Cole', '', '']]);
  assert.match(v.hint, /4 travellers outdoors/);
  r.sheet.deps.onPick('b', { x: 5, y: 6 });
  assert.deepEqual(r.chosen, [['b', 'acct-b', 'Bran', { x: 5, y: 6 }]], 'a press is the view\'s menu');
  r.sheet.deps.onPick('nobody', { x: 0, y: 0 });
  assert.equal(r.chosen.length, 1);
  const off = rig({ answer: { region: 3, state: 'hide', list: [] } });
  off.host.toggle(); off.host.frame();
  assert.match(off.shows.at(-1).hint, /Hide me/);
  const wait = rig({ answer: { region: 9, state: 'open', list } });
  wait.host.toggle(); wait.host.frame();
  assert.deepEqual(wait.shows.at(-1).players, [], 'another region\'s answer is not this one\'s');
  assert.match(wait.shows.at(-1).hint, /Connecting/);
});

test('STAFF-FLATMAP the region steps: previous and next wrap round the politic map\'s regions, each watched in turn', () => {
  const r = rig();
  r.host.toggle();
  r.sheet.deps.onRegion(1);
  r.sheet.deps.onRegion(-1);
  r.sheet.deps.onRegion(-1); r.sheet.deps.onRegion(-1); r.sheet.deps.onRegion(-1); r.sheet.deps.onRegion(-1);
  assert.deepEqual(r.picks, [3, 4, 3, 2, 1, 0, CHAT_REGION_COUNT - 1]);
  r.sheet.deps.onClose();
  assert.equal(r.host.isOpen(), false);
  assert.equal(r.picks.at(-1), null);
});

function fakeDoc() {
  const doc = { made: 0 };
  const node = (tag) => {
    const n = { tag, children: [], attrs: {}, on: {}, style: {}, textContent: '', clientWidth: 400, clientHeight: 200 };
    n.append = (...cs) => n.children.push(...cs);
    n.replaceChildren = (...cs) => { n.children = [...cs]; };
    n.setAttribute = (k, v) => { n.attrs[k] = v; };
    n.addEventListener = (k, f) => (n.on[k] ??= []).push(f);
    n.remove = () => {};
    n.fire = (k, e0 = {}) => { const e = { stopped: false, stopPropagation() { e.stopped = true; }, preventDefault() {}, ...e0 }; for (const f of n.on[k] ?? []) f(e); return e; };
    if (tag === 'canvas') {
      n.ops = [];
      n.getContext = () => new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? (...a) => n.ops.push([k, ...a]) : undefined), set: () => true });
      n.getBoundingClientRect = () => ({ left: 0, top: 0 });
    }
    return n;
  };
  doc.createElement = (tag) => { doc.made++; return node(tag); };
  doc.body = node('body');
  return doc;
}
const find = (n, attr) => (n.attrs?.[attr] != null ? n : n.children?.map((c) => find(c, attr)).find(Boolean));

test('STAFF-FLATMAP the screen: a sheet whose presses never reach the world; the Most urgent list a row a traveller in their flag\'s colour, a row\'s or a dot\'s press the host\'s; the head\'s steps and Close; drawn again only when it changed', () => {
  const doc = fakeDoc();
  const picks = [], steps = [];
  let closed = 0;
  const s = createStaffFlatMap({ doc, onPick: (id, at) => picks.push([id, at]), onRegion: (n) => steps.push(n), onClose: () => { closed++; } });
  const v = { region: 3, name: 'Daggerfall', hint: '2 travellers', box: { x0: 0, y0: 0, x1: 9, y1: 4 }, landAt: () => 'own', me: { x: 5, y: 2 },
    players: [{ id: 'b', name: 'Bran', line: '4 reports', level: 'high', px: 2, py: 2 }, { id: 'c', name: 'Cole', line: '', level: '', px: 8, py: 3 }] };
  s.show(v);
  const sheet = find(doc.body, 'data-staff-flat-map');
  assert.equal(sheet.style.display, 'flex');
  assert.equal(sheet.fire('mousedown').stopped, true, 'the world hears nothing');
  const list = find(doc.body, 'data-flat-list');
  assert.deepEqual(list.children.slice(1).map((b) => [b.attrs['data-flat-row'], b.children[0].textContent, b.children[1].textContent, b.children[1].style.color]),
    [['b', 'Bran', '4 reports', FLAT_DOT.high], ['c', 'Cole', 'no flag', FLAT_DOT.none]]);
  list.children[1].fire('click', { clientX: 3, clientY: 4 });
  assert.deepEqual(picks.at(-1), ['b', { x: 3, y: 4 }]);
  const cv = find(doc.body, 'data-flat-canvas');
  const arcs = cv.ops.filter((o) => o[0] === 'arc');
  assert.equal(arcs.length, 3, 'a dot a traveller and the staff member\'s ring');
  const [, bx, by] = arcs[0];
  cv.fire('click', { clientX: bx + 2, clientY: by });
  assert.deepEqual(picks.at(-1)[0], 'b', 'a dot\'s press');
  const n = picks.length;
  cv.fire('click', { clientX: bx + 60, clientY: by + 60 });
  assert.equal(picks.length, n, 'a press on no dot is nothing');
  find(doc.body, 'data-flat-prev').fire('click'); find(doc.body, 'data-flat-next').fire('click');
  assert.deepEqual(steps, [-1, 1]);
  find(doc.body, 'data-flat-close').fire('click');
  assert.equal(closed, 1);
  const ops = cv.ops.length;
  s.show(v);
  assert.equal(cv.ops.length, ops, 'the same picture: not drawn again');
  s.hide();
  assert.equal(sheet.style.display, 'none');
  assert.equal(s.open(), false);
});
