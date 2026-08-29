// WM3 — THE ONE REMAP SEAM, and the finding that arrived a slice late.
//
// WM3 set out to run the mill through the climate table and was
// OVERTAKEN by WM2e, which skins the mill from Kamer's own seventeen
// variant prefabs instead - a better answer, because his roofs do NOT
// follow ClimateSwaps (369_0 mountain, 369_1 swamp, 69_1 desert) and no
// amount of ApplyClimate produces them. The mill half was dropped
// rather than shipped beside it.
//
// What survives is the part WM2e did not touch and the part it
// corroborates:
//
// THE SEAM. The remap loop had four copies - exterior, world,
// interiors, dungeons - and the mill would have been a fifth. It lives
// once now, in src/world/texRemap.js, taking the LAW as an argument.
//
// THE LAW half is kept because it is INDEPENDENT EVIDENCE for a claim
// WM2e makes from the other side. WM2e says the sail is 067_1 in every
// one of the seventeen prefabs; these pins say ClimateSwaps would not
// have moved it either, computed from the shipped classifier over the
// whole climate/season cross product. Two sources, one answer - which
// is worth more than either alone, and is why the arc's old open item
// ("no climate swap on the ROTOR ... a snowbound mill has summer
// sails") was naming the wrong part.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { applyClimate, SEASON } from '../src/world/climateSwaps.js';
import { BODY, ROTOR, CLIMATE_SKINS } from '../src/world/windmillMesh.js';
import { remapSubMeshes } from '../src/world/texRemap.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const BASE = { Desert: 0, Mountain: 100, Temperate: 300, Swamp: 400 };
// THE FOUR HOSTS (17e). No mill is wired here - WM2e owns the mill's
// skin - but the SEAM is all four hosts': the three climate hosts run
// ApplyClimate over their submeshes and the dungeon runs the RDB
// texture table, through one loop.
const REMAP_HOSTS = ['src/scenes/exterior.js', 'src/scenes/world.js',
  'src/scenes/interiorContext.js', 'src/scenes/dungeonContext.js'];

test('WM3: ApplyClimate would not have moved the sail either - WM2e from the other side', () => {
  // The rotor's two archives are TEXTURE.000 record 77 and TEXTURE.067
  // record 1, and neither classifies: 0 and 67 are in no exterior,
  // interior or nature set. So the sail is fixed under the climate law
  // in all twelve combinations - the same answer Kamer's prefabs give
  // by carrying 067_1 in every one.
  for (const base of Object.values(BASE)) {
    for (const season of Object.values(SEASON)) {
      for (const sm of ROTOR.subMeshes) {
        assert.equal(applyClimate(sm.textureArchive, sm.textureRecord, base, season),
          sm.textureArchive,
          `rotor ${sm.textureArchive}_${sm.textureRecord} moved at base ${base} season ${season}`);
      }
    }
  }
  // And on the body, the two slots that move under the climate law are
  // the two slots WM2e's skin table moves: walls and roof. The plank
  // (067_1, twice) and the door (332_0) are inert both ways.
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

test('WM3: where the two laws AGREE and where they part - and why the port follows Kamer', () => {
  // This is the pin that says WM3's original plan was the wrong one.
  // deepEqual against the whole table, not a spot check: a spot check on
  // one climate survives a one-character mutation of the base
  // arithmetic (A PIN MUST FAIL).
  const walls = (b, s) => applyClimate(364, 2, b, s);
  const roof = (b, s) => applyClimate(369, 3, b, s);
  const table = [];
  for (const base of [BASE.Desert, BASE.Mountain, BASE.Temperate, BASE.Swamp]) {
    for (const season of [SEASON.Summer, SEASON.Winter, SEASON.Rain]) {
      table.push([base, season, walls(base, season), roof(base, season)]);
    }
  }
  assert.deepEqual(table, [
    // Desert has no winter at all - ApplyClimate clears supportsWinter
    // for the whole base, which is the SAME rule Kamer's prefabs state
    // independently by shipping no winter desert mill.
    [BASE.Desert, SEASON.Summer, 64, 69],
    [BASE.Desert, SEASON.Winter, 64, 69],
    [BASE.Desert, SEASON.Rain, 64, 69],
    // Mountain, temperate and swamp winter by +1. Exterior sets carry no
    // rain variant, so rain reads as summer.
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

  // THE WALLS AGREE. Kamer's wall archive is exactly ApplyClimate's, in
  // every base and both seasons - only the RECORD differs, which the
  // climate law never touches.
  for (const [base, skin] of CLIMATE_SKINS) {
    assert.equal(skin.walls[0], walls(base, SEASON.Summer), `${skin.name} summer walls`);
    assert.equal(skin.winterWalls[0], walls(base, SEASON.Winter), `${skin.name} winter walls`);
  }
  // THE ROOFS DO NOT, and that is the whole reason the mill is skinned
  // from his prefabs rather than run through the table. HALF the summer
  // roofs part company - he keeps the temperate 369 in mountain and
  // swamp where the climate law rebases to 169 and 469 - and EVERY
  // winter roof is his one snow roof, 103_1, an archive ApplyClimate
  // would never produce in any base. Desert and temperate agree on the
  // archive and differ only in the record, which the climate law never
  // touches.
  const disagree = [...CLIMATE_SKINS].filter(([base, skin]) =>
    skin.roof[0] !== roof(base, SEASON.Summer));
  assert.deepEqual(disagree.map(([, s]) => s.name).sort(), ['Mountain', 'Swamp']);
  for (const [base, skin] of CLIMATE_SKINS) {
    if (base === BASE.Desert) continue;   // the desert mill never winters
    assert.equal(skin.winterRoof[0], 103, `${skin.name} winter roof is Kamer's snow roof`);
    assert.notEqual(skin.winterRoof[0], roof(base, SEASON.Winter),
      `${skin.name}'s winter roof happens to match the climate law - re-read this pin`);
  }
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
  // keeps its ORIGINAL texture - honest, and better than sampling past
  // the end.
  assert.equal(texRemap.has('364_2'), false);

  // Asked twice (the world host asks per map pixel), the seam neither
  // re-uploads nor re-keys.
  await remapSubMeshes(BODY.subMeshes, texRemap, law, deps);
  assert.deepEqual(uploaded, ['170_3']);

  // An absent model arrives as undefined - the seam guards the VALUE.
  await remapSubMeshes(undefined, texRemap, law, deps);
  assert.equal(texRemap.size, 1);
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

test('WM3: the mill does NOT go through the scene table - WM2e owns its skin', () => {
  // Recorded as a rule because it is the thing WM3 nearly shipped. The
  // scene's texRemap is keyed "archive_record" over the WHOLE location:
  // the mill's walls are 364_2, a key its neighbours carry, so remapping
  // it for the mill re-skins them too. The mill's own mesh is uploaded
  // per climate instead.
  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const text = src(host);
    assert.doesNotMatch(text, /remapSubMeshes\((?:BODY|ROTOR)\.subMeshes/,
      `${host} pushes the mill through the scene-wide remap table`);
  }
});
