// Spellbook and death (UI arc, U4; the inventory left at U26). Two
// overlay-seam windows in classic text (backgrounds FLAGGED pending
// art-name verification, as U2/U3):
//   (The keyed INVENTORY window that lived here is DELETED at U26.
//   It was the dungeon host's until that slice swapped in the classic
//   ui/nativeInventory.js window, after which nothing imported it.
//   Its one law - EquipItem excludes exactly Weapons/Arrow and hands
//   everything else to the equip table - was never the window's: it
//   lives in systems/equip.js, where every host now reaches it.)
//   Spellbook (DFU default Backspace): the player's KNOWN spells;
//   Enter readies one (retires ?spell). INTERIM loud: with no
//   starting-spells data yet, an empty book lists the file's ranged
//   damage spells as known - the classic starting-spell sets replace
//   this when their data lands. Management (M4): d deletes (YesNo
//   confirm; the curse-spell tags refuse first), u/j swap the
//   selection up/down, s sorts (confirm; alpha, then point cost when
//   already alphabetical) - DaggerfallSpellBookWindow's delete/swap/
//   sort buttons keyed. All ops mutate entity.spells IN PLACE, so the
//   save envelope's index array (save.js:79) carries the new order.
//   Rename is a ledger row: entity.spells hold SHARED SPELLS.STD
//   records and the envelope stores bare indexes, so a rename needs
//   per-entity copies + name persistence first. DFU's edit sound
//   (SoundClips.PageTurn) and open sound (OpenBook) play through the
//   audio singleton (the videoPlayer import pattern).
//   Death (D1): health 0 opens it through the ONE hurtPlayer door and
//   it drives PlayerDeath's whole sequence - the camera sinks a
//   quarter-capsule below the feet, the HUD fades black over two
//   seconds, the classic death sound plays, and three seconds in the
//   host runs ANIM0012.VID and returns to the title menu (DFU's
//   TitleMenuFromDeath). ENTER skips to that end; the F11 hint is the
//   real quickload binding (InputManager.SetupDefaults: F9/F11).

import { drawText, measureText } from './text.js';
import { itemWeight, totalWeight } from '../systems/inventory.js';
import { isDamageHealthEffect } from '../systems/spellcast.js';
import { PlayerDeathSequence, DEATH_TIME_BEFORE_RESET } from '../systems/playerDeath.js';   // D1
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

const panel = (renderer, canvas) =>
  renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.04, 0.03, 0.02, 0.92]);
const GOLD = [0.85, 0.72, 0.35, 1], WHITE = [0.9, 0.9, 0.85, 1], HOT = [1, 0.95, 0.6, 1], DIM = [0.5, 0.5, 0.45, 1];
const ARROW_TEMPLATE_INDEX = 131;   // Weapons.Arrow (DaggerfallInventoryWindow.EquipItem's one exclusion)

// PlayerEntity.cs:41-42 - the curse-spell tags the book refuses to
// delete ("no way to get them back"; curing the curse cleans them
// up). INERT until vampirism/lycanthropy land - no producer mints a
// tagged spell yet - but the gate is DeleteButton_OnMouseClick's law.
export const VAMPIRE_SPELL_TAG = 'vampire';
export const LYCANTHROPY_SPELL_TAG = 'lycanthrope';
// TextManager keys (comments) with our prose: the classic en string
// table is not in the source snapshot, so the VALUES are FLAGGED
// pending a string source; the keys and the gate order are the law.
export const CANNOT_DELETE_VAMP_TEXT = 'You cannot delete vampiric powers.';       // cannotDeleteVamp
export const CANNOT_DELETE_WERE_TEXT = 'You cannot delete lycanthropic powers.';   // cannotDeleteWere
export const DELETE_SPELL_PROMPT = 'Delete this spell?';                           // deleteSpell
export const SORT_SPELLS_PROMPT = 'Sort your spellbook?';                          // sortSpells

