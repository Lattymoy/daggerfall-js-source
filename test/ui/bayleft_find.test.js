// BAY-LEFT-MAPS C9, C11 (2026-10-27, the owner after AUDIT LEFT IN THE BAY: "Every single thing here needs to be addressed.
// No exceptions."; bible/10-UI/Held-Map-Arc.md BAY-LEFT-MAPS) - THE HELD MAP'S FIND BOX AND ITS SMALL GAPS PAST THE BAY.
//
// C9: the Find box (the travel map's, the Portal Stone's, the teleport map's) indexed MAPS.BSA's 62 regions alone, so
// Solitude, Whiterun, the Imperial City - every one of the 296 names past the Bay - was never found. It reads the
// registry's listed rows as the continent's ink stands them now (ui/tamrielInk.js tamrielFindRows: the ink's cities and a
// standing capital's slices by name), while the sheet shows the continent; a pick is START3's pick of a place past the Bay.
// C11: past the Bay no port carried its anchor and the Ports filter hid nothing; the teleport card named no province (its
// region read against MAPS.BSA's count). The carriage towns' key (C11's third) is test/scenes/bayleft_places.test.js's.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { arenaInkCities, buildTamrielInk, paintTamrielInk, tamrielCityAt, tamrielMarksIn, tamrielHoverAt, tamrielInkFor, tamrielFindRows } from '../../src/ui/tamrielInk.js';
import { toPaper } from '../../src/ui/ink/inkMap.js';
import { setCapitalsStanding, CAPITALS, capitalSpanPixels, capitalSliceName, capitalCentre, capitalHarbourSlice } from '../../src/world/tamrielCapitals.js';
import { bayToPicture } from '../../src/world/tamriel/tamrielFrame.js';
import { LOCATION_TYPES as T, REGION_NAMES } from '../../src/formats/mapsFile.js';
import { _resetForTests } from '../../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };
afterEach(() => { _resetForTests(); delete globalThis.location; delete globalThis.document; setCapitalsStanding(false); });

/** Just enough document for the held map's chrome (test/systems/starts/auditstarts.test.js's). */
globalThis.ImageData ??= class { constructor(d, w, h) { if (typeof d === 'number') { h = w; w = d; d = new Uint8ClampedArray(w * h * 4); } this.data = d; this.width = w; this.height = h ?? d.length / 4 / w; } };
const pen = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : k === 'createImageData' || k === 'getImageData' ? (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : () => ({ addColorStop() {} })),
  set: (t, k, v) => { t[k] = v; return true; },
});
function fakeDocument() {
  const node = (tag) => {
    const n = {
      tag, children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; }, getContext: () => pen(), width: 0, height: 0,
    };
    return n;
  };
  return { createTextNode: (t) => ({ textContent: t, nodeType: 3 }), createElementNS: (_ns, t) => node(t), createElement: (t) => node(t), getElementById: () => null, head: node('head'), body: node('body'), addEventListener() {}, removeEventListener() {} };
}
/** A held map up, the continent on (`tamriel`). */
function heldMap(deps = {}, tamriel = true) {
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => 231, woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 1e6, goldPieces: () => 1e6, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0, ...deps,
  });
  for (let i = 0; i < 20; i++) win.tick(0.05);
  win._tamriel = tamriel;
  return win;
}
function recordingCtx() {
  const calls = [], state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, lineWidth: state.lineWidth }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

