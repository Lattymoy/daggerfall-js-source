// NO-BETHESDA2 (2026-10-31; the owner: "ensuring they are not implemented"): A MOD'S PICTURE THAT IS DAGGERFALL'S OWN,
// REBUILT FROM THE PLAYER'S FILES. tools/classicDerive.mjs writes a spec for each such picture (formats/derivedTexture.js:
// the record, where it lands, the author's own pixels as edits, and `pal`, the palette the author's copy was drawn in).
// This reads the record out of the player's TEXTURE file in that palette and builds the picture, for any reader that
// is not a world pipeline (the texture door has its own context, scenes/dataPipeline.js, in ART_PAL alone).
import { TextureFile } from './textureFile.js';
import { DFPalette } from './dfPalette.js';
import { classicRecordRgba, buildDerivedPicture } from './derivedTexture.js';

export const DEFAULT_PALETTE = 'ART_PAL.COL';
const textureName = (archive) => `TEXTURE.${String(archive).padStart(3, '0')}`;

/** A reader over `getBytes(name)` (the player's ARENA2: scenes/dataSource.js getBytes, or a test's own). Each file and
 *  palette is read once; a failed read is forgotten so the next ask reads again. */
export function createClassicPictures(getBytes) {
  const files = new Map(), palettes = new Map();
  const once = (cache, key, make) => {
    if (!cache.has(key)) {
      const p = make();
      cache.set(key, p);
      p.catch(() => { if (cache.get(key) === p) cache.delete(key); });
    }
    return cache.get(key);
  };
  const palette = (name) => once(palettes, name, async () => {
    const p = new DFPalette();
    p.load(new Uint8Array(await getBytes(name)), name);
    return p;
  });
  const texture = (archive) => once(files, archive, async () => {
    const t = new TextureFile();
    const name = textureName(archive);
    return t.load(new Uint8Array(await getBytes(name)), name, null) ? t : null;
  });
  /** The record's frame as a top-down RGBA picture in `pal`, index 0 clear - null where the player's data has none. */
  async function picture(archive, record, frame = 0, pal = DEFAULT_PALETTE) {
    const [t, p] = await Promise.all([texture(archive), palette(pal)]);
    if (!t || !(record >= 0 && record < t.recordCount)) return null;
    const bm = t.getDFBitmap(record, frame);
    return bm?.width ? classicRecordRgba(bm, p) : null;
  }
  /** A derived spec's picture, built from the player's record in the spec's own palette. */
  const build = (spec) => buildDerivedPicture(spec, (a, r, f) => picture(a, r, f, spec.pal ?? DEFAULT_PALETTE));
  return { picture, build };
}
