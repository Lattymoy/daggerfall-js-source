// FLORA-GROUND (FIELD BUGS 2026-10-27, the owner: "Plus floating flora and reflective flora can be seen off the ground in
// first person"; the coordinator: "Prove it across the sample cells on the real data") - THE GROUND'S ONE LAW ON THE
// GAME'S OWN GROUND (ARENA2): five cells built as the stream builds them, every plant on the walk floor
// (world/terrain/terrainSurface.js walkGroundAt). Its own file, apart from floraground.test.js, so the mutants' runs stay
// quick; skipped without the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { walkGroundAt } from '../../../src/world/terrain/terrainSurface.js';
import { groundAt, MAX_STEEPNESS, SLOPE_SINK_RATIO } from '../../../src/world/terrain/terrainNature.js';

const SINK = MAX_STEEPNESS / SLOPE_SINK_RATIO;   // the deepest a flat is sunk into its slope (DFU's steepness / 70)

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('FLORA-GROUND on the game\'s own ground (ARENA2): the Bay\'s wilderness, a slope, a coast, a town and past the Bay, built as the stream builds them (the Landforms row, the climates, Basic Roads\' network, the woods) - no plant more than 5 cm off the walk floor, none sunk past its slope; where the woods stood on the bilinear patch, hundreds stood over the drawn ground', { skip: skipReal }, async () => {
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile, getWorldClimateSettings, longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { generatePixelTerrain } = await import('../../../src/world/terrain/terrainGen.js');
  const { setLocationTiles } = await import('../../../src/world/terrain/terrainTiles.js');
  const { landformClimates } = await import('../../../src/world/landforms.js');
  const { groundWoods } = await import('../../../src/world/tamriel/tamrielGround.js');
  const b = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const raw = new WoodsFile(); raw.load(b('WOODS.WLD'));
  const woods = groundWoods(raw);   // the continent round the Bay, as the world host stands it (its authored shape)
  const maps = new MapsFile(); maps.load(b('MAPS.BSA'), b('CLIMATE.PAK'), b('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(b('BLOCKS.BSA'));
  const climates = landformClimates((x, y) => maps.getClimateIndex(x, y));
  const vb = (f) => new Uint8Array(readFileSync(new URL(`../../../vendor/roads-hazelnut/${f}`, import.meta.url)));
  const roads = { roads: vb('roadData.bytes'), tracks: vb('trackData.bytes'), rivers: vb('riverData.bytes'), streams: vb('streamData.bytes'), water: false, smooth: true };
  const town = maps.getLocationByName('Daggerfall', 'Daggerfall');
  const tp = longitudeLatitudeToMapPixel(town.mapTableData.longitude, town.mapTableData.latitude);
  const cells = [
    { what: 'the Bay\'s wilderness', px: 500, py: 340 },
    { what: 'a slope', px: 780, py: 460 },
    { what: 'a coast', px: 540, py: 300 },
    { what: 'a town (Daggerfall)', px: tp.x, py: tp.y, loc: town },
    { what: 'past the Bay', px: 1050, py: 200 },
  ];
  const report = [];
  let stoodOver = 0;
  for (const c of cells) {
    const cl = getWorldClimateSettings(maps.getClimateIndex(c.px, c.py));
    const tilemap = new Uint8Array(128 * 128);
    const rect = c.loc ? setLocationTiles(c.loc, maps, blocks, tilemap) : null;
    const out = generatePixelTerrain({ woods, px: c.px, py: c.py, tilemap, locationRect: rect, hasLocation: !!c.loc, climateType: cl.climateType, roads, climates, landform: true, forests: { archive: cl.natureArchive, hidden: false } });
    let over = 0, under = 0, bilinear = 0;
    for (const f of out.nature) {
      const g = walkGroundAt(out.samples, f.x, f.z), off = f.y - g;
      if (off > 0.05) over++;
      if (off < -SINK - 1e-6) under++;
      if (groundAt(out.samples, f.x, f.z) + off - g > 0.05) bilinear++;   // the same flat stood on the bilinear patch, its sink kept
    }
    report.push(`${c.what} (${c.px},${c.py}): ${out.nature.length} flats, ${over} over the walk floor, ${bilinear} on the old patch`);
    assert.ok(out.nature.length > 300, `${c.what}: ${out.nature.length} flats`);
    assert.equal(over, 0, `${c.what}: ${over} flats more than 5 cm over the walk floor`);
    assert.equal(under, 0, `${c.what}: ${under} flats sunk past their slope`);
    if (!c.loc) assert.ok(bilinear > 0, `${c.what}: the cell reaches the bug - ${bilinear} flats stood over the drawn ground on the bilinear patch`);
    stoodOver += bilinear;
  }
  assert.ok(stoodOver > 300, `${stoodOver} flats of the five cells stood more than 5 cm over the drawn ground on the bilinear patch`);
  console.log(`# FLORA-GROUND ${report.join('; ')}`);
});
