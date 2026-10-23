// THE DWARVEN PISTOLET'S STRIP - its laws, and nothing else: no imports, on purpose (PISTOLET, 2026-10-21).
//
// combat/gun/pistoletArt.js loads the strip for the game and src/tools/pistolLab.js cuts it for the lab, and both read
// these. A leaf, because the loader reaches the texture pipeline and the weapon tables, and the lab's standalone build
// (vite.config.pistol.js) has no use for either - combat/weapon/weaponAlign.js's reason, for the Thunderlock's lab.

/** The strip: six frames, each its own registered canvas, in the order the owner gave them. */
export const PISTOL_STRIP = Object.freeze({ frames: 6, cellW: 88, cellH: 113, file: 'pistol-frames.png' });

/** Cell `i` of the strip, an integer source rect (a half pixel resamples). */
export function stripCellRect(i, strip = PISTOL_STRIP) {
  return { x: i * strip.cellW, y: 0, w: strip.cellW, h: strip.cellH };
}

/** THE 1-BIT CUT: alpha to 0 or 255 at `cut` (128 is drawScreenQuad's 0.5). Mutates `img.data`; answers how many soft
 *  texels it cleared. */
export function hardenAlpha(img, cut = 128) {
  const { data } = img;
  let cleared = 0;
  for (let p = 3; p < data.length; p += 4) {
    if (data[p] >= cut) data[p] = 255;
    else { if (data[p]) cleared++; data[p] = 0; }
  }
  return cleared;
}

