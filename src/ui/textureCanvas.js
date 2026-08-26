// ═══════════════════════════════════════════════════════════════════
// U54 — A TEXTURE ARCHIVE RECORD, AS SOMETHING THE DOM CAN SHOW.
//
// The port has had TWO halves of this since U50 and never the middle:
// `formats/textureFile.js` reads TEXTURE.### into DFBitmaps, and
// `ui/bitmapCanvas.js` turns a DFBitmap into a canvas. What was
// missing is the part that fetches an archive, keeps it, and hands a
// screen the one record it asked for - which is why U53's pack drew
// two-letter initials where the classic window draws the real icon.
//
// ── WHY IT IS A DATA URL AND NOT A CANVAS ────────────────────────
//
// A canvas is a NODE, and a node lives in exactly one place. These
// screens rebuild their whole DOM on every repaint and the same item
// icon can appear in several rows at once (two daggers, a stack, the
// same helm in a list and in a detail panel), so handing out one
// canvas would move it from row to row and leave the others blank.
// A data URL is a VALUE: any number of `<img>` elements can carry it,
// the browser decodes it once, and a repaint costs nothing.
//
// ── IT NEVER TRAPS AND NEVER RETRIES FOREVER ─────────────────────
//
// Every failure - no ARENA2, a missing archive, a record past the end,
// a palette that would not load - is cached as a MISS. The caller gets
// null and shows whatever it shows without one, and the archive is not
// fetched again on the next repaint. A screen that asked 40 times a
// second for a file that does not exist is the shape this guards
// against.
//
// The GL path is untouched: `scenes/dataPipeline.js` still owns
// getTexture/uploadRecord for the classic windows and the world. This
// is the DOM's own door to the same bytes, and both read through
// `scenes/dataSource.js`, which is the port's one data door.
// ═══════════════════════════════════════════════════════════════════

import { bitmapCanvas } from './bitmapCanvas.js';
// The name rule lives with the READER (U54 moved it there): both this
// module and scenes/shared.js need it, and neither can import the
// other without dragging in what the other is for.
import { texName } from '../formats/textureFile.js';

export { texName };

const archives = new Map();   // archive -> Promise<TextureFile|null>
const icons = new Map();      // `${archive}_${record}_${scale}` -> dataURL | null
let palettePromise = null;

/** ART_PAL.COL, once. The same palette scenes/world.js hands the
 *  pipeline, and the same one every TEXTURE archive is drawn with. */
function getPalette() {
  palettePromise ??= (async () => {
    try {
      const [{ DFPalette }, { getBytes }] = await Promise.all([
        import('../formats/dfPalette.js'),
        import('../scenes/dataSource.js'),
      ]);
      const pal = new DFPalette();
      pal.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
      return pal;
    } catch (e) {
      console.warn('[icons] ART_PAL.COL unavailable; the DOM screens keep their fallbacks', e);
      return null;
    }
  })();
  return palettePromise;
}

function getArchive(archive) {
  if (archives.has(archive)) return archives.get(archive);
  const p = (async () => {
    try {
      const [{ TextureFile }, { getBytes }] = await Promise.all([
        import('../formats/textureFile.js'),
        import('../scenes/dataSource.js'),
      ]);
      const pal = await getPalette();
      if (!pal) return null;
      const name = texName(archive);
      const t = new TextureFile();
      t.load(await getBytes(name), name, pal);
      return { file: t, palette: pal };
    } catch (e) {
      console.warn(`[icons] ${texName(archive)} unavailable`, e);
      return null;   // cached as a miss - never fetched again
    }
  })();
  archives.set(archive, p);
  return p;
}

/**
 * The record as a data URL, or null while it is not here yet.
 *
 * SYNCHRONOUS ON PURPOSE: a screen that rebuilds its DOM cannot await
 * inside a render. It gets what is cached, and `onReady` fires ONCE
 * when a cold record lands so the screen can repaint itself. A record
 * that is already cached fires nothing, so a repaint cannot loop.
 */
export function requestIcon(archive, record, { scale = 2, onReady = null } = {}) {
  if (!Number.isInteger(archive) || !Number.isInteger(record) || record < 0) return null;
  const key = `${archive}_${record}_${scale}`;
  if (icons.has(key)) return icons.get(key);
  // IN FLIGHT. Without this the next repaint finds nothing cached and
  // starts a SECOND decode of the same record, and the one after that
  // a third - measured at exactly double the repaints for a three-item
  // pack. It does not loop forever, because the first decode to land
  // caches the answer and every later call is a hit; what it wastes is
  // one decode per repaint until then, which on a list of thirty items
  // is thirty. Bounded waste, not a hang - said precisely, because the
  // first draft of this comment claimed a loop it cannot cause.
  icons.set(key, null);
  getArchive(archive).then((got) => {
    if (!got) return;
    try {
      if (record >= got.file.recordCount) {
        console.warn(`[icons] ${texName(archive)} has no record ${record}`);
        return;
      }
      const bmp = got.file.getDFBitmap(record, 0);
      const rgb = (i) => { const c = got.palette.get(i); return [c.r, c.g, c.b]; };
      const canvas = bitmapCanvas(bmp, rgb, { scale });
      if (!canvas) return;
      icons.set(key, canvas.toDataURL('image/png'));
      onReady?.();
    } catch (e) {
      console.warn(`[icons] ${texName(archive)} record ${record} would not draw`, e);
    }
  });
  return null;
}

/** Test seam, and the door a host would use to warm a list up front.
 *  Resolves to the data URL or null - never throws. */
export async function loadIcon(archive, record, { scale = 2 } = {}) {
  const already = requestIcon(archive, record, { scale });
  if (already) return already;
  await getArchive(archive);
  // one turn for the .then above to have run
  await Promise.resolve();
  return icons.get(`${archive}_${record}_${scale}`) ?? null;
}

/** Drop everything. Only a test or a data-source change wants this. */
export function _resetIconsForTests() {
  archives.clear();
  icons.clear();
  palettePromise = null;
}
