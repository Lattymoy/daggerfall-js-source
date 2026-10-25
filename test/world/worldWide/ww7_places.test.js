// WW7 (2026-10-25, the owner: "we need the same city nodes populating the entire map of tamriel", "We also need to fully
// integrate our living world into the entirety of tamriel"; bible/03-World/World-Wide.md WW7): TESA's places in the
// world's registry, the living world's ways over the land past the Bay, a town by its map id the registry's past it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTownTable } from '../../../src/world/worldWide/townTable.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('WW7-1 a town by its map id: the Bay\'s own table first, else the registry\'s place past the Bay in the table\'s shape, else none (mutants: the registry unasked; the table\'s own row overridden)', () => {
  const places = createWorldPlaces();
  places.register('tesa-arena', [{ mapId: 0xa7_7a120, name: 'Northpoint', px: -40, py: 12, type: 0, w: 6, h: 6 }]);
  const table = createTownTable(() => places);
  table.set(5, { name: 'Daggerfall', px: 207, py: 213, region: 17, type: 0, location: 3 });
  assert.equal(table.get(5).name, 'Daggerfall', 'the Bay\'s own');
  assert.equal(table.get(5).location, 3);
  const past = table.get(0xa7_7a120);
  assert.deepEqual({ ...past }, { name: 'Northpoint', px: -40, py: 12, region: past.region, type: 0 });
  assert.equal(table.get(12345), undefined, 'none');
  assert.equal(createTownTable(() => null).get(0xa7_7a120), undefined, 'no registry yet: none');
  assert.ok(table.has(0xa7_7a120) && !table.has(12345));
  assert.equal(table.size, 1, 'the Bay\'s own count');
});

test('WW7-1 and WW7-2 by source: TESA\'s four providers registered after the Bay\'s in the build\'s order, again when the land, Arena or the capitals move, on the trace\'s landing (arenaWarm, in the module); the host hands the registry and holds no new line; the living world\'s ways walk the land past the Bay; the rosters kept by the town\'s record (mutants: a source unregistered; the version unkept; the beyond unwalked)', () => {
  const m = rd('src/scenes/tamrielPlacesHost.js');
  assert.match(m, /worldPlaces\.register\(TESA_SOURCES\.capitals, capitalRows\(\)\);\n\s+worldPlaces\.register\(TESA_SOURCES\.arena, arenaRows\(\)\);\n\s+if \(_countryTemplates\) worldPlaces\.registerPixels\(TESA_SOURCES\.country, countryRow\);\n\s+if \(_lairTemplates\) worldPlaces\.registerPixels\(TESA_SOURCES\.lairs, lairRow\);/, 'the build\'s order: a capital, an Arena place, the countryside, a lair');
  assert.match(m, /const key = `\$\{tamrielLandVersion\(\)\}\|\$\{arenaPlacesVersion\(\)\}\|\$\{capitalsVersion\(\)\}`;\n\s+if \(key === _registered\) return false;/);
  assert.match(m, /if \(!worldPlaces \|\| !tamrielLand\) return false;/, 'only where the land past the Bay stands');
  assert.match(m, /const arenaWarm = \(\) => \{\n\s+registerTamrielPlaces\(\);/);
  assert.match(m, /function arenaLocationAt\(px, py\) \{\n\s+registerTamrielPlaces\(\);/);
  assert.match(m, /function capitalLocationAt\(px, py\) \{\n\s+registerTamrielPlaces\(\);/);
  assert.match(m, /return at && \{ mapId: lairPlaceId\(at\.c\), name: at\.name, px, py, type: at\.pick\.type, dungeonType: at\.dungeonType \?\? 0, hasDungeon: true \};/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /_lairTemplates, arenaJoinLand, arenaRoadsLanded, arenaStands, blocks, locationIndex, maps, tamrielLand, terrainGen,\n\s+woodsBytes, worldPlaces,/);
  assert.ok(!/const arenaWarm = \(\) =>/.test(w), 'arenaWarm the module\'s');
  assert.match(w, /const _townOfMapId = createTownTable\(\(\) => worldPlaces\);/);
  assert.match(w, /WATER_BYTE, 1000, 500, \(px, py\) => \(!!woods\.isTamrielGround \|\| !!woods\.etherLaw\?\.\(px, py\)\) && woods\.getHeightMapValue\(px, py\) > WATER_BYTE\)\),/);
  assert.match(w, /const _livingRosters = new WeakMap\(\);/);
  assert.match(w, /rosterOf: \(t\) => \{ let r = _livingRosters\.get\(t\); if \(!r\) \{ r = travellerRoster\(t\); _livingRosters\.set\(t, r\); \} return r; \},/);
});
