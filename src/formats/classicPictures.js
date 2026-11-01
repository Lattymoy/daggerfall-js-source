// A MOD'S PICTURE THAT IS DAGGERFALL'S OWN, REBUILT FROM THE PLAYER'S FILES. tools/classicDerive.mjs writes a spec for
// each such picture (formats/derivedTexture.js: the record, where it lands, the author's own pixels as edits, and `pal`,
// the palette the author's copy was drawn in). This reads the record out of the player's TEXTURE file in that palette and
// builds the picture, for any reader that is not a world pipeline (the texture door has its own context,
// scenes/dataPipeline.js, in ART_PAL alone). A spec with `file` names a CIF or RCI file instead, `from: [record, frame]`
// (NO-BETHESDA3: Roleplay & Realism's buttons over BUTTONS.RCI, Diverse Weapons' daggers over WEAPON02.CIF).
import { TextureFile } from './textureFile.js';
import { CifRciFile } from './cifRciFile.js';
import { DFPalette } from './dfPalette.js';
import { classicRecordRgba, buildDerivedPicture } from './derivedTexture.js';

export const DEFAULT_PALETTE = 'ART_PAL.COL';
const textureName = (archive) => `TEXTURE.${String(archive).padStart(3, '0')}`;
/** A loaded file's record frame in palette `p`, or null where it has none. */
function recordRgba(file, record, frame, p) {
  if (!file || !(record >= 0 && record < file.recordCount)) return null;
  const bm = file.getDFBitmap(record, frame);
  return bm?.width ? classicRecordRgba(bm, p) : null;
}

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
  const cifRciFile = (name) => once(files, `file:${name}`, async () => {
    const c = new CifRciFile();
    return c.load(new Uint8Array(await getBytes(name)), name, null) ? c : null;
  });
  /** The record's frame as a top-down RGBA picture in `pal`, index 0 clear - null where the player's data has none. */
  async function picture(archive, record, frame = 0, pal = DEFAULT_PALETTE) {
    const [t, p] = await Promise.all([texture(archive), palette(pal)]);
    return recordRgba(t, record, frame, p);
  }
  /** The same for a record of a CIF or RCI file (`WEAPON02.CIF`, `BUTTONS.RCI`). */
  async function cifRciPicture(name, record, frame = 0, pal = DEFAULT_PALETTE) {
    const [c, p] = await Promise.all([cifRciFile(name), palette(pal)]);
    return recordRgba(c, record, frame, p);
  }
  /** A derived spec's picture, built from the player's record in the spec's own palette. */
  const build = (spec) => {
    const pal = spec.pal ?? DEFAULT_PALETTE;
    return buildDerivedPicture(spec, spec.file ? (r, f) => cifRciPicture(spec.file, r, f, pal) : (a, r, f) => picture(a, r, f, pal));
  };
  /** The record's frame as palette indices ({ width, height, data }), for a rule that works in the
   *  palette's own ramps (systems/roleplayRealism/rrKeepers.js) - null where the player's data has none. */
  async function bitmap(archive, record, frame = 0) {
    const textureFile = await texture(archive);
    if (!textureFile || !(record >= 0 && record < textureFile.recordCount)) return null;
    const frameBitmap = textureFile.getDFBitmap(record, frame);
    return frameBitmap?.width ? { width: frameBitmap.width, height: frameBitmap.height, data: frameBitmap.data } : null;
  }
  return { picture, cifRciPicture, build, bitmap, palette: (name = DEFAULT_PALETTE) => palette(name) };
}
