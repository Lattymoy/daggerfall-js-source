// IC-TOWNMAP 3 (2026-10-26; the owner: "Curious how the town map will look", and his go-ahead for the city's own map) -
// THE IMPERIAL CITY ON THE HELD MAP. In any of the city's slices the town key's held map is the city itself
// (ui/town/imperialSheet.js): its plan at city zoom - Lake Rumare, the walls and gates, Green Emperor Way, the rings,
// avenues and radials, the districts and their names, the landmarks - built once a session; zoomed in near the player the
// district's own fabric (world/imperialFabric.js), built on demand a cell a tick, and the slice's own Daggerfall blocks
// through the town sheet, where the slice stands; the player's caret; Find me at street zoom. Every window here is built
// through the M key's real door (ui/town/townMapDoor.js createTownMapWindow), with the bag the host hands
// (scenes/exteriorAutomapToggle.js townHere: `imperialSlice`, the player in the location's frame).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createTownMapWindow, townSheetBag } from '../../../src/ui/town/townMapDoor.js';
import { HeldMapWindow } from '../../../src/ui/heldMap.js';
import { BLOCK_PX, WORLD_PER_PX, TOWN_PEN } from '../../../src/ui/ink/inkTown.js';
import { toPaper, CARET_R } from '../../../src/ui/ink/inkMap.js';
import { HOUSE_SET } from '../../../src/ui/town/townQuarters.js';
import {
  imperialPlanBuilds, _resetImperialPlanForTests, IC_SHEET_PX, IC_HALF_M, IC_FABRIC_ZOOM, IC_FABRIC_PER_TICK, imperialCityPlan,
} from '../../../src/ui/town/imperialSheet.js';
import { IMPERIAL, IMPERIAL_SPAN, polar, imperialDistrictAt, imperialCellDistrict } from '../../../src/world/imperialCity.js';
import { resetTravelMapState } from '../../../src/systems/travel/travelMapState.js';
import { setPref } from '../../../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const CELL_M = BLOCK_PX * WORLD_PER_PX, HALF = (IMPERIAL_SPAN * 8) / 2;

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
const paintOf = (win) => { const ctx = recordingCtx(); win._chrome.ink.getContext = () => ctx; win._staticKey = ''; win._paint(); delete win._chrome.ink.getContext; return ctx.calls; };
const raise = (win) => { for (let i = 0; i < 21; i++) win.tick(0.05); assert.equal(win._phase, 'map'); return win; };
const pressFindMe = (doc) => { const b = doc.made.find((n) => n.className === 'act hmfindme'); assert.ok(b?.onclick, 'the Find me button'); b.onclick(); };
const texts = (calls) => calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
const caretTip = (calls) => calls.filter((c) => c.fn === 'moveTo' && c.fillStyle === TOWN_PEN.caret && c.strokeStyle === TOWN_PEN.halo).at(-1)?.args ?? null;
const CROSS_PEN = 'rgba(200,24,24,0.95)';
const crossOf = (calls) => { const pen = calls.filter((c) => c.strokeStyle === CROSS_PEN && (c.fn === 'moveTo' || c.fn === 'lineTo')); return pen.length ? { x: pen[2].args[0], y: pen[0].args[1] } : null; };

/** The slice a point of the city stands in, and the player there in that slice's location frame (x east from its west
 *  edge, z north from its south edge - the host's `local`, over WORLD_PER_PX). */
function sliceOf(x, z) {
  const s = Math.floor((z + IC_HALF_M) / (8 * CELL_M)) * IMPERIAL_SPAN + Math.floor((x + IC_HALF_M) / (8 * CELL_M));
  const sx = s % IMPERIAL_SPAN, sy = Math.floor(s / IMPERIAL_SPAN);
  return { s, local: [x - (sx * 8 - HALF) * CELL_M, (sy * 8 + 8 - HALF) * CELL_M - z] };
}
/** A slice's 8 x 8 of blocks, a house in one of them (the slice's own Daggerfall block), the rest the city's own (no byte
 *  but the closed one's, read as nothing here). */
