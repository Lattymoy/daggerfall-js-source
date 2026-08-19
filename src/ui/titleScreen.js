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
// WOULD ship with the build, out of public/ where vite serves it at the
// root. AUDIT 19: it is not in the repo yet, so today this arm never runs
// and the fallback below is what every boot actually draws. Stated rather
// than implied - "ours ships with the build" was a claim about a file that
// is not there.
//
// TWO KINDS OF ART, and the fallback is not a placeholder. Ours is
// public/logo.png. When that file is absent the screen falls back to
// CLASSIC'S OWN TITLE, TITL00I0.IMG - the Daggerfall wordmark over the
// box art, which the port already reads byte-exact and which comes out
// of the user's ARENA2 at runtime, so it costs nothing to ship and
// there is nothing to install. Classic drew it here; drawing it here is
// the least surprising thing the port can do while our own art is
// missing.
//
// They are drawn DIFFERENTLY, because they are different kinds of
// image. TITL00I0 is 320x200 palettized game art: it goes on the native
// panel at integer scale through the 1-bit cutout, like every other
// classic screen. Our logo is high-resolution art with real partial
// alpha: it is fitted by logoRect and drawn blended and smoothed. Using
// either law on the other art looks wrong.
//
// NEVER TRAPS: if NEITHER is available the title screen does not draw at
// all and the boot goes straight to the menu - the same law the char
// sheet and chargen follow when their art fails to load. A missing
// asset costs you a splash, never a game.

import { DFPalette } from '../formats/dfPalette.js';
import { loadImg, drawImg, nativeMetrics } from './nativePanel.js';

/** Classic's own title art - the fallback when we have no logo of our
 *  own. One of the SIX palettized IMGs, so it gets its OWN DFPalette:
 *  ImgFile._readPalette writes INTO the palette handed to it, and the
 *  shared ART_PAL would repaint every other screen (the U18/17k law). */
export const TITLE_IMG = 'TITL00I0.IMG';

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
 * Resolve the title art: OURS first, classic's second, null last.
 * Neither arm throws - a title screen is never worth a failed boot.
 */
export async function loadTitleArt({ renderer, fetchBytes, uploadLogo, doc } = {}) {
  const pixels = await loadLogo(LOGO_URL, doc ?? globalThis.document);
  if (pixels && uploadLogo) {
    return { kind: 'logo', tex: uploadLogo(pixels), width: pixels.width, height: pixels.height };
  }
  if (!renderer || !fetchBytes) return null;
  try {
    // Its OWN palette, never the shared ART_PAL - TITL00I0 is palettized.
    const art = await loadImg({ renderer, fetchBytes, palette: new DFPalette() }, TITLE_IMG);
    return art ? { kind: 'native', art } : null;
  } catch (e) {
    console.warn('[title] TITL00I0.IMG unavailable - no title screen:', e?.message ?? e);
    return null;
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

/** The title screen. Any click or key advances it.
 *  Takes whatever loadTitleArt resolved: our logo, classic's title, or
 *  null - and draws each by its own law. */
export class TitleScreen {
  constructor(art = null) {
    this.art = art;                    // { kind:'logo'|'native', ... } or null
    this.done = false;
  }

  /** Nothing to show - the caller skips straight to the menu. */
  get drawable() { return !!this.art; }

  draw(renderer, canvas) {
    // Opaque black first: the renderer clears to the pale Iliac Bay sky,
    // which would frame either art in blue (the U21/U21b/U22 letterbox).
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0, 0, 0, 1]);
    if (!this.art) return null;

    if (this.art.kind === 'native') {
      // Classic game art: the native panel at integer scale, 1-bit
      // cutout, NEAREST - exactly as every other classic screen draws.
      const m = nativeMetrics(canvas);
      drawImg(renderer, this.art.art, m, 0, 0);
      return m;
    }

    const rect = logoRect(canvas.width, canvas.height, this.art.width, this.art.height);
    // ALPHA-BLENDED, not the cutout every other screen quad takes. Our
    // logo is not classic art: its edges are anti-aliased and the dagger
    // casts a soft shadow, so the a<0.5 threshold would jag the gold and
    // cut the shadow to a silhouette. The opt-in exists for this one
    // caller; the classic law is untouched (renderer.js).
    renderer.drawScreenQuad(this.art.tex, rect, undefined, undefined, { blend: true });
    return rect;
  }
}
