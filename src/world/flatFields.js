// WD3 (2026-10-01): A MODEL ID THAT IS A FIELD OF FLATS.
//
// The RMB Resource Pack's crop prefabs (53211-53214) carry no mesh: each is a component, RMBCropBillboardBatch, that
// sows a rectangle of Daggerfall's own crop billboards round the spot the block places it - a grid `range` metres on a
// side, one plant every `spacing` metres, each nudged up to `noise` metres, the plant of the climate (TEXTURE.301's
// wheat in the woodlands, corn shocks in the mountains, sunflowers in the subtropics, vines in rainforest and swamp)
// and in winter the snowed stubble (511_22). Beautiful Cities lays them over the farmland its composite blocks run
// up to the walls. The port's stand-in is the same field: a registered id answers the flats it sows
// (world/rmbFlats.js asks for each of a block's scene models), the plant the climate's, the nudges seeded by the
// spot so a field stands the same every visit.
//
// FIELD BUGS 2026-10-04d CROPS: read again off the component's own source (drcarademono/rmb-resource-pack,
// Scripts/RMBCropBillboardBatch.cs) and its four prefabs (Prefabs/Crops/5321x.prefab). The field is the component's
// own law now, where the port's had drifted from it:
//   - GenerateBillboardPositions runs `for (float x = -rangeX / 2; x <= rangeX / 2; ...)` over an INT rangeX, so the
//     halves are C#'s integer ones - an 85 m field from -42 to 42 (not -42.5 to 41.5), a 35 m one from -17 to 15 -
//     and the grid is laid in the world's axes round the batch (`transform.position + position`): the batch's own turn
//     is never read;
//   - AddBillboardsToBatch sows no plant where IsOverlapping finds anything but the terrain within overlapCheckRadius
//     (1 on all four prefabs) of its foot - Physics.OverlapSphere, with DFU's queries syncing transforms and hitting
//     triggers (ProjectSettings/DynamicsManager.asset) - so a field keeps a metre off every wall, tower and fence the
//     block stands, where the port's grew through them;
//   - each plant sown is GetRandomRecord's pick among the climate's records (not the two taken in turn), and the
//     second desert's is its own (`case MapsFile.Climates.Desert2: return new[] { 20 }`), which a nature archive cannot
//     tell from the first's (both are 503) - the caller hands the climate.

import { mulberry32 } from '../render/grassPixelArt.js';
import { CLIMATES } from '../formats/mapsTables.js';

/** The registry: id -> `spec` { rangeX, rangeZ, spacing, noise, firstRecordOnly } in metres. FB1028 CROP-GROUND: its home
 *  is world/townShape.js, where the terrain's outline reads a field's tiles. */
export { registerFlatField, flatFieldFor, _resetFlatFields } from './townShape.js';

/** The crop archive and the plants of each climate's nature archive (RMBCropBillboardBatch.AdjustRecordBasedOnClimate):
 *  [archive, records]. A snowed nature archive (the odd ones from 505) is winter: the stubble. `climateIndex` is the
 *  raw CLIMATE.PAK value the component reads (PlayerGPS.CurrentClimateIndex): the second desert has a plant of its own. */
export const CROP_ARCHIVE = 301;
export function cropRecordsFor(natureArchive, climateIndex = null) {
  if (natureArchive >= 505 && natureArchive % 2 === 1) return [511, [22]]; // winter, outside the desert and the south
  if (climateIndex === CLIMATES.Desert2) return [CROP_ARCHIVE, [20]]; // FIELD BUGS 2026-10-04d CROPS: Desert2's own
  switch (natureArchive) {
    case 510:
      return [CROP_ARCHIVE, [0, 1]]; // Mountain
    case 503:
      return [CROP_ARCHIVE, [2]]; // Desert
    case 501:
      return [CROP_ARCHIVE, [3, 4]]; // Subtropical
    case 500:
    case 502:
      return [CROP_ARCHIVE, [7, 8]]; // Rainforest, Swamp
    default:
      return [CROP_ARCHIVE, [19, 21]]; // the woodlands and hills
  }
}

/** RMBCropBillboardBatch.overlapCheckRadius - 1 on all four prefabs: no plant within a metre of anything solid. */
export const CROP_OVERLAP_RADIUS = 1;

/** The flats a field sows round (x, y, z) - metres, the block's own frame; `y` the batch's own, where every plant's foot
 *  stands - in the world's axes (FIELD BUGS 2026-10-04d CROPS: the batch's turn is never read): { archive, record, x,
 *  y, z } each. `solid(x, y, z, r)` answers whether anything solid stands within `r` of a plant's foot (IsOverlapping;
 *  none asked, none refused); `climateIndex` the raw climate (cropRecordsFor). */