function sliceBlocks() {
  const blocks = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) blocks.push({ x, y, autoMap: new Uint8Array(BLOCK_PX * BLOCK_PX), landmark: null });
  const g = blocks.find((b) => b.x === 3 && b.y === 4).autoMap;
  for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) g[y * BLOCK_PX + x] = HOUSE_SET[0];
  return blocks;
}
/** The M key's window in the Imperial City, the player at (x, z) of the city's metres, yaw 0. */
function cityWindow([x, z], extra = {}) {
  const { s, local } = sliceOf(x, z);
  return createTownMapWindow({
    locationName: 'Imperial City', gridW: 8, gridH: 8, blocks: sliceBlocks(), discovered: () => [], revealAll: () => true,
    buildings: () => [{ buildingKey: 1, blockX: 3, blockY: 4, position: [51.2, 0, 51.2], name: 'The Rusty Nail', buildingType: 15 }],
    playerPos: () => [local[0], 0, local[1]], playerYaw: () => 0,
    townPlayer: () => ({ x: local[0] / WORLD_PER_PX, y: local[1] / WORLD_PER_PX, yaw: 0 }),
    imperialSlice: s,
    ...extra,
  });
}
const MARKET = polar(30, 4600 + 260);
/** The city's sheet coordinates of a point of its metres. */
const sheetOf = ([x, z]) => [(x + IC_HALF_M) / WORLD_PER_PX, (z + IC_HALF_M) / WORLD_PER_PX];

test('IC-TOWNMAP 3: in an Imperial City slice the M key\'s held map is the city - its sheet the whole plan, the player where they stand in it; a Bay town\'s sheet is its own blocks as before; the host hands the slice (mutants: the slice\'s corner lost, its rows unflipped, the bag\'s slice dropped)', () => withDocument(() => {
  for (const at of [MARKET, polar(210, 3000), polar(300, 6500), [40, -60]]) {
    const win = raise(cityWindow(at));
    assert.ok(win instanceof HeldMapWindow);
    assert.equal(win._slot.live, 'town');
    assert.deepEqual(win._sheet.size(), { width: IC_SHEET_PX, height: IC_SHEET_PX }, 'the whole city');
    const me = win._sheet.me(), [ex, ey] = sheetOf(at);
    assert.ok(Math.abs(me.x - ex) <= 1 && Math.abs(me.y - ey) <= 1, `the player where they stand: (${me.x.toFixed(1)}, ${me.y.toFixed(1)}) for (${ex.toFixed(1)}, ${ey.toFixed(1)})`);
    assert.equal(imperialDistrictAt(me.x * WORLD_PER_PX - IC_HALF_M, me.y * WORLD_PER_PX - IC_HALF_M), imperialDistrictAt(...at));
    win.dispose();
  }
  const bay = raise(createTownMapWindow({ locationName: 'Gothway Garden', gridW: 2, gridH: 2, blocks: sliceBlocks().slice(0, 4), buildings: () => [], discovered: () => [] }));
  assert.deepEqual(bay._sheet.size(), { width: 2 * BLOCK_PX, height: 2 * BLOCK_PX }, 'a Bay town is its own blocks');
  bay.dispose();
  assert.equal(townSheetBag({ imperialSlice: 190 }).imperial, 190);
  assert.equal(townSheetBag({}).imperial, null);
  assert.match(read('src/scenes/exteriorAutomapToggle.js'), /imperialSlice: capitalViewOf\(dfLoc\) \? dfLoc\.capital\.s : null,/);
}));

