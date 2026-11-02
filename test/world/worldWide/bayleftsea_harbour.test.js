// BAY-LEFT-SEA (2026-10-26; the audit "no system left behind in the Bay", item 30 - C5; the owner's call taken: "Every
// single thing here needs to be addressed. No exceptions."): A HARBOURMASTER AT EVERY PORT PAST THE BAY - a port past the
// Bay keeps the nearest Bay crown's office (navalShips.js crownOf over the three capitals: the law a Bay port's crown is
// read by, the crown whose colours its navy already flies), so its board, contracts, letter of marque and Admiralty
// carrack stand there. The Eltheric freeports stay crownless - ETHER-PORTS' recorded design (bible/03-World/
// Eltheric-Ocean.md, "No crown's: ... THE FREEPORT'S HARBOURMASTER is the tab instead"). On the freeware: the 36 ports
// past the Bay, each with its crown and a board (bible/03-World/Captains-Sea.md BAY-LEFT-SEA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { beyondPorts, createWorldPorts } from '../../../src/world/worldWide/worldPorts.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { crownOf } from '../../../src/systems/naval/navalShips.js';
import { createHarbourOffice } from '../../../src/scenes/harbourOffice.js';
import { createCaptainLedger } from '../../../src/systems/naval/captainLedger.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const FIT = { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 };   // the freeware's fit
/** The three capitals' map pixels as MAPS.BSA places them (the freeware's - world.js navalCapitals). */
const CAPITALS = [{ region: 17, x: 207, y: 213 }, { region: 23, x: 859, y: 244 }, { region: 20, x: 397, y: 343 }];
const crownAt = (x, y) => crownOf(x, y, CAPITALS).name;
const officeAt = (port, ports = [port]) => createHarbourOffice({ ledger: createCaptainLedger(), now: () => 0, day: () => 10, level: () => 10, gold: () => 100000, port: () => port, ports: () => ports, seaAt: () => true });

test('BAY-LEFT-SEA THE PORTS PAST THE BAY KEEP THE NEAREST BAY CROWN\'S OFFICE: each port\'s crown the host\'s crownAt at its pixel - none without one (mutants: the crown never asked; asked at another pixel; the list unhanded it)', () => {
  setTamrielTrace(null); setTamrielFit(null);
  const places = createWorldPlaces();
  places.register('tesa', [
    { mapId: 0x0a77a001, name: 'Solitude', px: 1569, py: -430, type: LOCATION_TYPES.TownCity, port: true },
    { mapId: 0x0a77a002, name: 'Alinor', px: 8, py: 1533, type: LOCATION_TYPES.TownCity, port: true },
    { mapId: 0x0a77a003, name: 'Northpoint', px: 407, py: -259, type: LOCATION_TYPES.TownHamlet, port: true },
  ]);
  const sea = () => true;
  assert.deepEqual(beyondPorts(places, sea).map((p) => [p.name, p.crown]), [['Solitude', null], ['Alinor', null], ['Northpoint', null]], 'no crownAt: none (the law\'s shape before the host hands it)');
  assert.deepEqual(beyondPorts(places, sea, crownAt).map((p) => [p.name, p.crown]), [['Solitude', 'Wayrest'], ['Alinor', 'Sentinel'], ['Northpoint', 'Daggerfall']]);
  const asked = [];
  beyondPorts(places, sea, (x, y) => { asked.push([x, y]); return 'Wayrest'; });
  assert.deepEqual(asked, [[1569, -430], [8, 1533], [407, -259]], 'asked at each port\'s own pixel');
  assert.deepEqual(createWorldPorts({ places, openSea: sea, crownAt }).list().map((p) => p.crown), ['Wayrest', 'Sentinel', 'Daggerfall'], 'the kept list carries it');
  assert.deepEqual(createWorldPorts({ places, openSea: sea }).list().map((p) => p.crown), [null, null, null]);
});

