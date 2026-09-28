// COMPASS-PARTY (2026-09-27, Discord - Ashley: "being able to see where party members are on compass? - just lil green
// marks that point in that direction"; Satranath: "Party members show up on the map but not compass").
//
// THE PARTY ON THE COMPASS: one reading of where each mate is, in the scene's XZ (ui/partyMapMarks.js
// partyCompassPoints - the bodies this client draws where they stand; outdoors the rest where their poses say), marked
// on both compasses with the Detect markers' triangle and bearing law in the party's one green - the classic box
// (ui/hud.js drawPartyCompassMarks, driven over a stub renderer) and the enhanced strip (ui/enhancedHud.js, over a
// stub document) - and handed by all three hosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partyCompassPoints } from '../src/ui/partyMapMarks.js';
import { drawPartyCompassMarks, compassMarkerLerp, DETECT_MARKER_W, DETECT_MARKER_H } from '../src/ui/hud.js';
import { PARTY_GREEN, PARTY_GREEN_CSS } from '../src/net/social.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pose = (over = {}) => ({ px: 100, py: 200, in: 0, loc: '', h: 1, hm: 1, ...over });

test('COMPASS-PARTY partyCompassPoints: a mate whose body is drawn here is marked where it stands; outdoors the rest where their poses say - the leader\'s feet, else the middle of their pixel; a mate in MY pixel not drawn here, an offline seat and a seat with no pose are no mark; indoors the bodies alone (mutants: the drawn mate marked twice; the same-pixel mate at the town\'s middle; an offline seat marked; the leader\'s feet ignored)', () => {
  const bodies = () => [{ acct: 'a-bran', name: 'Bran', feet: [10, 2, -30], yaw: 0 }];
  const others = [
    { acct: 'a-bran', online: true, p: pose({ px: 101, py: 200 }) },                  // drawn here: its body, once
    { acct: 'a-cass', online: true, p: pose({ px: 103, py: 199 }) },                  // another pixel: its middle
    { acct: 'a-dee', online: true, p: pose({ px: 100, py: 200, in: 2 }) },            // my pixel, in a building: none
    { acct: 'a-eli', online: false, p: pose({ px: 90, py: 190 }) },                   // offline: none
    { acct: 'a-fen', online: true, p: null },                                         // no pose yet: none
    { acct: 'a-gil', online: true, p: pose({ px: 100, py: 200, wx: 5000, wz: 6000 }) },  // the leader outdoors: their feet
  ];
  const seen = [];
  const pts = partyCompassPoints({
    bodies, others, here: { x: 100, y: 200 },
    fromWorld: (wx, wz) => { seen.push(['world', wx, wz]); return [wx / 100, wz / 100]; },
    pixelCentre: (px, py) => { seen.push(['pixel', px, py]); return [px * 1000 + 0.5, py * 1000 + 0.5]; },
  });
  assert.deepEqual(pts, [[10, -30], [103000.5, 199000.5], [50, 60]]);
  assert.deepEqual(seen, [['pixel', 103, 199], ['world', 5000, 6000]]);
  // indoors: no bearing to the open country - the bodies are the whole answer
  assert.deepEqual(partyCompassPoints({ bodies, others, here: null, fromWorld: () => [0, 0], pixelCentre: () => [0, 0] }), [[10, -30]]);
  // a solo player, a host with no party dep, a body with no place: nothing
  assert.deepEqual(partyCompassPoints(), []);
  assert.deepEqual(partyCompassPoints({ bodies: () => [{ acct: 'x', feet: [NaN, 0, 1] }] }), []);
  // a leader inside a dungeon elsewhere sends no feet: the middle of the dungeon's pixel
  assert.deepEqual(partyCompassPoints({ others: [{ acct: 'l', online: true, p: pose({ px: 7, py: 8, in: 1 }) }], here: { x: 1, y: 1 }, fromWorld: () => [9, 9], pixelCentre: (px, py) => [px, py] }), [[7, 8]]);
});

