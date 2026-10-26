// AUDIT TESA II, lane P (2026-10-25; bible/03-World/Arena-Provinces.md, bible/03-World/World-Wide.md) - THE PLACES PAST
// THE BAY ON THE WORLD'S REGISTRY AND THEIR SHORES: a live list on the registry (P7), the rows the places past the Bay
// stand (world/pastBayRows.js - P7, P13), a port's dry shore (P8), the picture's lakes (P12) and the names every client
// draws alike (P10) - on hand-made traces, and on the freeware's own where the law reads it.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createWorldPlaces } from '../../src/world/worldWide/worldPlaces.js';
import { pastBayPlaceRows, PAST_BAY_SOURCE } from '../../src/world/pastBayRows.js';
import { standArenaPixels, arenaPixels, pictureLakes, pastBayLakeAt, SHORE_DRY_REACH } from '../../src/world/arenaPlaces.js';
import { arenaTemplates, arenaTemplateOf, arenaPlaceId } from '../../src/world/arenaLocations.js';
import { CAPITALS, capitalPin, capitalSpan, capitalPlaceId, isCapitalPlaceId } from '../../src/world/tamrielCapitals.js';
import { setTamrielTrace, tamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, pictureToBay, bayToPicture, inBay } from '../../src/world/tamriel/tamrielFrame.js';
import { theatreOfArea, THEATRE_KEYS, areaAt } from '../../src/world/worldWide/worldGrid.js';
import { createLivingIndex } from '../../src/scenes/livingWorld/livingIndex.js';
import { nameBankOfArea } from '../../src/characters/areaNameBank.js';
import { BANK_TYPES, resetNameBanks, surname } from '../../src/characters/nameHelper.js';
import { countryName } from '../../src/world/tamrielCountry.js';
import { lairName } from '../../src/world/tamrielDungeons.js';
import { makeTamrielPlaces } from '../../src/world/tamrielPlaces.js';
import * as tm from '../../src/systems/textManager.js';
import { LOCATION_TYPES, DUNGEON_TYPES, MapsFile } from '../../src/formats/mapsFile.js';

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

