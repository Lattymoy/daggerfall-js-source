// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TILE1 — THE CHARACTER'S FACE, IN ONE HOME.
//
// Mac (2026-09-22), on what the save tiles must show: "Basically
// showing your portrait and character information."
//
// A face is ten records in the race-and-gender FACE CIF and an index
// on the character (`systems/races.js` FACES_PER_RACE, and the save
// envelope carries `race`, `gender` and `faceIndex` - S3c/U9's
// identity fields). Drawing one was written INSIDE
// `systems/chargenSession.js`'s `chargenViewDeps`, where the wizard is
// the only thing that could reach it.
//
// THE SAVE TILE IS THE SECOND CALLER, so the drawing moves here rather
// than being copied. That is this project's standing rule and the
// reason it exists: two copies of "which CIF, which palette, which
// record" drift the day one of them learns about a mod's replacement
// art and the other does not.
//
// ═══ IT NEVER THROWS AND IT NEVER TRAPS ════════════════════════════
//
// Every arm answers `null` for a face it could not draw: no data
// source yet, a CIF the player's copy does not have, a face index from
// a save an older build wrote. The chargen wizard already had that law
// ("NEVER TRAPS: no CIF, no portraits, and the wizard still walks"),
// and a menu that refuses to open because a portrait would not load
// would be far worse than a tile with no picture on it.
//
// ═══ CACHED PER IDENTITY, BECAUSE A LIST REDRAWS ═══════════════════
//
// A pane of tiles repaints on every press, every skin switch and every
// Escape. Ten canvases per race-and-gender pair are loaded once and
// handed out; the CANVAS ITSELF is reused rather than cloned, because
// `cloneNode` on a canvas copies its size and NOT its pixels - a blank
// portrait that looks exactly like one that failed to load, which is
// the trap enhancedChargen.js records finding.
//
// That reuse has a price and it is stated here: ONE canvas cannot be
// in two places at once, so a caller that wants the same face twice on
// screen asks for a COPY (`copy: true`), which draws it onto a fresh
// canvas rather than cloning an empty one.
// ═══════════════════════════════════════════════════════════════════

/** race|gender -> { pending?: Promise, canvases: HTMLCanvasElement[] } */
const cache = new Map();
/** The ART palette, loaded once - every CIF here reads through it. */
let palettePromise = null;

/** The palette as `bitmapCanvas` wants it: an index to [r, g, b]. */
async function artPalette() {
  if (!palettePromise) {
    palettePromise = (async () => {
      const [{ DFPalette }, { getBytes }] = await Promise.all([
        import('../formats/dfPalette.js'), import('../scenes/dataSource.js'),
      ]);
      const pal = new DFPalette();
      pal.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
      // BOTH HALVES. `CifRciFile.load` wants the DFPalette itself and
      // `bitmapCanvas` wants an index-to-rgb function; chargenSession
      // built the pair the same way, and handing the CIF a null palette
      // is how a record comes back with no colours at all.
      return { pal, rgb: (i) => { const c = pal.get(i); return [c.r, c.g, c.b]; } };
    })().catch((e) => {
      console.warn('[face] ART_PAL.COL is unavailable; no portraits', e?.message ?? e);
      palettePromise = null;   // a later attempt may find the files mounted
      return null;
    });
  }
  return palettePromise;
}

/**
 * The ten heads of one race and gender, AS CANVASES. `[]` when they
 * could not be drawn - never a throw and never a partial set.
 *
 * NOT `loadFaceSet`, which `ui/chargenArt.js` already exports and which
 * is a different thing under a similar name: that one uploads the same
 * ten records as GL TEXTURES for the classic chargen screen and returns
 * nothing. Two modules exporting one name is how a reader imports the
 * wrong one, which is the whole of AUDIT 24's ratchet - and the ratchet
 * caught this the moment the second one existed.
 *
 * @param {string} raceKey
 * @param {string} gender
 * @param {{scale?: number}} [opts]
 * @returns {Promise<HTMLCanvasElement[]>}
 */
