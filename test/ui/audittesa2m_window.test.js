// AUDIT TESA II, lane M (2026-10-25) - THE HELD MAP'S WINDOW PAST THE BAY, pinned where the audit found it wrong
// (ui/heldMap.js; bible/03-World/Arena-Provinces.md TESA15, MAP-LINES; bible/10-UI/Held-Map-Arc.md):
//   M2  the window's "paint it again" (the zones' borders landing, the web face landing) inks the sheet's kept parts too;
//   M4  the zone's halls are inked over its fog;
//   M5  offline the zone is drawn and none of its laws is said - its key, its press, its legend; Cyrodiil's travel law;
//   M6  on the zone map each of Cyrodiil's cities is named once, and Hide place names hides it;
//   M8  bare land past the Bay answers with its ore card, off the host's own maps (ARENA2: the producer's shape);
//   M9  a region landing repaints the window and strokes the sheet's ink again nowhere;
//   M11 the kept parts made only while the land past the Bay is in the view; the road ink let go on close;
//   K3  ZOOM-FAST's settle a law of its own, and the frame after a zoom settles paints the tiles it owed;
//   K5  ZONE-NAMES' kinds: a capital and a city-state the city, a town the village.
// A held map on a document whose canvases carry recording 2D contexts, on the authored land and Cyrodiil's mask.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HeldMapWindow, createZoomSettle, ZOOM_SETTLE_MS } from '../../src/ui/heldMap.js';
import { CLIMATES, LOCATION_TYPES, MapsFile } from '../../src/formats/mapsFile.js';
import { setTamrielFit, BAY_W } from '../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { cyrodiilMask } from '../../src/systems/wild/cyrodiilZone.js';
import { wildInside, WILD_TEXT } from '../../src/systems/wild/wildZone.js';
import { tamrielZoneChains, tamrielInkFor, roadKeptCounts, arenaRoadInkAt } from '../../src/ui/tamrielInk.js';
import { ZONE_MAP_TEXT, ZONE_RULES, zoneRules } from '../../src/ui/wild/wildZoneMap.js';
import { toPaper, HALL_INK } from '../../src/ui/ink/inkMap.js';
import { setArenaRoads, beyondKey } from '../../src/world/arenaRoads.js';
import { addPastBayPlaces, resetPastBayPlaces } from '../../src/world/pastBayPlaces.js';
import { DIR } from '../../src/world/road/roadNetwork.js';
import { oreMapTip } from '../../src/ui/oreMapTip.js';
import { hostText } from '../hostText.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every call on every canvas, in order: [canvas id, fn, args, font, globalAlpha]. */
let log = [];
let ids = 0;
function recCtx(canvas) {
  const st = { globalAlpha: 1 };
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'canvas') return canvas;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w?.width ?? w ?? 1) * (h ?? 1) * 4)), width: w, height: h });
      if (k === 'getLineDash') return () => st._dash ?? [];
      if (k === 'setLineDash') return (d) => { st._dash = d; log.push([canvas.id, 'setLineDash', [d]]); };
      if (k in st) return st[k];
      return (...a) => { log.push([canvas.id, k, a, st.font, st.globalAlpha, st.fillStyle, st.strokeStyle]); };
    },
    set: (_, k, v) => { st[k] = v; return true; },
  });
}
let fontsLanded = null;
function fakeDocument() {
  const node = (tag) => {
    const n = {
      tag, id: '', children: [], style: { setProperty() {} }, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; }, addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', title: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; }, set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    if (tag === 'canvas') { n.id = `c${++ids}`; n.width = 300; n.height = 150; const c = recCtx(n); n.getContext = () => c; }
    return n;
  };
  return {
    createElement: (t) => node(t), createTextNode: (t) => ({ textContent: t }), getElementById: () => null, head: node('head'), body: node('body'), addEventListener() {}, removeEventListener() {},
    fonts: { load: () => ({ then: (f) => { fontsLanded = f; } }) },
  };
}
const texts = (n, out = []) => { if (!n) return out; if (n.textContent) out.push(n.textContent); if (n.title) out.push(n.title); for (const c of n.children ?? []) if (typeof c === 'object') texts(c, out); return out; };
/** A held map on the authored land with Cyrodiil's zone; `extra` the host's deps. Ticked up, its ink canvas recording. */
function openMap(extra = {}) {
  const mask = cyrodiilMask();
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 500, y: 250 }), getClimateIndex: () => CLIMATES.Woodlands,
    woods: { heightMapBuffer: new Uint8Array(500000).fill(10) }, mapSize: { width: 1000, height: 500 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
    wildMask: () => mask, ...extra,
  });
  for (let i = 0; i < 20; i++) win.tick(0.05);
  win._chrome.ink.id = 'ink';
  win._phase = 'map';
  return { win, mask };
}
/** The window painted again, the zoom settled first (ZOOM_SETTLE_MS) - the calls of that paint. */
async function paintSettled(win, bust = true) {
  win._staticKey = ''; if (bust) win._sheetLayersKey = ''; win._paint();
  await sleep(ZOOM_SETTLE_MS + 30);
  log = [];
  win._staticKey = ''; if (bust) win._sheetLayersKey = ''; win._paint();
  return log;
}
function withMap(fn) {
  return async () => {
    globalThis.document = fakeDocument();
    globalThis.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
    setTamrielTrace(null);
    setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
    try { await fn(); } finally {
      setTamrielFit(null); setArenaRoads(null); resetPastBayPlaces();
      delete globalThis.document; delete globalThis.ImageData; delete globalThis.innerWidth; delete globalThis.innerHeight; delete globalThis.devicePixelRatio;
    }
  };
}
/** The path points drawn on `canvas` under a dash of `dash` (the zones' borders are dotted [1, 3]). */
const dashedPoints = (calls, canvas, dash) => { let on = false, n = 0; for (const [c, fn, a] of calls) { if (c !== canvas) continue; if (fn === 'setLineDash') on = JSON.stringify(a[0]) === JSON.stringify(dash); else if (on && (fn === 'lineTo' || fn === 'moveTo')) n++; } return n; };

