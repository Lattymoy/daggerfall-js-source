// INTRO2: one asset for the title, the front door and its section masthead. Mac's own file, with real alpha, cut to
// its painted bounds, drawn with no blend mode: its dark outlines are the art (BR5).
// BR7 (Mac, 2026-11-01: "replace the website and ingame logo with this"): the DFO Online wordmark over its scroll,
// his 1678 x 937 file cut to the 1635 x 928 its paint covers, scaled to 1232 x 699 as BR6's dragon was.
import { t } from '../systems/textManager.js'; // L10N4: the mark's alt text in the player's language

export const BRAND_LOGO_URL = new URL('../assets/branding/dfo-online.png', import.meta.url).href;
// LOGO-CENTRE (Mac, 2026-10-26: "The main logo is off center"): every surface that centres the mark shifts it back by
// how far its paint's centre stands from the file's, measured from the file by test/ui/brand.test.js. BR6's dragon
// needed 10%; BR7's wordmark weighs on the file's own centre (0.02% off), so 0. The launcher sets it at its left edge.
export const BRAND_LOGO_OPTICAL_SHIFT = 0;
export const BRAND_LOGO_ALT = 'DFO Online';
/** L10N4: the alt text a screen reader hears, in the player's language (BRAND_LOGO_ALT stays the English). */
export const brandLogoAlt = () => t('menu.brand.alt', BRAND_LOGO_ALT);

export function brandMark(doc = document) {
  const image = doc.createElement('img');
  image.src = BRAND_LOGO_URL;
  image.alt = brandLogoAlt();
  image.className = 'brand-logo';
  image.width = 1232;
  image.height = 699;
  image.draggable = false;
  return image;
}