export function sowField(spec, natureArchive, x, y, z, { climateIndex = null, solid = null } = {}) {
  const [archive, all] = cropRecordsFor(natureArchive, climateIndex);
  const records = spec.firstRecordOnly && all.length > 1 ? all.slice(1) : all;
  const rnd = mulberry32(((Math.round(x * 40) * 73856093) ^ (Math.round(z * 40) * 19349663)) >>> 0);
  const hx = Math.trunc(spec.rangeX / 2),
    hz = Math.trunc(spec.rangeZ / 2); // `-rangeX / 2` over C#'s int: -42 for 85
  const out = [];
  for (let u = -hx; u <= hx; u += spec.spacing) {
    for (let v = -hz; v <= hz; v += spec.spacing) {
      const px = x + u + (rnd() * 2 - 1) * spec.noise,
        pz = z + v + (rnd() * 2 - 1) * spec.noise;
      if (solid && solid(px, y, pz, CROP_OVERLAP_RADIUS)) continue; // IsOverlapping: the plant is not sown
      out.push({ archive, record: records[Math.floor(rnd() * records.length)], x: px, y, z: pz }); // GetRandomRecord
    }
  }
  return out;
}

/** The squared distance from p to the triangle abc (Ericson's ClosestPtPointTriangle), all [x, y, z]. */
function pointTriangleDist2(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax,
    aby = by - ay,
    abz = bz - az,
    acx = cx - ax,
    acy = cy - ay,
    acz = cz - az;
  const apx = px - ax,
    apy = py - ay,
    apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz,
    d2 = acx * apx + acy * apy + acz * apz;
  const at = (qx, qy, qz) => (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2;
  if (d1 <= 0 && d2 <= 0) return at(ax, ay, az);
  const bpx = px - bx,
    bpy = py - by,
    bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz,
    d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return at(bx, by, bz);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return at(ax + v * abx, ay + v * aby, az + v * abz);
  }
  const cpx = px - cx,
    cpy = py - cy,
    cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz,
    d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return at(cx, cy, cz);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return at(ax + w * acx, ay + w * acy, az + w * acz);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return at(bx + w * (cx - bx), by + w * (cy - by), bz + w * (cz - bz));
  }
  const denom = 1 / (va + vb + vc),
    v = vb * denom,
    w = vc * denom;
  return at(ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w);
}

/**
 * FIELD BUGS 2026-10-04d CROPS: IsOverlapping over a block's own solids - `Physics.OverlapSphere(position, radius)`
 * against everything but the terrain, here the triangles of the block's placed models as the hosts draw and collide
 * them (`models` layoutRmbBlock's, the block's frame; `meshOf(placed)` the host's mesh for it, or null where it stands
 * nothing). A mesh collider is its surface to a sphere, so a foot deep inside a closed model, farther than the radius
 * from every face, overlaps nothing. The triangles are laid on the first ask: a block with no field never pays.
 * @param {Iterable<{modelIdNum:number, matrix:ArrayLike<number>}>} models
 * @param {(placed:object) => ?{positions:ArrayLike<number>, indices:ArrayLike<number>}} meshOf
 * @returns {(x:number, y:number, z:number, r:number) => boolean}
 */
export function blockSolids(models, meshOf) {
  let solids = null; // per model: [box (6), triangles laid out flat, nine numbers each]
  const lay = () => {
    solids = [];
    for (const placed of models ?? []) {
      const mesh = meshOf(placed);
      if (!mesh?.indices?.length) continue;
      const m = placed.matrix,
        p = mesh.positions,
        w = new Float64Array(p.length);
      const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const v = m[k] * p[i] + m[4 + k] * p[i + 1] + m[8 + k] * p[i + 2] + m[12 + k];
          w[i + k] = v;
          if (v < box[k]) box[k] = v;
          if (v > box[3 + k]) box[3 + k] = v;
        }
      }
      const ix = mesh.indices,
        tris = new Float64Array((ix.length - (ix.length % 3)) * 3);
      for (let t = 0; t + 2 < ix.length; t += 3)
        for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) tris[t * 3 + c * 3 + k] = w[ix[t + c] * 3 + k];
      solids.push({ box, tris });
    }
  };
  return (x, y, z, r) => {
    if (!solids) lay();
    const r2 = r * r;
    for (const { box, tris } of solids) {
      if (x < box[0] - r || x > box[3] + r || y < box[1] - r || y > box[4] + r || z < box[2] - r || z > box[5] + r)
        continue;
      for (let t = 0; t < tris.length; t += 9) {
        if (
          pointTriangleDist2(
            x,
            y,
            z,
            tris[t],
            tris[t + 1],
            tris[t + 2],
            tris[t + 3],
            tris[t + 4],
            tris[t + 5],
            tris[t + 6],
            tris[t + 7],
            tris[t + 8],
          ) <= r2
        )
          return true;
      }
    }
    return false;
  };
}
