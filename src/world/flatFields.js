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

import { mulberry32 } from '../render/grassPixelArt.js';

const _fields = new Map();   // id -> { spec, isOn }

/** `spec`: { rangeX, rangeZ, spacing, noise, firstRecordOnly } in metres. */
export function registerFlatField(id, spec, isOn = () => true) { _fields.set(Number(id), { spec: Object.freeze({ ...spec }), isOn }); }
export function flatFieldFor(id) { const f = _fields.get(Number(id)); return f && f.isOn() ? f.spec : null; }
export function _resetFlatFields() { _fields.clear(); }

/** The crop archive and the plants of each climate's nature archive (RMBCropBillboardBatch.AdjustRecordBasedOnClimate):
 *  [archive, records]. A snowed nature archive (the odd ones from 505) is winter: the stubble. */
export const CROP_ARCHIVE = 301;
export function cropRecordsFor(natureArchive) {
  if (natureArchive >= 505 && natureArchive % 2 === 1) return [511, [22]];   // winter, outside the desert and the south
  switch (natureArchive) {
    case 510: return [CROP_ARCHIVE, [0, 1]];       // Mountain
    case 503: return [CROP_ARCHIVE, [2]];          // Desert
    case 501: return [CROP_ARCHIVE, [3, 4]];       // Subtropical
    case 500: case 502: return [CROP_ARCHIVE, [7, 8]];   // Rainforest, Swamp
    default: return [CROP_ARCHIVE, [19, 21]];      // the woodlands and hills
  }
}

/** The flats a field sows round (x, y, z) - metres, the block's own frame - turned by `yaw` radians: { archive,
 *  record, x, y, z } each. */
export function sowField(spec, natureArchive, x, y, z, yaw = 0) {
  const [archive, all] = cropRecordsFor(natureArchive);
  const records = spec.firstRecordOnly && all.length > 1 ? all.slice(1) : all;
  const rnd = mulberry32(((Math.round(x * 40) * 73856093) ^ (Math.round(z * 40) * 19349663)) >>> 0);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const out = [];
  let k = 0;
  for (let u = -spec.rangeX / 2; u <= spec.rangeX / 2 + 1e-6; u += spec.spacing) {
    for (let v = -spec.rangeZ / 2; v <= spec.rangeZ / 2 + 1e-6; v += spec.spacing) {
      const du = u + (rnd() * 2 - 1) * spec.noise, dv = v + (rnd() * 2 - 1) * spec.noise;
      out.push({ archive, record: records[k++ % records.length], x: x + du * c + dv * s, y, z: z - du * s + dv * c });
    }
  }
  return out;
}
