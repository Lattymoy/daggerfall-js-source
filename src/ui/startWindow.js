// U21: THE MAIN MENU - DaggerfallStartWindow.cs, verbatim.
//
// The port had no menu at all: the bare URL called bootDungeon and
// dropped you straight into Privateer's Hold with the chargen wizard
// drawing over U14's black parent panel. That backdrop was correct for
// chargen and was never the front door.
//
// DFU's window is small and exact (DaggerfallStartWindow.cs:23-65):
//   background  PICK03I0.IMG            (:23, :41-47)
//   Load Game   (72, 45)  size (147,15) (:50)
//   New Game    (72, 99)  size (147,15) (:55)
//   Exit        (125,145) size (41,15)  (:60)
// The labels are painted INTO the art - DFU's AddButton lays invisible
// click rects over them, which is why the geometry has to be right to
// the pixel or the words and the hit boxes drift apart.
//
// PICK03I0 is one of the six PALETTIZED IMGs: its 768 palette bytes
// follow the image and ImgFile._readPalette writes INTO the palette it
// is handed, so it gets its OWN DFPalette and never the shared ART_PAL
// (the U18/AUDIT 17k law - a shared palette here would repaint every
// other screen).
//
// NOT ported, deliberately: DFU's rebindable Hotkey/OnKeyboardEvent
// arms on all three buttons (DaggerfallShortcut.Buttons.MainMenu*).
// Those are a DFU enhancement over classic, the bindings live in a
// StreamingAssets table rather than in code, and this port has no
// keybinding registry to hang them on - recorded in the Ledger rather
// than invented, the same stance U20a took on ResetBonusPool.

import { DFPalette } from '../formats/dfPalette.js';
import { loadImg, nativeMetrics, drawImg, pointToNative } from './nativePanel.js';

export const START_IMG = 'PICK03I0.IMG';

/** DaggerfallStartWindow's three buttons, verbatim [x, y, w, h]. */
export const START_BUTTONS = Object.freeze({
  load: Object.freeze([72, 45, 147, 15]),
  newGame: Object.freeze([72, 99, 147, 15]),
  exit: Object.freeze([125, 145, 41, 15]),
});

const inRect = ([x, y, w, h], vx, vy) => vx >= x && vy >= y && vx < x + w && vy < y + h;

/** Load PICK03I0 on its own palette. Throws like every other native
 *  window's art load - the caller keeps the fallback. */
export async function loadStartArt({ renderer, fetchBytes }) {
  return loadImg({ renderer, fetchBytes, palette: new DFPalette() }, START_IMG);
}

/**
 * The main menu. `click` returns the action a press resolves to, or
 * null when the press missed every button - the caller must still
 * treat a null as CONSUMED, so a stray click on the menu can never
 * fall through to a scene's pointer-lock request.
 */
export class StartWindow {
  constructor(art = null) {
    this.art = art;
    this.action = null;          // 'newGame' | 'load' | 'exit'
  }

  /** Screen pixel -> the button under it, or null. */
  hit(canvas, px, py) {
    const nv = pointToNative(nativeMetrics(canvas), px, py);
    if (!nv) return null;
    return this.hitNative(nv[0], nv[1]);
  }

  hitNative(vx, vy) {
    for (const [name, rect] of Object.entries(START_BUTTONS)) {
      if (inRect(rect, vx, vy)) return name;
    }
    return null;
  }

  /** Returns the action, or null. Either way the click is consumed. */
  click(canvas, px, py) {
    const name = this.hit(canvas, px, py);
    if (name) this.action = name;
    return name;
  }

  draw(renderer, canvas) {
    const m = nativeMetrics(canvas);
    // The letterbox is BLACK. The renderer clears to the pale Iliac Bay
    // sky, which is right behind a world and wrong behind a menu - the
    // bars read as a blue border around the scroll. DFU has nothing
    // there at all, so fill the whole canvas before the panel goes down
    // rather than changing the renderer's default out from under every
    // scene that wants the sky.
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0, 0, 0, 1]);
    if (this.art) drawImg(renderer, this.art, m, 0, 0);
    return m;
  }
}
