// FIELD BUGS 2026-10-19f, FINDME-TOWN (a player's private report: the town map's Find me never finds you). The held map's
// Find me (ui/heldMap.js `_findMe`, FINDME; kept on the town's sheet by FINDME-SHEET) knew the bay alone: it aimed at the
// player's WORLD pixel, and no town door hands one, so it read the window's stand-in - the bay's middle pixel, (500, 250) -
// as a spot on the town's streets and every press landed on the town's right-hand edge, wherever the player stood; and
// the red cross was drawn by the bay's overlay alone. Now each sheet finds the player in its own space (`findMe`) and
// says where they stand (`me`), and the window blinks its cross there: on the streets the player's own caret, at street
// zoom; on the dungeon's plan its own Me; on the bay the pixel, as it was. A window with no player on its sheet finds
// nothing - a missing position is never read as one.
//
// Every window here is built through its real door (ui/town/townMapDoor.js createTownMapWindow, ui/automap/automapDoor.js
// createAutomapWindow, the held map's own constructor for the bay) and pressed through the real Find me button.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTownMapWindow } from '../../../src/ui/town/townMapDoor.js';
import { createAutomapWindow } from '../../../src/ui/automap/automapDoor.js';
import { HeldMapWindow } from '../../../src/ui/heldMap.js';
import { TOWN_PEN, WORLD_PER_PX, BLOCK_PX } from '../../../src/ui/ink/inkTown.js';
import { HOUSE_SET } from '../../../src/ui/town/townQuarters.js';
import { toPaper, CARET_R } from '../../../src/ui/ink/inkMap.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { resetTravelMapState } from '../../../src/systems/travel/travelMapState.js';
import { setPref } from '../../../src/systems/uiPrefs.js';

/** Just enough document for the chrome - and every element it made, so a pin can find the Find me button and press it. */
function fakeDocument() {
  const made = [];
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      append(...k) { n.children.push(...k); }, appendChild(k) { n.children.push(k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelector: () => null, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; }, removeAttribute() {},
      getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, top: 0 }), focus() {}, blur() {},
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    made.push(n);
    return n;
  };
  return { made, createElement: () => node(), createElementNS: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
function withDocument(fn) {
  resetTravelMapState();
  setPref('skin', 'enhanced');
  globalThis.document = fakeDocument();
  globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
  try { return fn(globalThis.document); } finally { delete globalThis.document; setPref('dungeonMap3d', true); }
}
/** A canvas that writes down every call with the pens it was made in. */
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
/** The window's own paint, onto a recording canvas. */
const paintOf = (win) => { const ctx = recordingCtx(); win._chrome.ink.getContext = () => ctx; win._staticKey = ''; win._paint(); delete win._chrome.ink.getContext; return ctx.calls; };
/** FINDME's cross, as painted: its two full-width strokes' paper lines - {x, y}, or null where none was drawn. */
const CROSS_PEN = 'rgba(200,24,24,0.95)';
function crossOf(calls) {
  const pen = calls.filter((c) => c.strokeStyle === CROSS_PEN && (c.fn === 'moveTo' || c.fn === 'lineTo'));
  if (!pen.length) return null;
  assert.equal(pen.length, 4, 'one horizontal stroke and one vertical, edge to edge');
  const [h0, h1, v0, v1] = pen.map((c) => c.args);
  assert.equal(h0[1], h1[1]); assert.equal(v0[0], v1[0]);
  return { x: v0[0], y: h0[1] };
}
/** The town plan's own caret for the player, as painted (yaw 0: its tip CARET_R straight up the paper from its middle). */
function caretOf(calls) {
  const tips = calls.filter((c) => c.fn === 'moveTo' && c.fillStyle === TOWN_PEN.caret && c.strokeStyle === TOWN_PEN.halo);
  assert.ok(tips.length >= 1, 'the town plan inks the player\'s caret');
  const [x, y] = tips.at(-1).args;
  return { x, y: y + CARET_R };
}
/** Up and open: the sheet risen into its map phase. Quarter-beat ticks from here keep the blink off its edges. */
const raise = (win) => { for (let i = 0; i < 21; i++) win.tick(0.05); assert.equal(win._phase, 'map'); return win; };
/** THE Find me button, pressed - the chrome's own, as a player presses it. */
const pressFindMe = (doc) => { const b = doc.made.find((n) => n.className === 'act hmfindme'); assert.ok(b?.onclick, 'the Find me button'); b.onclick(); };

/** A block's FLD grid: a house in its middle, the street round it. */
function houseBlock() {
  const g = new Uint8Array(BLOCK_PX * BLOCK_PX);
  for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) g[y * BLOCK_PX + x] = HOUSE_SET[0];
  return g;
}
/** A town of gw x gh blocks, a house in each, the player standing at (x, z) metres in the location's frame - handed as world.js's
 *  toggleExteriorAutomap hands it (`local[0] / WORLD_PER_PX`, `local[2] / WORLD_PER_PX`), and no `travel` bag: no world
 *  position at all, as on both hosts. */
