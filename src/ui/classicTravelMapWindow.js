// CM8 - DaggerfallTravelMapWindow's Find button pushes a real
// DaggerfallInputMessageBox rather than letting the map own an inline
// field. The base window keeps the map law; this subclass owns only
// that residual modal surface.

import {
  TravelMapWindow as BaseTravelMapWindow,
  FIND_PROMPT, FIND_MAX_CHARACTERS,
} from './travelMapWindow.js';
import { InputMessageBoxWindow } from './inputMessageBox.js';

export class TravelMapWindow extends BaseTravelMapWindow {
  constructor(deps = {}) {
    super(deps);
    this.findBox = null;
  }

  /** DaggerfallTravelMapWindow.FindlocationButtonClickHandler. */
  _findLocationButtonClick() {
    if (!this.regionSelected) return;
    this._click();
    this.findBox = new InputMessageBoxWindow({
      label: FIND_PROMPT,
      value: '',
      maxCharacters: FIND_MAX_CHARACTERS,
      onSubmit: (text) => {
        this.findBox = null;
        this._handleLocationFindEvent(text);
      },
      onCancel: () => { this.findBox = null; },
    });
  }

  input(code, e = null) {
    if (this.findBox) {
      const box = this.findBox;
      box.input(code, e);
      if (box.done && this.findBox === box) this.findBox = null;
      return;
    }
    super.input(code, e);
  }

  click(vx, vy, right = false) {
    if (this.findBox) {
      this.findBox.click(vx, vy);
      return true;
    }
    return super.click(vx, vy, right);
  }

  hover(vx, vy, e = null) {
    if (this.findBox) return;
    super.hover(vx, vy, e);
  }

  wheel(dir) {
    if (this.findBox) return;
    super.wheel(dir);
  }

  tick(dt) {
    // A pushed modal freezes the map below it just as DFU's UI stack does.
    if (this.findBox) return;
    super.tick(dt);
  }

  draw(renderer, canvas, font) {
    const out = super.draw(renderer, canvas, font);
    this.findBox?.draw(renderer, canvas, font);
    return out;
  }
}
