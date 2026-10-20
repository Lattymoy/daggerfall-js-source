// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BANTHA2 (2026-10-19, the owner, with their "Jungle Preview": "At the ground level, the image shows the flora abundence
// that should be present in the jungle"): THE JUNGLE'S FLOOR - a module the world host wires (HOST-SPLIT, bible/01-
// Overview/Host-Split.md: scenes/fishHost.js is the shape), never grown into bootWorld. bible/03-World/Bantha-Jungle.md
// "The floor" is the record.
//
// BANTHA1's floor storey stands the rainforest's cover as flats, half a tile's chance a 6.4 m tile - a plant every 80
// square metres, the jungle's ground showing between them; the owner's preview has no ground showing at all. A carpet
// that thick is the grass system's to draw (render/labGrass.js: a field of cells about the eye, placed a slice a frame,
// faded and culled, instanced), so the floor is a SECOND FIELD of it - its own renderer wearing the floor's plants
// (render/jungleFloorArt.js: archive 500's ferns, sedge, bush, palmlets and blooms and the owner's tall tuft, on the
// meadow's crossed cards), its own density (JUNGLE_FLOOR.plants a square metre) and seed:
//   - WHERE: a plant stands where the jungle's floor claims the point (jungleHost.floorClaims: the point's own draw under
//     the layout's share, so the carpet comes in across the edge as the trees do) on the ground the meadow stands on and
//     on bare earth too (the world host's keep, its floor's records: grass and dirt - never stone, a road, a track, water,
//     a site's floor or the snow the ground shows); the meadow's own grass keeps out of every point the floor claims, so
//     the two never stand twice.
//   - WHEN: made the first time the jungle comes within JUNGLE_FLOOR.near of the eye (its pictures read then, the
//     classic record's or a pack's - the floor flats' own), and kept: outside the jungle its cells hold nothing. No
//     ARENA2 picture, no floor (the meadow stands as it did).
// The field's frame, its slices, its fade and its cull are the meadow's own, and its draw the meadow's program.
// ═══════════════════════════════════════════════════════════════════
import { LabGrassRenderer, createGrassField, grassStagesOf, LAB_GRASS, GRASS_CELL } from '../render/labGrass.js';
import { MEADOW_BLADES_PER_TUFT } from '../render/grassMeadow.js';
import { jungleFloorArt, JUNGLE_FLOOR_ARCHIVE, JUNGLE_FLOOR_PLANTS, JUNGLE_FLOOR_PLANTS_M2 } from '../render/jungleFloorArt.js';
import { JUNGLE_EDGE } from '../world/jungle/jungleRegion.js';
import { classicRecordRgba } from '../formats/derivedTexture.js';
import { hasTextureReplacement, decodedTextureTopDown } from '../systems/textureReplacement.js';

/**
 * THE FLOOR'S NUMBERS. `plants` a square metre where the floor is whole - as blades, MEADOW_BLADES_PER_TUFT a plant, over
 * the lab's own measuring span: JUNGLE-GRASS (render/jungleFloorArt.js JUNGLE_FLOOR_PLANTS_M2) - the meadow's own grass
 * (2.27 at Full) and the owner's flora at the rate they judged it (BANTHA2 thinned the whole floor from 2.5 to 1.8 on
 * "Reduce the amount of ground flora. Its a little too much"; at 1.8 its tufts and sedge were 0.88 a square metre, two fifths of the meadow's, and the owner:
 * "Grass isnt showing within the new jungle region", 2026-10-19); `seed` its field's (never the
 * meadow's: a field of the meadow's seed at a lower density stands on a prefix of its spots); `near` how far outside the
 * jungle's line (m) the eye comes before the floor is made - the field's whole range and the layout's own fringe.
 */
export const JUNGLE_FLOOR = Object.freeze({
  plants: JUNGLE_FLOOR_PLANTS_M2,
  seed: 0x4a464c52,   // 'JFLR'
  near: LAB_GRASS.range + JUNGLE_EDGE.out + 400,
});
/** The floor field's density in the lab's units (blades over its measuring span's square) at a grass density `scale` of
 *  the pref's (1 the row's Full). */
export const floorDensity = (scale = 1) => JUNGLE_FLOOR.plants * MEADOW_BLADES_PER_TUFT * (2 * LAB_GRASS.densitySpan) ** 2 * scale;

/**
 * THE FLOOR'S PICTURES, as the floor flats wear them: each record's from a texture pack where one answers (its decoded
 * PNG - getTexture(archive) decodes the archive's ahead, scenes/dataPipeline.js), else the player's own TEXTURE file's in
 * the world's palette. `getTexture` the pipeline's; answers a Map record -> { width, height, data } (RGBA, top row first)
 * of those it could read.
 * @param {{ getTexture: (archive: number) => Promise<any>, palette: any }} o
 */
