// INTRO2: one asset for the title, the front door and its section masthead.
// Mac's supplied 19956.png is JPEG data; preserved byte for byte, with its
// real extension. Screen blending removes its black backing at draw time.
export const ENHANCED_LOGO_URL = new URL('../assets/branding/daggerfall-enhanced.jpg', import.meta.url).href;
export const ENHANCED_LOGO_ALT = 'The Elder Scrolls II: Daggerfall Enhanced';

export function brandMark(doc = document) {
  const image = doc.createElement('img');
  image.src = ENHANCED_LOGO_URL;
  image.alt = ENHANCED_LOGO_ALT;
  image.className = 'enhanced-logo';
  image.width = 1536;
  image.height = 512;
  image.draggable = false;
  return image;
}
