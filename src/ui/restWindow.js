// The rest window (U7). The classic rest flow: a selection page (rest
// for a while / rest until healed / loiter), an hours prompt for the
// timed modes, and the running page showing the hour counter + live
// vitals while the RestSession (systems/restSession.js) drives the
// clock. The world keeps running under the overlay - foes approach and
// can break the rest, exactly the DFU shape. Escape ends a running
// rest with its finish text; the end page closes on a click or a key.
//
// D3 RETIRED THE BACKGROUNDS FLAG. It said the backgrounds waited on
// art-NAME verification, the shared UI note - and there was nothing to
// verify: the three names are literal constants in the reference
// (:62-64), one line apart, each with DFU's own comment beside it.
//   REST00I0.IMG   the selection panel ("Rest type")
//   REST01I0.IMG   the "Hours past" counter    (FullRest)
//   REST02I0.IMG   the "Hours remaining" counter (TimedRest, Loiter)
// So this file makes the same native pass ui/tavernWindow.js made on
// TVRN00I0: the two PAGES that are the rest window itself - DFU's
// mainPanel and its counterPanel - are real ARENA2 art on the 320x200
// native screen, with the button rects driving the pointer. The other
// five states this file carries are DaggerfallMessageBox and
// DaggerfallInputMessageBox pushed OVER the window (the citations are
// in `input` below), so they keep the shared text idiom that every
// box in this port still uses - that is a different window class and
// a different slice.
//
// Art-less (no ARENA2 reachable) keeps the whole text chain, the
// townTalk preload idiom: the pages fall back to the clean panel and
// the running page's click stays click-anywhere, because a text page
// has no stop button to hit.
//
// ROAD-B B5 RETIRED THE TOGGLE-BINDING FLAG. It read: "the port
// cannot: with a window up every host routes keys through
// overlayAction (ui/input.js), whose first line turns any single
// character into `char:<k>`, so KeyR arrives as 'char:r'... a
// per-window toggle-close binding is a UI-arc facility". The facility
// was already built and in the wrong file's mind: A8's
// `normalizeCode` (systems/dialogShortcuts.js) is the exact inverse -
// it turns an action string BACK into the port's key code, 'char:r'
// into 'KeyR', because every hotkey-carrying window has the same
// problem and that is where the one answer lives. So Update
// :187-196 ports whole: `toggleClosedBinding` (:87) is captured at
// OnPush (:248, and again at :178 - DFU reads the binding twice, once
// in Setup and once on every push, because the window is a long-lived
// instance and the player can rebind between openings), and a key
// event that IS it ends a running rest or closes the selection page.
// The port's window is built per opening, so ONE capture in the
// constructor is both reads. GetBackButtonUp's
// half of the same line is the `back` action every state below
// already answers.

import { drawText, measureText } from './text.js';
import {
  RestSession, REST_PROMPT, LOITER_PROMPT, loiterLimitHours, cannotLoiterLines,
  canRest, illegalRestWarning, ILLEGAL_REST_WARNING,
  CANNOT_REST_MORE_THAN_99_HOURS_ID, MAX_REST_HOURS, PROMPT_MAX_CHARS, PROMPT_INITIAL,
  REST_TEXT,
} from '../systems/restSession.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { hotkeyHit, normalizeCode } from '../systems/dialogShortcuts.js';   // A8: the DaggerfallShortcut table   // B5: and its action-string -> key-code inverse
import { bindings } from './input.js';               // B5: the live InputManager registry
import { getBinding } from '../systems/inputActions.js';   // B5: InputManager.GetBinding(Actions.Rest)
import { loadImg, nativeMetrics, drawImg, shadowText, NATIVE_W } from './nativePanel.js';   // D3: the native-window idiom
import { drawMenuBackdrop } from './chargenArt.js';   // D3: Setup :137-138, ParentPanel.BackgroundColor = Color.black

const PANEL = [0.05, 0.05, 0.09, 0.92];
const TEXT = [0.86, 0.82, 0.68, 1];
const DIM = [0.55, 0.52, 0.45, 1];

/** D3 - #region UI Rects (:26-31), verbatim and in DFU's order. The
 *  three selection rects are children of mainPanel; stopButtonRect and
 *  counterTextPanelRect are children of counterPanel. */
export const REST_RECTS = Object.freeze({
  while: Object.freeze([4, 13, 48, 24]),      // whileButtonRect (:26)
  healed: Object.freeze([53, 13, 48, 24]),    // healedButtonRect (:27)
  loiter: Object.freeze([102, 13, 48, 24]),   // loiterButtonRect (:28)
});
/** counterPanelRect (:29) - the ONE rect of the three panels DFU gives
 *  a literal size to. The other page's size is read off its IMG. */