function town(gw, gh, at, extra = {}) {
  const blocks = [];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) blocks.push({ x, y, autoMap: houseBlock(), landmark: null });
  return createTownMapWindow({
    locationName: 'Gothway Garden', gridW: gw, gridH: gh, blocks, buildings: () => [], discovered: () => [],
    playerPos: () => [at?.[0] ?? 0, 0, at?.[1] ?? 0], playerYaw: () => 0,
    ...(at ? { townPlayer: () => ({ x: at[0] / WORLD_PER_PX, y: at[1] / WORLD_PER_PX, yaw: 0 }) } : {}),
    ...extra,
  });
}

test('FINDME-TOWN: Find me on the town map glides to the player\'s own caret - in opposite corners of a town and in its middle, each on the paper and as centred as the town\'s edges allow, at street zoom - and blinks the cross through it (mutants: the bay\'s path on every sheet, the cross the bay\'s alone, the sheet\'s y unflipped, the street zoom, the blink)', () => withDocument((doc) => {
  for (const [gw, gh] of [[8, 8], [4, 4]]) {
    const W = gw * BLOCK_PX * WORLD_PER_PX, H = gh * BLOCK_PX * WORLD_PER_PX;
    const goals = {};
    for (const [where, at] of [['south-west corner', [10, 10]], ['north-east corner', [W - 10, H - 10]], ['middle', [W / 2, H / 2]]]) {
      doc.made.length = 0;
      const win = raise(town(gw, gh, at));
      assert.ok(win instanceof HeldMapWindow);
      assert.equal(win._slot.live, 'town', 'the streets are up');
      const rest = { ...win._goal };
      pressFindMe(doc);
      assert.equal(win._findMeT, 3, `${gw}x${gh}, ${where}: the cross's three seconds`);
      win.tick(0.25);   // the glide arrives (a quarter second is past its ease)
      assert.deepEqual(win._view, win._goal);
      const lim = win._limits();
      // the caret the plan itself inks, under the view Find me landed on
      const first = paintOf(win);
      win.tick(0.25);
      const second = paintOf(win);
      const caret = caretOf(first);
      assert.deepEqual(caretOf(second), caret, 'the player has not moved');
      assert.ok(caret.x >= 0 && caret.x <= lim.paperW && caret.y >= 0 && caret.y <= lim.paperH, `${gw}x${gh}, ${where}: the caret is on the paper (${caret.x.toFixed(1)}, ${caret.y.toFixed(1)})`);
      // as centred as the clamp allows: on each axis the caret is at the paper's middle, or the view stands against the
      // town's own edge on the caret's side of it
      const g = win._goal, visW = lim.paperW / g.scale, visH = lim.paperH / g.scale;
      const axis = (c, mid, o, vis, map) => Math.abs(c - mid) < 1e-6 || (c < mid ? Math.abs(o) < 1e-6 : Math.abs(o - (map - vis)) < 1e-6);
      assert.ok(axis(caret.x, lim.paperW / 2, g.ox, visW, lim.mapW), `${gw}x${gh}, ${where}: across, the caret is centred or the town's edge is the paper's`);
      assert.ok(axis(caret.y, lim.paperH / 2, g.oy, visH, lim.mapH), `${gw}x${gh}, ${where}: down, the caret is centred or the town's edge is the paper's`);
      if (where === 'middle') assert.ok(Math.abs(caret.x - lim.paperW / 2) < 1e-6 && Math.abs(caret.y - lim.paperH / 2) < 1e-6, 'in the middle of the town: dead centre');
      goals[where] = caret;
      assert.ok(rest.scale < win._goal.scale, 'in from the whole town');
      assert.ok(Math.abs(Math.min(lim.paperW, lim.paperH) / win._goal.scale - 2 * win._sheet.blockPx) < 1e-9, `${gw}x${gh}, ${where}: street zoom - two blocks across the paper's short side (FIND_ME_BLOCKS)`);
      // THE CROSS, through the caret - blinking: on in one quarter second, off in the next
      const crosses = [crossOf(first), crossOf(second)];
      assert.equal(crosses.filter(Boolean).length, 1, `${gw}x${gh}, ${where}: the cross blinks`);
      const cross = crosses.find(Boolean);
      assert.ok(Math.abs(cross.x - caret.x) < 1e-6 && Math.abs(cross.y - caret.y) < 1e-6, `${gw}x${gh}, ${where}: the cross goes through the player's caret`);
      for (let i = 0; i < 12; i++) win.tick(0.25);
      assert.equal(crossOf(paintOf(win)), null, 'three seconds on, no cross');
      win.tick(0.25);
      assert.equal(crossOf(paintOf(win)), null, '...in either half of the beat');
      win.dispose();
    }
    // opposite corners land on opposite sides of the paper - never the one spot, wherever the player stood
    const sw = goals['south-west corner'], ne = goals['north-east corner'];
    assert.ok(sw.x < ne.x && sw.y > ne.y, `${gw}x${gh}: south-west lands left and low, north-east right and high`);
  }
}));

