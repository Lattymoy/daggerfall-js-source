// @ts-check
// LEGACY3: THE SUCCESSION'S DOOR - the one place a host opens the Succession through (ui/legacySuccession.js). The
// Bounty board's door's shape (ui/bountyDoor.js): a lazy chunk mounted through the one home (ui/enhancedChunk.js) in a
// host of its own, wrapped in the generic overlay shape every host's frame drives - and NOT registered with the overlay
// stack, whose Escape would close it (AUDIT LEGACY U10: this header said it was): a death must be answered, and an
// unanswered Succession is a dead player in a world with no one to play. AUDIT LEGACY U3: the keyboard walks it - the
// arrows and Tab move over its buttons, Enter and Space press the one lit (the host's ladder prevents the browser's own
// focus walk under an overlay, so the window walks itself).
import { mountEnhancedChunk } from './enhancedChunk.js';

/** @type {any} */ let _open = null;

/** AUDIT LEGACY U3: a key over a window of buttons - the arrows (and Tab, Shift for back) move the focus, Enter and Space
 *  press the lit button (the first when none is). Pure but for the DOM it is handed. */
export function walkButtons(root, code, e = null) {
  const btns = [...(root?.querySelectorAll?.('button') ?? [])].filter((b) => !b.disabled);
  if (!btns.length) return false;
  const doc = root.ownerDocument ?? globalThis.document;
  const at = btns.indexOf(doc?.activeElement);
  const step = (d) => { const i = at < 0 ? (d > 0 ? 0 : btns.length - 1) : (at + d + btns.length) % btns.length; btns[i].focus?.(); return true; };
  if (code === 'ArrowDown' || code === 'ArrowRight' || (code === 'Tab' && !e?.shiftKey)) return step(1);
  if (code === 'ArrowUp' || code === 'ArrowLeft' || (code === 'Tab' && e?.shiftKey)) return step(-1);
  // AUDIT LEGACY II U1: a held key presses once - its repeats press nothing
  if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') { if (!e?.repeat) (btns[at] ?? btns[0]).click?.(); return true; }
  return false;
}
export const successionOpen = () => !!_open && !_open.done;

/**
 * @param {any} deps the window's deps (ui/legacySuccession.js mountSuccession), plus `onClose` (the host's word it is
 *   shut - the boot it asked for is under way, or the line ended).
 * @returns {any} the overlay, or null with no document
 */
export function createSuccessionOverlay(deps) {
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'legacy-succession-host';
  host.setAttribute('data-no-back', '');   // AUDIT LEGACY II U14: a death has to be answered - the pad's bar offers no Back
  host.style.cssText = 'position:fixed;inset:0;z-index:14;background:transparent;overflow:hidden';
  document.body.append(host);
  const close = () => {
    if (fired) return;
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not read true while the DOM is up
    if (_open === overlay) _open = null;
    deps.onClose?.();
  };
  const overlay = {
    isChoiceWindow: true,
    holdsTop: true,   // as the death screen it follows: a box pushed while it is up waits beneath
    get done() { return fired; },
    input(code, e = null) { walkButtons(host, code, e); },
    click() {},
    wheel() {},
    hover() {},
    tick() {},
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
    repaint() { view?.repaint(); },
  };
  _open = overlay;
  mountEnhancedChunk({
    load: () => import('./legacySuccession.js'),
    mount: (m) => {
      view = m.mountSuccession(host, {
        ...deps,
        choose: (key) => deps.choose(key),
        end: deps.end ? { ...deps.end, act: () => { deps.end.act(); } } : null,
      });
    },
    alive: () => !fired, host, onDismiss: () => close(), label: 'legacy-succession',
  });
  return overlay;
}

/**
 * LEGACY-HOME: ONE OF THE LINE, MET IN THE WORLD - the Succession's window (one card, the member's) over the talk's
 * door: Play as them, Talk (the town's own conversation), Goodbye. Unlike the Succession it is a meeting, not a death:
 * Escape is Goodbye, and nothing of `successionOpen` is set.
 * @param {{ title:string, lines:string[], who:any, name:string, sub:string, act:string, why:string|null, faces?:any,
 *   play:() => {ok:boolean, why?:string}, talk:() => void }} deps
 * @returns {any} the overlay, or null with no document
 */
export function createKinOverlay(deps) {
  if (typeof document === 'undefined') return null;
  let fired = false;
  let view = null;
  const host = document.createElement('div');
  host.id = 'legacy-kin-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:14;background:transparent;overflow:hidden';
  document.body.append(host);
  const close = () => {
    if (fired) return;
    view?.unmount();
    view = null;
    host.remove();
    fired = true;
  };
  const overlay = {
    isChoiceWindow: true,
    get done() { return fired; },
    input(code, e = null) {
      if (code === 'Escape') { close(); return; }
      walkButtons(host, code, e);
    },
    click() {},
    wheel() {},
    hover() {},
    tick() {},
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
    repaint() { view?.repaint(); },
  };
  mountEnhancedChunk({
    load: () => import('./legacySuccession.js'),
    mount: (m) => {
      view = m.mountSuccession(host, {
        title: deps.title, lines: deps.lines, faces: deps.faces,
        // AUDIT LEGACY II U2: Talk lit first, and Play as asked twice - one Space (the Jump key) or Enter saved and left
        // the one played on the spot
        choices: [{ key: 'play', who: deps.who, name: deps.name, sub: deps.sub, act: deps.act, why: deps.why, confirm: `Yes - ${deps.act.charAt(0).toLowerCase()}${deps.act.slice(1)}` }],
        lit: 'lgs-act-talk',
        choose: () => { const r = deps.play(); if (r?.ok) close(); return r; },
        // Talk: the window down first, then the town's conversation opens in its place
        acts: [{ key: 'talk', label: 'Talk', act: () => { close(); deps.talk(); } }, { key: 'bye', label: 'Goodbye', act: () => close() }],
      });
    },
    alive: () => !fired, host, onDismiss: () => close(), label: 'legacy-kin',
  });
  return overlay;
}