/** The freeware's trace at the freeware's fit (TESA6's). */
async function freewareTrace() {
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
}
/** MAPS.BSA's rows with an exterior, as the world host's hub rows hold them. */
function gameRows() {
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    if (!maps.getRegion(r)) continue;
    for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); }
  }
  return rows;
}
/** A land of rectangles: [province, x0, y0, x1, y1] picture pixels, the rest the sea. */
function rectTrace(rects, holes = []) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (const [id, x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { land[y * w + x] = 1; province[y * w + x] = id; }
  for (const [x, y] of holes) { land[y * w + x] = 0; province[y * w + x] = 0; }
  return { w, h, land, province };
}

test('AUDIT TESA II P7 THE LIVE LIST: a provider\'s rows read again whenever its stamp moves - item by item - and the generation with them; never while it holds; a list or a drop of its name lets it go (mutants: the stamp unread; the rows kept when it moved; the generation still)', () => {
  const places = createWorldPlaces();
  const stamp = ['trace', 1];
  let made = 0, rows = [{ mapId: 0x341 << 20, name: 'Windhelm', px: 2215, py: -371, type: LOCATION_TYPES.TownCity }];
  places.registerLive(PAST_BAY_SOURCE, { stamp: () => [...stamp], rows: () => { made++; return rows; } });
  assert.equal(places.at(2215, -371)?.name, 'Windhelm');
  const g = places.generation();
  assert.equal(places.at(2215, -371)?.name, 'Windhelm');
  assert.equal(places.generation(), g, 'held: the same generation');
  assert.equal(made, 1, 'and the rows made once');
  rows = [{ mapId: 0x341 << 20, name: 'Windhelm', px: 2216, py: -371, type: LOCATION_TYPES.TownCity }];
  stamp[1] = 2;   // the fit moved
  assert.notEqual(places.generation(), g, 'the stamp moved: a new generation');
  assert.equal(places.at(2215, -371), null);
  assert.equal(places.at(2216, -371)?.name, 'Windhelm', 'the rows as they stand now');
  assert.equal(made, 2);
  assert.deepEqual(places.sources(), [PAST_BAY_SOURCE]);
  places.register(PAST_BAY_SOURCE, []);
  stamp[1] = 3;
  assert.equal(places.at(2216, -371), null, 'a list of its name replaced it');
  assert.equal(made, 2, 'never read again');
  places.registerLive(PAST_BAY_SOURCE, { stamp: () => [...stamp], rows: () => rows });
  assert.ok(places.at(2216, -371));
  places.drop(PAST_BAY_SOURCE);
  assert.equal(places.at(2216, -371), null, 'dropped');
  assert.deepEqual(places.sources(), []);
});

test('AUDIT TESA II P7/P13 (ARENA2) THE ROWS PAST THE BAY on the freeware\'s trace: every capital\'s every slice (the Imperial City\'s six hundred and twenty-five - PIN MOVED, IC-GRAND; TS5\'s forty-nine) and every other place a template clones, never a capital\'s pinned place twice; the 28 ports; on the registry each a town of its province\'s area - its people named by its province\'s bank, not its region\'s number read as an area (mutants: the slices; the pinned kept; the port\'s word; the area)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  await freewareTrace();
  const t = arenaTemplates(gameRows());
  const px = arenaPixels();
  const rows = pastBayPlaceRows({ pixels: px, templateOf: (p) => arenaTemplateOf(t, p), capitals: true });
  const slices = CAPITALS.reduce((n, c) => n + capitalSpan(c) ** 2, 0);
  const pinned = px.stood.filter((p) => p.pinned).length;
  assert.deepEqual([rows.length, slices, pinned], [px.stood.length - pinned + slices, 631, 7], 'the slices, and the stood places but the pinned');   // PIN MOVED (TS5): the Imperial City seven pixels a side; PIN MOVED (IC-GRAND): twenty-five (625 and the other six capitals' six)
  const ic = CAPITALS.findIndex((c) => c.name === 'Imperial City'), at = capitalPin({ name: CAPITALS[ic].name, province: CAPITALS[ic].province });
  const icRows = rows.filter((r) => isCapitalPlaceId(r.mapId) && (r.mapId & 0x7ffff) % 16 === ic);   // capitalPlaceId: k + 16 a slice
  assert.equal(icRows.find((r) => r.px === at.px && r.py === at.py)?.mapId, capitalPlaceId(ic, 0), 'the centre its capital\'s own id');
  const span = capitalSpan(CAPITALS[ic]), h = (span - 1) / 2;   // PIN MOVED (TS5): seven a side; PIN MOVED (IC-GRAND): twenty-five
  assert.equal(icRows.length, 625, 'the Imperial City\'s six hundred and twenty-five');
  assert.deepEqual(icRows.map((r) => [r.px - at.px, r.py - at.py]).sort(), Array.from({ length: span * span }, (_, s) => [s % span - h, Math.floor(s / span) - h]).sort());
  assert.ok(icRows.every((r) => r.type === LOCATION_TYPES.TownCity && r.w === 8 && r.h === 8));
  for (const p of px.stood.filter((q) => q.pinned)) assert.ok(!rows.some((r) => r.mapId === arenaPlaceId(p)), `${p.name} stands as its capital alone`);
  // PIN MOVED (NIBEN-SEA): 29 - the Imperial City's Waterfront a port, its canal through to the lake's arm
  assert.equal(rows.filter((r) => r.port).length, 29, 'the lore\'s ports, a pinned one its capital\'s centre, and the Imperial City\'s Waterfront');
  assert.deepEqual(icRows.filter((r) => r.port).map((r) => [r.px - at.px, r.py - at.py]), [[0, h]], 'the Imperial City\'s port its Waterfront\'s slice, on its south edge');
  assert.equal(pastBayPlaceRows({ pixels: px, templateOf: () => null, capitals: true }).length, slices, 'no clone, no place');
  // on the registry: a town of its province's area (P13)
  const places = createWorldPlaces();
  places.register(PAST_BAY_SOURCE, rows);
  const idx = createLivingIndex({ places, populated: (ty) => ty === LOCATION_TYPES.TownCity || ty === LOCATION_TYPES.TownVillage || ty === LOCATION_TYPES.TownHamlet, peopleAt: () => 0 });
  const windhelm = px.stood.find((p) => p.name === 'Windhelm');
  const town = idx.townAt(windhelm.bx, windhelm.by);
  assert.ok(town && town.area === areaAt(windhelm.bx, windhelm.by), 'its area the pixel\'s');
  assert.equal(theatreOfArea(town.area), THEATRE_KEYS.indexOf('Skyrim'));
  assert.equal(nameBankOfArea(town.area), BANK_TYPES.Nord, 'its people Nords');
});

