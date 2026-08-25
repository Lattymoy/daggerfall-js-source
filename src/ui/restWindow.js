// The rest window (U7). The classic rest flow in the U-arc's clean
// text-panel idiom (backgrounds FLAGGED pending art-name
// verification, the shared UI note): a selection page (rest for a
// while / rest until healed / loiter), an hours prompt for the timed
// modes, and the running page showing hours passed + live vitals
// while the RestSession (systems/restSession.js) drives the clock.
// The world keeps running under the overlay - foes approach and can
// break the rest, exactly the DFU shape. Escape (or the rest key
// re-routed as 'back') ends a running rest with its finish text;
// the end page is click/key-to-close.

import { drawText, measureText } from './text.js';
import {
  RestSession, REST_PROMPT, LOITER_PROMPT, loiterLimitHours, cannotLoiterLines,
  canRest, illegalRestWarning, ILLEGAL_REST_WARNING, CITY_CAMPING_ILLEGAL_ID,
} from '../systems/restSession.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

const PANEL = [0.05, 0.05, 0.09, 0.92];
const TEXT = [0.86, 0.82, 0.68, 1];
const DIM = [0.55, 0.52, 0.45, 1];

export class RestWindow {
  /** deps: the RestSession deps + endLines(textId) -> string[] (the
   *  scene's TEXT.RSC lookup for the finish message).
   *
   *  S40 adds the LODGING deps, all optional so the dungeon host -
   *  where CanRest's third arm is the only reachable one - keeps
   *  passing what it always passed:
   *    restPlace()          the canRest() argument bag for HERE
   *    commitCrime(c, sg)   PlayerEntity.CrimeCommitted + SpawnCityGuards
   *    moveToBed(marker)    PlayerMotor.transform.position = allocatedBed
   *    onRentExpired()      RemoveExpiredRentedRooms, which DFU calls
   *                         as it prints the expired line (:485)
   *    ignoreAllocatedBed   the ctor flag (:115-118); true suppresses
   *                         the move. DFU's own call site passes FALSE
   *                         (DaggerfallUI.cs:686 is the only
   *                         construction in the tree), so this is a
   *                         mod hook with no core caller - carried
   *                         because the ctor has it, not because
   *                         anything here uses it
   */
  constructor(deps, ignoreAllocatedBed = false) {
    this.deps = deps;
    // selection | confirm | hours | resting | ended | refused
    this.state = 'selection';
    this.mode = null;
    this.value = '';
    this.session = null;
    this.endLines = null;
    this.notice = null;         // the cannot-loiter refusal lines
    this.refusalLines = null;   // CanRest's own message box
    this.done = false;
    this.isRestWindow = true;   // the scene's tick tag
    this.ignoreAllocatedBed = ignoreAllocatedBed;
    this._pending = null;       // the button waiting behind the confirm
    this._allocatedBed = null;  // CanRest's out-parameters, both of
    this._remainingHoursRented = -1;   // them, carried to the session
  }

  /** CanRest(alreadyWarned) (:542-599) with DFU's side effects
   *  attached: the crime lands on BOTH the refused and the confirmed
   *  path, and the refusal closes the window under its message box.
   *  Answers true when the caller may proceed. */
  _canRest(alreadyWarned) {
    const place = this.deps.restPlace?.();
    // No place seam at all (the dungeon host): CanRest's `return true`
    // tail. canRest()'s own defaults answer the same thing, but going
    // through it would ask the host for deps it never had.
    if (!place) { this._allocatedBed = null; this._remainingHoursRented = -1; return true; }
    const d = canRest({ ...place, alreadyWarned });
    this._allocatedBed = d.allocatedBed ?? null;
    // CheckRent counts this down every rested hour, so the rental has
    // to reach the session. Before S40 it was computed and dropped.
    // No `?? -1` here: canRest returns the field on every one of its
    // exits, so a fallback would be unreachable - and unreachable
    // code no pin can kill is a place for a wrong answer to hide.
    this._remainingHoursRented = d.remainingHoursRented;
    if (d.crime) this.deps.commitCrime?.(d.crime, d.spawnGuards);
    if (d.ok) return true;
    // CloseWindow() then MessageBox: the rest window is GONE and the
    // text stands alone. Here the window becomes the text and then
    // goes - and crucially NOT through the 'ended' state, which is
    // the RaiseSkills moment (:729-732). A refusal raises nothing.
    this.refusalLines = (d.text ? [d.text] : this.deps.endLines?.(d.textId ?? CITY_CAMPING_ILLEGAL_ID)) ?? null;
    if (!this.refusalLines) { this.done = true; return false; }
    this.state = 'refused';
    return false;
  }

