// TREES-SEATED (FIELD BUGS 2026-10-03b, Rissa on the Discord: "Floating trees in Tamhope" - a night screenshot of large
// deciduous trees and some conifers standing over the ground by a village's houses, their trunks ending in the air).
//
// Six of Beautiful Villages' blocks - RESIAS08, TVRNAS00, TVRNAS01, TVRNAS03, TEMPASH3, WEAPAS02 - stand TEXTURE.504's
// trees as MISC flats on the RMB Resource Pack's hills (52xxx), at heights the author read off the pack's own meshes.
// DFU stands such a flat where it is authored (RMBLayout.AddMiscBlockFlats reads no terrain and no model, and swaps no
// archive), on the pack's hill. The port draws its own mounds there (world/townStandIns.js RMBRP_HILLS), smaller than
// the pack's, and the trees hung over them. While the port draws a block's hills as its stand-ins, a nature flat of the
// block stands on the top of what is drawn under it (townStandIns.js blockHillSeat / seatNatureFlat; scenes/world.js and
// scenes/exterior.js). No game data: those six blocks' model and flat records are carried WHOLE in the vendored pack
// (rows, never a reference into the player's BLOCKS.BSA), and the blocks are built by the door's own converter
// (blockFromJson), laid out by layoutRmbBlock and their flats collected by collectBlockFlats - the producers the hosts run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

import { ROW_CODECS } from '../src/formats/worldDataPack.js';
import { blockFromJson } from '../src/formats/worldDataReplacement.js';
import { layoutRmbBlock } from '../src/world/rmbLayout.js';
import { collectBlockFlats, isNatureArchive, NATURE_FLATS_Y } from '../src/world/rmbFlats.js';
import { RMBRP_HILLS, RMBRP_PIECES, installTownStandIns, _resetTownStandIns, blockHillSeat, seatNatureFlat, drawnHillStandIn } from '../src/world/townStandIns.js';
import { _resetCustomModels } from '../src/world/customModels.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SIX = ['RESIAS08.RMB', 'TVRNAS00.RMB', 'TVRNAS01.RMB', 'TVRNAS03.RMB', 'TEMPASH3.RMB', 'WEAPAS02.RMB'];
const TEMPERATE = 504, TEMPERATE_SNOW = 505;   // ClimateTextureSet.Nature_TemperateWoodland(_Snow)

/** A block of the pack as the door serves its misc records: the file's own whole-list ops, rows decoded by the pack's
 *  codecs, through blockFromJson. */
function packBlocks(names) {
  const pack = JSON.parse(zlib.gunzipSync(readFileSync(new URL('../vendor/beautiful-villages/WorldDataPack/beautiful-villages.pack.json.gz', import.meta.url))).toString('utf8'));
  return names.map((name, i) => {
    const [, , ops] = JSON.parse(pack.files[`${name}.json`]);
    const list = (key, codec) => {
      const op = ops.find((o) => o[0] === 's' && o[1].join('.') === `RmbBlock.${key}`);
      assert.ok(op && op[2][codec], `${name}: ${key} is carried whole`);
      return op[2][codec].map((row) => (Array.isArray(row) ? ROW_CODECS[codec](row) : row));
    };
    const json = { Name: name, RmbBlock: { FldHeader: {}, SubRecords: [], Misc3dObjectRecords: list('Misc3dObjectRecords', '$m'), MiscFlatObjectRecords: list('MiscFlatObjectRecords', '$f') } };
    return blockFromJson(json, 9000 + i);
  });
}

/** THE DRAWN TOP, measured on its own: a ray straight down (Moller-Trumbore) through each hill stand-in's mesh as the
 *  pipeline builds it (RMBRP_PIECES), laid by its placement - the highest hit, or null. */
function drawnTopAt(models, x, z) {
  let top = null;
  for (const placed of models) {
    if (!RMBRP_HILLS[placed.modelIdNum]) continue;
    const mesh = RMBRP_PIECES[placed.modelIdNum](), m = placed.matrix, p = mesh.positions;
    const at = (i) => [0, 1, 2].map((r) => m[r] * p[i * 3] + m[4 + r] * p[i * 3 + 1] + m[8 + r] * p[i * 3 + 2] + m[12 + r]);
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [at(mesh.indices[t]), at(mesh.indices[t + 1]), at(mesh.indices[t + 2])];
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const pv = [-e2[2], 0, e2[0]];   // dir (0,-1,0) x e2
      const det = e1[0] * pv[0] + e1[2] * pv[2];
      if (Math.abs(det) < 1e-12) continue;
      const s = [x - a[0], 1000 - a[1], z - a[2]];
      const u = (s[0] * pv[0] + s[2] * pv[2]) / det;
      if (u < 0 || u > 1) continue;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
      const v = -q[1] / det;
      if (v < 0 || u + v > 1) continue;
      const y = 1000 - (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
      if (top === null || y > top) top = y;
    }
  }
  return top;
}

