// OW-CROWD (2026-10-02, Mac: "Can we also find a way to reduce the overwhelming player markers that flood the screen? I
// like it, dont get me wrong, but there must be a way to make it where its not overwhelming").
//
// The Overworld drew every player of the region as their own mark, wearing their whole badge (the title, the Renown, the
// name, the guild's tag, the glyphs), and each off the picture as their own arrow at the edge - a town's crowd, or a
// region's worth at one edge, was a wall of names. Now, as they are placed on the screen (ui/travel/travelViewHud.js
// declutterTravellers): travellers drawn within TV_CROWD_PX of one another are one mark, "N travellers", at their
// middle; arrows at the edge within TV_CROWD_EDGE_PX one arrow, the nearest's; and of those still alone in the picture
// only the TV_BADGES_MAX nearest my own mark wear their badge - the rest their name. My party, the places, the bands and
// everything else are never folded nor stripped.
import '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as hud from '../../../src/ui/travel/travelViewHud.js';

const { declutterTravellers, TV_CROWD_PX, TV_CROWD_EDGE_PX, TV_BADGES_MAX, crowdLabel } = hud;
const BADGE = { title: null, glyphs: [], lv: 12, gt: null };
/** A placement as the HUD makes it. */
const at = (key, x, y, { kind = 'traveller', held = null, badge = BADGE, side = -1 } = {}) => ({ m: { key, label: key, kind, x, y, front: !held, edge: true, ...(badge ? { badge } : {}) }, held, x, y, look: kind.split(' ')[0], side, bk: badge ? 'b' : '', sp: badge ? { w: 40, h: 20 } : null });
const FEET = { x: 640, y: 360 };

test('OW-CROWD declutterTravellers: travellers drawn close are one mark at their middle, named for how many; apart, each their own (mutants: never folded; folded whatever the distance; the middle the first)', () => {
  assert.equal(TV_CROWD_PX, 36);
  const out = declutterTravellers([at('trav:a', 700, 300), at('trav:b', 710, 310), at('trav:c', 690, 320), at('trav:far', 900, 300)], FEET);
  const crowd = out.filter((q) => q.m.key.startsWith('crowd:'));
  assert.equal(crowd.length, 1);
  assert.equal(crowd[0].m.label, crowdLabel(3));
  assert.equal(crowd[0].m.label, '3 travellers');
  assert.equal(crowd[0].m.kind, 'traveller crowd');
  assert.equal(crowd[0].m.badge, undefined, 'no badge of one');
  assert.equal(crowd[0].sp, null);
  assert.deepEqual([crowd[0].x, crowd[0].y], [700, 310], 'at their middle');
  assert.equal(crowd[0].m.key, 'crowd:trav:c', 'keyed by the nearest my mark (c, 64 px)');
  assert.ok(out.some((q) => q.m.key === 'trav:far'), 'one 200 px off stands alone');
  // just past the reach: apart
  const two = declutterTravellers([at('trav:a', 500, 500), at('trav:b', 500 + TV_CROWD_PX + 1, 500)], FEET);
  assert.deepEqual(two.map((q) => q.m.key).sort(), ['trav:a', 'trav:b']);
});

test('OW-CROWD: my party, the places, the bands and the rest are never folded nor stripped, and every mark keeps its order (AUDIT: the travellers went last, a crowd\'s dot over my party\'s); a crowd of ships is a ship (mutants: the party folded; the order lost)', () => {
  const placed = [at('place:1', 700, 300, { kind: 'place', badge: null }), at('trav:a', 700, 301), at('band:1', 701, 301, { kind: 'band', badge: null }),
    at('trav:b', 704, 303), at('peer:p', 702, 302, { kind: 'party' })];
  const out = declutterTravellers(placed, FEET);
  assert.deepEqual(out.map((q) => q.m.key), ['place:1', 'crowd:trav:a', 'band:1', 'peer:p'], 'AUDIT: in their own order - the crowd where its first member stood, my party drawn over it');
  assert.ok(out.find((q) => q.m.key === 'peer:p').m.badge, 'my party keeps its badge');
  const ships = declutterTravellers([at('trav:s1', 300, 300, { kind: 'traveller ship' }), at('trav:s2', 305, 300, { kind: 'traveller ship journey' })], FEET);
  assert.equal(ships[0].m.kind, 'traveller crowd ship', 'drawn as a ship');
  const mixed = declutterTravellers([at('trav:s1', 300, 300, { kind: 'traveller ship' }), at('trav:w', 305, 300)], FEET);
  assert.equal(mixed[0].m.kind, 'traveller crowd', 'a ship and a walker: a dot');
});

test('OW-CROWD: arrows held at the edge close together are one arrow - the nearest\'s place and way - and never folded with a mark in the picture (mutants: held folded with the picture; the edge\'s reach the picture\'s)', () => {
  assert.equal(TV_CROWD_EDGE_PX, 56);
  const H = (angle) => ({ x: 1252, y: 0, angle });
  const out = declutterTravellers([
    at('trav:a', 1252, 200, { held: H(90), side: 1 }), at('trav:b', 1252, 245, { held: H(92), side: 1 }), at('trav:c', 1252, 400, { held: H(110), side: 1 }),
    at('trav:d', 1240, 200),   // in the picture beside the first arrow: its own
  ], { x: 1100, y: 250 });
  const arrow = out.find((q) => q.m.key.startsWith('crowd:'));
  assert.equal(arrow.m.label, '2 travellers', 'the two 45 px apart: one arrow (past the picture\'s 36)');
  assert.ok(arrow.held, 'held still');
  assert.equal(arrow.side, 1);
  assert.equal(arrow.m.key, 'crowd:trav:b', 'the nearest my mark leads');
  assert.deepEqual([arrow.x, arrow.y], [1252, 245], 'at the lead\'s place on the edge');
  assert.ok(out.some((q) => q.m.key === 'trav:c'), '200 px down the edge: its own');
  assert.ok(out.some((q) => q.m.key === 'trav:d' && !q.held), 'the one in the picture: its own');
});