  /** MoveToBed (:601-609). Vector3.zero is DFU's "no bed"; null is
   *  ours, and `ignoreAllocatedBed` suppresses the move either way. */
  _moveToBed() {
    if (this._allocatedBed && !this.ignoreAllocatedBed) this.deps.moveToBed?.(this._allocatedBed);
  }

  /** WhileButton / HealedButton (:641-690). The IllegalRestWarning
   *  box comes FIRST and does not touch CanRest; its Yes arm is what
   *  supplies `alreadyWarned`. LoiterButton (:693-706) is deliberately
   *  absent from this path - loitering in town is never gated and
   *  never moves the player to a bed. */
  _restButton(which, alreadyWarned) {
    if (!alreadyWarned && illegalRestWarning() && this.deps.restPlace?.()?.inTownStrict) {
      // VERBATIM, and a quirk: WhileButton plays ButtonClick a SECOND
      // time before raising the box (:644 then :647). HealedButton
      // takes the same branch and plays it once (:670). Nobody would
      // write that on purpose, so it is preserved rather than tidied.
      if (which === 'while') audio.playOneShot(SOUND.ButtonClick, 1);
      this._pending = which;
      this.state = 'confirm';
      return;
    }
    if (!this._canRest(alreadyWarned)) return;
    if (which === 'while') {
      this.state = 'hours'; this.mode = 'timed'; this.value = ''; this.notice = null;
    } else {
      this._start('full', 0);
      this._moveToBed();
    }
  }

  input(action) {
    if (this.state === 'refused') { this.done = true; return; }
    if (this.state === 'confirm') {
      // ConfirmIllegalRest*_OnButtonClick (:659-666, :685-692): the box
      // closes either way, and only Yes carries on - No leaves the
      // rest window standing on its selection page.
      if (action === 'char:y' || action === 'char:Y' || action === 'confirm') { const w = this._pending; this._pending = null; this._restButton(w, true); }
      else if (action === 'char:n' || action === 'char:N' || action === 'back') { this._pending = null; this.state = 'selection'; }
      return;
    }
    if (this.state === 'ended') {
      this.done = true;
      // AUDIT 23 (entity-1) - DaggerfallRestWindow.cs:729-732: closing
      // the finished popup is THE advancement moment (RaiseSkills).
      this.deps.onRestFinished?.();
      return;
    }
    if (this.state === 'resting') {
      // StopRestButton (:713-718) clicks like the rest (:644-718)
      if (action === 'back') { audio.playOneShot(SOUND.ButtonClick, 1); this._end(this.session.endEarly()); }
      return;
    }
    if (this.state === 'selection') {
      if (action === 'back') { audio.playOneShot(SOUND.ButtonClick, 1); this.done = true; return; }
      // the while/healed/loiter buttons all assign ButtonClick (:644-718)
      if (action === 'char:1' || action === 'char:r') { audio.playOneShot(SOUND.ButtonClick, 1); this._restButton('while', false); }
      else if (action === 'char:2' || action === 'char:h') { audio.playOneShot(SOUND.ButtonClick, 1); this._restButton('healed', false); }
      else if (action === 'char:3' || action === 'char:l') { audio.playOneShot(SOUND.ButtonClick, 1); this.state = 'hours'; this.mode = 'loiter'; this.value = ''; this.notice = null; }
      return;
    }
    // hours entry: digits, backspace, confirm
    if (action === 'back') { this.state = 'selection'; this.notice = null; return; }
    if (action === 'backspace') { this.value = this.value.slice(0, -1); return; }
    if (action === 'confirm') {
      // DFU's prompt: an unparseable (empty) entry does nothing; 0 IS
      // accepted - and the session ENDS IMMEDIATELY, passing no world
      // time (restSession's hoursRemaining < 1 pre-check; AUDIT 23
      // corrected the old 'rests one full hour' claim, the same
      // backwards reading AUDIT 18 struck from Ledger B). The 2-digit
      // entry field enforces the 99-hour cap by construction (DFU
      // shows TEXT 26 past 99).
      if (this.value === '') return;
      const hours = Number(this.value);
      if (this.mode === 'loiter' && hours > loiterLimitHours()) { this.notice = cannotLoiterLines(); this.value = ''; return; }
      this._start(this.mode, hours);
      // TimedRestPrompt_OnGotUserInput (:762) ends on MoveToBed; the
      // loiter prompt (:789) sets IsLoitering and does NOT move.
      if (this.mode === 'timed') this._moveToBed();
      return;
    }
    const m = /^char:(\d)$/.exec(action);
    if (m && this.value.length < 2) this.value += m[1];
  }

