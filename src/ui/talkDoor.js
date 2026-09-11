// ═══════════════════════════════════════════════════════════════════
// ET1 - THE TALK WINDOW'S ONE DOOR (2026-09-11).
//
// Mac: "the talk menu. My goal is to transform it into a rectangular
// panel akin to Fallout/Skyrim instead of a full screen menu."
//
// The seventh door of the shape the pause, the pack, the sheet, the
// spellbook, the chronicle and the travel map already wear: ONE
// function builds the conversation window this skin shows, and the
// host that opens a conversation (scenes/townTalk.js's openTalkWindow,
// the port's one talk door under every NPC) never learns which face
// it got.
//
// ── ONE MODEL, TWO FACES ─────────────────────────────────────────
//
// Unlike the earlier doors this one builds the CLASSIC window on both
// skins. NativeTalkWindow is where DFU's conversation law lives - the
// pages, the selection model, the tone guard, the Q/A pair, the
// logbook copy set and the note it files on close - and the enhanced
// panel (ui/enhancedTalk.js) is a second FACE over that same object:
// it presses the model's named buttons and draws the model's state.
// Its draw() is simply never called. So there is nothing for the two
// skins to disagree about, which is the fault PX27 found two enhanced
// character sheets in.
//
// ── THE OVERLAY SHAPE ────────────────────────────────────────────
//
// The host's slot takes a canvas-window contract and the panel is a
// DOM div, so the door returns the pause door's overlay object: every
// canvas arm a deliberate no-op, `done` true only once the DOM is
// gone, dynamic import so classic pays nothing, and a mount failure
// that says goodbye rather than leaving a frozen game. The one arm
// that is NOT a no-op is `input`: this host routes raw key codes to a
// ChoiceWindow, and the panel wants them.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { registerOverlay } from './enhancedOverlays.js';   // PX28: Tab puts it away
import { NativeTalkWindow, talkArtLoaded } from './nativeTalk.js';

/** The gate a host asks before it opens a conversation window. The
 *  classic face needs TALK01I0 and its strips; the panel reads none
 *  of it. Same law as ui/spellbookDoor.js. */
export function talkDoorReady() {
  return isEnhanced() || talkArtLoaded();
}

/**
 * Build the conversation window this skin wears. `greeting` and
 * `hooks` are NativeTalkWindow's own - the session seam townTalk
 * assembles - plus `hooks.relock`, the host's pointer-lock request,
 * which the panel runs inside its closing gesture (MAC1).
 */
export function createTalkWindow(greeting, hooks) {
  const model = new NativeTalkWindow(greeting, hooks);
  // `document` for the reason the other doors give: node drives the
  // hosts headless and keeps the canvas window rather than getting a
  // special case written for it.
  if (isEnhanced() && typeof document !== 'undefined') return enhancedTalkOverlay(model, hooks);
  return model;
}

function enhancedTalkOverlay(model, hooks) {
  let host = null;
  let view = null;
  let torn = false;
  let unregister = () => {};
  const teardown = () => {
    if (torn) return;
    torn = true;   // `done` reads this: true only once the DOM is going
    unregister();
    try { view?.destroy?.(); } catch { /* already gone */ }
    try { host?.remove(); } catch { /* ditto */ }
    host = null; view = null;
  };
  // Goodbye THROUGH THE MODEL, so the OnPop note is filed and the
  // session's onClose fires - Tab (PX28) and the mount failure both
  // take this arm, never a bare teardown.
  const goodbye = () => {
    if (!model.done) model.press('goodbye');
    teardown();
  };
  host = document.createElement('div');
  host.id = 'enhanced-talk';
  // The div covers the view so the host's canvas never sees a pointer
  // under the panel; the shell inside it lets the WORLD show through
  // and only the panel takes pointers.
  host.style.cssText = 'position:fixed;inset:0;z-index:11';
  document.body.append(host);
  unregister = registerOverlay(goodbye);
  import('./enhancedTalk.js').then(({ mountEnhancedTalk }) => {
    if (torn) return;
    view = mountEnhancedTalk(host, { model, onExit: teardown, relock: () => hooks.relock?.() });
  }).catch((e) => {
    console.warn('[talk] the enhanced panel could not mount:', e?.message ?? e);
    goodbye();
  });
  return {
    // THE HOST CONTRACT, in the hosts' own words - the arms townTalk's
    // slot dereferences (input, click, hover, wheel, tick, draw, and
    // dispose on replacement). Same shape as ui/pauseDoor.js.
    isChoiceWindow: true,
    get done() { return torn; },
    /** The host's routed code. Before the panel has mounted (one
     *  import away) the classic accelerators still work on the model. */
    input(code) {
      if (torn) return;
      if (view) view.key(code);
      else { model.input(code); if (model.done) teardown(); }
    },
    /** Consumed: a press that reaches the canvas beside the panel is
     *  a press on the conversation, and must not grab the pointer. */
    click() { return true; },
    wheel() { /* the panel scrolls itself */ },
    hover() { /* the panel has its own :hover, and no canvas to hit-test */ },
    tick() { /* nothing on this panel moves on a clock */ },
    /** Per frame: the portrait lands async, and a model closed by a
     *  route that bypassed the view (the door's own input arm) tears
     *  the DOM down here. */
    draw() {
      if (model.done && !torn) teardown();
      else view?.frame?.();
    },
    close: goodbye,
    // `dispose` and `destroy` are the hosts' words for a REPLACED
    // window: the classic face fires nothing on replacement, so this
    // only clears the DOM.
    dispose: teardown,
    destroy: teardown,
  };
}
