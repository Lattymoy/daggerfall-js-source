// PEERMENU1: THE PLAYER MENU'S BIND, ON THE CONTROLS PAGE - Enhanced and Enhanced Plus (online is always one of the
// two). Two rows, keyboard and controller: the button, and whether it is a PRESS or a HOLD. It is the port's own pref
// (systems/peerMenuBind.js), not a registry row, so it saves at once rather than with the page's Confirm.
import { peerMenuBind, setPeerMenuBind, resetPeerMenuBinds, PEER_MENU_DEFAULTS } from '../systems/peerMenuBind.js';
import { buttonText } from '../systems/controlsConfig.js';
import { hdGlyphName } from './padGlyphsHD.js';
import { padFamily } from './padGlyphs.js';
import { setPlusBindCapture } from './plusPad.js';

let armed = null;          // 'key' | 'pad' | null
let quietUntil = 0;        // a captured pad B still sends its Back a moment later - it is swallowed, not a back-out
let listener = null, repaintFn = () => {};

/** Is this card taking keys - the shell's own Escape stands down while it is (ui/enhancedMenu.js onKey). */
export const peerBindBusy = () => !!armed || Date.now() < quietUntil;

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const nameOf = (kind, code) => (code == null ? 'NONE' : kind === 'pad' ? (hdGlyphName(padFamily() ?? 'xbox', code) ?? code) : buttonText(code, true));

function disarm() {
  armed = null;
  setPlusBindCapture(false);
  if (listener) { document.removeEventListener('keydown', listener, true); listener = null; }
}

function arm(kind) {
  disarm();
  armed = kind;
  if (kind === 'pad') setPlusBindCapture(true);   // the Plus poller lets every pad press through as its own code
  listener = (e) => {
    const code = e.code || e.key;
    if (!armed) return;
    const isPad = typeof code === 'string' && code.startsWith('Joystick');
    // the keyboard's Escape cancels either row; a pad row ignores the keyboard, a key row ignores the pad
    if (code === 'Escape' && !isPad) { e.preventDefault(); e.stopImmediatePropagation(); disarm(); quietUntil = Date.now() + 250; repaintFn(); return; }
    if ((armed === 'pad') !== isPad) return;
    if (isPad && /^JoystickAxis(1|2|3|4|5)Button[01]$/.test(code)) { e.stopImmediatePropagation(); return; }   // a stick's lean
    e.preventDefault(); e.stopImmediatePropagation();
    if (!['Shift', 'Control', 'Alt', 'Meta'].some((m) => code.startsWith(m))) {
      setPeerMenuBind(armed, { code });
      quietUntil = Date.now() + 600;
      disarm();
      repaintFn();
    }
  };
  document.addEventListener('keydown', listener, true);
  repaintFn();
}

/** The card, for the Controls pane. `render` is the shell's repaint. */
export function peerMenuBindCard(render = () => {}) {
  repaintFn = render;
  const c = el('div', 'card ctl-group ctl-peermenu');
  c.append(el('h3', null, 'Player menu (online mode only)'));
  c.append(el('p', 'meta', 'Trade, invite to party, inspect ... Aim at a player within reach and use this to open their menu; '
    + 'the same again, or looking away, puts it away. A hold leaves the key\'s tap to its other job (E still interacts). Saved at once.'));
  for (const [kind, label] of [['key', 'Keyboard'], ['pad', 'Controller']]) {
    const b = peerMenuBind(kind);
    const row = el('div', 'row ctl-row');
    const main = el('div', 'row-main');
    main.append(el('div', 'row-name', label));
    row.append(main);
    const ctl = el('div', 'ctl');
    const key = el('button', `act rowact ctl-key${armed === kind ? ' ctl-arm' : ''}`,
      armed === kind ? (kind === 'pad' ? 'PRESS A CONTROLLER BUTTON' : 'PRESS A KEY') : nameOf(kind, b.code));
    key.type = 'button';
    key.onclick = (e) => { e.stopPropagation(); if (armed === kind) { disarm(); render(); } else arm(kind); };
    const mode = el('button', 'act rowact ctl-holdmode', b.hold ? 'Hold' : 'Press');
    mode.type = 'button';
    mode.title = 'Hold: fires after holding the button a moment. Press: fires at once.';
    mode.onclick = (e) => { e.stopPropagation(); setPeerMenuBind(kind, { hold: !b.hold }); render(); };
    const clear = el('button', 'act ctl-clear', '\u2715');
    clear.type = 'button';
    clear.title = `Unbind (${label.toLowerCase()})`;
    clear.disabled = b.code == null;
    clear.onclick = (e) => { e.stopPropagation(); setPeerMenuBind(kind, { code: null }); render(); };
    ctl.append(key, mode, clear);
    row.append(ctl);
    c.append(row);
  }
  const reset = el('button', 'act', `Defaults (hold ${buttonText(PEER_MENU_DEFAULTS.key.code)} / hold ${nameOf('pad', PEER_MENU_DEFAULTS.pad.code)})`);
  reset.type = 'button';
  reset.onclick = (e) => { e.stopPropagation(); disarm(); resetPeerMenuBinds(); render(); };
  c.append(reset);
  return c;
}

/** Leaving the page drops a capture in progress. */
export const discardPeerMenuCapture = () => disarm();