  _start(mode, hours) {
    this.mode = mode;
    this.session = new RestSession(mode, hours, this.deps, this._remainingHoursRented);
    this.state = 'resting';
  }

  _end(result) {
    // EndRest's FIRST arm (:480-486): the expired-room line outranks
    // "You wake up." and "You are healed." both. It carries a STRING
    // rather than a record id (Internal_Strings :358 has it, TEXT.RSC
    // does not), and DFU calls RemoveExpiredRentedRooms right there -
    // the landlord clears the room as the player wakes.
    if (result.rentExpired) this.deps.onRentExpired?.();
    this.endLines = result.died ? null
      : (result.text ? [result.text] : (this.deps.endLines?.(result.textId) ?? null));
    if (result.died || !this.endLines) { this.done = true; return; }   // death: the death screen owns the flow
    this.state = 'ended';
  }

  /** DaggerfallRestWindow.Update (:183-227), which runs every frame the
   *  window is topmost and reads Time.realtimeSinceStartup - so
   *  PauseWhileOpen's timeScale = 0 does not stop it.
   *
   *  S40: this is named `tick` because that is the seam ALL FOUR hosts
   *  already drive (townTalk.frame:572, worldModes:2502,
   *  dungeonContext.tickOverlay). It was `tickRest`, which exactly one
   *  host knew to call - so the moment rest reached the other three
   *  their rest windows would have sat on "Hours passed: 0" until
   *  Escape, which is the same defect AUDIT D-C1 and the dungeon's own
   *  tickOverlay comment each record for a different clock. `tickRest`
   *  stays as the old name for callers that still use it; it must not
   *  be called IN ADDITION to tick, or the rest runs at double speed. */
  tick(dt) {
    if (this.state !== 'resting') return;
    const r = this.session.tick(dt);
    if (r) this._end(r);
  }

  tickRest(dt) { this.tick(dt); }

  draw(renderer, canvas, font, s) {
    let lines;
    if (this.state === 'selection') {
      lines = ['How would you like to rest?', '', '1. Rest for a while', '2. Rest until healed', '3. Loiter', '', 'Esc - never mind'];
    } else if (this.state === 'confirm') {
      lines = [ILLEGAL_REST_WARNING, '', 'Y - yes', 'N - no'];
    } else if (this.state === 'hours') {
      lines = [(this.mode === 'loiter' ? LOITER_PROMPT : REST_PROMPT) + this.value + '_'];
      if (this.notice) lines = [...this.notice, '', ...lines];
    } else if (this.state === 'resting') {
      const v = this.deps.vitals?.() ?? null;
      lines = [this.mode === 'loiter' ? 'Loitering...' : 'Resting...', `Hours passed: ${this.session.totalHours}`];
      if (v) lines.push(`Health ${v.health}/${v.maxHealth}  Fatigue ${v.fatigue}  Magicka ${v.magicka}`);
      lines.push('', 'Esc - stop');
    } else if (this.state === 'refused') {
      lines = this.refusalLines ?? [''];
    } else {
      lines = this.endLines ?? [''];
    }
    const w = Math.max(...lines.map((l) => measureText(font.fnt, l))) * s + 24 * s;
    const lineH = 12 * s;
    const h = lines.length * lineH + 20 * s;
    const x = (canvas.width - w) / 2, y = (canvas.height - h) / 2;
    renderer.drawScreenQuad(null, { x, y, w, h }, undefined, PANEL);
    let ty = y + 12 * s;
    for (const l of lines) {
      drawText(renderer, font, l, x + 12 * s, ty, s, l.startsWith('Esc') ? DIM : TEXT);
      ty += lineH;
    }
  }
}