test('IC-TOWNMAP 3: at rest the whole city is on the paper, inked from its plan - the lake, the walls and their gates, the roads, the landmarks - and lettered: every district\'s name and the landmarks\', through the text core; the player\'s caret where they stand (mutants: a district unnamed; the labels\' zoom gate reversed; the caret not drawn)', () => withDocument(() => {
  const win = raise(cityWindow(MARKET));
  const lim = win._limits();
  assert.ok(Math.abs(win._view.scale - Math.min(lim.paperW / lim.mapW, lim.paperH / lim.mapH)) < 1e-9, 'the whole city, fitted');
  const calls = paintOf(win), words = texts(calls);
  for (const name of ['Palace District', 'Market District', 'Arena District', 'Arboretum', 'Temple District', 'Talos Plaza District', 'Elven Gardens District', 'Waterfront District',
    'White-Gold Tower', 'Arena', 'Temple of the One', 'Imperial Prison', 'Arcane University', 'Talos Bridge', 'Lake Rumare', 'City Isle']) {
    assert.ok(words.includes(name), `"${name}" is lettered`);
  }
  assert.ok(!words.includes('Waterfront Quay') && !words.includes('Green Emperor Way'), 'the smaller names wait for their zoom');
  assert.ok(words.includes('Town'), 'the heading');
  // the walls: the city's and the palace's rings, round the middle at their radii
  const arcs = calls.filter((c) => c.fn === 'arc'), [cx, cy] = toPaper(win._view, IC_SHEET_PX / 2, IC_SHEET_PX / 2), k = win._view.scale / WORLD_PER_PX;
  for (const r of [IMPERIAL.cityWall.r, IMPERIAL.palaceWall.r, IMPERIAL.lake, IMPERIAL.isle, ...IMPERIAL.roads.rings]) {
    assert.ok(arcs.some((a) => Math.abs(a.args[0] - cx) < 1e-6 && Math.abs(a.args[1] - cy) < 1e-6 && Math.abs(a.args[2] - r * k) < 1e-6), `a ring at ${r} m`);
  }
  const plan = imperialCityPlan();
  assert.equal(plan.cityGates.length, IMPERIAL.cityWall.gates.length);
  assert.equal(plan.roads.filter((r) => r.kind === 'avenue').length, 6);
  assert.equal(plan.roads.filter((r) => r.kind === 'radial').length, 12);
  const tip = caretTip(calls), [px, py] = toPaper(win._view, ...sheetOf(MARKET));
  assert.ok(tip && Math.abs(tip[0] - px) < 1.5 && Math.abs(tip[1] + CARET_R - py) < 1.5, 'the caret on the player');
  // zoomed in, the smaller names come up
  win._setView({ ...win._view, scale: 0.15 });
  const near = texts(paintOf(win));
  assert.ok(near.includes('Waterfront Quay') || near.includes('Green Emperor Way') || near.includes('Prison District'), 'past their zoom');
  win.dispose();
}));

test('IC-TOWNMAP 3: the city\'s plan is built once a session - however many windows open and however often they paint (mutant: built at every paint)', () => withDocument(() => {
  _resetImperialPlanForTests();
  for (const at of [MARKET, polar(150, 4000)]) {
    const win = raise(cityWindow(at));
    for (let i = 0; i < 3; i++) { win._setView({ ...win._view, scale: win._view.scale * 1.1 }); paintOf(win); }
    win.dispose();
  }
  assert.equal(imperialPlanBuilds(), 1);
}));

