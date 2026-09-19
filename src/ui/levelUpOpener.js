// ═══════════════════════════════════════════════════════════════════
// LV3 — THE LEVEL-UP BUTTON'S ONE DOOR (enhanced skin).
//
// Dudey, 2026-09-19: "a button to open the levelup screen again once
// closed - you can't open it again when you level up, so having this
// screen on a button would be great."
//
// THE SHEET IS WHERE A LEVEL IS SPENT (ui/charSheetDoor.js): while
// `readyToLevelUp` is set the sheet key returns the level-up window, in
// all four hosts, and `readyToLevelUp` stays set until the points are in
// the stats. What was missing was a way to ASK for it that is not a key
// the player has to know: the strip's standing line was a label, and the
// pause window's Stats page - the one place a mouse player looks - had
// Pack, Spellbook and Chronicle but no door to the rollout.
//
// THIS MODULE PRESSES THE SHEET KEY, NOT A HOST. There are four hosts
// (world, exterior, the interior arm, the dungeon), each with its own
// slot and its own key ladder, and every one of them already answers
// the CharacterSheet action by mounting the door. A button that reached
// into one host's slot would be three more places to forget it; a
// button that speaks the input language is the touch layer's own idiom
// (ui/touch.js `tapAction`: "A TOUCH CONTROL PRESSES AN ACTION, NOT A
// LETTER") and needs no host to learn anything.
//
// AND LIKE THE TOUCH LAYER, AN UNBOUND ACTION PRESSES NOTHING: a player
// who cleared the sheet binding has no way in, and a button that fires
// whatever key used to be there would press some other action's key.
// The callers hide the button in that case (`levelUpDoorBound`).
// ═══════════════════════════════════════════════════════════════════

import { bindings } from './input.js';
import { codeForAction, getCombo } from '../systems/inputActions.js';

/** Is there a key to press? False when the sheet action is unbound. */
export const levelUpDoorBound = () => codeForAction(bindings(), 'CharacterSheet') != null;

const synth = (win, type, code) => win.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));

/**
 * Press the sheet key, which opens the level-up window while a level is
 * owed. `defer` sends it on the next task instead of now: the pause
 * window's button RESUMES first (two overlays at once is the stacking
 * bug U55 found), and the host's key ladder should see the press after
 * the slot has been handed back rather than in the same call.
 * Answers whether a press was sent.
 */
export function openLevelUpWindow({ defer = false, win = globalThis } = {}) {
  const code = codeForAction(bindings(), 'CharacterSheet');
  if (code == null || typeof win?.dispatchEvent !== 'function' || typeof KeyboardEvent === 'undefined') return false;
  const codes = getCombo(code) ?? [code];   // a chord presses its modifiers too, as the touch layer's `codesOf` does
  const press = () => {
    for (const c of codes) synth(win, 'keydown', c);
    for (const c of [...codes].reverse()) synth(win, 'keyup', c);
  };
  if (defer) setTimeout(press, 0); else press();
  return true;
}
