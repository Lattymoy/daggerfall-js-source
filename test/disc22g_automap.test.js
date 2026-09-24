// DISC22-G (2026-09-24, Mac: "enhanced dungeon automap is broken and doesn't work properly. This needs to be a
// better enhancement compared to the 3d automap").
//
// WHAT WAS BROKEN, each reproduced here with closed rooms (EM2's pins were all bare floor quads - no ceiling, no
// stair - which is why they passed over all of it):
//   D1 a CEILING counted as a floor (Math.abs of the normal): one room was two storeys, two storeys were four;
//   D2 a flight of STAIRS chained two storeys into one (each step within the headroom of the last);
//   D3 the map opened on Floor 1 whatever storey the player stood on - no caret;
//   D4 it opened on the whole LEVEL fitted to the sheet - a corridor three pixels wide;
//   D5 a doorway into a room not yet seen was inked as solid WALL;
//   D6 every open re-derived every triangle in the level.
// AND WHAT THE 3D MAP HAD THAT THIS DID NOT: notes written with the middle button, teleporter ends joined (or named
// by the storey they lead to), a way in that breathes, and a key that brings you back to where you stand.
//
// Driven through the real floor model (systems/automapFloors.js), the real sheet (ui/automapSheet.js) and the real
// note law (systems/automap.js); the window's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  floorTriangles, deriveFloors, floorAt, floorPlan, splitEdges, storeyOccupancy, planBounds, STOREY_MIN_AREA, FLOOR_MIN_GAP,
} from '../src/systems/automapFloors.js';
import { createAutomapSheet, READABLE_SCALE } from '../src/ui/automapSheet.js';
import { boundarySegments, linkSegments, scaleMinOf } from '../src/ui/inkMap.js';

/** A quad at height y over [x0,x1]x[z0,z1] whose FILE normal looks `ny` (+1 a floor, -1 a ceiling). */
const quad = (key, y, x0, z0, x1, z1, ny = 1) => ({
  key,
  aabb: { min: [x0, y, z0], max: [x1, y, z1] },
  positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  normals: new Float32Array([0, ny, 0, 0, ny, 0, 0, ny, 0, 0, ny, 0]),
  matrix: null,
});
/** A closed room: its floor at y looking up, its ceiling at y + h looking down. */
const room = (key, y, x0, z0, x1, z1, h = 4) => [quad(`${key}f`, y, x0, z0, x1, z1, 1), quad(`${key}c`, y + h, x0, z0, x1, z1, -1)];

test('DISC22-G D1: a ceiling looks down, so it is not a floor - one room is one storey, two stacked rooms two', () => {
  assert.equal(deriveFloors(floorTriangles(room('r', 0, 0, 0, 10, 10))).length, 1, 'the old abs() made this two');
  const two = deriveFloors(floorTriangles([...room('a', 0, 0, 0, 10, 10), ...room('b', 12, 0, 0, 10, 10)]));
  assert.deepEqual(two.map((f) => f.y), [0, 12], 'and this four');
  // the file's facing is TURNED by the placement: a model laid upside down (a 180-degree turn about x) makes its
  // authored ceiling the floor you walk on
  const flipped = { ...quad('u', 0, 0, 0, 10, 10, -1), matrix: [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1] };
  assert.equal(floorTriangles([flipped]).length, 2, 'the placement turns the normal with the face');
  // a row with no normals (a hand-built fixture, a machinery part) keeps EM2's either-way reading
  const bare = { ...quad('n', 4, 0, 0, 10, 10, -1), normals: null };
  assert.equal(floorTriangles([bare]).length, 2);
});

test('DISC22-G D2: a flight of stairs joins two storeys and is neither - the steps no longer chain the floors into one', () => {
  const rows = [...room('lo', 0, 0, 0, 10, 10), ...room('hi', 12, 30, 0, 40, 10)];
  for (let i = 1; i < 24; i++) rows.push(quad(`s${i}`, i * 0.5, 10 + (i - 1) * (20 / 23), 3, 10 + i * (20 / 23), 5));   // 2 m wide, ~0.87 m deep
  const tris = floorTriangles(rows);
  assert.ok(tris.filter((t) => t.y > 0 && t.y < 12).every((t) => t.area * 2 < STOREY_MIN_AREA), 'every step is smaller than a room');
  const floors = deriveFloors(tris);
  assert.equal(floors.length, 2, `the old chain answered one storey at the steps' mean (${floors.map((f) => f.y)})`);
  assert.ok(Math.abs(floors[0].y) < 0.6 && Math.abs(floors[1].y - 12) < 0.6, 'at the rooms\' own heights');
  assert.equal(floorAt(floors, 2), 0); assert.equal(floorAt(floors, 10), 1, 'each step drawn on the storey it is nearest');
  // a real landing half way up, a room's size and a headroom clear of both, IS a place you stand
  const landing = deriveFloors(floorTriangles([...rows, quad('land', 6, 20, 10, 26, 16)]));
  assert.equal(landing.length, 3);
  // a long RAMP votes for nothing (EM2's law, which the anchors now lean on): floors twenty metres apart joined by
  // one 40 m ramp are two storeys - its two great triangles, voting, would be two more
  const ramp = { key: 'ramp', positions: new Float32Array([0, 0, 0, 40, 20, 0, 40, 20, 10, 0, 0, 10]), indices: new Uint16Array([0, 2, 1, 0, 3, 2]), matrix: null };
  assert.equal(deriveFloors(floorTriangles([quad('g', 0, -10, 0, 0, 10), quad('t', 20, 40, 0, 50, 10), ramp])).length, 2);
  // and two big floors a step apart are still one storey (a dais, a sunken hall)
  assert.equal(deriveFloors(floorTriangles([quad('a', 0, 0, 0, 10, 10), quad('b', 1, 10, 0, 20, 10)])).length, 1);
  assert.ok(FLOOR_MIN_GAP > 1);
});