test('AUDIT TESA II M2: the zones\' borders landing and the web face landing ink the sheet\'s kept parts again, the view unmoved - not at the next pan (mutants: the zones\' landing the window\'s key alone; the face\'s)', withMap(async () => {
  const { win } = openMap();
  win._setView({ ox: -589, oy: -600, scale: 0.9 });
  setTamrielFit({ ox: 38 * 15.5 + 1, oy: 57 * 15.5, ppu: 15.5 }); setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // a new zones' stamp
  const first = await paintSettled(win);
  const over = win._subLayers.over.id, under = win._subLayers.under.id;
  assert.equal(dashedPoints(first, over, [1, 3]), 0, 'none drawn before the build lands');
  let ticks = 0;
  while (!tamrielZoneChains().length && ticks < 2000) { win._sheet.tick(0.016); ticks++; }
  assert.ok(tamrielZoneChains().length > 0, 'the zones\' borders landed');
  log = []; win._paint();
  assert.ok(dashedPoints(log, over, [1, 3]) > 0, `the over part inked with them at once (${dashedPoints(log, over, [1, 3])} points)`);
  log = []; win._paint();
  assert.equal(log.filter(([c]) => c === under).length, 0, 'a frame with no news strokes no part again');
  fontsLanded?.();
  log = []; win._paint();
  assert.ok(log.some(([c, fn]) => c === under && fn === 'fillText') || log.some(([c, fn]) => c === over && fn === 'fillText'), 'the face landed: the names lettered again');
  assert.ok(log.filter(([c]) => c === under).length > 0, 'the under part too');
}));

test('AUDIT TESA II M4: online, a zone hall\'s door is inked over the zone\'s fog - beside it, in the sheet\'s over part, never in the marks\' bake under it (mutants: the halls left in the bake; the halls under the fog)', withMap(async () => {
  const mask = cyrodiilMask();
  let hall = null;
  for (let y = 0; y < 2000 && !hall; y += 7) for (let x = 1000; x < 3500 && !hall; x += 7) if (wildInside(mask, x + 0.5, y + 0.5)) hall = { x, y };
  const summary = { id: 9e9, pixel: hall, mapID: 9e9, mapId: 9e9, regionIndex: 62, mapIndex: -1, locationType: LOCATION_TYPES.DungeonKeep, dungeonType: 0, wildHall: { ring: 2, key: 'h1', name: 'Elite hall', crows: false } };
  const { win } = openMap({ wildHallSummaries: () => [summary], wildDungeons: () => [{ key: 'h1', x: hall.x, y: hall.y }] });
  win._setView({ ox: hall.x - 150, oy: hall.y - 90, scale: 4 });   // the hall in the middle of the view
  const calls = await paintSettled(win);
  const over = win._subLayers.over.id, bake = win._marksLayer?.canvas?.id;
  // the hall's door is the one glyph in HALL_INK (inkMap.js paintInkMarks)
  const at = (c) => calls.map((e, i) => [e, i]).filter(([[id, fn, , , , fill, stroke]]) => id === c && (fn === 'fill' || fn === 'stroke') && (fill === HALL_INK || stroke === HALL_INK));
  const fog = calls.findIndex(([c, fn, a]) => c === over && fn === 'drawImage' && a.length === 5);
  assert.ok(fog >= 0, 'the fog laid on the over part');
  assert.ok(at(over).length > 0 && at(over).every(([, i]) => i > fog), 'the hall\'s door after it');
  assert.ok(bake, 'the marks baked');
  assert.equal(at(bake).length, 0, 'and none in the marks\' bake');
  assert.ok(win._model.marks.some((m) => m.kind === 'hall'), 'the hover and the press keep it among the marks');
}));

