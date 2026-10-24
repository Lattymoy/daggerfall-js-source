// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD-PANE OPEN (2026-10-24, Travis: "go ahead and add that open in pack button and lets see how it functions") -
// THE GUILD WINDOW'S VAULT PAGE OPENS THE PACK WITH THE VAULT BESIDE IT (bible/11-Multiplayer/Guild-Overhaul.md
// GUILD-PANE).
//
// The pack is every host's own: the street's, an interior's and a dungeon's each open it in their own slot on the
// Inventory action's key. So the button speaks the input language, as the level-up row does (ui/levelUp/
// levelUpOpener.js: "a button that speaks the input language ... needs no host to learn anything"): it presses that
// key, and leaves the pack that opens a WORD - open on the vault - which the pack takes once, on mounting
// (ui/enhanced/enhancedInventory.js). A word older than VAULT_PANE_WANT_MS is let go, so a pack opened by hand later
// is never the vault's. An unbound key presses nothing, and the page shows no button (`vaultPaneBound`).
//
// Not a DFU member (Ledger A: the guild vault is the port's own).
import { bindings } from './input.js';
import { codeForAction, getCombo } from '../systems/inputActions.js';

/** How long the word waits for its pack, ms: the window's close and a deferred key press are a task or two. */
export const VAULT_PANE_WANT_MS = 3000;

/** @type {number|null} when the word was left, or null - none */
let _wantedAt = null;

/** Whether there is a key to press: false when the Inventory action is unbound. */
export const vaultPaneBound = () => codeForAction(bindings(), 'Inventory') != null;

const synth = (win, type, code) => win.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));

/**
 * Leave the word and press the pack key. `defer` sends the press on the next task (the guild window goes down first:
 * two overlays at once is the stacking bug U55 found). Answers whether a press was sent; with none, no word is left.
 * @param {{ defer?: boolean, win?: any, now?: () => number }} [opts]
 */
export function openVaultInPack({ defer = true, win = globalThis, now = () => Date.now() } = {}) {
  const code = codeForAction(bindings(), 'Inventory');
  if (code == null || typeof win?.dispatchEvent !== 'function' || typeof KeyboardEvent === 'undefined') return false;
  const codes = getCombo(code) ?? [code];   // a chord presses its modifiers too, as the touch layer's `codesOf` does
  _wantedAt = now();
  const press = () => {
    for (const c of codes) synth(win, 'keydown', c);
    for (const c of [...codes].reverse()) synth(win, 'keyup', c);
  };
  if (defer) setTimeout(press, 0); else press();
  return true;
}

/** The pack's side: whether a fresh word waits for it - taken once, and let go whatever it answers. */
export function takeVaultPaneWanted(now = Date.now()) {
  const at = _wantedAt;
  _wantedAt = null;
  return at != null && now - at >= 0 && now - at <= VAULT_PANE_WANT_MS;
}