/** A two-storey level: rooms a, b side by side at 0 (b not yet seen), room c at 12. */
const LEVEL = [...room('a', 0, 100, 200, 110, 210), ...room('b', 0, 110, 200, 120, 210), ...room('c', 12, 100, 200, 110, 210)];
const rec = (revealed, extra = {}) => ({ revealed: new Set(revealed), visitedThisRun: new Set(), entranceDiscovered: false, notes: new Map(), teleporters: new Map(), ...extra });
const PAPER = { paperW: 400, paperH: 300, dpr: 1 };
function recordingCtx() {
  const calls = [];
  const state = { font: '', lineWidth: 1 };
  return new Proxy({ calls, measureText: (t) => ({ width: String(t).length * 6 }) }, {
    get: (t, k) => (k in t ? t[k] : k in state ? state[k] : (...args) => { calls.push({ fn: k, args }); }),
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

test('DISC22-G D3: the map opens on the storey the player stands on', () => {
  const up = createAutomapSheet({ record: () => rec(['af', 'cf']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [105, 12, 205], yaw: 0 }) });
  assert.equal(up.floor, 1, 'upstairs, on Floor 2 - the old sheet always said Floor 1');
  const down = createAutomapSheet({ record: () => rec(['af']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [105, 0, 205], yaw: 0 }) });
  assert.equal(down.floor, 0);
});

test('DISC22-G D4: at rest the revealed floor fills the sheet at a readable size, not the whole level', () => {
  // a level 400 m across of which one 10 m room has been seen
  const rows = [...room('seen', 0, 0, 0, 10, 10), quad('far', 0, 390, 390, 400, 400)];
  const s = createAutomapSheet({ record: () => rec(['seenf']), model: () => ({ rows }), player: () => ({ feet: [5, 0, 5], yaw: 0 }) });
  const size = s.size();
  const limits = { mapW: size.width, mapH: size.height, paperW: 400, paperH: 300 };
  const home = s.homeView(limits);
  assert.ok(scaleMinOf(limits) < 1, 'the whole-level fit is under a pixel a metre');
  assert.ok(home.scale >= READABLE_SCALE, `the rest view reads (${home.scale})`);
  assert.ok(home.scale > 20 * scaleMinOf(limits), 'twenty times nearer than the old fit');
  // and the window opens on it: the first layout asks the sheet (the sheet it opens on never passed _selectSheet)
  const hm = readFileSync(new URL('../src/ui/heldMap.js', import.meta.url), 'utf8');
  assert.match(hm, /const home = this\._sheet\?\.homeView\?\.\(limits\) \?\? \{ ox: 0, oy: 0, scale: scaleMinOf\(limits\) \};/);
});

test('DISC22-G D5: an edge onto real floor not yet seen is an OPENING, not a wall', () => {
  const floors = deriveFloors(floorTriangles(LEVEL));
  const bounds = planBounds(floorTriangles(LEVEL));
  const full = storeyOccupancy(LEVEL, floors, 0, bounds);
  const only = (keys) => LEVEL.filter((r) => keys.includes(r.key));
  const half = floorPlan(only(['af']), 0, { segments: boundarySegments, link: linkSegments, floors, bounds, full });
  assert.ok(half.openChains.length >= 1, 'the doorway into b is open');
  const xs = half.openChains.flat().map((p) => p.x);
  assert.ok(xs.every((x) => Math.abs(x - 110) < 1.01), `the opening is the shared edge at x 110 (${[...new Set(xs)]})`);
  assert.ok(half.chains.flat().every((p) => !(Math.abs(p.x - 110) < 0.5 && p.y > 201 && p.y < 209)), 'and it is not also inked as wall');
  const whole = floorPlan(only(['af', 'bf']), 0, { segments: boundarySegments, link: linkSegments, floors, bounds, full });
  assert.equal(whole.openChains.length, 0, 'nothing left to find on this storey');
  // the split is the whole boundary, partitioned
  const inside = (x, y) => full.at(x, y) && x < full.w / 2;
  const { walls, openings } = splitEdges(inside, (x, y) => full.at(x, y), full.w, full.h);
  assert.equal(walls.length + openings.length, boundarySegments(inside, full.w, full.h).length);
  // and the painter draws them broken
  const s = createAutomapSheet({ record: () => rec(['af']), model: () => ({ rows: LEVEL }), player: () => ({ feet: [105, 0, 205], yaw: 0 }) });
  const ctx = recordingCtx();
  s.paintStatic(ctx, { model: s.ensure(), view: { ox: 0, oy: 0, scale: 8 }, ...PAPER });
  assert.ok(ctx.calls.some((c) => c.fn === 'setLineDash' && c.args[0].length), 'dashed');
});

test('DISC22-G D6: a level\'s triangles and storeys are derived once, whoever opens the map', () => {
  const r = quad('x', 0, 0, 0, 10, 10);
  assert.equal(floorTriangles([r])[0], floorTriangles([r])[0], 'the row\'s triangles are kept');
  const rows = [...LEVEL];
  const a = createAutomapSheet({ record: () => rec([]), model: () => ({ rows }) });
  const b = createAutomapSheet({ record: () => rec([]), model: () => ({ rows }) });
  assert.equal(a.floors(), b.floors(), 'the second open reuses the first\'s storeys');
});

test('DISC22-G: the middle button writes a note on revealed floor, edits it, and an empty answer takes it away', () => {
  const r = rec(['af']);
  let answer = 'the lever';
  const asked = [];
  const s = createAutomapSheet({ record: () => r, model: () => ({ rows: LEVEL }), player: () => ({ feet: [105, 0, 205], yaw: 0 }),
    askText: (initial, done) => { asked.push(initial); done(answer); } });
  const view = { ox: 0, oy: 0, scale: 8 };
  s.paintOverlay(recordingCtx(), { view, ...PAPER });   // the sheet learns the view it is pointed through
  // room a spans plan x 1..11 (west edge 99), plan y from the north edge 211: z 205 -> 6
  const px = (105 - 99) * 8, py = (211 - 205) * 8;
  assert.equal(s.mark(px, py), true);
  assert.equal(r.notes.size, 1);
  const [id, n] = [...r.notes][0];
  assert.equal(n.note, 'the lever');
  assert.ok(Math.abs(n.position[1] - 0.7) < 1e-6, 'pinned 0.7 off the storey\'s floor, as DFU pins it off the face');
  // the same spot again edits it
  answer = 'the lever, pulled';
  s.paintOverlay(recordingCtx(), { view, ...PAPER });
  assert.equal(s.mark(px, py), true);
  assert.deepEqual(asked, ['', 'the lever']);
  assert.equal(r.notes.get(id).note, 'the lever, pulled');
  // an empty answer removes it
  answer = '';
  s.mark(px, py);
  assert.equal(r.notes.size, 0);
  // a cancelled new note is never made, and off the revealed floor nothing is asked
  answer = null;
  s.mark(px, py);
  assert.equal(r.notes.size, 0);
  const before = asked.length;
  assert.equal(s.mark((115 - 99) * 8, py), false, 'room b has not been seen');
  assert.equal(asked.length, before);
});

test('DISC22-G: teleporter ends are joined on one storey and name the other storey otherwise; the way in breathes; Home comes back', () => {
  const teleporters = new Map([
    ['same', { entrance: { pos: [102, 0, 202] }, exit: { pos: [108, 0, 208] } }],
    ['up', { entrance: { pos: [104, 0, 204] }, exit: { pos: [104, 12, 204] } }],
  ]);
  const s = createAutomapSheet({ record: () => rec(['af', 'cf'], { teleporters, entranceDiscovered: true }), model: () => ({ rows: LEVEL }),
    player: () => ({ feet: [105, 0, 205], yaw: 0 }), startMarker: { x: 101, y: 0, z: 201 } });
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view: { ox: 0, oy: 0, scale: 8 }, ...PAPER, pulse: 0 });
  assert.ok(ctx.calls.some((c) => c.fn === 'setLineDash' && c.args[0].length), 'the pair on this storey is joined');
  assert.ok(ctx.calls.some((c) => c.fn === 'fillText' && c.args[0] === 'to Floor 2'), 'the end that leads upstairs says so');
  assert.equal(s.breathes(), true, 'the way in is on the sheet, so the window repaints on its beat');
  s.setFloor(1);
  assert.equal(s.breathes(), false);
  assert.equal(s.key('Home'), 'home', 'the window resets its view');
  assert.equal(s.floor, 0, 'and the storey comes back to the player\'s');
  const hm = readFileSync(new URL('../src/ui/heldMap.js', import.meta.url), 'utf8');
  assert.match(hm, /if \(sheetKey === 'home'\) this\._setView\(this\._sheet\?\.homeView\?\.\(this\._limits\(\)\) \?\? this\._view\);/);
  assert.match(hm, /this\._selected \|\| this\._party\.length \|\| this\._sheet\?\.breathes\?\.\(\)/);
  assert.match(hm, /askText: \(initial, done\) => this\._askText\(initial, done\)/);
});
