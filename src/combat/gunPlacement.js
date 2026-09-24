// FIELD-GUN12: THE PLACEMENT, MOVED OUT OF THE LAB.
//
// `placeSprite` was the lab's, and the game had its own copy of the
// same arithmetic inside drawFpsWeapon. Five rounds of "it still
// isn't 1:1" were spent making those two agree about the size, the
// raise and the units of an offset. They agree now because there is
// one of them, and this is it - the lab's, unchanged, in a leaf both
// sides can read.

import { ALIGN } from './weaponAlign.js';

/**
 * FPSWeapon's OnGUI rect (:378-388), with the width taken as a
 * fraction of the screen instead of from a CIF record's native size -
 * the declared departure. Everything else is the classic law: bottom
 * anchored, aligned by the table's Alignment/Offset, and AlignRight
 * becoming AlignLeft under the handedness mirror (:459-464).
 * AUDIT 68 S08: no `kick` here - the recoil lands after the widget
 * transform, in gunViewmodel.gunFrameRect, the one frame both sides draw.
 */
export function placeSprite({
  canvasW, canvasH, frameW, frameH,
  widthPct = 0.62, align = ALIGN.Center, offset = 0,
  flip = false, offsetHeight = 0,
}) {
  const w = canvasW * widthPct;
  const h = w * (frameH / frameW);
  const a = (flip && align === ALIGN.Right) ? ALIGN.Left : align;
  let x;
  if (a === ALIGN.Left) x = canvasW * offset;
  else if (a === ALIGN.Center) x = canvasW / 2 - w / 2;
  else x = canvasW * (1 - offset) - w;
  const y = canvasH - h - offsetHeight;
  return { x, y, w, h };
}