test('BAY-LEFT-MAPS C9 THE FIND BOX PAST THE BAY: with the continent on, a place past the Bay is found by its name, named by its province\'s region, and picked as START3 picks a place past the Bay (TRAVEL-EVERYWHERE: a place where the world knows it); with the Bay\'s sheet alone none is; the index is read again when the continent comes on (mutants: the rows unread; the index kept for good; the pick the Bay\'s; the focus dropped)', () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  setCapitalsStanding(true);
  const off = heldMap({}, false);
  assert.deepEqual(off._findLocations('Solitude').filter((e) => e.pastBay), [], 'the Bay\'s sheet alone: nothing past it');
  off._tamriel = true;   // the continent comes on: the index is the continent's ink's
  const city = tamrielInkFor(off._model).cities.find((c) => c.name === 'Solitude' && c.pixel);
  assert.ok(city, 'Solitude, a capital the world stands');
  const sol = off._findLocations('Solitude').find((e) => e.pastBay);
  assert.deepEqual({ name: sol?.name, regionName: sol?.regionName, pos: sol?.pos }, { name: 'Solitude', regionName: 'Skyrim', pos: { x: city.pixel.x, y: city.pixel.y } });
  assert.equal(REGION_NAMES.indexOf('Skyrim'), 64, 'its province\'s region (WW-R)');
  const focused = [];
  off._focusOn = (x, y) => { focused.push([x, y]); };
  off._searchPick(sol);
  assert.deepEqual([off._selected?.pastBay, off._selected?.coords, off._selected?.name, off._selected?.x, off._selected?.y], [true, true, 'Solitude', city.pixel.x + 0.5, city.pixel.y + 0.5], 'START3\'s pick of it');
  assert.deepEqual(focused, [[city.pixel.x + 0.5, city.pixel.y + 0.5]], 'the view glides to it');
  // the Bay's own pick unchanged: a row of MAPS.BSA's selected as the city it is
  off._searchPick({ name: 'Wayrest', regionName: 'Wayrest', pos: { x: 700, y: 300 }, summary: { mapID: 1 } });
  assert.deepEqual([off._selected.kind, off._selected.x, off._selected.y, off._selected.pastBay], ['city', 700.5, 300.5, undefined]);
  // a capital's slices by their names, each once: the Imperial City's 625 slices on 14 names
  const ic = CAPITALS.findIndex((c) => c.name === 'Imperial City');
  const icNames = new Set(capitalSpanPixels(ic).map((_, s) => capitalSliceName(CAPITALS[ic], s)));
  assert.equal(icNames.size, 14);
  for (const n of icNames) assert.ok(off._findLocations(n).some((e) => e.pastBay && e.name === n && e.regionName === 'Cyrodiil'), `${n} found`);
});

test('BAY-LEFT-MAPS C9 THE ROWS: the ink\'s cities on the pixel the world stands each on (its ink point else), and a standing capital\'s slices one a name, the slice of it nearest the centre; a harbour\'s slice a port where its capital is (mutants: the ink point where a pixel stands; the slice furthest; a name twice; the harbour\'s slice not its name\'s; the harbour\'s port lost)', () => {
  setCapitalsStanding(true);
  const ic = CAPITALS.findIndex((c) => c.name === 'Imperial City'), cap = CAPITALS[ic];
  const slices = capitalSpanPixels(ic);
  const centre = slices[capitalCentre(cap)];
  const ink = { cities: [
    { name: 'Imperial City', province: 'Imperial', capital: true, kind: 'city-state', x: centre.x + 0.5, y: centre.y + 0.5, pixel: { x: centre.x, y: centre.y }, port: true },
    { name: 'Dragon Bridge', province: 'Skyrim', capital: false, kind: 'town', x: 1500.7, y: -420.2, pixel: null, port: false },
    { name: 'Dawnstar', province: 'Skyrim', capital: false, kind: 'town', x: 1700.5, y: -600.5, pixel: { x: 1700, y: -600 }, port: true },
  ] };
  const rows = tamrielFindRows(ink);
  assert.deepEqual(rows.filter((r) => r.name === 'Dragon Bridge' || r.name === 'Dawnstar'), [
    { name: 'Dragon Bridge', regionName: 'Skyrim', x: 1500, y: -421, port: false },
    { name: 'Dawnstar', regionName: 'Skyrim', x: 1700, y: -600, port: true },
  ]);
  const city = rows.filter((r) => r.regionName === 'Cyrodiil');
  assert.equal(new Set(city.map((r) => r.name)).size, city.length, 'each name once');
  assert.equal(city.length, 14);
  const hs = capitalHarbourSlice(cap), harbourName = capitalSliceName(cap, hs);
  for (const r of city) {
    if (r.name === harbourName) { assert.deepEqual([r.x, r.y], [slices[hs].x, slices[hs].y], `${r.name}: the harbour's own slice`); continue; }
    const own = slices.map((p, s) => ({ p, s })).filter(({ s }) => capitalSliceName(cap, s) === r.name);
    const best = Math.min(...own.map(({ p }) => Math.hypot(p.x - centre.x, p.y - centre.y)));
    assert.equal(Math.hypot(r.x - centre.x, r.y - centre.y), best, `${r.name}: its slice nearest the centre`);
  }
  assert.equal(city.find((r) => r.name === 'Imperial City').x, centre.x, 'the city on its own pixel');
  const harbour = city.filter((r) => r.port && r.name !== 'Imperial City');
  assert.deepEqual(harbour.map((r) => r.name), [capitalSliceName(cap, capitalHarbourSlice(cap))], 'its harbour\'s slice a port, as the registry\'s row');
  assert.deepEqual(tamrielFindRows(null), [], 'no continent, no rows');
});

