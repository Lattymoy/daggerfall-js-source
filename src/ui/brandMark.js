// INTRO2: one asset for the title, the front door and its section masthead.
// BR4 (Mac, 2026-09-27): Daggerfall Online's temporary logo - his own cut,
// with real alpha, preserved byte for byte. It draws as it is: no blend
// mode, because its black outlines and the ONLINE lettering are the art.
export const BRAND_LOGO_URL = new URL('../assets/branding/daggerfall-online.png', import.meta.url).href;
export const BRAND_LOGO_ALT = 'The Elder Scrolls II: Daggerfall Online';

export function brandMark(doc = document) {
  const image = doc.createElement('img');
  image.src = BRAND_LOGO_URL;
  image.alt = BRAND_LOGO_ALT;
  image.className = 'brand-logo';
  image.width = 2112;
  image.height = 850;
  image.draggable = false;
  return image;
}
