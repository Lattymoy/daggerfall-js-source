// @ts-check
// MODE-WHEEL (a recorded departure, Port-Ledger A; the player: "change the interaction model (steal, info, etc)
// into something more palatable and streamlined with easy input"): THE INTERACTION-MODE WHEEL.
//
// DFU picks PlayerActivate's mode with four keys (F1-F4: Steal, Grab, Info, Talk - PlayerActivate.cs:221-228), far
// from the movement hand, with nothing on screen to say which is which. The wheel is one held key instead: HOLD the
// ModeWheel action (Left Alt by default - CROUCH-SNEAK freed it), FLICK the mouse toward a mode, LET GO to choose.
// Talk is up, Grab right, Steal down, Info left. A release with no flick keeps the mode. The mode itself is not
// touched here: the host's `pick` is ChangeInteractionMode (townTalk.js setMode, dungeon.js's own copy), so the
// mid-screen line, the SENSE1 asks and the no-op on the same mode stay that function's.
//
// The four mode actions keep their rows (unbound by default) and still set the mode directly; the pad's NextMode
// and the touch cycle button are untouched.
//
// THE MOUSE IS THE WHEEL'S WHILE IT IS OPEN: a host's mousemove hands its delta to `look()` first and turns no
// camera when it answers true (scenes/world.js, scenes/exterior.js, scenes/dungeon.js - the three hosts that own a
// look; worldModes.js and dungeonContext.js ride world.js's and dungeon.js's).
//
// The face is a DOM overlay in the enhanced tokens (with fallbacks, so the classic skin draws it too), centred on the
// screen, pointer-events none. It exists only while the key is held.

import { getInteractionMode } from '../player/interactionMode.js';

/** The four spokes, clockwise from the top: [mode, label]. */
export const MODE_WHEEL_SPOKES = Object.freeze([
  Object.freeze(['dialogue', 'Talk']),
  Object.freeze(['grab', 'Grab']),
  Object.freeze(['steal', 'Steal']),
  Object.freeze(['info', 'Info']),
]);

/** How far (CSS px of raw mouse movement) the flick must travel before a spoke is chosen, and the most the pointer
 *  is allowed to wander - so a flick back the other way changes the choice at once instead of unwinding a long arm. */
export const MODE_WHEEL_DEAD_ZONE = 18;
export const MODE_WHEEL_MAX_ARM = 60;

/** The spoke a flick of (dx, dy) points at - screen axes, +y down - or null inside the dead zone. Quadrants are
 *  centred on the spokes: up within 45 degrees is Talk, and so round. */
export function spokeOf(dx, dy, deadZone = MODE_WHEEL_DEAD_ZONE) {
  if (!(Math.hypot(dx, dy) >= deadZone)) return null;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'dialogue' : 'steal';
  return dx > 0 ? 'grab' : 'info';
}

/**
 * THE wheel - one player, one wheel (the interactionMode.js idiom), so its two window listeners are attached once,
 * on the first open, and never leak across host rebuilds. `doc` is injectable for tests; without a document the
 * wheel still picks, it only draws nothing.
 */
export function createModeWheel(doc = globalThis.document ?? null) {
  let open = false;
  let code = null;   // the key that opened it - its release is the choice
  let pick = null;   // the opening host's ChangeInteractionMode
  let x = 0, y = 0;
  let spoke = null;
  let root = null;
  let listening = false;
  const cells = new Map();

  function build() {
    if (root || !doc?.createElement) return;
    root = doc.createElement('div');
    root.className = 'mode-wheel';
    root.setAttribute('aria-hidden', 'true');
    Object.assign(root.style, {
      position: 'fixed', left: '50%', top: '50%', width: '200px', height: '200px', margin: '-100px 0 0 -100px',
      borderRadius: '50%', pointerEvents: 'none', zIndex: '40', display: 'none',
      background: 'radial-gradient(circle, rgba(14,16,19,0.15) 0 22%, rgba(14,16,19,0.72) 23% 100%)',
      border: '1px solid var(--iron, #2b323b)', boxShadow: '0 0 24px rgba(0,0,0,0.5)',
      font: '600 15px var(--data, system-ui, sans-serif)', letterSpacing: '0.08em', textTransform: 'uppercase',
    });
    const at = { dialogue: [50, 16], grab: [84, 50], steal: [50, 84], info: [16, 50] };
    for (const [mode, label] of MODE_WHEEL_SPOKES) {
      const c = doc.createElement('div');
      c.textContent = label;
      Object.assign(c.style, {
        position: 'absolute', left: `${at[mode][0]}%`, top: `${at[mode][1]}%`, transform: 'translate(-50%, -50%)',
        padding: '4px 8px', borderRadius: '3px', color: 'var(--dim, #9a9486)', whiteSpace: 'nowrap',
      });
      root.append(c);
      cells.set(mode, c);
    }
    doc.body?.append(root);
  }

  function listen() {
    const win = doc?.defaultView;
    if (listening || !win?.addEventListener) return;
    listening = true;
    // the key's release reaches here whoever else hears it, and a lost focus (alt-tab - Alt is the default key)
    // closes the wheel WITHOUT choosing, so a key whose keyup the page never saw does not leave it standing
    win.addEventListener('keyup', (e) => { release(e); });
    win.addEventListener('blur', () => close(false));
  }

  function paint() {
    if (!root) return;
    root.style.display = open ? 'block' : 'none';
    if (!open) return;
    const now = getInteractionMode();
    for (const [mode, c] of cells) {
      const lit = mode === (spoke ?? now);
      c.style.color = lit ? 'var(--bone, #e9e4d9)' : 'var(--dim, #9a9486)';
      c.style.background = lit ? 'var(--brass, #c08a3e)' : 'transparent';
      c.style.textDecoration = mode === now ? 'underline' : 'none';
    }
  }

  function close(choose) {
    if (!open) return;
    open = false;
    const chosen = spoke, to = pick;
    code = null; pick = null; spoke = null;
    paint();
    if (choose && chosen && to) to(chosen);
  }

  /** The ModeWheel action's press, already past the host's pause gate. `onPick` is the host's ChangeInteractionMode;
   *  `e.code` is remembered, and its release chooses. A repeat (the held key's auto-repeat) is no new press. */
  function press(e, onPick) {
    if (open || e?.repeat || typeof onPick !== 'function') return false;
    open = true;
    code = e?.code ?? null;
    pick = onPick;
    x = 0; y = 0; spoke = null;
    listen();
    build();
    paint();
    return true;
  }

  /** A release: the opening key's chooses; any other is not the wheel's. */
  function release(e) {
    if (!open || (code != null && e?.code !== code)) return false;
    close(true);
    return true;
  }

  /** The mouse's delta while open: steers the wheel and answers true, so the host turns no camera. */
  function look(dx, dy) {
    if (!open) return false;
    x += dx || 0; y += dy || 0;
    const r = Math.hypot(x, y);
    if (r > MODE_WHEEL_MAX_ARM) { x *= MODE_WHEEL_MAX_ARM / r; y *= MODE_WHEEL_MAX_ARM / r; }
    const s = spokeOf(x, y);
    if (s && s !== spoke) { spoke = s; paint(); }
    return true;
  }

  return {
    press, release, look,
    cancel: () => close(false),
    isOpen: () => open,
    spoke: () => spoke,
  };
}

/** The one wheel every host opens. */
export const modeWheel = createModeWheel();

/** The action that opens it (systems/inputActions.js). */
export const MODE_WHEEL_ACTION = 'ModeWheel';