test('FINDME-TOWN: zoomed in past the street already, Find me keeps the zoom and centres the caret (mutant: the zoom thrown back to the street\'s)', () => withDocument((doc) => {
  const W = 8 * BLOCK_PX * WORLD_PER_PX, H = 8 * BLOCK_PX * WORLD_PER_PX;
  const win = raise(town(8, 8, [W / 2 + 40, H / 2 - 30]));
  win._setView({ ...win._view, scale: 10 });
  pressFindMe(doc);
  win.tick(0.25);
  assert.equal(win._goal.scale, 10, 'no zoom out');
  const lim = win._limits();
  const caret = caretOf(paintOf(win));
  assert.ok(Math.abs(caret.x - lim.paperW / 2) < 1e-6 && Math.abs(caret.y - lim.paperH / 2) < 1e-6, 'centred on the caret');
  win.dispose();
}));

test('FINDME-TOWN: a map with no player on its sheet finds nothing - the town handed none, the bay handed no pixel: no glide, no cross; the bay\'s middle is never read as me (mutants: the bay\'s middle back as a stand-in; a sheet\'s null read as a view)', () => withDocument((doc) => {
  const lone = raise(town(8, 8, null));
  const was = { ...lone._goal };
  pressFindMe(doc);
  assert.deepEqual(lone._goal, was, 'the streets did not move');
  assert.ok(!(lone._findMeT > 0), 'and no cross was asked for');
  assert.equal(crossOf(paintOf(lone)), null);
  lone.dispose();
  doc.made.length = 0;
  // the bay, opened by a door that hands no pixel: its sheet has no player either
  const bay = raise(new HeldMapWindow({
    getClimateIndex: () => CLIMATES.Woodlands, woods: { heightMapBuffer: new Uint8Array(500000).fill(10) }, mapSize: { width: 1000, height: 500 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
  }));
  const bayWas = { ...bay._goal };
  pressFindMe(doc);
  assert.deepEqual(bay._goal, bayWas, 'no pixel, no glide - not to the bay\'s middle');
  assert.ok(!(bay._findMeT > 0));
  bay.dispose();
}));

test('FINDME-TOWN: the bay\'s Find me is as it was - my pixel as it stands at the press, its middle at the find\'s zoom - and its cross, the window\'s now, still goes through my pixel (mutants: the pixel\'s corner; the find\'s zoom; the pixel the poll last read)', () => withDocument((doc) => {
  let ME = { x: 300, y: 200 };
  const bay = raise(new HeldMapWindow({
    getPlayerPixel: () => ME, getClimateIndex: () => CLIMATES.Woodlands, woods: { heightMapBuffer: new Uint8Array(500000).fill(10) }, mapSize: { width: 1000, height: 500 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
  }));
  ME = { x: 700, y: 300 };   // a step since the window's last poll of my pixel - the press reads it as it stands
  pressFindMe(doc);
  bay.tick(0.25);
  const lim = bay._limits();
  assert.equal(bay._goal.scale, 6, 'FOCUS_SCALE, the find\'s zoom');
  const me = toPaper(bay._goal, ME.x + 0.5, ME.y + 0.5);
  assert.ok(Math.abs(me[0] - lim.paperW / 2) < 1e-6 && Math.abs(me[1] - lim.paperH / 2) < 1e-6, 'my pixel\'s middle at the paper\'s');
  const crosses = [crossOf(paintOf(bay)), (bay.tick(0.25), crossOf(paintOf(bay)))];
  assert.equal(crosses.filter(Boolean).length, 1, 'the cross blinks');
  const cross = crosses.find(Boolean);
  assert.ok(Math.abs(cross.x - me[0]) < 1e-6 && Math.abs(cross.y - me[1]) < 1e-6, 'through my pixel\'s middle');
  bay.dispose();
}));

// the dungeon's plan: two floors of the map, one hall over another (test/ui/disc25a_dungeon_map.test.js's quads), wide
// enough that the plan is bigger than the paper at the window's closest zoom
const quad = (key, y, x0, z0, x1, z1, ny = 1) => ({
  key, aabb: { min: [x0, y, z0], max: [x1, y, z1] },
  positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  normals: new Float32Array([0, ny, 0, 0, ny, 0, 0, ny, 0, 0, ny, 0]), matrix: null,
});
const room = (key, y, x0, z0, x1, z1, h = 4) => [quad(`${key}f`, y, x0, z0, x1, z1, 1), quad(`${key}c`, y + h, x0, z0, x1, z1, -1)];
const STACK = [...room('lo', 0, 0, 0, 400, 300), ...room('over', 8, 0, 0, 400, 300)];
const rec = () => ({ revealed: new Set(STACK.map((r) => r.key)), visitedThisRun: new Set(), entranceDiscovered: false, notes: new Map(), teleporters: new Map() });

test('FINDME-TOWN: on the dungeon\'s plan Find me is its own Me - from another floor, back to the player\'s, the view on them, and the cross through them (mutants: the floor left where it was; the cross the bay\'s alone)', () => withDocument((doc) => {
  setPref('dungeonMap3d', false);   // the flat plan, one floor at a time
  const win = raise(createAutomapWindow({ record: rec, model: { rows: STACK }, player: () => ({ feet: [30, 0, 40], yaw: 0 }), dungeonName: 'Privateer\'s Hold' }));
  assert.equal(win._slot.live, 'automap');
  assert.equal(win._sheet.floor, 0, 'the player is downstairs');
  win.input('PageUp');
  assert.equal(win._sheet.floor, 1, 'looking at the floor above');
  assert.equal(win._sheet.me(), null, 'where the player is not drawn');
  pressFindMe(doc);
  assert.equal(win._sheet.floor, 0, 'Find me turns back to the player\'s own floor');
  assert.equal(win._findMeT, 3);
  win.tick(0.25);
  const lim = win._limits();
  const me = win._sheet.me();
  const [mx, my] = toPaper(win._goal, me.x, me.y);
  assert.ok(Math.abs(mx - lim.paperW / 2) < 1e-6 && Math.abs(my - lim.paperH / 2) < 1e-6, 'the player in the middle of the paper, as the Me key puts them');
  const crosses = [crossOf(paintOf(win)), (win.tick(0.25), crossOf(paintOf(win)))];
  assert.equal(crosses.filter(Boolean).length, 1, 'the cross blinks');
  const cross = crosses.find(Boolean);
  assert.ok(Math.abs(cross.x - mx) < 1e-6 && Math.abs(cross.y - my) < 1e-6, 'through the player');
  win.dispose();
}));

test('FINDME-TOWN: on the 3D dungeon map Find me, the Me button and the Home key are one way back to you - from the floor above, each comes back to the player\'s floor and turns about them (mutants: the Me button, the Home key or Find me no longer back to you)', () => withDocument((doc) => {
  const ways = {
    'Find me': (win) => pressFindMe(doc),
    'the Me button': (win) => assert.equal(win._sheet.press('home'), 'home'),
    'the Home key': (win) => win.input('Home'),
  };
  for (const [way, go] of Object.entries(ways)) {
    doc.made.length = 0;
    const win = raise(createAutomapWindow({ record: rec, model: { rows: STACK }, player: () => ({ feet: [30, 0, 40], yaw: 0 }), dungeonName: 'Privateer\'s Hold' }));
    assert.equal(win._sheet.solid, true, 'the 3D map, the default');
    assert.equal(win._sheet.press('floorUp'), true);
    assert.deepEqual([win._sheet.toolStatus().at, win._sheet.toolStatus().you], [2, 1], 'looking at the floor above the player\'s');
    go(win);
    assert.deepEqual([win._sheet.toolStatus().at, win._sheet.toolStatus().you], [1, null], `${way}: back on the player's floor`);
    assert.equal(win._sheet.meLocked, true, `${way}: and turning about them`);
    win.tick(0.25);
    const lim = win._limits();
    const me = win._sheet.me();
    const [mx, my] = toPaper(win._view, me.x, me.y);
    assert.ok(Math.abs(mx - lim.paperW / 2) < 1e-6 && Math.abs(my - lim.paperH / 2) < 1e-6, `${way}: the player in the middle of the paper`);
    win.dispose();
  }
}));

// AUDIT FB1019f E4: the town map opens anywhere in the location's pixel, and the town's blocks are not all of it - a
// player in the fields round the walls stands off the town's grid. Find me glides there as anywhere, and the view keeps
// the town on the paper, so it lands on the town's edge nearest them; the cross was drawn through their caret, off the
// paper - one of its lines off it, or both. It stands at the paper's edge on their side now.
/** The cross as two quarter-second paints show it: the one it is lit in. */
const litCross = (win) => { const a = crossOf(paintOf(win)); win.tick(0.25); const b = crossOf(paintOf(win)); assert.equal([a, b].filter(Boolean).length, 1, 'the cross blinks'); return a ?? b; };

test('FINDME-TOWN AUDIT FB1019f E4: from the fields outside the town\'s blocks Find me glides to the town\'s edge nearest the player, and the cross stands at the paper\'s edge on their side - on their row west of the town, on their column north of it, in the corner off a corner - its stroke whole on the paper; on the paper it goes through the caret as before; dragged off the bay while it blinks, the same (mutants: the cross off the paper; its stroke half off; the edges crossed)', () => withDocument((doc) => {
  const W = 8 * BLOCK_PX * WORLD_PER_PX, H = 8 * BLOCK_PX * WORLD_PER_PX;
  const half = 1.5;   // the cross's stroke is three paper pixels
  for (const [where, at, expect] of [
    ['west, on the town\'s middle row', [-60, H / 2], (c) => ({ x: half, y: c.y })],
    ['north, on its middle column', [W / 2, H + 60], (c) => ({ x: c.x, y: half })],
    ['north-east, off its corner', [W + 80, H + 80], (c, lim) => ({ x: lim.paperW - half, y: half })],
    ['south-west, off its corner', [-80, -80], (c, lim) => ({ x: half, y: lim.paperH - half })],
    ['inside, the south-west corner', [10, 10], (c) => ({ x: c.x, y: c.y })],
  ]) {
    doc.made.length = 0;
    const win = raise(town(8, 8, at));
    pressFindMe(doc);
    assert.equal(win._findMeT, 3, `${where}: Find me answers - a player stands on the sheet`);
    win.tick(0.25);
    const lim = win._limits();
    const caret = caretOf(paintOf(win));
    const inside = caret.x >= 0 && caret.x <= lim.paperW && caret.y >= 0 && caret.y <= lim.paperH;
    assert.equal(inside, where.startsWith('inside'), `${where}: the caret ${inside ? 'on' : 'off'} the paper (${caret.x.toFixed(1)}, ${caret.y.toFixed(1)})`);
    // the glide: street zoom, the view against the town's own edge on each side the player stands off the paper
    const g = win._goal, visW = lim.paperW / g.scale, visH = lim.paperH / g.scale;
    assert.ok(Math.abs(Math.min(lim.paperW, lim.paperH) / g.scale - 2 * win._sheet.blockPx) < 1e-9, `${where}: street zoom`);
    if (caret.x < 0) assert.ok(Math.abs(g.ox) < 1e-6, `${where}: the town's west edge on the paper's`);
    if (caret.x > lim.paperW) assert.ok(Math.abs(g.ox - (lim.mapW - visW)) < 1e-6, `${where}: the town's east edge on the paper's`);
    if (caret.y < 0) assert.ok(Math.abs(g.oy) < 1e-6, `${where}: the town's north edge on the paper's`);
    if (caret.y > lim.paperH) assert.ok(Math.abs(g.oy - (lim.mapH - visH)) < 1e-6, `${where}: the town's south edge on the paper's`);
    assert.deepEqual(litCross(win), expect(caret, lim), `${where}: the cross`);
    win.dispose();
  }
  // the bay, dragged away from me while the cross blinks: it holds the edge on my side
  doc.made.length = 0;
  const bay = raise(new HeldMapWindow({
    getPlayerPixel: () => ({ x: 700, y: 300 }), getClimateIndex: () => CLIMATES.Woodlands, woods: { heightMapBuffer: new Uint8Array(500000).fill(10) }, mapSize: { width: 1000, height: 500 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
  }));
  pressFindMe(doc);
  bay.tick(0.25);
  bay._setView({ ...bay._view, ox: 100 });   // the west of the bay on the paper, me far east of it
  const lim = bay._limits();
  const [mx, my] = toPaper(bay._view, 700.5, 300.5);
  assert.ok(mx > lim.paperW && my > 0 && my < lim.paperH, 'my pixel east of the paper, on its rows');
  assert.deepEqual(litCross(bay), { x: lim.paperW - half, y: my }, 'the cross at the east edge, on my row');
  bay.dispose();
}));