test('IC-TOWNMAP 3: the district\'s fabric is built on demand - none at city zoom, then IC_FABRIC_PER_TICK cells a tick once zoomed in, nearest first, the player\'s district\'s alone - and drawn; Find me lands on the player at street zoom and blinks its cross through the caret (mutants: built at any zoom; the whole district in one tick; another district\'s cells; the fabric not drawn; Find me off the player)', () => withDocument((doc) => {
  const win = raise(cityWindow(MARKET));
  for (let i = 0; i < 30; i++) { win.tick(0.05); paintOf(win); }
  assert.equal(win._sheet.fabricCells, 0, 'nothing built at city zoom');
  pressFindMe(doc);
  win.tick(0.25);
  assert.deepEqual(win._view, win._goal);
  const lim = win._limits();
  assert.ok(Math.abs(Math.min(lim.paperW, lim.paperH) / win._view.scale - 2 * BLOCK_PX) < 1e-9, 'street zoom - two blocks across');
  assert.ok(win._view.scale >= IC_FABRIC_ZOOM);
  const me = win._sheet.me(), [mx, my] = toPaper(win._view, me.x, me.y);
  assert.ok(Math.abs(mx - lim.paperW / 2) < 1e-6 && Math.abs(my - lim.paperH / 2) < 1e-6, 'the player in the middle of the paper');
  const first = paintOf(win); win.tick(0.25); const second = paintOf(win);
  const cross = crossOf(first) ?? crossOf(second);
  assert.ok(cross && Math.abs(cross.x - mx) < 1e-6 && Math.abs(cross.y - my) < 1e-6, 'the cross through the caret');
  const wanted = win._sheet.fabricWanted;
  assert.ok(wanted > 40, `the district's cells round the player (${wanted})`);
  let last = win._sheet.fabricCells;
  assert.ok(last <= 2 * IC_FABRIC_PER_TICK, `two ticks since Find me, their share built (${last})`);
  for (let i = 0; i < 20; i++) { win.tick(0.05); const n = win._sheet.fabricCells; assert.ok(n - last <= IC_FABRIC_PER_TICK, 'a tick builds its share'); last = n; }
  assert.ok(last >= 20 * IC_FABRIC_PER_TICK - 2, `and builds it (${last})`);
  for (let i = 0; i < 400 && win._sheet.breathes(); i++) win.tick(0.05);
  assert.equal(win._sheet.fabricCells, wanted, 'all of it, in time');
  const district = imperialDistrictAt(...MARKET);
  for (const f of win._sheet._fabricRows()) assert.equal(imperialCellDistrict(f.r, f.c), district, `cell ${f.r},${f.c} the player's district's`);
  const ink = paintOf(win);
  assert.ok(ink.filter((c) => c.fn === 'fill' && c.fillStyle === win._sheet.ink.building).length > 0, 'the fabric\'s buildings drawn');
  win.dispose();
  // beside a district wall, the cells across it are the next district's - not drawn as this one's
  doc.made.length = 0;
  const EDGE = polar(58.5, 4600), edge = raise(cityWindow(EDGE));
  pressFindMe(doc);
  for (let i = 0; i < 400 && (i < 2 || edge._sheet.breathes()); i++) edge.tick(0.05);
  const mine = imperialDistrictAt(...EDGE), rows = edge._sheet._fabricRows();
  assert.ok(rows.length > 20);
  for (const f of rows) assert.equal(imperialCellDistrict(f.r, f.c), mine, `cell ${f.r},${f.c} the player's district's`);
  edge.dispose();
}));

test('IC-TOWNMAP 3: zoomed in, the slice\'s own Daggerfall blocks are the town sheet\'s - its wash and its names where the slice stands; at city zoom they wait; the district is named under the pointer (mutants: the slice drawn at every zoom; the slice\'s corner lost)', () => withDocument(() => {
  const win = raise(cityWindow(MARKET));
  assert.ok(!texts(paintOf(win)).includes('The Rusty Nail'), 'not at city zoom');
  // its building's place: the plates' anchor in the slice's sheet (block 3, 4, its middle), at the slice's corner of the city's
  const { s } = sliceOf(...MARKET), sx = s % IMPERIAL_SPAN, sy = Math.floor(s / IMPERIAL_SPAN);
  const [ax, ay] = [3 * BLOCK_PX + 32, (8 * BLOCK_PX - 1) - (4 * BLOCK_PX + 32)];
  const lim = win._limits();
  win._setView({ ox: sx * 8 * BLOCK_PX + ax - lim.paperW / 4, oy: sy * 8 * BLOCK_PX + ay - lim.paperH / 4, scale: 2 });
  const calls = paintOf(win);
  const plate = calls.find((c) => c.fn === 'fillText' && c.args[0] === 'The Rusty Nail');
  assert.ok(plate, 'the slice\'s building named');
  const [px, py] = toPaper(win._view, sx * 8 * BLOCK_PX + ax, sy * 8 * BLOCK_PX + ay);
  assert.ok(Math.abs(plate.args[1] - px) < 1 && Math.abs(plate.args[2] - py) < 40, `at its building (${plate.args[1].toFixed(1)}, ${plate.args[2].toFixed(1)} for ${px.toFixed(1)}, ${py.toFixed(1)})`);
  // the pointer: a district's name off the plan
  win._setView({ ...win._view, scale: 0.05 });
  paintOf(win);
  for (const [b, name] of [[100, 'Arena District'], [10, 'Market District'], [0, 'Palace District', 1200]]) {
    const [hx, hy] = toPaper(win._view, ...sheetOf(polar(b, name === 'Palace District' ? 1200 : 5000)));
    assert.equal(win._sheet.hoverLabel(hx, hy).label, name);
  }
  win.dispose();
}));