let towns = true;
_resetCustomModels(); _resetTownStandIns();
installTownStandIns(() => towns);

test('TREES-SEATED: every tree the six blocks stand over the port\'s hills is seated on the top drawn under it - 121 of 130 hung more than 1.5 m over the catalogue\'s mounds where they were authored, and 1 over the measured hills (HILL-SHAPES)', () => {
  towns = true;
  let raised = 0, hung = 0, over = 0;
  for (const block of packBlocks(SIX)) {
    const { models } = layoutRmbBlock(block);
    const seat = blockHillSeat(models);
    assert.ok(seat, `${block.name}: its hills are drawn as the port's mounds`);
    const nature = collectBlockFlats(block, TEMPERATE).filter((f) => isNatureArchive(f.archive));
    assert.ok(nature.length, `${block.name}: stands nature flats`);
    for (const f of nature) {
      assert.equal(f.archive, TEMPERATE, `${block.name}: a misc tree of TEXTURE.504`);
      const mound = drawnTopAt(models, f.x, f.z);
      const drawn = mound === null ? NATURE_FLATS_Y : Math.max(NATURE_FLATS_Y, mound);   // the plane, or a mound standing out of it
      const seated = seatNatureFlat(seat, f.x, f.z, NATURE_FLATS_Y);
      assert.ok(Math.abs(seated - drawn) < 0.5, `${block.name} ${f.archive}_${f.record} at (${f.x.toFixed(1)}, ${f.z.toFixed(1)}): seated ${seated.toFixed(2)}, the top drawn there ${drawn.toFixed(2)}`);
      if (mound !== null && mound > NATURE_FLATS_Y) over++;
      if (f.y >= 1) raised++;
      if (f.y >= 1 && f.y - drawn > 1.5) hung++;
    }
  }
  assert.equal(raised, 130, 'the trees the author stood a metre or more over the plane');
  // FIELD BUGS 2026-10-05 HILL-SHAPES: the stand-ins were the catalogue's size, and 121 hung over them; drawn at the
  // pack's measured shape (world/rmbrpHillShapes.js), one does - the seat still stands it
  assert.equal(hung, 1, 'as authored, one of them hangs more than 1.5 m over what the port draws (it was 121 over the catalogue\'s mounds)');
  assert.ok(over > 0, 'some stand over a mound, and stand on it');
});

test('TREES-SEATED: the nature RANGE - a misc tree keeps its own archive (AddMiscBlockFlats swaps none), so in a winter pixel (505) the six blocks\' 504 trees are still the block\'s nature; the plane is AddNatureFlats\' own', () => {
  for (const a of [500, 504, 505, 511]) assert.equal(isNatureArchive(a), true, a);
  for (const a of [499, 512, 210, 301]) assert.equal(isNatureArchive(a), false, a);
  const [resi] = packBlocks(['RESIAS08.RMB']);
  const winter = collectBlockFlats(resi, TEMPERATE_SNOW).filter((f) => isNatureArchive(f.archive));
  assert.ok(winter.length >= 40 && winter.every((f) => f.archive === TEMPERATE), 'unswapped: not the pixel\'s archive, and still seated');
  // NATURE_FLATS_Y is where AddNatureFlats stands the ground scenery: (natureFlatsOffsetY = -2) * GlobalScale
  assert.equal(NATURE_FLATS_Y, -2 * GLOBAL_SCALE);
  const scenery = { ...resi, rmbBlock: { ...resi.rmbBlock, miscFlatObjectRecords: [], fldHeader: { ...resi.rmbBlock.fldHeader } } };
  scenery.rmbBlock.fldHeader.groundData.groundScenery[3][4].textureRecord = 13;
  const [g] = collectBlockFlats(scenery, TEMPERATE).filter((f) => f.archive === TEMPERATE);
  assert.equal(g.y, NATURE_FLATS_Y, 'the ground scenery\'s own plane');
});