test('BAY-LEFT-MAPS C9 x C11 THE FIND BOX UNDER THE PORTS FILTER: a place past the Bay that is no port is not found, as the sheet inks it not (mutants: the filter unread past the Bay; every place past the Bay hidden)', () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  setCapitalsStanding(true);
  const win = heldMap();
  assert.ok(win._findLocations('Solitude').some((e) => e.pastBay));
  const idx = win._ensureSearchIndex();
  for (const list of idx.byName.values()) for (const e of list) if (e.pastBay) e.port = e.name === 'Solitude';   // the rows' own word, as the freeware's says it (below)
  win.portsFilter = true;
  assert.ok(win._findLocations('Solitude').some((e) => e.pastBay), 'a port is found');
  assert.ok(!win._findLocations('Windhelm').some((e) => e.pastBay && e.name === 'Windhelm'), 'a place no port is not');
});

test('BAY-LEFT-MAPS C11 A PORT PAST THE BAY: a city carries its port by its provider\'s word (where it stands, the stood place\'s); in to the Bay\'s scale its anchor stands beside its glyph and an inland town has none, out on the continent none (the Bay\'s own law); the Ports filter inks a port alone, asks no countryside mark, and the hover and the press read the city it inks (mutants: no anchor; the anchor on the continent; the filter unread by the ink; the countryside under the filter; the hover past the filter; the port lost)', () => {
  const [px, py] = bayToPicture(-400, -300), [qx, qy] = bayToPicture(-420, -300);
  const cities = arenaInkCities({ places: [
    { name: 'Dawnstar', province: 'Skyrim', provinceIndex: 2, id: 3, kind: 'town', px, py, port: true },
    { name: 'Dragon Bridge', province: 'Skyrim', provinceIndex: 2, id: 5, kind: 'town', px: qx, py: qy },
  ] });
  assert.deepEqual(cities.map((c) => [c.name, c.port]), [['Dawnstar', true], ['Dragon Bridge', false]]);
  const ink = { ...buildTamrielInk(), cities: [{ ...cities[0], x: -400, y: -300 }, { ...cities[1], x: -380, y: -300 }] };
  const view = { ox: -460, oy: -340, scale: 2 };
  const anchors = (ctx) => ctx.calls.filter((c) => c.fn === 'moveTo').map((c) => c.args.map((v) => +v.toFixed(3)).join(','));
  const shank = (x, y) => { const [sx, sy] = toPaper(view, x, y); return `${+(sx + 8).toFixed(3)},${+(sy - 5).toFixed(3)}`; };
  let ctx = recordingCtx();
  paintTamrielInk(ctx, view, ink, { paperW: 900, paperH: 560 });
  assert.equal(anchors(ctx).filter((a) => a === shank(-400, -300)).length, 2, 'Dawnstar\'s anchor, haloed and inked, beside its glyph');
  assert.equal(anchors(ctx).filter((a) => a === shank(-380, -300)).length, 0, 'an inland town none');
  ctx = recordingCtx();
  paintTamrielInk(ctx, view, { ...ink, cities: ink.cities.map((c) => ({ ...c, capital: true })) }, { paperW: 900, paperH: 560, continent: true });
  assert.equal(anchors(ctx).filter((a) => a === shank(-400, -300)).length, 0, 'out on the continent no anchor, as the Bay draws none there');
  const named = (o) => { const c = recordingCtx(); paintTamrielInk(c, view, ink, { paperW: 900, paperH: 560, ...o }); return c.calls.filter((k) => k.fn === 'fillText').map((k) => k.args[0]); };
  assert.deepEqual(named({}).filter((n) => n === 'Dawnstar' || n === 'Dragon Bridge'), ['Dawnstar', 'Dragon Bridge']);
  assert.deepEqual(named({ portsOnly: true }).filter((n) => n === 'Dawnstar' || n === 'Dragon Bridge'), ['Dawnstar'], 'the Ports filter: a port alone');
  // the hover and the press read the city the sheet inks
  assert.equal(tamrielCityAt(-380, -300, view, ink, {})?.name, 'Dragon Bridge');
  assert.equal(tamrielCityAt(-380, -300, view, ink, { portsOnly: true }), null, 'the press: no town the filter hides');
  assert.equal(tamrielCityAt(-400, -300, view, ink, { portsOnly: true })?.name, 'Dawnstar');
  assert.notEqual(tamrielHoverAt(-380, -300, view, ink, { placesIn: null, portsOnly: true })?.on, 'city', 'the hover: none either');
  // the countryside and the lairs: no harbour (TESA7) - none under the filter
  const placesIn = () => [{ x: -390, y: -290, type: T.TownHamlet, name: 'Ivarstead' }];
  const near = { ox: -460, oy: -340, scale: 6 };
  assert.equal(tamrielMarksIn(near, placesIn, { paperW: 900, paperH: 560, band: 'near' }).length, 1);
  assert.deepEqual(tamrielMarksIn(near, placesIn, { paperW: 900, paperH: 560, band: 'near', portsOnly: true }), []);
  const [mx] = toPaper(near, -389.5, -289.5);
  const at = (o) => { const c = recordingCtx(); paintTamrielInk(c, near, ink, { paperW: 900, paperH: 560, placesIn, ...o }); return c.calls.filter((k) => k.fn !== 'fillText' && k.fn !== 'strokeText' && typeof k.args[0] === 'number' && Math.abs(k.args[0] - mx) < 6).length; };
  assert.ok(at({}) > 0, 'the hamlet\'s glyph on the sheet');
  assert.equal(at({ portsOnly: true }), 0, 'and none under the Ports filter');
  // the window hands the filter to the ink, its kept tiles, its hover and its press
  const H = read('src/ui/heldMap.js'), I = read('src/ui/tamrielInk.js');
  assert.match(H, /placesIn: this\.deps\.tamrielPlacesIn \?\? null,\n\s+portsOnly: this\.portsFilter,/);
  assert.match(I, /key: `\$\{band\}\|\$\{continent \? 1 : 0\}\|\$\{JSON\.stringify\(past\.filters\)\}\|\$\{JSON\.stringify\(past\.inks\)\}\|\$\{past\.portsOnly \? 1 : 0\}`/, 'a kept tile painted again when the filter moves');
  assert.match(I, /filters: opts\.filters \?\? \{\}, portsOnly: !!opts\.portsOnly, frame: opts\.frame \?\? null \}\);/, 'the marks under it (PIN MOVED, MARKS-PER-VIEW: paintPastBayMarks)');
});

