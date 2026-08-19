// U21c: THE TITLE SCREEN - the project's own branding, before the menu.
//
// This is a DELIBERATE DEPARTURE, not a port, and it is worth being
// precise about why. Classic Daggerfall's title art is TITL00I0.IMG,
// which this port reads and pins byte-exact (imgcif.test.js pins its x4
// embedded-palette expansion) - but DFU does not draw it either.
// TITL00I0 appears nowhere in the DFU source except ImgFile's palettized
// file list: DFU replaced classic's title with its OWN branding. Our
// analogue of that is our own logo, which is what this draws. Ledger A.
//
// It is also the first non-ARENA2 image the port has ever loaded. Game
// data never enters the repo (Port-Doctrine); OUR artwork is ours and
// ships with the build, out of public/ where vite serves it at the root.
//
// NEVER TRAPS: if the logo is missing the title screen does not draw at
// all and the boot goes straight to the menu - the same law the char
// sheet and chargen follow when their art fails to load. A missing
// asset costs you a splash, never a game.

/** Where the logo lives. public/ is served at the site root. */
export const LOGO_URL = 'logo.png';

/** The logo occupies this much of the virtual screen's width, at most.
 *  Kept off the edges so the banner reads as a title, not a wallpaper. */
export const LOGO_MAX_WIDTH = 0.86;

/**
 * Decode an image URL into the { width, height, colors } shape
 * renderer.uploadTexture wants. Resolves null when the asset is absent -
 * a missing logo is not an error, it is just no title screen.
 */
export async function loadLogo(url = LOGO_URL, doc = globalThis.document) {
  if (!doc) return null;
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    const cv = doc.createElement('canvas');
    cv.width = bitmap.width;
    cv.height = bitmap.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(bitmap, 0, 0);
    const { data } = g.getImageData(0, 0, cv.width, cv.height);
    return { width: cv.width, height: cv.height, colors: new Uint8Array(data) };
  } catch {
    return null;                       // absent, blocked, or undecodable
  }
}

/**
 * The logo's screen rect: centred, aspect preserved, never wider than
 * LOGO_MAX_WIDTH of the canvas nor taller than the canvas allows.
 * Pure arithmetic, so it is pinned directly.
 */
export function logoRect(canvasW, canvasH, logoW, logoH, maxWidth = LOGO_MAX_WIDTH) {
  if (!logoW || !logoH) return null;
  const fit = Math.min((canvasW * maxWidth) / logoW, (canvasH * maxWidth) / logoH);
  const w = Math.round(logoW * fit), h = Math.round(logoH * fit);
  return { x: Math.round((canvasW - w) / 2), y: Math.round((canvasH - h) / 2), w, h };
}

/** The title screen. Any click or key advances it. */
export class TitleScreen {
  constructor(logo = null) {
    this.logo = logo;                  // { tex, width, height } or null
    this.done = false;
  }

  /** Nothing to show without art - the caller skips straight to the menu. */
  get drawable() { return !!this.logo; }

  draw(renderer, canvas) {
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0, 0, 0, 1]);
    if (!this.logo) return null;
    const rect = logoRect(canvas.width, canvas.height, this.logo.width, this.logo.height);
    // ALPHA-BLENDED, not the cutout every other screen quad takes. Our
    // logo is not classic art: its edges are anti-aliased and the dagger
    // casts a soft shadow, so the a<0.5 threshold would jag the gold and
    // cut the shadow to a silhouette. The opt-in exists for this one
    // caller; the classic law is untouched (renderer.js).
    renderer.drawScreenQuad(this.logo.tex, rect, undefined, undefined, { blend: true });
    return rect;
  }
}