export const REST_COUNTER_RECT = Object.freeze([0, 50, 105, 41]);
export const REST_COUNTER_TEXT_RECT = Object.freeze([4, 10, 16, 8]);   // counterTextPanelRect (:30)
export const REST_STOP_RECT = Object.freeze([33, 26, 40, 10]);         // stopButtonRect (:31)
/** counterLabel.Position = new Vector2(0, 2) (:167), inside the 16x8
 *  text panel it is centred in (:168). */
export const REST_COUNTER_LABEL_Y = 2;
/** Both panels declare `Position = new Vector2(0, 50)` (:141, :158)
 *  and HorizontalAlignment.Center (:139, :160) with NO vertical
 *  alignment - so BaseScreenComponent :1216-1220 replaces the x and
 *  :1224-1226 keeps the declared y. 50 is that y, for both pages. */
export const REST_PANEL_Y = 50;

/** mainPanel's x: `Center` against the 320-wide native panel, and its
 *  width is REST00I0's OWN - DFU reads the image data for the size
 *  (:142) rather than writing a literal, so the port reads the IMG it
 *  loaded rather than guessing a number no ARENA2-less test could
 *  check. */
export const restPanelX = (imgW) => (NATIVE_W - imgW) / 2;
/** counterPanel's x, by the same law on the literal 105: (320-105)/2.
 *  The half pixel is DFU's - Center subtracts half a width in screen
 *  pixels, and 105 is odd. Preserved rather than rounded away. */
export const REST_COUNTER_X = (NATIVE_W - REST_COUNTER_RECT[2]) / 2;   // 107.5

const inRect = ([rx, ry, rw, rh], ox, oy, x, y) =>
  Number.isFinite(x) && Number.isFinite(y)
  && x >= ox + rx && y >= oy + ry && x < ox + rx + rw && y < oy + ry + rh;

/** Which selection button a native (320x200) point lands on, or null.
 *  `panelW` is REST00I0's width; without it there is no panel on
 *  screen and so no button. */
export function restButtonAt(vx, vy, panelW) {
  if (!panelW) return null;
  const ox = restPanelX(panelW), oy = REST_PANEL_Y;
  for (const name of ['while', 'healed', 'loiter']) {
    if (inRect(REST_RECTS[name], ox, oy, vx, vy)) return name;
  }
  return null;
}
/** stopButtonRect in native coords - the counter panel's own origin. */
export const restStopHit = (vx, vy) =>
  inRect(REST_STOP_RECT, REST_COUNTER_X, REST_PANEL_Y, vx, vy);

/** LoadTextures (:307-312), all three at once: a page with only some
 *  of its art is worse than the text chain, so a single failure keeps
 *  the whole window textual. */
