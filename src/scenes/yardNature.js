// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR-OUTDOOR (FIELD BUGS 2026-10-05b) — A YARD'S TREES AND PLANTS,
// DRAWN AS ITS TOWN'S OWN NATURE IS DRAWN.
//
// The owner: "There seems to be a lot of missing decor items with house
// decoration"; asked which, the outdoor pieces for a yard among them. A
// yard's nature piece is its climate's own (systems/decorCatalogue.js
// DECOR_NATURE_BASES): the piece stores its set's SUMMER archive - the
// one a climate names - and its record, and it is drawn as the pixel it
// stands in draws the town's own nature (scenes/world.js buildPixelNow's
// flat groups):
//
//   - the SEASON's archive (world/climateSwaps.js getNatureArchive - the
//     four woodland sets' winter twins), read off the yard's pixel;
//   - and of that record the picture the town's own flats choose - the
//     one choice (world/naturePicture.js, AUDIT 05b A12): DECOR-LPT's Low
//     Poly Trees tree where the mod stands one (see below), else Seasons
//     of the Iliac Bay's picture where the mod re-skins the archive now,
//     else the classic record;
//
// at the piece's own scale, mirrored when it is turned half round as any
// placed picture is (net/decorLaw.js decorFlatMirrored), leaning with the
// wind as the town's flora leans (WIND3, systems/windDrive.js
// floraSwayOf - by its RECORD's height, a bush scaled up a bush still).
// The yard stands its pieces again when its pixel is built again - a
// season's turn, an install - as the town's own flats are.
//
// DECOR-LPT (FIELD BUGS 2026-10-05b, the owner: "elements should recieve
// the low poly overhaul style like trees got"; asked which, "Placed trees
// & plants"). A placed tree or plant Low Poly Trees has a tree for stands
// as the world's own do (LPT1, bible/07-Rendering/Low-Poly-Trees.md): its
// 3D tree within LPT_NEAR_M of the eye, turned by the piece's own turn and
// sized by its scale (a location's tree is the prefab as it is - scale 1,
// world/lowPolyTrees.js lptVariety), and the same tree's far picture
// beyond, giving way to it across the band. The far picture is a batch of
// the yard's like any (its handle held while it stands, let go with it);
// the 3D tree joins the world's near set through the yard's own
// (yardTreeSet, scenes/homeYards.js treeSets). A tree turns in earnest, so
// its picture never mirrors. The decorator's ghost asks the same door
// (`picture`), so what the ghost shows is what stands.
//
// Pure of the world host: everything it reads is handed in.
// ═══════════════════════════════════════════════════════════════════

import { getNatureArchive } from '../world/climateSwaps.js';
import { isNatureArchive } from '../world/rmbFlats.js';
import { floraSwayOf } from '../systems/windDrive.js';
import { decorFlatMirrored } from '../net/decorLaw.js';
import { LPT_SCALE_MAX, LPT_SET_FLOATS } from '../world/lowPolyTrees.js';
import { naturePicture } from '../world/naturePicture.js';   // AUDIT 05b A12: the town's own choice of a nature flat's picture

/** Whether a placed piece is the climate's nature - a flat of a nature set's archive (any piece of the catalogue's
 *  "Trees and plants" stores its set's summer archive). */
export const isNaturePiece = (piece) => piece?.model == null && Array.isArray(piece?.flat) && isNatureArchive(piece.flat[0]) && !piece.item;

/** The flat a nature piece draws in `season` (world/climateSwaps.js SEASON): its set's archive for the season, its own
 *  record - [archive, record]. */
export const yardNatureFlat = (flat, season) => [getNatureArchive(flat[0], season), flat[1]];

/** DECOR-LPT: a piece's turn (its record's yaw, degrees - scenes/decorRoom.js decorMatrix) as a 3D tree's (radians, the
 *  same way round: BB_VS turns a tree as world/mat4.js trs turns a model about +Y). */
export const yardTreeYaw = (piece) => (Number(piece?.rot?.[0]) || 0) * (Math.PI / 180);

/**
 * DECOR-LPT: A YARD'S NEAR SET - its standing trees (`{ handle, pos, scale, yaw }`, `pos` in the yard's own frame) in
 * the shape the world's near set reads a pixel's (world/lowPolyTrees.js buildTreeSet): the handles, LPT_SET_FLOATS a
 * tree - [handle index, x, y, z, scale, turn] - and each tree's centre.
 * @param {{ handle: any, pos: number[], scale: number, yaw: number }[]} trees
 */
export function yardTreeSet(trees) {
  const handles = [], centers = [];
  const out = new Float32Array(trees.length * LPT_SET_FLOATS);
  trees.forEach((t, k) => {
    let h = handles.indexOf(t.handle);
    if (h < 0) { h = handles.length; handles.push(t.handle); }
    out.set([h, t.pos[0], t.pos[1], t.pos[2], t.scale, t.yaw], k * LPT_SET_FLOATS);
    centers.push(t.pos);
  });
  return { handles, trees: out, centers };
}