test('COMPASS-PARTY the classic compass: a green 5x3 triangle per mate over the box\'s top edge, placed by the Detect markers\' bearing law and clamped to the box, nothing without points or my own place (mutants: the marks never drawn; unclamped; the Detect markers\' red)', () => {
  const quads = [];
  const renderer = { drawScreenQuad: (tex, rect, uv, col) => quads.push({ rect, col }) };
  const box = { bx: 500, by: 400, bw: 100, s: 2 };
  const me = [0, 0];
  // ahead (heading 0 faces +z), and one straight behind
  const n = drawPartyCompassMarks(renderer, [[0, 50], [0, -50]], me, 0, box);
  assert.equal(n, 2);
  assert.equal(quads.length, 6, 'three rows a mark');
  assert.ok(quads.every((q) => q.col === PARTY_GREEN), 'the party\'s one green');
  const mw = DETECT_MARKER_W * box.s, mh = DETECT_MARKER_H * box.s;
  const left = (t) => box.bx + (box.bw - mw) * Math.min(1, Math.max(0, compassMarkerLerp(t, me, 0)));
  assert.equal(quads[0].rect.x, left([0, 50]), 'the first row, full width, at the bearing');
  assert.equal(quads[0].rect.w, 5 * box.s);
  assert.equal(quads[0].rect.y, box.by - mh, 'over the box\'s top edge');
  assert.equal(quads[2].rect.w, 1 * box.s, 'the point');
  const behind = quads[3].rect.x;
  assert.ok(behind === box.bx || behind === box.bx + box.bw - mw, 'a mate behind pins to an end of the box');
  quads.length = 0;
  assert.equal(drawPartyCompassMarks(renderer, [], me, 0, box), 0);
  assert.equal(drawPartyCompassMarks(renderer, [[0, 50]], null, 0, box), 0);
  assert.equal(quads.length, 0);
  const H = src('src/ui/hud.js');
  assert.match(H, /drawPartyCompassMarks\(renderer, party, playerXZ, heading01, \{ bx, by, bw, s \}\);/, 'drawn after the Detect markers on the classic box');
  assert.match(H, /party: party \?\? null,   \/\/ COMPASS-PARTY/, 'and handed to the enhanced skin');
});

const mkEl = () => ({
  className: '', textContent: '', id: '', children: [], dataset: {},
  style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
  classList: {
    _s: new Set(),
    add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); },
    toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); },
  },
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  removeAttribute(a) { delete this.attrs[a]; }, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...c) { this.children = c; }, addEventListener() {},
});
const findAll = (n, cls, out = []) => { if (String(n.className ?? '').split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) findAll(c, cls, out); return out; };

test('COMPASS-PARTY the enhanced strip: a green mark per mate at its bearing, pooled - a mate gone hides a mark, never removes it (mutants: the marks never placed; the pool rebuilt)', async () => {
  const prev = globalThis.document;
  globalThis.document = { createElement: mkEl, createElementNS: () => mkEl(), getElementById: () => null, head: mkEl(), body: mkEl() };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const { clearQuickslots } = await import('../src/systems/quickslots.js');
  clearQuickslots();
  const me = { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null };
  const frame = (party) => drawEnhancedHud(me, 0, 0, { weapon: null, weaponSheathed: true, playerXZ: [0, 0], party });
  try {
    frame([[0, 50], [50, 0]]);
    const root = document.body.children.find((n) => n.className === 'hud');
    let marks = findAll(root, 'hud-party');
    assert.equal(marks.length, 2);
    assert.ok(marks[0].style.cssText.includes(`border-top:5px solid ${PARTY_GREEN_CSS}`), 'the party\'s one green');
    assert.equal(marks[0].style.left, `${(compassMarkerLerp([0, 50], [0, 0], 0) * 100).toFixed(1)}%`);
    assert.equal(marks[1].style.left, `${(Math.min(1, Math.max(0, compassMarkerLerp([50, 0], [0, 0], 0))) * 100).toFixed(1)}%`);
    frame([[0, 50]]);
    marks = findAll(root, 'hud-party');
    assert.equal(marks.length, 2, 'the pool is kept');
    assert.equal(marks[1].style.display, 'none', 'the gone mate\'s mark is hidden');
    frame(null);
    assert.equal(marks[0].style.display, 'none');
    frame([[0, 50], [50, 0]]);
    assert.equal(marks[1].style.display, '', 'and shown again');
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    globalThis.document = prev;
  }
});

test('COMPASS-PARTY the hosts: the open world hands the whole party (the bodies drawn, the rest by their poses), the building and the dungeon the mates standing in them (mutants: a host that hands none)', () => {
  const W = src('src/scenes/world.js');
  assert.match(W, /party: partyCompass\(\),   \/\/ COMPASS-PARTY/);
  assert.match(W, /const partyCompass = \(\) => \(social\?\.party \? partyCompassPoints\(\{\n    bodies: partyOnMaps, others: social\.others\(\)\.filter\(\(m\) => !m\.peers\?\.some\(\(id\) => _hiddenPeers\.has\(id\)\)\), here: playerTravelPixel\(\),/);
  assert.match(W, /pixelCentre: \(px, py\) => \{ const t = state\.pixelTranslation\(px, py\); return \[t\[0\] \+ TERRAIN_SIZE \/ 2, t\[2\] \+ TERRAIN_SIZE \/ 2\]; \},/, 'the middle of the pixel (its terrain spans TERRAIN_SIZE from its translation)');
  assert.match(W, /fromWorld: \(wx, wz\) => state\.localFromWorld\(wx, wz\),/);
  assert.match(src('src/scenes/worldModes.js'), /party: partyCompassPoints\(\{ bodies: \(\) => host\.partyNear\?\.\(\) \?\? \[\] \}\),/);
  assert.match(src('src/scenes/dungeonContext.js'), /party: partyCompassPoints\(\{ bodies: opts\.party \?\? null \}\),/);
});
