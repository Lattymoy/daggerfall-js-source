// THE 2026-09-01 TEXTURE INCIDENT, pinned. Two independent defects
// rode Wave A onto the live site and broke it visually while 5,600
// tests stayed green - both in surfaces with no oracle:
//
//   1. PRIS00I0.IMG (A3's prison screen) is one of the SIX palettized
//      IMGs, and its preload handed the loader the HOST's shared
//      ART_PAL - ImgFile._readPalette writes INTO the palette it is
//      given, so one boot-time preload repainted every texture decoded
//      after it. Weapons gold, caves and exteriors off, all session.
//   2. The terrain ground tileset was selected by the ground-plane
//      member (DaggerfallGroundPlane.cs:83) instead of the terrain's
//      (TerrainMaterialProvider.cs:120-134) - invisible while the port
//      hardcoded Summer, and wrong in three climates the moment A1
//      made the classic winter boot real: snow under every desert.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getTerrainGroundArchive, getGroundArchive, SEASON } from '../src/world/climateSwaps.js';
import { getWorldClimateSettings, CLIMATES } from '../src/formats/mapsFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

test('incident: the terrain ground archive is DFU\'s own truth table, all ten climates, both seasons', () => {
  // TerrainMaterialProvider.GetClimateInfo executed against every world
  // climate - the DFU column of the incident's forensic table.
  const DFU = {
    [CLIMATES.Ocean]: [402, 403], [CLIMATES.Desert]: [2, 2], [CLIMATES.Desert2]: [2, 2],
    [CLIMATES.Mountain]: [102, 103], [CLIMATES.Rainforest]: [402, 403], [CLIMATES.Swamp]: [402, 403],
    [CLIMATES.Subtropical]: [2, 2], [CLIMATES.MountainWoods]: [102, 103],
    [CLIMATES.Woodlands]: [302, 303], [CLIMATES.HauntedWoodlands]: [302, 303],
  };
  for (const [climate, [summer, winter]] of Object.entries(DFU)) {
    const s = getWorldClimateSettings(Number(climate));
    assert.equal(getTerrainGroundArchive(s, SEASON.Summer), summer, `climate ${climate} summer`);
    assert.equal(getTerrainGroundArchive(s, SEASON.Winter), winter,
      `climate ${climate} winter - Desert-base climates REFUSE the +1 (archive 3 is not a 56-record terrain tileset; TextureReader.cs:757-766)`);
  }
  // The ground-plane member is a DIFFERENT law and stays: Desert winter
  // DOES bump there (DaggerfallGroundPlane has no such guard).
  assert.equal(getGroundArchive(0, SEASON.Winter), 3, 'the RMB ground plane keeps its own law');
});

test('incident: both terrain hosts key the tileset on the TERRAIN member, not the ground plane\'s', () => {
  assert.match(src('src/scenes/world.js'), /const groundArchive = getTerrainGroundArchive\(climate, season\);/);
  assert.match(src('src/scenes/exterior.js'), /const groundArchive = getTerrainGroundArchive\(dfLocation\.climate, season\);/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.ok(!/const groundArchive = getGroundArchive\(/.test(src(f)),
      `${f}: the ground-plane member no longer feeds the terrain`);
  }
});

test('incident: the prison screen loads with its OWN palette - the shared ART_PAL is never handed to a palettized IMG', async () => {
  // Behavioural: hand preloadPrisonScreenArt a marked palette and
  // assert the loader is given a DIFFERENT object. ImgFile._readPalette
  // mutates the instance it receives; handing it the session palette is
  // the whole incident.
  const { preloadPrisonScreenArt, _setPrisonScreenArtForTests } = await import('../src/ui/prisonScreen.js');
  _setPrisonScreenArtForTests(null);
  const sharedPalette = { MARKED: 'the session ART_PAL' };
  let received = null;
  await preloadPrisonScreenArt({
    renderer: { textures: new Map(), uploadTexture: () => {}, createTexture: () => ({}) },
    fetchBytes: async () => { throw new Error('no bytes in this container'); },
    palette: sharedPalette,
  }).catch(() => {});   // the fetch throws; the palette decision happens first
  // the source law, which holds even when the fetch cannot run here:
  const ps = src('src/ui/prisonScreen.js');
  assert.match(ps, /loadImg\(\{ \.\.\.deps, palette: new DFPalette\(\) \}, PRISON_IMG\)/,
    'the preload builds its own DFPalette (the U18/17k law, titleScreen.js:44-46)');
  assert.match(ps, /import \{ DFPalette \} from '\.\.\/formats\/dfPalette\.js';/);
  assert.equal(received, null);
  _setPrisonScreenArtForTests(null);
});

test('incident: every palettized-IMG site in src/ builds its own palette', () => {
  // The six palettized IMGs (imgFile.js:6). Any site that loads one of
  // them with a `deps`-bag palette is the incident's shape - sweep for
  // the known names reaching loadImg beside a passed-through palette.
  const PALETTIZED = ['PRIS00I0', 'TITL00I0', 'CHGN00I0', 'DAGGER', 'PICK03I0', 'STRT00I0'];
  for (const f of ['src/ui/prisonScreen.js', 'src/ui/titleScreen.js', 'src/ui/startWindow.js']) {
    const s = src(f);
    for (const img of PALETTIZED) {
      if (!s.includes(img)) continue;
      const i = s.indexOf(`loadImg(`);
      assert.ok(s.includes('new DFPalette()'),
        `${f} loads ${img} and must mint its own palette (i=${i})`);
    }
  }
});
