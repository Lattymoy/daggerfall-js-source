// WM3 — THE MILL TAKES THE CLIMATE TABLE, and the four copies of the
// remap loop become one.
//
// Two halves, and they are pinned differently on purpose.
//
// THE LAW half is real behaviour: applyClimate is a pure function and
// the mill's five (archive, record) pairs are constants, so what a
// snowbound mill's walls become is computable here with no GL and no
// ARENA2. It is also where the arc's own open item turns out to have
// named the wrong part - see below.
//
// THE WIRING half is a source sweep, for R5's reason this arc has now
// quoted three times: R5 wired a paint into buildPixel, everything
// passed, and the world host was dead on its first terrain load,
// because nothing in the suite drives that path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { applyClimate, SEASON } from '../src/world/climateSwaps.js';
import { BODY, ROTOR } from '../src/world/windmillMesh.js';
import { remapSubMeshes } from '../src/world/texRemap.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const BASE = { Desert: 0, Mountain: 100, Temperate: 300, Swamp: 400 };
const EXTERIOR_HOSTS = ['src/scenes/exterior.js', 'src/scenes/world.js'];
// THE FOUR HOSTS (17e). Mills stand outdoors only, so the two exterior
// hosts are the ones that wire the mill; the other two are named here
// because the SEAM is theirs too - interiors run the same climate law
// over their own submeshes, dungeons run the RDB texture table through
// the same loop. Neither draws a windmill and neither should.
const REMAP_HOSTS = [...EXTERIOR_HOSTS, 'src/scenes/interiorContext.js', 'src/scenes/dungeonContext.js'];

test('WM3: the mill answers ApplyClimate, and it is the TOWER that moves - not the sail', () => {
  // The World-Arc's open item read "No climate swap on the ROTOR ... a
  // snowbound mill has summer sails". Half right, and the wrong half is
  // the interesting one: the rotor's two archives are TEXTURE.000
  // record 77 and TEXTURE.067 record 1, and neither classifies - 0 and
  // 67 are in no exterior, interior or nature set, so ApplyClimate
  // returns them unchanged in every climate and every season. The
  // sails were never going to swap. What was actually wearing summer in
  // the snow is the TOWER: walls 364_2 (Exterior_Village) and roof
  // 369_3 (Exterior_Roofs), both of which support winter.
  for (const base of Object.values(BASE)) {
    for (const season of Object.values(SEASON)) {
      for (const sm of ROTOR.subMeshes) {
        assert.equal(applyClimate(sm.textureArchive, sm.textureRecord, base, season),
          sm.textureArchive,
          `rotor ${sm.textureArchive}_${sm.textureRecord} moved at base ${base} season ${season}`);
      }
    }
  }
  // The tower's other three - plank 067_1 twice and door 332_0 - are
  // equally inert, and for the same reason. Exactly two pairs move.
  const movers = new Set();
  for (const base of Object.values(BASE)) {
    for (const season of Object.values(SEASON)) {
      for (const sm of BODY.subMeshes) {
        if (applyClimate(sm.textureArchive, sm.textureRecord, base, season) !== sm.textureArchive) {
          movers.add(`${sm.textureArchive}_${sm.textureRecord}`);
        }
      }
    }
  }
  assert.deepEqual([...movers].sort(), ['364_2', '369_3']);
});

