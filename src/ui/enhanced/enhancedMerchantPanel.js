// ENHANCED MERCHANT PANEL — the small button list a shopkeeper (Talk /
// Sell or Banking / Exit) or a repair-shop merchant (Repair / Talk /
// Sell / Exit) puts in front of you, drawn in the same small-dialog
// family as enhancedTavern.js's own main screen rather than
// ui/merchant/merchantServiceWindow.js's / ui/merchant/merchantRepairWindow.js's classic
// GNRC01I0/REPR01I0 art panel.
//
// ui/merchant/merchantServiceDoor.js and ui/merchant/merchantRepairDoor.js are the two
// gates: this module mounts ONLY in enhanced mode - native/classic
// mode keeps the two classic windows exactly as they were.
//
// ONE VIEW, TWO DOORS: the button LIST is the only thing that differs
// between a plain shop and a repair shop, so this file knows nothing
// about which merchant it is - a door hands it a title and a row of
// {label, onClick} and this draws them, exactly the shape
// enhancedTavern.js's own four-button screen already established.

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction } from '../input.js';
import { listenWindowKeys } from '../windowStack.js'; // COVERED-KEYS: the window's keys, gated while a box covers it

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** MENU-ORDER (2026-10-12): a merchant's presses, each its picture (ui/menu/menuGlyphs.js), by its word. */
export const MERCHANT_ICONS = Object.freeze({
  Talk: 'talk',
  Sell: 'treasure',
  Banking: 'treasure',
  'Repair item': 'anvil',
  Exit: 'back',
});

let host = null;
let title = '';
let buttons = [];
let onExit = () => {};
let unregisterOutside = () => {};
let unlistenKeys = null;

function render() {
  if (!host) return;
  host.innerHTML = '';
  const shell = el('div', 'px-home px-over tavern-shell merchant-shell');
  const win = el('div', 'px-win tavern-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));

  const head = el('header', 'sb-top');
  const who = el('div', 'sb-who');
  who.append(el('h2', null, title));
  head.append(el('span', 'sb-spacer'), who);
  win.append(head);

  const body = el('div', 'px-body');
  const wrap = el('div', 'tavern-menu-acts');
  for (const b of buttons) {
    const btn = el('button', 'act tavern-act', b.label);
    const icon = b.icon ?? MERCHANT_ICONS[b.label]; // MENU-ORDER: each press its picture; APPEARANCES: a press may name its own (its word is the player's language)
    if (icon) btn.setAttribute('data-dficon', icon);
    btn.onclick = b.onClick;
    wrap.append(btn);
  }
  body.append(wrap);
  win.append(body);

  shell.append(win);
  host.append(shell);
  unregisterOutside();
  unregisterOutside = closeOnOutsideTap(shell, '.px-win', onExit);
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (overlayAction(e) === 'back') {
    e.preventDefault();
    onExit();
  }
}

/**
 * Mounts the panel. `buttons` is [{label, onClick}], in the order they
 * should list (the last is conventionally Exit, but this file does not
 * care which one is which - the door wires that). `owner` is the panel's
 * stack window: its keys are gated on it (windowStack.js listenWindowKeys).
 */
export function mountEnhancedMerchantPanel(hostEl, { title: t, buttons: btns, onExit: exit, owner = null }) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  host = hostEl;
  title = t;
  buttons = btns;
  onExit = exit ?? (() => {});
  render();
  unlistenKeys?.(); // a mount over a mount lays one listener, as the window's own addEventListener of one function did
  unlistenKeys = listenWindowKeys(owner, onKey);
  return {
    repaint: render,
    unmount() {
      unlistenKeys?.();
      unlistenKeys = null;
      unregisterOutside();
      unregisterOutside = () => {};
      host = null;
      buttons = [];
    },
  };
}
