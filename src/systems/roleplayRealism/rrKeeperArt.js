// THE WEEK BUTTON, OUR OWN, painted by our painter (art/ownPainter.js). The keepers are our rule over the
// player's own people (rrKeepers.js).
import { createPainter, RAMP, rect, textWidth, NARROW } from '../../art/ownPainter.js';

/** The training window's week button (BUTTONS.RCI record 21, RR_WEEK_BUTTON): carved stone at a classic button's 32 x 16,
 *  "5 DAYS" raised in our narrow letters. */
export function rrWeekButtonPicture() {
  const painter = createPainter(32, 16);
  painter.fill(rect(0, 0, 32, 16), RAMP.stone.slice(2, 6), { seed: 21, rough: 0.6 });
  for (let x = 0; x < 32; x++) { painter.set(x, 0, RAMP.stone[6]); painter.set(x, 15, RAMP.stone[0]); }
  for (let y = 0; y < 16; y++) { painter.set(0, y, RAMP.stone[6]); painter.set(31, y, RAMP.stone[0]); }
  const label = '5 DAYS';
  painter.text(label, Math.floor((32 - textWidth(label, NARROW)) / 2), 4, RAMP.stone[6], { shadow: RAMP.stone[0], font: NARROW });
  return painter.picture();
}