test('WM3: the mill wears every climate and its winter, byte for byte', () => {
  // deepEqual against the whole table, not a spot check: a spot check
  // on one climate survives a one-character mutation of the base
  // arithmetic, and A PIN MUST FAIL (17e).
  const walls = (b, s) => applyClimate(364, 2, b, s);
  const roof = (b, s) => applyClimate(369, 3, b, s);
  const table = [];
  for (const base of [BASE.Desert, BASE.Mountain, BASE.Temperate, BASE.Swamp]) {
    for (const season of [SEASON.Summer, SEASON.Winter, SEASON.Rain]) {
      table.push([base, season, walls(base, season), roof(base, season)]);
    }
  }
  assert.deepEqual(table, [
    // Desert has no winter at all (ApplyClimate clears supportsWinter
    // for the whole base), so its three seasons are one archive.
    [BASE.Desert, SEASON.Summer, 64, 69],
    [BASE.Desert, SEASON.Winter, 64, 69],
    [BASE.Desert, SEASON.Rain, 64, 69],
    // Mountain, temperate and swamp winter by +1. Exterior sets carry
    // no rain variant, so rain reads as summer.
    [BASE.Mountain, SEASON.Summer, 164, 169],
    [BASE.Mountain, SEASON.Winter, 165, 170],
    [BASE.Mountain, SEASON.Rain, 164, 169],
    [BASE.Temperate, SEASON.Summer, 364, 369],
    [BASE.Temperate, SEASON.Winter, 365, 370],
    [BASE.Temperate, SEASON.Rain, 364, 369],
    [BASE.Swamp, SEASON.Summer, 464, 469],
    [BASE.Swamp, SEASON.Winter, 465, 470],
    [BASE.Swamp, SEASON.Rain, 464, 469],
  ]);
  // And the temperate summer identity is the reason this was invisible:
  // the vendored mill is authored in TEMPERATE archives, so in the one
  // climate a developer is most likely to load, the missing swap is a
  // no-op. It only ever showed somewhere else.
  assert.equal(walls(BASE.Temperate, SEASON.Summer), 364);
});

test('WM3: the shared seam remaps, prunes the short archive, and never re-keys', async () => {
  const uploaded = [];
  const deps = {
    // Record 3 exists in 170 but not in 165: the R1 prune case, and the
    // one that makes this a table and not a rename.
    getTexture: async (a) => ({ recordCount: a === 165 ? 2 : 8 }),
    uploadRecord: (a, r) => uploaded.push(`${a}_${r}`),
  };
  const texRemap = new Map();
  const law = (archive, record) => applyClimate(archive, record, BASE.Mountain, SEASON.Winter);

  await remapSubMeshes(BODY.subMeshes, texRemap, law, deps);
  await remapSubMeshes(ROTOR.subMeshes, texRemap, law, deps);
  assert.deepEqual([...texRemap.entries()], [['369_3', '170_3']]);
  assert.deepEqual(uploaded, ['170_3']);
  // 364_2 is pruned, not mapped: 165 is two records long. A pruned pair
  // keeps its ORIGINAL texture, which is a summer wall on a winter
  // mill - honest, and better than sampling past the end.
  assert.equal(texRemap.has('364_2'), false);

  // Asked twice (the world host asks per map pixel), the seam neither
  // re-uploads nor re-keys.
  await remapSubMeshes(BODY.subMeshes, texRemap, law, deps);
  assert.deepEqual(uploaded, ['170_3']);

  // An absent model arrives as undefined - the seam guards the VALUE.
  await remapSubMeshes(undefined, texRemap, law, deps);
  assert.equal(texRemap.size, 1);
});

test('WM3: both exterior hosts run the mill through the climate table', () => {
  for (const host of EXTERIOR_HOSTS) {
    const text = src(host);
    assert.match(text, /remapSubMeshes\(BODY\.subMeshes, texRemap, climateArchive/,
      `${host} never climate-swaps the mill's tower`);
    assert.match(text, /remapSubMeshes\(ROTOR\.subMeshes, texRemap, climateArchive/,
      `${host} never climate-swaps the mill's sail`);
    // The mill draws with the SAME table its neighbours draw with - a
    // second map would be a second answer to one question.
    assert.match(text, /drawMesh\(millParts\.rotor,[\s\S]{0,120}?texRemap\)/,
      `${host} draws the sail without the remap table`);
  }
});

test('WM3: ONE DFU MEMBER, ONE EXPORT - no host keeps its own copy of the loop', () => {
  for (const host of REMAP_HOSTS) {
    const text = src(host);
    assert.match(text, /import \{ remapSubMeshes \} from '\.\.\/world\/texRemap\.js'/,
      `${host} does not use the shared remap seam`);
    // The tell of a re-grown copy is the write, not the read: any host
    // that sets a texRemap entry itself has stopped going through the
    // seam. src/world/texRemap.js is the one file allowed to.
    assert.doesNotMatch(text, /texRemap\.set\(/,
      `${host} writes the remap table itself - the loop has been copied back`);
  }
  assert.match(src('src/world/texRemap.js'), /texRemap\.set\(/);
});
