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
   *    setResting(b)        PlayerEntity.IsResting - OnPush raises it
   *                         (:268), OnPop clears it (:284); its one
   *                         consumer is CastWhenHeld's degrade rate
   *    setLoitering(b)      PlayerEntity.IsLoitering - the loiter
   *                         prompt raises it (:789), OnPop clears it
   *                         (:285). No consumer in DFU's own tree
   *                         either; carried because the window writes
   *                         it and a later reader should find it right
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
    this._pendingEnemySpawn = false;   // a latch raised before a mode is picked
    // OnPush (:266-268): "Raise player resting flag when UI opens.
    // This is used for random enemy spawning and influences
    // CastWhenHeld durability loss" - DFU's own comment. The port HAS
    // that consumer (enchantments.js' HELD_DEGRADE_RATE_RESTING, 60
    // against 4) and nothing fed it, because rest lived in the one
    // host whose enchant ctx was FLAGGED unmounted. The flag is raised
    // on OPEN, not on the first rested hour: standing in the window
    // deciding already costs a held enchantment.
    this.deps.setResting?.(true);
  }

  /** OnPop (:271-285) clears both flags. Every exit from this window
   *  runs through here, and dispose() runs it again, because a flag
   *  raised on open and cleared on ONE of five exits is worse than no
   *  flag at all - it would leave the player permanently "resting"
   *  and burn held enchantments 15x for the rest of the session.
   *  Deliberately NOT guarded on `done`: clearing a boolean twice is
   *  the same as clearing it once, so the guard would be a branch no
   *  test could kill, and this file has already retired one of those. */
  _close() {
    this.done = true;
    this.deps.setResting?.(false);
    this.deps.setLoitering?.(false);
  }

  dispose() { this._close(); }

  // FLAGGED, all three from OnPop/Update and all three belonging to
  // other arcs rather than to rest:
  //
  //  - OnSleepEnd (:288-289): a sleep of MORE than six hours
  //    (sleepEventMinimumHours, :60) raises an event whose ONE
  //    consumer is EntityEffectManager.RerollItemEffects
  //    (:2170-2173), which drains `itemsPendingReroll` - the set
  //    DoMagicRound fills on each item's own hour clock. The port
  //    FUSED the queue and the drain: enchantments.js fires the
  //    RerollEffect payload inline in the magic round once an item is
  //    REROLL_MINIMUM_HOURS old, and S40's advanceMinutes runs the
  //    magic rounds THROUGH the sleep, so a rested night rerolls as it
  //    passes rather than in one flush at the end. Same items, same
  //    clock, a different moment - written down, not left silent.
  //  - UpdateNpcPresence (:277-280): leaving the rest window inside a
  //    building re-rolls which static NPCs are home. The port has no
  //    NPC-presence pass at all; that is the interior/talk arc's.
  //  - RaiseOnSleepTickEvent (:206-208) has no consumer in DFU's own
  //    tree - it is a mod hook.

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
    if (!this.refusalLines) { this._close(); return false; }
    this.state = 'refused';
    return false;
  }

  /** MoveToBed (:601-609). Vector3.zero is DFU's "no bed"; null is
   *  ours, and `ignoreAllocatedBed` suppresses the move either way. */
  _moveToBed() {
    if (this._allocatedBed && !this.ignoreAllocatedBed) this.deps.moveToBed?.(this._allocatedBed);
  }

  /** WhileButton (:642-657) / HealedButton (:668-682). The IllegalRestWarning
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
    if (this.state === 'refused') { this._close(); return; }
    if (this.state === 'confirm') {
      // ConfirmIllegalRest*_OnButtonClick (:659-666, :684-691): the box
      // closes either way, and only Yes carries on - No leaves the
      // rest window standing on its selection page.
      if (action === 'char:y' || action === 'char:Y' || action === 'confirm') { const w = this._pending; this._pending = null; this._restButton(w, true); }
      else if (action === 'char:n' || action === 'char:N' || action === 'back') { this._pending = null; this.state = 'selection'; }
      return;
    }
    if (this.state === 'ended') {
      this._close();
      // AUDIT 23 (entity-1) - DaggerfallRestWindow.cs:729-732: closing
      // the finished popup is THE advancement moment (RaiseSkills).
      this.deps.onRestFinished?.();
      return;
    }
    if (this.state === 'resting') {
      // StopButton_OnMouseClick (:708-712) - EndRest, then the same
      // ButtonClick every other button plays. (Its keyboard twin,
      // :714-726, defers the close to KeyUp; the port's overlay seam
      // has no key-down/key-up split, so that half is structural.)
      if (action === 'back') { audio.playOneShot(SOUND.ButtonClick, 1); this._end(this.session.endEarly()); }
      return;
    }
    if (this.state === 'selection') {
      if (action === 'back') { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return; }
      // every button assigns ButtonClick: While :644, Healed :670,
      // Loiter :695, Stop :711
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
      // loiter prompt sets IsLoitering (:789) and does NOT move.
      if (this.mode === 'timed') this._moveToBed();
      else if (this.mode === 'loiter') this.deps.setLoitering?.(true);
      return;
    }
    const m = /^char:(\d)$/.exec(action);
    if (m && this.value.length < 2) this.value += m[1];
  }

  _start(mode, hours) {
    this.mode = mode;
    this.session = new RestSession(mode, hours, this.deps, this._remainingHoursRented);
    // GameManager_OnEncounter is subscribed in OnPush (:264) and sets
    // the latch on the WINDOW, so a CreateFoe wave that lands while
    // the player is still on the selection page is not lost - DFU
    // never resets the flag, and TickRest reads it (:351-354) on the
    // first tick after a mode IS picked. The port held the latch on
    // the session, which does not exist yet at that moment.
    if (this._pendingEnemySpawn) { this._pendingEnemySpawn = false; this.session.abortForEnemySpawn(); }
    this.state = 'resting';
  }

  /** AbortRestForEnemySpawn (:301-304), routed by the hosts. Before a
   *  mode is picked there is no session to latch, so the window holds
   *  it and hands it over at _start. */
  abortForEnemySpawn() {
    if (this.session) this.session.abortForEnemySpawn();
    else this._pendingEnemySpawn = true;
  }

  _end(result) {
    // EndRest's else-block FIRST arm (:480-486): the expired-room line
    // outranks
    // "You wake up." and "You are healed." both. It carries a STRING
    // rather than a record id (Internal_Strings :358 has it, TEXT.RSC
    // does not), and DFU calls RemoveExpiredRentedRooms right there -
    // the landlord clears the room as the player wakes.
    if (result.rentExpired) this.deps.onRentExpired?.();
    this.endLines = result.died ? null
      : (result.text ? [result.text] : (this.deps.endLines?.(result.textId) ?? null));
    if (result.died || !this.endLines) { this._close(); return; }   // death: the death screen owns the flow
    this.state = 'ended';
  }

  /** DaggerfallRestWindow.Update (:185-229), which runs every frame the
   *  window is topmost and reads Time.realtimeSinceStartup - so
   *  PauseWhileOpen's timeScale = 0 does not stop it.
   *
   *  S40: this is named `tick` because that is the seam ALL FOUR hosts
   *  already drive (townTalk's `frame`, worldModes' interior overlay
   *  arm, dungeonContext's `tickOverlay` - named rather than cited by
   *  line, because a port-internal line number drifts on every edit
   *  above it and this one already had). It was `tickRest`, which one
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
      // ShowStatus (:317-346): FullRest shows hours PAST against the
      // hoursPastTexture; TimedRest and Loiter show hours REMAINING
      // against hoursRemainingTexture. Two numbers, and the port
      // showed hours-past for all three - so a timed rest counted UP
      // where classic counts DOWN. The backgrounds are still FLAGGED
      // pending art, but the NUMBER is not a presentation choice.
      lines = [
        this.mode === 'loiter' ? 'Loitering...' : 'Resting...',
        this.mode === 'full'
          ? `Hours passed: ${this.session.totalHours}`
          : `Hours remaining: ${this.session.hoursRemaining}`,
      ];
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