export class SpellbookWindow {
  /** spells: [{ index, name, cost, ... }]; ready(spell) from the scene. */
  constructor(spells, entity, { ready = null, castCost = null } = {}) {
    this.spells = spells;
    this.entity = entity;
    this.ready = ready;
    this.castCost = castCost;   // S10: live skill-scaled cost
    this.cursor = 0;
    this.done = false;
    this.confirm = null;   // 'delete' | 'sort' - the DaggerfallMessageBox YesNo, keyed
    this.notice = null;    // the curse-tag refusal line
    audio.playOneShot(SOUND.OpenBook, 1);   // OnPush (:173) - the U26 "no audio seam" ledger row retires
  }
  input(action) {
    const ch = typeof action === 'string' && action.startsWith('char:') ? action.slice(5).toLowerCase() : null;
    if (this.confirm) {
      // The YesNo box swallows everything except its own answers; No
      // and Escape close the BOX, not the book (DFU's CloseWindow()
      // in the confirm handlers pops the box off the stack).
      if (ch === 'y') {
        const which = this.confirm;
        this.confirm = null;
        if (which === 'delete') this.deleteSelected();
        else this.sortSpells();
      } else if (ch === 'n' || action === 'back') this.confirm = null;
      return;
    }
    this.notice = null;
    if (action === 'up' && this.spells.length) this.cursor = (this.cursor + this.spells.length - 1) % this.spells.length;
    else if (action === 'down' && this.spells.length) this.cursor = (this.cursor + 1) % this.spells.length;
    else if (action === 'confirm') {
      const sp = this.spells[this.cursor];
      if (sp && this.ready) { this.ready(sp); this.done = true; }
    } else if (ch === 'd' && this.spells[this.cursor]) {
      audio.playOneShot(SOUND.PageTurn, 1);   // DeleteButton (:848)
      // DeleteButton_OnMouseClick:811-838 - the curse tags refuse
      // BEFORE the prompt; otherwise arm the YesNo.
      const tag = this.spells[this.cursor].tag;
      if (tag === VAMPIRE_SPELL_TAG) this.notice = CANNOT_DELETE_VAMP_TEXT;
      else if (tag === LYCANTHROPY_SPELL_TAG) this.notice = CANNOT_DELETE_WERE_TEXT;
      else this.confirm = 'delete';
    } else if (ch === 's' && this.spells.length) { audio.playOneShot(SOUND.PageTurn, 1); this.confirm = 'sort'; }   // SortButton_OnMouseClick:900-905
    else if (ch === 'u') { audio.playOneShot(SOUND.PageTurn, 1); this.swap(-1); }   // the swap buttons page (:885-895)
    else if (ch === 'j') { audio.playOneShot(SOUND.PageTurn, 1); this.swap(+1); }
    else if (action === 'back' || action === 'spellbook') { audio.playOneShot(SOUND.PageTurn, 1); this.done = true; }   // OnPop (:181)
  }
  /** DeleteSpellConfirm_OnButtonClick:840-852 + DaggerfallEntity.
   *  DeleteSpell (:767-773): RemoveAt, then the selection clamps
   *  (UpdateSelection). The book stays open. */
  deleteSelected() {
    this.spells.splice(this.cursor, 1);
    if (this.cursor >= this.spells.length) this.cursor = Math.max(0, this.spells.length - 1);
  }
  /** SwapButton_OnMouseClick:872-897 + SwapSpells (:725-732): both
   *  ends bounds-guarded, and the CURSOR FOLLOWS the moved spell
   *  (SelectNext/SelectPrevious after the swap). */
  swap(d) {
    const i = this.cursor, j = i + d;
    if (j < 0 || j >= this.spells.length) return;
    const t = this.spells[i]; this.spells[i] = this.spells[j]; this.spells[j] = t;
    this.cursor = j;
  }
  /** SortSpellsConfirm_OnButtonClick:907-925: alpha first
   *  (SortSpellsAlpha - OrderBy Name, a stable sort, as
   *  Array.prototype.sort is since ES2019); if the sequence did not
   *  change, point cost (SortSpellsPointCost). DFU's cost key runs
   *  CalculateTotalEffectCosts with a NULL caster, which
   *  FormulaHelper resolves to the PLAYER's live skills - for the
   *  player's own book that is exactly the window's castCost hook. */
  sortSpells() {
    const before = this.spells.slice();
    this.spells.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    if (this.spells.every((sp, i) => sp === before[i])) {
      const cost = new Map(this.spells.map((sp) => [sp, this.castCost ? this.castCost(sp) : (sp.cost ?? 0)]));
      this.spells.sort((a, b) => cost.get(a) - cost.get(b));
    }
  }
  draw(renderer, canvas, font, s) {
    panel(renderer, canvas);
    const t = `SPELLBOOK  MP ${this.entity.magicka}/${this.entity.maxMagicka}`;
    drawText(renderer, font, t, (canvas.width - measureText(font.fnt, t) * s) / 2, 16 * s, s, GOLD);
    if (!this.spells.length) drawText(renderer, font, '(no spells known)', 30 * s, 40 * s, s, DIM);
    this.spells.forEach((sp, i) => drawText(renderer, font,
      `${i === this.cursor ? '> ' : '  '}${sp.name}  (${this.castCost ? this.castCost(sp) : sp.cost})`,
      20 * s, (36 + i * 10) * s, s, i === this.cursor ? HOT : WHITE));
    if (this.confirm) {
      const q = `${this.confirm === 'delete' ? DELETE_SPELL_PROMPT : SORT_SPELLS_PROMPT}  (y/n)`;
      drawText(renderer, font, q, (canvas.width - measureText(font.fnt, q) * s) / 2, canvas.height / 2, s, HOT);
    } else if (this.notice) {
      drawText(renderer, font, this.notice, 20 * s, canvas.height - 32 * s, s, HOT);
    }
    drawText(renderer, font, 'ENTER ready   u/j move   d delete   s sort   ESC close', 20 * s, canvas.height - 20 * s, s, DIM);
  }
}

