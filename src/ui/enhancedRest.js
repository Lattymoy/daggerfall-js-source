// ENHANCED REST WINDOW (2026-09-20, per-request: "modernize the resting
// window based on the inventory style... don't touch classic mode") —
// the SAME card/panel language ui/enhancedInventory.js's own screens use
// (`.card`, `.acts`, `.meter`), driving the SAME systems/restSession.js
// engine ui/restWindow.js drives: this file owns no game rule at all,
// only the picture. ui/restDoor.js is the gate - native/classic mode
// keeps ui/restWindow.js's RestWindow exactly as it was, byte for byte.
//
// The countdown, the hourly interrupt, the vitals healed, whether a
// followed party member spawns a monster - every one of those questions
// is systems/restSession.js's RestSession, the exact class RestWindow
// itself constructs. This view makes one too, ticks it once a frame, and
// draws whatever it reports.

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { RestSession, MAX_REST_HOURS, PROMPT_INITIAL, canRest, illegalRestWarning, ILLEGAL_REST_WARNING, REST_TEXT } from '../systems/restSession.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// PARTY-REST1d (2026-09-20, per-request: "only the one who initiated the
// rest is prob able to press ok and then the others are [not]" - the bug
// this closed): the SAME releaseLock() every other enhanced DOM window
// already carries (enhancedInventory.js, enhancedMenu.js,
// enhancedChargen.js, ui/heldMap.js), missing here entirely. A player who
// personally opened this window had almost certainly already dropped
// pointer lock somewhere in the process of walking up and pressing Rest;
// PARTY-REST1's follower mirror opens with ZERO clicks at all - nothing
// in that whole path ever asked the browser to let go of the mouse - so
// the cursor stayed captured for camera-look the entire time the mirror
// was up, and every click a follower made on the OK button landed on the
// 3D view behind it instead. Released once on mount, and kept released by
// the same `pointerlockchange` listener enhancedInventory.js registers,
// in case anything tries to relock while this window is still open.
function releaseLock() {
  try {
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
  } catch { /* a browser that refuses is a browser with no lock to drop */ }
}

const MODE_LABEL = { loiter: 'Loitering', timed: 'Resting', full: 'Resting Until Healed' };

/**
 * Builds the enhanced rest overlay. `deps` is RestSession's own hook bag
 * (createRestDeps' output, or a caller's own hand-built copy of it, e.g.
 * a PARTY-REST1 follower's mirror deps) - unchanged, the same object
 * ui/restWindow.js's RestWindow takes.
 */