test('BAY-LEFT-SEA THE HARBOURMASTER\'S TAB STANDS PAST THE BAY: the office\'s model, board, letter of marque and the Admiralty\'s carrack at a port past the Bay - none at a crownless one, as before; the Eltheric freeport crownless as ETHER-PORTS recorded (mutants: the crown unread)', () => {
  setTamrielTrace(null); setTamrielFit(null);
  const places = createWorldPlaces();
  places.register('tesa', [{ mapId: 0x0a77a001, name: 'Solitude', px: 1569, py: -430, type: LOCATION_TYPES.TownCity, port: true }, { mapId: 0x0a77a004, name: 'Dawnstar', px: 1809, py: -384, type: LOCATION_TYPES.TownCity, port: true }]);
  const before = createWorldPorts({ places, openSea: () => true }).list();
  const ports = createWorldPorts({ places, openSea: () => true, crownAt }).list();
  const was = officeAt(before[0], before);
  assert.equal(was.model({ uid: 1 }), null, 'the audit\'s finding: no Harbormaster tab past the Bay');
  assert.deepEqual(was.board(), []);
  const o = officeAt(ports[0], ports);
  const m = o.model({ uid: 1 });
  assert.equal(m.port, 'Solitude');
  assert.equal(m.crown, 'Wayrest');
  assert.ok(m.board.length > 0 && m.board.every((b) => b.standing.endsWith('with Wayrest')), JSON.stringify(m.board.map((b) => b.title)));
  assert.equal(o.board().length, m.board.length);
  assert.deepEqual([typeof m.marque.price, typeof m.admiralty.price], ['string', 'string'], 'the letters offered');
  const isle = { key: '700,40', name: 'Veilhaven', px: 700, py: 40, region: 61, crown: null, ether: true };   // world.js etherPortOf's shape
  assert.equal(officeAt(isle).model({ uid: 1 }), null, 'a freeport stands its own harbourmaster (etherHost.js office), no crown\'s');
});

const realSkip = HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
test('BAY-LEFT-SEA (ARENA2): on the freeware all 36 ports past the Bay keep a crown\'s office - Wayrest\'s 24, Sentinel\'s 11, Daggerfall\'s Northpoint - each with its board', { skip: realSkip }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { MapsFile, REGION_NAMES, longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { groundWoods, groundMaps, tamrielClimateAt } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../../src/world/arenaLocations.js');
  const { arenaPixels, pastBayLakeAt } = await import('../../../src/world/arenaPlaces.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await import('../../../src/world/pastBayRows.js');
  const { CROWNS } = await import('../../../src/systems/naval/navalShips.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit(FIT);
  try {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    // world.js navalCapitals: the three crowns' capitals off MAPS.BSA
    assert.deepEqual(CROWNS.map((c) => { const l = maps.getLocationByName(REGION_NAMES[c.region], c.name); const p = longitudeLatitudeToMapPixel(l.mapTableData.longitude, l.mapTableData.latitude); return { region: c.region, x: p.x, y: p.y }; }), CAPITALS);
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); } }
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const ground = groundWoods(woods);
    groundMaps(maps);
    const water = (x, y) => isWaterPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y));
    const templates = arenaTemplates(rows);
    const places = createWorldPlaces();
    places.register(PAST_BAY_SOURCE, pastBayPlaceRows({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(templates, p), capitals: true }));
    const ports = createWorldPorts({ places, openSea: (x, y) => water(x, y) && !pastBayLakeAt(x, y), crownAt }).list();
    const by = {};
    for (const p of ports) (by[p.crown] ??= []).push(p.name);
    assert.deepEqual(by, {
      // PIN MOVED (FIELD BUGS 2026-10-28b COAST-PORT): Farrun, Shornhelm, Blacklight, Tear, Elden Root, Thorn and Silinorin
      Wayrest: ['Imperial City', 'Solitude', 'Torval', 'Farrun', 'Jehanna', 'Shornhelm', 'Rihad', 'Windhelm', 'Winterhold', 'Dawnstar', 'Blacklight', 'Necrom', 'Ebonheart', 'Tear', 'Vivec', 'Elden Root', 'Haven', 'Woodhearth', 'Southpoint', 'Senchal', 'Lilmoth', 'Soulrest', 'Archon', 'Thorn'],
      Sentinel: ['Alinor', 'Hegathe', 'Taneth', 'Gilane', 'Dusk', 'Lillandril', 'Shimmerene', 'Sunhold', 'Firsthold', 'Skywatch', 'Silinorin'],
      Daggerfall: ['Northpoint'],
    });
    for (const port of ports) {
      const m = officeAt(port, ports).model({ uid: 1 });
      assert.ok(m && m.board.length > 0, `${port.name}: a harbourmaster and a board`);
    }
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});

test('BAY-LEFT-SEA THE HOST: the crowns\' capitals are read above the world\'s ports, whose harbours past the Bay are handed the nearest crown (mutants: the capitals read below - BOOT-TDZ)', () => {
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const caps = w.indexOf('  const navalCapitals = () => (_navalCapitals ??= NAVAL_CROWNS.map((c) => {'), ports = w.indexOf('  const worldPorts = createWorldPorts({');
  assert.ok(caps > 0 && ports > caps, 'navalCapitals declared before the world\'s ports ask it');
  assert.ok(w.indexOf('  let _navalCapitals = null;') < caps);
});