/** The known list: entity.spells when it exists; the INTERIM fallback
 *  is the file's ranged damage spells (loud - starting-spell data
 *  replaces it). */
export function knownSpells(entity, spellsByIndex) {
  if (entity.spells?.length) return entity.spells;
  if (!spellsByIndex) return [];
  const out = [];
  for (const sp of spellsByIndex.values()) {
    if ((sp.rangeType === 2 || sp.rangeType === 4) && sp.effects.some(isDamageHealthEffect)) out.push(sp);
  }
  return out;
}

/** D1: the death screen DRIVES PlayerDeath's sequence - the camera
 *  sinks, the HUD fades to black over two seconds, the classic death
 *  sound plays once, and three seconds in the host's onReset runs
 *  (the death video, then the title menu: DFU's
 *  StartMethods.TitleMenuFromDeath). ENTER skips straight to that
 *  reset rather than reloading the same scene, which is where DFU's
 *  death lands you; F11 still quickloads, the port's own affordance
 *  and the reason the hint is drawn. `drop` is read by each host's
 *  frame to sink its camera - one player, one death, one law. */
export class DeathScreen {
  constructor({ eyeHeight, capsuleHeight, onReset = null } = {}) {
    this.done = false;
    this.sequence = new PlayerDeathSequence({
      eyeHeight, capsuleHeight, onReset,
      playSound: (clip) => audio.playOneShot(clip, 1),
    });
  }
  get drop() { return this.sequence.drop; }
  tick(dt) { this.sequence.tick(dt); }
  input(action) {
    // ENTER ends the run now; the sequence's own reset is the timer.
    if (action === 'confirm') this.sequence.tick(DEATH_TIME_BEFORE_RESET + 1);
  }
  draw(renderer, canvas, font, s) {
    // FadeHUDToBlack over the death: the world dims to black behind
    // the text rather than sitting under a fixed red wash.
    const fade = this.sequence.fade;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.05, 0.01, 0.01, 0.35 + 0.6 * fade]);
    const t = 'YOU HAVE DIED';
    drawText(renderer, font, t, (canvas.width - measureText(font.fnt, t) * s) / 2, canvas.height / 2 - 10 * s, s, [0.9, 0.2, 0.15, 1]);
    drawText(renderer, font, 'ENTER end   F11 load', (canvas.width - measureText(font.fnt, 'ENTER end   F11 load') * s) / 2, canvas.height / 2 + 6 * s, s, DIM);
  }
}
