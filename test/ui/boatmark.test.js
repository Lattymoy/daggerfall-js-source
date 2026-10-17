// BOAT-MARK (2026-10-01, the field: a Large Boat put in from its deed, her owner killed aboard her and woken at a
// temple - "is there any way to know where your ships are located at?", then "I want to build a compass icon that
// tracks your boat").
//
// YOUR BOATS ON THE COMPASS. A Large Boat's deed is spent on placing, the boat is kept where she was left, and the
// compass marked the sea's ships alone. Now:
//   - every boat Come Sail Away keeps for me is a point (ui/boatMarks.js boatCompassPoints): in sight where she floats;
//     out of sight where she floats while that stands on her own pixel in this frame, else her pixel's middle (a
//     dungeon's boat always); never the boat at my helm, nor one I stand at;
//   - both compasses draw each as a little boat - a sail over a hull - in one teal: the classic box (ui/hud/hud.js
//     drawBoatCompassMarks) and the enhanced strip (ui/enhanced/enhancedHud.js);
//   - the street's host hands them on the street alone, under the travel view too (scenes/world.js), line-neutral.
// bible/03-World/Come-Sail-Away.md, BOAT-MARK.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BOAT_MARK_CSS, BOAT_MARK_RGB, BOAT_MARK_NEAR_M, BOAT_PIXEL_SLACK_M, BOAT_GLYPH_W, BOAT_GLYPH_ROWS, BOAT_GLYPH_SVG,
  BOAT_GLYPH_URL, boatMarkAt, boatCompassPoints,
} from '../../src/ui/boatMarks.js';
import { drawBoatCompassMarks, compassMarkerLerp } from '../../src/ui/hud/hud.js';
import { NODE_MARK_CSS } from '../../src/ui/nodeMarks.js';
import { QUEST_MARK_CSS } from '../../src/ui/quest/questMarks.js';
import { PARTY_GREEN_CSS } from '../../src/net/social.js';
import { SHIP_MARK_CSS } from '../../src/ui/enhanced/enhancedHud.js';
import { GATE_RING_CSS } from '../../src/ui/gate/gateMapMark.js';
import { StreamingWorldState } from '../../src/world/streamingWorld.js';
import { TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const TS = TERRAIN_SIZE;
/** A frame far from the origin, so a mark that forgot the translation stands nowhere near: pixel (px, py)'s corner
 *  is (px * TS - 5000, 0, -py * TS + 3000). */
const WORLD = Object.freeze({ pixelTranslation: (px, py, out = [0, 0, 0]) => { out[0] = px * TS - 5000; out[1] = 0; out[2] = -py * TS + 3000; return out; } });
const corner = (px, py) => WORLD.pixelTranslation(px, py, [0, 0, 0]);
const boat = ({ at = [0, 0, 0], active = false, pixel = null, inside = false } = {}) => ({
  GameObject: { position: at, activeSelf: active }, MapPixel: pixel, inside,
});

test('BOAT-MARK boatMarkAt: a boat in sight where she floats, whatever her pixel; one out of sight where she floats while that stands on her pixel (its slack about it), else her pixel\'s middle; a dungeon\'s boat always the middle; one with no pixel out of sight, or a broken place in sight, none (mutants: the live place always; the middle always; the slack dropped; the dungeon\'s boat at her place)', () => {
  const [x0, , z0] = corner(10, 20);
  const mid = [x0 + TS / 2, z0 + TS / 2];
  // in sight: where she floats, even off her pixel (the lost boat stands where she is drawn)
  assert.deepEqual(boatMarkAt(boat({ at: [x0 + 30, 5, z0 + 40], active: true, pixel: { X: 10, Y: 20 } }), WORLD, TS), [x0 + 30, z0 + 40]);
  assert.deepEqual(boatMarkAt(boat({ at: [99999, 0, -99999], active: true, pixel: { X: 10, Y: 20 } }), WORLD, TS), [99999, -99999]);
  // out of sight on her pixel: where she floats
  assert.deepEqual(boatMarkAt(boat({ at: [x0 + 100, 0, z0 + 700], pixel: { X: 10, Y: 20 } }), WORLD, TS), [x0 + 100, z0 + 700]);
  // ...just over its edge, within the slack: still where she floats
  assert.deepEqual(boatMarkAt(boat({ at: [x0 - BOAT_PIXEL_SLACK_M + 1, 0, z0 + TS + BOAT_PIXEL_SLACK_M - 1], pixel: { X: 10, Y: 20 } }), WORLD, TS), [x0 - BOAT_PIXEL_SLACK_M + 1, z0 + TS + BOAT_PIXEL_SLACK_M - 1]);
  // ...past it on either axis (a frame a load never carried her into): the pixel's middle
  assert.deepEqual(boatMarkAt(boat({ at: [x0 - BOAT_PIXEL_SLACK_M - 1, 0, z0 + 10], pixel: { X: 10, Y: 20 } }), WORLD, TS), mid);
  assert.deepEqual(boatMarkAt(boat({ at: [x0 + 10, 0, z0 + TS + BOAT_PIXEL_SLACK_M + 1], pixel: { X: 10, Y: 20 } }), WORLD, TS), mid);
  assert.deepEqual(boatMarkAt(boat({ at: [NaN, 0, 0], pixel: { X: 10, Y: 20 } }), WORLD, TS), mid, 'no place at all: the middle');
  // a dungeon's boat stands in the dungeon's own frame: her pixel's middle, in sight or not, wherever her numbers say
  assert.deepEqual(boatMarkAt(boat({ at: [x0 + 100, 0, z0 + 100], pixel: { X: 10, Y: 20 }, inside: true }), WORLD, TS), mid);
  assert.deepEqual(boatMarkAt(boat({ at: [x0 + 100, 0, z0 + 100], active: true, pixel: { X: 10, Y: 20 }, inside: true }), WORLD, TS), mid);
  // none
  assert.equal(boatMarkAt(boat({ at: [1, 0, 2], pixel: null }), WORLD, TS), null, 'out of sight with no pixel');
  assert.equal(boatMarkAt(boat({ at: [NaN, 0, 2], active: true, pixel: { X: 10, Y: 20 } }), WORLD, TS), null, 'in sight with a broken place');
  assert.equal(boatMarkAt(boat({ pixel: { X: 1.5, Y: 2 } }), WORLD, TS), null, 'a pixel that is no pixel');
  const out = [0, 0];
  assert.equal(boatMarkAt(boat({ at: [3, 0, 4], active: true }), WORLD, TS, out), out, 'written into the caller\'s pair');
});

test('BOAT-MARK boatMarkAt over the REAL streaming world: a boat out of sight three pixels east and two north of the pixel the world was started on is marked at that pixel\'s middle - dead ahead facing north-east, behind facing south-west; and where she floats in the world\'s frame once the frame has moved (mutants: the translation dropped; the axes crossed)', () => {
  const w = new StreamingWorldState();
  w.init(200, 150);
  const at = boatMarkAt(boat({ at: [NaN, 0, NaN], pixel: { X: 203, Y: 148 } }), w, TS);
  assert.deepEqual(at, [3 * TS + TS / 2, 2 * TS + TS / 2]);
  const me = [TS / 2, TS / 2];   // the middle of the pixel the world started on
  const ne = Math.atan2(3, 2) / (Math.PI * 2);   // the bearing to her, as heading01 counts it (0 north, clockwise)
  assert.ok(Math.abs(compassMarkerLerp(at, me, ne) - 0.5) < 1e-9, 'dead ahead');
  const behind = compassMarkerLerp(at, me, ne + 0.5);
  assert.ok(behind <= 0 || behind >= 1, 'behind: off the strip, pinned to an end by the draw');
  // the frame recentred (the streaming world's compensation): her place as the frame now reads it still stands on her pixel
  w.compensation = [-2000, 0, 1500];
  const c = w.pixelTranslation(203, 148);
  assert.deepEqual(boatMarkAt(boat({ at: [c[0] + 50, 0, c[2] + 60], pixel: { X: 203, Y: 148 } }), w, TS), [c[0] + 50, c[2] + 60]);
});

test('BOAT-MARK boatCompassPoints: every boat of mine marked, the one at my helm and any within BOAT_MARK_NEAR_M of my feet left out; nothing, or no feet, null; one list refilled, never a new one a frame (mutants: the helm\'s boat marked; the near boat marked; the near test on the wrong axis; a new list each call)', () => {
  const [x0, , z0] = corner(10, 20);
  const helm = boat({ at: [x0 + 5, 0, z0 + 5], active: true, pixel: { X: 10, Y: 20 } });
  const near = boat({ at: [x0 + 300 + BOAT_MARK_NEAR_M - 1, 0, z0 + 300], active: true, pixel: { X: 10, Y: 20 } });
  const moored = boat({ at: [x0 + 300, 0, z0 + 300 + BOAT_MARK_NEAR_M + 1], active: true, pixel: { X: 10, Y: 20 } });
  const far = boat({ at: [NaN, 0, NaN], pixel: { X: 40, Y: 5 } });
  const feet = [x0 + 300, 7, z0 + 300];
  const pts = boatCompassPoints([helm, near, moored, far], helm, feet, WORLD, TS);
  const [fx, , fz] = corner(40, 5);
  assert.deepEqual(pts?.map((p) => [...p]), [[x0 + 300, z0 + 300 + BOAT_MARK_NEAR_M + 1], [fx + TS / 2, fz + TS / 2]]);
  assert.equal(boatCompassPoints([helm, near, moored, far], null, feet, WORLD, TS)?.length, 3, 'not at her helm: she is marked');
  assert.equal(boatCompassPoints([near], null, [feet[0], 9999, feet[2]], WORLD, TS), null, 'flat: my height is no distance');
  assert.equal(boatCompassPoints([], null, feet, WORLD, TS), null);
  assert.equal(boatCompassPoints(null, null, feet, WORLD, TS), null);
  assert.equal(boatCompassPoints([moored], null, null, WORLD, TS), null, 'no feet');
  // AUDIT NODE-MARKS' lesson: the player's feet are the motor's Float32Array, never a plain array
  assert.deepEqual(boatCompassPoints([near, moored], null, Float32Array.from(feet), WORLD, TS)?.map((p) => [...p]), [[x0 + 300, z0 + 300 + BOAT_MARK_NEAR_M + 1]], 'typed feet');
  assert.equal(boatCompassPoints([helm], helm, feet, WORLD, TS), null, 'only the helm\'s');
  const a = boatCompassPoints([moored], null, feet, WORLD, TS);
  const b = boatCompassPoints([moored, far], null, feet, WORLD, TS);
  assert.equal(a, b, 'one list, refilled');
  assert.equal(b?.length, 2);
});

test('BOAT-MARK the colour and the glyph: one teal, clear of every other mark on the strip (the party, the Detect markers, the gate, the quest, the three ships, the five professions) by at least NODE-MARKS\' own 75; the floats are the hex; the classic glyph a sail over a hull within its width, the enhanced one the same boat in the same teal, edged dark (mutants: the floats off the hex; a run past the glyph\'s width)', () => {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const others = {
    party: PARTY_GREEN_CSS, detect: '#9a1808', gate: GATE_RING_CSS, quest: QUEST_MARK_CSS,
    ...Object.fromEntries(Object.entries(SHIP_MARK_CSS).map(([k, v]) => [`ship ${k}`, v])),
    ...Object.fromEntries(Object.entries(NODE_MARK_CSS).map(([k, v]) => [`node ${k}`, v])),
  };
  for (const [o, hex] of Object.entries(others)) assert.ok(Math.hypot(...rgb(BOAT_MARK_CSS).map((v, i) => v - rgb(hex)[i])) >= 75, `beside the ${o}'s ${hex}`);
  assert.equal(`#${BOAT_MARK_RGB.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`, BOAT_MARK_CSS);
  assert.equal(BOAT_MARK_RGB[3], 1);
  // the classic glyph: every run inside its width; the top a sail (one pixel wide, widening), the foot a hull wider than it
  for (const row of BOAT_GLYPH_ROWS) for (const [from, len] of row) assert.ok(from >= 0 && len > 0 && from + len <= BOAT_GLYPH_W);
  const width = (row) => row.reduce((n, [, len]) => n + len, 0);
  assert.equal(width(BOAT_GLYPH_ROWS[0]), 1, 'the masthead');
  assert.equal(width(BOAT_GLYPH_ROWS[3]), BOAT_GLYPH_W, 'the deck, the glyph\'s whole width');
  assert.ok(width(BOAT_GLYPH_ROWS.at(-1)) < BOAT_GLYPH_W, 'the keel narrower than the deck');
  // the enhanced glyph: the teal, a dark edge, and its url the svg itself
  assert.match(BOAT_GLYPH_SVG, new RegExp(`fill="${BOAT_MARK_CSS}"`));
  assert.match(BOAT_GLYPH_SVG, /stroke="#0a0c11"/);
  assert.equal(decodeURIComponent(BOAT_GLYPH_URL.slice('url("data:image/svg+xml;utf8,'.length, -2)), BOAT_GLYPH_SVG);
});

test('BOAT-MARK the classic compass: the glyph per boat, its foot on the box\'s top edge, at its bearing, clamped, every run in the boats\' teal; nothing without points or my own place (mutants: the bearing ignored; the glyph hung below the edge; a row dropped)', () => {
  const quads = [];
  const renderer = { drawScreenQuad: (tex, rect, uv, col) => quads.push({ rect, col: [...col] }) };
  const box = { bx: 500, by: 400, bw: 100, s: 2 };
  const me = [0, 0];
  const runs = BOAT_GLYPH_ROWS.reduce((n, row) => n + row.length, 0);
  assert.equal(drawBoatCompassMarks(renderer, [[30, 30], [0, -40]], me, 0, box), 2);
  assert.equal(quads.length, 2 * runs, 'every run of the glyph, a boat');
  const mw = BOAT_GLYPH_W * box.s;
  const left = (xz) => box.bx + (box.bw - mw) * Math.min(1, Math.max(0, compassMarkerLerp(xz, me, 0)));
  const first = quads.slice(0, runs);
  assert.ok(first.every((q) => q.col.every((v, i) => v === BOAT_MARK_RGB[i])), 'in the teal');
  assert.equal(Math.min(...first.map((q) => q.rect.x)), left([30, 30]), 'at its bearing');
  assert.equal(Math.max(...first.map((q) => q.rect.x + q.rect.w)), left([30, 30]) + mw, 'its whole width');
  assert.equal(Math.max(...first.map((q) => q.rect.y + q.rect.h)), box.by, 'its foot on the box\'s top edge');
  assert.equal(Math.min(...first.map((q) => q.rect.y)), box.by - BOAT_GLYPH_ROWS.length * box.s, 'a row a native pixel');
  // the deck row spans the glyph
  const deck = first.find((q) => q.rect.w === BOAT_GLYPH_W * box.s);
  assert.ok(deck && deck.rect.y === box.by - (BOAT_GLYPH_ROWS.length - 3) * box.s);
  const behind = Math.min(...quads.slice(runs).map((q) => q.rect.x));
  assert.ok(behind === box.bx || behind === box.bx + box.bw - mw, 'a boat behind pins to an end of the box');
  quads.length = 0;
  assert.equal(drawBoatCompassMarks(renderer, null, me, 0, box), 0);
  assert.equal(drawBoatCompassMarks(renderer, [[1, 1]], null, 0, box), 0);
  assert.equal(quads.length, 0);
});

test('BOAT-MARK the classic compass\'s order: the boats are drawn after the nodes and before the Detect markers, the party and the ships, which stand over them; drawHud hands the boats to the enhanced skin (mutants: the boats never drawn; drawn again over the ships)', () => {
  const H = src('src/ui/hud/hud.js');
  const body = H.slice(H.indexOf('export function drawHud('), H.indexOf('export function drawPartyCompassMarks('));
  const boatsAt = body.indexOf('drawBoatCompassMarks(renderer, boats, playerXZ, heading01, { bx, by, bw, s });');
  assert.ok(boatsAt > body.indexOf('drawNodeCompassMarks(renderer, nodes,'), 'over the nodes');
  for (const later of ['if (detected && detected.length && playerXZ)', 'drawPartyCompassMarks(renderer, party,', 'drawShipCompassMarks(renderer, ships,']) assert.ok(boatsAt < body.indexOf(later), `before ${later}`);
  assert.equal(body.split('drawBoatCompassMarks(').length, 2, 'drawn once - never again over the live marks');
  assert.match(H, /nodes = null, boats = null, largeHud = null/);
  assert.match(H, /boats: boats \?\? null,/);
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
  append(...c) { for (const n of c) { if (n && typeof n === 'object') n.parentNode = this; } this.children.push(...c); }, appendChild(c) { this.append(c); return c; },
  insertBefore(n, ref) { const i = ref ? this.children.indexOf(ref) : -1; n.parentNode = this; if (i < 0) this.children.push(n); else this.children.splice(i, 0, n); return n; },
  get nextSibling() { const sib = this.parentNode?.children ?? []; return sib[sib.indexOf(this) + 1] ?? null; },
  replaceChildren(...c) { this.children = c; }, addEventListener() {},
});
const findAll = (n, cls, out = []) => { if (String(n.className ?? '').split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) findAll(c, cls, out); return out; };

test('BOAT-MARK the enhanced strip: a boat glyph per boat at its bearing on the strip\'s middle, pooled - a boat gone hides its mark, never removes it; a bearing unchanged is not written again (mutants: the marks never placed; the pool rebuilt; the bearing ignored)', async () => {
  const prev = globalThis.document;
  globalThis.document = { createElement: mkEl, createElementNS: () => mkEl(), getElementById: () => null, head: mkEl(), body: mkEl() };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../../src/ui/enhanced/enhancedHud.js');
  const { clearQuickslots } = await import('../../src/systems/quickslots.js');
  clearQuickslots();
  const me = { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null };
  const frame = (boats, heading = 0) => drawEnhancedHud(me, heading, 0, { weapon: null, weaponSheathed: true, playerXZ: [0, 0], boats });
  try {
    frame([[0, 50], [50, 0]]);
    const root = document.body.children.find((n) => n.className === 'hud');
    let marks = findAll(root, 'hud-boat');
    assert.equal(marks.length, 2);
    assert.equal(marks[0].style.left, `${(compassMarkerLerp([0, 50], [0, 0], 0) * 100).toFixed(1)}%`, 'ahead: the middle');
    assert.equal(marks[1].style.left, `${(Math.min(1, compassMarkerLerp([50, 0], [0, 0], 0)) * 100).toFixed(1)}%`, 'east, facing north: the right end');
    assert.match(marks[0].style.cssText, /top:50%/);
    assert.ok(marks[0].style.cssText.includes(BOAT_GLYPH_URL), 'the boat\'s own glyph');
    frame([[-50, 0]]);
    marks = findAll(root, 'hud-boat');
    assert.equal(marks.length, 2, 'the pool is kept');
    assert.equal(marks[0].style.left, '0.0%', 'west, facing north: the left end');
    assert.equal(marks[1].style.display, 'none', 'the gone boat\'s mark hidden');
    frame(null);
    assert.equal(marks[0].style.display, 'none');
    frame([[0, 50]]);
    assert.equal(marks[0].style.display, '', 'shown again');
    marks[0].style.left = '50%';   // what a browser reads back for '50.0%'
    frame([[0, 50]]);
    assert.equal(marks[0].style.left, '50%', 'the same bearing: not written again');
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    globalThis.document = prev;
  }
});

test('BOAT-MARK the street\'s host by source: my boats from Come Sail Away\'s own list, the boat under me (my helm\'s) left out, my feet and the streaming world\'s own frame, on the street alone (the travel view is the street\'s); the runtime keeps what the mark reads; every edit to world.js line-neutral (the import folded beside the quest marks\', the door beside the ships\')', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /ships: navalOn\(\) && _mode\(\) === 'exterior' \? naval\?\.compassShips\(\) \?\? null : null, boats: csaRuntime && _mode\(\) === 'exterior' \? boatCompassPoints\(csaRuntime\.AllBoats, csaBoatUnderMe\(\), enchantFeet\(\), state, TERRAIN_SIZE\) : null,/);
  assert.match(w, /^import \{ marksOn, questMapMarks \} from '\.\.\/ui\/quest\/questMarks\.js'; import \{ boatCompassPoints \} from '\.\.\/ui\/boatMarks\.js';/m);
  assert.match(w, /const csaBoatUnderMe = \(\) => \(csaRuntime\?\.isSailing\(\) \? csaRuntime\.state\.CurrentBoat : null\) \?\? csaAboard\.aboard\?\.boat \?\? null;/, 'the boat at my helm');
  assert.match(w, /const state = new StreamingWorldState\(/, 'the streaming world the mark reads its frame from');
  // what the mark reads off a boat is the runtime's own: her pixel, her dungeon flag, whether she stands in sight
  const csa = src('src/systems/comeSailAway/comeSailAway.js');
  assert.match(csa, /pixelsApart\(deps\.currentMapPixel\(\), allBoat2\.MapPixel\) > 1/, 'out of sight past a pixel: the mark\'s "in sight" is hers');
  assert.match(csa, /MapPixel: b\.MapPixel \? \{ X: b\.MapPixel\.X, Y: b\.MapPixel\.Y \} : null,/, 'her pixel saved with her');
  assert.match(csa, /if \(ridesTheWorld\(allBoat\)\) OnPositionUpdateBoat\(allBoat, offset\);/, 'every boat out of sight rides the recentres');
  assert.match(csa, /const ridesTheWorld = \(boat\) => !boat\.inside \|\| boat\.GameObject\.activeSelf;/, 'a dungeon\'s boat out of sight does not');
});