/**
 * A YARD'S NATURE, STOOD. `deps`:
 *   renderer      - createBillboardBatch, uploadTexture
 *   getTexture(a), uploadRecord(a, r) - the pipeline's
 *   seasonal()    - Seasons of the Iliac Bay's helper while it stands (`lookup(archive, record)`, `installedSeason`), else
 *                   null
 *   trees         - DECOR-LPT: the world's Low Poly Trees - `{ door, sway(proto, share) }`: its door (systems/
 *                   lowPolyTreesAssets.js createLowPolyTrees - load, proto, farPicture, acquire, release) and its record
 *                   of a prototype's share of the wind's lean (the 3D trees' - scenes/world.js `_lptSway`); null while
 *                   the mod is off (or `?trees=off`): every piece a picture
 */
export function createYardNature({ renderer, getTexture, uploadRecord, seasonal = () => null, trees = null }) {
  /**
   * THE PICTURE A NATURE PIECE STANDS AS, at scale 1, in its pixel's `season` beside its `natureArchive` (the season's
   * own - what the pixel's flora is drawn from): `{ archive, key, size, sway, handle, mirrors, release }` - `key` the
   * record (or the key it went up under), `size` the picture's, `sway` its lean (by the flat's own height, the season's
   * picture's while one stands), `handle` Low Poly Trees' far picture (held - `release` lets it go; null for a picture of
   * the record) - or null: a record the archive lacks. The yard's standing piece and the decorator's ghost both ask here,
   * and here asks the town's own choice (world/naturePicture.js).
   * @param {number[]} flat @param {number} season @param {number|null} [natureArchive]
   */
  async function picture(flat, season, natureArchive = null) {
    const [archive, record] = yardNatureFlat(flat, season);
    const t = await getTexture?.(archive);
    if (!t || !(record < t.recordCount)) return null;
    // AUDIT 05b A12: the choice the town's own pixels make, the one door - DECOR-LPT: Low Poly Trees' tree first (its
    // atlases take the season the flats take), then the season's picture, then the record
    const door = trees?.door ?? null;
    const pic = await naturePicture({ door, seasons: seasonal?.() ?? null, renderer, uploadRecord }, t, archive, record);
    const sway = floraSwayOf(archive, natureArchive ?? archive, pic.plain.h);
    const far = pic.far;
    if (far) {
      door.acquire(far);
      trees?.sway?.(pic.proto, sway);   // its 3D trees lean as its far pictures do (the pixel's own record of it)
      let held = true;
      const release = () => { if (held) { held = false; door.release(far); } };
      return { archive, key: pic.key, size: { w: far.size.w / LPT_SCALE_MAX, h: far.size.h / LPT_SCALE_MAX }, sway, handle: far, mirrors: false, release };
    }
    return { archive, key: pic.key, size: pic.size, sway, handle: null, mirrors: true, release: () => {} };
  }

  /**
   * STAND ONE NATURE PIECE at `at` (the yard's origin, this visit's), in its pixel's `season` beside its `natureArchive`
   * - answering `{ batch, size, release, tree }` (`size` its picture's, at the piece's scale, for the eye's box; `tree`
   * DECOR-LPT's `{ handle, pos, scale, yaw }` for the yard's near set, or null), or null: not a nature piece, a record the
   * archive lacks, or `live()` false once the picture is in hand (the piece moved or went - nothing is made, nothing held).
   * @param {any} piece @param {number[]} at @param {{ season: number, natureArchive?: number|null, live?: () => boolean }} where
   */
  async function stand(piece, at, { season, natureArchive = null, live = () => true }) {
    if (!isNaturePiece(piece) || !renderer?.createBillboardBatch) return null;
    const pic = await picture(piece.flat, season, natureArchive);
    if (!pic) return null;
    if (!live()) { pic.release(); return null; }
    const size = { w: pic.size.w * piece.scale, h: pic.size.h * piece.scale };
    const where = [[at[0] + piece.pos[0], at[1] + piece.pos[1], at[2] + piece.pos[2]]];
    if (pic.handle) {
      // DECOR-LPT: the far picture as the pixel stands one - the batch sized for the tallest tree, this one's share on its
      // corner - giving way near the eye to its 3D tree. AUDIT 05b A9: no far rings' height - a yard's flats stand outside
      // MAC1's rings (scenes/world.js lists them apart, as every yard flat), so nothing would read one
      const batch = renderer.createBillboardBatch(pic.archive, pic.key, pic.handle.size, where, { scales: [piece.scale / LPT_SCALE_MAX] });
      batch.lptProto = pic.handle;
      batch.sway = pic.sway;
      return { batch, size, release: pic.release, tree: { handle: pic.handle, pos: [...piece.pos], scale: piece.scale, yaw: yardTreeYaw(piece) } };
    }
    const drawn = decorFlatMirrored(piece) ? { w: -size.w, h: size.h } : size;
    const batch = renderer.createBillboardBatch(pic.archive, pic.key, drawn, where);
    batch.sway = pic.sway;
    return { batch, size, release: pic.release, tree: null };
  }
  return { picture, stand };
}
