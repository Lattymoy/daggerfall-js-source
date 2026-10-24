// @ts-check
// MENU-ORDER (2026-10-12, bible/10-UI/Menu-Order.md) - A PICTURE MADE WITH THE PANEL PASS.
//
// The owner: "I just feel like text lists are too much". A piece of furniture's tile (scenes/decor/decorTool.js) and a ship's
// card (scenes/shipPortraits.js) show the thing itself: drawn once, small, by the second camera the decorator's preview
// and the bank's already take (render/renderer.js panelFrame) into a box of the game canvas under the window's own
// card, and copied out of the canvas in the same frame, as the preview is (ui/screenshot.js reads it the same way). The
// player's own models and textures, made while the game runs and kept nowhere but the window that asked (Port-Doctrine,
// A RENDER OF GAME DATA IS GAME DATA: nothing of it is ever committed).

/** The ground a picture stands on - the decorator's preview's. */
export const PANEL_PICTURE_CLEAR = Object.freeze([0.055, 0.063, 0.075, 1]);
/** Its light - the preview's: a key from above and in front, an even ambient, no fog - and nothing of the world's (AUDIT
 *  MENU-ORDER R6: a picture is kept for the session, and one drawn by night beside a lantern stood red, or blue under
 *  the moon, for good): no lanterns, no moon, no third light, no light off the walls, no windows' glow, no cloud's
 *  shadow. The bracket gives every one of them back (renderer.js endPanelFrame). */
export const PANEL_PICTURE_LIGHT = Object.freeze([0, 0.707, -0.707]);
export const PANEL_PICTURE_AMBIENT = 0.8;
const NONE3 = new Float32Array(3);
const NO_POINTS = new Float32Array(0);

/**
 * A box of the game canvas, in its own pixels, `w` by `h` (no more than the element's box holds), centred under an
 * element's box on the page - or null when there is no room.
 * @param {{ width: number, height: number, getBoundingClientRect?: () => any } | null | undefined} canvas
 * @param {{ left: number, top: number, width: number, height: number } | null | undefined} box
 * @param {number} w @param {number} h
 */
export function canvasBoxUnder(canvas, box, w, h) {
  const c = canvas?.getBoundingClientRect?.();
  if (!canvas || !box || !c || !(c.width > 0) || !(c.height > 0)) return null;
  const sx = canvas.width / c.width;
  const sy = canvas.height / c.height;
  const k = Math.min(1, Math.floor(box.width * sx) / w, Math.floor(box.height * sy) / h);
  const pw = Math.floor(w * k), ph = Math.floor(h * k);
  if (!(pw >= 16) || !(ph >= 16)) return null;
  return { x: Math.round((box.left - c.left + box.width / 2) * sx - pw / 2), y: Math.round((box.top - c.top + box.height / 2) * sy - ph / 2), w: pw, h: ph };
}

/** The studio: the pass's own light and none of the world's (R6). Run inside the bracket's `setup`. */
export function panelPictureStudio(renderer) {
  renderer.setFog?.('off');
  renderer.setLighting?.(new Float32Array([PANEL_PICTURE_AMBIENT, PANEL_PICTURE_AMBIENT, PANEL_PICTURE_AMBIENT]), 0);
  renderer.setMoonlight?.(null);
  renderer.setThirdLight?.(null);
  renderer.setPointLights?.(NO_POINTS, null, null);
  renderer.setIndirectLight?.(NONE3, 0, NONE3);
  renderer.setWindowEmission?.(NONE3);
  renderer.setCloudShadow?.(null);
}

/**
 * Draw `body` with the panel pass into `rect` of the game canvas and copy it out: a promise of the picture's URL, or of
 * null. The copy is taken at once, in this frame, while the canvas still holds it; AUDIT MENU-ORDER R3: its encoding is
 * the browser's, later (`toBlob`, a blob's URL) - `toDataURL` waited on the GPU for the whole frame's work, a stall each
 * picture. A canvas with no `toBlob` (an old browser) is encoded at once.
 * @param {{ renderer: any, canvas: any, doc: any, rect: { x: number, y: number, w: number, h: number }, proj: Float32Array, view: Float32Array, body: () => void }} o
 * @returns {Promise<string|null>}
 */
export function panelPicture({ renderer, canvas, doc, rect, proj, view, body }) {
  renderer.panelFrame({ proj, view, lightDir: new Float32Array(PANEL_PICTURE_LIGHT), rect, clear: [...PANEL_PICTURE_CLEAR], setup: () => panelPictureStudio(renderer) }, body);
  const out = doc.createElement('canvas');
  out.width = rect.w;
  out.height = rect.h;
  try { out.getContext('2d')?.drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h); } catch { return Promise.resolve(null); }   // a lost context copies nothing
  return new Promise((resolve) => {
    try {
      if (typeof out.toBlob !== 'function') { resolve(out.toDataURL?.('image/png') ?? null); return; }
      const URLs = doc.defaultView?.URL ?? globalThis.URL;
      out.toBlob((blob) => { try { resolve(blob ? URLs?.createObjectURL?.(blob) ?? null : null); } catch { resolve(null); } }, 'image/png');
    } catch { resolve(null); }
  });
}