export const floorPictures = ({ getTexture, palette }) => async (archive, records) => {
  const t = await getTexture(archive);
  const out = new Map();
  for (const r of records) {
    const pack = hasTextureReplacement(archive, r) ? decodedTextureTopDown(archive, r) : null;
    if (pack) { out.set(r, { width: pack.width, height: pack.height, data: pack.rgba }); continue; }
    if (!t || t.vendor || !(r < t.recordCount)) continue;
    const bm = t.getDFBitmap(r, 0);
    if (bm?.width) out.set(r, classicRecordRgba(bm, palette));
  }
  return out;
};

/**
 * @param {{ gl: WebGL2RenderingContext, jungle: { depthAt: (x: number, z: number) => number, floorClaims: (x: number, z: number) => boolean },
 *   pictures: (archive: number, records: number[]) => Promise<Map<number, any>>, density?: number, provoke?: boolean,
 *   onArrive?: () => void }} deps
 *   `pictures` the RGBA of archive 500's records (world.js: the pipeline's TEXTURE file or a pack's picture), `density`
 *   the pref's share (world.js grassDensity over LAB_GRASS.density), `onArrive` called once the floor stands (the
 *   meadow's cells are placed again, keeping out of it)
 */
export function createJungleFloorHost({ gl, jungle, pictures, density = 1, provoke = true, onArrive = () => {} }) {
  let renderer = null, field = null, loading = null, failed = false;
  const records = JUNGLE_FLOOR_PLANTS.map((p) => p.record).filter((r) => r != null);
  /** make the floor: its pictures read, its set built, its renderer made - once (its field comes with the host's pairing) */
  const make = () => {
    loading = pictures(JUNGLE_FLOOR_ARCHIVE, records).then((pics) => {
      const art = jungleFloorArt((r) => pics.get(r) ?? null);
      if (!art) { failed = true; return; }
      renderer = new LabGrassRenderer(gl, { art, stages: grassStagesOf(art), provoke });
      onArrive();   // the host's meadow field made again, and paired - the floor's field with it (pair)
    }).catch((e) => { failed = true; console.warn('[jungle] the floor stands no plants:', e?.message ?? e); });   // a read or a build that failed: never asked again, said once
  };
  return {
    /** Whether the floor stands (made, its pictures read). */
    get on() { return !!field; },
    /** WHETHER THE FLOOR CLAIMS a scene point - the meadow's keep asks it of every blade, and keeps out (off: never). */
    claims(x, z) { return !!field && jungle.floorClaims(x, z); },
    /**
     * THE FRAME'S FLOOR, before its draw: made the first time the jungle comes within JUNGLE_FLOOR.near of the eye
     * (`ex`, `ez` scene metres) - its renderer, and its field once the host pairs its meadow's - then walked as the
     * meadow's is - `keep(x, z)` the world host's floor keep (its
     * ground, its paths, its water, its snow - the floor's records), asked only where the floor claims the point.
     */
    update(ex, ez, keep, ground, slope) {
      if (!renderer) {
        if (!loading && !failed && jungle.depthAt(ex, ez) > -JUNGLE_FLOOR.near) make();
        return;
      }
      if (!field) return;
      field.update(ex, ez, (x, z) => (jungle.floorClaims(x, z) ? keep(x, z) : null), ground, slope);
    },
    /** THE FLOOR'S DRAW, beside the meadow's (`meadow` its renderer, drawn this frame): under its view, its light, its
     *  wind and its range (LabGrassRenderer's `frame`), in the meadow's program. */
    drawBeside(meadow) {
      if (field && meadow?.frame) renderer.draw(...meadow.frame, 'meadow');
    },
    /**
     * THE MEADOW'S FIELD, PAIRED: the world host's every door to its grass field (a pixel re-read, the burned earth, the
     * floating origin's shift - pixelBuild.js, riteHost, world.js) reaches the floor's too, so the floor is kept in step
     * where the meadow is, by the one handle. A new meadow field (a new world: a teleport's re-anchor) is a new floor
     * field as well. Answers the handle the host keeps.
     * @param {ReturnType<typeof createGrassField>} meadow
     */
    pair(meadow) {
      if (renderer) field = createGrassField(renderer, { keep: () => null, density: floorDensity(density), seed: JUNGLE_FLOOR.seed, cell: GRASS_CELL });
      return Object.assign(Object.create(meadow), {
        invalidate(x0, z0, x1, z1) { meadow.invalidate(x0, z0, x1, z1); field?.invalidate(x0, z0, x1, z1); },
        shiftOrigin(offset) { meadow.shiftOrigin(offset); field?.shiftOrigin(offset); },
      });
    },
    /** The renderer's GL let go - for a host that tears its world down (the world host leaves it, as it leaves the
     *  meadow's renderer, to the page's GL context). */
    destroy() { renderer?.destroy(); renderer = null; field = null; },
    /** For the tests and the probes. */
    get renderer() { return renderer; },
    get field() { return field; },
    get loading() { return loading; },
  };
}
