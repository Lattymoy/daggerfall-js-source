// PVP-BAR (bible/11-Multiplayer/PvP-Rework.md to its
// mockup; "So a hidden player u only see the skull and hp bar", "They always have some body just fiant"): a flagged
// player's health, with a thin Shield strip, over the head between the skull and the name - the referee's word to the
// room, the wire's projection, the page's mask and the name tag's drawing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newWildRef, wildZone, wildBarWord, wildBarWords, WILD_BAR, WILD_GRACE } from '../../src/net/wild/wildRef.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';
import { validWildRefOut, WILD_REF_KINDS, worldRoom, PIXEL_UNITS } from '../../src/net/wire.js';
import { createPvpFlagHost, PVP_FIGHT_VEIL } from '../../src/scenes/pvpFlagHost.js';
import { createNameLayer, NAME_CSS } from '../../src/ui/nameLayer.js';
import { fakeRoom } from '../fakeRoom.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const M = SIEGE_UNITS_PER_M;
const at = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M });
/** A fighter in the zone, `fl` its flag, its pool anchored by a report (`heard`) at `hp` of 1000. */
function fighter(st, sub, id, fl, hp = 1000, now = 0) {
  const x = wildZone(st, sub, { id, lv: 10, ci: `r-${id}`, fl }, true, at(0), now);
  x.f.max = 1000; x.f.hp = hp; x.f.share.heard = true;
  return x;
}

test('PVP-BAR THE REFEREE (net/wild/wildRef.js wildBarWord, wildBarWords): a flagged fighter\'s health in whole per cent, 1 while it stands, 0 down; `s` a Shield\'s share of its top; none for a pool no report anchored; the room looks once each half second and says a bar only when it moved; an unflagged one is never said and forgets its bar (mutants: the throttle; the unchanged said; the unflagged said; the floor of 1; the Shield dropped; the unheard said)', () => {
  const st = newWildRef();
  const a = fighter(st, 'acct-a', 'peer-a', 1, 1000);
  const b = fighter(st, 'acct-b', 'peer-b', 0, 500);
  assert.deepEqual(wildBarWord(a), { t: 'wref', k: 'bar', id: 'peer-a', h: 100 });
  a.f.hp = 4;
  assert.equal(wildBarWord(a).h, 1, 'a sliver while it stands');
  a.f.hp = 0;
  assert.equal(wildBarWord(a).h, 0);
  a.f.hp = 655; a.f.share.shield = 25;
  assert.deepEqual(wildBarWord(a), { t: 'wref', k: 'bar', id: 'peer-a', h: 66, s: 100 });
  a.f.share.shield = 10;
  assert.equal(wildBarWord(a).s, 40, 'PVP-KIT: a Shield of share 10 fills two fifths');
  a.f.share.shield = 25;
  a.f.share.heard = false;
  assert.equal(wildBarWord(a), null, 'an unanchored pool would say whole');
  a.f.share.heard = true;
  assert.deepEqual(wildBarWords(st, 0).map((w) => [w.id, w.h]), [['peer-a', 66]], 'the flagged alone');
  a.f.hp = 300;
  assert.deepEqual(wildBarWords(st, WILD_BAR.sayMs - 1), [], 'within the half second: no look');
  assert.deepEqual(wildBarWords(st, WILD_BAR.sayMs).map((w) => w.h), [30]);
  assert.deepEqual(wildBarWords(st, 2 * WILD_BAR.sayMs), [], 'unmoved: unsaid');
  a.f.share.shield = false;
  assert.deepEqual(wildBarWords(st, 3 * WILD_BAR.sayMs), [{ t: 'wref', k: 'bar', id: 'peer-a', h: 30 }], 'the Shield gone is a move');
  a.flag = false;
  assert.deepEqual(wildBarWords(st, 4 * WILD_BAR.sayMs), []);
  a.flag = true;
  assert.deepEqual(wildBarWords(st, 5 * WILD_BAR.sayMs).map((w) => w.id), ['peer-a'], 'flagged again: said again');
  b.flag = true;
  assert.deepEqual(wildBarWords(st, 6 * WILD_BAR.sayMs).map((w) => [w.id, w.h]), [['peer-b', 50]]);
});

