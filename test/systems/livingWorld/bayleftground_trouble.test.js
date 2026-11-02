// BAY-LEFT-GROUND (2026-10-26, bible/06-Systems/Living-World-II.md; the audit "no system left behind in the Bay", D2) -
// THE ROAD'S TROUBLE ON THE LAND'S OWN WILD. The living world's trouble handed the encounter law no `fauna`, so a caravan
// past the Bay was beset out of Daggerfall's climate tables (Black Marsh's: Centaurs, Orcs, Orc Warlords), against
// TESA-BIOME's recorded choice 4 (a province's own beasts). The trouble now hands the place it falls, and the host's
// producer (scenes/livingWorld/troubleFoes.js) rolls the group on that pixel's zone's band; on the Bay a pixel is no
// zone's and the roll is the climate's, roll for roll.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { livingMap, partiesOver } from '../../lwRoads.mjs';
import { troubleOf } from '../../../src/systems/livingWorld/trouble.js';
import { troubleFoesOf } from '../../../src/scenes/livingWorld/troubleFoes.js';
import { rollGroupComposition } from '../../../src/systems/campEncounters.js';
import { lwRng } from '../../../src/systems/livingWorld/seed.js';
import { faunaBandAt, installTamrielFauna, biomeTable } from '../../../src/systems/tamrielFauna.js';
import { _resetEncounterTableSelectors } from '../../../src/characters/encounterTableDoor.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, pictureToBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { tamrielBiomeAt } from '../../../src/world/tamriel/tamrielBiomes.js';

const pixelOf = (name) => pictureToBay(...CITIES.find((c) => c.name === name).at).map(Math.floor);
/** The host's query for seed `s` at (px, py) on `climateIndex`, as trouble.js builds it. */
const query = (s, climateIndex, px, py) => ({ climateIndex, px, py, minute: (s * 97) % 1440, level: 1 + (s % 15), size: 1 + (s % 5), rolls: lwRng(s * 7919 + px, py) });
/** What the law rolls with `fauna` handed (or none) for the same query - the other encounter paths' own call. */
const direct = (s, climateIndex, px, py, fauna) => {
  const q = query(s, climateIndex, px, py);
  return rollGroupComposition({ climateIndex, ...(fauna === undefined ? {} : { fauna }), skyMinutes: q.minute, inLocationRect: false, playerLevel: q.level, size: q.size }, q.rolls)?.mobileTypes ?? null;
};
const SEEDS = Array.from({ length: 240 }, (_, i) => i + 1);

test('BAY-LEFT-GROUND D2 the trouble hands the host the place it falls: every encounter on the land asks foesOf with its own pixel (px, py) beside the climate there (mutants: the pixel left out of the query)', () => {
  const map = livingMap();
  const asked = [];
  const world = { ...map.trouble, foesOf: (q) => { asked.push(q); return map.trouble.foesOf(q); } };
  const hit = partiesOver(map, 400, 440).filter((t) => t.enc && !t.enc.inside && !t.enc.band).slice(0, 120);
  assert.ok(hit.length >= 60, `trips beset on the land (${hit.length})`);
  const got = [], want = [];
  for (const t of hit) {
    asked.length = 0;
    const enc = troubleOf(t, world);
    const q = asked.at(-1);
    got.push([q.px, q.py, q.climateIndex]);
    want.push([enc.px, enc.py, map.trouble.climateAt(enc.px, enc.py)]);
  }
  assert.deepEqual(got, want, 'the query\'s pixel is the encounter\'s own');
});