test('AUDIT TESA II P8 A PORT ON THE DRY SHORE: the nearest shore pixel whose plateau stands above the beach, ring by ring from the shore\'s first ring and within SHORE_DRY_REACH of it; none dry there, the first ring\'s nearest as before; no dry law, as before (mutants: the dry law unread; the reach; the fallback)', () => {
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  setTamrielTrace(rectTrace([[3, 110, 20, 210, 80]]));
  const model = { places: [{ province: 'Skyrim', provinceIndex: 2, id: 0, kind: 'city-state', name: 'Solitude', px: 130.55, py: 25.5, snapped: 0, port: true }] };
  const stand = (dry) => { const p = standArenaPixels(model, tamrielTrace(), null, null, dry).stood[0]; return [p.bx, p.by, !!p.port]; };
  assert.equal(SHORE_DRY_REACH, 12);
  assert.deepEqual(stand(null), [905, -300, true], 'straight north to the coast');
  assert.deepEqual(stand(() => true), [905, -300, true]);
  assert.deepEqual(stand((x, y) => !(x === 905 && y === -300)), [904, -300, true], 'the beach under the nearest: the nearest dry beside it');
  assert.deepEqual(stand(() => false), [905, -300, true], 'none dry: the nearest');
  // the coast's first ring is 55 rings off: a dry pixel 12 rings past it is taken, one 13 past is not
  assert.deepEqual(stand((x, y) => x === 905 + 55 + 12 && y === -300), [972, -300, true]);
  assert.deepEqual(stand((x, y) => x === 905 + 55 + 13 && y === -300), [905, -300, true]);
});

test('AUDIT TESA II P12 THE PICTURE\'S LAKES: the water its border joins - eight ways round, as the Bay\'s open sea is flooded - is the sea, the rest a lake; a Bay pixel past the Bay on a lake\'s cell is one, never the Bay\'s, never with no picture (mutants: the flood four ways; the Bay\'s pixels read; the lake law unread)', () => {
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  // a block of land with a pond at (150, 50) and a cove at its north-west corner whose inner cell (111, 21) meets the
  // corner's water at a corner alone: the pond a lake, the cove the sea's
  const trace = rectTrace([[3, 110, 20, 210, 80]], [[150, 50], [151, 50], [110, 20], [111, 21], [120, 60]]);   // and a pond on the Bay's rectangle
  setTamrielTrace(trace);
  const L = pictureLakes(tamrielTrace());
  assert.deepEqual([L[50 * 320 + 150], L[50 * 320 + 151], L[21 * 320 + 111], L[10 * 320 + 10]], [1, 1, 0, 0], 'the pond a lake; the cove, its mouth a corner, the sea; the open sea none');
  assert.equal(pictureLakes(tamrielTrace()), L, 'kept a trace');
  const [bx, by] = pictureToBay(150.5, 50.5).map(Math.floor);
  assert.equal(pastBayLakeAt(bx, by), true);
  assert.equal(pastBayLakeAt(...pictureToBay(10.5, 10.5).map(Math.floor)), false, 'the sea');
  const [wx, wy] = pictureToBay(120.5, 60.5).map(Math.floor);
  assert.ok(L[60 * 320 + 120] === 1 && inBay(wx, wy));
  assert.equal(pastBayLakeAt(wx, wy), false, 'a pond the picture draws on the Bay: the Bay\'s water is WOODS.WLD\'s');
  setTamrielTrace(null);
  assert.equal(pastBayLakeAt(bx, by), false, 'no picture, no lake');
});