test('PVP-BAR THE WIRE (net/wire.js validWildRefOut): `bar` is an id, `h` 0..100 and `s` 0..100 or none; a Shield of 0 is dropped (mutants: the kind unknown; the bound unread; `s` unread)', () => {
  assert.ok(WILD_REF_KINDS.includes('bar'));
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'bar', id: 'peer-0001', h: 42, s: 100 }), { k: 'bar', id: 'peer-0001', h: 42, s: 100 });
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'bar', id: 'peer-0001', h: 0, s: 0 }), { k: 'bar', id: 'peer-0001', h: 0 });
  for (const bad of [{ h: 101 }, { h: -1 }, { h: 4.5 }, { h: 50, s: 101 }, { h: 50, s: '1' }, { h: 50, id: 'no spaces' }]) {
    assert.equal(validWildRefOut({ t: 'wref', k: 'bar', id: 'peer-0001', ...bad }), null, JSON.stringify(bad));
  }
});

const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const bars = (ws) => ws.sent.filter((m) => m.t === 'wref' && m.k === 'bar').map((m) => [m.id, m.h]);

test('PVP-BAR THE RELAY (server/src/index.js _wildBarSay, _wildBarsTo): the zone\'s beat fans each flagged fighter\'s bar that moved to the room, at most once each half second; one entering hears every flagged fighter\'s bar; an unflagged one\'s is never said (mutants: the beat unwired; the newcomer untold)', async () => {
  const realNow = Date.now; let clock = 1_800_000_000_000; Date.now = () => clock;
  try {
    const r = fakeRoom(CELL, { now: () => clock });
    const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'wild', data: d }));
    const join = async (id, x, ci) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK, rc: 1, ci }); return ws; };
    const a = await join('peer-0001', -1, 'r00000000000000000a02'), b = await join('peer-0002', 1, 'r00000000000000000a01');
    await say(a, { k: 'zone', z: 1, fl: 1 });
    await say(b, { k: 'zone', z: 1, fl: 0 });
    for (const x of r.room._wildRef.fighters.values()) { x.f.max = 1000; x.f.hp = 800; x.f.share.heard = true; }
    clock += WILD_BAR.sayMs;
    await r.pose(b, P(1.5));
    assert.deepEqual(bars(b), [['peer-0001', 80]], 'the flagged one\'s bar, to the room');
    assert.deepEqual(bars(a), [['peer-0001', 80]]);
    [...r.room._wildRef.fighters.values()].find((x) => x.id === 'peer-0001').f.hp = 250;
    clock += WILD_BAR.sayMs - 1;
    await r.pose(b, P(1));
    assert.equal(bars(b).length, 1, 'within the half second: held');
    clock += 1;
    await r.pose(b, P(1.5));
    assert.deepEqual(bars(b).at(-1), ['peer-0001', 25]);
    const c = await join('peer-0003', 0, 'r00000000000000000a03');
    await say(c, { k: 'zone', z: 1, fl: 1 });
    assert.deepEqual(bars(c), [['peer-0001', 25]], 'the newcomer hears the flagged one\'s bar at once');
  } finally { Date.now = realNow; }
});

