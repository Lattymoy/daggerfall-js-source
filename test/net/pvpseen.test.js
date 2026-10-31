// PVP-SEEN: in the open zone every player's name shows in 3D; a concealed or invisible
// flagged player shows its skull and bar, never its name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RemotePlayers, PEER_HEIGHT } from '../../src/net/remotePlayers.js';
import { createPvpFlagHost } from '../../src/scenes/pvpFlagHost.js';
import { perspective, mirrorProjectionX, lookAt } from '../../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const VIEW = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
const peer = (id, x) => ({ id, name: 'Example Player', lv: 40, gt: 'HND', shown: { x, y: 0, z: -10, yaw: 0 }, look: null });

test('PVP-SEEN THE PAGE (scenes/pvpFlagHost.js look, barKept): a flagged player out of a fight, concealed or invisible, loses its name and keeps its skull and bar; a concealed one stays as faint as it was; an unflagged one is as before (mutants: the veil unmarked; the name kept; barKept never true)', () => {
  let clock = 0;
  const f = createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true, setWildFlag: () => {} }), { level: 30 }, () => {}, { say: () => {} }, { doc: null, now: () => clock });
  f.heard({ k: 'flag', id: 'peer-c', f: 1 });
  f.heard({ k: 'bar', id: 'peer-c', h: 80 });
  f.heard({ k: 'flag', id: 'peer-i', f: 1 });
  const visual = { mode: 1, alpha: 0.1 };
  const c = f.look('peer-c', 1, { kind: 'conceal', visual });
  assert.equal(c.kind, 'conceal');
  assert.deepEqual(c.visual, { ...visual, named: true }, 'its own shimmer, its point kept');
  assert.equal(visual.named, undefined, 'the shared visual untouched');
  const mask = f.mask((p) => p);
  const s = mask({ id: 'peer-c', name: 'Example Player', lv: 40 });
  assert.deepEqual([s.name, s.lv, s.skull, s.bar], ['', null, 'white', { h: 80, s: 0 }], 'concealed: skull and bar, no name');
  const hidden = { kind: 'hidden' };
  assert.equal(f.look('peer-i', 4, hidden), hidden, 'invisible: still drawn nowhere');
  assert.equal(f.barKept('peer-i'), true, 'its tag kept');
  assert.equal(f.barKept('peer-u'), false, 'unflagged: no tag');
  assert.equal(f.look('peer-u', 4, hidden), hidden);
  assert.equal(f.barKept('peer-u'), false);
  clock = 1000;
  assert.equal(f.barKept('peer-i'), false, 'visible again: as before');
  assert.equal(mask({ id: 'peer-c', name: 'Example Player' }).name, 'Example Player', 'out of hiding: the name back');
});

test('PVP-SEEN THE NAMES (net/remotePlayers.js sync, namePoints, nameFrame): `hidden` answering \'bar\' keeps a nameless point at the body\'s head; nameFrame keeps it only with a skull or bar; `true` is nowhere as before (mutants: the point dropped; the name kept; a bare point kept)', () => {
  const rp = new RemotePlayers({ renderer: { drawScreenQuad() {}, drawScreenQuadRun() {} }, deps: null, compose: async () => null });
  const hid = { a: 'bar', b: true };
  rp.sync([peer('a', -1), peer('b', 1)], (p) => [p.x, p.y, p.z], { bodyHeight: () => PEER_HEIGHT, hidden: (id) => hid[id] ?? false });
  const pts = rp.namePoints(PROJ, VIEW, 1600, 900, [0, 1.7, 0], (q) => [q.x, q.y, q.z]);
  assert.deepEqual(pts.map((p) => p.id), ['a'], 'the invisible-and-flagged kept, the plain invisible not');
  assert.deepEqual([pts[0].name, pts[0].lv, pts[0].gt, pts[0].hid], ['', null, null, true]);
  const frame = (mask) => {
    let drawn = null;
    rp.nameFrame({ proj: PROJ, view: VIEW, w: 1600, h: 900, eye: [0, 1.7, 0], toScene: (q) => [q.x, q.y, q.z], layer: { render: ({ points }) => { drawn = points; } }, mask });
    return drawn;
  };
  assert.deepEqual(frame(null), [], 'no skull, no bar: no tag');
  assert.deepEqual(frame((p) => ({ ...p, skull: 'white' })).map((p) => [p.id, p.name]), [['a', '']], 'its skull, no name');
});

test('PVP-SEEN THE HOST (scenes/world.js, by source): a stranger in the zone keeps their name in 3D; the invisible flagged peer is handed to the names as \'bar\'', () => {
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes('if (!(travelView?.active)) return p;'), 'the real name in 3D');
  assert.ok(!w.includes('if (!(travelView?.active)) return null;'));
  assert.ok(w.includes("hidden: (id) => _hiddenPeers.has(id) && (pvpFlag.barKept(id) ? 'bar' : true)"));
});