export function mountEnhancedRest(hostEl, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();

  const overlay = {
    isRestWindow: true,
    isPartyRestMirror: false,   // PARTY-REST1: set by the caller, same as RestWindow's own
    state: 'selection',         // selection | hours | resting | ended | confirm | refused
    mode: null,
    session: null,
    done: false,
    _remainingHoursRented: -1,
    _allocatedBed: null,
    _pendingRest: null,   // RESTFIX3: 'while' | 'healed' - which button is waiting on the illegal-rest confirm
    _refusalLines: null,   // RESTFIX3: canRest's own refusal text, shown once and then the window closes
    _hoursValue: PROMPT_INITIAL,
    _endLines: null,
    _pendingEnemySpawn: false,   // same latch RestWindow carries - a foe spawned before a mode is even picked must not be lost
  };
  // restWindow.js's own doc comment on this exact call, verbatim law: "The flag is raised on OPEN, not on the
  // first rested hour - standing in the window deciding already costs a held enchantment." Missing this meant
  // playerEntity.isResting never became true for this skin at all - CastWhenHeld's degrade rate, the dungeon
  // rest-encounter roll, and PARTY-REST1's own "never double up on a rest that is already real" guard all read
  // it and all silently saw `false` throughout an enhanced rest.
  deps.setResting?.(true);
  overlay.abortForEnemySpawn = () => {
    if (overlay.session) overlay.session.abortForEnemySpawn();
    else overlay._pendingEnemySpawn = true;
  };
  const isTop = () => (deps.topWindow ? deps.topWindow() === overlay : true);

  const startFixed = (mode, hours) => {
    overlay.mode = mode;
    overlay.session = new RestSession(mode, hours, deps, overlay._remainingHoursRented, isTop);
    if (overlay._pendingEnemySpawn) { overlay._pendingEnemySpawn = false; overlay.session.abortForEnemySpawn(); }
    overlay.state = 'resting';
    // restWindow.js's own TimedRestPrompt_OnGotUserInput note: "the loiter prompt sets IsLoitering and does NOT
    // move" - the SAME flag setResting(true) above does not cover; only a chosen Loiter, never Rest-for-a-while
    // or Rest-Until-Healed, raises it.
    if (mode === 'loiter') deps.setLoitering?.(true);
    render();
  };
  // PARTY-REST1: the follower mirror's own entry point (world.js calls this exactly where it used to call the
  // classic window's own _start) - kept as the SAME name so neither caller has to know which skin it got.
  overlay._start = (mode, hours) => startFixed(mode, hours);
  overlay._end = (result) => {
    overlay._endLines = result.text ? [result.text] : (deps.endLines?.(result.textId) ?? ['You wake up.']);
    if (result.died || !overlay._endLines?.length) { close(); deps.onRestFinished?.(); return; }
    overlay.state = 'ended';
    render();
  };

  const startTimed = (mode) => {
    const hours = Math.min(MAX_REST_HOURS, Math.max(1, parseInt(overlay._hoursValue, 10) || 1));
    startFixed(mode, hours);
  };

  /** RESTFIX3 (2026-09-21, per-request: "normaly when you start resting it asks you if you really want to rest
   *  cause its not allowed and when you press yes the guards come. This message is missing entirely now" - the
   *  bug this closed): ui/restWindow.js's own `_restButton`/`_canRest`, ported - this skin's selection screen was
   *  skipping the whole illegal-rest law entirely, going straight from a click to the hours picker or a started
   *  session. Two pieces, same as classic: the CONFIRM box (illegalRestWarning() - a settings preference - and
   *  only when `deps.restPlace()?.inTownOutside`, i.e. camping in the open street of a town, never anywhere
   *  else), and canRest() itself (systems/restSession.js, the SAME pure function classic calls - never
   *  reimplemented here), which resolves the bed/rental/guild-hall law, commits the crime if one is owed
   *  (Vagrancy, guards spawned) regardless of which arm answers, and can refuse the rest outright (a room never
   *  rented, still reads "You have not rented a room here."). Deliberately NOT asked of Loiter - classic's own
   *  law, restWindow.js's own comment: "LoiterButton is deliberately absent from this path - loitering in town
   *  is never gated." */
  function canRestNow(alreadyWarned) {
    const place = deps.restPlace?.();
    if (!place) { overlay._allocatedBed = null; overlay._remainingHoursRented = -1; return true; }
    const d = canRest({ ...place, alreadyWarned });
    overlay._allocatedBed = (d.bedIndex ?? -1) >= 0 ? d.bedIndex : null;
    overlay._remainingHoursRented = d.hoursRented;
    if (d.crime) deps.commitCrime?.(d.crime, d.spawnGuards);
    if (d.allowed) return true;
    overlay._refusalLines = (d.line ? [d.line] : deps.endLines?.(d.textId ?? REST_TEXT.cityCampingIllegal)) ?? null;
    if (!overlay._refusalLines?.length) { close(); return false; }
    overlay.state = 'refused';
    render();
    return false;
  }
  function continueRest(which, alreadyWarned) {
    if (!alreadyWarned && illegalRestWarning() && deps.restPlace?.()?.inTownOutside) {
      overlay._pendingRest = which;
      overlay.state = 'confirm';
      render();
      return;
    }
    if (!canRestNow(alreadyWarned)) return;
    if (which === 'while') { overlay.state = 'hours'; overlay.mode = 'timed'; overlay._hoursValue = PROMPT_INITIAL; render(); }
    else startFixed('full', 0);
  }

  function selectionCard() {
    const c = el('div', 'card');
    c.append(el('h2', null, 'Rest'));
    const acts = el('div', 'acts selection-acts');
    const btn = (label, onClick) => { const b = el('button', 'act', label); b.onclick = onClick; acts.append(b); };
    btn('Rest for a While', () => continueRest('while', false));
    btn('Rest Until Healed', () => continueRest('healed', false));
    btn('Loiter', () => { overlay.state = 'hours'; overlay.mode = 'loiter'; overlay._hoursValue = PROMPT_INITIAL; render(); });
    btn('Cancel', () => close());
    c.append(acts);
    return c;
  }

  function confirmCard() {
    const c = el('div', 'card');
    c.append(el('p', null, ILLEGAL_REST_WARNING));
    const acts = el('div', 'acts');
    const yes = el('button', 'act', 'Yes');
    yes.onclick = () => { const which = overlay._pendingRest; overlay._pendingRest = null; continueRest(which, true); };
    const no = el('button', 'act', 'No');
    no.onclick = () => { overlay._pendingRest = null; overlay.state = 'selection'; render(); };
    acts.append(yes, no);
    c.append(acts);
    return c;
  }

  function refusedCard() {
    const c = el('div', 'card');
    for (const line of overlay._refusalLines ?? []) c.append(el('p', null, line));
    const acts = el('div', 'acts');
    const ok = el('button', 'act', 'OK');
    ok.onclick = () => close();
    acts.append(ok);
    c.append(acts);
    return c;
  }

  function hoursCard() {
    const c = el('div', 'card');
    c.append(el('h2', null, overlay.mode === 'loiter' ? 'Loiter how many hours?' : 'Rest how many hours?'));
    const input = el('input', 'hours-field');
    input.type = 'number'; input.min = '1'; input.max = String(MAX_REST_HOURS);
    input.value = overlay._hoursValue;
    input.oninput = () => { overlay._hoursValue = input.value; };
    input.onkeydown = (e) => { if (e.key === 'Enter') startTimed(overlay.mode); };
    c.append(input);
    const acts = el('div', 'acts');
    const start = el('button', 'act', 'Start');
    start.onclick = () => startTimed(overlay.mode);
    const back = el('button', 'act', 'Back');
    back.onclick = () => { overlay.state = 'selection'; render(); };
    acts.append(start, back);
    c.append(acts);
    requestAnimationFrame(() => input.focus());
    return c;
  }

  // RESTFIX1 (2026-09-21, per-request: "the initiator and the one who rests with him both cant cancel the
  // resting! the button is not working and doesnt cancel it... waiting and healing to full cant be canceled
  // by both sides prob loitering too" - the bug this closed): `render()` used to run on EVERY tick while
  // resting (the countdown has to move every frame with no input at all), and `render()` rebuilds the whole
  // card from scratch - `host.innerHTML = ''` then fresh elements, the Stop button included. A real click is
  // mousedown-THEN-mouseup, two separate browser events spanning however many animation frames land between
  // them - and this window was tearing the button out from under the pointer and replacing it with a
  // LOOK-ALIKE roughly sixty times a second. A browser does not fire `click` across that substitution; the
  // button the finger came down on is gone by the time it lifts. Every mode, every side, exactly as reported
  // - nothing here ever depended on who started the rest.
  //
  // THE FIX is what the countdown actually needed all along: the STRUCTURE (the button, the labels, the
  // meter track) built ONCE, on the real state change into 'resting' - and every following tick only WRITES
  // into the three spots that move (the hour/time text, the meter's width, the vitals line), through node
  // references `_restingRefs` keeps, never through another `innerHTML = ''`.
  let _restingRefs = null;
  function restingCard() {
    const c = el('div', 'card');
    c.append(el('h2', null, MODE_LABEL[overlay.mode] ?? 'Resting'));
    const meter = el('div', 'meter');
    const k = el('div', 'meter-k'); k.append(el('span', null, overlay.mode === 'loiter' ? 'Time passed' : 'Hours remaining'));
    const v = el('span', 'meter-v');
    k.append(v);
    meter.append(k);
    const track = el('div', 'meter-track');
    const fill = el('div', 'meter-fill brass');
    track.append(fill);
    meter.append(track);
    c.append(meter);
    // REST-VITALS1 (2026-09-20, per-request: "while healing fully you dont see your magica and health and
    // fatigue so you dont know when its somewhat full you need to still track it"): restWindow.js's own
    // resting page already shows this exact line (restingLines()/its native counter draw, both read the SAME
    // deps.vitals()) - it just never made it into this skin's screen at all. Most load-bearing for FullRest,
    // which has no fixed hour countdown to watch at all - health/fatigue/magicka are the ONLY progress a
    // player resting until healed can see.
    const vitalsLine = el('p', 'vitals-line');
    c.append(vitalsLine);
    const acts = el('div', 'acts');
    const stop = el('button', 'act', 'Stop');
    // PARTY-REST19 (2026-09-22, per-request: "An non initiator MUST cancel the rest for all if he cancels
    // the ongoing resting" - the bug this closes: a follower's own Stop, being purely local per PARTY-REST1b,
    // left the person they were mirroring genuinely still resting, so `partyRestFollowTick`'s own "start a
    // new mirror" search immediately found them again and re-attached - the flash of a fresh resting screen,
    // healthy numbers and all, before it caught up and reverted to its own ended message a moment later. A
    // NEW, dedicated hook - never fired by a natural completion, an enemy break, or dismissing an already-
    // ended screen, only by an ACTUAL Stop click - so a host can tell the two apart and (only for a mirror)
    // ask the real rester to stop too, this time for real. Fired BEFORE `_end`, so the request is in flight
    // the same frame Stop is pressed, not delayed behind this window's own teardown.
    stop.onclick = () => { deps.onManualStop?.(); if (overlay.session) overlay._end(overlay.session.endEarly()); };
    acts.append(stop);
    _restingRefs = { hourLabel: v, fill, vitalsLine };
    updateRestingDisplay();
    c.append(acts);
    return c;
  }

  /** RESTFIX1: the per-frame half of restingCard - written into the three nodes it kept a reference to,
   *  never through render()/innerHTML. Safe to call whenever `_restingRefs` is set; `restingCard()` itself
   *  calls it once right after building those nodes, so the FIRST frame shows real numbers too, not a blank
   *  span waiting for the next tick. */
  function updateRestingDisplay() {
    if (!_restingRefs) return;
    const s = overlay.session;
    const total = Math.max(1, (s?.totalHours ?? 0) + (s?.hoursRemaining ?? 0));
    const done = overlay.mode === 'loiter' ? (s?.totalHours ?? 0) : total - (s?.hoursRemaining ?? 0);
    _restingRefs.hourLabel.textContent = overlay.mode === 'loiter' ? `${s?.totalHours ?? 0}h` : `${s?.hoursRemaining ?? 0}h`;
    _restingRefs.fill.style.width = `${Math.max(0, Math.min(100, (done / total) * 100))}%`;
    const vit = deps.vitals?.();
    _restingRefs.vitalsLine.textContent = vit ? `Health ${vit.health}/${vit.maxHealth}  Fatigue ${vit.fatigue}  Magicka ${vit.magicka}` : '';
  }

  function endedCard() {
    const c = el('div', 'card');
    for (const line of overlay._endLines ?? []) c.append(el('p', null, line));
    const acts = el('div', 'acts');
    const ok = el('button', 'act', 'OK');
    // restWindow.js's own input() on state === 'ended', verbatim law: "closing the finished popup is THE
    // advancement moment (RaiseSkills)." The died/no-lines path in overlay._end already calls both together;
    // this is the OTHER of the two places classic calls onRestFinished, and the one this skin was missing -
    // dismissing "You wake up"/"You are healed" without it silently dropped every skill-use raise a session of
    // successful sleep earned.
    ok.onclick = () => { close(); deps.onRestFinished?.(); };
    acts.append(ok);
    c.append(acts);
    return c;
  }

  function render() {
    if (!host) return;
    host.innerHTML = '';
    const shell = el('div', 'px-home px-over rest-shell');
    const win = el('div', 'px-win rest-win');
    for (const cd of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${cd}`));
    const body = el('div', 'px-body');
    body.append(
      overlay.state === 'selection' ? selectionCard()
        : overlay.state === 'hours' ? hoursCard()
          : overlay.state === 'confirm' ? confirmCard()
            : overlay.state === 'refused' ? refusedCard()
              : overlay.state === 'resting' ? restingCard()
                : endedCard(),
    );
    win.append(body);
    shell.append(win);
    host.append(shell);
  }

  let host = hostEl;
  let fired = false;
  let lockHandler = null;
  const close = () => {
    if (fired) return;
    fired = true;
    overlay.done = true;
    // restWindow.js's own _close(): "The flags first and UNGUARDED... Then the dispatch, ONCE" - cleared on
    // EVERY exit (Cancel from the picker, Stop mid-rest, or dismissing the ended message), or the flag raised on
    // open would leave the player permanently "resting" for the rest of the session.
    deps.setResting?.(false);
    deps.setLoitering?.(false);
    if (lockHandler && typeof document !== 'undefined') document.removeEventListener('pointerlockchange', lockHandler);
    host?.remove();
    host = null;
    deps.onClose?.();
    // ENHANCED-REST-DISPOSE1 (2026-09-22, per-request: "the resting window was fully classic ui even in
    // enhanced and online mode. Now that we use Enhanced ui for th resting screen maybe this couldve broke
    // something" - the bug this closes): every ordinary way this window ends - OK, Cancel, Stop, dismissing
    // the ended message - calls THIS function directly, never `overlay.dispose()`. restDoor.js's
    // `enhancedRestOverlay` wraps `overlay.dispose` specifically to `unregister()` this window from the
    // PX28 stack (ui/enhancedOverlays.js) it registered itself on when it opened - and chatPanel's own
    // Enter-to-open check (ui/chatPanel.js's `isOpenKey`, default `overlay = overlayOpen`) refuses to open
    // chat at all while ANYTHING is still on that stack. Since nothing here ever called the wrapped
    // `dispose`, the registration was NEVER removed on a normal rest completion - it just sat there,
    // permanently blocking Enter-to-open-chat (and, since the social button lives inside the same chat
    // panel, hiding it too) until the player eventually left the building entirely (interiorWindows.clear's
    // own `dispose` sweep is what finally cleaned it up, incidentally, on the way out). `overlay.dispose` may
    // already be either the bare alias below or restDoor.js's own wrapped version by the time this actually
    // runs - either way, calling it here is what was missing; the `fired` guard above makes this safe to
    // call even when `dispose` re-enters this same function (the bare alias's own case).
    overlay.dispose?.();
  };

  render();
  releaseLock();
  lockHandler = releaseLock;
  if (typeof document !== 'undefined') document.addEventListener('pointerlockchange', lockHandler);
  // Merged onto the SAME object the callers above already read `.session`/`.mode`/`.state`/`._start`/`._end` off
  // of, so a caller holding `townTalk.overlay` (world.js's PARTY-REST1/2, worldModes.js's/dungeonContext.js's own
  // restState getters) never has to know or care which skin built the window it is looking at.
  overlay.input = () => { /* the DOM's own keydown/click own the keyboard and pointer - see onKey/button.onclick above */ };
  overlay.click = () => { /* fixed div, pointers never reach the canvas */ };
  overlay.wheel = () => {};
  overlay.hover = () => {};
  overlay.draw = () => { /* DOM, not canvas */ };
  overlay.tick = (dt) => {
    if (overlay.state !== 'resting' || !overlay.session) return;
    const r = overlay.session.tick(dt);
    if (r) { overlay._end(r); return; }
    // RESTFIX1: in place, never a full rebuild - see restingCard's own doc comment for the bug a per-frame
    // innerHTML rebuild caused (the Stop button torn out from under a click roughly sixty times a second).
    updateRestingDisplay();
  };
  overlay.dispose = () => close();
  return overlay;
}

/** THE ENHANCED REST WINDOW, opened: its own fixed host on the page (z-index 13, the depth every in-game enhanced
 *  screen shares - ui/tradeDoor.js, ui/inventoryDoor.js) and the view mounted into it. ui/restDoor.js is the fork
 *  that calls this on the enhanced skin; the window object it returns carries every generic arm a host's frame
 *  drives (done, input, click, wheel, hover, tick, draw, dispose - assigned above, and pinned by
 *  test/partyrest1.test.js), so a host reads it exactly as it reads ui/restWindow.js's RestWindow. */
export function openEnhancedRest(deps) {
  const host = document.createElement('div');
  host.id = 'enhanced-rest';
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);
  return mountEnhancedRest(host, deps);
}
