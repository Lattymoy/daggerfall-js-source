import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyClimate, getClimateTextureInfo, isExteriorWindow,
  getNatureArchive, getGroundArchive, SEASON, GROUP,
} from '../src/world/climateSwaps.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2;

test('climate: applyClimate verbatim rules', () => {
  // Door-frame tapestry never swaps.
  assert.equal(applyClimate(174, 3, 300, SEASON.Summer), 174);
  assert.equal(applyClimate(74, 3, 0, SEASON.Winter), 74);
  // Base-set castle rebases per climate; winter only for records <= 3.
  assert.equal(applyClimate(9, 0, 300, SEASON.Summer), 309);
  assert.equal(applyClimate(9, 0, 0, SEASON.Summer), 9);
  assert.equal(applyClimate(9, 2, 300, SEASON.Winter), 310);
  assert.equal(applyClimate(9, 4, 300, SEASON.Winter), 309);
  // Deserts have no winter.
  assert.equal(applyClimate(12, 0, 0, SEASON.Winter), 12);
  // Swamp mages guild suppresses winter; other climates keep it.
  assert.equal(applyClimate(35, 0, 400, SEASON.Winter), 435);
  assert.equal(applyClimate(35, 0, 300, SEASON.Winter), 336);
  // Swamps keep marble floors; temperate rebases them.
  assert.equal(applyClimate(41, 0, 400, SEASON.Summer), 41);
  assert.equal(applyClimate(41, 0, 300, SEASON.Summer), 341);
  // Suppressed archives keep their index; 82 winters only records <= 1.
  assert.equal(applyClimate(82, 2, 300, SEASON.Winter), 82);
  assert.equal(applyClimate(82, 0, 300, SEASON.Winter), 83);
  assert.equal(applyClimate(77, 0, 300, SEASON.Winter), 77);
  assert.equal(applyClimate(77, 0, 300, SEASON.Summer), 77);
  // Terrain supports both winter and rain.
  assert.equal(applyClimate(302, 0, 300, SEASON.Winter), 303);
  assert.equal(applyClimate(302, 0, 300, SEASON.Rain), 304);
  // Doors rebase but never winter; nature 500+ keeps archive + winter bump.
  assert.equal(applyClimate(74, 0, 300, SEASON.Winter), 374);
  assert.equal(applyClimate(474, 0, 0, SEASON.Summer), 74);
  assert.equal(applyClimate(504, 5, 300, SEASON.Winter), 505);
  assert.equal(applyClimate(503, 5, 300, SEASON.Winter), 503);
  // Unclassified archives pass through untouched.
  assert.equal(applyClimate(199, 0, 300, SEASON.Winter), 199);
});

test('climate: texture info classification', () => {
  const terrain = getClimateTextureInfo(302);
  assert.equal(terrain.textureGroup, GROUP.Terrain);
  assert.ok(terrain.supportsWinter && terrain.supportsRain);
  const castle = getClimateTextureInfo(9);
  assert.equal(castle.textureGroup, GROUP.Exterior);
  assert.ok(castle.supportsWinter && !castle.supportsRain);
  const marble = getClimateTextureInfo(341);
  assert.equal(marble.textureGroup, GROUP.Interior);
  assert.ok(!marble.supportsWinter);
  const nature = getClimateTextureInfo(504);
  assert.equal(nature.textureGroup, GROUP.Nature);
  assert.ok(nature.supportsWinter);
  assert.ok(!getClimateTextureInfo(503).supportsWinter);
  assert.equal(getClimateTextureInfo(199).textureSet, -1);
  assert.equal(getClimateTextureInfo(512).textureSet, -1);
});

test('climate: exterior window table', () => {
  assert.equal(isExteriorWindow(375, 3), false);
  assert.equal(isExteriorWindow(210, 0), false);
  assert.equal(isExteriorWindow(36, 2), true);
  assert.equal(isExteriorWindow(151, 3), true);
  assert.equal(isExteriorWindow(309, 3), true); // % 100 == 9, record 3
  assert.equal(isExteriorWindow(9, 2), false);
  assert.equal(isExteriorWindow(75, 7), true);
  assert.equal(isExteriorWindow(79, 0), true);
  assert.equal(isExteriorWindow(79, 1), false);
  assert.equal(isExteriorWindow(82, 0), true);
  assert.equal(isExteriorWindow(83, 1), false);
  assert.equal(isExteriorWindow(5, 3), false);
});

