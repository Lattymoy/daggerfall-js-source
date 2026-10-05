// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT 05b A12 (FIELD BUGS 2026-10-05b) — THE PICTURE A NATURE FLAT
// STANDS AS: ONE CHOICE, EVERY HOST'S.
//
// A tree or a plant stands as one of three pictures, and each host wrote
// the choice out - the town's own pixels (scenes/world.js buildPixelNow),
// a location's flats (scenes/exterior.js) and, DECOR-LPT's, a yard's
// placed tree (scenes/yardNature.js): three copies of one rule, the third
// already drifting from the first two (THE ONE CONSTRUCTION SEAM). Now
// each asks here:
//
//   - LPT1: Low Poly Trees' far picture, where the mod stands a tree for
//     the record (its door loaded) - `far`, the handle, and `proto`, its
//     prototype; the host holds the handle while its batch stands;
//   - SIB1: Seasons of the Iliac Bay's picture of the record while the mod
//     re-skins its archive - uploaded under the install's own key, so a
//     later season never reads an earlier one's upload, and with NO mip
//     chain (AUDIT 61: the mod's atlas is mipChain:false, Point - one
//     NEAREST level at every distance, unlike the classic flats);
//   - else the classic record, uploaded.
//
// What each host reads off it: the batch's own picture - `key`, the
// record (or the key it went up under), and `size` (a far picture's is
// the tallest tree's) - and the flat's own size, `plain` (the season's
// picture's while one stands): its lean, its cover, the far rings'
// height. Each host builds its batch from that its own way.
// ═══════════════════════════════════════════════════════════════════

import { LPT_ARCHIVES } from './lowPolyTrees.js';
import { billboardSize } from './rmbFlats.js';

/** SIB1: the key Seasons of the Iliac Bay's picture of `record` goes up under - the install's own. */
export const seasonPictureKey = (record, installedSeason) => `${record}#season${installedSeason}`;

/**
 * THE CHOICE, for `record` of `archive` (`t` its texture file, the record already known to be in it). `door` Low Poly
 * Trees' (systems/lowPolyTreesAssets.js createLowPolyTrees - load, proto, farPicture) or null while the mod is off;
 * `seasons` Seasons of the Iliac Bay's helper while it stands a season over the game (systems/seasonsIliacBay.js -
 * `lookup(archive, record)`, `installedSeason`), else null; `renderer` (uploadTexture) and `uploadRecord(a, r)` the
 * pipeline's. Answers `{ key, size, plain, sib, proto, far }` - `sib` the season's lookup (or null), `proto` and `far` Low
 * Poly Trees' prototype and far picture (or null; the far picture is not yet held).
 * @param {{ door?: any, seasons?: any, renderer: any, uploadRecord: (archive: number, record: number) => any }} deps
 * @param {any} t @param {number} archive @param {number} record
 */
export async function naturePicture({ door = null, seasons = null, renderer, uploadRecord }, t, archive, record) {
  const sib = seasons?.lookup?.(archive, record) ?? null;
  const plain = sib ? sib.size : billboardSize(t, record);
  const proto = door && LPT_ARCHIVES.includes(archive) && (await door.load()) ? door.proto(archive, record) : null;
  const far = proto ? await door.farPicture(proto) : null;
  if (far) return { key: far.record, size: far.size, plain, sib, proto, far };
  if (sib) {
    const key = seasonPictureKey(record, seasons.installedSeason);
    renderer.uploadTexture(archive, key, sib.texture.image, { mips: false, variant: '' });   // TEX1: the door's answer, handed over whole
    return { key, size: sib.size, plain, sib, proto: null, far: null };
  }
  uploadRecord(archive, record);
  return { key: record, size: plain, plain, sib: null, proto: null, far: null };
}
