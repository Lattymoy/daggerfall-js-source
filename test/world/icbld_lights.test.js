// BLD (2026-10-26, the owner, having walked the Imperial City: "... and no lighting sources like the original layouts";
// bible/03-World/Arena-Provinces.md IC-GRAND, BLD) - THE FABRIC'S LIGHTS, pinned: Daggerfall's own lamp-posts (TEXTURE.210
// light flats) along its streets at its own blocks' density, in the block as a block's light flats are and lit by their
// law; and its facades' glass handed to the window upload, lit after dark as Daggerfall's windows are.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fabricCell, fabricGroundIn, GROUND } from '../../src/world/imperialFabric.js';
import { fabricCellLamps, FABRIC_LAMPS } from '../../src/world/imperialFabricLights.js';
import { imperialBlockJson, imperialOwnName } from '../../src/world/imperialBlocks.js';
import { IMPERIAL_CELLS, IMPERIAL_SECTORS, polar, imperialCell, imperialCellRect } from '../../src/world/imperialCity.js';
import { portBlockJson, startMarkerAt, miscModelAt } from '../../src/world/tamrielCapitals.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { collectCityLights, LIGHTS_ARCHIVE } from '../../src/world/city/cityLights.js';
import { standInWindowMask, facadeGlass, LIT_FACADES } from '../../src/world/imperialWindows.js';
import { FACADE_WINDOW, FACADE_TEXELS } from '../../src/world/imperialArt.js';
import { CAPITAL_ART, CAPITAL_ARCHIVE } from '../../src/world/capitalShapes.js';
import { capitalArt } from '../../src/world/capitalModels.js';
import { addVendorTextures, clearVendorTextures } from '../../src/systems/textureReplacement.js';
import { createDataPipeline } from '../../src/scenes/dataPipeline.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';

const B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
function sampleCell(x, z, n = 8) {
  const r0 = Math.floor(z / B + HALF), c0 = Math.floor(x / B + HALF);
  for (let k = 0; k < 6; k++) for (let r = r0 - k; r <= r0 + k; r++) for (let c = c0 - k; c <= c0 + k; c++) {
    if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== k || !/^I/.test(imperialCell(r, c) ?? '')) continue;
    if (fabricCell(r, c).plots.length >= n) return [r, c];
  }
  return null;
}
const CELLS = [...IMPERIAL_SECTORS.flatMap(([, b]) => [[b + 22.5, 3000], [b + 37.5, 5300]]), [170, 7300]].map(([b, r]) => sampleCell(...polar(b, r))).filter(Boolean);

test('BLD THE STREETS LIT AS DAGGERFALL\'S BLOCKS ARE - each cell\'s lamps Daggerfall\'s own street lamp-posts (TEXTURE.210 records 29 and 28, the freeware\'s commonest light flats), at most its blocks\' most (8) a cell and 18 m apart, each on the cell\'s own open street or square, the same on every client (mutants: the cap lifted; the spacing gone; a lamp on a building)', () => {
  assert.equal(FABRIC_LAMPS.archive, LIGHTS_ARCHIVE);
  assert.deepEqual([...FABRIC_LAMPS.posts], [29, 28]);
  assert.equal(FABRIC_LAMPS.perCell, 8, 'the freeware\'s 920 RMB blocks: 2.33 light flats a block, 8 the most');
  let lit = 0, lamps = 0;
  for (const [r, c] of CELLS) {
    const L = fabricCell(r, c), list = fabricCellLamps(r, c), [x0, z0, x1, z1] = imperialCellRect(r, c);
    assert.ok(list.length <= FABRIC_LAMPS.perCell, `cell ${r},${c}: ${list.length} lamps`);
    if (list.length) lit++;
    lamps += list.length;
    for (const [i, l] of list.entries()) {
      const [x, z] = l.at;
      assert.ok(FABRIC_LAMPS.posts.includes(l.record));
      assert.ok(x >= x0 && x < x1 && z >= z0 && z < z1, 'in its own cell');
      const g = fabricGroundIn(L, x, z);
      assert.ok(g === GROUND.street || g === GROUND.square, `cell ${r},${c}: a lamp on ground ${g}`);
      for (const o of list.slice(i + 1)) assert.ok(Math.hypot(o.at[0] - x, o.at[1] - z) >= FABRIC_LAMPS.spacing - 1e-9, 'two lamps a spacing apart');
    }
    assert.deepEqual(fabricCellLamps(r, c), list, 'kept, the same');
  }
  assert.ok(lit >= CELLS.length - 1 && lamps >= CELLS.length * 3, `the districts lit (${lit} of ${CELLS.length} cells, ${lamps} lamps)`);
});