test('BAY-LEFT-MAPS C11 THE TELEPORT CARD\'S PROVINCE: a bare pixel past the Bay names its province by the politic map\'s region (WW-R), a Bay pixel its region as before, the sea none (mutants: MAPS.BSA\'s count back)', () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  const at = new Map([['1569,-430', 128 + 64], ['2069,658', 128 + 70], ['500,250', 128 + 17], ['10,10', 64]]);
  const win = heldMap({ maps: { regionCount: 62, getPoliticIndex: (x, y) => at.get(`${x},${y}`) ?? 0, getRegion: () => null } });
  assert.deepEqual([win._regionNameAt(1569, -430), win._regionNameAt(2069, 658), win._regionNameAt(500, 250), win._regionNameAt(10, 10)], ['Skyrim', 'Cyrodiil', 'Daggerfall', '']);
});

// ── ON THE PLAYER'S DATA ──────────────────────────────────────────────────────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAS = !!ARENA2 && ['MAPS.BSA', 'ART_PAL.COL', 'TAMRIEL2.IMG', 'TMAP00I0.IMG', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

test('BAY-LEFT-MAPS C9 x C11 on the player\'s data: every one of the registry\'s 296 names past the Bay is in the find box\'s rows (lane C\'s p1: 0 of 296 before); a city\'s port is the registry\'s word for it; Solitude a port and found under the Ports filter, Whiterun neither', { skip: !HAS && 'no ARENA2_PATH' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../src/world/arenaLocations.js');
  const { arenaPixels, setArenaStanding } = await import('../../src/world/arenaPlaces.js');
  const { pastBayPlaceRows } = await import('../../src/world/pastBayRows.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const gameRows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) gameRows.push(loc); } }
  setArenaStanding(true);
  setCapitalsStanding(true);
  const t = arenaTemplates(gameRows);
  const registry = pastBayPlaceRows({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(t, p), capitals: true });
  const ink = tamrielInkFor(null);
  const rows = tamrielFindRows(ink);
  const found = new Set(rows.map((r) => r.name)), names = new Set(registry.map((r) => r.name));
  assert.equal(names.size, 296);
  assert.deepEqual([...names].filter((n) => !found.has(n)), [], 'every name past the Bay found');
  // a city's port is the registry's word: an Arena place's own row (a lore capital that is none of the capitals that stand,
  // Hegathe's, its own too), a standing capital its harbour slice's
  const byId = new Map(registry.map((r) => [r.mapId >>> 0, r]));
  let ports = 0, checked = 0;
  for (const c of ink.cities) {
    const row = byId.get(c.mapId >>> 0);
    if (!row) continue;   // no clone of its kind: no row (world/pastBayRows.js)
    const k = c.capital ? CAPITALS.findIndex((cap) => cap.name === c.name && cap.province === c.province) : -1;
    const span = new Set(k >= 0 ? capitalSpanPixels(k).map((q) => `${q.x},${q.y}`) : []);
    const want = k >= 0 ? registry.some((r) => r.port && span.has(`${r.px},${r.py}`)) : row.port;   // a capital's: a port row among its slices (its harbour's)
    assert.equal(c.port, want, `${c.name}: its port as the registry's`);
    checked++; if (c.port) ports++;
  }
  assert.ok(checked > 200 && ports > 20, `${checked} cities, ${ports} ports`);
  const sol = rows.find((r) => r.name === 'Solitude'), wr = rows.find((r) => r.name === 'Whiterun');
  assert.deepEqual([sol.port, sol.regionName, wr.port, wr.regionName], [true, 'Skyrim', false, 'Skyrim']);
  skin('enhanced');
  globalThis.document = fakeDocument();
  const win = heldMap();
  win.portsFilter = true;
  assert.ok(win._findLocations('Solitude').some((e) => e.pastBay && e.name === 'Solitude'), 'Solitude, a port, under the filter');
  assert.ok(!win._findLocations('Whiterun').some((e) => e.pastBay && e.name === 'Whiterun'), 'Whiterun, inland, not');
  win.portsFilter = false;
  assert.ok(win._findLocations('Whiterun').some((e) => e.pastBay && e.name === 'Whiterun'), 'and found without it');
});
