// The PROTOTYPE host for enhanced character creation, at /chargen.html.
//
// Thin, like the menu's: the screen lives in src/ui/enhancedChargen.js
// and the game will mount that same module. What this adds is the
// data - a REAL ChargenFlow off the real CLASS*.CFG, BIOG*.TXT,
// CLASSES.DAT and FACTION.TXT, and the real TAMRIEL2 picker - so the
// prototype is argued with on the game's own numbers rather than on
// invented ones.
//
// It needs ARENA2, which the enhanced MENU deliberately does not: a
// map traced from the player's own file cannot be drawn before the
// player has handed the file over. The pick is the same one the game
// uses, and a refusal falls through to the map's named-list arm rather
// than to a blank page.
import { mountEnhancedChargen, attachChargenText } from '../ui/enhancedChargen.js';
import { createChargenFlow } from '../systems/chargenSession.js';
import { ensureArena2, getBytes } from '../scenes/dataSource.js';
import { ImgFile } from '../formats/imgFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { TextRsc } from '../formats/textRsc.js';

const app = document.getElementById('app');

/** BOTH map files. TAMRIEL2 carries the eight homelands; TMAP00I0 is
 *  the painting, and the Imperial Province can only be recovered from
 *  the two together (see ui/provinceMap.js INERT_REGION). The palette
 *  is ART_PAL, which is what the port already draws TMAP00I0 with. */
async function loadMap() {
  const one = async (name) => {
    const img = new ImgFile();
    img.load(await getBytes(name), name, new DFPalette());
    return img.getDFBitmap(0, 0);
  };
  try {
    // load() does not return the palette, so it is built then loaded -
    // chaining handed the trace a boolean and the map fell silently to
    // its list arm, which is exactly the kind of quiet degradation the
    // never-traps law is meant to survive rather than hide.
    const pal = new DFPalette();
    pal.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
    const [picker, picture] = await Promise.all([one('TAMRIEL2.IMG'), one('TMAP00I0.IMG')]);
    return { picker, picture, palette: (i) => { const c = pal.get(i); return [c.r, c.g, c.b]; } };
  } catch (e) {
    console.warn('[chargen prototype] the map files are unavailable', e);
    return { picker: null, picture: null, palette: null };
  }
}

async function loadText() {
  try { return new TextRsc().load(await getBytes('TEXT.RSC')); }
  catch (e) { console.warn('[chargen prototype] TEXT.RSC unavailable', e); return null; }
}

await ensureArena2();
const [{ flow }, map, textRsc] = await Promise.all([
  createChargenFlow(getBytes), loadMap(), loadText(),
]);
attachChargenText(flow, textRsc);
mountEnhancedChargen(app, {
  flow,
  ...map,
  onExit: (why) => console.log('[chargen prototype]', why),
});