test('BLD A CELL\'S LAMPS ARE ITS BLOCK\'S LIGHT FLATS - the own block carries them as misc flats of archive 210 by DFU\'s flat record law, so the exterior\'s own collector (world/city/cityLights.js collectCityLights: AddLights) lights each where it stands, a point light on its post (mutant: the block\'s flats without them)', () => {
  const [r, c] = CELLS[0];
  const deps = { portBlockJson, miscModelAt, startMarkerAt, footprintOf: () => null, anchorMarkers: [], noGround: 255, rim: () => false };
  const json = imperialBlockJson(imperialOwnName(r, c), deps), block = blockFromJson(json, 1);
  const lights = collectCityLights(block, () => ({ w: 1, h: 3 }));
  const lamps = fabricCellLamps(r, c);
  assert.ok(lamps.length > 0);
  assert.equal(lights.length, lamps.length, 'every lamp a light');
  // the block's own metres: the city's middle at (HALF - c) * B east, (r + 1 - HALF) * B north of the block's corner
  for (const [i, l] of lamps.entries()) {
    assert.ok(Math.abs(lights[i].x - ((HALF - c) * B + l.at[0])) < 0.03 && Math.abs(lights[i].z - ((r + 1 - HALF) * B - l.at[1])) < 0.03, `lamp ${i} lit where it stands`);
    assert.equal(lights[i].record, l.record);
  }
});

test('BLD THE WINDOWS LIT AT NIGHT - each wall\'s and the shopfront\'s glass read off its own painting is its window mask (white the glass, in the window\'s frame alone; the arcade\'s open arch none), bottom-up as the GL takes it, and the pipeline uploads it as a classic window\'s (DFU\'s IsExteriorWindow arm, render/realWindows.js) for the stand-in that carries it (mutants: the mask not turned bottom-up; the pipeline\'s arm gone)', async () => {
  const art = capitalArt(), [wx0, wy0, wx1, wy1] = FACADE_WINDOW.rect;
  assert.equal(facadeGlass(CAPITAL_ARCHIVE, CAPITAL_ART.groundArcade), null, 'an open arch is no glass');
  for (const record of LIT_FACADES) {
    const raw = facadeGlass(CAPITAL_ARCHIVE, record), gl = standInWindowMask(CAPITAL_ARCHIVE, record), img = art.get(record);
    assert.deepEqual([gl.width, gl.height], [img.width, img.height]);
    let glass = 0;
    for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) {
      const on = raw.data[(y * raw.width + x) * 4] === 255;
      assert.equal(gl.colors[((raw.height - 1 - y) * raw.width + x) * 4] === 255, on, 'the GL\'s rows bottom-up');
      if (!on) continue;
      glass++;
      if (record !== CAPITAL_ART.groundShop) assert.ok(x >= wx0 && x < wx1 && y >= wy0 && y < wy1, `glass at ${x},${y} outside the window`);
      const k = (y * img.width + x) * 4;
      assert.ok(img.data[k + 2] > img.data[k] + 6, 'the glass\'s own blue');
    }
    assert.ok(glass > 600, `record ${record}: ${glass} texels of glass`);
  }
  // the pipeline: a facade's stand-in uploads its glass as a window's mask; the arcade none
  clearVendorTextures();
  addVendorTextures([CAPITAL_ART.facadeBrick, CAPITAL_ART.groundArcade].map((record) => ({ archive: CAPITAL_ARCHIVE, record, standIn: true, fileName: `bld-${record}`, build: async () => art.get(record) })));
  const emissions = [];
  const renderer = { uploadTexture() {}, uploadEmissionTexture(a, r, c, o) { emissions.push([`${a}_${r}`, c.width, c.height, !!o?.window]); } };
  const pipe = createDataPipeline({ renderer, arch: null, palette: null, fetch: async (n) => { throw new Error(`no ${n} here`); } });
  const t = await pipe.getTexture(CAPITAL_ARCHIVE);
  assert.equal(t.vendor, true);
  pipe.uploadRecord(CAPITAL_ARCHIVE, CAPITAL_ART.facadeBrick);
  pipe.uploadRecord(CAPITAL_ARCHIVE, CAPITAL_ART.groundArcade);
  assert.deepEqual(emissions, [[`${CAPITAL_ARCHIVE}_${CAPITAL_ART.facadeBrick}`, FACADE_TEXELS.w, FACADE_TEXELS.h, true]]);
  clearVendorTextures();
});