test('climate: nature and ground archives', () => {
  assert.equal(getNatureArchive(504, SEASON.Winter), 505);
  assert.equal(getNatureArchive(506, SEASON.Winter), 507);
  assert.equal(getNatureArchive(503, SEASON.Winter), 503);
  assert.equal(getNatureArchive(500, SEASON.Summer), 500);
  assert.equal(getNatureArchive(999, SEASON.Summer), 504); // default
  assert.equal(getGroundArchive(0, SEASON.Summer), 2);
  assert.equal(getGroundArchive(100, SEASON.Winter), 103);
  assert.equal(getGroundArchive(300, SEASON.Rain), 304);
  assert.equal(getGroundArchive(400, SEASON.Summer), 402);
  assert.equal(getGroundArchive(777, SEASON.Summer), 302); // default
});

test('climate: corpus sweep - every swap resolves to a real archive', { skip: skipReal }, async () => {
  const { Arch3dFile } = await import('../src/formats/arch3dFile.js');
  const onDisk = new Set(
    readdirSync(ARENA2).filter((f) => /^TEXTURE\.\d\d\d$/.test(f)).map((f) => Number(f.slice(8))));
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const pairs = new Set();
  for (let i = 0; i < arch.count; i++) {
    const m = arch.getMesh(i);
    if (!m) continue;
    for (const sm of m.subMeshes) pairs.add(sm.textureArchive * 1000 + sm.textureRecord);
  }
  assert.equal(pairs.size, 735);
  let identity = 0;
  let swapped = 0;
  for (const p of pairs) {
    const archive = Math.trunc(p / 1000);
    const record = p % 1000;
    for (const cb of [0, 100, 300, 400]) {
      for (const s of [0, 1, 2]) {
        const out = applyClimate(archive, record, cb, s);
        if (out === archive) {
          identity++;
          continue;
        }
        swapped++;
        assert.ok(onDisk.has(out), `missing TEXTURE.${out} for ${archive}_${record} cb${cb} s${s}`);
      }
    }
  }
  // Every combination of the full mesh corpus x 4 climates x 3 seasons.
  assert.equal(identity, 6538);
  assert.equal(swapped, 2282);

  // Record-level pins (R1 audit): 27 swaps target archives that lack the
  // record - scenes prune those remaps so the submesh keeps its original
  // texture; 15 swaps land on records with different dimensions - DFU
  // stretches identically (UVs normalized against the original archive),
  // a shared classic-data quirk.
  const { TextureFile } = await import('../src/formats/textureFile.js');
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const pal = new DFPalette();
  pal.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const texCache = new Map();
  const tex = (a) => {
    if (!texCache.has(a)) {
      const n = `TEXTURE.${String(a).padStart(3, '0')}`;
      const t = new TextureFile();
      t.load(new Uint8Array(readFileSync(join(ARENA2, n))), n, pal);
      texCache.set(a, t);
    }
    return texCache.get(a);
  };
  let missingRecord = 0;
  let dimMismatch = 0;
  for (const p of pairs) {
    const archive = Math.trunc(p / 1000);
    const record = p % 1000;
    for (const cb of [0, 100, 300, 400]) {
      for (const s of [0, 1, 2]) {
        const out = applyClimate(archive, record, cb, s);
        if (out === archive) continue;
        const t = tex(out);
        if (record >= t.recordCount) {
          missingRecord++;
          continue;
        }
        const o = tex(archive);
        if (t.getWidth(record) !== o.getWidth(record) ||
            t.getHeight(record) !== o.getHeight(record)) dimMismatch++;
      }
    }
  }
  assert.equal(missingRecord, 27);
  assert.equal(dimMismatch, 15);
});