test('PVP-BAR THE PAGE (scenes/pvpFlagHost.js): the referee\'s bar rides a flagged peer\'s name point, a blow\'s count moves it at once, a flag down takes it; a flagged peer the mask leaves nameless keeps skull and bar; a concealed one in a fight is drawn faint and loses its name - out of a fight, or plain, or a staff boss, it is as before (mutants: the bar unkept; the blow unread; the flag down kept; the stranger dropped; the veil unworn; the name kept)', () => {
  let clock = 0;
  const f = createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true, setWildFlag: () => {} }), { level: 30 }, () => {}, { say: () => {} }, { doc: null, now: () => clock });
  f.heard({ k: 'flag', id: 'peer-x', f: 1 });
  assert.equal(f.heard({ k: 'bar', id: 'peer-x', h: 70, s: 100 }), true, 'taken here');
  f.heard({ k: 'bar', id: 'peer-q', h: 40 });
  const mask = f.mask((p) => (p.id === 'peer-s' ? null : p));
  assert.deepEqual(mask({ id: 'peer-x', name: 'A' }), { id: 'peer-x', name: 'A', skull: 'white', bar: { h: 70, s: 100 } });
  assert.deepEqual(mask({ id: 'peer-q', name: 'B' }), { id: 'peer-q', name: 'B' }, 'unflagged: no bar');
  f.heard({ k: 'hp', by: 'peer-me', to: 'peer-x', d: 5, r: 0, h: [['peer-me', 900, 1000], ['peer-x', 333, 1000]] });
  assert.deepEqual(mask({ id: 'peer-x', name: 'A' }).bar, { h: 33, s: 100 });
  f.heard({ k: 'flag', id: 'peer-s', f: 1, a: 5000 });
  const s = mask({ id: 'peer-s', name: 'Example Player', lv: 40, gt: 'HND' });
  assert.deepEqual([s.name, s.lv, s.gt, s.skull, s.bar], ['', null, null, 'gold', undefined], 'the stranger: skull, no name');
  assert.equal(f.mask((p) => (p.id === 'peer-s' ? null : p))({ id: 'peer-z', name: 'C' }).name, 'C');
  const hidden = { kind: 'hidden' }, conceal = { kind: 'conceal', visual: { mode: 1 } }, plain = { kind: 'plain' };
  assert.deepEqual(f.look('peer-s', 1, hidden), { kind: 'conceal', visual: PVP_FIGHT_VEIL }, 'in a fight: a faint body');
  assert.equal(PVP_FIGHT_VEIL.named, true, 'its point kept for the skull and bar');
  assert.ok(PVP_FIGHT_VEIL.alpha > 0 && PVP_FIGHT_VEIL.alpha < 0.5, 'faint');
  f.heard({ k: 'flag', id: 'peer-v', f: 1, a: 5000 });
  f.heard({ k: 'bar', id: 'peer-v', h: 90 });
  assert.equal(f.look('peer-v', 2, conceal).visual, PVP_FIGHT_VEIL);
  assert.deepEqual(mask({ id: 'peer-v', name: 'D' }), { ...mask({ id: 'peer-v', name: '' }), name: '' }, 'veiled: no name');
  assert.deepEqual(mask({ id: 'peer-v', name: 'D' }).bar, { h: 90, s: 0 });
  assert.equal(f.look('peer-x', 1, hidden), hidden, 'flagged, out of a fight: as before');
  assert.equal(f.look('peer-s', 7, hidden), hidden, 'a staff member inside its boss');
  assert.equal(f.look('peer-s', 0, plain), plain);
  clock = 1000;
  assert.equal(mask({ id: 'peer-x', name: 'A' }).name, 'A');
  assert.equal(mask({ id: 'peer-v', name: 'D' }).name, 'D', 'a veil of a frame long gone keeps nothing');
  f.heard({ k: 'flag', id: 'peer-x', f: 0 });
  f.heard({ k: 'flag', id: 'peer-x', f: 1 });
  assert.equal(mask({ id: 'peer-x', name: 'A' }).bar, undefined, 'a flag down took its bar');
  assert.ok(rd('src/scenes/world.js').includes('const look = pvpFlag.look(d.id, d.shown?.cv | 0, peerDraw('), 'the host asks it of every peer');
});

test('PVP-BAR THE TAG (ui/nameLayer.js): the bar under the skull, above the title - red health, a thin blue Shield strip on top, off for none (mutants: the bar unpainted; the Shield\'s width unread)', () => {
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, style: {}, dataset: {},
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
      setAttribute(k, v) { n.attrs[k] = v; }, replaceChildren(...cs) { n.children.length = 0; n.append(...cs); },
      remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; }, addEventListener() {}, focus() {} };
    let text = '', cls = '';
    Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.children.length = 0; } });
    Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); } });
    return n;
  };
  const doc = { createElement: (t) => node(t), createElementNS: (ns, t) => node(t), head: node('head'), body: node('body'), getElementById: () => null };
  const layer = createNameLayer({ doc, now: () => 1000 });
  const draw = (bar) => { layer.render({ points: [{ id: 'peer-0001', name: 'Example Player', x: 400, y: 300, skull: 'white', bar }] }); return layer.tagFor('peer-0001'); };
  let t = draw({ h: 64, s: 100 });
  assert.deepEqual(t.node.children.map((c) => c.className).slice(1, 4), ['dfname-skull', 'dfname-bar', 'dfname-title']);
  assert.deepEqual(t.bar.children.map((c) => c.className), ['dfname-bar-s', 'dfname-bar-h'], 'the Shield strip on top');
  assert.deepEqual([t.barH.style.width, t.barS.style.width], ['64%', '100%']);
  t = draw({ h: 20, s: 0 });
  assert.deepEqual([t.barH.style.width, t.barS.style.width], ['20%', '0%']);
  t = draw(undefined);
  assert.equal(t.bar.className, 'dfname-bar off');
  assert.match(NAME_CSS, /\.dfname-bar\.off \{ display: none; \}/);
  assert.match(NAME_CSS, /\.dfname-bar-h \{[^}]*background: #d42a1e/);
  assert.match(NAME_CSS, /\.dfname-bar-s \{[^}]*background: #3d7be0/);
});