test('BAY-LEFT-GROUND D2 the host\'s producer rolls the group on the pixel\'s own wild: past the Bay its zone\'s band (the same roll the other encounter paths make with `fauna`), every foe of the zone\'s tables; on the Bay the climate\'s, roll for roll (mutants: the band never read; the band read at another pixel; the Bay given a band)', () => {
  setTamrielTrace(null);   // the authored shape - no game data
  installTamrielFauna();
  try {
    const foesOf = troubleFoesOf({ faunaAt: faunaBandAt });
    // past the Bay: the Imperial City's valley, Black Marsh's capital, Skyrim's Whiterun
    for (const name of ['Imperial City', 'Helstrom', 'Whiterun']) {
      const [px, py] = pixelOf(name);
      const band = faunaBandAt(px, py);
      assert.ok(band, `${name}: a zone's band (${tamrielBiomeAt(px, py)?.key})`);
      const climate = 228;
      const got = SEEDS.map((s) => foesOf(query(s, climate, px, py)));
      assert.deepEqual(got, SEEDS.map((s) => direct(s, climate, px, py, band)), `${name}: the zone's band's roll`);
      const tables = new Set(band.flatMap((i) => biomeTable(i) ?? []));
      const off = got.flat().filter((m) => m != null && !tables.has(m));
      assert.deepEqual(off, [], `${name}: no foe off the zone's own tables`);
      assert.notDeepEqual(got, SEEDS.map((s) => direct(s, climate, px, py)), `${name}: not the climate's (Daggerfall's) tables`);
    }
    // the Bay: no zone's - the climate's own, roll for roll, as before
    for (const [px, py, c] of [[207, 213, 231], [560, 120, 226], [700, 420, 225]]) {
      assert.equal(faunaBandAt(px, py), null);
      assert.deepEqual(SEEDS.map((s) => foesOf(query(s, c, px, py))), SEEDS.map((s) => direct(s, c, px, py)), `(${px}, ${py}): the Bay's roll unchanged`);
    }
    // a dive's: the deep's own table, as before
    const dive = foesOf({ climateIndex: -1, dungeonType: 7, minute: 600, level: 5, size: 4, rolls: lwRng(9, 9) });
    assert.equal(dive.length > 0, true);
  } finally { _resetEncounterTableSelectors(); }
});

test('BAY-LEFT-GROUND D2 the world host wires its trouble world to the composed maps\' band (mutants: the host handing none)', () => {
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const livingTroubleWorld = \{\n\s+climateAt: \(px, py\) => maps\.getClimateIndex\(px, py\),\n\s+foesOf: troubleFoesOf\(\{ faunaAt: \(x, y\) => maps\.getFaunaBand\?\.\(x, y\) \}\),/);
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
test('BAY-LEFT-GROUND D2 with ARENA2: on the player\'s own trace and the composed maps, a caravan beset in Black Marsh, Skyrim, Elsweyr or Morrowind meets the zone\'s wild - none of the Bay\'s Orcs and Centaurs (the audit\'s probe, lane D p2)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { groundMaps } = await import('../../../src/world/tamriel/tamrielGround.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  groundMaps(maps);
  maps.getFaunaBand = faunaBandAt;   // as the world host composes it
  installTamrielFauna();
  try {
    const foesOf = troubleFoesOf({ faunaAt: (x, y) => maps.getFaunaBand?.(x, y) });
    const ORC_CENTAUR = new Set([7, 8, 12, 21, 24]);   // Orc, Centaur, Orc Sergeant, Orc Shaman, Orc Warlord - the Bay's woodlands and mountains (ENEMY_BASICS)
    for (const [name, px, py] of [['Helstrom', 3355, 1108], ['Whiterun', 1891, -202], ['Torval', 1922, 1705], ['Mournhold', 3293, 550]]) {
      const c = maps.getClimateIndex(px, py), band = maps.getFaunaBand(px, py);
      assert.ok(band, `${name}: a zone's band`);
      const got = SEEDS.map((s) => foesOf(query(s, c, px, py)));
      assert.deepEqual(got, SEEDS.map((s) => direct(s, c, px, py, band)), `${name}: the zone's own roll`);
      const tables = new Set(band.flatMap((i) => biomeTable(i) ?? []));
      assert.deepEqual(got.flat().filter((m) => m != null && !tables.has(m)), [], `${name}: every foe the zone's`);
      const before = SEEDS.map((s) => direct(s, c, px, py)).flat();
      if (name === 'Helstrom') assert.ok(before.some((m) => ORC_CENTAUR.has(m)), 'the old roll: the Bay\'s Orcs and Centaurs in Black Marsh');
      assert.deepEqual(got.flat().filter((m) => ORC_CENTAUR.has(m) && !tables.has(m)), [], `${name}: none of the Bay's Orcs and Centaurs`);
    }
  } finally { _resetEncounterTableSelectors(); setTamrielTrace(null); setTamrielFit(null); }
});