let _art = null;
export async function preloadRestArt(deps) {
  if (_art) return;
  try {
    const [base, hoursPast, hoursRemaining] = await Promise.all([
      loadImg(deps, 'REST00I0.IMG'), loadImg(deps, 'REST01I0.IMG'), loadImg(deps, 'REST02I0.IMG'),
    ]);
    _art = { base, hoursPast, hoursRemaining };
  } catch { console.warn('[rest] REST00I0/01I0/02I0 unavailable; the rest window stays text'); }
}
export const restArtLoaded = () => !!_art;

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
    this._closeDispatched = false;     // onClose is owed ONCE, whichever door closes this
    // B5: "Store toggle closed binding for this window" - DFU's own
    // comment (:177/:247). It is READ ONCE, at push, not per key event,
    // and that is the behaviour: rebinding Rest while the window stands
    // open does not change the key that closes it.
    this.toggleClosedBinding = getBinding(bindings(), 'Rest');
    // ROAD-E E1: StopButton_OnKeyboardEvent's own latch (:714-726). Its
    // KeyDown arm plays ButtonClick and raises this; its KeyUp arm ends
    // the rest. DFU's field name (:75).
    this.isCloseWindowDeferred = false;
    // ...and the TOGGLE/back door's own latch, which DFU does not need
    // and this port does: GameManager.cs:534-537 opens the rest window
    // on `ActionComplete(Actions.Rest)` - the RELEASE edge
    // (InputManager.cs:634-637) - so the opening release is already
    // spent when DFU's window first runs, and :193's bare `GetKeyUp`
    // is safe there. Every host here opens on the key DOWN
    // (world.js:4171, exterior.js:2184, ui/input.js:303), and that same
    // key's release is then routed straight into the freshly mounted
    // window, so the release door needs the deferral DFU gives every
    // window whose open edge IS the down: DaggerfallAutomapWindow.cs
    // :703-713's `isCloseWindowDeferred` - armed by a press THIS WINDOW
    // SAW, consumed by the release.
    this._toggleArmed = false;
    // OnPush (:266-268): "Raise player resting flag when UI opens.
    // This is used for random enemy spawning and influences
    // CastWhenHeld durability loss" - DFU's own comment, and it names
    // TWO of the flag's THREE readers. All three:
    //   CastWhenHeld.cs:135      degrade 60/round rather than 4
    //   PlayerEntity.cs:605      the dungeon rest-encounter roll
    //   PlayerEntity.cs:417-418  `if (!isResting) DecreaseFatigue` -
    //                            no per-minute fatigue drain while
    //                            resting, which the port was charging
    // The first two were ported and unfed; the third was not ported at
    // all, and the sentence that used to stand here saying "its ONE
    // consumer is CastWhenHeld's degrade rate" is what licensed
    // leaving it out. The flag is raised
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
    // The flags first and UNGUARDED, per the note above. Then the
    // dispatch, ONCE: `dispose()` calls this method deliberately, so a
    // host that drains a window which already closed itself would fire
    // PopToHUD a second time. Harmless for a boolean, not harmless for
    // a callback that closes a host's overlay slot - that is the door
    // S40 opened and the crash of 2026-08-29 came through it, fifty
    // frames of close -> onClose -> dispose -> close. The host's own
    // ordering is fixed too (townTalk.dropOverlay); this half is the
    // window's, so a window is safe to close from either side and no
    // future host has to know the rule.
    this.done = true;
    this.deps.setResting?.(false);
    this.deps.setLoitering?.(false);
    // RestFinishedPopup_OnClose is `PopToHUD(); RaiseSkills();`
    // (:728-732) IN THAT ORDER, and the order is load bearing: the
    // level-up screen RaiseSkills can raise needs the host's overlay
    // slot, and every host guards its onLevelUp with "only if the slot
    // is free". The window cannot clear a host's slot itself, so it
    // asks - the identity-guarded onClose idiom this port already uses
    // for every window that dispatches to another. Without it the slot
    // still held THIS window at that moment, the guard was false, and
    // the level-up screen never appeared: advancement.js took its
    // headless arm and dumped every point into the LOWEST stats, which
    // is the exact defect AUDIT 21 hosts F3 fixed for the ticker path.
    if (this._closeDispatched) return;
    this._closeDispatched = true;
    // B5 - OnPop's UpdateNpcPresence (:277-280). It is INSIDE the
    // once-guard on purpose: this method is the port's OnPop and the
    // port's CloseWindow at the same time (dispose() calls it again by
    // design, per the note above), and re-rolling NPC presence at a
    // later hour on a second pass would stand people up that the first
    // pass had correctly left sitting. Ordered here rather than at
    // DFU's exact position (before the IsResting writes) because the
    // flags above are unguarded and this cannot be; nothing reads the
    // two in sequence.
    //
    // DFU also clears `ignoreAllocatedBed` on pop (:274). The port
    // builds a fresh window per opening - DFU keeps one instance in
    // DaggerfallUI - so that reset has nothing to undo here, and is
    // named rather than written as a line no pin could kill.
    this.deps.updateNpcPresence?.();
    this.deps.onClose?.();
  }

  dispose() { this._close(); }

  // TWO RECORDED NOT-A-GAPS, both from OnPop/Update and both
  // belonging to other arcs rather than to rest - they were flagged as
  // owed work, and reading DFU's own tree closes both. (The third that
  // stood here, OnPop's
  // UpdateNpcPresence, is LANDED at B5: the law is
  // characters/interiorPeople.js and `_close` above calls it. Its old
  // entry said "the port has no NPC-presence pass at all; that is the
  // interior/talk arc's" - the pass is one boolean over hours the
  // building-locks module already owned, and it is rest's own caller.)
  //
  //  - OnSleepEnd (:288-289): a sleep of MORE than six hours
  //    (sleepEventMinimumHours, :60) raises an event whose ONE
  //    subscriber in DFU's whole tree is the player's own
  //    EntityEffectManager (:174 subscribe, :195 unsubscribe), and
  //    that handler's ENTIRE body is `RerollItemEffects()`
  //    (EntityEffectManager.cs:2170-2173) - which drains
  //    `itemsPendingReroll`, the set DoMagicRound fills on each item's
  //    own hour clock. So the event carries no law of its own; the law
  //    is "items six hours stale reroll", and the port FUSED the queue
  //    and the drain to hold it: enchantments.js fires the
  //    RerollEffect payload inline in the magic round once an item is
  //    REROLL_MINIMUM_HOURS (= 6, sleepEventMinimumHours) old, and
  //    S40's advanceMinutes runs the magic rounds THROUGH the sleep,
  //    so a rested night rerolls as it passes rather than in one flush
  //    at the end. Same items, same clock, a different moment - a
  //    recorded divergence in shape, not a missing effect.
  //  - RaiseOnSleepTickEvent (:206-208) has no consumer in DFU's own
  //    tree at all: `OnSleepTick` greps to its own delegate, event and
  //    raise in this one file (:798-805) and nowhere else. It is a mod
  //    hook, and a port with no mods loses nothing by not raising it.

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
    // canRest answers DFU's two out-parameters by their DFU names:
    // `bedIndex` is allocatedBed resolved to an INDEX (the host owns
    // the marker list, since building positions are not stable), and
    // -1 is its "no bed".
    this._allocatedBed = (d.bedIndex ?? -1) >= 0 ? d.bedIndex : null;
    // CheckRent counts this down every rested hour, so the rental has
    // to reach the session - both lanes computed it and dropped it.
    // No `?? -1` here: canRest returns the field on every one of its
    // exits, so a fallback would be unreachable - and unreachable
    // code no pin can kill is a place for a wrong answer to hide.
    this._remainingHoursRented = d.hoursRented;
    if (d.crime) this.deps.commitCrime?.(d.crime, d.spawnGuards);
    if (d.allowed) return true;
    // CloseWindow() then MessageBox: the rest window is GONE and the
    // text stands alone. Here the window becomes the text and then
    // goes - and crucially NOT through the 'ended' state, which is
    // the RaiseSkills moment (:729-732). A refusal raises nothing.
    this.refusalLines = (d.line ? [d.line] : this.deps.endLines?.(d.textId ?? REST_TEXT.cityCampingIllegal)) ?? null;
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
    if (!alreadyWarned && illegalRestWarning() && this.deps.restPlace?.()?.inTownOutside) {
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
      this.state = 'hours'; this.mode = 'timed'; this.value = PROMPT_INITIAL; this.notice = null;
    } else {
      this._start('full', 0);
      this._moveToBed();
    }
  }

  /** `InputManager.GetKeyUp(toggleClosedBinding)` (:193) over the
   *  port's overlay seam. normalizeCode is A8's inverse of the seam's
   *  own mangling - overlayAction turns any single character into
   *  `char:<k>`, and this turns 'char:r' back into 'KeyR', which is the
   *  alphabet inputActions.js stores bindings in. A window with no Rest
   *  binding at all (a cleared row) has no toggle, which is DFU's
   *  KeyCode.None answering false. */
  _togglePressed(action, e) {
    if (!this.toggleClosedBinding) return false;
    return normalizeCode(action, e) === this.toggleClosedBinding;
  }

  /** StopButton_OnMouseClick / the Update block's `currentRestMode !=
   *  Selection` arm - EndRest plus the ButtonClick every handler DFU
   *  routes this outcome through plays. ONE body, three callers (the
   *  mouse click, the toggle release, StopButton's deferred KeyUp), so
   *  they cannot drift apart. */
  _stopRest() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this._end(this.session.endEarly());
  }

  /**
   * ROAD-E E1: THE RELEASE HALF, and both of DFU's arms live here.
   *
   * (1) Update :187-196 - `if (HotkeySequenceProcessed == NotFound) if
   *     (GetKeyUp(toggleClosedBinding) || GetBackButtonUp())` - ONE
   *     statement, so the Rest binding and the back button are the same
   *     door and cannot drift apart: `currentRestMode != Selection` is
   *     EndRest, Selection is CloseWindow. Only the two states that ARE
   *     the rest window take it (see `input`'s note on the stack).
   * (2) StopButton_OnKeyboardEvent's KeyUp arm (:721-725): the deferred
   *     EndRest, with `&& isCloseWindowDeferred` so a release with
   *     nothing armed does nothing.
   *
   * `normalizeCode` folds the two host alphabets - the key-up seam
   * hands down the raw code and the keyed hosts' press half hands down
   * `back` - so one spelling serves both.
   */
  keyup(action, e = null) {
    if (this.state !== 'selection' && this.state !== 'resting') return;
    if (this.state === 'resting' && this.isCloseWindowDeferred
      && hotkeyHit('RestStop', action, e)) {
      this.isCloseWindowDeferred = false;
      // :722-724 - the deferred arm calls EndRest and nothing else; the
      // ButtonClick was already played on the KeyDown (:717-719).
      this._end(this.session.endEarly());
      return;
    }
    const back = normalizeCode(action, e) === 'Escape';
    if (!back && !this._togglePressed(action, e)) return;
    // DaggerfallAutomapWindow.cs:709's `&& isCloseWindowDeferred`: a
    // release whose press this window never saw is the one that opened
    // it, and it closes nothing.
    if (!this._toggleArmed) return;
    this._toggleArmed = false;
    if (this.state === 'resting') { this._stopRest(); return; }
    // ButtonClick, as the port's `back` arm has always played it here -
    // ExitButton_OnMouseClick, the handler DFU routes the same outcome
    // through, plays it.
    audio.playOneShot(SOUND.ButtonClick, 1);
    this._close();
  }

  input(action, e = null) {
    // A8: the window's four buttons carry their DFU Hotkey
    // (DaggerfallRestWindow.cs:149/152/155/173 - RestForAWhile,
    // RestUntilHealed, RestLoiter, RestStop), and the table decides
    // the letter, not this file. The digit row below it is the port's
    // own accelerator, kept: DFU offers no digit here.
    const hot = (b) => hotkeyHit(b, action, e);
    // B5 - Update :187-196, THE TOGGLE-BINDING CLOSE, and it is FIRST
    // because DFU's is: the block sits at the head of Update, above
    // ShowStatus and above the rest ticking.
    //
    // The state test is DFU's window stack, not a port invention. Only
    // TWO of the six states below are the rest window itself: DFU's
    // 'selection' is mainPanel and 'resting' is counterPanel, and every
    // other state this port carries is a DaggerfallMessageBox or a
    // DaggerfallInputMessageBox pushed OVER it (the confirm box
    // :648-664, the hours prompts :619-624/:700-705, the refusals
    // :594-596/:753-757, the finish popups :450-503). DaggerfallUI
    // updates the TOP WINDOW ONLY (DaggerfallUI.cs:433), so while any
    // of those stands, the rest window's Update - and this block with
    // it - does not run at all. Typing the rest letter into the hours
    // field must not close the window under it, and does not.
    //
    // ROAD-E E1 MOVED THIS BLOCK TO `keyup` BELOW, which is where DFU
    // reads it: :193 is `GetKeyUp(toggleClosedBinding) ||
    // GetBackButtonUp()`. The note that stood here read: "The port's
    // overlay seam has no down/up split, so a player who binds Rest
    // onto F, U, L or S gets the close rather than the button." It has
    // one now - so the colliding-binding race the
    // `HotkeySequenceProcessed == NotFound` gate (:189) guards against
    // resolves the way DFU's does without porting the gate at all: the
    // BUTTON hotkeys are read on the press (below) and the toggle on
    // the release, so the button always wins a colliding press.
    // ...and the ARM for that release door, above the state ladder so
    // both pages take it (DaggerfallAutomapWindow.cs:703-708's
    // `GetBackButtonDown() || GetKeyDown(automapBinding)`). It does NOT
    // consume the press: the button hotkeys below must still see a
    // colliding binding, which is the whole point of E1's split.
    if ((this.state === 'selection' || this.state === 'resting')
      && (normalizeCode(action, e) === 'Escape' || this._togglePressed(action, e))) {
      this._toggleArmed = true;
    }
    if (this.state === 'refused') { this._close(); return; }
    // F144: the over-cap box is click-anywhere; dismissing lands on
    // the selection page, NOT back in a prompt - the prompt is gone.
    if (this.state === 'hoursRefused') { this.notice = null; this.state = 'selection'; return; }
    if (this.state === 'confirm') {
      // ConfirmIllegalRest*_OnButtonClick (:659-666, :684-691): the box
      // closes either way, and only Yes carries on - No leaves the
      // rest window standing on its selection page.
      // A8: the box's own two buttons are DaggerfallShortcut's Yes/No.
      if (hot('Yes') || action === 'confirm') { const w = this._pending; this._pending = null; this._restButton(w, true); }
      else if (hot('No') || action === 'back') { this._pending = null; this.state = 'selection'; }
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
      // ROAD-E E1: StopButton_OnKeyboardEvent (:714-726) is TWO PHASES -
      // KeyDown plays ButtonClick and raises `isCloseWindowDeferred`,
      // KeyUp with the flag set calls EndRest - and the back button
      // takes the Update block's own release door (`keyup` below), so
      // neither ends the rest on the press any more. The MOUSE click
      // (:708-712) is one call and stays one.
      if (hot('RestStop')) { audio.playOneShot(SOUND.ButtonClick, 1); this.isCloseWindowDeferred = true; }
      return;
    }
    if (this.state === 'selection') {
      // ROAD-E E1: `back` is GetBackButtonUp() here - the same statement
      // as the toggle binding (:193) - so it closes on the release, in
      // `keyup`. Only the buttons are read on the press.
      // every button assigns ButtonClick: While :644, Healed :670,
      // Loiter :695, Stop :711
      if (action === 'char:1' || hot('RestForAWhile')) { audio.playOneShot(SOUND.ButtonClick, 1); this._restButton('while', false); }
      else if (action === 'char:2' || hot('RestUntilHealed')) { audio.playOneShot(SOUND.ButtonClick, 1); this._restButton('healed', false); }
      else if (action === 'char:3' || hot('RestLoiter')) { audio.playOneShot(SOUND.ButtonClick, 1); this.state = 'hours'; this.mode = 'loiter'; this.value = PROMPT_INITIAL; this.notice = null; }
      return;
    }
    // hours entry: digits, backspace, confirm
    if (action === 'back') { this.state = 'selection'; this.notice = null; return; }
    if (action === 'backspace') { this.value = this.value.slice(0, -1); return; }
    if (action === 'confirm') {
      // int.TryParse then the RANGE arms (:741-757, :763-784). An
      // unparseable entry returns and does nothing - reachable only
      // once the player has EMPTIED the field, because DFU prefills it
      // with "0" (:619, :700), so Enter on an untouched prompt starts
      // a 0-hour rest. That rest ends immediately and passes no world
      // time (restSession's hoursRemaining < 1 pre-check; AUDIT 23
      // corrected the old 'rests one full hour' claim).
      //
      // The 99-hour arm is DFU's, not a field width: MaxCharacters is
      // 8 on both prompts (:621, :702), and the port used to cap the
      // field at two digits and call that "the 99-hour cap by
      // construction" - which made TEXT.RSC 26 unreachable and let a
      // 100-hour rest through the day someone widened the field.
      if (this.value === '') return;
      const hours = Number(this.value);
      // AUDIT 26 F144: the refusal is a NEW box over the SELECTION
      // page - the input box has already closed itself before the
      // handler runs (DaggerfallInputMessageBox.cs:298-304), so
      // TEXT.RSC 26 shows with no live field beneath it, and a retry
      // needs a fresh While/Loiter press, which re-runs the whole
      // gate INCLUDING CanRest and its Vagrancy side effect. The old
      // cut kept the field up under the notice and retried past
      // _canRest.
      if (this.mode === 'loiter' && hours > loiterLimitHours()) { this.notice = cannotLoiterLines(); this.state = 'hoursRefused'; this.value = PROMPT_INITIAL; return; }
      if (this.mode === 'timed' && hours > MAX_REST_HOURS) {
        this.notice = this.deps.endLines?.(CANNOT_REST_MORE_THAN_99_HOURS_ID) ?? null;
        this.state = 'hoursRefused';
        this.value = PROMPT_INITIAL;
        return;
      }
      this._start(this.mode, hours);
      // TimedRestPrompt_OnGotUserInput (:762) ends on MoveToBed; the
      // loiter prompt sets IsLoitering (:789) and does NOT move.
      if (this.mode === 'timed') this._moveToBed();
      else if (this.mode === 'loiter') this.deps.setLoitering?.(true);
      return;
    }
    const m = /^char:(\d)$/.exec(action);
    if (m && this.value.length < PROMPT_MAX_CHARS) this.value += m[1];
  }

  /** `uiManager.TopWindow != this` (TickRest :364/:399) asked from the
   *  window, which is the only side that knows which entry it is.
   *  `deps.topWindow` is the host's live slot - B1 made every host's
   *  slot the MIRROR OF THE TOP of its stack, so the read is one
   *  closure and not a second stack lookup. A host that hands none has
   *  no window over this one. */
  _isTop() { return this.deps.topWindow ? this.deps.topWindow() === this : true; }

  _start(mode, hours) {
    this.mode = mode;
    this.session = new RestSession(mode, hours, this.deps, this._remainingHoursRented, () => this._isTop());
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
    if (result.died || !this.endLines) {
      // The death screen owns the MESSAGE - that is this port's named
      // deviation and it stands - but not the RAISE. Every one of
      // EndRest's four arms attaches OnClose (:461-462, :468-469,
      // :482-483, :489-490, :496-497), the death arm included: DFU's
      // death path sets `youNeverAwaken` and calls EndRest, whose box
      // closes into PopToHUD + RaiseSkills. The ONE EndRest-adjacent
      // path with no OnClose is CanRest's refusal (:594-596), which
      // this port already routes through 'refused' and not here.
      // Dropping the raise here lost a whole night's advancement to a
      // poison that killed the sleeper, and to any host whose TEXT.RSC
      // lookup came back empty.
      this._close();
      this.deps.onRestFinished?.();
      return;
    }
    this.state = 'ended';
  }

  /** DaggerfallRestWindow.Update (:185-229), which runs every frame the
   *  window is topmost and reads Time.realtimeSinceStartup - so
   *  PauseWhileOpen's timeScale = 0 does not stop it.
   *
   *  BOTH rest lanes found this independently, which is some evidence
   *  it was the real defect: it is named `tick` because that is the
   *  seam ALL FOUR hosts already drive (townTalk's `frame`, worldModes' interior overlay
   *  arm, dungeonContext's `tickOverlay` - named rather than cited by
   *  line, because a port-internal line number drifts on every edit
   *  above it and this one already had). It was `tickRest`, which one
   *  host knew to call - so the moment rest reached the other three
   *  their rest windows would have sat on "Hours passed: 0" until
   *  Escape, which is the same defect AUDIT D-C1 and the dungeon's own
   *  tickOverlay comment each record for a different clock. `tickRest`
   *  stays as the old name for callers that still use it; it must not
   *  be called IN ADDITION to tick, or the rest runs at double speed. */
  /** The pointer half. Two reasons this exists, and neither is
   *  cosmetic. DFU's message boxes close on a click, so the end page
   *  and the refusal must; and townTalk.pointerdown bails on any
   *  overlay with no `click`, after which the host calls requestLook
   *  and GRABS POINTER LOCK under the open window - the camera then
   *  spins behind the rest panel. The two modal hosts already refuse
   *  exactly that; the two outdoor ones could not, because the seam
   *  they refuse through is the presence of this method. */
  click(vx, vy) {
    if (this.state === 'ended' || this.state === 'refused') this.input(this.state === 'ended' ? 'confirm' : 'back');
    else if (this.state === 'hoursRefused') this.input('confirm');   // F144: click-anywhere
    else if (this.state === 'resting') {
      // StopButton_OnMouseClick (:708-712). D3: once the counter panel
      // is real art the stop button is the RECT it occupies (:31) and
      // the rest of the panel is scenery - a click on the hour digits
      // must not end the night. The art-less text page has no button
      // drawn anywhere, so there the whole page stays the button.
      // ROAD-E E1: the MOUSE click is StopButton_OnMouseClick and it is
      // ONE call - EndRest then ButtonClick (:708-712). Only the
      // KEYBOARD twin defers to the release (:714-726), so this arm
      // stopped routing through `input('back')`: `back` is
      // GetBackButtonUp() now and lives in `keyup`.
      if (!_art || restStopHit(vx, vy)) this._stopRest();
    } else if (this.state === 'selection' && _art) {
      // D3 - the three mainPanel children (:147-156). Each handler is
      // the same one the letter takes, ButtonClick included, so they
      // route through `input` rather than growing a second copy of the
      // While/Healed/Loiter bodies.
      const b = restButtonAt(vx, vy, _art.base.w);
      if (b) this.input(b === 'while' ? 'char:1' : b === 'healed' ? 'char:2' : 'char:3');
    }
    return true;
  }

  tick(dt) {
    if (this.state !== 'resting') return;
    const r = this.session.tick(dt);
    if (r) this._end(r);
  }

  tickRest(dt) { this.tick(dt); }

  /** ShowStatus (:314-346) - which of the two pages is up, and for the
   *  counter page which of the two textures and which of the two
   *  numbers. Returned rather than drawn so the mapping can be read
   *  without a GL context. Only the RUNNING page is counterPanel:
   *  every other state this window carries is `currentRestMode ==
   *  Selection` in DFU (the boxes go up before a mode is picked and
   *  come down having picked one), which is ShowStatus's first arm -
   *  mainPanel. And its `else if` ladder makes TimedRest and Loiter
   *  the SAME arm: hoursRemaining, on REST02I0, both. */
  status() {
    if (this.state !== 'resting') return { panel: 'main' };
    const full = this.mode === 'full';
    return {
      panel: 'counter',
      texture: full ? 'hoursPast' : 'hoursRemaining',
      hours: full ? this.session.totalHours : this.session.hoursRemaining,
    };
  }

  /** D3 - the two native pages. Returns false when there is no art, so
   *  `draw` falls through to the text chain below it. */
  _drawNative(renderer, canvas, font) {
    if (!_art || (this.state !== 'selection' && this.state !== 'resting')) return false;
    const m = nativeMetrics(canvas);
    // Setup :137-138, DFU's own comment: "Hide world while resting" -
    // ParentPanel.BackgroundColor = Color.black, opaque, so the world
    // AND the HUD the host painted under this overlay go away.
    drawMenuBackdrop(renderer, canvas);
    const st = this.status();
    if (st.panel === 'main') {
      drawImg(renderer, _art.base, m, restPanelX(_art.base.w), REST_PANEL_Y);
      return true;
    }
    // counterPanel: DFU's explicit 105x41 Size (:154-155) over whichever
    // BackgroundTexture ShowStatus assigned - the panel rect wins, not
    // the IMG's own dimensions.
    drawImg(renderer, _art[st.texture], m, REST_COUNTER_X, REST_PANEL_Y,
      REST_COUNTER_RECT[2], REST_COUNTER_RECT[3]);
    // counterLabel, centred in the 16-wide counterTextPanel at (4,10)
    // with its own +2 y (:165-169). A bare TextLabel takes
    // DaggerfallDefaultTextColor and DaggerfallDefaultShadowColor at
    // DaggerfallDefaultShadowPos (TextLabel.cs:40-42), which is what
    // shadowText already defaults to.
    shadowText(renderer, font, String(st.hours), m,
      REST_COUNTER_X + REST_COUNTER_TEXT_RECT[0],
      REST_PANEL_Y + REST_COUNTER_TEXT_RECT[1] + REST_COUNTER_LABEL_Y,
      { align: 'center', w: REST_COUNTER_TEXT_RECT[2] });
    // Draw (:230-240) paints hud.HUDVitals and hud.LargeHUD back OVER
    // the black - the counter panel is a bare hour count, and the bars
    // are how a resting player watches the healing land. The port has
    // no host-free way to reach the HUD's own art from inside a
    // window, so the vitals the deps already hand this page stay the
    // ROW they have always been, moved onto the black. Named here
    // rather than dropped: dropping it would take the only feedback
    // the running page gives.
    const v = this.deps.vitals?.();
    if (v) {
      shadowText(renderer, font, `Health ${v.health}/${v.maxHealth}  Fatigue ${v.fatigue}  Magicka ${v.magicka}`,
        m, 0, REST_PANEL_Y + REST_COUNTER_RECT[3] + 8, { align: 'center', w: NATIVE_W });
    }
    return true;
  }

  draw(renderer, canvas, font, s) {
    if (this._drawNative(renderer, canvas, font)) return;
    let lines;
    if (this.state === 'selection') {
      lines = ['How would you like to rest?', '', '1. Rest for a while', '2. Rest until healed', '3. Loiter', '', 'Esc - never mind'];
    } else if (this.state === 'confirm') {
      lines = [ILLEGAL_REST_WARNING, '', 'Y - yes', 'N - no'];
    } else if (this.state === 'hours') {
      lines = [(this.mode === 'loiter' ? LOITER_PROMPT : REST_PROMPT) + this.value + '_'];
    } else if (this.state === 'hoursRefused') {
      // F144: the refusal alone - no field, no cursor; the original
      // prompt self-closed before the handler ever saw the number.
      lines = [...(this.notice ?? [])];
    } else if (this.state === 'resting') {
      const v = this.deps.vitals?.() ?? null;
      // ShowStatus (:317-346): FullRest shows hours PAST against the
      // hoursPastTexture; TimedRest and Loiter show hours REMAINING
      // against hoursRemainingTexture. Two numbers, and the port
      // showed hours-past for all three - so a timed rest counted UP
      // where classic counts DOWN. D3 moved that mapping into
      // `status()` above so the art page and this text page cannot
      // drift apart: the counting half was already right here, and a
      // second copy of it beside the new one is how it stops being.
      const st = this.status();
      lines = [
        this.mode === 'loiter' ? 'Loitering...' : 'Resting...',
        `${st.texture === 'hoursPast' ? 'Hours passed' : 'Hours remaining'}: ${st.hours}`,
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