test('OW-CROWD: of the travellers alone in the picture, the TV_BADGES_MAX nearest my mark wear their badge, the rest their name; an arrow at the edge its name alone - AUDIT: they wore every badge round the screen, uncapped (mutants: no cap; the farthest kept; the edge\'s badges kept)', () => {
  assert.equal(TV_BADGES_MAX, 6);
  const placed = [];
  for (let i = 0; i < 9; i++) placed.push(at(`trav:${i}`, FEET.x + 80 * (i + 1), FEET.y));   // 80 px apart, farther each
  const frameMark = placed[8].m;
  placed.push(at('trav:edge', 1252, 100, { held: { x: 1252, y: 100, angle: 45 }, side: 1 }));
  const out = declutterTravellers(placed, FEET);
  const badged = out.filter((q) => q.m.badge && !q.held).map((q) => q.m.key);
  assert.deepEqual(badged, ['trav:0', 'trav:1', 'trav:2', 'trav:3', 'trav:4', 'trav:5'], 'the six nearest');
  for (const k of ['trav:6', 'trav:7', 'trav:8']) {
    const q = out.find((o) => o.m.key === k);
    assert.equal(q.m.badge, undefined, `${k}: the name alone`);
    assert.equal(q.sp, null);
    assert.equal(q.m.label, k, 'the name kept');
  }
  assert.ok(frameMark.badge, 'the frame\'s own mark untouched (a copy stripped)');
  const edge = out.find((q) => q.m.key === 'trav:edge');
  assert.equal(edge.m.badge, undefined, 'the edge\'s arrow: its name alone');
  assert.equal(edge.m.label, 'trav:edge');
  const party = declutterTravellers([at('peer:p', 1252, 100, { kind: 'party', held: { x: 1252, y: 100, angle: 45 }, side: 1 })], FEET);
  assert.ok(party[0].m.badge, 'my party\'s arrow keeps its badge');
});

test('OW-CROWD through the readout: forty travellers held at one edge are one arrow and one label; a crowd in the picture two busts (OW-GLYPHS) with its count (by the HUD over a stub canvas)', () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : (...a) => { calls.push([k, ...a]); }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const win = { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {} };
  const doc = { defaultView: win, fonts: null };
  let canvases = 0;
  const mk = (tag) => {
    const n = { tagName: tag.toUpperCase(), className: '', children: [], style: { setProperty() {} }, ownerDocument: doc, attrs: {}, dataset: {}, setAttribute(k, v) { this.attrs[k] = v; }, append(...c) { this.children.push(...c); }, remove() {}, addEventListener() {}, isConnected: true, width: 0, height: 0, getBoundingClientRect() { return { width: 0, height: 0 }; } };
    if (tag === 'canvas') { canvases++; n.getContext = () => ctx; }
    return n;
  };
  Object.assign(doc, { createElement: mk, createElementNS: (_, tag) => mk(tag), getElementById: () => null, querySelectorAll: () => [], head: mk('head'), body: mk('body') });
  hud.showTravelViewHud({}, doc);
  try {
    const marks = [];
    for (let i = 0; i < 40; i++) marks.push({ key: `trav:${i}`, x: 3000 + i, y: 100, front: false, label: `Rider ${i}`, kind: 'traveller', edge: true, badge: { title: 'founder', glyphs: ['dev'], lv: 12 + i, gt: 'HND' } });
    const before = canvases;
    hud.updateTravelViewHud({ feet: { x: 640, y: 360, front: true }, heading: 0, yaw: 0, where: '', marks });
    assert.equal(calls.filter((c) => c[0] === 'drawImage').length, 1, 'one label for forty');
    assert.equal(canvases - before, 1, 'AUDIT: the crowd\'s label alone made - no badge built for a player folded into it (the frame\'s sixteen were spent on them)');
    calls.length = 0;
    hud.updateTravelViewHud({ feet: { x: 640, y: 360, front: true }, heading: 0, yaw: 0, where: '', marks: [
      { key: 'trav:a', x: 300, y: 300, front: true, label: 'Ann', kind: 'traveller' }, { key: 'trav:b', x: 310, y: 305, front: true, label: 'Bo', kind: 'traveller' },
    ] });
    const arcs = calls.filter((c) => c[0] === 'arc');
    assert.equal(arcs.length, 2, 'one mark for the two - OW-GLYPHS: a crowd\'s two busts, a head apiece');
    assert.deepEqual(arcs.map((c) => c[3]), [2.9, 2.9], 'two heads');
    assert.equal(calls.filter((c) => c[0] === 'drawImage').length, 1, 'one label');
  } finally { hud.disposeTravelViewHud(); }
});