test('AUDIT TESA II P12 (ARENA2): the freeware\'s picture holds two lakes (PIN MOVED, NIBEN-SEA: Lake Rumare\'s ring round the Imperial City and the Niben the sea\'s, down the river) - and the open sea none (mutant: the lakes unflooded)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  await freewareTrace();
  const tr = tamrielTrace(), L = pictureLakes(tr), seen = new Uint8Array(L.length), sizes = [];
  for (let i = 0; i < L.length; i++) {
    if (!L[i] || seen[i]) continue;
    let n = 0;
    const st = [i]; seen[i] = 1;
    while (st.length) {
      const j = /** @type {number} */ (st.pop()), x = j % tr.w, y = (j - x) / tr.w;
      n++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, k = ny * tr.w + nx;
        if (nx >= 0 && ny >= 0 && nx < tr.w && ny < tr.h && L[k] && !seen[k]) { seen[k] = 1; st.push(k); }
      }
    }
    sizes.push(n);
  }
  assert.deepEqual(sizes.sort((a, b) => b - a), [20, 15], 'Hammerfell\'s two');   // PIN MOVED (NIBEN-SEA): [115, 49, 20, 15, 11] - the Niben and Lake Rumare's two pieces joined to the sea
  // Lake Rumare: the water on the picture within six picture pixels of the Imperial City's pin (the city's isle is four
  // across) - PIN MOVED (NIBEN-SEA): every such cell the open sea's, joined to the Topal Bay down the Niben
  const ic = CAPITALS.find((c) => c.name === 'Imperial City'), at = capitalPin({ name: ic.name, province: ic.province });
  const [cx, cy] = bayToPicture(at.px + 0.5, at.py + 0.5).map(Math.floor);
  let water = 0;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const k = (cy + dy) * tr.w + cx + dx; if (!tr.land[k]) { water++; assert.equal(L[k], 0, `(${cx + dx}, ${cy + dy}) Lake Rumare's, the sea's`); } }
  assert.ok(water > 30, `Lake Rumare round the city (${water})`);
});

test('AUDIT TESA II P10 THE NAMES PAST THE BAY are the game\'s banks\' on every client: a translation pack\'s NameGen names its people, never the places TESA stands (mutant: the session\'s banks read)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  await freewareTrace();
  const sig = () => makeTamrielPlaces(tamrielTrace()).places.map((p) => `${p.province}:${p.id}:${p.name}`);
  const farm = () => countryName(LOCATION_TYPES.HomeFarms, BANK_TYPES.Nord, 12345), keep = () => lairName(LOCATION_TYPES.DungeonKeep, 0, BANK_TYPES.Nord, 777);
  const coven = () => lairName(LOCATION_TYPES.DungeonLabyrinth, DUNGEON_TYPES.Coven, BANK_TYPES.Nord, 31);   // a woman's first name (%w)
  resetNameBanks();
  const a = [sig(), farm(), keep(), coven()];
  // a pack's NameGen: the game's banks with the Nord surname parts spelled as a translation might
  const banks = JSON.parse(readFileSync(new URL('../../src/characters/nameGen.json', import.meta.url), 'utf8'));
  for (const set of banks.Nord.sets) set.parts = set.parts.map((s) => s.toUpperCase());
  tm.registerLocale({ code: 'xq', name: 'Pack', englishName: 'Pack' });
  tm.setLocaleDocuments('xq', [['nameGen:NameGen', JSON.stringify(banks)]]);
  try {
    tm.setLocale('xq');
    resetNameBanks();
    // a person named first, as the game does (the session's banks are read at the first name made): the pack's
    assert.match(surname(BANK_TYPES.Nord), /^[A-Z]+sen$/, 'a Nord of the pack');
    const b = [sig(), farm(), keep(), coven()];
    assert.equal(a[0].length, 283);
    assert.deepEqual(b, a, 'every place, a farm, a keep and a coven alike');
    assert.deepEqual([a[1], a[2]], ['The Mojens Farmstead', 'Castle Ingmer']);
  } finally { tm.setLocale(tm.BASE_LOCALE); resetNameBanks(); }
  // the tavern words in DFU's English whatever the locale (a pack's Internal_Strings - the pseudo locale stands for one)
  const inn = () => countryName(LOCATION_TYPES.Tavern, BANK_TYPES.Nord, 4242);
  const base = inn();
  try {
    tm.setLocale(tm.PSEUDO_LOCALE);
    assert.equal(inn(), base, 'a tavern\'s name the game\'s');
  } finally { tm.setLocale(tm.BASE_LOCALE); }
  assert.match(base, /^The /);
});
