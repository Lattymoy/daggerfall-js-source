// INTRO2: one asset for the title, the front door and its section masthead.
// BR5 (Mac, 2026-10-11): DFO Online's logo - his own file, with real alpha,
// cut to its painted bounds and nothing else (every pixel inside is his,
// unchanged; no pixel outside them had any alpha). It draws as it is: no
// blend mode, because its dark outlines and shadow are the art.
import { t } from '../systems/textManager.js';   // L10N4: the mark's alt text in the player's language

export const BRAND_LOGO_URL = new URL('../assets/branding/dfo-online.png', import.meta.url).href;
export const BRAND_LOGO_ALT = 'DFO Online';
/** L10N4: the alt text a screen reader hears, in the player's language (BRAND_LOGO_ALT stays the English). */
export const brandLogoAlt = () => t('menu.brand.alt', BRAND_LOGO_ALT);

export function brandMark(doc = document) {
  const image = doc.createElement('img');
  image.src = BRAND_LOGO_URL;
  image.alt = brandLogoAlt();
  image.className = 'brand-logo';
  image.width = 526;
  image.height = 322;
  image.draggable = false;
  return image;
}