test('AUDIT TESA II M5: offline (the host\'s halls null) the zone is drawn and none of its laws said - the key\'s tip and door, the press, the legend\'s rules and loot; online the laws, Cyrodiil\'s travel law in place of the Wrothgarian zone\'s carriages (mutants: the key ungated; the press ungated; the legend\'s laws offline; the carriages back)', withMap(async () => {
  const off = openMap({ wildDungeons: () => null, wildGiants: () => [], zoneFirst: () => false });
  off.win._keySig = ''; off.win._renderKey();
  const keyOff = texts(off.win._chrome.root).join(' | ');
  assert.ok(keyOff.includes(ZONE_MAP_TEXT.chipTipOffline()) && !keyOff.includes(WILD_TEXT.chipTip), 'the key\'s tip offline');
  assert.ok(keyOff.includes(ZONE_MAP_TEXT.doorOffline()) && !keyOff.includes(ZONE_MAP_TEXT.door()), 'its door\'s');
  // the zone still drawn offline: its fog on the sheet
  off.win._setView({ ox: 1300, oy: 0, scale: 0.6 });
  const calls = await paintSettled(off.win);
  assert.ok(calls.some(([c, fn, a]) => c === off.win._subLayers.over.id && fn === 'drawImage' && a.length === 5), 'the fog drawn offline');
  // a press on Cyrodiil is the world map's
  let at = null;
  for (let y = 0; y < 2000 && !at; y += 5) for (let x = 1000; x < 3500 && !at; x += 5) if (wildInside(off.mask, x + 0.5, y + 0.5)) { const [sx, sy] = toPaper(off.win._view, x + 0.5, y + 0.5); if (sx > 50 && sy > 50 && sx < off.win._paper.w - 50 && sy < off.win._paper.h - 50) at = { sx, sy }; }
  off.win._pickAt(at.sx, at.sy);
  assert.equal(off.win._zoneMap, false, 'offline a press opens no zone map');
  assert.ok(off.win._openZoneMap(), 'its door does');
  const legendOff = texts(off.win._zoneLegend).join(' | ');
  assert.ok(legendOff.includes(ZONE_MAP_TEXT.offline()), 'the legend: its laws hold online');
  assert.ok(!/% loot|Other players can attack you|four times/.test(legendOff), `no loot, no PvP said: ${legendOff}`);
  off.win.dispose?.();
  const on = openMap({ wildDungeons: () => [], wildGiants: () => [] });
  on.win._setView({ ox: 1300, oy: 0, scale: 0.6 });
  on.win._pickAt(at.sx, at.sy);
  assert.equal(on.win._zoneMap, true, 'online a press on the zone opens its map');
  const legendOn = texts(on.win._zoneLegend).join(' | ');
  assert.ok(legendOn.includes(ZONE_MAP_TEXT.travel()) && !legendOn.includes('Carriages run inside the zone'), 'Cyrodiil\'s travel law');
  assert.ok(ZONE_RULES.every((l) => legendOn.includes(l)), 'and the zone\'s laws');
  assert.deepEqual(zoneRules(false), [ZONE_MAP_TEXT.offline()]);
  on.win._keySig = ''; on.win._renderKey();
  assert.ok(texts(on.win._chrome.root).join(' | ').includes(WILD_TEXT.chipTip), 'the key\'s tip online');
  // the host's wiring: the map's laws are the halls' - null where wildMapMask is
  const W = hostText('src/scenes/world.js');
  assert.match(W, /wildDungeons: \(\) => wildActiveNow\(\),/);
  assert.match(W, /const wildActiveNow = \(\) => zoneHalls\.activeOf\(wildMapMask\(\)\);/);
  assert.match(W, /const wildMapMask = \(\) => \(_onlineWorldSession\(\) \? cyrodiilMask\(\) : null\);/);
  assert.match(read('src/scenes/zoneHallsHost.js'), /const activeOf = \(mask\) => \{\n\s+if \(!mask\) return null;/);
}));

test('AUDIT TESA II M6 and K5: on the zone map each of Cyrodiil\'s cities is named once - the zone map\'s names, with their kinds (a capital and a city-state the city, a town the village) - and Hide place names hides them all (mutants: the continent\'s names kept; the kinds flattened)', withMap(async () => {
  const { win } = openMap();
  assert.ok(win._openZoneMap());
  const names = (calls) => calls.filter(([c, fn]) => c === win._subLayers.over.id && fn === 'fillText').map(([, , a]) => a[0]);
  const inZone = tamrielInkFor(win._model).cities.filter((c) => wildInside(cyrodiilMask(), c.x, c.y)).map((c) => c.name);
  assert.ok(inZone.length > 0);
  for (const zoom of [1, 3]) {
    win._setView({ ...win._view, scale: win._view.scale * zoom });
    const got = names(await paintSettled(win));
    for (const n of inZone) assert.ok(got.filter((g) => g === n).length <= 1, `${n} named once at x${zoom}`);
  }
  win._zoneNames = false;
  const hid = names(await paintSettled(win));
  assert.ok(!inZone.some((n) => hid.includes(n)), `hidden: ${hid.join(', ')}`);
  // K5: the kinds, over a model with a capital, a city-state and a town in the zone
  const fake = { cities: [{ name: 'Cap', capital: true, kind: 'city-state', x: 0, y: 0 }, { name: 'Sta', capital: false, kind: 'city-state', x: 0, y: 0 }, { name: 'Tow', capital: false, kind: 'town', x: 0, y: 0 }, { name: 'Vil', capital: false, kind: 'village', x: 0, y: 0 }] };
  const p = tamrielInkFor(win._model).cities.find((c) => wildInside(cyrodiilMask(), c.x, c.y));
  for (const c of fake.cities) { c.x = p.x; c.y = p.y; }
  const real = tamrielInkFor(win._model);
  const saved = real.cities;
  real.cities = fake.cities;
  try {
    const kinds = Object.fromEntries(win._zonePlaces().filter((z) => fake.cities.some((c) => c.name === z.name)).map((z) => [z.name, z.kind]));
    assert.deepEqual(kinds, { Cap: 'city', Sta: 'city', Tow: 'village', Vil: 'hamlet' });
    win.filters.towns = true;
    assert.equal(win._zonePlaces().filter((z) => fake.cities.some((c) => c.name === z.name)).length, 0, 'AUDIT TESA II M7: under the map\'s filters');
  } finally { real.cities = saved; win.filters.towns = false; }
}));

test('AUDIT TESA II M9: a region landing far off the view repaints the window - its tiles compare their words - and strokes the sheet\'s ink, its parts and the marks\' bake again nowhere (mutant: the versions back in the static key)', withMap(async () => {
  const { win } = openMap();
  win._setView({ ox: -589, oy: -600, scale: 0.9 });
  const layer = { roads: new Map(), tracks: new Map(), join: new Map() };
  setArenaRoads(layer);
  await paintSettled(win);
  const under = win._subLayers.under.id, over = win._subLayers.over.id;
  for (let i = 0; i < 4; i++) {
    addPastBayPlaces([{ x: 4000 + i, y: 2500, type: LOCATION_TYPES.HomeFarms }]);
    const add = { roads: new Map([[beyondKey(4000 + i, 2600), DIR.E]]), tracks: new Map() };
    for (const [k, b] of add.roads) layer.roads.set(k, b);
    setArenaRoads(layer, add);
    win._staticKey = 'x';
    win._sheet.tick(0.016);
    assert.equal(win._staticKey, '', 'the landing repaints the window');
    log = []; win._paint();
    assert.equal(log.filter(([c]) => c === under || c === over).length, 0, 'no part stroked again');
  }
}));

test('AUDIT TESA II M11: on the Bay alone the sheet makes no kept parts of its own size; the road ink\'s caches are let go when the window shuts (mutants: the parts always made; the release unwired)', withMap(async () => {
  const { win } = openMap();
  win._subLayers = null; win._sheetLayersKey = '';   // the rest view's (it reaches past the Bay's foot) let go
  win._setView({ ox: 300, oy: 150, scale: 4 });
  await paintSettled(win, false);
  assert.equal(win._subLayers ?? null, null, 'none on the Bay');
  win._setView({ ox: -589, oy: -600, scale: 0.9 });
  await paintSettled(win, false);
  assert.ok(win._subLayers, 'made once the land past the Bay is in the view');
  const layer = { roads: new Map([[beyondKey(-300, -300), DIR.E], [beyondKey(-299, -300), DIR.W]]), tracks: new Map(), join: new Map() };
  setArenaRoads(layer);
  arenaRoadInkAt(-5, -5);
  assert.ok(roadKeptCounts().ink > 0);
  win._close();
  assert.deepEqual(roadKeptCounts(), { steps: 0, dots: 0, ink: 0 });
}));

test('AUDIT TESA II K3: ZOOM-FAST\'s settle - the first scale settles none, a change settles for ZOOM_SETTLE_MS from it, then none; and the frame after a zoom settles paints the road tiles it owed (mutants: settling forever; never)', withMap(async () => {
  const settle = createZoomSettle(150);
  assert.equal(settle(1, 0), false, 'a map opening is no zoom');
  assert.equal(settle(1, 10), false);
  assert.equal(settle(2, 100), true, 'a change settles');
  assert.equal(settle(2, 249), true);
  assert.equal(settle(2, 250), false, 'for ZOOM_SETTLE_MS, then none');
  assert.equal(ZOOM_SETTLE_MS, 150);
  const { win } = openMap();
  const layer = { roads: new Map(), tracks: new Map(), join: new Map() };
  for (let x = -900; x < -100; x++) layer.roads.set(beyondKey(x, -400), (x > -900 ? DIR.W : 0) | (x < -101 ? DIR.E : 0));
  setArenaRoads(layer);
  win._setView({ ox: -900, oy: -600, scale: 0.9 });
  await paintSettled(win, false);
  const kept0 = win._pastBayTiles.kept();
  assert.ok(kept0 > 0, 'painted, settled');
  win._setView({ ox: -900, oy: -600, scale: 1.3 });   // a zoom: the new level's tiles owed
  win._staticKey = ''; win._paint();
  assert.equal(win._pastBayTiles.kept(), kept0, 'while it settles none is painted');
  assert.equal(win._pastBayTiles.takePending(), true, 'and they are owed');
  await sleep(ZOOM_SETTLE_MS + 30);
  for (let i = 0; i < 20; i++) { win._staticKey = ''; win._paint(); if (!win._pastBayTiles.takePending()) break; }
  assert.ok(win._pastBayTiles.kept() > kept0, 'settled: the owed tiles painted');
  assert.equal(win._pastBayTiles.takePending(), false, 'none owed');
}));

// ── M8: THE ORE CARD PAST THE BAY, OFF THE HOST'S MAPS (ARENA2) ──
const A2 = process.env.ARENA2_PATH;
const file = (name) => { for (const n of [name, name.toLowerCase()]) { const p = join(A2, n); if (existsSync(p)) return readFileSync(p); } throw new Error(name); };
test('AUDIT TESA II M8: bare land past the Bay answers with its ore card - the host\'s own card (world.js oreMapAt: oreMapTip over its maps, groundMaps\' past the Bay) - so Cyrodiil\'s says every province\'s ores; a city past the Bay none (mutant: the card unasked past the Bay)', { skip: !A2 || !existsSync(A2 ?? '') ? 'no ARENA2_PATH' : false }, withMap(async () => {
  const W = hostText('src/scenes/world.js');
  assert.match(W, /return oreMapTip\(\{ climate: maps\.getClimateIndex\(px, py\), region: maps\.getRegionIndexAt\(px, py\), fact, surveyed \}\);/, 'the producer\'s shape');
  assert.match(W, /groundMaps\(maps\);/);
  const { groundMaps } = await import('../../src/world/tamriel/tamrielGround.js');
  const maps = new MapsFile();
  maps.load(file('MAPS.BSA'), file('CLIMATE.PAK'), file('POLITIC.PAK'));
  groundMaps(maps);
  const asked = [];
  const { win } = openMap({ maps, oreAt: (px, py) => { asked.push([px, py]); return oreMapTip({ climate: maps.getClimateIndex(px, py), region: maps.getRegionIndexAt(px, py), fact: null, surveyed: false }); } });
  win._setView({ ox: 1300, oy: 0, scale: 0.6 });
  let tip = null, label = null;
  for (let y = 100; y < 1500 && !tip; y += 37) for (let x = 1600; x < 3000 && !tip; x += 41) {
    const [sx, sy] = toPaper(win._view, x + 0.5, y + 0.5);
    const h = win._hoverLabel(sx, sy);
    if (h?.tip && /Imperial Province/.test(h.label)) { tip = h.tip; label = h.label; }
  }
  assert.ok(tip, 'a card on Cyrodiil\'s land');
  assert.ok(tip.lines.some((l) => l.startsWith('Cyrodiil holds every province\'s ores and metals')), `${label}: ${tip.lines.join(' / ')}`);
  assert.ok(asked.every(([x]) => x >= BAY_W), 'asked past the Bay');
}));
