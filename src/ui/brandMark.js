// INTRO2: one asset for the title, the front door and its section masthead.
// BR5 (Mac, 2026-10-11): DFO Online's logo - his own file, with real alpha,
// cut to its painted bounds and nothing else (every pixel inside is his,
// unchanged; no pixel outside them had any alpha). It draws as it is: no
// blend mode, because its dark outlines and shadow are the art.
// BR6 (Mac, 2026-10-26): the dragon mark replaces it - his 2000 x 1434
// file cut to the 1680 x 1410 its paint covers (none outside it had any
// alpha), then scaled to 1232 x 1034 at his word, the same 56:47, so the
// page stays light; it is drawn no wider than 595px.
import { t } from '../systems/textManager.js';   // L10N4: the mark's alt text in the player's language

export const BRAND_LOGO_URL = new URL('../assets/branding/dfo-online.png', import.meta.url).href;
// LOGO-CENTRE (Mac, 2026-10-26: "The main logo is off center"): the file is cut to its paint, and the dragon's wing
// and tail reach far left of the letters, so a box centred on the page put the WORDMARK right of centre - at 1280 x 720
// the Online scroll sat about 100 px right of the Tap to continue box under it. The letters at mid-height (the D's bowl
// at x 265 to the O's outline at 1212, of 1232) centre 10% of the width right of the file's; every surface that centres
// the mark draws it that 10% back (the film's title, the door and the masthead, the site's page), so DFO stands on the
// centre line and the dragon hangs to its left. test/ui/brand.test.js measures it from the file, so the next logo
// reddens there rather than in a layout. The launcher sets the mark at its left edge and is not moved.
export const BRAND_LOGO_OPTICAL_SHIFT = 0.1;
export const BRAND_LOGO_ALT = 'DFO Online';
/** L10N4: the alt text a screen reader hears, in the player's language (BRAND_LOGO_ALT stays the English). */
export const brandLogoAlt = () => t('menu.brand.alt', BRAND_LOGO_ALT);

export function brandMark(doc = document) {
  const image = doc.createElement('img');
  image.src = BRAND_LOGO_URL;
  image.alt = brandLogoAlt();
  image.className = 'brand-logo';
  image.width = 1232;
  image.height = 1034;
  image.draggable = false;
  return image;
}
