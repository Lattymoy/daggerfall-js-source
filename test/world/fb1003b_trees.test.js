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

import { ROW_CODECS } from '../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { collectBlockFlats, isNatureArchive, NATURE_FLATS_Y } from '../../src/world/rmbFlats.js';
import { RMBRP_HILLS, RMBRP_PIECES, installTownStandIns, _resetTownStandIns, blockHillSeat, seatNatureFlat, drawnHillStandIn } from '../../src/world/townStandIns.js';
import { _resetCustomModels } from '../../src/world/customModels.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const SIX = ['RESIAS08.RMB', 'TVRNAS00.RMB', 'TVRNAS01.RMB', 'TVRNAS03.RMB', 'TEMPASH3.RMB', 'WEAPAS02.RMB'];
const TEMPERATE = 504, TEMPERATE_SNOW = 505;   // ClimateTextureSet.Nature_TemperateWoodland(_Snow)

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

test('TREES-SEATED by source: the streamed world and the one-location exterior seat a block\'s nature-range flats on its drawn hills; the interior and dungeon hosts stand no RMB exterior flat', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const hillSeat = blockHillSeat\(b\.layout\.models\);/);
  // PIN MOVED (SOLITUDE-RELIEF): the seat and the plane on the block's tier (`blockY`), the drawn ground's offset less its
  // lift - the same law, to the byte, where no block is lifted. PIN MOVED (AUDIT PROP-GROUND): a flat past the nature's on
  // its town's street (`lift`, fabricLift)
  assert.match(w, /const hillY = hillSeat && isNatureArchive\(flat\.archive\) \? NATURE_FLATS_Y \+ off - \(blockY - locLocal\[1\]\) : null;\n\s+const fy = hillY !== null \? blockY \+ seatNatureFlat\(hillSeat, flat\.x, flat\.z, hillY\) : flat\.archive === natureArchive \? locLocal\[1\] \+ flat\.y \+ off : blockY \+ flat\.y \+ lift;\n\s+addFlat\(flat\.archive, flat\.record, fx, fy, fz, \{ block, n \}\);/,
    'the higher of the drawn ground (NATURE-GROUND\'s) and the mounds, for the whole nature range; else the plane and its lift');
  const e = src('src/scenes/exterior.js');
  assert.match(e, /const blockFlats = collectBlockFlats\(b\.dfBlock, natureArchive, \{ climateIndex: locClimateIndex, solid: fieldSolids \}\), hillSeat = blockHillSeat\(b\.layout\.models\);/);   // FIELD BUGS 2026-10-04d CROPS: a field's batch handed the climate and the block's solids
  assert.match(e, /\[flat\.x \+ b\.originX, hillSeat && isNatureArchive\(flat\.archive\) \? seatNatureFlat\(hillSeat, flat\.x, flat\.z, NATURE_FLATS_Y\) : flat\.y, flat\.z \+ b\.originZ\]/, 'this host\'s ground is the plane');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(src(host), /collectBlockFlats/, `${host}: no RMB exterior flats`);
});