test('TREES-SEATED: no seat where the port draws no mound of its own - the stand-ins off (DFU: the pack\'s hill, or nothing), or a block with no hill; and the ground wins where it is higher than a mound', () => {
  const [resi] = packBlocks(['RESIAS08.RMB']);
  const { models } = layoutRmbBlock(resi);
  towns = false;
  try {
    assert.equal(drawnHillStandIn(52548), null, 'no stand-in drawn');
    assert.equal(blockHillSeat(models), null, 'the block stands as authored');
  } finally { towns = true; }
  assert.ok(drawnHillStandIn(52548), 'drawn while the town mods\' stand-ins are on');
  assert.equal(drawnHillStandIn(53040), null, 'a rock is no hill');
  assert.equal(blockHillSeat(models.filter((m) => !RMBRP_HILLS[m.modelIdNum])), null, 'no hill in the block: NATURE-GROUND alone');
  const seat = blockHillSeat(models);
  const hill = models.find((m) => m.modelIdNum === 52548), [hx, hz] = [hill.matrix[12], hill.matrix[14]];
  const top = seat.topAt(hx, hz);
  assert.ok(Math.abs(top - drawnTopAt(models, hx, hz)) < 1e-6, 'the seat reads the mound the pipeline builds');
  // ...everywhere over it, faces and edges alike: a grid across the mound and past its rim, to the ray's own answer
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const x = hx - 12 + i, z = hz - 12 + j, s = seat.topAt(x, z), r = drawnTopAt(models, x, z);
    assert.ok(s === r || Math.abs(s - r) < 1e-6, `(${i - 12}, ${j - 12}) off the hill's origin: seat ${s}, ray ${r}`);
  }
  // two mounds over one spot: the higher is what is drawn on top
  const raised = Float32Array.from(hill.matrix); raised[13] += 2;
  const both = blockHillSeat([hill, { modelIdNum: hill.modelIdNum, matrix: raised }]);
  assert.ok(Math.abs(both.topAt(hx + 1.5, hz - 2) - (seat.topAt(hx + 1.5, hz - 2) + 2)) < 1e-5, 'the higher of two mounds');
  assert.equal(seatNatureFlat(seat, hx, hz, top + 3), top + 3, 'the ground, where it rises over the mound');
  assert.equal(seatNatureFlat(seat, hx, hz, NATURE_FLATS_Y), top, 'the mound, where it stands out of the ground');
  assert.equal(seat.topAt(hx + 500, hz), null, 'off every mound, nothing');
  assert.equal(seatNatureFlat(seat, hx + 500, hz, 7.25), 7.25, 'and the flat takes the ground');
  assert.equal(seatNatureFlat(null, hx, hz, 7.25), 7.25);
});

test('TREES-SEATED by source: the streamed world and the one-location exterior seat a block\'s nature-range flats on its drawn hills; the interior and dungeon hosts stand no RMB exterior flat', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const hillSeat = blockHillSeat\(b\.layout\.models\);/);
  assert.match(w, /addFlat\(flat\.archive, flat\.record, fx, locLocal\[1\] \+ \(hillSeat && isNatureArchive\(flat\.archive\) \? seatNatureFlat\(hillSeat, flat\.x, flat\.z, NATURE_FLATS_Y \+ groundOffPlane\(samples, avg, fx, fz\)\) : flat\.y \+ lift\), fz\);/,
    'the higher of the drawn ground (NATURE-GROUND\'s) and the mounds, for the whole nature range; else the plane and its lift');
  const e = src('src/scenes/exterior.js');
  assert.match(e, /const blockFlats = collectBlockFlats\(b\.dfBlock, natureArchive, \{ climateIndex: locClimateIndex, solid: fieldSolids \}\), hillSeat = blockHillSeat\(b\.layout\.models\);/);   // FIELD BUGS 2026-10-04d CROPS: a field's batch handed the climate and the block's solids
  assert.match(e, /\[flat\.x \+ b\.originX, hillSeat && isNatureArchive\(flat\.archive\) \? seatNatureFlat\(hillSeat, flat\.x, flat\.z, NATURE_FLATS_Y\) : flat\.y, flat\.z \+ b\.originZ\]/, 'this host\'s ground is the plane');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(src(host), /collectBlockFlats/, `${host}: no RMB exterior flats`);
});