export async function loadFaceCanvases(raceKey, gender, { scale = 2 } = {}) {
  const key = `${raceKey}|${gender}|${scale}`;
  const have = cache.get(key);
  if (have?.canvases) return have.canvases;
  if (have?.pending) return have.pending;

  const pending = (async () => {
    const palette = await artPalette();
    if (!palette) return [];
    const [{ CifRciFile }, races, { bitmapCanvas }, { getBytes }] = await Promise.all([
      import('../formats/cifRciFile.js'), import('../systems/races.js'),
      import('./bitmapCanvas.js'), import('../scenes/dataSource.js'),
    ]);
    const name = races.raceArt(raceKey, gender).heads;
    const cif = new CifRciFile();
    cif.load(await getBytes(name), name, palette.pal);
    // ═══ POSITIONAL, AND THAT IS NOT A DETAIL (AUDIT-312 F5) ══════
    //
    // THE INDEX IS THE IDENTITY. `faceIndex` is written on the save
    // envelope (S3c/U9) and it addresses a RECORD NUMBER in the CIF -
    // so this array is addressed by it at both ends: the chargen
    // wizard's grid walks 0..FACES_PER_RACE-1 and reads `canvases[i]`
    // (ui/enhancedChargen.js, which already draws the number where a
    // face is missing), and `loadFace` below reads `set[faceIndex]`.
    //
    // The first cut of this extraction ended `.filter(Boolean)`, which
    // COMPACTS. `bitmapCanvas` returns null for a record with no data
    // or a canvas with no 2d context, so one bad record shifted every
    // later face down by one - and `ui/chargenArt.js`'s loadFaceSet,
    // the OTHER reader of these ten records, pushes for every `i` and
    // never compacts. Two homes for the ten heads that disagreed about
    // what index 5 means is the exact drift this module was extracted
    // to prevent, so the hole is KEPT and every reader already handles
    // one.
    const set = [];
    for (let i = 0; i < races.FACES_PER_RACE; i++) set.push(bitmapCanvas(cif.getDFBitmap(i, 0), palette.rgb, { scale }));
    return set;
  })().then((set) => {
    cache.set(key, { canvases: set });
    return set;
  }).catch((e) => {
    console.warn('[face] the FACE CIF would not load', e?.message ?? e);
    // REMEMBERED AS EMPTY, not forgotten: a player whose copy has no
    // CIF must not have the whole list re-ask for it on every repaint.
    cache.set(key, { canvases: [] });
    return [];
  });
  cache.set(key, { pending });
  return pending;
}

/**
 * ONE face, or null.
 *
 * @param {{race?: string, gender?: string, faceIndex?: number}} who  the save envelope's own identity fields
 * @param {{scale?: number, copy?: boolean}} [opts]
 * @returns {Promise<HTMLCanvasElement|null>}
 */
export async function loadFace(who, { scale = 2, copy = false } = {}) {
  if (!who) return null;
  const set = await loadFaceCanvases(who.race ?? 'Breton', who.gender === 'female' ? 'female' : 'male', { scale });
  const i = Number.isInteger(who.faceIndex) ? who.faceIndex : 0;
  // A FACE INDEX OUT OF RANGE IS NOT A CRASH. A save written by an
  // older build, or by a mod that added heads, is drawn with the first
  // face rather than with nothing.
  const art = set[i] ?? set[0] ?? null;
  if (!art || !copy) return art;
  const c = document.createElement('canvas');
  c.width = art.width; c.height = art.height;
  // Not `cloneNode`: that copies the size and NOT the pixels, which is
  // a blank portrait that looks exactly like a portrait that failed.
  c.getContext('2d')?.drawImage(art, 0, 0);
  return c;
}

/** Testing seam: the cache is module state, and a pin that drove two
 *  identities in one process would otherwise see the first one's. */
export function _resetFacesForTests() { cache.clear(); palettePromise = null; }
