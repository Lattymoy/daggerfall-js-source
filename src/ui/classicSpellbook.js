// CM6 - THE SPELLBOOK RENAME INPUT MESSAGE BOX.
//
// DaggerfallSpellBookWindow does not edit the spell name inline. Clicking
// the name pushes a DaggerfallInputMessageBox seeded with the current
// name and labelled with the shared enterSpellName string. The audited
// base window already owns the rename law itself; this wrapper changes
// only the presentation/ownership of that input field at the classic
// runtime door.

import {
  SpellbookWindow as BaseSpellbookWindow, ENTER_SPELL_NAME,
} from './spellbookWindow.js';
import { InputMessageBoxWindow } from './inputMessageBox.js';
import { MAX_SPELL_NAME } from '../systems/spellMaker.js';

// Keep the runtime constructor name the hosts and probes already know,
// while leaving the audited base class as the one direct exported class
// declaration for audit24_onehome's population.
class SpellbookWindow extends BaseSpellbookWindow {
  constructor(deps = {}, options = {}) {
    super(deps, options);
    this.renameBox = null;
  }

  /** SpellNameLabel_OnMouseClick (:927-938): GetSpell, seed the input
   * box from bundle.Name, apply enterSpellName + " ", subscribe the
   * handler, then push it. Buy mode never exposes this button. */
  renameButton() {
    if (this.selectedIndex === -1 || !this.selected || this.buyMode) return;
    this.renameText = this.selected.name ?? '';
    this.top = 'rename';
    this.renameBox = new InputMessageBoxWindow({
      label: ENTER_SPELL_NAME,
      value: this.renameText,
      maxCharacters: MAX_SPELL_NAME,
      onSubmit: (input) => {
        this.renameText = input;
        // RenameSpellPromptHandler remains in the audited base: raw
        // non-empty text, copy the bundle, mark custom, refresh list.
        super.confirmRename();
      },
      onCancel: () => { this.top = null; },
    });
  }

  input(code, e = null) {
    if (this.renameBox) {
      this.renameBox.input(code, e);
      if (this.renameBox.done) this.renameBox = null;
      return;
    }
    super.input(code, e);
  }

  click(vx, vy, right = false, middle = false) {
    if (this.renameBox) {
      this.renameBox.click(vx, vy);
      return true;
    }
    return super.click(vx, vy, right, middle);
  }

  hover(vx, vy, e = null) {
    if (this.renameBox) return;
    super.hover(vx, vy, e);
  }

  wheel(dir, vx, vy) {
    if (this.renameBox) return;
    super.wheel(dir, vx, vy);
  }

  draw(renderer, canvas, font) {
    if (!this.renameBox) {
      super.draw(renderer, canvas, font);
      return;
    }
    // The base still carries its pre-CM6 inline rename renderer for
    // direct unit construction. At the runtime door, hide that layer
    // for this frame and let the real pushed input window own it.
    const top = this.top;
    this.top = null;
    super.draw(renderer, canvas, font);
    this.top = top;
    this.renameBox.draw(renderer, canvas, font);
  }
}

export { SpellbookWindow };
