// OWN-WORK4 (2026-10-31; bible/06-Systems/Travel-Options.md): THE TRAVEL STRIP AND THE PORTS BUTTON, OUR OWN. The
// control strip (320 x 27) and the map's ports filter (45 x 11, off and on) are recipes for our painter
// (art/ownPainter.js): carved stone like Daggerfall's own windows, our letters, every recess and button where
// travelControlUI.js CONTROL_RECTS and travelMapOptions.js PORTS_SIZE place them. No pixel of the retired release is read.
import { createPainter, RAMP, rect, textWidth } from '../../art/ownPainter.js';

const TEXT = RAMP.gold[5];
const DIM = RAMP.stone[5];
const SHADOW = RAMP.black[0];

/** A bevelled box [x, x + width) x [y, y + height): raised (lit top and left) or sunken (lit bottom and right). */
function bevel(painter, x, y, width, height, { sunken = false, face = null } = {}) {
  const hi = RAMP.stone[sunken ? 1 : 6],
    lo = RAMP.stone[sunken ? 6 : 1];
  if (face) painter.fill(rect(x, y, x + width, y + height), face, { seed: x * 7 + y, rough: 0.35, flat: false });
  for (let i = 0; i < width; i++) {
    painter.set(x + i, y, hi);
    painter.set(x + i, y + height - 1, lo);
  }
  for (let j = 0; j < height; j++) {
    painter.set(x, y + j, hi);
    painter.set(x + width - 1, y + j, lo);
  }
}
/** Words centred in the box [x, x + width) at row y. */
const centred = (painter, words, x, width, y, colour) => painter.text(words, x + Math.floor((width - textWidth(words)) / 2), y, colour, { shadow: SHADOW });

/** The journey's strip: the destination's recess, the rate's recess after "TIME x", and the MAP, CAMP and EXIT buttons
 *  (TravelControlUI.cs's rects, travelControlUI.js CONTROL_RECTS). */
function controlStrip() {
  const painter = createPainter(320, 27);
  bevel(painter, 0, 0, 320, 27, { face: RAMP.stone.slice(2, 5) });
  bevel(painter, 1, 1, 318, 25);
  painter.text('DESTINATION', 6, 4, TEXT, { shadow: SHADOW });
  bevel(painter, 4, 13, 154, 9, { sunken: true, face: RAMP.stone.slice(0, 2) });
  painter.text('TIME x', 160 - textWidth('TIME x') - 2, 4, TEXT, { shadow: SHADOW });
  bevel(painter, 162, 3, 17, 22, { sunken: true, face: RAMP.stone.slice(0, 2) });
  for (const [label, x, w] of [['MAP', 183, 45], ['CAMP', 230, 45], ['EXIT', 279, 38]]) {
    bevel(painter, x, 3, w, 21, { face: RAMP.stone.slice(3, 6) });
    centred(painter, label, x, w, 10, TEXT);
  }
  return painter.picture();
}

/** The travel map's ports filter: raised and grey while off, pressed and lit while on. */
function portsButton(on) {
  const painter = createPainter(45, 11);
  bevel(painter, 0, 0, 45, 11, { sunken: on, face: on ? RAMP.stone.slice(1, 3) : RAMP.stone.slice(3, 5) });
  centred(painter, 'PORTS', 0, 45, 2, on ? TEXT : DIM);
  return painter.picture();
}

/** Each picture's recipe, by the name the windows ask for. */
export const TRAVEL_ART = Object.freeze({
  TOcontrolUI: controlStrip,
  TOportsOff: () => portsButton(false),
  TOportsOn: () => portsButton(true),
});
/** Our picture `name`, top-down RGBA - or null where it is none of the three. */
export const travelPicture = (name) => (Object.hasOwn(TRAVEL_ART, name) ? TRAVEL_ART[name]() : null);
